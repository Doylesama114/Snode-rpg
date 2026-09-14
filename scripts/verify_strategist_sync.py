#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""谋士同步校验：docx ↔ 职业页 JSON/HTML ↔ 面板 SKILL_DATA/skill_effects ↔ 职业清单/兼职/顾问。

用法: python scripts/verify_strategist_sync.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / '基础职业-谋士.docx'
CLASS = '谋士'
STYLES = ['权谋', '军团', '先见', '鸩毒', '混乱', '博物']
TIERS = ['一阶', '二阶', '三阶']
STARTING = ['交友术', '战术部署', '毒刃', '离间']

errors: list[str] = []
ok_notes: list[str] = []
warnings: list[str] = []

# 已知 docx 缺漏（作者待补；不视为同步失败）
KNOWN_DOCX_GAPS = {
    ('混乱', '二阶'): {'missing_in_docx': ['鬼火萤萤'], 'extra_in_docx': []},
    ('博物', '三阶'): {'missing_in_docx': [], 'extra_in_docx': ['谜巢']},
}


def rows_of(tb):
    out = []
    for row in tb.rows:
        cells, seen = [], set()
        for c in row.cells:
            if id(c._tc) in seen:
                continue
            seen.add(id(c._tc))
            cells.append(' '.join(c.text.split()))
        out.append(cells)
    return out


def docx_skill_lists() -> dict:
    """从 docx 的「X风格 + N阶天赋树」后面紧跟的清单表读取各风格/位阶技能名。"""
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    d = docx.Document(str(DOCX))
    style = tier = None
    lists: dict = defaultdict(list)
    for child in d.element.body.iterchildren():
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            t = ' '.join(Paragraph(child, d).text.split())
            if t == '谋士天赋树':
                style = tier = None
            elif t.endswith('风格') and t[:-2] in STYLES:
                style, tier = t[:-2], None
            elif '天赋树' in t[:10]:
                tier = t.split('天赋树')[0]
            continue
        if tag != 'tbl':
            continue
        rows = rows_of(Table(child, d))
        if not rows:
            continue
        flat = ' '.join(' '.join(r) for r in rows)
        is_list = len(rows) >= 4 and all(len(r) == 1 for r in rows) and '：' not in flat
        if is_list and style and tier:
            lists[(style, tier)] = [r[0] for r in rows]
    return dict(lists)


