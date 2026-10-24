#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验奇械师·炽擎风格窄口径更新（10.24）：只新增三/四阶，不触碰其余 5 风格。"""
import json, re, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = '奇械师'
STYLE = '炽擎'
EXPECT_TOTAL = 154
EXPECT_OTHERS = {'精准': 18, '构想': 35, '支援': 19, '魔枢': 38, '电涌': 28}
EXPECT_HEAT = 16

data = json.loads((ROOT / '职业页' / '数据' / (CLASS + '.json')).read_text(encoding='utf-8'))
html = (ROOT / '职业页' / (CLASS + '.html')).read_text(encoding='utf-8')
fx = json.loads((ROOT / '斯诺德跑团' / ('skill_effects_' + CLASS + '.json')).read_text(encoding='utf-8'))
skills = data['skills']
errors = []

if len(skills) != EXPECT_TOTAL:
    errors.append('技能总数 %d != %d' % (len(skills), EXPECT_TOTAL))
styles = Counter((s.get('style') or '') for s in skills)
for k, v in EXPECT_OTHERS.items():
    if styles.get(k, 0) != v:
        errors.append('%s 风格 %d 条 != %d（窄口径不应触碰）' % (k, styles.get(k, 0), v))
heat = [s for s in skills if (s.get('style') or '') == STYLE]
if len(heat) != EXPECT_HEAT:
    errors.append('炽擎 %d 条 != %d' % (len(heat), EXPECT_HEAT))
tiers = Counter((s.get('tier') or '') for s in heat)
if dict(tiers) != {'一阶': 4, '二阶': 4, '三阶': 4, '四阶': 4}:
    errors.append('炽擎阶位分布异常: %s' % dict(tiers))
if any(s.get('cost') for s in heat):
    errors.append('炽擎仍有 cost（新规则应清空）')
if any('标识' in (s.get('fields') or {}) for s in heat):
    errors.append('炽擎仍有 标识 字段')
arts = re.findall(r'<article class="skill[^"]*" id="([^"]+)"', html)
if len(arts) != EXPECT_TOTAL:
    errors.append('页面技能卡 %d != %d' % (len(arts), EXPECT_TOTAL))
for t in ('一阶', '二阶', '三阶', '四阶'):
    if ('id="ar-tier-%s-%s"' % (STYLE, t)) not in html:
        errors.append('缺少 %s %s 段' % (STYLE, t))
    if ('href="#ar-tier-%s-%s"' % (STYLE, t)) not in html:
        errors.append('导航缺少 %s %s 链接' % (STYLE, t))
seg = html[html.find('id="ar-style-' + STYLE + '"'):]
if '标识：' in seg[:seg.find('<section class="style"', 10) if seg.find('<section class="style"', 10) > 0 else len(seg)]:
    errors.append('炽擎区内仍有 标识 行')
if len(fx.get(CLASS, [])) != EXPECT_TOTAL:
    errors.append('skill_effects %d != %d' % (len(fx.get(CLASS, [])), EXPECT_TOTAL))
print('炽擎 %d 条（一/二/三/四阶 各 4）；其余 5 风格 %s；页面 %d 卡；fx %d 条' % (len(heat), dict(styles), len(arts), len(fx.get(CLASS, []))))
if errors:
    print('FAIL：奇械师炽擎窄口径校验未通过（%d 处）' % len(errors))
    for e in errors:
        print('  -', e)
    sys.exit(1)
print('OK：奇械师炽擎窄口径校验通过')