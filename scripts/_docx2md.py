import zipfile, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r"D:\Download\scholar-agent-main\通用天赋树.docx"

with zipfile.ZipFile(docx) as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)

lines = []
for p in tree.iter('{%s}p' % ns):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    lines.append(line)

md_lines = []
md_lines.append('# 通用天赋树\n')
md_lines.append('> 从 docx 自动转换，纯文本（不含颜色）\n')

for l in lines:
    if not l:
        md_lines.append('')
        continue
    s = l.strip()
    # Separator lines
    if s.startswith('---'):
        md_lines.append('\n---\n')
    # Choice headers
    elif '抉择' in s and '你仅能够选择' in s:
        md_lines.append('\n### %s\n' % s)
    # Talent names: short line, no colon, no bullet
    elif len(s) < 30 and '：' not in s and not s.startswith('·') and not s[0].isdigit() and not s.startswith('1.') and not s.startswith('2.'):
        md_lines.append('#### %s' % s)
    # Field lines
    elif '：' in s:
        parts = s.split('：', 1)
        md_lines.append('- **%s：**%s' % (parts[0], parts[1]))
    # Description/effect bullets
    elif s.startswith('·'):
        md_lines.append('  %s' % s)
    # Numbered items
    elif s[0].isdigit() and '.' in s[:3]:
        md_lines.append('1. %s' % s[s.index('.')+1:].strip())
    else:
        md_lines.append(s)

out = '\n'.join(md_lines)
path = r'D:\Download\scholar-agent-main\通用天赋树.md'
with open(path, 'w', encoding='utf-8') as f:
    f.write(out)
print('Written: %s (%d lines, %d bytes)' % (path, len(md_lines), len(out.encode('utf-8'))))
