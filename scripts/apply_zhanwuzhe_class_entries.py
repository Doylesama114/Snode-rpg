#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把战舞者写入职业页各职业清单数据（classes.json / classes_data.js / equipment_data.js /
future_classes_data.json / class_features.json / 首页.html 卡片）。

数值与文案来自 基础职业-战舞者.docx（HP 8+体质、+2+体质；FP 8+关键属性、+1；关键属性=敏捷或魅力）。
装备 4 组读取 M1 产物 scripts/extracts/战舞者_equipment.json。
用法：
  python scripts/apply_zhanwuzhe_class_entries.py --check
  python scripts/apply_zhanwuzhe_class_entries.py --write
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from class_sync_core import extract_paragraphs  # noqa: E402

PAGE = ROOT / '职业页' / '数据'
NL = chr(10)
CLASS = '战舞者'
EMOJI = '💃'
DOCX = ROOT / f'基础职业-{CLASS}.docx'
EQUIP_SRC = ROOT / 'scripts' / 'extracts' / f'{CLASS}_equipment.json'

KEY_ATTR = '敏捷或魅力'
WEAPONS = '匕首、环刃、刺剑、拳刃、简易武器'
SAVES = ['敏捷', '魅力']
SKILLS = ['体操', '隐匿', '巧手', '洞悉', '察觉', '欺瞒', '说服', '激励']
SPECS = ['舞步流畅', '节奏连击', '优雅身姿']
FEATURES = ['回旋斩', '魅惑之舞', '激励旋步', '闪避舞步']

HP = {'first': 8, 'level_up': 2}
FP = {'first': 8, 'level_up': 1}


def docx_paras() -> list[str]:
    out = []
    for p in extract_paragraphs(DOCX):
        out.append(p.get('text', '') if isinstance(p, dict) else str(p))
    return out


def class_description() -> str:
    for t in docx_paras():
        s = t.strip()
        if len(s) > 60 and not s.startswith(('职责定位', '---')):
            return s
    return ''


def equip_sets() -> list[dict]:
    data = json.loads(EQUIP_SRC.read_text(encoding='utf-8'))
    return [{'letter': s['key'], 'text': s['text']} for s in data.get('sets', [])]


def load_js_const(path: Path, name: str):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'var\s+%s\s*=\s*(\[.*?\]);' % re.escape(name), text, re.S)
    if not m:
        raise SystemExit('未找到 %s in %s' % (name, path))
    return json.loads(m.group(1))


def build_entry() -> dict:
    return {
        'name': CLASS,
        'description': class_description(),
        '职责定位': '战技输出、控制局势、团队增益',
        '关键属性': KEY_ATTR,
        '护甲': '轻甲',
        '武器': WEAPONS,
        '豁免': '、'.join(SAVES),
        '技巧': '从体操、隐匿、巧手、洞悉、察觉、欺瞒、说服、激励中选择四项熟练度各+1',
    }


