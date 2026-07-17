import zipfile, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r"D:\Download\scholar-agent-main\基础职业-圣骑士.docx"
with zipfile.ZipFile(docx) as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)

lines = []
for p in tree.iter(f'{{{ns}}}p'):
    texts = []
    for t in p.iter(f'{{{ns}}}t'):
        if t.text:
            texts.append(t.text)
    line = ''.join(texts).strip()
    if line:
        lines.append(line)

print(f'Total lines: {len(lines)}')
for i, l in enumerate(lines[:120]):
    print(f'{i}: {l[:180]}')
