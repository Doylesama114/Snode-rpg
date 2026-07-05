#!/usr/bin/env python3
"""Inject data-tags / data-marks onto skill articles from 职业页/数据/*.json."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from class_sync_core import build_skill_data_attrs, marks_from_cost

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "职业页" / "数据"
HTML_DIR = ROOT / "职业页"
ELECTRON_HTML = ROOT / "electron-app" / "职业页"

SKIP_JSON = {
    "classes.json",
    "races.json",
    "backgrounds.json",
    "items.json",
    "equipment.json",
    "equipment_catalog.json",
    "level_up.json",
    "bg_personality.json",
    "advancement_data.json",
}

DATA_ATTR_KEYS = ("data-tags", "data-type", "data-tier", "data-style", "data-marks", "data-mark-count")


def html_for_json(name: str) -> Path:
    stem = name.replace(".json", "")
    return HTML_DIR / f"{stem}.html"


def strip_data_attrs(tag: str) -> str:
    for key in DATA_ATTR_KEYS:
        tag = re.sub(rf'\s+{re.escape(key)}="[^"]*"', "", tag)
    return tag


def patch_article_tag(html: str, skill_id: str, attrs: str) -> tuple[str, bool]:
    pattern = re.compile(
        rf'(<article\s+[^>]*\bid="{re.escape(skill_id)}"[^>]*)>',
        re.IGNORECASE,
    )
    changed = False

    def repl(m: re.Match) -> str:
        nonlocal changed
        tag = strip_data_attrs(m.group(1))
        changed = True
        return f"{tag}{attrs}>"

    new_html, n = pattern.subn(repl, html, count=1)
    return new_html, changed and n > 0


def inject_from_skills(html: str, skills: list[dict]) -> tuple[str, int]:
    updated = 0
    for skill in skills:
        sid = skill.get("id")
        if not sid:
            continue
        attrs = build_skill_data_attrs(skill, marks_from_cost(skill))
        html, ok = patch_article_tag(html, sid, attrs)
        if ok:
            updated += 1
    return html, updated


def main() -> None:
    reports = []
    for json_path in sorted(DATA_DIR.glob("*.json")):
        if json_path.name in SKIP_JSON or json_path.name.endswith("_data.json"):
            continue
        html_path = html_for_json(json_path.name)
        if not html_path.exists():
            continue
        data = json.loads(json_path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            continue
        skills = data.get("skills")
        if not skills:
            continue
        html = html_path.read_text(encoding="utf-8")
        html, count = inject_from_skills(html, skills)
        html_path.write_text(html, encoding="utf-8")
        electron_path = ELECTRON_HTML / html_path.name
        if electron_path.parent.exists():
            electron_path.write_text(html, encoding="utf-8")
        reports.append({"page": html_path.name, "skills": len(skills), "patched": count})

    print(json.dumps({"pages": len(reports), "details": reports}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
