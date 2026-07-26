# -*- coding: utf-8 -*-
"""Apply missing 战士 skills (esp. 七阶) from extract into site HTML/JSON/FX."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
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

CLASS = "战士"
EXTRACT = ROOT / "scripts" / "extracts" / f"{CLASS}.json"
HTML_PATH = ROOT / "职业页" / f"{CLASS}.html"
DATA_PATH = ROOT / "职业页" / "数据" / f"{CLASS}.json"
FX_PATH = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

STYLE_NUM = {
    "斗争": 1,
    "狂攻": 2,
    "射击": 3,
    "防护": 4,
    "军团": 5,
    "机敏": 6,
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

UNLOCK_7 = (
    "职业等级18级时开启，你需要花费1000点经验值来解锁这个位阶，"
    "如果你已经开启更高位阶的天赋树，那么学习以下能力还需要满足额外条件"
)


def skill_key(s: dict) -> tuple:
    return (s.get("name") or "", s.get("style") or "", s.get("tier") or "")


def next_slot_id(skills: list[dict], style_n: int, tier_n: int) -> str:
    pat = re.compile(rf"^w-skill-{style_n}-{tier_n}-(\d+)$")
    mx = 0
    for s in skills:
        m = pat.match(s.get("id") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return f"w-skill-{style_n}-{tier_n}-{mx + 1}"


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
    data_attrs = build_skill_data_attrs(skill, block["mark_dots"])
    return (
        f'      <article class="skill " id="{skill["id"]}" data-search="{safe}"{data_attrs}>'
        f"<h4>{skill['name']} <span class=\"chip\">{style}风格 · {tier}天赋树</span></h4>\n"
        f'        <div class="chips">{chips_html(skill)}</div>\n'
        f'        <div class="detail">{detail}</div>\n'
        f"      </article>\n"
        f"    \n"
    )


def close_section_after(html: str, id_attr: str) -> int:
    """Return index just after closing </section> of element with id_attr."""
    pos = html.find(id_attr)
    if pos == -1:
        raise ValueError(f"not found: {id_attr}")
    sec_start = html.rfind("<section", 0, pos)
    if sec_start == -1:
        raise ValueError(f"section start not found for {id_attr}")
    depth = 0
    i = sec_start
    n = len(html)
    while i < n:
        if html.startswith("<section", i):
            depth += 1
            i = html.find(">", i) + 1
            continue
        if html.startswith("</section>", i):
            depth -= 1
            i += len("</section>")
            if depth == 0:
                return i
            continue
        i += 1
    raise ValueError(f"unclosed section for {id_attr}")


def ensure_tier_section(html: str, style_n: int, tier: str, tier_n: int) -> str:
    tid = f'id="w-tier-{style_n}-{tier_n}"'
    if tid in html:
        return html
    style_id = f'id="w-style-{style_n}"'
    pos = html.find(style_id)
    if pos == -1:
        raise ValueError(f"missing style {style_n}")
    # insert before closing of style section
    end = close_section_after(html, style_id)
    close_pos = html.rfind("</section>", 0, end)
    unlock = UNLOCK_7 if tier_n == 7 else ""
    unlock_html = f'\n                  <p class="unlock">{unlock}</p>\n' if unlock else "\n"
    section = (
        f'                <section class="tier" id="w-tier-{style_n}-{tier_n}">\n'
        f"                  <h3>{tier}天赋树</h3>"
        f"{unlock_html}"
        f"                </section>\n"
        f"                \n"
    )
    return html[:close_pos] + section + html[close_pos:]


def ensure_nav_tier(html: str, style_n: int, tier: str, tier_n: int) -> str:
    href = f'href="#w-tier-{style_n}-{tier_n}"'
    if href in html:
        return html
    style_href = f'href="#w-style-{style_n}"'
    pos = html.find(style_href)
    if pos == -1:
        raise ValueError(f"nav style missing {style_n}")
    det_start = html.rfind('<details class="nav-group">', 0, pos)
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
        f'                <details class="nav-tier">\n'
        f'                  <summary class="tier-summary">'
        f'<a href="#w-tier-{style_n}-{tier_n}">{tier}天赋树</a></summary>\n'
        f"                </details>\n"
        f"                \n"
    )
    return html[:group_end] + nav + html[group_end:]


def append_skill_to_tier(
    html: str, style_n: int, tier_n: int, article: str, skill_name: str, sid: str
) -> str:
    tid = f'id="w-tier-{style_n}-{tier_n}"'
    end = close_section_after(html, tid)
    close_pos = html.rfind("</section>", 0, end)
    html = html[:close_pos] + article + html[close_pos:]

    href = f'href="#w-tier-{style_n}-{tier_n}"'
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
        if style == "战斗" or tier == "起始":
            continue
        if style not in STYLE_NUM or tier not in TIER_NUM:
            continue
        if skill_key(ex) in site_keys:
            continue
        candidates.append(ex)

    candidates.sort(
        key=lambda s: (
            STYLE_NUM.get(s.get("style") or "", 99),
            TIER_NUM.get(s.get("tier") or "", 99),
            s["name"],
        )
    )

    added = []
    for ex in candidates:
        style = ex["style"]
        tier = ex["tier"]
        style_n = STYLE_NUM[style]
        tier_n = TIER_NUM[tier]
        html = ensure_tier_section(html, style_n, tier, tier_n)
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

    if any(s.get("tier") == "七阶" for s in added):
        html = html.replace("一至六阶", "一至七阶")

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

    (ROOT / "scripts" / "_warrior_t7_apply_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
