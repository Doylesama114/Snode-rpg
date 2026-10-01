# -*- coding: utf-8 -*-
"""apply_skill_desc_sync v2：逐目标文件独立比对并补全（含镜像）。"""
import re, zipfile, json, os, shutil, time
from pathlib import Path
NL = chr(10)
ts = time.strftime('%Y%m%d-%H%M%S')
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
STAT = re.compile(r'^[^，,]{2,18}[，,]\s*防御等级')
BLACK = re.compile(r'^(职业等级|你可以通过花费技能点|.{0,8}天赋树$|抉择|一阶|二阶|三阶|四阶|五阶|六阶|七阶|晋升|进阶)')
LVL = re.compile(r'职业等级到达|等级到达')
PUNCT = ' \t·▲●◆■□★☆（）()、，,。.；;：:》〉[]【】'
def norm(s):
    s = ''.join(ch for ch in s if ch not in PUNCT)
    return re.sub(r'你的[^，。；]{0,8}?(职业)?等级到达(\d+)级时', lambda m: 'L' + m.group(2), s)
detail = json.load(open('_scratch/descr_detail.json', encoding='utf-8'))
tgt = sorted(set((x['cls'], x['skill']) for x in detail if x['kind'] in ('data','lvl')))
jobs = {}
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
    B = [l for l in cl if LVL.search(l) and not BLACK.match(l)]
    if A or B: jobs[(cls, skill)] = {'A': A, 'B': B}
report = []
def write(p, t):
    open(p, 'w', encoding='utf-8', newline='').write(t)
    m = 'electron-app/' + p
    if os.path.exists(m): shutil.copyfile(p, m)
def flatten(x): return ''.join(ch for ch in x if ch not in PUNCT)
for (cls, skill), v in jobs.items():
    A, B = v['A'], v['B']
    # 1) 职业页数据 JSON（description 数组末尾追加 + level_upgrades）
    for path in ['职业页/数据/%s.json' % cls, '职业页/%s.json' % cls]:
        if not os.path.exists(path): continue
        t = open(path, encoding='utf-8').read()
        if not A: continue
        if flatten(A[0])[:12] in flatten(t): continue      # 已有则跳过（幂等）
        i = t.find('"name": "%s"' % skill)
        if i < 0: i = t.find('"name":"%s"' % skill)
        if i < 0: continue
        j = t.find('"description"', i)
        if j < 0: continue
        s = t.find('[', j); e = t.find(']', s)
        if s < 0 or e < 0: continue
        inner = t[s + 1:e].rstrip().rstrip(',')
        add = ', '.join(json.dumps(x, ensure_ascii=False) for x in A)
        t = t[:s + 1] + inner + (', ' if inner.strip() else '') + add + t[e:]
        write(path, t)
        report.append('  %-28s +%d 行（description）' % (path, len(A)))
        break
    # 2) 职业页 HTML（data-search + effect-cell）
    path = '职业页/%s.html' % cls
    if os.path.exists(path) and A:
        t = open(path, encoding='utf-8').read()
        if flatten(A[0])[:12] not in flatten(t):
            i = t.find('id="%s"' % skill)
            if i < 0:
                k = t.find('>%s <span' % skill)
                i = t.rfind('<article', 0, k) if k > 0 else -1
            if i > 0:
                a0 = t.rfind('data-search="', 0, i); a1 = t.find('"', a0 + 13) if a0 > 0 else -1
                if a0 > 0 and a1 > a0:
                    t = t[:a1] + ''.join(' ' + l for l in A) + t[a1:]
                k = t.find('数据如下所示', i)
                if k > 0:
                    close = t.find('</div>', k)
                    if close > 0:
                        block = ''.join('<div class="effect-cell">%s</div>' % l for l in A)
                        t = t[:close + 6] + block + t[close + 6:]
                        write(path, t)
                        report.append('  %-28s +%d 行（卡片正文+搜索文本）' % (path, len(A)))
    # 3) panel_data.js（description 元素）
    path = '斯诺德跑团/panel_data.js'
    t = open(path, encoding='utf-8').read()
    if A and flatten(A[0])[:12] not in flatten(t):
        i = t.find(skill)
        j = t.find('\\"description\\"', i) if i > 0 else -1
        if j > 0:
            s = t.find('[', j); e = t.find(']', s)
            if s > 0 and e > s:
                inner = t[s + 1:e].rstrip().rstrip(',')
                add = ','.join('{\\"text\\":\\"' + x.replace('"', '') + '\\"}' for x in A)
                t = t[:s + 1] + inner + (',' if inner.strip() else '') + add + t[e:]
                write(path, t)
                report.append('  %-28s +%d 行' % (path, len(A)))
print('=== 同步报告（逐目标独立比对）===')
for r in report: print(r)
print('  共处理技能 %d 个' % len(jobs))
