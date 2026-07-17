import zipfile, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
with zipfile.ZipFile(r"D:\Download\scholar-agent-main\基础职业-圣骑士.docx") as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)
lines = []
for p in tree.iter(f'{{{ns}}}p'):
    texts = []
    for t in p.iter(f'{{{ns}}}t'):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    if line: lines.append(line)
# Show context around changed lines
for lno in [165, 195, 465]:
    print(f'=== Around line {lno} ===')
    for i in range(max(0,lno-5), min(len(lines),lno+15)):
        marker = '>>>' if i in [174,175,201,203,206,207,475,476] else '   '
        print(f'{marker} {i}: {lines[i][:140]}')
    print()
