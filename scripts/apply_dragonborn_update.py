#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""龙裔种族详情更新（M1 数据层）：同步三处数据 + electron 镜像。

改动内容（依据 龙裔种族详情.png + 用户确认口径，详见 scripts/_dragonborn_gap_report.json）：
  基础移动力 6米→5米；龙种伤害表按 PNG（雷电/剧毒/冰冻/强酸/火焰/奥术）；三条种族天赋补全；
  描述补入外貌/体型/年龄；属性加成与生命值加成保持不变。

用法：
  python scripts/apply_dragonborn_update.py --check
  python scripts/apply_dragonborn_update.py --write
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
RACES_JS = ROOT / '职业页' / '数据' / 'races_data.js'
RACES_JSON = ROOT / '职业页' / '数据' / 'races.json'
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
MIRRORS = [
    (RACES_JS, ROOT / 'electron-app' / '职业页' / '数据' / 'races_data.js'),
    (RACES_JSON, ROOT / 'electron-app' / '职业页' / '数据' / 'races.json'),
    (PANEL, ROOT / 'electron-app' / '斯诺德跑团' / 'panel_data.js'),
]

DESCRIPTION = ('他们的身世与巨龙有着千丝万缕的关联，从口中喷吐出的龙息使得他们保持着天生的威慑力。'
               '龙裔直立行走、无翅膀无尾巴也没有毛发，鳞片色泽与龙种血脉有关；他们比人类更高大壮硕，'
               '但仍属于中型体型，普遍 15 岁成年、大约能活到 80 岁。')
SPEED = '5米'
FEATURES = [
    {'name': '龙族血脉',
     'desc': '你拥有巨龙的血统，选择一种龙种决定吐息与抗性的伤害类型：红龙/金龙=火焰、蓝龙/青铜龙=雷电、'
             '绿龙=剧毒、黑龙/赤铜龙=强酸、白龙=冰冻、银龙=奥术。'},
    {'name': '巨龙吐息',
     'desc': '花费一个主要动作，对前方扇形 3 环内所有角色各造成 XD6 点伤害（X=你的角色等级，伤害类型随龙种）；'
             '不受你的关键属性和任何增益效果影响；闪避成功仍需承受一半结算后伤害。使用频率：长休。'},
    {'name': '传承抗性',
     'desc': '你获得 2 点龙种血脉对应的伤害类别抗性。'},
]


def patch_races_js(text: str) -> str:
    m = re.search(r'var RACES\s*=\s*(\[[\s\S]*?\]);', text)
    if not m:
        raise SystemExit('races_data.js 未找到 RACES')
    arr = json.loads(m.group(1))
    for r in arr:
        if r.get('name') == '龙裔':
            r['description'] = DESCRIPTION
            r['基础移动力'] = SPEED
            r['特性'] = [dict(f) for f in FEATURES]
    body = json.dumps(arr, ensure_ascii=False, indent=1)
    return text[:m.start()] + 'var RACES = ' + body + ';' + text[m.end():]


def patch_races_json(text: str) -> str:
    arr = json.loads(text)
    for r in arr:
        if r.get('name') == '龙裔':
            r['description'] = DESCRIPTION
            r['基础移动力'] = SPEED
            r['特性'] = [dict(f) for f in FEATURES]
    return json.dumps(arr, ensure_ascii=False, indent=2) + '\n'


def patch_panel(text: str) -> str:
    m = re.search(r'const REF_RACES = JSON\.parse\((".*?")\);', text, re.S)
    if not m:
        raise SystemExit('panel_data.js 未找到 REF_RACES')
    races = json.loads(json.loads(m.group(1)))
    db = races.get('龙裔')
    if db is None:
        raise SystemExit('REF_RACES 缺龙裔')
    db['description'] = DESCRIPTION
    db['speed'] = SPEED
    db['talents'] = [{'name': f['name'], 'desc': f['desc']} for f in FEATURES]
    inner = json.dumps(races, ensure_ascii=False)
    literal = json.dumps(inner, ensure_ascii=False)
    return text[:m.start()] + 'const REF_RACES = JSON.parse(' + literal + ');' + text[m.end():]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    js = RACES_JS.read_text(encoding='utf-8')
    jj = RACES_JSON.read_text(encoding='utf-8')
    panel = PANEL.read_text(encoding='utf-8')

    def races_ok(arr) -> bool:
        r = next((x for x in arr if x.get('name') == '龙裔'), None)
        return bool(r) and r.get('基础移动力') == SPEED and all(
            any(f.get('name') == c['name'] and f.get('desc') == c['desc'] for f in (r.get('特性') or []))
            for c in FEATURES) and r.get('description') == DESCRIPTION

    js_ok = races_ok(json.loads(re.search(r'var RACES\s*=\s*(\[[\s\S]*?\]);', js).group(1)))
    jj_ok = races_ok(json.loads(jj))
    races = json.loads(json.loads(re.search(r'const REF_RACES = JSON\.parse\((".*?")\);', panel, re.S).group(1)))
    db = races.get('龙裔') or {}
    panel_ok = db.get('speed') == SPEED and db.get('description') == DESCRIPTION and all(
        any(t.get('name') == c['name'] and t.get('desc') == c['desc'] for t in (db.get('talents') or []))
        for c in FEATURES)

    print('races_data.js:', 'OK' if js_ok else '待更新')
    print('races.json:', 'OK' if jj_ok else '待更新')
    print('panel_data.js#REF_RACES:', 'OK' if panel_ok else '待更新')
    if args.check:
        ok = js_ok and jj_ok and panel_ok
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    RACES_JS.write_text(patch_races_js(js), encoding='utf-8', newline='')
    RACES_JSON.write_text(patch_races_json(jj), encoding='utf-8', newline='')
    PANEL.write_text(patch_panel(panel), encoding='utf-8', newline='')
    for src, dst in MIRRORS:
        if dst.parent.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    print('✅ 龙裔数据已同步（含 electron 镜像）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
