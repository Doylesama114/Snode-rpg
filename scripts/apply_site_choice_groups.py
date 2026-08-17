# -*- coding: utf-8 -*-
"""Apply scripts/site_choice_groups.json to 职业页/*.html.

Pure ID-anchored text patching; never re-renders whole pages.
Usage: python scripts/apply_site_choice_groups.py [--apply]
"""
from __future__ import annotations

import copy
import html as html_mod
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "scripts" / "site_choice_groups.json"
PAGES = ROOT / "职业页"
ELECTRON = ROOT / "electron-app" / "职业页"
BACKUP = ROOT / "备份区"

GENERAL_FAKE_IDS = [
    "g-skill-12", "g-skill-21", "g-skill-107", "g-skill-142", "g-skill-155",
    "g-skill-164", "g-skill-222", "g-skill-250", "g-skill-283", "g-skill-292",
    "g-skill-316", "g-skill-343", "g-skill-354", "g-skill-376", "g-skill-388",
    "g-skill-411", "g-skill-412",
]

# (page, skill id, exact absorbed title) -- title is also removed from data-search.
ABSORBED_TITLES = [
    ("通用天赋树.html", "g-skill-92", "抉择C·你仅能够选择其中一项习得"),
    ("通用天赋树.html", "g-skill-106", "抉择E·你仅能够选择其中一项习得"),
    ("通用天赋树.html", "g-skill-154", "抉择·你仅能够选择其中一项习得"),
    ("通用天赋树.html", "g-skill-221", "抉择J·你仅能够选择其中一项习得"),
    ("通用天赋树.html", "g-skill-353", "抉择S·你仅能够选择其中一项习得"),
    ("通用天赋树.html", "g-skill-390", "抉择T·你仅能够选择其中一项习得"),
    ("通用天赋树.html", "g-skill-405", "抉择U·你仅能够选择其中两项习得"),
    ("通用天赋树.html", "g-skill-428", "抉择N·你仅能够选择其中两项习得"),
    ("法师.html", "m-skill-1-1-1", "抉择·选择其中两项习得 ：寒冰箭/火焰箭/雷光箭/强酸箭"),
    ("法师.html", "m-skill-4-5-6", "抉择·你仅能够选择其中两项习得：善良之墙/邪恶之墙/秩序之墙/混乱之墙"),
    ("魔契师.html", "p-skill-132", "抉择·你仅能够选择其中两项习得：善良之墙/邪恶之墙/秩序之墙/混乱之墙"),
    ("猎人.html", "h-skill-692", "抉择（2）：捕熊陷阱（图纸）/焦油陷阱（图纸））/毒蛇陷阱（图纸）"),
    ("战士.html", "w-skill-6-6-1", "抉择（你仅能够选择其中两项习得）：龙卷风射击&陆行鲨之咬&天鹅之匕"),
]

REMOVE_UNLOCK_TITLES = [
    ("奇械师.html", "抉择：燃烧之手/冻结之触"),
]

# Reorder these article + nav pairs to docx order.
REORDER_PAIRS = [
    ("萨满祭司.html", [("sa-skill-99", "sa-skill-90"), ("sa-skill-99", "sa-skill-94")]),
]


def load_manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def escape_attr(s):
    return html_mod.escape(s, quote=True)


def article_span(html, sid):
    pos = html.find(f'id="{sid}"')
    if pos == -1:
        return None, None
    start = html.rfind("<article", 0, pos)
    if start == -1:
        return None, None
    end = html.find(">", start) + 1
    return start, end


def article_block_span(html, sid):
    start, tag_end = article_span(html, sid)
    if start is None:
        return None, None
    close = html.find("</article>", tag_end)
    if close == -1:
        return None, None
    return start, close + len("</article>")


def nav_link_span(html, sid):
    m = re.search(r'<a class="skill-link" href="#' + re.escape(sid) + r'">[^<]*</a>', html)
    if not m:
        return None, None
    return m.start(), m.end()


def remove_article(html, sid):
    start, end = article_block_span(html, sid)
    if start is None:
        print("WARN remove_article missing", sid)
        return html
    return html[:start] + html[end:]


