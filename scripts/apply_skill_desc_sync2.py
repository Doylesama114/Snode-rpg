# -*- coding: utf-8 -*-
import re, json, os, shutil, zipfile
from pathlib import Path
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
PUNCT = ' ' + chr(9) + '·▲●◆■□★☆（）()、，,。.；;：:》〉[]【】'
def flatten(s): return ''.join(ch for ch in s if ch not in PUNCT)
tgt = [('德鲁伊','活火焰'),('法师','邪恶之水'),('法师','梦魇术'),('法师','变形术·棕熊'),('法师','变形术·野猪'),('猎人','猫鼬撕咬'),('魔契师','邪恶之水')]
report = []
def write(p, t):
    open(p, 'w', encoding='utf-8', newline='').write(t)
    m = 'electron-app/' + p
    if os.path.exists(m): shutil.copyfile(p, m)
for cls, skill in tgt:
    body = sections(docx_lines('基础职业技能表/基础职业-%s.docx' % cls)).get(skill)
    if not body: continue
    cl = [x for x in content_of(body) if x and not re.fullmatch(r'[-—–_=·]{4,}', x)]
    A, hit = [], False
    for l in cl:
        if STAT.match(l): hit = True
        if hit:
            if BLACK.match(l) and not STAT.match(l): break
            A.append(l)
    if not A: continue
    key = flatten(A[0])[:14]
    # ① 职业页数据 JSON：按技能块内判断
    for path in ['职业页/数据/%s.json' % cls, '职业页/%s.json' % cls]:
        if not os.path.exists(path): continue
        t = open(path, encoding='utf-8').read()
        i = t.find('"name": "%s"' % skill)
        if i < 0: i = t.find('"name":"%s"' % skill)
        if i < 0: continue
        j = t.find('"description"', i)
        if j < 0: continue
        s = t.find('[', j); e = t.find(']', s)
        blk = t[s:e] if s > 0 and e > s else ''
        if key in flatten(blk): continue                       # 本技能块内已有 → 跳过
        inner = blk[1:].rstrip().rstrip(',')
        add = ', '.join(json.dumps(x, ensure_ascii=False) for x in A)
        t = t[:s + 1] + inner + (', ' if inner.strip() else '') + add + t[e:]
        write(path, t)
        report.append('  %-28s +%d 行' % (path, len(A)))
        break
    # ② panel_data.js：本技能块内判断（转义写法）
    path = '斯诺德跑团/panel_data.js'
    t = open(path, encoding='utf-8').read()
    qi = t.find(BS + '"' + skill + BS + '"')
    if qi > 0:
        j = t.find(BS + '"description' + BS + '"', qi)
        s = t.find('[', j) if j > 0 else -1
        e = t.find(']', s) if s > 0 else -1
        blk = t[s:e] if s > 0 and e > s else ''
        if key not in flatten(blk.replace(BS, '')):
            inner = blk[1:].rstrip().rstrip(',')
            add = ','.join('{' + BS + '"text' + BS + '":' + BS + '"' + x.replace('"', '') + BS + '"}' for x in A)
            t = t[:s + 1] + inner + (',' if inner.strip() else '') + add + t[e:]
            write(path, t)
            report.append('  %-28s +%d 行' % (path, len(A)))
print('=== 补齐报告 ===')
for r in report: print(r)
print('')
print('=== 语法与合法性校验 ===')
for f in ['职业页/数据/德鲁伊.json', '职业页/数据/法师.json', '职业页/数据/猎人.json', '职业页/数据/魔契师.json', '职业页/search-index.json']:
    if not os.path.exists(f): continue
    try:
        json.load(open(f, encoding='utf-8')); print('  OK  %s' % f)
    except Exception as ex:
        print('  FAIL %s → %s' % (f, str(ex)[:70]))
import subprocess
for f in ['斯诺德跑团/panel_data.js']:
    r2 = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    print('  %s 语法: %s' % (f, 'OK' if r2.returncode == 0 else 'FAIL ' + (r2.stderr or '')[:100]))
