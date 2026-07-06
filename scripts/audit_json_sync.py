#!/usr/bin/env python3
"""Audit 职业页/数据 JSON sync status."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "职业页" / "数据"
SYNCED = [
    "蛮斗士", "吟游诗人", "圣骑士", "德鲁伊", "战士", "术士", "武僧", "法师",
    "游荡者", "牧师", "猎人", "萨满祭司", "通用天赋树", "魔契师", "特殊专长",
]
META = {
    "classes", "style_mappings", "color_definitions", "level_up", "backgrounds",
    "races", "items", "equipment", "equipment_catalog", "materials", "ores",
    "herbs", "potions", "scrolls", "gadgets", "magic_services", "bg_personality",
}


def audit(path: Path) -> dict:
    d = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(d, list):
        skills = d
    else:
        skills = d.get("skills") or d.get("feats") or []
    issues: list[str] = []
    field_runs_n = 0
    desc_entries_n = 0
    for s in skills:
        f = s.get("fields") or {}
        if s.get("field_runs"):
            field_runs_n += 1
        if s.get("description_entries"):
            desc_entries_n += 1
        if "费用" in f:
            issues.append("has费用字段")
            break
        for k in f:
            if k.startswith("限制") and k != "施展限制":
                issues.append("old限制字段")
                break
    total_lu = sum(len(s.get("level_upgrades") or []) for s in skills)
    runs = sum(
        1 for s in skills for u in (s.get("level_upgrades") or []) if "line_runs" in u
    )
    return {
        "count": len(skills),
        "level_upgrades": total_lu,
        "line_runs": runs,
        "field_runs": field_runs_n,
        "description_entries": desc_entries_n,
        "issues": issues,
    }


def main() -> None:
    print("=== docx-synced modules ===")
    for name in SYNCED:
        p = ROOT / f"{name}.json"
        if not p.exists():
            print(f"  {name}: MISSING")
            continue
        r = audit(p)
        if r["issues"]:
            status = "ISSUES"
        elif r["level_upgrades"] and r["line_runs"] != r["level_upgrades"]:
            status = "PARTIAL line_runs"
        else:
            status = "OK"
        print(
            f"  {name}: n={r['count']} lu={r['level_upgrades']} "
            f"field_runs={r['field_runs']} desc_runs={r['description_entries']} "
            f"[{status}] {r['issues']}"
        )

    print("\n=== other skill JSON (no apply_*_sync) ===")
    for p in sorted(ROOT.glob("*.json")):
        name = p.stem
        if name in SYNCED or name in META or "进阶" in name:
            continue
        r = audit(p)
        note = r["issues"] or ["legacy / manual"]
        print(
            f"  {name}: n={r['count']} lu={r['level_upgrades']} "
            f"runs={r['line_runs']} {note}"
        )

    adv = sorted(ROOT.glob("*进阶.json"))
    print(f"\n=== 进阶 JSON: {len(adv)} files (advancement schema, not docx-synced) ===")
    for p in adv:
        d = json.loads(p.read_text(encoding="utf-8"))
        n = len(d.get("advancements") or d.get("skills") or [])
        print(f"  {p.stem}: entries={n}")


if __name__ == "__main__":
    main()
