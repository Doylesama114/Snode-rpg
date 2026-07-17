import subprocess, sys, io, zipfile, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
repo = r"D:\Download\scholar-agent-main"
os.chdir(repo)
result = subprocess.run(["git", "show", "b3f3841:基础职业-圣骑士.docx"], capture_output=True)
with zipfile.ZipFile(io.BytesIO(result.stdout)) as z:
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
print(f'OLD: {len(lines)} lines')
for i, l in enumerate(lines[:80]):
    print(f'{i}: {l[:150]}')