def build_feature_entry() -> dict:
    """职业专长（与 M1 页面同一来源口径）"""
    paras = docx_paras()
    intro = '战舞者的关键属性为敏捷或魅力，你必须在创建角色时选择其中一项作为你的关键属性，作为一名战舞者，你获得以下职业专长。'
    features: list[dict] = []
    try:
        i0 = next(i for i, t in enumerate(paras) if t.strip().endswith('专精'))
    except StopIteration:
        i0 = -1
    if i0 >= 0:
        cur = None
        i = i0 + 1
        while i < len(paras):
            line = paras[i].strip()
            i += 1
            if not line or line.startswith('---') or line == '初始专长':
                continue
            if line.startswith('战斗风格'):
                break
            is_name = (len(line) <= 10 and '：' not in line and '。' not in line
                       and not line.startswith(('·', '你', '每', '此', '该', '若', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6')))
            if is_name and (cur is None or cur['body']):
                cur = {'name': line, 'body': []}
                features.append(cur)
            elif cur is not None:
                cur['body'].append(line)
    style_line = next((t.strip() for t in paras if t.strip().startswith('战斗风格')), '')
    styles = [s for s in ['刃舞', '迷情', '谐合', '机敏', '激昂'] if any(t.strip() == s for t in paras)]
    if style_line:
        features.append({'name': '战斗风格', 'body': [style_line] + ['可用战斗风格：' + '、'.join(styles)]})
    return {
        'intro': intro,
        'features': [{'name': f['name'], 'body': [{'type': 'p', 'text': b} for b in f['body']]} for f in features],
    }


def sync_mirror(paths: list[Path]) -> int:
    n = 0
    for p in paths:
        rel = p.relative_to(ROOT)
        dst = ROOT / 'electron-app' / rel
        if dst.exists() or dst.parent.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dst)
            n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    classes_json = PAGE / 'classes.json'
    classes_data = PAGE / 'classes_data.js'
    equip_js = PAGE / 'equipment_data.js'
    future = PAGE / 'future_classes_data.json'
    features_json = PAGE / 'class_features.json'

    cj = json.loads(classes_json.read_text(encoding='utf-8'))
    has_cj = any(x.get('name') == CLASS for x in cj)
    cd = load_js_const(classes_data, 'CLASSES')
    has_cd = any(x.get('name') == CLASS for x in cd)
    eq_text = equip_js.read_text(encoding='utf-8')
    has_eq = ('"%s"' % CLASS) in eq_text
    fj = json.loads(future.read_text(encoding='utf-8'))
    wd = next((c for c in fj.get('classes', []) if c.get('id') == CLASS), None)
    has_future = bool(wd) and wd.get('status') == 'released' and wd.get('playable') is True
    cf = json.loads(features_json.read_text(encoding='utf-8'))
    has_cf = CLASS in (cf.get('classes') or {})
    home = ROOT / '职业页' / '首页.html'
    home_text = home.read_text(encoding='utf-8')
    has_home = f'href="{CLASS}.html"' in home_text

    reports = [
        'classes.json: %s' % ('已写入' if has_cj else '缺失'),
        'classes_data.js: %s' % ('已写入' if has_cd else '缺失'),
        'equipment_data.js: %s' % ('已写入' if has_eq else '缺失'),
        'future_classes_data.json: %s' % ('已更新' if has_future else '未更新'),
        'class_features.json: %s' % ('已写入' if has_cf else '缺失'),
        '首页卡片: %s' % ('已写入' if has_home else '缺失'),
    ]
    print(NL.join(reports))

    if args.check:
        ok = has_cj and has_cd and has_eq and has_future and has_cf and has_home
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    entry = build_entry()
    touched: list[Path] = []

    if not has_cj:
        cj.append(dict(entry))
        classes_json.write_text(json.dumps(cj, ensure_ascii=False, indent=2) + NL, encoding='utf-8')
        touched.append(classes_json)
    if not has_cd:
        cd.append(dict(entry, hp_formula=dict(HP), fp_formula=dict(FP)))
        text = classes_data.read_text(encoding='utf-8')
        text = re.sub(r'var\s+CLASSES\s*=\s*\[.*?\];',
                      lambda m: 'var CLASSES = ' + json.dumps(cd, ensure_ascii=False, indent=2) + ';',
                      text, count=1, flags=re.S)
        classes_data.write_text(text, encoding='utf-8')
        touched.append(classes_data)
    if not has_eq:
        text = equip_js.read_text(encoding='utf-8')
        m = re.search(r'var\s+EQUIP_DATA\s*=\s*(\{[\s\S]*\});?\s*$', text)
        if not m:
            raise SystemExit('equipment_data.js 格式与预期不符')
        equip = json.loads(m.group(1))
        equip[CLASS] = equip_sets()
        equip_js.write_text('var EQUIP_DATA = ' + json.dumps(equip, ensure_ascii=False) + ';' + NL, encoding='utf-8')
        touched.append(equip_js)
    if wd is None:
        fj.setdefault('classes', []).append({
            'id': CLASS, 'name': CLASS, 'status': 'released', 'playable': True,
            'key_attr': KEY_ATTR, 'armor': '轻甲', 'weapons': WEAPONS,
            'saves': SAVES, 'skills': SKILLS, 'specializations': SPECS, 'starting_features': FEATURES,
        })
    else:
        wd.update({'status': 'released', 'playable': True, 'key_attr': KEY_ATTR, 'armor': '轻甲',
                   'weapons': WEAPONS, 'saves': SAVES, 'skills': SKILLS,
                   'specializations': SPECS, 'starting_features': FEATURES})
    future.write_text(json.dumps(fj, ensure_ascii=False, indent=2) + NL, encoding='utf-8')
    touched.append(future)

    if not has_cf:
        cf.setdefault('classes', {})[CLASS] = build_feature_entry()
        features_json.write_text(json.dumps(cf, ensure_ascii=False, indent=2) + NL, encoding='utf-8')
        touched.append(features_json)

    if not has_home:
        m = re.search(r'(\s*)<a class="home-btn" href="召唤师\.html">[\s\S]{0,120}?</a>', home_text)
        if not m:
            raise SystemExit('首页.html 未找到召唤师卡片锚点')
        card = m.group(0)
        indent = m.group(1)
        new_card = card.replace('召唤师.html', f'{CLASS}.html').replace('🌀', EMOJI).replace('召唤师', CLASS)
        home_text = home_text[:m.end()] + indent + new_card.lstrip() + home_text[m.end():]
        home.write_text(home_text, encoding='utf-8')
        touched.append(home)

    n = sync_mirror(touched)
    print('✅ 战舞者职业清单数据已写入（同步镜像 %d 个文件）' % n)
    return 0


if __name__ == '__main__':
    sys.exit(main())
