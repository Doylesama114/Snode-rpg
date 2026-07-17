import zipfile, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r"D:\Download\scholar-agent-main\通用天赋树.docx"

color_table = {
    'FF0000':'#FF0000','EE822F':'#EE822F','FFF32F':'#FFF32F',
    '00B050':'#00B050','00FA99':'#00FA99','00B0F0':'#00B0F0',
    'B3F9FF':'#B3F9FF','B94BFF':'#B94BFF','FFB7E3':'#FFB7E3',
    '843F0B':'#843F0B','FFFFFF':'#FFFFFF','595959':'#595959',
    'D9D9D9':'#D9D9D9'
}

with zipfile.ZipFile(docx) as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)

paras = list(tree.iter('{%s}p' % ns))
text_lines = []
for pi, p in enumerate(paras):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    text_lines.append((pi, line))

# Build results
results = []
for pi, line in text_lines:
    if '标识：' not in line: continue
    dot_count = line.count('●')
    if dot_count == 0: continue
    
    talent_name = '?'
    for j in range(len(text_lines)-1, -1, -1):
        if text_lines[j][0] >= pi: continue
        prev = text_lines[j][1]
        if prev and len(prev) < 25 and '：' not in prev and '●' not in prev:
            if not prev.startswith('抉择') and not prev.startswith('-') and '. ' not in prev:
                talent_name = prev
                break
    
    colors = []
    for r in paras[pi].iter('{%s}r' % ns):
        t = r.find('{%s}t' % ns)
        if t is None or not t.text: continue
        if '●' not in t.text: continue
        rpr = r.find('{%s}rPr' % ns)
        hex_c = '?'
        if rpr is not None:
            c = rpr.find('{%s}color' % ns)
            if c is not None:
                val = c.get('{%s}val' % ns, '?')  # FIXED: was missing % ns
                hex_c = color_table.get(val, '#' + val if len(val) == 6 else val)
        for _ in range(t.text.count('●')):
            colors.append(hex_c)
    
    results.append((talent_name, dot_count, colors))

# Only print targeted talents (the ones we care about)
targets = {'猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃',
           '八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格',
           '使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转',
           '化险为夷','神圣干涉','冲击之铠','对策治疗','序幕的勋章','最佳状态',
           '盛大登场','掷骰狂人','气定神闲','裁决者','极速者','召唤大师',
           '伤害阈值','火中人','蛇之手','渴血者','同花顺','光明与黑暗','俱乐部达人'}

for name, dots, colors in results:
    if name in targets:
        print('%s: %d dots -> %s' % (name, dots, ','.join(colors[:dots])))
