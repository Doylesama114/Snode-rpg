#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""召唤师版本 gap report：把 基础职业-召唤师.docx 与当前应用数据逐项对照，
产出实施清单与验收基线（技能 / 契约生物 / 抉择 / 专长 / 起始特性 / 装备 / 已知缺漏）。

产出：
  scripts/_summoner_gap_report.json   结构化报告（机器可读）
用法：
  python scripts/build_summoner_gap_report.py
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import OrderedDict, defaultdict
from datetime import date
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / '基础职业-召唤师.docx'
DATA_JSON = ROOT / '职业页' / '数据' / '召唤师.json'
CONTRACT_JSON = ROOT / '职业页' / '数据' / '召唤师契约生物.json'
PAGE_HTML = ROOT / '职业页' / '召唤师.html'
FX_JSON = ROOT / '斯诺德跑团' / 'skill_effects_召唤师.json'
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
OUT = Path(__file__).resolve().parent / '_summoner_gap_report.json'

CLASS = '召唤师'
STYLES = ['咒法', '降灵']
TIERS = ['一阶', '二阶', '三阶']
STARTING = ['魔法飞弹', '次级召唤术', '唤回']
FEATURES = ['召唤联结', '异界感知', '机缘召唤']

# 已知 docx 状态（用户已确认口径）
KNOWN_DOCX_GAPS = [
    {'skill': '蓝焰术', 'style': '咒法', 'tier': '二阶',
     'issue': 'docx 清单有、详情表缺失；按用户口径复用其他职业同名条目（法师版），升级条目职业名替换为召唤师',
     'source': '职业页/数据/法师.json → 蓝焰术'},
    {'item': '召唤指令·回避', 'issue': 'docx 清单笔误，实际应为「契约指令·回避」（详情表名称），已按详情落地'},
    {'item': '关键属性', 'issue': 'docx「首级疲劳值：8+关键属性调整值（敏捷或魅力）」为笔误；用户确认关键属性=幸运，FP 吃幸运调整值'},
    {'item': '起始特性', 'issue': '原文「你获得以下起始特性」，无选 N 提示；用户确认 3 条全部获得'},
    {'item': '召唤师专精', 'issue': '用户确认内容已写完（即「初始专长」3 条），无独立专精表'},
    {'item': '兼职要求', 'issue': 'docx 未提供，兼职四副本与面板子职业候选本期保持 16 职业不变'},
    {'item': '契约生物成长', 'issue': '仅有初始形态（CR 1/4）与升级原则，无逐级成长表；本期只做显示 + 手填等级/羁绊点数'},
]


