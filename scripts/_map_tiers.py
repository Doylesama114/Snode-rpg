import zipfile, sys, io
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
with zipfile.ZipFile(r"D:\Download\scholar-agent-main\通用天赋树.docx") as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)
lines = []
for p in tree.iter('{%s}p' % ns):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    if line: lines.append(line)

# Find tier headers and map talents to tiers
tiers = {}  # line_number -> tier_name
talent_tier = {}  # talent_name -> tier_name

current_tier = 'unknown'
for i, l in enumerate(lines):
    # Match "X阶天赋树" as tier header
    if l.endswith('阶天赋树') and len(l) < 10:
        current_tier = l
        tiers[i] = l
    
    # A talent name is a short line without colon, occurring right after tier header
    # (but we need to skip the proficiency/equipment lines after headers)
    # Talent names are typically short (<25 chars) without colons, and preceded by fields
    pass

# Better approach: find the tier header before each talent
targets = ['猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃',
           '八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格',
           '使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转',
           '化险为夷','神圣干涉','冲击之铠','对策治疗','序幕的勋章','最佳状态',
           '盛大登场','掷骰狂人','气定神闲','裁决者','极速者','召唤大师',
           '伤害阈值','火中人','蛇之手','渴血者','同花顺','光明与黑暗','俱乐部达人']

for name in targets:
    for i, l in enumerate(lines):
        if l.strip() == name:
            # Find the most recent tier header before this talent
            tier = 'unknown'
            for j in range(i, -1, -1):
                if lines[j].endswith('阶天赋树') and len(lines[j]) < 10:
                    tier = lines[j]
                    break
            talent_tier[name] = tier
            break

print('=== Talent-Tier Mapping ===')
for name in sorted(talent_tier.keys(), key=lambda n: talent_tier[n]):
    print('%s -> %s' % (talent_tier[name].ljust(10), name))
