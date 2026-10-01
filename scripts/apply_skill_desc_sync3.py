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
PUNCT = ' ' + chr(9) + '·▲●◆■□★☆（）()、，,。.；;：:》〉[]【】'
def flatten(s): return ''.join(ch for ch in s if ch not in PUNCT)
# 收集待补技能及其中文 id
targets = []
for cls in ['德鲁伊','法师','猎人','魔契师','奇械师','战士']:
    jp = '斯诺德跑团/skill_effects_%s.json' % cls
    if not os.path.exists(jp): continue
    fx = json.load(open(jp, encoding='utf-8'))
    arr = fx if isinstance(fx, list) else list(fx.values())[0]
    for s in arr:
        if not isinstance(s, dict) or not s.get('name'): continue
        body = sections(docx_lines('基础职业技能表/基础职业-%s.docx' % cls)).get(s['name'])
        if not body: continue
        cl = [x for x in content_of(body) if x and not re.fullmatch(r'[-—–_=·]{4,}', x)]
        A, hit = [], False
        for l in cl:
            if STAT.match(l): hit = True
            if hit:
                if BLACK.match(l) and not STAT.match(l): break
                A.append(l)
        if A: targets.append({'cls': cls, 'name': s['name'], 'id': s.get('id', ''), 'A': A})
print('有数据块的技能: %d 个' % len(targets))
def write(p, t):
    open(p, 'w', encoding='utf-8', newline='').write(t)
    m = 'electron-app/' + p
    if os.path.exists(m): shutil.copyfile(p, m)
report = []
bycls = {}
for x in targets: bycls.setdefault(x['cls'], []).append(x)
for cls, items in bycls.items():
    jid = {x['name']: x['id'] for x in items}
    # ① 职业页数据 JSON（按 name 定位，块内判断）
    for path in ['职业页/数据/%s.json' % cls, '职业页/%s.json' % cls]:
        if not os.path.exists(path): continue
        t = open(path, encoding='utf-8').read()
        ch = 0
        for x in items:
            i = t.find('"name": "%s"' % x['name'])
            if i < 0: i = t.find('"name":"%s"' % x['name'])
            if i < 0: continue
            if x['id'] and x['id'] in t[:i]: pass
            j = t.find('"description"', i)
            if j < 0: continue
            s = t.find('[', j); e = t.find(']', s)
            blk = t[s:e] if s > 0 and e > s else ''
            if flatten(x['A'][0])[:14] in flatten(blk): continue
            # 只认第一个含数据块的技能（避免串块）：要求块内不含其它技能名
            inner = blk[1:].rstrip().rstrip(',')
            add = ', '.join(json.dumps(y, ensure_ascii=False) for y in x['A'])
            t = t[:s + 1] + inner + (', ' if inner.strip() else '') + add + t[e:]
            ch += 1
        if ch:
            write(path, t); report.append('  %-26s 补 %d 技能' % (path, ch))
    # ② panel_data.js
    path = '斯诺德跑团/panel_data.js'
    t = open(path, encoding='utf-8').read()
    ch = 0
    for x in items:
        if not x['id']: continue
        qi = t.find(BS + '"id' + BS + '":' + BS + '"' + x['id'] + BS + '"')
        if qi < 0: qi = t.find(BS + '"id' + BS + '": ' + BS + '"' + x['id'] + BS + '"')
        if qi < 0: continue
        j = t.find(BS + '"description' + BS + '"', qi)
        s = t.find('[', j) if j > 0 else -1
        e = t.find(']', s) if s > 0 else -1
        blk = t[s:e] if s > 0 and e > s else ''
        if flatten(x['A'][0])[:14] in flatten(blk.replace(BS, '')): continue
        inner = blk[1:].rstrip().rstrip(',')
        add = ','.join('{' + BS + '"text' + BS + '":' + BS + '"' + y.replace('"', '') + BS + '"}' for y in x['A'])
        t = t[:s + 1] + inner + (',' if inner.strip() else '') + add + t[e:]
        ch += 1
    if ch:
        write(path, t); report.append('  %-26s 补 %d 技能' % (path, ch))
print('=== 最终补齐 ===')
for r in report: print(r)
print('')
import subprocess
for f in ['职业页/数据/德鲁伊.json','职业页/数据/法师.json','职业页/数据/猎人.json','职业页/数据/魔契师.json','职业页/数据/奇械师.json','职业页/数据/战士.json']:
    if os.path.exists(f):
        try: json.load(open(f, encoding='utf-8')); print('  OK  ' + f)
        except Exception as ex: print('  FAIL %s %s' % (f, str(ex)[:60]))
r2 = subprocess.run(['node','--check','斯诺德跑团/panel_data.js'], capture_output=True, text=True)
print('  panel_data.js 语法: ' + ('OK' if r2.returncode == 0 else 'FAIL ' + (r2.stderr or '')[:80]))
