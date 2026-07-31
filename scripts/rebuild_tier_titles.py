# rebuild_tier_titles.py v2 - ??????????? h2 ? data-style ????????
# ??: python scripts/rebuild_tier_titles.py [--dry] [--apply]
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
JOBS = ROOT / '\u804c\u4e1a\u9875'
SKIP = ('\u9996\u9875.html', '\u7279\u6b8a\u4e13\u957f.html')

def strip_suffix(name):
    return name[:-2] if name.endswith('\u98ce\u683c') else name

def nav_map(html):
    out = {}
    pat = re.compile(r'<summary class="style-summary"><a href="#([^"]+)">([^<]+)</a></summary>(.*?)(?=<summary class="style-summary"|</nav>)', re.S)
    for m in pat.finditer(html):
        anchor, name = m.group(1), m.group(2).strip()
        tiers = {}
        for ta, tl in re.findall(r'<summary class="tier-summary"><a href="#([^"]+)">([^<]+)</a></summary>', m.group(3)):
            tiers[tl.strip()] = ta
        out[name] = (anchor, tiers)
        out[strip_suffix(name)] = (anchor, tiers)
    return out

def clean_tier_structure(seg):
    seg = re.sub(r'<section class="(?:style|tier)"[^>]*>', '', seg)
    seg = re.sub(r'<section class="style[^"]*"[^>]*>', '', seg)
    seg = seg.replace('</section>', '')
    seg = re.sub(r'<h3>[^<]*\u9636\u5929\u8d4b\u6811</h3>', '', seg)
    return seg

def art_info(main):
    arts = []
    pat = re.compile(r'<article class="skill[^>]*?(?:data-tier="([^"]*)"[^>]*?data-style="([^"]*)"|data-style="([^"]*)"[^>]*?data-tier="([^"]*)")')
    for m in pat.finditer(main):
        tier = m.group(1) or m.group(4) or ''
        style = m.group(2) or m.group(3) or ''
        arts.append((m.start(), m.end(), style, tier))
    return arts

def build_blocks(main, arts, nav):
    """?? [(start, end, style_name)]?style_name ????"""
    # h2 ????
    h2s = [(m.start(), m.group(1).strip()) for m in re.finditer(r'<h2>([^<]+)</h2>', main)]
    blocks = []
    if h2s:
        raw = []
        for i, (pos, name) in enumerate(h2s):
            start = pos
            # h2 ???? <section class="style"> ?????????????
            prev = main.rfind('<section class="style', 0, pos)
            if prev >= 0:
                between = main[prev:pos]
                if '</section>' not in between:
                    start = prev
            raw.append([start, h2s[i+1][0] if i+1 < len(h2s) else len(main), name])
        # ???????end = ??????? start
        for i in range(len(raw) - 1):
            raw[i][1] = raw[i+1][0]
        blocks = [(s, e, n) for s, e, n in raw]
    else:
        # ? article data-style ????
        if not arts:
            return []
        cur = arts[0][2]
        start = arts[0][0]
        for i, (s, e, style, tier) in enumerate(arts[1:], 1):
            if style != cur:
                blocks.append((start, arts[i-1][1], cur + '\u98ce\u683c'))
                cur = style
                start = s
        blocks.append((start, arts[-1][1], cur + '\u98ce\u683c'))
    return blocks

def rebuild_block(block, style_name, nav):
    if style_name not in nav:
        return None
    style_anchor, tier_anchors = nav[style_name]
    h2m = re.match(r'(\s*<h2>[^<]+</h2>)', block)
    head = h2m.group(1) if h2m else '<h2>' + style_name + '</h2>'
    rest = clean_tier_structure(block[h2m.end():] if h2m else block)
    # article ?????? data-tier?
    pat = re.compile(r'<article class="skill[^>]*?(?:data-tier="([^"]*)"[^>]*?data-style="[^"]*"|data-style="[^"]*"[^>]*?data-tier="([^"]*)")')
    cuts = [(m.start(), m.group(1) or m.group(2) or '') for m in pat.finditer(rest)]
    parts = []
    non_art = rest[:cuts[0][0]] if cuts else rest
    if cuts:
        for ci, (c, tier) in enumerate(cuts):
            end = cuts[ci+1][0] if ci+1 < len(cuts) else len(rest)
            seg = rest[c:end]
            if tier in ('', '0'):
                non_art += seg
            elif parts and parts[-1][0] == tier:
                parts[-1][1] += seg
            else:
                parts.append([tier, seg])
    out = '\n<section class="style" id="' + style_anchor + '">\n' + head + non_art
    for tier, seg in parts:
        label = (tier if tier.endswith('\u9636') else tier + '\u9636') + '\u5929\u8d4b\u6811'
        anchor = ''
        for tl, ta in tier_anchors.items():
            if tl.startswith(tier):
                anchor = ta
                break
        if not anchor:
            anchor = style_anchor + '-' + str(len(parts) + 1)
        out += '\n<section class="tier" id="' + anchor + '">\n<h3>' + label + '</h3>\n' + seg + '\n</section>'
    out += '\n</section>\n'
    return out

def process(name, dry):
    pf = JOBS / name
    html = pf.read_text(encoding='utf-8')
    nav = nav_map(html)
    mi = html.find('<main')
    mei = html.find('</main>')
    if mi < 0:
        return 0
    if mei < 0:
        mei = len(html)
    main = html[mi:mei]
    arts = art_info(main)
    blocks = build_blocks(main, arts, nav)
    h2_names = re.findall(r'<h2>([^<]+)</h2>', html)
    allow_infer = not any(n.strip() in nav for n in h2_names)
    rebuilt = []
    for s, e, sname in blocks:
        block = main[s:e]
        if sname not in nav:
            if not allow_infer:
                continue
            m = re.search(r'data-style="([^"]*)"', block)
            if m and m.group(1) + '\u98ce\u683c' in nav:
                sname = m.group(1) + '\u98ce\u683c'
            else:
                continue
        # ??
        tier_pat = re.compile(r'data-tier="([^"]*)"')
        tier_groups = []
        for m in tier_pat.finditer(block):
            tv = m.group(1)
            if tv and (not tier_groups or tier_groups[-1] != tv):
                tier_groups.append(tv)
        existing = len(re.findall(r'<h3>[^<]*\u9636\u5929\u8d4b\u6811</h3>|<section class="tier"', block))
        if existing >= len(tier_groups) and existing > 0:
            continue
        nb = rebuild_block(block, sname, nav)
        if nb:
            rebuilt.append((s, e, nb))
    if not rebuilt:
        return 0
    if dry:
        return len(rebuilt)
    for s, e, nb in reversed(rebuilt):
        main = main[:s] + nb + main[e:]
    html = html[:mi] + main + html[mei:]
    pf.write_text(html, encoding='utf-8', newline='\n')
    return len(rebuilt)

def main():
    dry = '--apply' not in sys.argv
    total = 0
    for f in sorted(JOBS.glob('*.html')):
        if f.name in SKIP or '\u8fdb\u9636' in f.name:
            continue
        c = process(f.name, dry)
        if c:
            print(f'{f.name}: rebuilt {c} blocks')
            total += c
    print('TOTAL blocks:', total, '(DRY)' if dry else '(APPLIED)')

if __name__ == '__main__':
    main()
