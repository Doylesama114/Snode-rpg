#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""龙裔种族详情同步校验：PNG 口径 ↔ races_data.js / races.json / REF_RACES ↔ 创建页 / 面板（含镜像）。

用法: python scripts/verify_dragonborn_sync.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
CLASS = '龙裔'
SPEED = '5米'
DRAGONS = [('红龙', '火焰'), ('金龙', '火焰'), ('蓝龙', '雷电'), ('银龙', '奥术'), ('绿龙', '剧毒'),
           ('青铜龙', '雷电'), ('黑龙', '强酸'), ('黄铜龙', '火焰'), ('白龙', '冰冻'), ('赤铜龙', '强酸')]
FEATURE_KEYS = {
    '龙族血脉': ['巨龙的血统', '红龙/金龙=火焰', '蓝龙/青铜龙=雷电', '绿龙=剧毒', '黑龙/赤铜龙=强酸', '白龙=冰冻', '银龙=奥术'],
    '巨龙吐息': ['主要动作', '扇形 3 环', 'XD6', 'X=你的角色等级', '不受你的关键属性', '闪避成功', '长休'],
    '传承抗性': ['2 点'],
}
errors: list[str] = []
notes: list[str] = []


def check_features(feats: list[dict], where: str) -> None:
    for name, keys in FEATURE_KEYS.items():
        f = next((x for x in feats if x.get('name') == name), None)
        if not f:
            errors.append(f'{where} 缺特性 {name}')
            continue
        desc = f.get('desc') or ''
        for k in keys:
            if k not in desc:
                errors.append(f'{where} 特性「{name}」缺要素「{k}」')


def main() -> int:
    # 1) races_data.js
    js = (ROOT / '职业页' / '数据' / 'races_data.js').read_text(encoding='utf-8')
    arr = json.loads(re.search(r'var RACES\s*=\s*(\[[\s\S]*?\]);', js).group(1))
    d1 = next((r for r in arr if r.get('name') == CLASS), None)
    if not d1:
        errors.append('races_data.js 缺龙裔')
    else:
        if d1.get('基础移动力') != SPEED:
            errors.append(f"races_data.js 基础移动力 {d1.get('基础移动力')} != {SPEED}")
        if d1.get('属性加成', {}).get('力量') != 2 or d1.get('属性加成', {}).get('体质') != 2:
            errors.append('races_data.js 属性加成应保持 力量+2/体质+2')
        if d1.get('生命值加成') != 2:
            errors.append('races_data.js 生命值加成应保持 2')
        check_features(d1.get('特性') or [], 'races_data.js')

    # 2) races.json
    arr2 = json.loads((ROOT / '职业页' / '数据' / 'races.json').read_text(encoding='utf-8'))
    d2 = next((r for r in arr2 if r.get('name') == CLASS), None)
    if not d2 or d2.get('基础移动力') != SPEED:
        errors.append('races.json 龙裔/速度不符')
    else:
        check_features(d2.get('特性') or [], 'races.json')

    # 3) panel_data.js REF_RACES
    panel = (ROOT / '斯诺德跑团' / 'panel_data.js').read_text(encoding='utf-8')
    races = json.loads(json.loads(re.search(r'const REF_RACES = JSON\.parse\((".*?")\);', panel, re.S).group(1)))
    d3 = races.get(CLASS, {})
    if d3.get('speed') != SPEED:
        errors.append(f"REF_RACES 速度 {d3.get('speed')} != {SPEED}")
    if d3.get('attr_bonuses', {}).get('力量') != 2 or d3.get('hp_bonus') != 2:
        errors.append('REF_RACES 属性/HP 加成应保持不变')
    check_features(d3.get('talents') or [], 'REF_RACES')

    # 4) 角色创建页：DRAGON_TYPES + 提示 + 导出文案 + 语言
    chg = (ROOT / '斯诺德跑团' / '角色创建页.html').read_text(encoding='utf-8')
    m = re.search(r'var DRAGON_TYPES=\[([\s\S]*?)\];', chg)
    got = re.findall(r'\{name:"([^"]+)",breath:"([^"]+)",resistance:"([^"]+)"\}', m.group(1)) if m else []
    if len(got) != 10:
        errors.append(f'DRAGON_TYPES 条数 {len(got)} != 10')
    for name, dmg in DRAGONS:
        c = next((x for x in got if x[0] == name), None)
        if not c:
            errors.append(f'DRAGON_TYPES 缺 {name}')
        elif c[1] != dmg or c[2] != f'{dmg}（2 点）':
            errors.append(f'DRAGON_TYPES {name} = {c[1]}/{c[2]}，应为 {dmg}/{dmg}（2 点）')
    if '冰霜 + 护甲检定' in chg:
        errors.append('创建页仍残留旧「冰霜 + 护甲检定」（普通龙裔不应有）')
    if '黑龙/赤铜龙为强酸' not in chg:
        errors.append('龙种提示未说明黑龙/赤铜龙为强酸')
    if 'XD6，X=角色等级' not in chg:
        errors.append('创建页吐息导出缺 XD6 规则')
    if '龙裔:["通用语","龙语"]' not in chg:
        errors.append('RACE_LANGS 龙裔语言不符')

    # 5) panel_engine 显示
    eng = (ROOT / '斯诺德跑团' / 'panel_engine.js').read_text(encoding='utf-8')
    if 'D6 · X=角色等级' not in eng:
        errors.append('面板吐息显示缺等级骰数')

    # 6) 镜像一致
    for p in ('职业页/数据/races_data.js', '职业页/数据/races.json', '斯诺德跑团/panel_data.js',
              '斯诺德跑团/角色创建页.html', '斯诺德跑团/panel_engine.js'):
        a = ROOT / p
        b = ROOT / 'electron-app' / p
        if b.exists() and a.read_bytes() != b.read_bytes():
            errors.append(f'镜像不一致: {p}')

    notes.append('速度 5 米；10 龙种伤害表按 PNG（含雷电/剧毒/冰冻/强酸术语对齐）')
    notes.append('黑龙/赤铜龙=强酸（旧「冰霜+护甲检定」仅巨龙术士，本轮不实现）；吐息 XD6 随角色等级')
    notes.append('三条种族天赋补全（龙族血脉/巨龙吐息/传承抗性 2 点）；属性与 HP 加成保持不变')
    notes.append('创建页 DRAGON_TYPES / 提示 / 导出文案 + 面板吐息显示已联动')

    if errors:
        print('FAIL：龙裔同步校验未通过（%d 处）' % len(errors))
        for e in errors:
            print('  -', e)
        return 1
    print('OK：龙裔同步校验通过')
    for n in notes:
        print('  ·', n)
    return 0


if __name__ == '__main__':
    sys.exit(main())
