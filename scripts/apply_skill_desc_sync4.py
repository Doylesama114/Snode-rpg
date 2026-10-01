# -*- coding: utf-8 -*-
import re, json, os, shutil, zipfile
NL = chr(10)
BS = chr(92)
def docx_lines(p):
    xml = zipfile.ZipFile(p).read('word/document.xml').decode('utf-8', 'ignore')
    xml = re.sub(r'</w:p>', NL, xml)
    return [l.strip() for l in re.sub(r'<[^>]+>', '', xml).replace('&amp;', '&').split(NL) if l.strip()]
NAMEF = ('前置条件：','额外条件：','施展时间：','施展距离：','持续时间：','疲劳消耗：','关键词：','施展条件：','施展限制：','标识：','描述：','效果：','升级：')
def sections(lines):
    idx = []
    for i, l in enumerate(lines):
        if not (2 <= len(l) <= 22) or '：' in l or ':' in l: continue
        if l.startswith(NAMEF) or re.match(r'^[一二三四五六七]阶', l) or l.startswith('抉择'): continue
        if re.match(r'^(你|该|当|如果|若|可以|能够|使|对|在|此|这|·|X为)', l): continue
        if i + 1 < len(lines) and lines[i + 1].startswith(NAMEF): idx.append(i)
    out = {}
    for k, i in enumerate(idx):
        end = idx[k + 1] if k + 1 < len(idx) else len(lines)
        out.setdefault(lines[i], lines[i + 1:end])
    return out
def content_of(body):
    out, started = [], False
    for l in body:
        if l.startswith('描述：') or l.startswith('效果：'):
            started = True
            r = l.split('：', 1)[1].strip() if '：' in l else ''
            if r: out.append(r)
            continue
        if l.startswith('升级：'):
            out.append(l.split('：', 1)[1].strip() if '：' in l else '')
            continue
        if started:
            if re.match(r'^(标识：|关键词：|施展条件：|施展限制：|前置条件：|额外条件：)', l): break
            out.append(l)
    return [x for x in out if x]
STAT = re.compile(r'^[^，,]{2,18}[，,]' + BS + 's*防御等级')
BLACK = re.compile(r'^(职业等级|你可以通过花费技能点|.{0,8}天赋树$|抉择|一阶|二阶|三阶|四阶|五阶|六阶|七阶|晋升|进阶)')
def getA(cls, name):
    body = sections(docx_lines('基础职业技能表/基础职业-%s.docx' % cls)).get(name)
    if not body: return []
    cl = [x for x in content_of(body) if x and not re.fullmatch(r'[-—–_=·]{4,}', x)]
    A, hit = [], False
    for l in cl:
        if STAT.match(l): hit = True
        if hit:
            if BLACK.match(l) and not STAT.match(l): break
            A.append(l)
    return A
report = []
def write(p, t):
    open(p, 'w', encoding='utf-8', newline='').write(t)
    m = 'electron-app/' + p
    if os.path.exists(m): shutil.copyfile(p, m)
for cls, name in [('法师', '梦魇术'), ('猎人', '猫鼬撕咬')]:
    A = getA(cls, name)
    print('  %s/%s → 数据块 %d 行' % (cls, name, len(A)))
    # ① panel_data.js：按 "name":"X" 定位（转义写法），找 description 数组追加
    p = '斯诺德跑团/panel_data.js'
    t = open(p, encoding='utf-8').read()
    cands = [BS + '"name' + BS + '":' + BS + '"' + name + BS + '"', BS + '"name' + BS + '": ' + BS + '"' + name + BS + '"']
    qi = -1
    for c in cands:
        qi = t.find(c)
        if qi >= 0: break
    if qi > 0:
        j = t.find(BS + '"description' + BS + '"', qi)
        if j < 0: j = t.find(BS + '"description_entries' + BS + '"', qi)
        s = t.find('[', j) if j > 0 else -1
        e = t.find(']', s) if s > 0 else -1
        if s > 0 and e > s:
            inner = t[s + 1:e].rstrip().rstrip(',')
            add = ','.join('{' + BS + '"text' + BS + '":' + BS + '"' + x.replace('"', '') + BS + '"}' for x in A)
            t = t[:s + 1] + inner + (',' if inner.strip() else '') + add + t[e:]
            write(p, t)
            report.append('  panel_data.js 已补 %s' % name)
        else:
            report.append('  ✗ panel_data.js 未找到 %s 的 description 数组' % name)
    else:
        report.append('  ✗ panel_data.js 未找到 %s' % name)
    # ② search-index.js / .json：技能名之后、锚点短语处插入
    for p2 in ['职业页/search-index.js', '职业页/search-index.json']:
        if not os.path.exists(p2): continue
        t = open(p2, encoding='utf-8').read()
        i = t.find('"' + name + '"')
        if i < 0: i = t.find(name)
        if i < 0: continue
        j = t.find('数据如下所示', i)
        if j < 0:
            # 无锚点：追加到该技能条目的文本末尾
            j2 = t.find('"summary"', i)
            if j2 > 0:
                q = t.find(BS + '"', j2 + 9)
                if q > 0:
                    pass
            report.append('  ✗ %s 未找到 %s 的锚点' % (p2, name)); continue
        endq = t.find('"', j + 6)
        if endq < 0: continue
        add = ''.join(' ' + x for x in A).replace('"', '')
        t = t[:endq] + add + t[endq:]
        write(p2, t)
        report.append('  %s 已补 %s' % (p2, name))
print('')
for r in report: print(r)
import subprocess
r2 = subprocess.run(['node','--check','斯诺德跑团/panel_data.js'], capture_output=True, text=True)
print('  panel_data.js 语法: ' + ('OK' if r2.returncode == 0 else 'FAIL ' + (r2.stderr or '')[:90]))
r3 = subprocess.run(['node','--check','职业页/search-index.js'], capture_output=True, text=True)
print('  search-index.js 语法: ' + ('OK' if r3.returncode == 0 else 'FAIL ' + (r3.stderr or '')[:90]))
