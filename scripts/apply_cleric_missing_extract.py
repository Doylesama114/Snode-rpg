# -*- coding: utf-8 -*-
"""
Apply missing 牧师 skills from scripts/extracts/牧师.json into site HTML/JSON/FX.

专为「五阶新增技能」设计：
- 跳过 extractor 把起始特性识别为 战斗/起始 的条目（站点已有 pr-skill-1..4）
- 为缺失的五阶创建 tier 区块与导航（戒律/虔佑/魂谒）
- 更新 HTML / 职业页/数据/牧师.json / skill_effects_牧师.json + electron 镜像
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(ROOT / "scripts"))

from apply_class_extract import extract_to_block, extract_to_site_skill  # noqa: E402
from class_sync_core import (  # noqa: E402
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    json_to_fx_entry,
    sanitize_data_search,
    skill_type_from_keywords,
    tags_from_keywords,
)

CLASS = "牧师"
EXTRACT = ROOT / "scripts" / "extracts" / f"{CLASS}.json"
HTML_PATH = ROOT / "职业页" / f"{CLASS}.html"
DATA_PATH = ROOT / "职业页" / "数据" / f"{CLASS}.json"
FX_PATH = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

STYLE_ORDER = ["戒律", "虔佑", "魂谒"]
TIER = "五阶"
TIER_LABEL = "五阶天赋树"


def skill_key(s: dict) -> tuple:
    return (s.get("name") or "", s.get("style") or "", s.get("tier") or "")


def next_skill_id(skills: list[dict]) -> str:
    mx = 0
    for s in skills:
        m = re.match(r"^pr-skill-(\d+)$", s.get("id") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return f"pr-skill-{mx + 1}"


def chips_html(skill: dict) -> str:
    kw = (skill.get("fields") or {}).get("关键词", "")
    stype = skill_type_from_keywords(kw)
    tags = skill.get("tags") or []
    items = [stype] + [t for t in tags if t != stype]
    return "".join(f'<span class="chip">{t}</span>' for t in items)


def render_article(skill: dict, block: dict) -> str:
    style = skill.get("style") or ""
    tier = skill.get("tier") or ""
    tables = {
        "unit_tables": block.get("unit_tables") or [],
        "roll_tables": block.get("roll_tables") or [],
    }
    detail = build_detail_html(block, tables)
    data_search = build_data_search(block, style, TIER_LABEL, skill.get("tags") or [])
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, block["mark_dots"], CLASS)
    return (
        f'<article class="skill" id="{skill["id"]}" data-search="{safe}"{data_attrs}>'
        f'<h4>{skill["name"]} <span class="chip" style="background:#888">{style}风格 · {tier}天赋树</span></h4>\n'
        f'<div class="chips">{chips_html(skill)}</div>\n'
        f'<div class="detail">{detail}</div>\n'
        f"</article>\n"
    )


def style_bounds(html: str, style: str) -> tuple[int, int]:
    marker = f'id="pr-style-{style}"'
    start = html.find(marker)
    if start == -1:
        raise ValueError(f"missing style {style}")
    next_style = html.find('<section class="style"', start + 10)
    end = next_style if next_style != -1 else html.find("</main>", start)
    if end == -1:
        end = len(html)
    return start, end


def ensure_tier_section(html: str, style: str) -> str:
    start, end = style_bounds(html, style)
    segment = html[start:end]
    tid = f'id="pr-tier-{TIER}"'
    if tid in segment:
        return html
    section = (
        f'<section class="tier" {tid}>\n'
        f"<h3>{TIER_LABEL}</h3>\n"
        f"</section>\n"
    )
    return html[:end] + section + html[end:]


def find_matching_close(html: str, open_pos: int, tag: str) -> int:
    depth = 0
    open_tag = f"<{tag}"
    close_tag = f"</{tag}>"
    i = open_pos
    n = len(html)
    while i < n:
        if html.startswith(open_tag, i) and (i + len(open_tag) >= n or html[i + len(open_tag)] in " \t\n>"):
            depth += 1
            gt = html.find(">", i)
            i = gt + 1 if gt != -1 else i + len(open_tag)
            continue
        if html.startswith(close_tag, i):
            depth -= 1
            i += len(close_tag)
            if depth == 0:
                return i
            continue
        i += 1
    raise ValueError(f"unclosed {tag} at {open_pos}")


def append_article_to_style_tier(html: str, style: str, article: str) -> str:
    start, end = style_bounds(html, style)
    segment = html[start:end]
    tid = f'id="pr-tier-{TIER}"'
    pos = segment.find(tid)
    if pos == -1:
        raise ValueError(f"missing tier {TIER} in {style}")
    open_pos = start + segment.rfind("<section", 0, pos)
    close_abs = find_matching_close(html, open_pos, "section")
    insert_at = close_abs - len("</section>")
    return html[:insert_at] + article + html[insert_at:]


def nav_group_bounds(html: str, style: str) -> tuple[int, int]:
    style_href = f'href="#pr-style-{style}"'
    style_pos = html.find(style_href)
    if style_pos == -1:
        raise ValueError(f"nav style missing {style}")
    group_start = html.rfind('<details class="nav-group">', 0, style_pos)
    if group_start == -1:
        raise ValueError(f"nav group start missing {style}")
    depth = 0
    i = group_start
    n = len(html)
    while i < n:
        if html.startswith("<details", i):
            depth += 1
            i = html.find(">", i) + 1
            continue
        if html.startswith("</details>", i):
            depth -= 1
            i += len("</details>")
            if depth == 0:
                return group_start, i
            continue
        i += 1
    raise ValueError(f"nav group end missing {style}")


def ensure_nav_tier(html: str, style: str) -> str:
    gs, ge = nav_group_bounds(html, style)
    group = html[gs:ge]
    href = f'href="#pr-tier-{TIER}"'
    if href in group:
        return html
    nav = (
        f'<details class="nav-tier">\n'
        f'<summary class="tier-summary"><a href="#pr-tier-{TIER}">{TIER_LABEL}</a></summary>\n'
        f"</details>\n"
    )
    return html[:ge - len("</details>")] + nav + html[ge - len("</details>"):]


def append_nav_link(html: str, style: str, sid: str, name: str) -> str:
    gs, ge = nav_group_bounds(html, style)
    group = html[gs:ge]
    href = f'href="#pr-tier-{TIER}"'
    pos = group.find(href)
    if pos == -1:
        raise ValueError(f"nav tier missing after insert {style}")
    det_start = group.rfind("<details", 0, pos)
    close_rel = find_matching_close(group, det_start, "details")
    close_abs = gs + close_rel - len("</details>")
    link = f'<a class="skill-link" href="#{sid}">{name}</a>'
    if f'href="#{sid}"' not in group[det_start:close_rel]:
        html = html[:close_abs] + link + html[close_abs:]
    return html


def main() -> None:
    extract = json.loads(EXTRACT.read_text(encoding="utf-8"))
    site = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")
    fx_doc = json.loads(FX_PATH.read_text(encoding="utf-8")) if FX_PATH.exists() else {CLASS: []}

    existing = {skill_key(s) for s in site["skills"]}
    candidates = []
    for ex in extract["skills"]:
        if ex.get("tier") == "起始" or ex.get("style") == "战斗":
            continue
        if not ex.get("style") or ex.get("style") not in STYLE_ORDER:
            continue
        if ex.get("tier") != TIER:
            continue
        if skill_key(ex) in existing:
            continue
        candidates.append(ex)

    candidates.sort(key=lambda s: (STYLE_ORDER.index(s.get("style") or ""), s.get("name") or ""))
    if not candidates:
        print("no missing skills")
        return

    added = []
    for ex in candidates:
        style = ex.get("style")
        sid = next_skill_id(site["skills"] + added)
        skill = extract_to_site_skill(ex, sid)
        skill["type"] = "skill"
        skill["style"] = style
        skill["tier"] = TIER
        block = extract_to_block(ex)
        article = render_article(skill, block)

        html = ensure_tier_section(html, style)
        html = ensure_nav_tier(html, style)
        html = append_article_to_style_tier(html, style, article)
        html = append_nav_link(html, style, sid, skill["name"])
        site["skills"].append(skill)
        added.append(skill)
        print(f"added {sid} {skill['name']} ({style})")

    # 保持起始在前，其余按 ID 顺序
    def sort_key(s: dict) -> tuple:
        m = re.match(r"pr-skill-(\d+)", s.get("id") or "")
        if m:
            return (0, int(m.group(1)))
        return (1, s.get("id") or "")

    site["skills"].sort(key=sort_key)
    DATA_PATH.write_text(json.dumps(site, ensure_ascii=False, indent=2), encoding="utf-8")
    HTML_PATH.write_text(html, encoding="utf-8")

    fx_entries = [json_to_fx_entry(s, CLASS) for s in site["skills"]]
    fx_doc[CLASS] = fx_entries
    FX_PATH.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    pairs = [
        (HTML_PATH, ROOT / "electron-app" / "职业页" / f"{CLASS}.html"),
        (DATA_PATH, ROOT / "electron-app" / "职业页" / "数据" / f"{CLASS}.json"),
        (FX_PATH, ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json"),
    ]
    for src, dst in pairs:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    report = {
        "added": len(added),
        "names": [{"id": s["id"], "style": s["style"], "tier": s["tier"], "name": s["name"]} for s in added],
        "site_skills": len(site["skills"]),
        "fx_entries": len(fx_entries),
    }
    (ROOT / "scripts" / "_cleric_missing_apply_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
