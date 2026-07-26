#!/usr/bin/env python3
"""Diff published advancement extract vs 职业页/advancement_details.js"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from published_advancement_core import EXTRACT_OUT, extract_all, load_details_js


def norm(s: str | None) -> str:
    return re.sub(r"\s+", "", s or "")


def ability_names(entry: dict) -> list[str]:
    return [a.get("name", "") for a in entry.get("abilities") or []]


def diff() -> dict:
    if EXTRACT_OUT.exists():
        extract = json.loads(EXTRACT_OUT.read_text(encoding="utf-8"))
    else:
        extract = extract_all()
    existing = {e["name"]: e for e in load_details_js()}
    new_names = []
    updated = []
    sameish = []
    incomplete = []
    missing_ability = []

    for rec in extract["records"]:
        name = rec["name"]
        if rec["incomplete"]:
            incomplete.append({"name": name, "reasons": rec["incomplete_reasons"]})
            continue
        entry = rec["entry"]
        old = existing.get(name)
        if not old:
            new_names.append(name)
            continue
        issues = []
        old_abs = set(ability_names(old))
        new_abs = set(ability_names(entry))
        if new_abs - old_abs:
            issues.append({"missing_in_js": sorted(new_abs - old_abs)})
            missing_ability.append({"name": name, "added": sorted(new_abs - old_abs)})
        if old_abs - new_abs:
            issues.append({"removed_vs_docx": sorted(old_abs - new_abs)})
        if norm(old.get("desc_html")) != norm(entry.get("desc_html")):
            issues.append("desc_html")
        old_by = {a["name"]: a for a in old.get("abilities") or []}
        for a in entry.get("abilities") or []:
            ob = old_by.get(a["name"])
            if not ob:
                continue
            if norm(ob.get("desc_html")) != norm(a.get("desc_html")):
                issues.append(f"ability:{a['name']}")
        if issues:
            updated.append({"name": name, "issues": issues[:12]})
        else:
            sameish.append(name)

    only_in_js = sorted(set(existing) - {r["name"] for r in extract["records"]})
    return {
        "new": new_names,
        "updated": updated,
        "sameish_count": len(sameish),
        "incomplete": incomplete,
        "missing_ability": missing_ability,
        "only_in_js": only_in_js,
        "summary": {
            "new": len(new_names),
            "updated": len(updated),
            "sameish": len(sameish),
            "incomplete": len(incomplete),
        },
    }


if __name__ == "__main__":
    report = diff()
    print(json.dumps(report, ensure_ascii=False, indent=2))