def remove_nav_link(html, sid):
    start, end = nav_link_span(html, sid)
    if start is None:
        print("WARN remove_nav_link missing", sid)
        return html
    return html[:start] + html[end:]


def remove_existing_choice_notes(html):
    return re.sub(r'\s*<p class="choice-note">.*?</p>', "", html, flags=re.S)


def remove_absorbed(html, sid, title):
    start, tag_end = article_span(html, sid)
    if start is None:
        print("WARN absorbed article missing", sid)
        return html
    close = html.find("</article>", tag_end)
    if close == -1:
        return html
    close_end = close + len("</article>")
    body = html[start:close_end]
    # remove exact effect cell(s) and data-search occurrence
    needle = f'<div class="effect-cell">{title}</div>'
    body = body.replace(needle, "")
    # remove exact title from data-search attribute and collapse spaces
    def clean_search(attr):
        inner = re.search(r'data-search="([^"]*)"', attr)
        if not inner:
            return attr
        val = inner.group(1).replace(title, "")
        val = re.sub(r"\s+", " ", val).strip()
        attr = attr[: inner.start(1)] + escape_attr(val) + attr[inner.end(1):]
        return attr
    tag_open = body[: body.find(">") + 1]
    tag_open = clean_search(tag_open)
    body = tag_open + body[body.find(">") + 1 :]
    html = html[:start] + body + html[close_end:]
    return html


def remove_unlock(html, title):
    needle = f'<p class="unlock">{title}</p>'
    return html.replace(needle, "")


def swap_article_pair(html, first, second):
    a1, a2 = article_block_span(html, first)
    b1, b2 = article_block_span(html, second)
    if None in (a1, a2, b1, b2):
        print("WARN swap article missing", first, second)
        return html
    if a1 > b1:
        first, second = second, first
        a1, a2, b1, b2 = b1, b2, a1, a2
    block_a = html[a1:a2]
    block_b = html[b1:b2]
    return html[:a1] + block_b + html[a2:b1] + block_a + html[b2:]


def swap_nav_pair(html, first, second):
    a1, a2 = nav_link_span(html, first)
    b1, b2 = nav_link_span(html, second)
    if None in (a1, a2, b1, b2):
        print("WARN swap nav missing", first, second)
        return html
    if a1 > b1:
        first, second = second, first
        a1, a2, b1, b2 = b1, b2, a1, a2
    block_a = html[a1:a2]
    block_b = html[b1:b2]
    return html[:a1] + block_b + html[a2:b1] + block_a + html[b2:]


def add_data_choice(html, sid, key):
    start, tag_end = article_span(html, sid)
    if start is None:
        print("WARN add_data_choice missing article", sid)
        return html
    tag = html[start:tag_end]
    if f'data-choice="{key}"' in tag:
        return html
    tag = tag[:-1] + f' data-choice="{escape_attr(key)}">'
    return html[:start] + tag + html[tag_end:]


def add_choice_tag(html, sid, marker):
    pos = html.find(f'id="{sid}"')
    if pos == -1:
        return html
    h4 = html.find("<h4>", pos)
    h4_end = html.find("</h4>", h4)
    if h4 == -1 or h4_end == -1:
        return html
    inner = html[h4 + 4 : h4_end]
    if 'class="choice-tag"' in inner:
        return html
    span = inner.find("<span")
    badge = f'<span class="choice-tag">{escape_attr(marker)}</span> '
    if span != -1:
        inner = inner[:span] + badge + inner[span:]
    else:
        inner = inner + badge
    return html[: h4 + 4] + inner + html[h4_end:]


def append_search_title(html, sid, title):
    start, tag_end = article_span(html, sid)
    if start is None:
        return html
    tag = html[start:tag_end]
    m = re.search(r'data-search="([^"]*)"', tag)
    if not m:
        return html
    val = m.group(1)
    if title in val:
        return html
    val = (val + " " + title).strip()
    new_tag = tag[: m.start(1)] + escape_attr(val) + tag[m.end(1):]
    return html[:start] + new_tag + html[tag_end:]


def clean_trailing_choice_token(html):
    return re.sub(r'(data-search="[^"]*?)\s+抉择"', r'\1"', html)