def sha1(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest() if path.exists() else ''


def body_events():
    import docx
    from docx.oxml.ns import qn
    doc = docx.Document(str(DOCX))
    events = []
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            text = ''.join(n.text or '' for n in child.iter(qn('w:t'))).strip()
            if text:
                events.append(('P', text))
        elif child.tag == qn('w:tbl'):
            rows = []
            for tr in child.iter(qn('w:tr')):
                cells, seen = [], set()
                for tc in tr.iter(qn('w:tc')):
                    t = ''.join(n.text or '' for n in tc.iter(qn('w:t'))).strip()
                    if id(tc) not in seen:
                        seen.add(id(tc))
                        cells.append([' '.join(t.split())])
                if cells:
                    rows.append([c[0] for c in cells])
            if rows:
                events.append(('T', rows))
    return events


def parse_docx() -> dict:
    events = body_events()
    out: dict = {'styles': OrderedDict(), 'starting': [], 'features': [], 'equipment': {},
                 'meta': {}, 'choice_groups': [], 'contracts': []}

    style = tier = zone = None
    cur_feature = None
    feat_intro = None
    in_contracts = False
    contracts: list = []
    cur_creature = None

    def flush_feature():
        nonlocal cur_feature
        if cur_feature:
            out['features'].append(cur_feature)
            cur_feature = None

    for i, (kind, payload) in enumerate(events):
        if kind == 'T':
            if in_contracts:
                continue
            rows = payload
            if not rows:
                continue
            flat = ' '.join(' '.join(r) for r in rows)
            is_list = len(rows) >= 2 and all(len(r) == 1 for r in rows) and '：' not in flat and len(flat) < 220
            if not is_list:
                continue
            names = [r[0] for r in rows]
            if zone == 'starting':
                out['starting'] = names
            elif zone == 'talents' and style and tier:
                out['styles'].setdefault(style, {})[tier] = names
            continue

        t = payload
        # ---- 契约生物区（纯段落，按 --- 分隔）----
        if in_contracts:
            if t.startswith('---'):
                cur_creature = None
                continue
            if t == '战斗风格':
                in_contracts = False
                zone = None
                continue
            nxt = events[i + 1][1] if i + 1 < len(events) and events[i + 1][0] == 'P' else ''
            if re.match(r'^[一-龥·]{2,8}$', t) and re.match(r'^[^（]+（[^）]+系）', nxt):
                cur_creature = {'name': t, '_lines': []}
                contracts.append(cur_creature)
                continue
            if cur_creature is not None:
                cur_creature['_lines'].append(t)
            continue

        if t == '契约生物列表.':
            in_contracts = True
            continue
        if t.startswith(('生命值加成', '疲劳值加成', '熟练项', '装备')):
            zone = 'meta'
            continue
        if t == '战斗风格':
            zone = 'styles'
            continue
        if t == '起始特性':
            zone = 'starting'
            continue
        if t == '初始专长':
            zone = 'features'
            continue
        if t == '召唤师天赋树':
            zone = 'talents'
            continue
        if re.match(r'^[A-D]·', t) and zone == 'meta':
            out['equipment'][t[0]] = t[2:]
            continue
        if t.startswith('首级生命值：'):
            out['meta']['hp_first'] = t.split('：', 1)[1]
            continue
        if t.startswith('升级生命值：'):
            out['meta']['hp_up'] = t.split('：', 1)[1]
            continue
        if t.startswith('首级疲劳值：'):
            out['meta']['fp_first'] = t.split('：', 1)[1]
            continue
        if t.startswith('升级疲劳值：'):
            out['meta']['fp_up'] = t.split('：', 1)[1]
            continue
        if t.startswith(('护甲：', '武器：', '豁免：', '技艺：', '职责定位：')):
            k, v = t.split('：', 1)
            out['meta'][k] = v
            continue
        if t.endswith('风格') and t[:-2] in STYLES:
            style, tier = t[:-2], None
            out['styles'].setdefault(style, {})
            continue
        if re.match(r'^[一二三四五六七八]阶天赋树$', t):
            tier = t.split('天赋树')[0]
            continue
        if t.startswith('抉择'):
            out['choice_groups'].append(t)
            continue
        if zone == 'starting' and t in STARTING:
            if t not in out['starting']:
                out['starting'].append(t)
            continue
        if zone == 'features':
            if t in FEATURES:
                flush_feature()
                cur_feature = {'name': t, 'lines': []}
                continue
            if cur_feature is not None:
                if not t.startswith('---'):
                    cur_feature['lines'].append(t)
                continue
            if '关键属性' in t and feat_intro is None:
                feat_intro = t
            continue
    flush_feature()
    out['meta']['features_intro'] = feat_intro

    for c in contracts:
        lines = c.pop('_lines', [])
        head = lines[0] if lines else ''
        m = re.match(r'^([^（]+)（([^）]+系)），防御等级：(\d+)，生命值(\d+)，挑战等级：([^\s]+)', head)
        attrs = {}
        for ln in lines:
            for am in re.finditer(r'(力量|敏捷|体质|智力|感知|魅力|意志|幸运)\s*(-|\d+)\s*(?:\(([+-]?\d+)\))?', ln):
                attrs[am.group(1)] = am.group(2)
        labels = [ln.split('：')[0] for ln in lines if ln.startswith(
            ('感官：', '移动速度：', '战斗加成：', '伤害易伤：', '伤害抗性：', '伤害免疫：', '状态免疫：', '语言：', '特性'))]
        c.update({'type': m.group(1) if m else '', 'category': m.group(2) if m else '',
                  'ac': m.group(3) if m else '', 'hp': m.group(4) if m else '', 'cr': m.group(5) if m else '',
                  'attrs': attrs, 'labels': labels})
    out['contracts'] = contracts
    return out


def main() -> int:
    parsed = parse_docx()
    styles = OrderedDict()
    for st in STYLES:
        tiers = OrderedDict()
        for ti in TIERS:
            names = parsed['styles'].get(st, {}).get(ti) or []
            tiers[ti] = names
        styles[st] = {'tiers': tiers, 'total': sum(len(v) for v in tiers.values())}
    talent_total = sum(v['total'] for v in styles.values())

    app = {
        'classes_data': False, 'class_features': False, 'equipment': False,
        'page': PAGE_HTML.exists(), 'skill_effects': FX_JSON.exists(),
        'contracts_json': CONTRACT_JSON.exists(), 'panel_skill_data': False,
    }
    cd = ROOT / '职业页' / '数据' / 'classes_data.js'
    if cd.exists():
        app['classes_data'] = CLASS in cd.read_text(encoding='utf-8')
    cf = ROOT / '职业页' / '数据' / 'class_features.json'
    if cf.exists():
        app['class_features'] = CLASS in cf.read_text(encoding='utf-8')
    eq = ROOT / '职业页' / '数据' / 'equipment_data.js'
    if eq.exists():
        app['equipment'] = CLASS in eq.read_text(encoding='utf-8')
    if PANEL.exists():
        app['panel_skill_data'] = 'CONTRACT_CREATURES' in PANEL.read_text(encoding='utf-8')

    report = OrderedDict()
    report['generatedAt'] = date.today().isoformat()
    report['sources'] = {'summoner_docx': sha1(DOCX)}
    report['class'] = {
        'name': CLASS,
        'meta': parsed['meta'],
        'skill_count': talent_total + len(parsed['starting']),
        'talent_count': talent_total,
        'starting_features': parsed['starting'],
        'features': [{'name': f['name'], 'lines': len(f['lines'])} for f in parsed['features']],
        'styles': {st: {'tiers': {ti: len(names) for ti, names in v['tiers'].items()},
                        'total': v['total']} for st, v in styles.items()},
        'skill_lists': {st: {ti: names for ti, names in v['tiers'].items()} for st, v in styles.items()},
        'choice_groups': parsed['choice_groups'],
        'equipment': parsed['equipment'],
    }
    report['contracts'] = {
        'count': len(parsed['contracts']),
        'categories': [c['category'] for c in parsed['contracts']],
        'names': [c['name'] for c in parsed['contracts']],
        'field_check': {
            'all_have_8_attrs': all(len(c['attrs']) == 8 for c in parsed['contracts']),
            'all_have_head': all(c['ac'] and c['hp'] and c['cr'] for c in parsed['contracts']),
            'common_labels': sorted({l for c in parsed['contracts'] for l in c['labels']}),
        },
        'items': parsed['contracts'],
    }
    report['known_docx_gaps'] = KNOWN_DOCX_GAPS
    report['app_state'] = app
    report['acceptance'] = {
        'skills_expected': 46,
        'talent_expected': 43,
        'contracts_expected': 20,
        'choices_expected': 3,
        'features_expected': 3,
        'starting_expected': 3,
    }

    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('%s 技能 %d 条（起始 %d + 天赋 %d）' % (CLASS, report['class']['skill_count'],
                                                len(parsed['starting']), talent_total))
    for st, v in styles.items():
        print('  %s: %s = %d' % (st, ' / '.join('%s%d' % (ti, len(names)) for ti, names in v['tiers'].items()), v['total']))
    print('  抉择组 %d: %s' % (len(parsed['choice_groups']), '；'.join(parsed['choice_groups'])))
    print('  起始特性 %d: %s' % (len(parsed['starting']), '、'.join(parsed['starting'])))
    print('  专长 %d: %s' % (len(parsed['features']), '、'.join(f['name'] for f in parsed['features'])))
    print('  装备 %d 组: %s' % (len(parsed['equipment']), '、'.join(parsed['equipment'])))
    print('契约生物 %d 个（8 属性齐全=%s，头部字段齐全=%s）'
          % (len(parsed['contracts']), report['contracts']['field_check']['all_have_8_attrs'],
             report['contracts']['field_check']['all_have_head']))
    print('应用现状:', app)
    print('→ 写出', OUT.relative_to(ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
