#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""向既有职业页安全插入新技能（窄口径）：只新增/更新指定条目，不重建整页。

用法：
  python scripts/insert_class_skills.py --class 德鲁伊 --payload xxx.json --source-file 基础职业-德鲁伊.docx
  python scripts/insert_class_skills.py --class 奇械师 --payload xxx.json \
         --source-file '10.24更新内容/基础职业-奇械师·炽擎风格(1).docx' --only-style 炽擎

行为：
- 仅为 payload 中「数据里不存在」的技能分配新 id（不改既有 id）并插入数据/页面/导航
- 所有新技能 cost 置空（新规则取消彩色成本）
- 页面：在对应风格区末尾追加缺失的阶位段与文章；导航同步
- 幂等：同名技能已存在则跳过
"""
from __future__ import annotations
import argparse, json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import class_sync_core as C  # noqa: E402


def find_balanced(html: str, start: int, tag: str) -> int:
    """返回从 start（该标签的 <）开始的闭合标签之后的位置。"""
    depth = 0
    i = start
    open_tag = '<' + tag
    close_tag = '</' + tag + '>'
    while True:
        o = html.find(open_tag, i + 1)
        c = html.find(close_tag, i + 1)
        if c < 0:
            raise SystemExit('未找到闭合标签 ' + tag)
        if 0 <= o < c:
            depth += 1
            i = o
        else:
            if depth == 0:
                return c + len(close_tag)
            depth -= 1
            i = c


def render_article(skill: dict, detail: str, data_search: str, attrs: str, color: str) -> str:
    chips = ''.join('<span class="chip">' + t + '</span>' for t in (skill.get('tags') or []))
    tier = skill.get('tier') or ''
    style = skill.get('style') or ''
    label = (style + ' · ' + tier + '天赋树') if style else tier
    return (
        '<article class="skill" id="' + skill['id'] + '" data-search="' + data_search + '"' + attrs + '>'
        '<h4>' + skill['name'] + ' <span class="chip" style="background:' + color + ';color:#fff">' + label + '</span></h4>'
        '<div class="chips">' + chips + '</div>'
        '<div class="detail">' + detail + '</div>'
        '</article>'
    )


TIER_NO = {'起始': 0, '一阶': 1, '二阶': 2, '三阶': 3, '四阶': 4, '五阶': 5, '六阶': 6, '七阶': 7, '八阶': 8}


def rebuild_nav_two_level(html: str, data: dict, anchors: dict) -> str:
    """把平铺导航改写成「风格 → 阶位 → 技能」两级（德鲁伊 div 版结构）。"""
    nav_start = html.find('<nav')
    nav_end = html.find('</nav>', nav_start) + len('</nav>')
    nav = html[nav_start:nav_end]
    tl = nav.find('<div class="tier-list">')
    tl_end = nav.find('</div>', tl) + len('</div>')
    head = nav[:tl_end]
    chunks = []
    for style, anchor in anchors.items():
        skills = [s for s in data['skills'] if (s.get('style') or '') == style]
        if not skills:
            continue
        tiers = []
        for s in skills:
            t = s.get('tier') or ''
            if t not in tiers:
                tiers.append(t)
        tiers.sort(key=lambda x: TIER_NO.get(x, 99))
        g = ['<details class="nav-group">',
             '<summary class="style-summary"><a href="#' + anchor + '-style">' + style + '风格</a></summary>']
        for t in tiers:
            g.append('<details class="nav-tier">')
            g.append('<summary class="tier-summary"><a href="#' + anchor + '-tier-' + str(TIER_NO.get(t, 0)) + '">' + t + '天赋树</a></summary>')
            for s in [x for x in skills if (x.get('tier') or '') == t]:
                g.append('<a class="skill-link" href="#' + s['id'] + '">' + s['name'] + '</a>')
            g.append('</details>')
        g.append('</details>')
        chunks.append(''.join(g))
    new_nav = head + ''.join(chunks) + '</div></nav>'
    return html[:nav_start] + new_nav + html[nav_end:]

def insert_nav_section_layout(html: str, prefix: str, style: str, data: dict) -> str:
    """section 版页面：重建指定风格的导航分组（风格 → 阶位 → 技能）。"""
    nav_start = html.find('<nav')
    nav_end = html.find('</nav>', nav_start)
    nav = html[nav_start:nav_end]
    key = '#' + prefix + '-style-' + style
    k = nav.find(key)
    if k < 0:
        return html
    g_start = nav.rfind('<details', 0, k)
    g_end = find_balanced(nav, g_start, 'details')
    skills = [s for s in data['skills'] if (s.get('style') or '') == style]
    tiers = []
    for s in skills:
        t = s.get('tier') or ''
        if t not in tiers:
            tiers.append(t)
    tiers.sort(key=lambda x: TIER_NO.get(x, 99))
    g = ['<details class="nav-group">',
         '<summary class="style-summary"><a href="' + key + '">' + style + '风格</a></summary>']
    for t in tiers:
        g.append('<details class="nav-tier">')
        g.append('<summary class="tier-summary"><a href="#' + prefix + '-tier-' + style + '-' + t + '">' + t + '天赋树</a></summary>')
        for s in [x for x in skills if (x.get('tier') or '') == t]:
            g.append('<a class="skill-link" href="#' + s['id'] + '">' + s['name'] + '</a>')
        g.append('</details>')
    g.append('</details>')
    new_nav = nav[:g_start] + ''.join(g) + nav[g_end:]
    return html[:nav_start] + new_nav + html[nav_end:]

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--class', dest='cls', required=True)
    ap.add_argument('--payload', type=Path, required=True)
    ap.add_argument('--source-file', required=True)
    ap.add_argument('--only-style', default=None)
    ap.add_argument('--clear-all-cost', action='store_true')
    ap.add_argument('--rebuild-nav', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    DATA = ROOT / '职业页' / '数据' / (args.cls + '.json')
    HTML = ROOT / '职业页' / (args.cls + '.html')
    FX = ROOT / '斯诺德跑团' / ('skill_effects_' + args.cls + '.json')
    E_DATA = ROOT / 'electron-app' / '职业页' / '数据' / (args.cls + '.json')
    E_HTML = ROOT / 'electron-app' / '职业页' / (args.cls + '.html')
    E_FX = ROOT / 'electron-app' / '斯诺德跑团' / ('skill_effects_' + args.cls + '.json')

    data = json.loads(DATA.read_text(encoding='utf-8'))
    fx = json.loads(FX.read_text(encoding='utf-8'))
    html = HTML.read_text(encoding='utf-8')
    payload = json.loads(Path(args.payload).read_text(encoding='utf-8'))
    if args.only_style:
        payload = [p for p in payload if p.get('style') == args.only_style]

    have = {s['name'] for s in data['skills']}
    todo = [p for p in payload if p['name'] not in have]
    if not todo:
        print('没有需要新增的技能'); return 0

    import collections
    prefix = collections.Counter(
        m.group(1) for s in data['skills'] for m in [re.match(r'([a-z]+)-', s['id'])] if m
    ).most_common(1)[0][0]
    nums = [int(m.group(1)) for s in data['skills'] for m in [re.search(r'-skill-(\d+)$', s['id'])] if m]
    next_no = (max(nums) if nums else 0) + 1

    # 风格→锚点（德鲁伊用拼音锚点）
    anchors = {m.group(2): m.group(1) for m in re.finditer(r'id="([^"]+)-style"[^>]*class="style"[^>]*>\s*<h2>([^<]+)风格</h2>', html)}
    tier_no = {'一阶': 1, '二阶': 2, '三阶': 3, '四阶': 4, '五阶': 5, '六阶': 6, '七阶': 7, '八阶': 8}
    is_section_layout = '<section class="tier"' in html

    # 在新技能前先把既有技能的 cost 清掉（新规则）
    cleared = 0
    for s in data['skills']:
        if args.clear_all_cost or (args.only_style and s.get('style') == args.only_style):
            if s.get('cost'):
                s['cost'] = []; cleared += 1
            (s.get('fields') or {}).pop('标识', None)

    groups = {}
    for p in todo:
        groups.setdefault((p['style'], p['tier']), []).append(p)

    report = []
    for (style, tier), items in groups.items():
        anchor = anchors.get(style)
        if not anchor and not is_section_layout:
            print('!! 未识别的风格锚点:', style); return 2
        tier_head = ''
        tier_tail = ''
        if is_section_layout:
            key = '#%s-tier-%s-%s' % (prefix, style, tier)
            if key not in html:
                tier_head = ('<section class="tier" id="%s-tier-%s-%s"><h4>%s天赋树</h4>' % (prefix, style, tier, tier))
                tier_tail = '</section>'
                insert_at = None
                sec = html.find('id="%s-style-%s"' % (prefix, style))
                if sec < 0:
                    print('!! 找不到风格区:', style); return 2
                sec_end = find_balanced(html, html.rfind('<section', 0, sec), 'section')
                insert_at = html.rfind('</section>', 0, sec_end)
            else:
                insert_at = None
        else:
            tid = '#%s-tier-%d' % (anchor, tier_no[tier])
            if tid not in html:
                tier_head = '<h3 class="tier-title" data-tier="%s" id="%s-tier-%d">%s天赋树</h3>' % (tier, anchor, tier_no[tier], tier)
                start = html.find('id="%s-style"' % anchor)
                if start < 0:
                    print('!! 找不到风格区:', style); return 2
                div_start = html.rfind('<div', 0, start)
                div_end = find_balanced(html, div_start, 'div')
                insert_at = div_end - len('</div>')
            else:
                insert_at = None

        rendered = []
        for p in items:
            sid = '%s-skill-%d' % (prefix, next_no); next_no += 1
            block = dict(name=p['name'], fields=dict(p['fields']), description=list(p.get('description') or []),
                         mark_dots=[], field_runs={}, level_upgrades=[], flavor='',
                         description_entries=[{'text': d, 'runs': []} for d in (p.get('description') or [])],
                         source_span={'start': 0, 'end': 0})
            detail = C.build_detail_html(block, {'unit_tables': [], 'roll_tables': []})
            skill = dict(id=sid, name=p['name'], tags=p.get('tags') or [], fields=dict(p['fields']),
                         cost=[], description=list(p.get('description') or []), level_upgrades=[], flavor='',
                         type=p.get('type') or '法术', style=style, tier=tier,
                         source={'kind': 'docx', 'file': args.source_file, 'para_start': 0, 'para_end': 0})
            ds = C.sanitize_data_search(C.build_data_search(block, style, tier + '天赋树', skill['tags']))
            attrs = C.build_skill_data_attrs(skill, [], args.cls)
            colors = {'荒野': '#4CAF50', '兽灵': '#8D6E63', '复苏': '#66BB6A', '月影': '#90A4AE',
                      '日怒': '#FF7043', '星辰': '#5C6BC0', '精火': '#FFA726', '炽擎': '#FF7043'}
            rendered.append(render_article(skill, detail, ds, attrs, colors.get(style, '#888')))
            data['skills'].append(skill)
            fx[args.cls].append(C.json_to_fx_entry(skill, args.cls))
            report.append((sid, p['name'], style, tier))

        chunk = (tier_head or '') + ''.join(rendered) + (tier_tail or '')
        if insert_at is None:
            # 该阶位已存在：插到该阶位最后一个 article 之后
            if is_section_layout:
                key = 'id="%s-tier-%s-%s"' % (prefix, style, tier)
                tpos = html.find(key)
            else:
                tpos = html.find('id="%s-tier-%d"' % (anchor, tier_no[tier]))
            last = html.rfind('</article>', tpos, tpos + 200000)
            insert_at = last + len('</article>')
        html = html[:insert_at] + chunk + html[insert_at:]

    if args.rebuild_nav:
        if is_section_layout:
            for st in sorted({(p.get('style') or '') for p in todo}):
                html = insert_nav_section_layout(html, prefix, st, data)
            print('导航：已重建目标风格的阶位分组')
        else:
            html = rebuild_nav_two_level(html, data, anchors)
            print('导航已改写为「风格 → 阶位」两级')
    if args.dry_run:
        print('[dry-run] 不写盘；将新增', len(report), '条')
        for r in report:
            print('  ', r[0], r[1], r[2], r[3])
        return 0
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    FX.write_text(json.dumps(fx, ensure_ascii=False, indent=2), encoding='utf-8')
    HTML.write_text(html, encoding='utf-8')
    for src, dst in ((DATA, E_DATA), (HTML, E_HTML), (FX, E_FX)):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    print('插入', len(report), '条；清除 cost', cleared, '条')
    for r in report:
        print('  ', r[0], r[1], r[2], r[3])
    return 0


if __name__ == '__main__':
    sys.exit(main())