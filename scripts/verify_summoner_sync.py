#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""召唤师同步校验：docx ↔ 技能 JSON/HTML/skill_effects ↔ 契约生物 ↔ 职业清单 ↔ 面板 ↔ 进阶占位页。

用法: python scripts/verify_summoner_sync.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / '基础职业-召唤师.docx'
CLASS = '召唤师'
STYLES = ['咒法', '降灵']
TIER_EXPECT = {('咒法', '一阶'): 7, ('咒法', '二阶'): 7, ('咒法', '三阶'): 7,
               ('降灵', '一阶'): 6, ('降灵', '二阶'): 8, ('降灵', '三阶'): 9}
STARTING = ['魔法飞弹', '次级召唤术', '唤回']
FEATURES = ['召唤联结', '异界感知', '机缘召唤']
REUSED = {'蓝焰术': '法师'}
CHOICE_GROUPS = [
    '抉择：创造水源/创造篝火',
    '抉择：灵猫守护/灵枭守护/灵狐守护',
    '抉择：召唤风元素/召唤火元素/召唤水元素/召唤土元素',
]
errors: list[str] = []
ok_notes: list[str] = []


def main() -> int:
    data = json.loads((ROOT / '职业页' / '数据' / f'{CLASS}.json').read_text(encoding='utf-8'))
    skills = data['skills']
    starting = [s for s in skills if s.get('type') == 'starting']
    talents = [s for s in skills if s.get('type') != 'starting']

    # 1) 数量与风格/位阶分布
    if len(skills) != 47:
        errors.append(f'技能总数 {len(skills)} != 47')
    if [s['name'] for s in starting] != STARTING:
        errors.append('起始特性不符: %s' % [s['name'] for s in starting])
    got = Counter((s['style'], s['tier']) for s in talents)
    for k, n in TIER_EXPECT.items():
        if got.get(k, 0) != n:
            errors.append(f'{k[0]}/{k[1]} 技能数 {got.get(k, 0)} != {n}')

    # 2) 已知缺漏登记：蓝焰术（复用）+ 契约指令·回避（清单笔误）
    lf = next((s for s in talents if s['name'] == '蓝焰术'), None)
    if not lf:
        errors.append('缺少 蓝焰术（应从法师版复用）')
    else:
        if lf.get('style') != '咒法' or lf.get('tier') != '二阶':
            errors.append('蓝焰术 风格/位阶不符')
        if not any(CLASS in (u.get('class') or '') for u in (lf.get('level_upgrades') or [])):
            errors.append('蓝焰术 升级条目未改写为召唤师')
    if not any(s['name'] == '契约指令·回避' for s in talents):
        errors.append('缺少 契约指令·回避（清单笔误应已重命名）')
    if any(s['name'] == '召唤指令·回避' for s in talents):
        errors.append('仍存在笔误名 召唤指令·回避')
    # 双块合并技能
    for nm in ('灵猫守护', '灵枭守护', '灵狐守护'):
        sk = next((s for s in talents if s['name'] == nm), None)
        if not sk or sk.get('merged_parts') != 2:
            errors.append(f'{nm} 未合并双块（异能+天赋）')

    # 2.5) D100 随机表（咒灵召唤/灵摆召唤）与图标区分
    for nm in ('咒灵召唤', '灵摆召唤'):
        sk = next((x for x in talents if x['name'] == nm), None)
        desc = (sk or {}).get('description') or []
        if not sk:
            errors.append(f'缺少 {nm}')
            continue
        if not any('D100' in d for d in desc):
            errors.append(f'{nm} 缺 D100 施法说明（描述首行丢失回归）')
        rolls = sk.get('roll_tables') or []
        if len(rolls) != 13:
            errors.append(f'{nm} roll_tables 行数 {len(rolls)} != 13')
        if not any((r.get('label') or '') == '100' for r in rolls):
            errors.append(f'{nm} roll_tables 缺 100 行')
        if not any(d.strip() == '001' for d in desc) or not any(d.strip() == '100' for d in desc):
            errors.append(f'{nm} 描述缺原始骰值行（001/100）')
    home = (ROOT / '职业页' / '首页.html').read_text(encoding='utf-8')
    mage_icon = re.search(r'href="法师.html"><span class="btn-icon">([^<]*)</span>', home)
    sm_icon = re.search(r'href="召唤师.html"><span class="btn-icon">([^<]*)</span>', home)
    if not mage_icon or not sm_icon:
        errors.append('首页缺少法师/召唤师入口图标')
    elif mage_icon.group(1) == sm_icon.group(1):
        errors.append('召唤师图标与法师重复: %s' % sm_icon.group(1))

    # 3) HTML：卡片数 / 专长 / 契约生物 chip
    html = (ROOT / '职业页' / f'{CLASS}.html').read_text(encoding='utf-8')
    cards = re.findall(r'<article class="skill" id="([^"]+)"', html)
    if len(cards) != 47:
        errors.append(f'{CLASS}.html 技能卡 {len(cards)} != 47')
    chips = re.findall(r'class="class-feature-chip[^"]*"[^>]*data-feature-index="(\d+)"', html)
    contract_chips = re.findall(r'data-feature-index="(\d+)">\s*([^<]*系)·', html)
    if len(chips) != 23:
        errors.append(f'页面 chip 总数 {len(chips)} != 23（专长 3 + 契约 20）')
    if len(re.findall(r'id="sm-contract-(?!creatures)[^"]+"', html)) != 20:
        errors.append('契约生物面板数 != 20')
    if 'id="sm-contract-creatures"' not in html:
        errors.append('缺少契约生物切换区')

    # 3.5) 表格渲染：D100 随机表 + 召唤单位数据卡（此前只进 data-search 不显示）
    for nm, rows in (('咒灵召唤', 13), ('灵摆召唤', 13)):
        sk = next((x for x in talents if x['name'] == nm), None)
        seg = ''
        if sk:
            m2 = re.search(r'<article class="skill" id="%s".*?</article>' % re.escape(sk['id']), html, re.S)
            seg = m2.group(0) if m2 else ''
        if 'roll-table' not in seg or len(re.findall(r'class="roll-row"', seg)) != rows:
            errors.append(f'{nm} 页面未渲染 {rows} 行 D100 随机表')
    unit_skills = [s2 for s2 in talents if (s2.get('unit_tables') or [])]
    for sk in unit_skills:
        m3 = re.search(r'<article class="skill" id="%s".*?</article>' % re.escape(sk['id']), html, re.S)
        if not m3 or 'unit-card' not in m3.group(0):
            errors.append(f'{sk["name"]} 召唤单位数据卡未渲染')
    if len(unit_skills) != 6:
        errors.append(f'含单位数据卡的技能数 {len(unit_skills)} != 6')

    # 4) 抉择组
    groups = json.loads((ROOT / 'scripts' / 'site_choice_groups.json').read_text(encoding='utf-8'))['groups']
    ms_groups = [g for g in groups if g['page'] == CLASS]
    if len(ms_groups) != 3 or any(not g['runs'] for g in ms_groups):
        errors.append('抉择组 != 3 或 runs 为空')
    for g in ms_groups:
        if 'choice' not in (html + str(g)):
            errors.append(f'抉择组 {g["title"]} 未落到页面')
    if html.count('nav-choice') != 3:
        errors.append(f'页面 nav-choice 数 {html.count("nav-choice")} != 3')

    # 5) 契约生物数据
    contracts = json.loads((ROOT / '职业页' / '数据' / '召唤师契约生物.json').read_text(encoding='utf-8'))
    cs = contracts['creatures']
    if len(cs) != 20:
        errors.append(f'契约生物 {len(cs)} != 20')
    for c in cs:
        if len(c['attrs']) != 8 or not (c['ac'] and c['hp'] and c['cr']):
            errors.append(f'契约生物 {c["name"]} 字段不全')
        if not (c['traits'] or c['actions']):
            errors.append(f'契约生物 {c["name"]} 无特性/动作')
    js = (ROOT / '职业页' / '数据' / 'summoner_contracts_data.js').read_text(encoding='utf-8')
    if 'CONTRACT_CREATURES' not in js or js.count('"name"') < 20:
        errors.append('summoner_contracts_data.js 数据异常')

    # 6) 面板 / 技能效果 / 清单
    fx = json.loads((ROOT / '斯诺德跑团' / f'skill_effects_{CLASS}.json').read_text(encoding='utf-8'))
    if len(fx.get(CLASS, [])) != 47:
        errors.append('skill_effects 条数 != 47')
    panel = (ROOT / '斯诺德跑团' / 'panel_data.js').read_text(encoding='utf-8')
    m = re.search(r'var SKILL_DATA = (\{.*?\});', panel, re.S)
    if not m or len(json.loads(m.group(1)).get(CLASS, [])) != 47:
        errors.append('SKILL_DATA.召唤师 != 47')
    rm = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", panel, re.S)
    ref = json.loads(rm.group(1).replace("\\'", "'")) if rm else {}
    r = ref.get(CLASS, {})
    if r.get('key_attr') != '幸运' or r.get('armor') != '轻甲' or len(r.get('specializations') or []) != 3:
        errors.append('REF_CLASSES.召唤师 字段不符')
    for name, rx in (('CLASS_WEAPON_PROF_DOCX', r'var CLASS_WEAPON_PROF_DOCX=(\{[^;]+\});'),
                     ('CLASS_WEAPON_PROFS', r'var CLASS_WEAPON_PROFS=(\{[^;]+\});')):
        mm = re.search(rx, panel)
        if not mm or CLASS not in json.loads(mm.group(1)):
            errors.append(f'{name} 缺召唤师')
    cd = (ROOT / '职业页' / '数据' / 'classes_data.js').read_text(encoding='utf-8')
    arr = json.loads(cd[cd.index('['):cd.rindex(']') + 1])
    e = next((x for x in arr if x['name'] == CLASS), None)
    if not e or e.get('hp_formula') != {'first': 8, 'level_up': 2} or e.get('fp_formula') != {'first': 8, 'level_up': 1}:
        errors.append('classes_data.js 召唤师 公式不符')
    eq = json.loads(re.search(r'var EQUIP_DATA = (\{.*\});?\s*$', (ROOT / '职业页' / '数据' / 'equipment_data.js').read_text(encoding='utf-8'), re.S).group(1))
    if len(eq.get(CLASS, [])) != 4:
        errors.append('equipment_data.js 召唤师套装 != 4')
    cf = json.loads((ROOT / '职业页' / '数据' / 'class_features.json').read_text(encoding='utf-8'))
    if [f['name'] for f in cf['classes'][CLASS]['features']] != FEATURES:
        errors.append('class_features.json 召唤师专长不符')

    # 7) 创建页接线
    chg = (ROOT / '斯诺德跑团' / '角色创建页.html').read_text(encoding='utf-8')
    for need, label in (
        ("'召唤师':{key_attr:'幸运'", 'CLS_OVERRIDE'),
        ('"召唤师":[{n:"召唤联结"', 'CLASS_SPECIALIZATIONS'),
        ('"召唤师":[{n:"魔法飞弹"', 'CLASS_STARTING_FEATURES'),
        ('CHAR.className==="术士"||CHAR.className==="召唤师"', '起始特性全给'),
        ('function showSummonerContractChoice', '契约生物选择'),
        ('clsName==="召唤师"&&!CHAR.contractCreature', '未选门禁'),
    ):
        if need not in chg:
            errors.append(f'创建页缺少 {label}')
    if 'summoner_contracts_data.js' not in chg:
        errors.append('创建页未引入契约生物数据')

    # 8) 进阶占位页 + 搜索索引
    adv = ROOT / '职业页' / f'{CLASS}·进阶.html'
    if not adv.exists():
        errors.append('缺少召唤师·进阶.html')
    else:
        t = adv.read_text(encoding='utf-8')
        if 'adv-notice' in t:
            errors.append('进阶页仍残留等待更新提示（作者已补召唤师章节）')
        if len(re.findall(r'class="adv-card"', t)) != 35:
            errors.append('进阶页卡片 != 35（25 来源含召唤师 + 通用 10）')
    ms_adv = json.loads((ROOT / '职业页' / '数据' / f'{CLASS}·进阶.json').read_text(encoding='utf-8'))['advancements']
    if len(ms_adv) != 35 or sum(1 for a in ms_adv if CLASS in (a.get('source_classes') or [])) != 25:
        errors.append('召唤师·进阶.json 条数/来源不符')
    cap = (ROOT / '斯诺德跑团' / 'chargen_adv_paths.js').read_text(encoding='utf-8')
    cm = re.search(r'window\.CHARGEN_ADV_PATHS\s*=\s*(\{.*\});', cap, re.S)
    if not cm or len(json.loads(cm.group(1)).get(CLASS, [])) != 35:
        errors.append('chargen_adv_paths 召唤师候选 != 35')
    idx = (ROOT / '职业页' / 'search-index.json').read_text(encoding='utf-8')
    if '"召唤师"' not in idx:
        errors.append('搜索索引缺召唤师')

    ok_notes.append(f'技能 {len(skills)}（起始 3 + 天赋 44：咒法 7/7/7、降灵 6/8/9），蓝焰术复用法师版，'
                    f'契约指令·回避已改名，灵猫/灵枭/灵狐守护双块已合并')
    ok_notes.append(f'契约生物 20 个（8 属性 + 特性/动作齐全）；页面 47 卡 + 23 chip（3 专长 + 20 契约）')
    ok_notes.append('创建页（第 1 步选契约生物 + 起始特性全给 + FP=幸运）/ 面板（REF_CLASSES + 契约卡）/')
    ok_notes.append('进阶页：召唤师章节 25 条 + 通用 10 条（共 35，无等待提示）；首页 + 搜索索引 + 清单数据 全部就位')

    if errors:
        print('FAIL：召唤师同步校验未通过（%d 处）' % len(errors))
        for e in errors:
            print('  -', e)
        return 1
    print('OK：召唤师同步校验通过')
    for n in ok_notes:
        print('  ·', n)
    return 0


if __name__ == '__main__':
    sys.exit(main())
