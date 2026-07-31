# extract_choice_map.py - ? docx ????????? scripts/_choice_map.json?
# ??: python scripts/extract_choice_map.py
import json, re, pathlib
from docx import Document
from docx.oxml.ns import qn

ROOT = pathlib.Path(__file__).resolve().parent.parent

def doc_seq(path):
    doc = Document(str(path))
    seq = []
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            texts = ''.join(node.text or '' for node in child.iter(qn('w:t')))
            seq.append(('p', texts))
        elif child.tag == qn('w:tbl'):
            cells = []
            for tc in child.iter(qn('w:tc')):
                t = ''.join(node.text or '' for node in tc.iter(qn('w:t'))).strip()
                if t:
                    cells.append(t)
            seq.append(('tbl', cells))
    return seq

def parse_inline(txt):
    # ?? (rule, [???]) ? None
    m = re.search(r'\u6289\u62e9(?:\uff08([^\uff09]*)\uff09)?[^\u4e3a\uff1a:]*[\uff1a:]\s*(.+)$', txt)
    if not m:
        return None
    head = m.group(1) or ''
    body = m.group(2)
    rule = 'one'
    if '\u4e24\u9879' in head or '\u4e24\u9879' in txt[:m.start()+8]:
        rule = 'two'
    if '\u4e24\u9879' in txt:
        rule = 'two'
    names = re.split(r'[/&]', body)
    names = [n.strip() for n in names if n.strip()]
    if not names:
        return None
    return rule, names

def extract_choices(path, is_general=False):
    seq = doc_seq(path)
    groups = []
    i = 0
    n = len(seq)
    pending = None  # (rule, names_or_None)
    while i < n:
        kind, txt = seq[i]
        if kind == 'p':
            s = txt.strip()
            if '\u6289\u62e9' in s:
                # ????
                inline = parse_inline(s)
                if inline:
                    rule, names = inline
                    groups.append({'rule': rule, 'skills': names})
                    pending = None
                    i += 1
                    continue
                # ??X??????????????????????
                mm = re.match(r'\u6289\u62e9([A-Z\u4e00-\u9fff]?)\u00b7.*?(\u4e00\u9879|\u4e24\u9879)\u4e60\u5f97', s)
                if mm:
                    rule = 'two' if mm.group(2) == '\u4e24\u9879' else 'one'
                    pending = {'rule': rule, 'skills': []}
                    i += 1
                    continue
        if kind == 'tbl' and pending is not None:
            name = txt[0] if txt else ''
            if name and name not in pending['skills']:
                pending['skills'].append(name)
            i += 1
            continue
        # ???????? pending??????????????
        if kind == 'p' and pending is not None:
            s = txt.strip()
            if s and set(s) <= set('-\u2014=\uff5e'):
                i += 1
                continue
        # ?????????????/?????? pending ??? -> ?? pending
        if pending is not None and pending['skills']:
            groups.append(pending)
            pending = None
        i += 1
    if pending is not None and pending['skills']:
        groups.append(pending)
    # ?????????????
    seen = set()
    out = []
    for g in groups:
        key = tuple(sorted(g['skills']))
        if key in seen:
            continue
        seen.add(key)
        out.append(g)
    return out

def main():
    files = {}
    for f in pathlib.Path(ROOT).iterdir():
        if f.is_file() and f.suffix == '.docx' and not f.name.startswith('~$') and f.name.startswith('\u57fa\u7840\u804c\u4e1a'):
            files[f.name.replace('\u57fa\u7840\u804c\u4e1a-', '').replace('.docx', '')] = f
    files['\u901a\u7528\u5929\u8d4b\u6811'] = pathlib.Path(ROOT) / '\u901a\u7528\u5929\u8d4b\u6811.docx'
    for d in ['\u795e\u5723\u9886\u57df']:
        dp = pathlib.Path(ROOT) / d
        if dp.exists():
            for f in dp.iterdir():
                if f.is_file() and f.suffix == '.docx' and not f.name.startswith('~$'):
                    files[f.name.replace('.docx', '')] = f
    result = {}
    for key, path in files.items():
        try:
            groups = extract_choices(path, is_general=('\u901a\u7528' in key))
        except Exception as e:
            print('ERR', key, e)
            continue
        if groups:
            result[key] = groups
    out = pathlib.Path(__file__).resolve().parent / '_choice_map.json'
    out.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    total = 0
    for k, gs in result.items():
        print(f'== {k}: {len(gs)} groups')
        for g in gs:
            total += len(g['skills'])
            print('   ', g['rule'], '|', ' / '.join(g['skills'])[:90])
    print('total skills in choices:', total)

if __name__ == '__main__':
    main()
