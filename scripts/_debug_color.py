import zipfile, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r"D:\Download\scholar-agent-main\通用天赋树.docx"

with zipfile.ZipFile(docx) as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)

# Find the paragraph that contains "猛火" - find all paras with dots
paras_text = []
for i, p in enumerate(tree.iter('{%s}p' % ns)):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    paras_text.append((i, line))

# Find 猛火's marks paragraph
for idx, (pi, line) in enumerate(paras_text):
    if '标识：' in line and '●●' in line:
        # Check if talent before this is 猛火
        for j in range(idx-1, -1, -1):
            if paras_text[j][1] == '猛火':
                # Dump the raw XML of this paragraph
                p_elem = list(tree.iter('{%s}p' % ns))[pi]
                print('=== Raw XML for 猛火 标识 paragraph ===')
                print(ET.tostring(p_elem, encoding='unicode')[:2000])
                print()
                
                # Now find all w:color elements within this paragraph
                print('=== All w:color elements ===')
                for c in p_elem.iter('{%s}color' % ns):
                    print('  val=%s' % c.get('{%s}val'))
                
                # Also check w:rPr structure
                print('\n=== w:r elements structure ===')
                for r in p_elem.iter('{%s}r' % ns):
                    t = r.find('{%s}t' % ns)
                    txt = t.text if t is not None else ''
                    rpr = r.find('{%s}rPr' % ns)
                    if rpr is not None:
                        c = rpr.find('{%s}color' % ns)
                        cval = c.get('{%s}val') if c is not None else 'NONE'
                        print('  text=%s color=%s' % (txt[:20], cval))
                    else:
                        print('  text=%s rPr=NONE' % txt[:20])
                
                raise SystemExit(0)
