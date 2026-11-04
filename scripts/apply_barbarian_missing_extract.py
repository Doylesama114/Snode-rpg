
# -*- coding: utf-8 -*-
"""Append 蛮斗士 六阶 skills from extract into site HTML/JSON/FX (barbarian layout: div.tier + Chinese ids)."""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    json_to_fx_entry,
    sanitize_data_search,
    skill_type_from_keywords,
)
from apply_class_extract import extract_to_block, extract_to_site_skill  # noqa: E402

CLASS = "蛮斗士"
PREFIX = "be"
EXTRACT = ROOT / "scripts" / "extracts" / f"{CLASS}.json"
HTML_PATH = ROOT / "职业页" / f"{CLASS}.html"
DATA_PATH = ROOT / "职业页" / "数据" / f"{CLASS}.json"
FX_PATH = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
TIER = "六阶"
TIER_N = 6
UNLOCK = (
    "职业等级12级时开启，你需要花费500点经验值来解锁这个位阶，"
    "如果你已经开启更高位阶的天赋树，那么学习以下能力还需要满足额外条件"
)


def style_color(html: str, style: str) -> str:
    m = re.search(r'data-style="%s"[^>]*>.*?background:(#[0-9A-Fa-f]{6})' % re.escape(style), html, re.S)
    if m:
        return m.group(1)
    m = re.search(r'background:(#[0-9A-Fa-f]{6})">%s风格' % re.escape(style), html)
    return m.group(1) if m else "#888888"


def chips_html(skill: dict) -> str:
    kw = (skill.get("fields") or {}).get("关键词", "")
    stype = skill_type_from_keywords(kw)
    tags = skill.get("tags") or []
    items = [stype] + [t for t in tags if t != stype]
    return "\n".join('          <span class="chip kw-chip" data-kw="%s">%s</span>' % (t, t) for t in items)


def render_article(skill: dict, block: dict, color: str) -> str:
    detail = build_detail_html(block, {
        "unit_tables": block.get("unit_tables") or [],
        "roll_tables": block.get("roll_tables") or [],
    })
    data_search = build_data_search(block, skill.get("style") or "", f"{skill.get('tier')}天赋树", skill.get("tags") or [])
    safe = sanitize_data_search(data_search)
    attrs = build_skill_data_attrs(skill, block["mark_dots"], CLASS)
    return (
        '      <article class="skill" id="%s" data-search="%s"%s>'
        '<h4>%s <span class="chip" style="background:%s">%s风格</span></h4>\n'
        '        <div class="chips">\n%s\n        </div><template class="skill-body">'
        '<div class="detail">%s</div></template></article>'
    ) % (skill["id"], safe, attrs, skill["name"], color, skill.get("style") or "", chips_html(skill), detail)


def section_end(html: str, id_attr: str) -> int:
    pos = html.find(id_attr)
    if pos == -1:
        raise ValueError("not found: " + id_attr)
    start = html.rfind("<section", 0, pos)
    depth, i, n = 0, start, len(html)
    while i < n:
        if html.startswith("<section", i):
            depth += 1
            gt = html.find(">", i)
            i = gt + 1 if gt != -1 else i + 8
            continue
        if html.startswith("</section>", i):
            depth -= 1
            i += len("</section>")
            if depth == 0:
                return i
            continue
        i += 1
    raise ValueError("unclosed section: " + id_attr)


def nav_group_end(html: str, style: str) -> int:
    pos = html.find('href="#%s-style-%s"' % (PREFIX, style))
    if pos == -1:
        raise ValueError("nav style missing: " + style)
    det_start = html.rfind('<details class="nav-group">', 0, pos)
    depth, i, n = 0, det_start, len(html)
    while i < n:
        if html.startswith("<details", i):
            depth += 1
            gt = html.find(">", i)
            i = gt + 1 if gt != -1 else i + 8
            continue
        if html.startswith("</details>", i):
            depth -= 1
            i += len("</details>")
            if depth == 0:
                return i - len("</details>")
            continue
        i += 1
    raise ValueError("nav-group end missing: " + style)


