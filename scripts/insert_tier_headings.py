# insert_tier_headings.py v2 - ??????? div ??????????? data-tier ??????
# ??: python scripts/insert_tier_headings.py [--apply]
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
JOBS = ROOT / '\u804c\u4e1a\u9875'

def nav_map(html):
    out = {}
    pat = re.compile(r'<summary class="style-summary"><a href="#([^"]+)">([^<]+)</a></summary>(.*?)(?=<summary class="style-summary"|</nav>)', re.S)
    for m in pat.finditer(html):
        anchor, name = m.group(1), m.group(2).strip()
        tiers = {}
        for ta, tl in re.findall(r'<summary class="tier-summary"><a href="#([^"]+)">([^<]+)</a></summary>', m.group(3)):
            tiers[tl.strip()] = ta
        out[name] = tiers
        short = name[:-2] if name.endswith('\u98ce\u683c') else name
        out[short] = tiers
    return out

def heading_for(tier, anchor, style):
    label = (tier if tier.endswith('\u9636') else tier + '\u9636') + '\u5929\u8d4b\u6811'
    return '<h3 class="tier-title" data-tier="' + tier + '" id="' + anchor + '">' + label + '</h3>'

def process(name, dry):
    pf = JOBS / name
    html = pf.read_text(encoding='utf-8')
    if re.search(r'<h3[^>]*>[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+\u9636\u5929\u8d4b\u6811</h3>', html):
        return 0
    nav = nav_map(html)
    mi = html.find('<main')
    if mi < 0:
        return 0
    main = html[mi:]
    # ?????? div ????? h3
    placeholder_re = re.compile(r'<div id="([^"]+)"></div>')
    used_anchors = set()
    def repl_ph(m):
        aid = m.group(1)
        # ? nav ?????? tier
        for tiers in nav.values():
            for tl, ta in tiers.items():
                if ta == aid:
                    tier = tl.replace('\u5929\u8d4b\u6811', '')
                    used_anchors.add(aid)
                    return heading_for(tier, aid, '')
        return m.group(0)
    main2 = placeholder_re.sub(repl_ph, main)
    # ?????????? (style, tier)?? article ???
    pat = re.compile(r'<article class="skill[^>]*?(?:data-tier="([^"]*)"[^>]*?data-style="([^"]*)"|data-style="([^"]*)"[^>]*?data-tier="([^"]*)")')
    inserted = set()
    insertions = []
    for m in pat.finditer(main2):
        tier = m.group(1) or m.group(4) or ''
        style = m.group(2) or m.group(3) or ''
        if tier in ('', '0'):
            continue
        key = (style, tier)
        if key in inserted:
            continue
        inserted.add(key)
        anchor = ''
        tiers_map = nav.get(style + '\u98ce\u683c') or nav.get(style) or {}
        for tl, ta in tiers_map.items():
            if tl.startswith(tier):
                anchor = ta
                break
        if not anchor:
            anchor = style + '-' + tier
        if anchor in used_anchors:
            continue
        insertions.append((m.start(), heading_for(tier, anchor, style)))
    total = len(used_anchors) + len(insertions)
    if not total:
        return 0
    if dry:
        return total
    for pos, head in sorted(insertions, reverse=True):
        # ??????????? article ??
        if not main2[pos:pos+8] == '<article':
            print('WARN bad insert pos', name, pos, main2[pos:pos+20])
            continue
        main2 = main2[:pos] + head + main2[pos:]
    html = html[:mi] + main2
    pf.write_text(html, encoding='utf-8', newline='\n')
    return total

def main():
    dry = '--apply' not in sys.argv
    total = 0
    for f in sorted(JOBS.glob('*.html')):
        if '\u8fdb\u9636' in f.name or f.name in ('\u9996\u9875.html', '\u7279\u6b8a\u4e13\u957f.html'):
            continue
        n = process(f.name, dry)
        if n:
            print(f.name, 'inserted', n)
            total += n
    print('TOTAL:', total, '(DRY)' if dry else '(APPLIED)')

if __name__ == '__main__':
    main()