def marker_for(group):
    title = group["title"]
    if group["page"] == "通用天赋树":
        for token in (
            "抉择A·", "抉择B·", "抉择C·", "抉择D·", "抉择E·", "抉择F·",
            "抉择G·", "抉择H·", "抉择I·", "抉择J·", "抉择K·", "抉择L·",
            "抉择M·", "抉择N·", "抉择O·", "抉择P·", "抉择Q·", "抉择R·",
            "抉择S·", "抉择T·", "抉择U·", "抉择·",
        ):
            if title.startswith(token):
                return token[:-1]
        return "抉择"
    return "⚖"


def insert_group(html, group):
    runs = group.get("runs") or []
    for ri, run in enumerate(runs):
        before = run["before"]
        ids = run["ids"]
        note_id = group["key"] if len(runs) == 1 else f'{group["key"]}-{ri + 1}'
        # content note
        start, _ = article_span(html, before)
        if start is None:
            print("WARN note before missing article", group["page"], before)
            continue
        note = chr(10) + '        <p class="choice-note" id="' + note_id + '">' + html_mod.escape(group['title']) + '</p>' + chr(10)
        if note_id not in html:
            html = html[:start] + note + html[start:]
        # mark every member in this run
        for sid in ids:
            html = add_data_choice(html, sid, group["key"])
            html = add_choice_tag(html, sid, marker_for(group))
            html = append_search_title(html, sid, group["title"])
        # nav entry before first nav link
        nav_start, _ = nav_link_span(html, before)
        if nav_start is None:
            print("WARN nav link missing", group["page"], before)
            continue
        nav = '<a class="nav-choice" href="#' + note_id + '">' + html_mod.escape(group['title']) + '</a>' + chr(10)
        if nav not in html:
            html = html[:nav_start] + nav + html[nav_start:]
    return html


def patch_page(page_file, groups):
    html = page_file.read_text(encoding="utf-8")
    # remove previous notes (all pages) then reinsert canonical notes
    html = remove_existing_choice_notes(html)
    for fname, title in REMOVE_UNLOCK_TITLES:
        if fname == page_file.name:
            html = remove_unlock(html, title)
    for fname, sid, title in ABSORBED_TITLES:
        if fname == page_file.name:
            html = remove_absorbed(html, sid, title)
    if page_file.name == "通用天赋树.html":
        for sid in GENERAL_FAKE_IDS:
            html = remove_article(html, sid)
            html = remove_nav_link(html, sid)
    for fname, pairs in REORDER_PAIRS:
        if fname == page_file.name:
            for first, second in pairs:
                html = swap_article_pair(html, first, second)
                html = swap_nav_pair(html, first, second)
    # after reordering 萨满祭司 pair, recompute that group's single run
    if page_file.name == "萨满祭司.html":
        for g in groups:
            if g["title"].startswith("抉择：急流飞浪"):
                g["runs"] = [{"before": "sa-skill-94", "ids": ["sa-skill-94", "sa-skill-99"]}]
    html = clean_trailing_choice_token(html)
    for group in groups:
        if group["page"] + ".html" == page_file.name:
            html = insert_group(html, group)
    page_file.write_text(html, encoding="utf-8", newline=chr(10))


def main():
    apply = "--apply" in sys.argv
    manifest = load_manifest()
    by_page = {}
    for g in manifest["groups"]:
        by_page.setdefault(g["page"] + ".html", []).append(g)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUP / f"choice-groups-fix-{ts}"
    if apply:
        backup_dir.mkdir(parents=True, exist_ok=True)

    changed = []
    for fname, groups in sorted(by_page.items()):
        pf = PAGES / fname
        if not pf.exists():
            print("MISSING", pf)
            continue
        print(fname, "groups", len(groups), "runs", sum(len(g.get("runs", [])) for g in groups))
        if apply:
            shutil.copy2(pf, backup_dir / fname)
            patch_page(pf, groups)
        changed.append(fname)

    if not apply:
        print("DRY RUN -- use --apply")
        return
    print("backup:", backup_dir)

    # mirror changed HTML to electron-app
    for fname in changed:
        src = PAGES / fname
        dst = ELECTRON / fname
        if dst.exists():
            shutil.copy2(src, dst)
        else:
            print("electron missing", dst)


if __name__ == "__main__":
    main()
