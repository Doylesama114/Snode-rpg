#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把战舞者接入角色面板（照召唤师 M7 先例）。

补丁：
  1) panel_data.js：REF_CLASSES 条目 + CLASS_WEAPON_PROF_DOCX + CLASS_WEAPON_PROFS
  2) panel_engine.js：STYLE_COLOR_MAP（5 风格 + 起始战斗）+ STARTING_STYLE_OVERRIDE
  3) 由 build_panel_skill_data.py 重建 SKILL_DATA（CLASS_MAP 已加入战舞者）
用法：
  python scripts/apply_zhanwuzhe_panel_entries.py --check
  python scripts/apply_zhanwuzhe_panel_entries.py --write
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
PANEL_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_data.js'
ENGINE = ROOT / '斯诺德跑团' / 'panel_engine.js'
ENGINE_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_engine.js'
EXTRACT = ROOT / 'scripts' / 'extracts' / '战舞者.json'

CLASS = '战舞者'
WEAPON_DOCX = '匕首、环刃、刺剑、拳刃、简易武器'
WEAPON_CATS = ['匕首', '剑类', '拳刃', '简易']
STYLE_COLORS = {'刃舞': 'FFC9A3', '迷情': 'F7B6D2', '谐合': 'A8E6CF', '机敏': 'A9C8FF', '激昂': 'FFD8A8', '战斗': 'E4D9FF'}
FEATURES = [
    {'name': '舞步流畅', 'desc': '每场战斗限一次，在你进行一次位移时，本次移动不会触发借机攻击'},
    {'name': '节奏连击', 'desc': '基础攻击命中后获得连击点（上限 5）；累计施展四个带节奏关键词的效果或消耗 5 点后掷节拍骰并结算其效果'},
    {'name': '优雅身姿', 'desc': '你的仪态使你成为众人焦点，与你社交互动的 NPC 起始态度至少为冷淡（除非对方有充分理由敌视你）'},
]
STARTING_ORDER = ['回旋斩', '魅惑之舞', '闪避舞步', '激励旋步']


def starting_entries() -> list[dict]:
    raw = json.loads(EXTRACT.read_text(encoding='utf-8'))
    by = {s['name']: s for s in raw['skills']}
    out = []
    for n in STARTING_ORDER:
        s = by.get(n) or {}
        desc = (s.get('fields') or {}).get('描述') or '战舞者起始特性'
        out.append({'name': n, 'desc': desc})
    return out


def build_entry() -> dict:
    return {
        'id': CLASS, 'name': CLASS,
        'key_attr': '敏捷或魅力', 'armor': '轻甲', 'weapons': WEAPON_DOCX,
        'saves': ['敏捷', '魅力'],
        'skills': '从体操、隐匿、巧手、洞悉、察觉、欺瞒、说服、激励中选择四项熟练度各+1',
        'specializations': FEATURES,
        'starting_features': starting_entries(),
        'starting_choice': 2,
        'hp_formula': {'first': 8, 'level_up': 2},
        'fp_formula': {'first': 8, 'level_up': 1},
    }


def js_const(path: Path, name: str):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'var\s+%s\s*=\s*(\{.*?\});' % re.escape(name), text, re.S)
    if not m:
        raise SystemExit('未找到 %s' % name)
    return json.loads(m.group(1)), m


def patch_ref(text: str) -> str:
    m = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", text, re.S)
    if not m:
        raise SystemExit('未找到 REF_CLASSES')
    ref = json.loads(m.group(1).replace("\\'", "'"))
    if CLASS in ref and ref[CLASS].get('key_attr') == '敏捷或魅力':
        return text
    ref[CLASS] = build_entry()
    body = json.dumps(ref, ensure_ascii=False).replace("'", "\\'")
    return re.sub(r"const REF_CLASSES = JSON\.parse\('.*?'\);",
                  lambda mm: "const REF_CLASSES = JSON.parse('%s');" % body, text, count=1, flags=re.S)


