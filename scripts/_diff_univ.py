import subprocess, sys, io, zipfile, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
repo = r"D:\Download\scholar-agent-main"
os.chdir(repo)

def extract(source):
    with zipfile.ZipFile(source) as z:
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
    return lines

new_lines = extract(r"D:\Download\scholar-agent-main\通用天赋树.docx")

result = subprocess.run(["git", "show", "b3f3841:通用天赋树.docx"], capture_output=True)
import io
old_lines = extract(io.BytesIO(result.stdout))

print('OLD: %d lines, NEW: %d lines' % (len(old_lines), len(new_lines)))

diffs = []
for i in range(max(len(old_lines), len(new_lines))):
    ol = old_lines[i] if i < len(old_lines) else '(missing)'
    nl = new_lines[i] if i < len(new_lines) else '(missing)'
    if ol != nl:
        diffs.append((i, ol[:140], nl[:140]))

print('\n=== %d lines differ ===' % len(diffs))
for idx, ol, nl in diffs:
    print('Line %d:' % idx)
    print('  OLD: %s' % ol)
    print('  NEW: %s' % nl)
    print()
