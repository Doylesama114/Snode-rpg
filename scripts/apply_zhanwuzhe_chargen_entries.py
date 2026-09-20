#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把战舞者接入角色创建页 / 上传角色（照召唤师 M6 先例）。

补丁：
  1) CLS_OVERRIDE：key_attr 敏捷或魅力 / hp 8 / fp 8 / saves 敏捷、魅力
  2) CLASS_SPECIALIZATIONS：3 条职业专长（舞步流畅 / 节奏连击 / 优雅身姿）
  3) CLASS_STARTING_FEATURES：4 条起始特性（回旋斩 / 魅惑之舞 / 闪避舞步 / 激励旋步，选 2）
用法：
  python scripts/apply_zhanwuzhe_chargen_entries.py --check
  python scripts/apply_zhanwuzhe_chargen_entries.py --write
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
CHARGEN = ROOT / '斯诺德跑团' / '角色创建页.html'
UPLOAD = ROOT / '斯诺德跑团' / '上传角色.html'
EXTRACT = ROOT / 'scripts' / 'extracts' / '战舞者.json'
NL = chr(10)
CLASS = '战舞者'

OVERRIDE_LINE = "      '战舞者':{key_attr:'敏捷或魅力', hp:8, fp:8, saves:'敏捷、魅力'}" + NL

SPECS = [
    {'n': '舞步流畅', 'd': '每场战斗限一次，在你进行一次位移时，本次移动不会触发借机攻击'},
    {'n': '节奏连击', 'd': '基础攻击命中后获得连击点（上限 5）；累计施展四个带节奏关键词的效果或消耗 5 点后掷节拍骰并结算其效果'},
    {'n': '优雅身姿', 'd': '你的仪态使你成为众人焦点，与你社交互动的 NPC 起始态度至少为冷淡（除非对方有充分理由敌视你）'},
]

START_ORDER = ['回旋斩', '魅惑之舞', '闪避舞步', '激励旋步']


def start_features() -> list[dict]:
    raw = json.loads(EXTRACT.read_text(encoding='utf-8'))
    by_name = {s['name']: s for s in raw['skills']}
    out = []
    for name in START_ORDER:
        s = by_name.get(name)
        desc = ''
        if s:
            desc = (s.get('fields') or {}).get('描述') or ''
            if not desc and s.get('description'):
                desc = s['description'][0]
        out.append({'n': name, 'd': desc or '战舞者起始特性'})
    return out


def js_array(items: list[dict]) -> str:
    body = ','.join('{n:"%s",d:"%s"}' % (i['n'], i['d'].replace('"', r'\"')) for i in items)
    return '["__K__":' % 0 if False else body


def insert_after(text: str, anchor_pat: str, new_line: str) -> tuple[str, bool]:
    m = re.search(anchor_pat, text, re.M)
    if not m:
        return text, False
    line = m.group(0).rstrip()
    if not line.endswith(','):
        line += ','
    return text[:m.start()] + line + NL + new_line + text[m.end():], True


def patch_chargen(text: str) -> tuple[str, list[str]]:
    notes = []
    # 1) CLS_OVERRIDE
    if "'战舞者':{key_attr" not in text:
        text, ok = insert_after(text, r"^      '召唤师':\{key_attr:'幸运', hp:8, fp:8, saves:'感知、幸运'\}", OVERRIDE_LINE)
        notes.append('CLS_OVERRIDE ' + ('OK' if ok else 'FAIL'))
    else:
        notes.append('CLS_OVERRIDE 已存在')

    # 2) CLASS_SPECIALIZATIONS
    if '"战舞者":[{n:"舞步流畅"' not in text:
        specs_line = '  "%s":[%s],' % (CLASS, js_array(SPECS))
        text, ok = insert_after(text, r'^  "召唤师":\[\{n:"召唤联结".*?\}\],?$', specs_line)
        notes.append('SPECS ' + ('OK' if ok else 'FAIL'))
    else:
        notes.append('SPECS 已存在')

    # 3) CLASS_STARTING_FEATURES
    if '"战舞者":[{n:"回旋斩"' not in text:
        start_line = '  "%s":[%s],' % (CLASS, js_array(start_features()))
        text, ok = insert_after(text, r'^  "召唤师":\[\{n:"魔法飞弹".*?\}\],?$', start_line)
        notes.append('START ' + ('OK' if ok else 'FAIL'))
    else:
        notes.append('START 已存在')
    return text, notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    text = CHARGEN.read_text(encoding='utf-8')
    has_override = "'战舞者':{key_attr" in text
    has_specs = '"战舞者":[{n:"舞步流畅"' in text
    has_start = '"战舞者":[{n:"回旋斩"' in text
    reports = [
        'CLS_OVERRIDE: %s' % ('已写入' if has_override else '缺失'),
        'CLASS_SPECIALIZATIONS: %s' % ('已写入' if has_specs else '缺失'),
        'CLASS_STARTING_FEATURES: %s' % ('已写入' if has_start else '缺失'),
    ]
    print(NL.join(reports))
    if args.check:
        ok = has_override and has_specs and has_start
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    text, notes = patch_chargen(text)
    for n in notes:
        if 'FAIL' in n:
            print('❌ ' + n)
            return 1
    CHARGEN.write_text(text, encoding='utf-8')
    # 镜像
    for src, dst in ((CHARGEN, ROOT / 'electron-app' / '斯诺德跑团' / '角色创建页.html'),
                     (UPLOAD, ROOT / 'electron-app' / '斯诺德跑团' / '上传角色.html')):
        if src.exists() and dst.parent.exists():
            shutil.copy2(src, dst)
    print('✅ 战舞者创建页接入完成：' + ' / '.join(notes))
    return 0


if __name__ == '__main__':
    sys.exit(main())
