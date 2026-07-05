#!/usr/bin/env python3
"""Add HTML/docx skills missing from 德鲁伊.json."""
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

DATA = ROOT / "职业页" / "数据" / "德鲁伊.json"
HTML = ROOT / "职业页" / "德鲁伊.html"
DOCX = ROOT / "基础职业-德鲁伊.docx"

TIER_MAP = {"一阶": "一阶天赋树", "二阶": "二阶天赋树", "三阶": "三阶天赋树", "四阶": "四阶天赋树"}
ARTICLE = re.compile(
    r'<article class="skill(?: starting)?" id="(d-[^"]+)"[^>]*>.*?<h4>([^<]+)\s*(?:<span class="chip"[^>]*>([^<]+)</span>)?',
    re.S,
)
STYLE_H2 = re.compile(r'<h2>([^<]+)风格</h2>')


def style_at(html: str, pos: int) -> str:
    h2s = list(STYLE_H2.finditer(html))
    style = "荒野"
    for m in h2s:
        if m.start() < pos:
            style = m.group(1).strip()
        else:
            break
    return style


def tier_from_chip(chip: str) -> str:
    chip = (chip or "").strip()
    return TIER_MAP.get(chip, chip + "天赋树" if chip and "天赋树" not in chip else chip)


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
        "style": style,
        "tier": tier,
    }


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    data = json.loads(DATA.read_text(encoding="utf-8"))
    json_ids = {s["id"] for s in data["skills"]}

    html_meta = []
    for m in ARTICLE.finditer(html):
        sid, title, chip = m.group(1), m.group(2).strip(), (m.group(3) or "").strip()
        if sid.startswith("d-starting-"):
            continue
        name = title.split()[0]
        style = style_at(html, m.start())
        tier = tier_from_chip(chip)
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

    by_id = {s["id"]: s for s in data["skills"]}
    order = [m["id"] for m in html_meta]
    added = []
    for meta in missing:
        block = pick_block(idx, meta, used)
        if not block:
            raise SystemExit(f"docx block not found: {meta['name']} ({meta['id']})")
        stub = block_to_skill_stub(
            meta["id"], meta["name"], meta["style"], meta["tier"], block
        )
        by_id[meta["id"]] = stub
        added.append(f"{meta['id']} {meta['name']}")

    start_order = [s["id"] for s in data["skills"] if s["id"].startswith("d-starting-")]
    data["skills"] = [by_id[sid] for sid in start_order + order]

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(DATA, ROOT / "electron-app" / "职业页" / "数据" / "德鲁伊.json")
    print(f"added {len(added)}:")
    for line in added:
        print(f"  {line}")


if __name__ == "__main__":
    main()
