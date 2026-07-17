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

# Build text lines with their XML paragraph index
paras = list(tree.iter('{%s}p' % ns))
text_lines = []
for pi, p in enumerate(paras):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    text_lines.append((pi, line))

# Find all "标识：●" lines and extract colors
results = []
for pi, line in text_lines:
    if '标识：' not in line: continue
    dot_count = line.count('●')
    if dot_count == 0: continue
    
    # Find the talent name by scanning backwards
    talent_name = '?'
    for j in range(len(text_lines)-1, -1, -1):
        if text_lines[j][0] >= pi: continue
        prev = text_lines[j][1]
        if prev and len(prev) < 20 and '：' not in prev and '●' not in prev and prev not in ['抉择R·你仅能够选择其中一项习得','抉择T·你仅能够选择其中一项习得','抉择U·你仅能够选择其中两项习得','抉择V·你仅能够选择其中一项习得','抉择M·你仅能够选择其中一项习得']:
            talent_name = prev
            break
    
    # Extract XML colors for each dot
    colors = []
    for r in paras[pi].iter('{%s}r' % ns):
        t = r.find('{%s}t' % ns)
        if t is None or not t.text: continue
        if '●' not in t.text: continue
        rpr = r.find('{%s}rPr')
        hex_c = '?'
        if rpr is not None:
            c = rpr.find('{%s}color')
            if c is not None: hex_c = c.get('{%s}val', '?')
        hex_c = color_table.get(hex_c, hex_c)
        for _ in range(t.text.count('●')):
            colors.append(hex_c)
    
    results.append((talent_name, dot_count, colors))

# Print results
for name, dots, colors in results:
    print('%s: %d dots -> %s' % (name, dots, ','.join(colors[:dots])))
