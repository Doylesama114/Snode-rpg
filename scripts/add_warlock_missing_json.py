#!/usr/bin/env python3
"""Add HTML/docx skills missing from 术士.json (fourth-tier semantic ids)."""
import json
import re
import shutil
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from class_sync_core import (
    build_docx_index,
    cost_json,
    extract_paragraphs,
    pick_block,
    tags_from_keywords,
)

DATA = ROOT / "职业页" / "数据" / "术士.json"
HTML = ROOT / "职业页" / "术士.html"
DOCX = ROOT / "基础职业-术士.docx"

TIER_CHIP = re.compile(r"([^·]+)风格 · ([^<]+)天赋树")
ARTICLE = re.compile(
    r'<article class="skill(?: starting)?" id="([^"]+)"[^>]*>.*?<h4>([^<]+)\s*(?:<span class="chip"[^>]*>([^<]+)</span>)?',
    re.S,
)


def parse_style_tier(chip: str) -> tuple[str, str]:
    if not chip:
        return "潜能", ""
    m = TIER_CHIP.search(chip)
    if not m:
        return "潜能", ""
    return m.group(1).strip(), m.group(2).strip()


def block_to_skill_stub(sid: str, name: str, style: str, tier: str, block: dict) -> dict:
    fields = dict(block["fields"])
    if block["mark_dots"]:
        fields["标识"] = "".join("●" for _ in block["mark_dots"])
    fields.pop("费用", None)
    desc_body = [
        p for p in block["description"]
        if not p.startswith("限制：") and p.strip() != block["name"]
    ]
    if "描述" not in fields and desc_body:
        fields["描述"] = desc_body[0]
    description = desc_body[1:] if len(desc_body) > 1 else (
        [] if "描述" in fields else desc_body
    )
    if "描述" in fields and desc_body and fields["描述"] == desc_body[0]:
        description = desc_body[1:]

    return {
        "id": sid,
        "name": name,
        "tags": tags_from_keywords(fields.get("关键词", "")),
        "fields": fields,
        "cost": cost_json(block["mark_dots"]),
        "description": description,
        "level_upgrades": block["level_upgrades"],
        "flavor": block["flavor"],
        "style": style or "潜能",
        "tier": tier,
    }


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    data = json.loads(DATA.read_text(encoding="utf-8"))
    json_ids = {s["id"] for s in data["skills"]}

    html_meta = []
    for m in ARTICLE.finditer(html):
        sid, title, chip = m.group(1), m.group(2).strip(), (m.group(3) or "").strip()
        if not sid.startswith("wl-"):
            continue
        if sid in ("wl-search", "wl-filter-bar", "wl-starting-features"):
            continue
        name = title.split()[0]
        style, tier = parse_style_tier(chip)
        html_meta.append({"id": sid, "name": name, "style": style, "tier": tier})

    missing = [m for m in html_meta if m["id"] not in json_ids]
    if not missing:
        print("no missing skills")
        return

    all_names = {s["name"] for s in data["skills"]} | {m["name"] for m in missing}
    idx = build_docx_index(extract_paragraphs(DOCX), all_names)
    used: set[int] = set()
    for sk in data["skills"]:
        pick_block(idx, sk, used)

    added = []
    for meta in missing:
        block = pick_block(idx, meta, used)
        if not block:
            raise SystemExit(f"docx block not found: {meta['name']} ({meta['id']})")
        data["skills"].append(block_to_skill_stub(
            meta["id"], meta["name"], meta["style"], meta["tier"], block
        ))
        added.append(f"{meta['id']} {meta['name']}")

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(DATA, ROOT / "electron-app" / "职业页" / "数据" / "术士.json")
    print(f"added {len(added)}:")
    for line in added:
        print(f"  {line}")


if __name__ == "__main__":
    main()