def ensure_tier_div(html: str, style: str, tier_id: str) -> str:
    if 'id="%s"' % tier_id in html:
        return html
    end = section_end(html, 'id="%s-style-%s"' % (PREFIX, style))
    close = html.rfind("</section>", 0, end)
    block = (
        '\n    <div class="tier" id="%s">\n      <h3>%s天赋树</h3>\n'
        '      <p class="unlock">%s</p>\n    </div>\n  '
    ) % (tier_id, TIER, UNLOCK)
    return html[:close] + block + html[close:]


def append_to_tier(html: str, tier_id: str, article: str) -> str:
    end = section_end(html, 'id="%s"' % tier_id)
    close = html.rfind("</div>", 0, end)
    return html[:close] + article + "\n    " + html[close:]


def ensure_nav_tier(html: str, style: str, tier_id: str, skills: list[dict]) -> str:
    href = 'href="#%s"' % tier_id
    if href in html:
        return html
    end = nav_group_end(html, style)
    lines = ['              <details class="nav-tier">',
             '                  <summary class="tier-summary"><a %s>%s天赋树</a></summary>' % (href, TIER)]
    for sk in skills:
        lines.append('                  <a class="skill-link" href="#%s">%s</a>' % (sk["id"], sk["name"]))
    lines.append("                </details>\n")
    return html[:end] + "\n".join(lines) + html[end:]


def next_id(skills: list[dict]) -> str:
    mx = 0
    for s in skills:
        m = re.match(r"^%s-skill-(\d+)$" % PREFIX, s.get("id") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return "%s-skill-%d" % (PREFIX, mx + 1)


def main() -> None:
    extract = json.loads(EXTRACT.read_text(encoding="utf-8"))
    site = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")
    fx_doc = json.loads(FX_PATH.read_text(encoding="utf-8")) if FX_PATH.exists() else {CLASS: []}
    fx_arr = fx_doc.get(CLASS) or []
    fx_ids = {e.get("id") for e in fx_arr}

    have = {(s.get("name") or "", s.get("style") or "", s.get("tier") or "") for s in site["skills"]}
    candidates = [
        ex for ex in extract["skills"]
        if (ex.get("tier") or "") == TIER
        and (ex.get("style") or "") in {"斗争", "狂暴", "生机", "法咒"}
        and (ex.get("name") or "", ex.get("style") or "", ex.get("tier") or "") not in have
    ]
    candidates.sort(key=lambda s: (s.get("style") or "", s.get("name") or ""))

    added: list[dict] = []
    for style in ["斗争", "狂暴", "生机", "法咒"]:
        group = [c for c in candidates if (c.get("style") or "") == style]
        if not group:
            continue
        tier_id = "%s-tier-%s-%d" % (PREFIX, style, TIER_N)
        color = style_color(html, style)
        html = ensure_tier_div(html, style, tier_id)
        new_skills = []
        for ex in group:
            sid = next_id(site["skills"] + added)
            skill = extract_to_site_skill(ex, sid)
            block = extract_to_block(ex)
            html = append_to_tier(html, tier_id, render_article(skill, block, color))
            site["skills"].append(skill)
            added.append(skill)
            new_skills.append(skill)
            if sid not in fx_ids:
                fx_arr.append(json_to_fx_entry(skill, CLASS))
                fx_ids.add(sid)
        html = ensure_nav_tier(html, style, tier_id, new_skills)

    fx_doc[CLASS] = fx_arr
    report = {
        "added": len(added),
        "skills": [{"id": s["id"], "name": s["name"], "style": s["style"], "tier": s["tier"]} for s in added],
        "site_skills": len(site["skills"]),
        "fx_entries": len(fx_arr),
    }
    DATA_PATH.write_text(json.dumps(site, ensure_ascii=False, indent=2), encoding="utf-8")
    HTML_PATH.write_text(html, encoding="utf-8")
    FX_PATH.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    for src, dst in [
        (HTML_PATH, ROOT / "electron-app" / "职业页" / f"{CLASS}.html"),
        (DATA_PATH, ROOT / "electron-app" / "职业页" / "数据" / f"{CLASS}.json"),
        (FX_PATH, ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json"),
    ]:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    (ROOT / "scripts" / "_barbarian_t6_apply_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