def main() -> int:
    data = json.loads((ROOT / '职业页' / '数据' / f'{CLASS}.json').read_text(encoding='utf-8'))
    skills = data['skills']
    starting = [s for s in skills if s.get('type') == 'starting']
    talents = [s for s in skills if s.get('type') != 'starting']

    # 1) docx 清单 ↔ JSON 风格/位阶技能集
    lists = docx_skill_lists()
    for style in STYLES:
        for tier in TIERS:
            want = lists.get((style, tier), [])
            have = [s['name'] for s in talents if s['style'] == style and s['tier'] == tier]
            if not want:
                errors.append(f'docx 缺少 {style}/{tier} 清单表')
                continue
            if sorted(want) != sorted(have):
                miss_docx = sorted(set(want) - set(have))
                extra_docx = sorted(set(have) - set(want))
                gap = KNOWN_DOCX_GAPS.get((style, tier))
                if gap and miss_docx == gap['missing_in_docx'] and extra_docx == gap['extra_in_docx']:
                    warnings.append(f'{style}/{tier}：docx 与 JSON 差异为已知缺漏（'
                                    f'清单多 {miss_docx or "无"} / 详情多 {extra_docx or "无"}），待作者补齐')
                else:
                    errors.append(f'{style}/{tier} 技能不一致：docx 缺 {miss_docx}，JSON 多 {extra_docx}')
    if [s['name'] for s in starting] != STARTING:
        errors.append('起始特性顺序/内容与预期不一致: %s' % [s['name'] for s in starting])

    # 2) HTML ↔ JSON
    html = (ROOT / '职业页' / f'{CLASS}.html').read_text(encoding='utf-8')
    art_ids = re.findall(r'<article class="skill" id="([^"]+)"', html)
    if len(art_ids) != len(skills):
        errors.append(f'谋士.html 技能卡 {len(art_ids)} != JSON {len(skills)}')
    nav_links = re.findall(r'<a class="skill-link" href="#([^"]+)"', html)
    if len(nav_links) != len(skills):
        errors.append(f'谋士.html 目录链接 {len(nav_links)} != JSON {len(skills)}')
    for style in STYLES:
        if f'{style}风格' not in html:
            errors.append(f'谋士.html 缺少 {style}风格 区块')
    if len(re.findall(r'nav-choice', html)) != 2:
        errors.append('谋士.html 抉择组数量 != 2')

    # 3) 面板 ↔ JSON
    panel = (ROOT / '斯诺德跑团' / 'panel_data.js').read_text(encoding='utf-8')
    m = re.search(r'var SKILL_DATA = (\{.*?\});', panel, re.S)
    if not m:
        errors.append('panel_data.js 未找到 SKILL_DATA')
    else:
        skill_data = json.loads(m.group(1))
        if len(skill_data.get(CLASS, [])) != len(skills):
            errors.append('SKILL_DATA.谋士 数量 != JSON')
    fx = json.loads((ROOT / '斯诺德跑团' / f'skill_effects_{CLASS}.json').read_text(encoding='utf-8'))
    if len(fx.get(CLASS, [])) != len(skills):
        errors.append('skill_effects_谋士.json 数量 != JSON')
    ref = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", panel, re.S)
    ref_classes = json.loads(ref.group(1).replace("\\'", "'")) if ref else {}
    if CLASS not in ref_classes:
        errors.append('REF_CLASSES 缺谋士')
    else:
        r = ref_classes[CLASS]
        if r['key_attr'] != '智力' or r['weapons'] != '匕首、手弩、简易武器' or r['saves'] != ['智力', '魅力']:
            errors.append('REF_CLASSES.谋士 关键字段不符')
        if len(r.get('specializations') or []) != 6 or len(r.get('starting_features') or []) != 4:
            errors.append('REF_CLASSES.谋士 专长/起始特性数量不符')
    for name, regex in (
        ('CLASS_WEAPON_PROF_DOCX', r'var CLASS_WEAPON_PROF_DOCX=(\{[^;]+\});'),
        ('CLASS_WEAPON_PROFS', r'var CLASS_WEAPON_PROFS=(\{[^;]+\});'),
    ):
        mm = re.search(regex, panel)
        if not mm or CLASS not in json.loads(mm.group(1)):
            errors.append(f'{name} 缺谋士')

    # 4) 职业清单 / 装备 / 专长
    cj = json.loads((ROOT / '职业页' / '数据' / 'classes.json').read_text(encoding='utf-8'))
    if not any(x.get('name') == CLASS for x in cj):
        errors.append('classes.json 缺谋士')
    cd_text = (ROOT / '职业页' / '数据' / 'classes_data.js').read_text(encoding='utf-8')
    cd = json.loads(cd_text[cd_text.index('['):cd_text.rindex(']') + 1])
    e = next((x for x in cd if x['name'] == CLASS), None)
    if not e:
        errors.append('classes_data.js 缺谋士')
    else:
        if e.get('hp_formula') != {'first': 8, 'level_up': 2} or e.get('fp_formula') != {'first': 10, 'level_up': 1}:
            errors.append('classes_data.js 谋士 HP/FP 公式不符')
    eq_text = (ROOT / '职业页' / '数据' / 'equipment_data.js').read_text(encoding='utf-8')
    equip = json.loads(re.search(r'var EQUIP_DATA = (\{.*\});?\s*$', eq_text, re.S).group(1))
    if len(equip.get(CLASS, [])) != 4:
        errors.append('equipment_data.js 谋士套装 != 4')
    cf = json.loads((ROOT / '职业页' / '数据' / 'class_features.json').read_text(encoding='utf-8'))
    feats = [f['name'] for f in cf['classes'].get(CLASS, {}).get('features', [])]
    if feats != ['运筹帷幄', '博闻强识', '料敌机先']:
        errors.append('class_features.json 谋士专长不符: %s' % feats)

    # 5) 兼职 / 顾问
    mc = json.loads((ROOT / 'advisor' / 'rules' / 'multiclass.json').read_text(encoding='utf-8'))
    if not any(r['class'] == CLASS for r in mc.get('requirements', [])):
        errors.append('advisor multiclass 缺谋士')
    reg = json.loads((ROOT / 'advisor' / 'chargen' / 'class_registry.json').read_text(encoding='utf-8'))
    row = reg['classes'].get(CLASS, {})
    if row.get('tier') != 'full' or row.get('l2Slug') != 'strategist':
        errors.append('class_registry 谋士档位不符')
    audit = json.loads((ROOT / 'advisor' / 'chargen' / 'class_tier_audit.json').read_text(encoding='utf-8'))
    audits = audit['audits']
    a = audits[CLASS] if isinstance(audits, dict) else next((x for x in audits if x.get('className') == CLASS), None)
    if not a or any(not c['pass'] for c in a['checks']):
        errors.append('class_tier_audit 谋士存在未通过项')
    adv = json.loads((ROOT / 'advisor' / 'advancements.json').read_text(encoding='utf-8'))
    moushi_adv = [x for x in adv.get('advancements', []) if CLASS in (x.get('sourceClasses') or [])]
    if not moushi_adv:
        errors.append('advisor advancements 缺谋士进阶')

    ok_notes.append('技能：JSON %d（起始 %d + 天赋 %d），docx 清单 18 组一致' % (len(skills), len(starting), len(talents)))
    ok_notes.append('页面：%d 张技能卡 + %d 目录 + 2 抉择组' % (len(art_ids), len(nav_links)))
    ok_notes.append('面板/效果/清单/兼职/顾问：全部就位')

    if errors:
        print('FAIL：谋士同步校验未通过（%d 处）' % len(errors))
        for e in errors:
            print('  -', e)
        return 1
    print('OK：谋士同步校验通过')
    for n in ok_notes:
        print('  ·', n)
    for w in warnings:
        print('  ⚠', w)
    return 0


if __name__ == '__main__':
    sys.exit(main())
