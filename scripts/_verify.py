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

check = ['使命必达','唤醒','八毫米','利见大人','信手拈来','超体','表演型人格',
         '英雄弧光','深渊呢喃','饥饿游戏','回避身形','猛火','剧毒物质','深度创伤',
         '稳固经济','兢业玩家','八墓村','触不可及','飓风专精',
         '以刃承伤','魔力偏转','化险为夷','神圣干涉',
         '哟吼船长的藏宝图']

print('Current docx has %d lines' % len(lines))
for name in check:
    found = [i for i, l in enumerate(lines) if l.strip() == name]
    if found:
        print('FOUND: %s at line %s' % (name, found[0]))
    else:
        print('MISSING: %s' % name)
