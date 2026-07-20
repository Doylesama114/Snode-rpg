"""Comprehensive verification of 通用天赋树.html tier placement and integrity."""

import re, zipfile
from xml.etree import ElementTree as ET

print('=' * 60)
print('1. DOCX vs HTML — Tier Mapping Verification')
print('=' * 60)

# Extract tier mapping from docx
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
with zipfile.ZipFile(r"D:\Download\scholar-agent-main\通用天赋树.docx") as z:
    xml = z.read('word/document.xml')
tree = ET.fromstring(xml)
lines = []
for p in tree.iter('{%s}p' % ns):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    if line: lines.append(line)

all_talents = [
    '猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃',
    '八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格',
    '使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转',
    '化险为夷','神圣干涉','冲击之铠','对策治疗','序幕的勋章','最佳状态',
    '盛大登场','掷骰狂人','气定神闲','裁决者','极速者','召唤大师',
    '伤害阈值','火中人','蛇之手','渴血者','同花顺','光明与黑暗','俱乐部达人'
]

docx_tiers = {}
for name in all_talents:
    for i, l in enumerate(lines):
        if l.strip() == name:
            tier = 'unknown'
            for j in range(i, -1, -1):
                if lines[j].endswith('阶天赋树') and len(lines[j]) < 10:
                    tier = lines[j]
                    break
            docx_tiers[name] = tier
            break

print('Docx tier distribution:')
for t in ['四阶天赋树','五阶天赋树','六阶天赋树','七阶天赋树']:
    names = [n for n, tier in docx_tiers.items() if tier == t]
    print('  %s: %s' % (t, ', '.join(names)))

# Read HTML
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract h4 talent names by tier section
html_tiers = {}
current_tier = '?'
lines = html.split('\n')
for line in lines:
    if '<h3>' in line and '阶天赋树' in line:
        current_tier = line.split('<h3>')[1].split('</h3>')[0].strip()
    for name in all_talents:
        if '<h4>' in line and name in line:
            if current_tier not in html_tiers:
                html_tiers[current_tier] = []
            html_tiers[current_tier].append(name)

print('\n' + '=' * 60)
print('2. HTML vs DOCX — Tier Match Check')
print('=' * 60)

mismatches = 0
for name in all_talents:
    docx_tier = docx_tiers.get(name, '?')
    html_tier = 'missing'
    for t, names in html_tiers.items():
        if name in names:
            html_tier = t
            break
    status = 'OK' if docx_tier == html_tier else 'MISMATCH'
    if status != 'OK':
        mismatches += 1
        print('  %s: DOCX=%s, HTML=%s' % (name, docx_tier, html_tier))

if mismatches == 0:
    print('  ALL 37 talents in correct tiers!')
else:
    print('  %d mismatches' % mismatches)

print('\n' + '=' * 60)
print('3. Article Integrity Check')
print('=' * 60)

# Check for duplicate article IDs
ids = re.findall(r'id="(g-skill-\d+)"', html)
id_counts = {}
for i in ids:
    id_counts[i] = id_counts.get(i, 0) + 1
dupes = [(k, v) for k, v in id_counts.items() if v > 1]
if dupes:
    print('  DUPLICATE IDs: %d' % len(dupes))
    for k, v in dupes[:5]:
        print('    %s: %d times' % (k, v))
else:
    print('  No duplicate article IDs')

# Check for article-h4 match: every h4 should be inside an article
h4s = len(re.findall(r'<h4>[^<]+</h4>', html))
articles = len(re.findall(r'<article class="skill"', html))
print('  Articles: %d, H4 tags: %d' % (articles, h4s))

# Check balanced tags
open_div = html.count('<div ')
open_div2 = html.count('<div>')
close_div = html.count('</div>')
print('  DIV open: %d, close: %d' % (open_div + open_div2, close_div)
)
open_article = html.count('<article ')
close_article = html.count('</article>')
print('  ARTICLE open: %d, close: %d' % (open_article, close_article))

print('\n' + '=' * 60)
print('4. Tier Distribution Summary')
print('=' * 60)
for t in ['一阶天赋树','二阶天赋树','三阶天赋树','四阶天赋树','五阶天赋树','六阶天赋树','七阶天赋树']:
    names = sorted(html_tiers.get(t, []))
    print('  %s: %d talents' % (t, len(names)))
    for n in names[:5]:
        print('    - %s' % n)
    if len(names) > 5:
        print('    ... and %d more' % (len(names)-5))

print('\n' + '=' * 60)
print('FINAL RESULT: %s' % ('PASS' if mismatches == 0 and len(dupes) == 0 else 'FAIL'))
