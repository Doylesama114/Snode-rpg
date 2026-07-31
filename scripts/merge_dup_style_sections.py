# merge_dup_style_sections.py - ???????????? section?????
# ??: python scripts/merge_dup_style_sections.py [--apply]
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JOBS = ROOT / '\u804c\u4e1a\u9875'

def find_sections(t):
    """???? style section ?? [(start, h2_text, close_end)]???? tier ???"""
    out = []
    pat = re.compile(r'<section class="style" id="[^"]+">')
    for m in pat.finditer(t):
        o = m.start()
        # ?????style ??? tier section??? section?
        i = o
        depth = 0
        close = -1
        pos = o
        while True:
            nxt_open = t.find('<section', pos + 9)
            nxt_close = t.find('</section>', pos + 9)
            if nxt_close < 0:
                break
            if nxt_open >= 0 and nxt_open < nxt_close:
                depth += 1
                pos = nxt_open
            else:
                if depth == 0:
                    close = nxt_close
                    break
                depth -= 1
                pos = nxt_close
        if close < 0:
            continue
        hm = re.search(r'<h2>([^<]+)</h2>', t[o:close])
        h2 = hm.group(1) if hm else ''
        out.append((o, close + len('</section>'), h2))
    return out

def merge(name, dry):
    pf = JOBS / name
    t = pf.read_text(encoding='utf-8')
    secs = find_sections(t)
    by_name = {}
    for o, c, h2 in secs:
        by_name.setdefault(h2, []).append((o, c))
    removals = []
    for h2, items in by_name.items():
        if len(items) < 2:
            continue
        first = items[0]
        for o, c in items[1:]:
            # ???????<section class="style"...> ? h2 ??????
            hm = re.search(r'<h2>[^<]+</h2>', t[o:c])
            seg_end = (o + hm.end()) if hm else (t.find('>', o) + 1)
            removals.append((o, seg_end, c))
    if not removals:
        return 0
    if dry:
        return len(removals)
    for o, seg_end, c in sorted(removals, reverse=True):
        t = t[:o] + t[seg_end:c] + t[c + len('</section>'):]
    pf.write_text(t, encoding='utf-8', newline='\n')
    return len(removals)

def main():
    dry = '--apply' not in sys.argv
    total = 0
    for f in sorted(JOBS.glob('*.html')):
        n = merge(f.name, dry)
        if n:
            print(f.name, 'merged', n)
            total += n
    print('TOTAL:', total, '(DRY)' if dry else '(APPLIED)')

if __name__ == '__main__':
    main()
