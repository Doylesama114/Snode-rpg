import zipfile, sys, io
ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
docx = r"D:\Download\scholar-agent-main\通用天赋树.docx"
color_table = {
    'FF0000':'#FF0000','EE822F':'#EE822F','FFF32F':'#FFF32F','FFD966':'#FFD966',
    '00B050':'#00B050','00FA99':'#00FA99','00B0F0':'#00B0F0','B3F9FF':'#B3F9FF',
    '00A0FF':'#00A0FF','B94BFF':'#B94BFF','FFB7E3':'#FFB7E3','FF66CC':'#FF66CC',
    '843F0B':'#843F0B','FFFFFF':'#FFFFFF','595959':'#595959','D9D9D9':'#D9D9D9'
}

with zipfile.ZipFile(docx) as z:
    xml = z.read('word/document.xml')
from xml.etree import ElementTree as ET
tree = ET.fromstring(xml)

# Extract lines first
lines = []
for p in tree.iter('{%s}p' % ns):
    texts = []
    for t in p.iter('{%s}t' % ns):
        if t.text: texts.append(t.text)
    line = ''.join(texts).strip()
    if line: lines.append(line)

# Find talent positions and their 标识 lines (2000-2800)
talents = {}
for i, l in enumerate(lines):
    if 2000 < i < 2800 and l.strip() in ['猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃','八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格','使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转','化险为夷','神圣干涉','冲击之铠','对策治疗','序幕的勋章','最佳状态','盛大登场','掷骰狂人','气定神闲','裁决者','极速者','召唤大师','伤害阈值','火中人','蛇之手','渴血者','同花顺','光明与黑暗','俱乐部达人']:
        # Find marks line
        marks = None
        for j in range(i, min(i+20, len(lines))):
            if '标识：' in lines[j]:
                marks = lines[j]
                break
        # Count dots
        dot_count = marks.count('●') if marks else 0
        talents[l.strip()] = {'line': i, 'dots': dot_count}
        break

# Now extract XML colors by finding the body element containing the skill name
body = tree.find('{%s}body' % ns)
elems = list(body)

# Find body element index for each talent
for name in talents:
    lno = talents[name]['line']
    # Find which body element contains this line
    for bi in range(len(elems)):
        elem_text = ET.tostring(elems[bi], encoding='unicode')
        if name in elem_text:
            # Extract dot colors from this element
            dot_colors = []
            in_fee = False
            for p in elems[bi].iter('{%s}p' % ns):
                for r in p.iter('{%s}r' % ns):
                    t = r.find('{%s}t' % ns)
                    if t is None or not t.text: continue
                    txt = t.text.strip()
                    if '标识：' in txt: in_fee = True; continue
                    if '描述：' in txt or '关键词：' in txt: break
                    if in_fee and '●' in txt:
                        rpr = r.find('{%s}rPr')
                        hex_color = '?'
                        if rpr is not None:
                            c = rpr.find('{%s}color')
                            if c is not None: hex_color = c.get('{%s}val', '?')
                        for _ in range(txt.count('●')):
                            dot_colors.append(color_table.get(hex_color, hex_color))
            talents[name]['colors'] = dot_colors
            talents[name]['body_idx'] = bi
            break

# Print results
for name in sorted(talents.keys()):
    t = talents[name]
    colors = t.get('colors', [])
    print('%s (L%d, body %s): %d dots, colors: %s' % (name, t['line'], t.get('body_idx','?'), t['dots'], ','.join(colors[:t['dots']])))
