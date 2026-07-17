import zipfile, sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r"D:\Download\scholar-agent-main\通用天赋树.docx"

color_table = {
    'FF0000':'红','EE822F':'橙','FFF32F':'黄','FFD966':'黄','00B050':'绿','00FA99':'青',
    '00B0F0':'蓝','B3F9FF':'浅色','00A0FF':'浅色','B94BFF':'紫','FFB7E3':'粉','FF66CC':'粉',
    '843F0B':'棕','FFFFFF':'白','595959':'黑','D9D9D9':'无色'
}

# First extract raw text lines
with zipfile.ZipFile(docx) as z:
    xml_text = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml_text)
lines = []
for p in tree.iter('{%s}p' % ns):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    if line: lines.append(line)

# Now extract dot colors for each talent in range 2100-2650
# by finding the talent name in the XML body elements
body = tree.find('{%s}body' % ns)
elems = list(body)

# Map talent names to their body element index and line number
talent_positions = {}
for name in ['猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃',
             '八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格',
             '使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转',
             '化险为夷','神圣干涉']:
    for i, l in enumerate(lines):
        if l.strip() == name and 2000 < i < 2700:
            talent_positions[name] = i
            break

# For each talent, find its dot colors by scanning body elements
print('%d talents found in range' % len(talent_positions))
for name, lno in sorted(talent_positions.items(), key=lambda x: x[1]):
    # Find the 标识 line
    marks_line = None
    for j in range(lno, min(lno+20, len(lines))):
        if '标识：' in lines[j]:
            marks_line = j
            break
    
    # Print talent data
    print('\n=== %s (L%d) ===' % (name, lno))
    for j in range(lno, min(lno+25, len(lines))):
        l2 = lines[j].strip()
        if l2 and l2 != name:
            if j > lno+1 and '：' not in l2 and l2 not in ['抉择R·你仅能够选择其中一项习得','抉择T·你仅能够选择其中一项习得','抉择U·你仅能够选择其中两项习得','抉择V·你仅能够选择其中一项习得','抉择M·你仅能够选择其中一项习得'] and len(l2) < 30 and not l2.startswith('·') and not l2[0].isdigit():
                if not l2.startswith('1.') and not l2.startswith('2.') and not l2.startswith('3.') and not l2.startswith('4.'):
                    break
            print('  %s' % l2)
    print()
