import re, zipfile
from xml.etree import ElementTree as ET

# Step 1: Map talents to tiers from docx
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

# Map each talent to its tier
targets = [
    '猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃',
    '八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格',
    '使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转',
    '化险为夷','神圣干涉','冲击之铠','对策治疗','序幕的勋章','最佳状态',
    '盛大登场','掷骰狂人','气定神闲','裁决者','极速者','召唤大师',
    '伤害阈值','火中人','蛇之手','渴血者','同花顺','光明与黑暗','俱乐部达人'
]

talent_tier = {}
for name in targets:
    for i, l in enumerate(lines):
        if l.strip() == name:
            tier = 'unknown'
            for j in range(i, -1, -1):
                if lines[j].endswith('阶天赋树') and len(lines[j]) < 10:
                    tier = lines[j]
                    break
            talent_tier[name] = tier
            break

print('Tier mapping:')
for t in sorted(set(talent_tier.values())):
    names = [n for n, tier in talent_tier.items() if tier == t]
    print('  %s: %s' % (t, ', '.join(names)))

# Step 2: Now know correct tiers. Fix HTML by moving articles.
# We need to identify which tier sections exist in HTML and move articles there.

# Read HTML
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    html = f.read()

# The HTML uses <h3>X阶天赋树</h3> + <div class="tier-list"> structure
# We need to find each tier-list div and move articles

# Strategy: 
# 1. Extract all article blocks for misplaced talents
# 2. Remove them from the HTML
# 3. Insert them into the correct tier-list section

# First, find all talent articles that are in the wrong tier
# The talent name is in <h4> inside the article tag

# Build a map: talent_name -> article_html_block
articles = {}
for name in talent_tier:
    # Find the article block
    # Pattern: <article class="skill" id="g-skill-XXX" ...><h4>NAME<span ...></h4>...</article>
    pattern = r'(<article class="skill" id="g-skill-\d+"[^>]*?><h4>' + re.escape(name) + r'[^<]*</h4>.*?</article>)'
    match = re.search(pattern, html, re.DOTALL)
    if match:
        articles[name] = match.group(1)
        print('Found article for: %s (%d chars)' % (name, len(match.group(1))))
    else:
        print('NOT FOUND: %s' % name)

# Remove all these articles from HTML
for name, block in articles.items():
    html = html.replace(block, '<!-- MOVED: %s -->' % name)

# Now insert each article into the correct tier-list
# Find tier-list sections
tier_sections = {}
for m in re.finditer(r'<h3>([^<]+)</h3>\s*<div class="tier-list">', html):
    tier_name = m.group(1)
    tier_sections[tier_name] = m.end()

# Insert articles
for name, tier in sorted(talent_tier.items(), key=lambda x: x[1]):
    if name not in articles: continue
    block = articles[name]
    if tier in tier_sections:
        pos = tier_sections[tier]
        # Find the end of the tier-list div that contains this position
        # Insert before the closing </div> of this tier-list
        # Actually, let's insert at the right position within the tier
        # Find the h3 and insert after the div.tier-list opening
        html = html.replace('<div class="tier-list">', '<div class="tier-list">\n        ' + block, 1)

# Write back
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('\nDone. Checking result...')
# Verify no talent appears multiple times
import subprocess
