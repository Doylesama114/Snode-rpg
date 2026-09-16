#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""龙裔种族详情（龙裔种族详情.png）→ 结构化数据 + 与现状差异登记。

用户确认口径（4 条）：
  1. 黑龙/赤铜龙按新版 = 强酸；旧版「冰霜 + 护甲检定」只在巨龙术士内生效，普通龙裔初始选择没有该额外效果
  2. 巨龙吐息伤害随等级：角色等级 X → XD6
  3. 抗性按现有表述（获得 2 点对应伤害抗性）
  4. 属性加成/生命值加成保持现状（力量+2、体质+2、HP+2）

用法：
  python scripts/build_dragonborn_gap_report.py
产出：
  scripts/_dragonborn_gap_report.json
"""
from __future__ import annotations

import json
import sys
from collections import OrderedDict
from datetime import date
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PNG = ROOT / '龙裔种族详情.png'
OUT = Path(__file__).resolve().parent / '_dragonborn_gap_report.json'
RACES_JS = ROOT / '职业页' / '数据' / 'races_data.js'
RACES_JSON = ROOT / '职业页' / '数据' / 'races.json'
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
CHARGEN = ROOT / '斯诺德跑团' / '角色创建页.html'

# ---- PNG 原文转录（关键条目逐字） ----
TEXT = {
    '年龄': '龙裔成长周期较快，未成年的龙裔便几乎与成年人族一致健壮，他们普遍 15 岁成年，大约能活到 80 岁。',
    '外貌特征': '龙裔的外貌有着显著地龙类特征，不管是体格还是神态上都具备真龙的威严感，因此见识过两个种族的人们绝不会将他们与蜥蜴人搞混淆。龙裔直立行走但没有翅膀和尾巴，他们没有毛发，鳞片色泽则与龙种血脉有关。',
    '体型': '龙裔比人类要更高大、更壮硕，但他们仍属于中型体型。',
    '主要分布': '龙裔主要分布在雷恩三国的北境和东境地区，在南境也有成规模的族群。在北境地区呈现金属龙种特征的龙裔数量居多，东境则是五色龙种特征的龙裔占比更大，南境的龙裔大多有着绿龙、黄铜龙和赤铜龙血脉。',
    '速度': '你的基础移动速度为 5 米。',
    '语言': '龙裔可以正常的使用通用语来进行交流，而血脉中潜藏的龙族力量使他们能够自然地说出并听懂龙语，但除非经过专门的学习，否则他们无法读、写古老的龙语文字。',
    '龙族血脉': '你拥有巨龙的血统，可以选择以下一个龙种，你的吐息会根据龙种造成不同类别的伤害。',
    '巨龙吐息': '你能够喷吐出威力强大的龙息吞没敌人，花费一个主要动作对前方扇形 3 环内的所有角色各造成【★D6】点伤害（伤害类型与你的龙种有关）；（1）巨龙吐息不会受到你的关键属性和任何增益效果的影响；（2）闪避成功的角色仍需承受一半的结算后伤害。',
    '传承抗性': '你获得 2 点龙族血脉对应的伤害类别抗性。',
}

# 龙种 → 吐息/抗性伤害类型（PNG 顺序）
DRAGONS = OrderedDict([
    ('红龙', '火焰'), ('金龙', '火焰'),
    ('蓝龙', '雷电'), ('银龙', '奥术'),
    ('绿龙', '剧毒'), ('青铜龙', '雷电'),
    ('黑龙', '强酸'), ('黄铜龙', '火焰'),
    ('白龙', '冰冻'), ('赤铜龙', '强酸'),
])

CANON = {
    'name': '龙裔',
    'attr_bonuses': {'力量': 2, '感知': 0, '敏捷': 0, '魅力': 0, '体质': 2, '意志': 0, '智力': 0, '幸运': 0},
    'hp_bonus': 2,
    'speed': '5米',
    'size': '中型',
    'lifespan': '80岁',
    'adult_age': '15岁成年',
    'languages': ['通用语', '龙语'],
    'language_note': '能自然说出并听懂龙语，但无法读写古老的龙语文字（除非经过专门学习）',
    'breath': {
        'action': '主要动作',
        'area': '前方扇形 3 环',
        'damage': 'XD6（X = 角色等级）',
        'ignores': '不受关键属性与任何增益效果影响',
        'save': '闪避成功仍需承受一半结算后伤害',
        'cooldown': '长休',
    },
    'resistance_points': 2,
    'dragons': DRAGONS,
}

DESCRIPTION = ('他们的身世与巨龙有着千丝万缕的关联，从口中喷吐出的龙息使得他们保持着天生的威慑力。'
               '龙裔直立行走、无翅膀无尾巴也没有毛发，鳞片色泽与龙种血脉有关；他们比人类更高大壮硕，'
               '但仍属于中型体型，普遍 15 岁成年、大约能活到 80 岁。')

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


def load_current() -> dict:
    """读取三处现状数据（races_data.js / races.json / REF_RACES）。"""
    import re
    out: dict = {}
    if RACES_JS.exists():
        s = RACES_JS.read_text(encoding='utf-8')
        m = re.search(r'var RACES\s*=\s*(\[[\s\S]*?\]);', s)
        if m:
            arr = json.loads(m.group(1))
            out['races_data'] = next((r for r in arr if r.get('name') == '龙裔'), None)
    if RACES_JSON.exists():
        arr = json.loads(RACES_JSON.read_text(encoding='utf-8'))
        out['races_json'] = next((r for r in arr if r.get('name') == '龙裔'), None)
    if PANEL.exists():
        s = PANEL.read_text(encoding='utf-8')
        m = re.search(r"REF_RACES = JSON\.parse\((\".*?\")\);", s, re.S)
        if m:
            races = json.loads(json.loads(m.group(1)))
            out['ref_races'] = races.get('龙裔')
    if CHARGEN.exists():
        s = CHARGEN.read_text(encoding='utf-8')
        m = re.search(r'var DRAGON_TYPES=\[([\s\S]*?)\];', s)
        out['dragon_types'] = re.findall(r'\{name:"([^"]+)",breath:"([^"]+)",resistance:"([^"]+)"\}', m.group(1)) if m else []
    return out


def main() -> int:
    cur = load_current()
    diffs = []
    data = cur.get('races_data') or cur.get('races_json') or {}
    if data.get('基础移动力') != CANON['speed']:
        diffs.append({'field': '基础移动力/speed', 'before': data.get('基础移动力'),
                      'after': CANON['speed'], 'reason': 'PNG：基础移动速度 5 米'})
    for name, dmg in DRAGONS.items():
        c = next((x for x in (cur.get('dragon_types') or []) if x[0] == name), None)
        if c and (c[1] != dmg or (dmg not in c[2])):
            diffs.append({'field': f'龙种·{name}', 'before': f'{c[1]} / {c[2]}',
                          'after': f'{dmg} / {dmg}（2 点抗性）', 'reason': 'PNG 龙种伤害表'})
    for feat in (data.get('特性') or []):
        canon = next((f for f in FEATURES if f['name'] == feat['name']), None)
        if canon and feat.get('desc') != canon['desc']:
            diffs.append({'field': f'特性·{feat["name"]}', 'before': feat.get('desc'),
                          'after': canon['desc'], 'reason': 'PNG 种族天赋细节'})

    report = OrderedDict()
    report['generatedAt'] = date.today().isoformat()
    report['source'] = {'png': PNG.name, 'sha1': __import__('hashlib').sha1(PNG.read_bytes()).hexdigest() if PNG.exists() else ''}
    report['user_confirmed'] = [
        '黑龙/赤铜龙按新版=强酸；旧版「冰霜+护甲检定」仅在巨龙术士生效，普通龙裔初始选择无此额外效果',
        '巨龙吐息伤害随等级：角色等级 X → XD6',
        '抗性按现有表述：获得 2 点对应伤害抗性',
        '属性加成/生命值加成保持现状（力量+2、体质+2、HP+2）',
    ]
    report['text'] = TEXT
    report['canonical'] = dict(CANON, dragons=dict(DRAGONS))
    report['description'] = DESCRIPTION
    report['features'] = FEATURES
    report['current'] = cur
    report['diffs'] = diffs
    report['files_to_update'] = [
        '职业页/数据/races_data.js', '职业页/数据/races.json',
        '斯诺德跑团/panel_data.js#REF_RACES',
        '斯诺德跑团/角色创建页.html#DRAGON_TYPES 与吐息导出文案',
        '斯诺德跑团/panel_engine.js 龙裔特性显示',
        'electron-app 镜像（races_data.js / races.json / panel_data.js / 角色创建页.html / panel_engine.js）',
    ]
    report['deferred'] = [
        '巨龙术士专属吐息变体（冰霜 + 护甲检定）——待其专属内容实现时再落地',
        '龙裔属性加成/生命值加成调整（PNG 未提及，按现状保留）',
    ]

    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('龙裔详情 gap report')
    print('  龙种表:', '、'.join(f'{k}={v}' for k, v in DRAGONS.items()))
    print('  速度:', CANON['speed'], '| 抗性:', CANON['resistance_points'], '点 | 吐息伤害:', CANON['breath']['damage'],
          '| 冷却:', CANON['breath']['cooldown'])
    print('  差异 %d 处:' % len(diffs))
    for d in diffs:
        print('   -', d['field'], ':', d['before'], '→', d['after'])
    print('→ 写出', OUT.relative_to(ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
