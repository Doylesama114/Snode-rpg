import subprocess, sys, io, zipfile, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
repo = r"D:\Download\scholar-agent-main"
os.chdir(repo)

def extract(docx_path):
    with zipfile.ZipFile(docx_path) as z:
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
    return lines

new_lines = extract(r"D:\Download\scholar-agent-main\基础职业-圣骑士.docx")
result = subprocess.run(["git", "show", "b3f3841:基础职业-圣骑士.docx"], capture_output=True)
old_lines = extract(io.BytesIO(result.stdout))

print(f'OLD: {len(old_lines)} lines, NEW: {len(new_lines)} lines')
print(f'Diff count: {len(new_lines) - len(old_lines)}')

# Compare line by line
diffs = []
for i in range(max(len(old_lines), len(new_lines))):
    ol = old_lines[i] if i < len(old_lines) else '(missing)'
    nl = new_lines[i] if i < len(new_lines) else '(missing)'
    if ol != nl:
        diffs.append((i, ol[:120], nl[:120]))

print(f'\n=== {len(diffs)} lines differ ===')
for idx, ol, nl in diffs:
    print(f'Line {idx}:')
    print(f'  OLD: {ol}')
    print(f'  NEW: {nl}')
    print()