def patch_engine(text: str, styles: dict) -> str:
    if '"战舞者": {"刃舞"' not in text:
        m = re.search(r'"(谋士|召唤师)": \{[^}]*\},?\n', text)
        assert m, '未找到 STYLE_COLOR_MAP 锚点'
        line = m.group(0).rstrip().rstrip(',')
        new = '  "战舞者": {%s},' % ','.join('"%s":"%s"' % (k, v) for k, v in styles.items())
        text = text[:m.end()] + new + chr(10) + text[m.end():]
    if '"战舞者": {"回旋斩"' not in text:
        m2 = re.search(r'"(谋士|召唤师)": \{[^}]*\}\n', text)
        assert m2, '未找到 STARTING_STYLE_OVERRIDE 锚点'
        line = m2.group(0).rstrip().rstrip(',')
        items = ','.join('"%s":"%s"' % (k, v) for k, v in STARTING_STYLE.items())
        text = text[:m2.end()] + ',\n  "战舞者": {%s}' % items + text[m2.end():]
    return text


STARTING_STYLE = {'回旋斩': '战斗', '魅惑之舞': '迷情', '闪避舞步': '机敏', '激励旋步': '谐合'}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    panel = PANEL.read_text(encoding='utf-8')
    engine = ENGINE.read_text(encoding='utf-8')
    _rm = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", panel, re.S)
    ref = json.loads(_rm.group(1).replace("\\'", "'")) if _rm else {}
    prof_docx, _ = js_const(PANEL, 'CLASS_WEAPON_PROF_DOCX')
    prof_cat, _ = js_const(PANEL, 'CLASS_WEAPON_PROFS')
    skill_data_has = ('"%s": [' % CLASS) in panel or ("'%s': [" % CLASS) in panel

    checks = {
        'REF_CLASSES.战舞者': CLASS in ref,
        '武器 docx 映射': CLASS in prof_docx,
        '武器类别映射': CLASS in prof_cat,
        '风格配色': '"战舞者": {"刃舞"' in engine,
        '起始特性映射': '"战舞者": {"回旋斩"' in engine,
        'SKILL_DATA': skill_data_has,
    }
    for k, v in checks.items():
        print('%-18s %s' % (k, 'OK' if v else '缺失'))
    if args.check:
        ok = all(checks.values())
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    new_panel = patch_ref(panel)
    if CLASS not in prof_docx:
        prof_docx[CLASS] = WEAPON_DOCX
        new_panel = re.sub(r'var CLASS_WEAPON_PROF_DOCX=\{[^;]+\};',
                           lambda m: 'var CLASS_WEAPON_PROF_DOCX=%s;' % json.dumps(prof_docx, ensure_ascii=False),
                           new_panel, count=1)
    if CLASS not in prof_cat:
        prof_cat[CLASS] = WEAPON_CATS
        new_panel = re.sub(r'var CLASS_WEAPON_PROFS=\{[^;]+\};',
                           lambda m: 'var CLASS_WEAPON_PROFS=%s;' % json.dumps(prof_cat, ensure_ascii=False),
                           new_panel, count=1)
    PANEL.write_text(new_panel, encoding='utf-8', newline='')
    if PANEL_MIRROR.exists():
        shutil.copyfile(PANEL, PANEL_MIRROR)

    new_engine = patch_engine(engine, STYLE_COLORS)
    ENGINE.write_text(new_engine, encoding='utf-8', newline='')
    if ENGINE_MIRROR.exists():
        shutil.copyfile(ENGINE, ENGINE_MIRROR)

    # 重建 SKILL_DATA
    r = subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts' / 'build_panel_skill_data.py')],
                       capture_output=True, text=True, encoding='utf-8')
    tail = (r.stdout or '').strip().splitlines()[-4:]
    print('build_panel_skill_data: ' + (' / '.join(tail) if tail else 'exit=%s' % r.returncode))
    if r.returncode != 0:
        print((r.stderr or '')[-400:])
        return 1
    print('✅ 战舞者面板接入完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
