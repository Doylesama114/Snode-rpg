# -*- coding: utf-8 -*-
"""Audit: JSON expected colored mark dots vs rendered HTML colored spans."""
import json, re, sys, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATADIR = os.path.join(ROOT, u'\u804c\u4e1a\u9875', u'\u6570\u636e')
PAGEDIR = os.path.join(ROOT, u'\u804c\u4e1a\u9875')
DOT = u'\u25cf'
SKIP = {'首页.html', '_monk_test_top.html'}

def load_skills(path):
    d = json.load(io.open(path, encoding='utf-8'))
    if isinstance(d, dict):
        sk = d.get('skills') or []
        if not sk and isinstance(d.get('domains'), dict):
            sk = [s for dom in d['domains'].values() for s in dom.get('skills', [])]
        return sk
    return d

def expected_colored(skills):
    total = 0
    per = []
    for s in skills:
        n = 0
        fields = s.get('fields') or {}
        fr = s.get('field_runs') or {}
        for k, v in fields.items():
            if k == u'\u6807\u8bc6' or not isinstance(v, str):
                continue
            for r in fr.get(k) or []:
                if r.get('color') and DOT in r.get('text', ''):
                    n += r['text'].count(DOT)
        for e in s.get('description_entries') or []:
            for r in e.get('runs') or []:
                if r.get('color') and DOT in r.get('text', ''):
                    n += r['text'].count(DOT)
        for c in s.get('cost') or []:
            if isinstance(c, dict):
                n += int(c.get('count') or 1)
            else:
                n += 1
        for lu in s.get('level_upgrades') or []:
            for r in lu.get('line_runs') or []:
                if r.get('color') and DOT in r.get('text', ''):
                    n += r['text'].count(DOT)
        if n:
            per.append((s.get('id'), s.get('name'), n))
        total += n
    return total, per

def actual_colored(html):
    body = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.S)
    body = re.sub(r'<style[^>]*>.*?</style>', '', body, flags=re.S)
    return len(re.findall(r'<span[^>]*style="[^"]*color:[^"]*"[^>]*>' + DOT + r'</span>', body))

def main():
    problems = 0
    for fn in sorted(os.listdir(PAGEDIR)):
        if not fn.endswith('.html') or fn in SKIP:
            continue
        stem = fn[:-5]
        data_paths = [os.path.join(DATADIR, stem + '.json')]
        if stem == u'\u7267\u5e08':
            data_paths.append(os.path.join(DATADIR, u'\u7267\u5e08\u00b7\u795e\u5723\u9886\u57df.json'))
        skills = []
        ok_paths = []
        for p in data_paths:
            if os.path.exists(p):
                skills.extend(load_skills(p))
                ok_paths.append(os.path.basename(p))
        if not skills:
            continue
        exp, per = expected_colored(skills)
        html = io.open(os.path.join(PAGEDIR, fn), encoding='utf-8-sig').read()
        act = actual_colored(html)
        status = 'OK' if act >= exp else 'LOW'
        if act < exp:
            problems += 1
        print('%s: expected=%d actual=%d %s (%s)' % (fn, exp, act, status, ','.join(ok_paths)))
        if act < exp:
            for pid, pname, pn in per[:20]:
                print('    -', pid, pname, pn)
    print('pages with color loss:', problems)
    sys.exit(1 if problems else 0)

if __name__ == '__main__':
    main()