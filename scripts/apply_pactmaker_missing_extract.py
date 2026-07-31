# -*- coding: utf-8 -*-
"""Apply missing 魔契师 skills (三阶补遗 + 五阶) from extract into site HTML/JSON/FX."""
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

CLASS = "魔契师"
EXTRACT = ROOT / "scripts" / "extracts" / f"{CLASS}.json"
HTML_PATH = ROOT / "职业页" / f"{CLASS}.html"
DATA_PATH = ROOT / "职业页" / "数据" / f"{CLASS}.json"
FX_PATH = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

STYLE_ORDER = ["魔契", "邪念", "咒能", "秘术"]
TIER_NUM = {
    "一阶": 1,
    "二阶": 2,
    "三阶": 3,
    "四阶": 4,
    "五阶": 5,
    "六阶": 6,
    "七阶": 7,
}
TIER_CN = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七"}
UNLOCK_5 = (
    "职业等级9级时开启，你需要花费300点经验值来解锁这个位阶，"
    "如果你已经开启更高位阶的天赋树，那么学习以下能力还需要满足额外条件"
)


def skill_key(s: dict) -> tuple:
    return (s.get("name") or "", s.get("style") or "", s.get("tier") or "")


def next_flat_id(skills: list[dict]) -> str:
    mx = 0
    for s in skills:
        m = re.match(r"^p-skill-(\d+)$", s.get("id") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return f"p-skill-{mx + 1}"


def chips_html(skill: dict) -> str:
    kw = (skill.get("fields") or {}).get("关键词", "")
    stype = skill_type_from_keywords(kw)
    tags = skill.get("tags") or []
    items = [stype] + [t for t in tags if t != stype]
    return "".join(f'<span class="chip">{t}</span>' for t in items)


def render_article(skill: dict, block: dict) -> str:
    style = skill.get("style") or ""
    tier = skill.get("tier") or ""
    detail = build_detail_html(block)
    data_search = build_data_search(block, style, f"{tier}天赋树", skill.get("tags") or [])
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, block["mark_dots"], CLASS)
    return (
        f'      <article class="skill" id="{skill["id"]}" data-search="{safe}"{data_attrs}>'
        f'<h4>{skill["name"]} <span class="chip" style="background:#888">{style} · {tier}</span></h4>\n'
        f'        <div class="chips">{chips_html(skill)}</div>\n'
        f'        <div class="detail">{detail}</div>\n'
        f"      </article>\n"
    )


def tier_id(style: str, tier_n: int) -> str:
    return f'id="p-tier-{style}-{TIER_CN[tier_n]}"'


def find_style_content_end(html: str, style: str) -> int:
    """Index of next style section or end of content after this style starts."""
    style_id = f'id="p-style-{style}"'
    pos = html.find(style_id)
    if pos == -1:
        raise ValueError(f"missing style {style}")
    next_sec = html.find('<section class="style"', pos + 10)
    if next_sec == -1:
        next_sec = html.find("</main>", pos)
    if next_sec == -1:
        raise ValueError(f"cannot find end of style {style}")
    return next_sec


def ensure_tier_section(html: str, style: str, tier: str, tier_n: int) -> str:
    tid = tier_id(style, tier_n)
    if tid in html:
        return html
    insert_at = find_style_content_end(html, style)
    unlock = f'<p class="unlock">{UNLOCK_5}</p>' if tier_n == 5 else ""
    section = (
        f'<div class="tier-section" {tid}>'
        f'<h3 class="tier-title">{tier}天赋树</h3>{unlock}</div>\n'
    )
    return html[:insert_at] + section + html[insert_at:]


def ensure_nav_tier(html: str, style: str, tier: str, tier_n: int) -> str:
    href = f'href="#p-tier-{style}-{TIER_CN[tier_n]}"'
    if href in html:
        return html
    style_href = f'href="#p-style-{style}"'
    pos = html.find(style_href)
    if pos == -1:
        raise ValueError(f"nav style missing {style}")
    det_start = html.rfind('<details class="nav-group">', 0, pos)
    if det_start == -1:
        det_start = html.rfind("<details", 0, pos)
    depth = 0
    i = det_start
    n = len(html)
    group_end = None
    while i < n:
        if html.startswith("<details", i):
            depth += 1
            i = html.find(">", i) + 1
            continue
        if html.startswith("</details>", i):
            depth -= 1
            i += len("</details>")
            if depth == 0:
                group_end = i - len("</details>")
                break
            continue
        i += 1
    if group_end is None:
        raise ValueError(f"nav-group end missing {style}")
    nav = (
        f'<details class="nav-tier"><summary class="tier-summary">'
        f'<a href="#p-tier-{style}-{TIER_CN[tier_n]}">{tier}天赋树</a></summary>\n'
        f"</details>\n"
    )
    return html[:group_end] + nav + html[group_end:]


