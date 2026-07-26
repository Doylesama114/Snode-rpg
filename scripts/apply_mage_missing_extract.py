# -*- coding: utf-8 -*-
"""
Apply missing 法师 skills from scripts/extracts/法师.json into site HTML/JSON/FX.

- Skips 战斗/起始 false positives (already on site as m-starting-skill-*)
- Creates 七阶 tier sections/nav when missing
- Fixes 元素循环 if it still holds 火山术 body
- Also extends apply_class_extract allow-list for documentation consistency
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    cost_json,
    json_to_fx_entry,
    sanitize_data_search,
    skill_type_from_keywords,
    tags_from_keywords,
)
from apply_class_extract import extract_to_block, extract_to_site_skill  # noqa: E402

CLASS = "法师"
EXTRACT = ROOT / "scripts" / "extracts" / f"{CLASS}.json"
HTML_PATH = ROOT / "职业页" / f"{CLASS}.html"
DATA_PATH = ROOT / "职业页" / "数据" / f"{CLASS}.json"
FX_PATH = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

STYLE_NUM = {
    "塑能": 1,
    "咒法": 2,
    "预言": 3,
    "防护": 4,
    "附魔": 5,
    "死灵": 6,
    "幻术": 7,
    "变化": 8,
}
TIER_NUM = {
    "一阶": 1,
    "二阶": 2,
    "三阶": 3,
    "四阶": 4,
    "五阶": 5,
    "六阶": 6,
    "七阶": 7,
}
STYLE_BORDER = {
    "塑能": "#FFA387",
    "咒法": "#B3E7FF",
    "预言": "#AFFFE6",
    "防护": "#FBFF81",
    "附魔": "#D0A5FF",
    "死灵": "#FFFFFF",
    "幻术": "#FFCBFF",
    "变化": "#FFC47D",
}


def skill_key(s: dict) -> tuple:
    return (s.get("name") or "", s.get("style") or "", s.get("tier") or "")


def next_slot_id(skills: list[dict], style_n: int, tier_n: int) -> str:
    pat = re.compile(rf"^m-skill-{style_n}-{tier_n}-(\d+)$")
    mx = 0
    for s in skills:
        m = pat.match(s.get("id") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    # also scan for holes? just append
    return f"m-skill-{style_n}-{tier_n}-{mx + 1}"


def chips_html(skill: dict) -> str:
    kw = (skill.get("fields") or {}).get("关键词", "")
    stype = skill_type_from_keywords(kw)
    tags = skill.get("tags") or []
    items = [stype] + [t for t in tags if t != stype]
    return "".join(f'<span class="chip">{t}</span>' for t in items)


def render_article(skill: dict, block: dict) -> str:
    style = skill.get("style") or ""
    tier = skill.get("tier") or ""
    border = STYLE_BORDER.get(style, "#888")
    detail = build_detail_html(block)
    data_search = build_data_search(block, style, f"{tier}天赋树", skill.get("tags") or [])
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, block["mark_dots"])
    return (
        f'<article class="skill" id="{skill["id"]}" data-search="{safe}"{data_attrs}>'
        f'<h4>{skill["name"]} <span class="chip" style="background:rgba(0,0,0,0.08);border-color:{border}">'
        f"{style} · {tier}天赋树</span></h4>\n"
        f'<div class="chips">{chips_html(skill)}</div>\n'
        f'<div class="detail">{detail}</div>\n'
        f"</article>\n"
    )


def close_div_after(html: str, id_attr: str) -> int:
    pos = html.find(id_attr)
    if pos == -1:
        raise ValueError(f"not found: {id_attr}")
    div_start = html.rfind("<div", 0, pos)
    depth = 0
    i = div_start
    n = len(html)
    while i < n:
        if html.startswith("<div", i) and (i + 4 >= n or html[i + 4] in " \t\n>"):
            depth += 1
            gt = html.find(">", i)
            i = gt + 1 if gt != -1 else i + 4
            continue
        if html.startswith("</div>", i):
            depth -= 1
            i += 6
            if depth == 0:
                return i
            continue
        i += 1
    raise ValueError(f"unclosed div for {id_attr}")


def ensure_tier_section(html: str, style: str, style_n: int, tier: str, tier_n: int) -> str:
    tid = f'id="m-tier-{style_n}-{tier_n}"'
    if tid in html:
        return html
    # insert before end of style section
    style_id = f'id="m-style-{style_n}"'
    # find next section or end of content
    pos = html.find(style_id)
    if pos == -1:
        raise ValueError(f"missing style {style}")
    # find following <section class="style" or end marker
    next_sec = html.find('<section class="style"', pos + 10)
    if next_sec == -1:
        next_sec = html.find("</main>", pos)
    insert_at = next_sec
    section = (
        f'<div class="tier" id="m-tier-{style_n}-{tier_n}">\n'
        f"<h3>{tier}天赋树</h3>\n"
        f"</div>\n"
    )
    return html[:insert_at] + section + html[insert_at:]


def ensure_nav_tier(html: str, style_n: int, tier: str, tier_n: int) -> str:
    href = f'href="#m-tier-{style_n}-{tier_n}"'
    if href in html:
        return html
    # find style nav group and append before its closing </details> that closes nav-group
    style_href = f'href="#m-style-{style_n}"'
    pos = html.find(style_href)
    if pos == -1:
        raise ValueError(f"nav style missing {style_n}")
    # find nav-group details start
    det_start = html.rfind('<details class="nav-group">', 0, pos)
    # find matching close of this nav-group: walk details depth
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
        raise ValueError(f"nav-group end missing {style_n}")
    nav = (
        f'<details class="nav-tier"><summary class="tier-summary">'
        f'<a href="#m-tier-{style_n}-{tier_n}">{tier}天赋树</a></summary>\n'
        f"</details>"
    )
    return html[:group_end] + nav + html[group_end:]


def append_skill_to_tier(html: str, style_n: int, tier_n: int, article: str, skill_name: str, sid: str) -> str:
    tid = f'id="m-tier-{style_n}-{tier_n}"'
    end = close_div_after(html, tid)
    # insert article before closing </div>
    # close_div_after returns index after </div>, so back up
    close_pos = html.rfind("</div>", 0, end)
    html = html[:close_pos] + article + html[close_pos:]
    # nav link
    href = f'href="#m-tier-{style_n}-{tier_n}"'
    # find this nav-tier details block and append link before </details>
    pos = html.find(href)
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
                link = f'<a class="skill-link" href="#{sid}">{skill_name}</a>'
                # avoid duplicate
                if f'href="#{sid}"' not in html[det_start:i]:
                    html = html[:i] + link + html[i:]
                break
            i += len("</details>")
            continue
        i += 1
    return html


def overwrite_site_skill_from_extract(site_skill: dict, ex: dict) -> dict:
    """Replace fields/description/cost of an existing site skill from extract."""
    sid = site_skill["id"]
    new_sk = extract_to_site_skill(ex, sid)
    # preserve id
    new_sk["id"] = sid
    return new_sk, extract_to_block(ex)


def replace_article_in_html(html: str, sid: str, article: str) -> str:
    pat = re.compile(
        rf'<article class="skill"[^>]*id="{re.escape(sid)}"[^>]*>.*?</article>',
        re.S,
    )
    m = pat.search(html)
    if not m:
        # try with space variants
        pat2 = re.compile(
            rf'<article class="skill\s*"[^>]*id="{re.escape(sid)}"[^>]*>.*?</article>',
            re.S,
        )
        m = pat2.search(html)
    if not m:
        raise ValueError(f"article not found: {sid}")
    return html[: m.start()] + article.rstrip() + html[m.end() :]


def main() -> None:
    extract = json.loads(EXTRACT.read_text(encoding="utf-8"))
    site = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")
    fx_doc = json.loads(FX_PATH.read_text(encoding="utf-8")) if FX_PATH.exists() else {CLASS: []}
    fx_arr = fx_doc.get(CLASS) or []
    fx_by_id = {e.get("id"): i for i, e in enumerate(fx_arr)}

    site_by_key = {skill_key(s): s for s in site["skills"]}
    site_by_name_style = {(s.get("name"), s.get("style")): s for s in site["skills"]}

    # Fix 元素循环 from extract if mismatched
    fixes = []
    for ex in extract["skills"]:
        if ex.get("name") == "元素循环" and ex.get("style") == "塑能" and ex.get("tier") == "六阶":
            sk = site_by_key.get(skill_key(ex))
            if sk:
                blob = json.dumps(sk, ensure_ascii=False)
                if "召唤一个火山" in blob or "火山术" in blob:
                    new_sk, block = overwrite_site_skill_from_extract(sk, ex)
                    # replace in site list
                    for i, s in enumerate(site["skills"]):
                        if s["id"] == sk["id"]:
                            site["skills"][i] = new_sk
                            break
                    article = render_article(new_sk, block)
                    html = replace_article_in_html(html, sk["id"], article)
                    if sk["id"] in fx_by_id:
                        fx_arr[fx_by_id[sk["id"]]] = json_to_fx_entry(new_sk, CLASS)
                    else:
                        fx_arr.append(json_to_fx_entry(new_sk, CLASS))
                    fixes.append(sk["id"])
            break

    # Clean 防范箭矢 stray line from 防范阵营倾向
    for i, s in enumerate(site["skills"]):
        if s.get("name") == "防范阵营倾向":
            desc = list(s.get("description") or [])
            cleaned = [d for d in desc if d.strip() != "防范箭矢"]
            if cleaned != desc:
                s["description"] = cleaned
                # rebuild article from current skill via re-extract? just string replace in html
                html = html.replace("<p>防范箭矢</p>", "", 1)
                fixes.append("clean-防范阵营倾向")
            break

    candidates = []
    for ex in extract["skills"]:
        style = ex.get("style") or ""
        tier = ex.get("tier") or ""
        if style == "战斗" or tier == "起始":
            continue
        if not style or style not in STYLE_NUM:
            continue
        if tier not in TIER_NUM:
            continue
        if skill_key(ex) in {skill_key(s) for s in site["skills"]}:
            continue
        candidates.append(ex)

    candidates.sort(
        key=lambda s: (STYLE_NUM.get(s.get("style") or "", 99), TIER_NUM.get(s.get("tier") or "", 99), s["name"])
    )

    added = []
    for ex in candidates:
        style = ex["style"]
        tier = ex["tier"]
        style_n = STYLE_NUM[style]
        tier_n = TIER_NUM[tier]
        html = ensure_tier_section(html, style, style_n, tier, tier_n)
        html = ensure_nav_tier(html, style_n, tier, tier_n)
        sid = next_slot_id(site["skills"] + added, style_n, tier_n)
        skill = extract_to_site_skill(ex, sid)
        block = extract_to_block(ex)
        article = render_article(skill, block)
        html = append_skill_to_tier(html, style_n, tier_n, article, skill["name"], sid)
        site["skills"].append(skill)
        added.append(skill)
        if sid not in fx_by_id:
            fx_arr.append(json_to_fx_entry(skill, CLASS))
            fx_by_id[sid] = len(fx_arr) - 1

    # subtitle: ensure 七阶 mentioned if we added any
    if any(s.get("tier") == "七阶" for s in added):
        for old, new in (
            ("一至六阶", "一至七阶"),
            ("一~六阶", "一~七阶"),
            ("1-6阶", "1-7阶"),
        ):
            if old in html:
                html = html.replace(old, new)

    fx_doc[CLASS] = fx_arr
    report = {
        "fixes": fixes,
        "added": len(added),
        "names": [{"id": s["id"], "style": s["style"], "tier": s["tier"], "name": s["name"]} for s in added],
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

    (ROOT / "scripts" / "_mage_missing_apply_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
