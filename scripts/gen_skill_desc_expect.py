# -*- coding: utf-8 -*-
import re, json, zipfile, os
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
exp = []
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
        if A: exp.append({'cls': cls, 'name': s['name'], 'id': s.get('id', ''), 'lines': A})
json.dump({'blocks': exp}, open('scripts/skill_desc_expect.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('期望快照: %d 个技能' % len(exp))