def find_tier_insert_pos(html: str, style: str, tier_n: int) -> int:
    """Insert articles just before the next tier-section or next style after this tier header."""
    tid = tier_id(style, tier_n)
    pos = html.find(tid)
    if pos == -1:
        raise ValueError(f"missing tier {tid}")
    # start searching after this tier-section's closing </div>
    after_header = html.find("</div>", pos)
    if after_header == -1:
        raise ValueError(f"tier header not closed {tid}")
    search_from = after_header + len("</div>")
    style_end = find_style_content_end(html, style)
    next_tier = html.find('<div class="tier-section"', search_from)
    if next_tier != -1 and next_tier < style_end:
        return next_tier
    return style_end


def append_skill_to_tier(
    html: str, style: str, tier_n: int, article: str, skill_name: str, sid: str
) -> str:
    insert_at = find_tier_insert_pos(html, style, tier_n)
    html = html[:insert_at] + article + html[insert_at:]

    href = f'href="#p-tier-{style}-{TIER_CN[tier_n]}"'
    pos = html.find(href)
    if pos == -1:
        return html
    det_start = html.rfind("<details", 0, pos)
    depth = 0
    i = det_start
    n = len(html)
    while i < n:
        if html.startswith("<details", i):
            depth += 1
            i = html.find(">", i) + 1
            continue
        if html.startswith("</details>", i):
            depth -= 1
            if depth == 0:
                link = f'<a class="skill-link" href="#{sid}">{skill_name}</a>\n'
                if f'href="#{sid}"' not in html[det_start:i]:
                    html = html[:i] + link + html[i:]
                break
            i += len("</details>")
            continue
        i += 1
    return html


def main() -> None:
    extract = json.loads(EXTRACT.read_text(encoding="utf-8"))
    site = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")
    fx_doc = json.loads(FX_PATH.read_text(encoding="utf-8")) if FX_PATH.exists() else {CLASS: []}
    fx_arr = fx_doc.get(CLASS) or []
    fx_by_id = {e.get("id"): i for i, e in enumerate(fx_arr)}

    site_keys = {skill_key(s) for s in site["skills"]}
    candidates = []
    for ex in extract["skills"]:
        style = ex.get("style") or ""
        tier = ex.get("tier") or ""
        if style == "战斗" or tier in ("起始", "起始特性"):
            continue
        if style not in STYLE_ORDER or tier not in TIER_NUM:
            continue
        if skill_key(ex) in site_keys:
            continue
        candidates.append(ex)

    candidates.sort(
        key=lambda s: (
            STYLE_ORDER.index(s["style"]) if s["style"] in STYLE_ORDER else 99,
            TIER_NUM.get(s.get("tier") or "", 99),
            s["name"],
        )
    )

    added = []
    for ex in candidates:
        style = ex["style"]
        tier = ex["tier"]
        tier_n = TIER_NUM[tier]
        html = ensure_tier_section(html, style, tier, tier_n)
        html = ensure_nav_tier(html, style, tier, tier_n)
        sid = next_flat_id(site["skills"] + added)
        skill = extract_to_site_skill(ex, sid)
        block = extract_to_block(ex)
        article = render_article(skill, block)
        html = append_skill_to_tier(html, style, tier_n, article, skill["name"], sid)
        site["skills"].append(skill)
        added.append(skill)
        if sid not in fx_by_id:
            fx_arr.append(json_to_fx_entry(skill, CLASS))
            fx_by_id[sid] = len(fx_arr) - 1

    if any(s.get("tier") == "五阶" for s in added):
        html = re.sub(r"一至[二三四五六七]阶", "一至五阶", html, count=1)

    fx_doc[CLASS] = fx_arr
    report = {
        "added": len(added),
        "names": [
            {"id": s["id"], "style": s["style"], "tier": s["tier"], "name": s["name"]}
            for s in added
        ],
        "site_skills": len(site["skills"]),
        "fx_entries": len(fx_arr),
    }

    DATA_PATH.write_text(json.dumps(site, ensure_ascii=False, indent=2), encoding="utf-8")
    HTML_PATH.write_text(html, encoding="utf-8")
    FX_PATH.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    pairs = [
        (HTML_PATH, ROOT / "electron-app" / "职业页" / f"{CLASS}.html"),
        (DATA_PATH, ROOT / "electron-app" / "职业页" / "数据" / f"{CLASS}.json"),
        (FX_PATH, ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json"),
    ]
    for src, dst in pairs:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    (ROOT / "scripts" / "_pactmaker_t5_apply_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
