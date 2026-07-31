# clean_dup_tier_structure.py - ????????? div.tier ????? h2
# ??: python scripts/clean_dup_tier_structure.py [--apply]
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JOBS = ROOT / '\u804c\u4e1a\u9875'

def remove_old_tier_divs(t):
    out = t
    while True:
        m = re.search(r'<div class="tier"', out)
        if not m:
            break
        o = m.start()
        i = o
        depth = 0
        close = -1
        while True:
            nxt_open = out.find('<div', i + 4)
            nxt_close = out.find('</div>', i + 4)
            if nxt_close < 0:
                break
            if nxt_open >= 0 and nxt_open < nxt_close:
                depth += 1
                i = nxt_open
            else:
                if depth == 0:
                    close = nxt_close
                    break
                depth -= 1
                i = nxt_close
        if close < 0:
            break
        # ????????? div.tier 包裹着新 <section class="tier"> 时才删除
        inner = out[o:close]
        if '<section class="tier"' not in inner:
            break
        open_end = out.find('>', o) + 1
        seg2 = out[open_end:close]
        seg2 = re.sub(r'<h3 class="tier-title">[^<]*</h3>', '', seg2)
        seg2 = re.sub(r'<p class="tier-desc">.*?</p>', '', seg2, flags=re.S)
        out = out[:o] + seg2 + out[close + len('</div>'):]
    return out

def dedupe_h2(t):
    pat = re.compile(r'(<section class="style[^"]*"[^>]*>\s*<h2>([^<]+)</h2>)\s*<h2>\2</h2>')
    cur = t
    n = 1
    while n:
        cur, n = pat.subn(lambda m: m.group(1) + m.group(2), cur)
    return cur

def process(name, dry):
    pf = JOBS / name
    t = pf.read_text(encoding='utf-8')
    t2 = remove_old_tier_divs(t)
    t3 = dedupe_h2(t2)
    if t3 != t:
        if not dry:
            pf.write_text(t3, encoding='utf-8', newline='\n')
        return True
    return False

def main():
    dry = '--apply' not in sys.argv
    total = 0
    for f in sorted(JOBS.glob('*.html')):
        if process(f.name, dry):
            total += 1
            print(f.name, 'cleaned')
    print('TOTAL cleaned:', total, '(DRY)' if dry else '(APPLIED)')

if __name__ == '__main__':
    main()
