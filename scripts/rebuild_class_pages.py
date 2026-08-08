# -*- coding: utf-8 -*-
"""Rebuild 4 class pages (content+nav) from corrected JSON using canonical builders."""
import json, re, sys, io, shutil
from docx import Document
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

SCRIPTS = r'D:\Download\scholar-agent-main\scripts'
sys.path.insert(0, SCRIPTS)
from class_sync_core import (
    build_detail_html, build_data_search, append_tables_to_search,
    sanitize_data_search, build_skill_data_attrs, tier_label_from_skill,
)
from apply_class_extract import extract_to_block, chips_html

ROOT = u'D:\\Download\\scholar-agent-main'
TIER_ORDER = [u'\u4e00\u9636', u'\u4e8c\u9636', u'\u4e09\u9636', u'\u56db\u9636', u'\u4e94\u9636', u'\u516d\u9636', u'\u4e03\u9636']  # 一..七阶
def is_starting(skill):
    return str(skill.get('type')) == 'starting' or str(skill.get('tier')) == '起始特性'
SEP = re.compile(r'^-{3,}$')

def esc(t):
    return (t or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def tier_unlocks(docx_path):
    doc = Document(docx_path)
    paras = doc.paragraphs
    out = {}
    for i, p in enumerate(paras):
        t = p.text.strip()
        if t[:2] in TIER_ORDER and u'\u5929\u8d4b\u6811' in t:
            for j in range(i + 1, min(i + 6, len(paras))):
                nt = paras[j].text.strip()
                if nt and not SEP.match(nt):
                    out[t[:2]] = nt
                    break
    return out

def extract_after_h2(head, h2_text):
    """Return the text of the first <p> after an <h2> containing h2_text."""
    i = head.find('<h2>' + h2_text + '</h2>')
    if i == -1:
        # try h2 with attributes
        m = re.search(r'<h2[^>]*>' + re.escape(h2_text) + r'</h2>', head)
        if not m:
            return ''
        i = m.start()
    m = re.search(r'<p[^>]*>(.*?)</p>', head[i:], re.S)
    if not m:
        return ''
    return re.sub(r'<[^>]+>', '', m.group(1)).strip()

def chip_info(head):
    """Build style->chip attr map and starting chip attr from HEAD regular chips."""
    style_attr = {}
    starting_attr = None
    for m in re.finditer(r'<h4>[^<]+ <span class="chip" style="([^"]*)">([^<]*)</span>', head):
        attr, label = m.group(1), m.group(2)
        if u'\u8d77\u59cb\u7279\u6027' in label and starting_attr is None:
            starting_attr = attr
            continue
        if u'\u5929\u8d4b\u6811' in label:
            style = label.split(u'\u98ce\u683c')[0].strip()  # before 风格
            if style and style not in style_attr:
                style_attr[style] = attr
    return style_attr, starting_attr

def build_article(skill, class_name, chip_attr):
    ref = skill.get('reference_to')
    if ref:
        style = skill.get('style') or ''
        tier_lbl = tier_label_from_skill(skill)
        tags = skill.get('tags') or []
        data_search = ' '.join([skill['name'], style, tier_lbl, ' '.join(tags), u'效果见「' + ref + u'」条目'])
        safe = sanitize_data_search(data_search)
        attr_skill = skill
        if is_starting(skill) and str(skill.get('type')) != 'starting':
            attr_skill = dict(skill)
            attr_skill['type'] = 'starting'
        attrs = build_skill_data_attrs(attr_skill, [], class_name)
        if is_starting(skill):
            chip_label = '起始特性'
        else:
            chip_label = u'%s风格 · %s' % (style, tier_lbl)
        chips = ''.join('<span class="chip">%s</span>' % esc(t) for t in tags[:6])
        return ('      <article class="skill" id="%s" data-search="%s"%s>'
                '<h4>%s <span class="chip" style="%s">%s</span></h4>\n'
                '        <div class="chips">%s</div>\n'
                '        <div class="detail"><div class="note-cell">%s「%s」%s。</div></div>\n'
                '      </article>') % (
                    esc(skill['id']), safe, attrs, esc(skill['name']), chip_attr, esc(chip_label),
                    chips, u'效果见', esc(ref), u'条目')
    block = extract_to_block(skill)
    # ?? cost ????????? apply_skill_tables_html ???
    mark_dots = []
    for c in block.get('mark_dots') or []:
        if isinstance(c, dict):
            mark_dots.extend([c['color']] * int(c.get('count') or 1))
        else:
            mark_dots.append(c)
    block['mark_dots'] = mark_dots
    if mark_dots:
        block['fields'][u'标识'] = u'●' * len(mark_dots)
    style = skill.get('style') or ''
    starting = is_starting(skill)
    attr_skill = skill
    if starting and str(skill.get('type')) != 'starting':
        attr_skill = dict(skill)
        attr_skill['type'] = 'starting'
    tier_lbl = tier_label_from_skill(attr_skill)
    tables = {'unit_tables': skill.get('unit_tables') or [], 'roll_tables': skill.get('roll_tables') or []}
    detail = build_detail_html(block, tables)
    data_search = build_data_search(block, style, tier_lbl, skill.get('tags') or [])
    data_search = append_tables_to_search(data_search, block)
    safe = sanitize_data_search(data_search)
    attrs = build_skill_data_attrs(attr_skill, block['mark_dots'], class_name)
    if starting:
        chip_label = u'\u8d77\u59cb\u7279\u6027'
    else:
        chip_label = u'%s\u98ce\u683c \u00b7 %s' % (style, tier_lbl)
    return ('      <article class="skill" id="%s" data-search="%s"%s>'
            '<h4>%s <span class="chip" style="%s">%s</span></h4>\n'
            '        <div class="chips">%s</div>\n'
            '        <div class="detail">%s</div>\n'
            '      </article>') % (
                esc(skill['id']), safe, attrs, esc(skill['name']), chip_attr, esc(chip_label),
                chips_html(skill), detail)

def main():
    classes = sys.argv[1:]
    for cls in classes:
        print('rebuilding', cls)
        json_path = ROOT + u'\\\u804c\u4e1a\u9875\\\u6570\u636e\\' + cls + u'.json'
        html_path = ROOT + u'\\\u804c\u4e1a\u9875\\' + cls + u'.html'
        elec_html = ROOT + u'\\electron-app\\\u804c\u4e1a\u9875\\' + cls + u'.html'
        docx_path = ROOT + u'\\\u57fa\u7840\u804c\u4e1a-' + cls + u'.docx'
        data = json.load(io.open(json_path, encoding='utf-8'))
        skills = data['skills'] if isinstance(data, dict) else data
        head = io.open(html_path, encoding='utf-8-sig').read()
        main_start = head.find('<main')
        main_end = head.find('</main>') + len('</main>')
        if main_start < 0 or main_end < len('</main>'):
            raise SystemExit('main tags not found for ' + cls)
        head_part = head[:main_start]
        tail = head[main_end:]
        aria = re.search(r'<nav aria-label="([^"]+)"', head).group(1)
        filter_id = re.search(r'id="([a-z]+-filter-bar)"', head).group(1)
        prefix = filter_id.split('-')[0]
        adv = re.search(r'<a class="adv-link"[^>]*>.*?</a>', head, re.S)
        adv_html = adv.group(0) if adv else ''
        unlock = tier_unlocks(docx_path)
        style_attr, starting_attr = chip_info(head)
        if starting_attr is None:
            starting_attr = 'background:#888'
        starting_intro = extract_after_h2(head, u'\u8d77\u59cb\u7279\u6027')
        if not starting_intro:
            starting_intro = u'\u4f60\u53ef\u4ee5\u4ece\u4ee5\u4e0b\u8d77\u59cb\u7279\u6027\u4e2d\u9009\u62e9\u4e24\u9879\u52a0\u5165\u4f60\u7684\u6280\u80fd\u6216\u5929\u8d4b\u5217\u8868\uff1a'

        starting_skills = [s for s in skills if is_starting(s)]
        regular = [s for s in skills if not is_starting(s)]
        styles = []
        seen = set()
        for s in regular:
            st = s.get('style') or ''
            if st and st not in seen:
                seen.add(st)
                styles.append(st)

        # ---- nav ----
        nav = ['<nav aria-label="%s">' % esc(aria), '  <div class="nav-inner">']
        nav.append('  <div class="filter-bar" id="%s"></div>' % filter_id)
        nav.append('  <a class="style-link" href="#%s-starting-features">%s</a>' % (prefix, u'\u8d77\u59cb\u7279\u6027'))
        if adv_html:
            nav.append(adv_html)
        tl = ['  <div class="tier-list">']
        for s in starting_skills:
            tl.append('    <a class="skill-link" href="#%s">%s</a>' % (esc(s['id']), esc(s['name'])))
        tl.append('  </div>')
        nav.append(''.join(tl))
        for st in styles:
            tiers = [t for t in TIER_ORDER if any(s.get('tier') == t and s.get('style') == st for s in regular)]
            nav.append('  <details class="nav-group">')
            nav.append('    <summary class="style-summary"><a href="#%s-style-%s">%s%s</a></summary>' % (prefix, esc(st), esc(st), u'\u98ce\u683c'))
            for t in tiers:
                nav.append('    <details class="nav-tier">')
                nav.append('      <summary class="tier-summary"><a href="#%s-tier-%s-%s">%s%s</a></summary>' % (prefix, esc(st), esc(t), esc(t), u'\u5929\u8d4b\u6811'))
                links = ['      <a class="skill-link" href="#%s">%s</a>' % (esc(s['id']), esc(s['name'])) for s in regular if s.get('style') == st and s.get('tier') == t]
                nav.append(''.join(links))
                nav.append('    </details>')
            nav.append('  </details>')
        nav.append('  </div>')
        nav.append('</nav>')

        # ---- content ----
        parts = ['<div class="content">']
        parts.append('  <div id="%s-empty" class="empty hidden">%s</div>' % (prefix, u'\u6ca1\u6709\u627e\u5230\u5339\u914d\u7684\u5185\u5bb9\u3002'))
        parts.append('  <section class="style starting" id="%s-starting-features">' % prefix)
        parts.append('    <h2>%s</h2>' % u'\u8d77\u59cb\u7279\u6027')
        parts.append('    <p class="intro">%s</p>' % esc(starting_intro))
        for s in starting_skills:
            parts.append(build_article(s, cls, starting_attr))
        parts.append('  </section>')
        for st in styles:
            intro = extract_after_h2(head, st + u'\u98ce\u683c')
            parts.append('  <section class="style" id="%s-style-%s">' % (prefix, esc(st)))
            parts.append('    <h2>%s%s</h2>' % (esc(st), u'\u98ce\u683c'))
            if intro:
                parts.append('    <p class="intro">%s</p>' % esc(intro))
            for t in TIER_ORDER:
                group = [s for s in regular if s.get('style') == st and s.get('tier') == t]
                if not group:
                    continue
                parts.append('    <section class="tier" id="%s-tier-%s-%s">' % (prefix, esc(st), esc(t)))
                parts.append('      <h3>%s%s</h3>' % (esc(t), u'\u5929\u8d4b\u6811'))
                unlock_text = unlock.get(t) or u'\u804c\u4e1a\u7b49\u7ea71\u7ea7\u65f6\u5f00\u542f'
                parts.append('      <p class="unlock">%s</p>' % esc(unlock_text))
                for s in group:
                    attr = style_attr.get(st, 'background:rgba(0,0,0,0.08)')
                    parts.append(build_article(s, cls, attr))
                parts.append('    </section>')
            parts.append('  </section>')
        parts.append('</div>')

        new_html = head_part + '<main>\n' + '\n'.join(nav) + '\n' + '\n'.join(parts) + '\n</main>' + tail
        # ?? </html> ??????????HEAD ???
        idx = new_html.find('</html>')
        if idx != -1:
            new_html = new_html[:idx + 7].rstrip() + '\n'
        with io.open(html_path, 'w', encoding='utf-8') as f:
            f.write(new_html)
        shutil.copyfile(html_path, elec_html)
        print('  written', cls, 'articles', len(skills), 'styles', len(styles))

if __name__ == '__main__':
    main()