import zipfile, sys, io
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
with zipfile.ZipFile(r"D:\Download\scholar-agent-main\通用天赋树.docx") as z:
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

new_talents = [
    '冲击之铠', '对策治疗', '序幕的勋章', '最佳状态', '盛大登场',
    '掷骰狂人', '气定神闲', '裁决者', '极速者', '召唤大师',
    '伤害阈值', '火中人', '蛇之手', '渴血者', '同花顺',
    '光明与黑暗', '俱乐部达人',
    '豪勇与激斗符文', '灵动与巧变符文', '坚韧与不息符文',
    '博闻与通晓符文', '洞彻与澄明符文', '倾心与折服符文',
    '决意与信念符文', '命数与机遇符文'
]

out = []
for name in new_talents:
    for i, l in enumerate(lines):
        if l.strip() == name:
            out.append('=== %s (L%d) ===' % (name, i))
            for j in range(i, min(i+25, len(lines))):
                l2 = lines[j].strip()
                if l2 and l2 != name:
                    if j > i+1 and not any(c in l2 for c in '：:') and l2 not in [
                        '抉择R·你仅能够选择其中一项习得',
                        '抉择T·你仅能够选择其中一项习得',
                        '抉择U·你仅能够选择其中两项习得',
                        '抉择V·你仅能够选择其中一项习得'
                    ] and len(l2) < 30 and not l2.startswith('·') and not l2[0].isdigit():
                        if not l2.startswith('1.') and not l2.startswith('2.') and not l2.startswith('3.') and not l2.startswith('4.'):
                            break
                    out.append('  %s' % l2)
            out.append('')
            break

with open(r'D:\Download\scholar-agent-main\scripts\_talents.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('Written %d bytes' % len('\n'.join(out).encode('utf-8')))
