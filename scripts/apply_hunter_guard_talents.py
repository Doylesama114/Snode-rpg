#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Restore 猎人 灵龟/灵猴/灵狐守护·天赋 entries from the docx.

The updated 猎人 docx keeps the linked talent side-tables as separate
paragraph blocks whose header is the plain base name (灵龟守护 etc.).
class_sync_core.sync_class() therefore removes the historical
`灵龟守护·天赋` entries.  This script re-materialises those three linked
talents (same content as the docx side-tables) in:
  - 职业页/猎人.html (article + nav link)
  - 职业页/数据/猎人.json
  - 斯诺德跑团/skill_effects_猎人.json
  - electron-app mirrors
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    build_docx_index,
    build_skill_data_attrs,
    extract_paragraphs,
    json_to_fx_entry,
    tags_from_keywords,
)
from apply_hunter_missing_extract import render_article  # noqa: E402

CLASS = "猎人"
DOCX = ROOT / "基础职业-猎人.docx"
HTML_PATH = ROOT / "职业页" / f"{CLASS}.html"
DATA_PATH = ROOT / "职业页" / "数据" / f"{CLASS}.json"
FX_PATH = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

# (docx base name, base article id, linked-talent id)
LINKED_TALENTS = (
    ("灵龟守护", "h-skill-387", "h-skill-1088"),
    ("灵猴守护", "h-skill-409", "h-skill-1089"),
    ("灵狐守护", "h-skill-428", "h-skill-1090"),
)


def talent_block(index: dict, base_name: str) -> dict:
    blocks = index.get(base_name) or []
    for block in blocks:
        if (block.get("fields") or {}).get("关键词", "").startswith("天赋"):
            return block
    raise RuntimeError(f"docx 中找不到 {base_name} 的联动天赋块")


def build_talent_skill(base_name: str, block: dict, skill_id: str) -> dict:
    kw = (block.get("fields") or {}).get("关键词", "")
    return {
        "id": skill_id,
        "name": f"{base_name}·天赋",
        "tags": tags_from_keywords(kw),
        "fields": {"关键词": kw},
        "cost": [],
        "description": list(block.get("description") or []),
        "level_upgrades": [],
        "flavor": "",
        "style": block.get("_style") or "兽群",
        "tier": "二阶",
    }


def insert_after_nth_article_close(html: str, marker: str, n: int, article: str) -> str:
    """Insert `article` right after the n-th `</article>` following marker.

    Historical pages keep the removed talent's surplus `</article>`; inserting
    before that surplus close reproduces the original article ordering.
    """
    pos = html.find(marker)
    if pos == -1:
        raise RuntimeError(f"HTML 中找不到 {marker}")
    for _ in range(n):
        pos = html.find("</article>", pos)
        if pos == -1:
            raise RuntimeError(f"{marker} 后找不到第 {n} 个 </article>")
        pos += len("</article>")
    return html[:pos] + article + html[pos:]


def add_nav_links(html: str, links: list[str]) -> str:
    anchor = '<a class="skill-link" href="#h-skill-351">倒刺射击</a>'
    if anchor not in html:
        raise RuntimeError("兽群一阶导航锚点缺失")
    return html.replace(anchor, anchor + "\n" + "\n".join(links), 1)


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")
    fx_doc = json.loads(FX_PATH.read_text(encoding="utf-8"))
    fx_arr = fx_doc.get(CLASS) or []
    fx_by_id = {entry.get("id"): i for i, entry in enumerate(fx_arr)}

    names = {s.get("name") for s in data.get("skills") or []}
    paras = extract_paragraphs(DOCX)
    index = build_docx_index(paras, names)

    restored: list[dict] = []
    nav_links: list[str] = []
    site_by_id = {s.get("id"): s for s in data.get("skills") or []}

    for base_name, base_id, talent_id in LINKED_TALENTS:
        block = talent_block(index, base_name)
        skill = build_talent_skill(base_name, block, talent_id)

        if talent_id in site_by_id:
            site_by_id[talent_id].update(skill)
        else:
            data["skills"].append(skill)
            site_by_id[talent_id] = skill
        restored.append(skill)

        # Body article: insert after the base article's second close (the
        # third historical close is the surplus one that belongs to the talent).
        if f'id="{talent_id}"' not in html:
            article = render_article(skill, block)
            html = insert_after_nth_article_close(html, f'id="{base_id}"', 2, article)

        if f'href="#{talent_id}"' not in html:
            nav_links.append(f'<a class="skill-link" href="#{talent_id}">{skill["name"]}</a>')

    if nav_links:
        html = add_nav_links(html, nav_links)

    # FX entries in the same order as the site JSON (1088, 1089, 1090 at tail).
    for skill in restored:
        entry = json_to_fx_entry(skill, CLASS)
        if skill["id"] in fx_by_id:
            fx_arr[fx_by_id[skill["id"]]] = entry
        else:
            fx_arr.append(entry)
            fx_by_id[skill["id"]] = len(fx_arr) - 1
    fx_doc[CLASS] = fx_arr

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
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

    report = {
        "restored": [
            {"id": s["id"], "name": s["name"], "style": s["style"], "tier": s["tier"]}
            for s in restored
        ],
        "json_skills": len(data["skills"]),
        "fx_entries": len(fx_arr),
        "html_articles": len(re.findall(r'<article\b', html)),
    }
    out = ROOT / "scripts" / "_hunter_guard_talents_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
