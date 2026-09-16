#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把召唤师写入职业页各职业清单数据（classes.json / classes_data.js / equipment_data.js / future_classes_data.json）。

数值与文案来自 基础职业-召唤师.docx（用户确认：关键属性=幸运，FP 吃幸运调整值）。
用法：
  python scripts/apply_summoner_class_entries.py --check
  python scripts/apply_summoner_class_entries.py --write
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
NL = chr(10)

CLASS = '召唤师'
DESC = ('召唤师的力量在于“联结”——将远方的存在牵引至自己身边。从一把凭空出现的匕首、到一只忠心耿耿的魔像、'
        '乃至来自异界的强大存在，召唤师能够借来它们的力量为己所用。召唤师与召唤物之间存在着某种神秘的共鸣，'
        '他们能够模糊地感知到召唤物的位置和状态，甚至在远处操纵它们执行指令。'
        '那些真正掌控了这门技艺的召唤师，将以一人之力撬动整片战场的天平。')
ENTRY = {
    'name': CLASS,
    'description': DESC,
    '职责定位': '法术输出、控制局势、体系构筑',
    '关键属性': '幸运',
    '护甲': '轻甲',
    '武器': '法杖、魔棒、匕首、手弩、简易武器',
    '豁免': '感知、幸运',
    '技巧': '从专注、奥秘、多元宇宙、神秘学、洞悉、驯兽、感悟、机遇中选择四项熟练度各+1',
}
HP = {'first': 8, 'level_up': 2}
FP = {'first': 8, 'level_up': 1}
EQUIP = [
    {'letter': 'A', 'text': '一套初出茅庐的学院派套装，其中包括有：一根学徒魔棒.一件布衣.一个背包（包含一条羊绒毯、一本任意法术学派的基础书籍和一个水袋）.15枚金币'},
    {'letter': 'B', 'text': '一套担任团队施法者的冒险者套装，其中包括有：一根学徒魔棒.一把匕首.一件布衣.一个背包（包含一条亚麻布毯、两瓶活力药水和一个水袋）.15枚金币'},
    {'letter': 'C', 'text': '一套神秘主义者的秘法套装，其中包括有：一把匕首.一件布衣.一个魔法水晶球.一个旅行腰包（包含一条亚麻布毯、一套写作工具和一个水袋）.25枚金币'},
    {'letter': 'D', 'text': '一套探索异界的旅行者套装，其中包括有：一根学徒魔棒.一副皮甲.一张空白的魔法卷轴.一个旅行腰包（包含一套探索工具和一个水袋）.25枚金币'},
]
FUTURE_FIX = {
    'status': 'released',
    'playable': True,
    'key_attr': '幸运',
    'armor': '轻甲',
    'weapons': '法杖、魔棒、匕首、手弩、简易武器',
    'saves': ['感知', '幸运'],
    'skills': ['专注', '奥秘', '多元宇宙', '神秘学', '洞悉', '驯兽', '感悟', '机遇'],
    'specializations': ['咒法', '降灵'],
    'starting_features': ['魔法飞弹', '次级召唤术', '唤回'],
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
    cj = json.loads(classes_json.read_text(encoding='utf-8'))
    has_cj = any(x.get('name') == CLASS for x in cj)
    cd = load_js_const(classes_data, 'CLASSES')
    has_cd = any(x.get('name') == CLASS for x in cd)
    eq_text = equip_js.read_text(encoding='utf-8')
    has_eq = ('"%s"' % CLASS) in eq_text or ('%s:' % CLASS) in eq_text
    fj = json.loads(future.read_text(encoding='utf-8'))
    ms = next((c for c in fj.get('classes', []) if c.get('id') == CLASS), None)
    has_future_ok = bool(ms) and ms.get('status') == 'released' and ms.get('key_attr') == '幸运'

    reports.append('classes.json: %s' % ('已写入' if has_cj else '缺失'))
    reports.append('classes_data.js: %s' % ('已写入' if has_cd else '缺失'))
    reports.append('equipment_data.js: %s' % ('已写入' if has_eq else '缺失'))
    reports.append('future_classes_data.json: %s' % ('已更新' if has_future_ok else '未更新'))

    if args.check:
        ok = has_cj and has_cd and has_eq and has_future_ok
        print(NL.join(reports))
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    if not has_cj:
        cj.append(dict(ENTRY))
        classes_json.write_text(json.dumps(cj, ensure_ascii=False, indent=2) + NL, encoding='utf-8')
    if not has_cd:
        cd.append(dict(ENTRY, hp_formula=dict(HP), fp_formula=dict(FP)))
        text = classes_data.read_text(encoding='utf-8')
        # re.sub 的替换串会把反斜杠转义解释掉，因此用 lambda 原样返回
        text = re.sub(r'var\s+CLASSES\s*=\s*\[.*?\];',
                      lambda m: 'var CLASSES = ' + json.dumps(cd, ensure_ascii=False, indent=2) + ';',
                      text, count=1, flags=re.S)
        classes_data.write_text(text, encoding='utf-8')
    if not has_eq:
        text = equip_js.read_text(encoding='utf-8')
        m = re.search(r'var\s+EQUIP_DATA\s*=\s*(\{[\s\S]*\});?\s*$', text)
        if not m:
            raise SystemExit('equipment_data.js 格式与预期不符')
        equip = json.loads(m.group(1))
        equip[CLASS] = EQUIP
        equip_js.write_text('var EQUIP_DATA = ' + json.dumps(equip, ensure_ascii=False) + ';' + NL, encoding='utf-8')
    if ms is None:
        fj.setdefault('classes', []).append(dict(FUTURE_FIX, id=CLASS, name=CLASS))
    else:
        ms.update(FUTURE_FIX)
    future.write_text(json.dumps(fj, ensure_ascii=False, indent=2) + NL, encoding='utf-8')

    print(NL.join(reports))
    print('✅ 已写入召唤师职业清单数据')
    return 0


if __name__ == '__main__':
    sys.exit(main())
