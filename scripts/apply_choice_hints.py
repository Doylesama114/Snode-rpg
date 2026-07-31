# apply_choice_hints.py - ???? HTML/??????????????
# ??: python scripts/apply_choice_hints.py [--dry] [--apply]
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP = json.loads((pathlib.Path(__file__).resolve().parent / '_choice_map.json').read_text(encoding='utf-8'))

PAGE_ALIAS = {
    '\u541f\u6e38\u8bd7\u4eba': ['\u541f\u6e38\u8bd7\u4eba.html'],
    '\u5723\u9a91\u58eb': ['\u5723\u9a91\u58eb.html'],
    '\u5947\u68b0\u5e08': ['\u5947\u68b0\u5e08.html'],
    '\u5fb7\u9c81\u4f0a': ['\u5fb7\u9c81\u4f0a.html'],
    '\u6218\u58eb': ['\u6218\u58eb.html'],
    '\u672f\u58eb': ['\u672f\u58eb.html'],
    '\u6b66\u50e7': ['\u6b66\u50e7.html'],
    '\u6cd5\u5e08': ['\u6cd5\u5e08.html'],
    '\u6e38\u8361\u8005': ['\u6e38\u8361\u8005.html'],
    '\u730e\u4eba': ['\u730e\u4eba.html'],
    '\u8428\u6ee1\u796d\u53f8': ['\u8428\u6ee1\u796d\u53f8.html'],
    '\u9b54\u5951\u5e08': ['\u9b54\u5951\u5e08.html'],
    '\u901a\u7528\u5929\u8d4b\u6811': ['\u901a\u7528\u5929\u8d4b\u6811.html'],
    '\u795e\u5723\u9886\u57df-\u6218\u4e89\u4e0e\u8c0b\u7565\u4e4b\u795e': ['\u7267\u5e08.html'],
    '\u795e\u5723\u9886\u57df-\u7231\u3001\u6fc0\u60c5\u4e0e\u6b22\u6109\u4e4b\u795e': ['\u7267\u5e08.html'],
    '\u795e\u5723\u9886\u57df-\u77e5\u8bc6\u4e0e\u667a\u6167\u4e4b\u795e': ['\u7267\u5e08.html'],
}

def clean_name(s):
    s = s.strip()
    s = s.replace('\uff09\uff09', '\uff09')  # ?????
    s = s.replace('\uff09)', '\uff09')
    return s

def skill_names(page_html):
    out = {}
    for m in re.finditer(r'<article class="skill\s*" id="([^"]+)"[^>]*>(.*?)</article>', page_html, re.S):
        sid = m.group(1)
        body = m.group(2)
        h4 = re.search(r'<h4>(.*?)</h4>', body, re.S)
        if not h4:
            continue
        h4inner = h4.group(1)
        # ??? = h4 ? span ????????????????
        span = re.search(r'<span', h4inner)
        name = h4inner[:span.start()] if span else h4inner
        name = re.sub(r'<[^>]+>', '', name).strip()
        # ???????/???? 123. ???
        name = re.sub(r'^\s*\d+\.\s*', '', name)
        out[name] = sid
        # ?????????????????
        alt = re.sub(r'\uff08\u56fe\u7eb8\uff09', '', name)
        if alt != name:
            out.setdefault(alt, sid)
    return out

def build_peer_text(group, self_name):
    peers = [clean_name(x) for x in group['skills'] if clean_name(x) != self_name]
    rule = group.get('rule', 'one')
    if rule == 'two':
        return '\u2696 \u6289\u62e9\uff1a\u4e0e\u300c' + '\u300d\u300c'.join(peers) + '\u300d\u5e76\u5217\uff08\u53ea\u80fd\u9009\u62e9\u5176\u4e2d\u4e24\u9879\u4e60\u5f97\uff09'
    if len(peers) == 1:
        return '\u2696 \u6289\u62e9\uff1a\u4e0e\u300c' + peers[0] + '\u300d\u4e8c\u9009\u4e00\uff08\u53ea\u80fd\u9009\u62e9\u5176\u4e2d\u4e00\u9879\u4e60\u5f97\uff09'
    return '\u2696 \u6289\u62e9\uff1a\u4e0e\u300c' + '\u300d\u300c'.join(peers) + '\u300d\u5e76\u5217\uff08\u53ea\u80fd\u9009\u62e9\u5176\u4e2d\u4e00\u9879\u4e60\u5f97\uff09'

def apply_to_page(page_file, groups, dry=True):
    html = page_file.read_text(encoding='utf-8')
    names = skill_names(html)
    matched = 0
    unmatched = []
    for g in groups:
        for raw in g['skills']:
            name = clean_name(raw)
            # ????
            cand = [name]
            if '\u56fe\u7eb8' in name:
                cand.append(re.sub(r'\uff08\u56fe\u7eb8\uff09', '', name))
            else:
                cand.append(name + '\uff08\u56fe\u7eb8\uff09')
            if '\u914d\u65b9' in name:
                pass
            else:
                cand.append(name + '\uff08\u914d\u65b9\uff09')
            if '\u4fa6\u67e5' in name:
                cand.append(name.replace('\u4fa6\u67e5', '\u4fa6\u6d4b'))
            if name == '\u5929\u9e45\u4e4b\u5315':
                cand.append('\u5929\u9e45\u6e56\u4e4b\u5315')
            sid = None
            for c in cand:
                if c in names:
                    sid = names[c]
                    break
            if not sid:
                unmatched.append(raw)
                continue
            matched += 1
            if dry:
                continue
            # ????
            art_re = re.compile(r'(<article class="skill\s*" id="' + re.escape(sid) + r'"[^>]*>.*?<div class="detail">)(.*?)(</div>\s*</article>)', re.S)
            def repl(m):
                head, detail, tail = m.group(1), m.group(2), m.group(3)
                if '\u6289\u62e9' in detail:
                    return m.group(0)
                choice = '<div class="choice">' + build_peer_text(g, name) + '</div>'
                return head + choice + detail + tail
            html2, n = art_re.subn(repl, html, count=1)
            if n:
                html = html2
            # data-search ????
            def add_kw(m):
                if '\u6289\u62e9' in m.group(2):
                    return m.group(0)
                return m.group(1) + (m.group(2) + (' ' if m.group(2) else '') + '\u6289\u62e9') + m.group(3)
            html = re.sub(
                r'(<article class="skill\s*" id="' + re.escape(sid) + r'"[^>]*data-search=")([^"]*)(")',
                add_kw, html, count=1)
    if not dry:
        page_file.write_text(html, encoding='utf-8', newline='\n')
    return matched, unmatched

def main():
    dry = '--dry' in sys.argv or '--apply' not in sys.argv
    jobs = pathlib.Path(ROOT) / '\u804c\u4e1a\u9875'
    total_m = 0
    total_u = []
    for key, pages in PAGE_ALIAS.items():
        groups = MAP.get(key)
        if not groups:
            continue
        for page_name in pages:
            pf = jobs / page_name
            if not pf.exists():
                print('MISSING PAGE', pf)
                continue
            m, u = apply_to_page(pf, groups, dry=dry)
            total_m += m
            total_u += [(key, x) for x in u]
            print(f'{page_name}: matched {m}/{sum(len(g["skills"]) for g in groups)}' + (f'  unmatched: {u}' if u else ''))
    print('TOTAL matched:', total_m)
    if total_u:
        print('UNMATCHED:', total_u)
    print('DRY RUN' if dry else 'APPLIED')

if __name__ == '__main__':
    main()
