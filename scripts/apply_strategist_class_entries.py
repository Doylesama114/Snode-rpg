#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把谋士写入职业页各职业清单数据（classes.json / classes_data.js / equipment_data.js / future_classes_data.json）。

数值与文案全部来自 基础职业-谋士.docx（可用 --check 校验是否已写入）。
用法：
  python scripts/apply_strategist_class_entries.py --check
  python scripts/apply_strategist_class_entries.py --write
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / '职业页' / '数据'

CLASS = '谋士'
DESC = ('谋士是团队的大脑，依靠智慧和谋略而非蛮力与魔法来驱动冒险的进程。他们在帐篷内摊开地图、在谈判桌上与领主周旋、'
        '在战斗前分析敌人的弱点与阵型。谋士或许在单打独斗中不占优势，但他们的存在能够将一支散兵游勇塑造成训练有素的劲旅。'
        '他们知晓如何在恰当的时机撤退、如何在恰当的时机施压、如何用最少的人力取得最大的收益。'
        '无论是破解远古的谜题，还是在宫廷中为团队争取盟友，谋士的智慧始终是团队最锋利的武器。')
ENTRY = {
    'name': CLASS,
    'description': DESC,
    '职责定位': '情报收集、团队增益、控制局势',
    '关键属性': '智力',
    '护甲': '轻甲',
    '武器': '匕首、手弩、简易武器',
    '豁免': '智力、魅力',
    '技巧': '从专注、调查、逻辑、知识、洞悉、欺瞒、说服、决策中选择四项熟练度各+1',
}
HP = {'first': 8, 'level_up': 2}
FP = {'first': 10, 'level_up': 1}
EQUIP = [
    {'letter': 'A', 'text': '一套游走宫廷的顾问套装，其中包括有：一把刺剑.一套高档服装.一个卷轴匣.一个背包（包含一条亚麻布毯、一套写作工具和一个水袋）.35枚金币'},
    {'letter': 'B', 'text': '一套指挥团队的冒险者套装，其中包括有：一把短剑.一副皮甲.一把手弩和20支箭矢.一个旅行腰包（包含一套探索工具和一个水袋）.一枚哨笛.一套制图工具.25枚金币'},
    {'letter': 'C', 'text': '一套负责团队探查的冒险者套装，其中包括有：一把匕首.一件布衣.一卷绷带.一个旅行腰包（包含一套开锁工具、一套制毒工具和一个水袋）.15枚金币'},
    {'letter': 'D', 'text': '一套研学求知的学者套装，其中包括有：一把匕首.一件布衣.一个卷轴匣.一枚放大镜.一张空白的魔法卷轴.一个背包（包含一条亚麻布毯、一套写作工具、一瓶墨水、十张羊皮纸和一个水袋）.35枚金币'},
]
FUTURE_FIX = {
    'status': 'released',
    'playable': True,
    'key_attr': '智力',
    'armor': '轻甲',
    'weapons': '匕首、手弩、简易武器',
    'saves': ['智力', '魅力'],
    'skills': ['专注', '调查', '逻辑', '知识', '洞悉', '欺瞒', '说服', '决策'],
    'specializations': ['权谋', '军团', '先见', '鸩毒', '混乱', '博物'],
    'starting_features': ['交友术', '战术部署', '毒刃', '离间'],
}


def load_js_const(path: Path, name: str):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'var\s+%s\s*=\s*(\[.*?\]);' % re.escape(name), text, re.S)
    if not m:
        raise SystemExit('未找到 %s in %s' % (name, path))
    return json.loads(m.group(1))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    classes_json = PAGE / 'classes.json'
    classes_data = PAGE / 'classes_data.js'
    equip_js = PAGE / 'equipment_data.js'
    future = PAGE / 'future_classes_data.json'

    reports = []
    # 1) classes.json
    cj = json.loads(classes_json.read_text(encoding='utf-8'))
    has_cj = any(x.get('name') == CLASS for x in cj)
    # 2) classes_data.js
    cd = load_js_const(classes_data, 'CLASSES')
    has_cd = any(x.get('name') == CLASS for x in cd)
    # 3) equipment_data.js
    eq_text = equip_js.read_text(encoding='utf-8')
    has_eq = ('"%s"' % CLASS) in eq_text or ('%s:' % CLASS) in eq_text
    # 4) future_classes_data.json
    fj = json.loads(future.read_text(encoding='utf-8'))
    moushi_future = next((c for c in fj.get('classes', []) if c.get('id') == CLASS), None)
    has_future_ok = bool(moushi_future) and moushi_future.get('status') == 'released'

    reports.append('classes.json: %s' % ('已写入' if has_cj else '缺失'))
    reports.append('classes_data.js: %s' % ('已写入' if has_cd else '缺失'))
    reports.append('equipment_data.js: %s' % ('已写入' if has_eq else '缺失'))
    reports.append('future_classes_data.json: %s' % ('已更新' if has_future_ok else '未更新'))

    if args.check:
        ok = has_cj and has_cd and has_eq and has_future_ok
        print('\n'.join(reports))
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    # --- 写入 ---
    if not has_cj:
        cj.append(dict(ENTRY))
        classes_json.write_text(json.dumps(cj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if not has_cd:
        cd.append(dict(ENTRY, hp_formula=dict(HP), fp_formula=dict(FP)))
        body = json.dumps(cd, ensure_ascii=False, indent=2)
        text = classes_data.read_text(encoding='utf-8')
        text = re.sub(r'var\s+CLASSES\s*=\s*\[.*?\];', 'var CLASSES = ' + body + ';', text, count=1, flags=re.S)
        classes_data.write_text(text, encoding='utf-8')

    if not has_eq:
        text = equip_js.read_text(encoding='utf-8')
        m = re.search(r'var\s+EQUIP_DATA\s*=\s*(\{[\s\S]*\});?\s*$', text)
        if not m:
            raise SystemExit('equipment_data.js 格式与预期不符')
        equip = json.loads(m.group(1))
        equip[CLASS] = EQUIP
        equip_js.write_text('var EQUIP_DATA = ' + json.dumps(equip, ensure_ascii=False) + ';\n',
                            encoding='utf-8')

    if moushi_future is None:
        fj.setdefault('classes', []).append(dict(FUTURE_FIX, id=CLASS, name=CLASS))
    else:
        moushi_future.update(FUTURE_FIX)
    future.write_text(json.dumps(fj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('\n'.join(reports))
    print('✅ 已写入谋士职业清单数据')
    return 0


if __name__ == '__main__':
    sys.exit(main())
