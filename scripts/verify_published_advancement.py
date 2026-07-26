#!/usr/bin/env python3
"""Verify published advancement pipeline outputs."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from published_advancement_core import (
    DETAILS_JS,
    ELECTRON_ADV,
    EXTRACT_OUT,
    ROOT,
    extract_all,
    load_details_js,
)

EXPECTED_NEW = {
    "武器大师", "旗手", "圣洁骑士", "耀阳德鲁伊", "凤凰术士", "巨龙术士",
    "秀逗魔导士", "奥术师", "卷轴学者", "近卫", "高阶冒险者", "战斗大师",
    "战地医师", "塑形者", "离群野兽", "魔剑士", "狮心骑士", "牧魂人",
    "丰收祭司", "骑兵", "自然行者", "利爪德鲁伊",
}
EXPECTED_UPDATED_SPOT = {
    "斗士": ["无畏斗志"],
    "蝰蛇": ["血循破坏"],
}


def main() -> int:
    errors: list[str] = []
    extract = extract_all() if not EXTRACT_OUT.exists() else json.loads(
        EXTRACT_OUT.read_text(encoding="utf-8")
    )
    # refresh extract if stale
    if extract.get("count") != 50:
        extract = extract_all()

    if extract["count"] != 50:
        errors.append(f"extract count={extract['count']} want 50")
    if extract.get("incomplete_names") != ["冰霜法师"]:
        errors.append(f"incomplete={extract.get('incomplete_names')} want [冰霜法师]")
    if len(extract.get("complete_names", [])) != 49:
        errors.append(f"complete={len(extract.get('complete_names', []))} want 49")

    details = load_details_js()
    names = {e["name"] for e in details}
    if len(details) < 49:
        errors.append(f"details count={len(details)} want >=49")
    missing_new = sorted(EXPECTED_NEW - names)
    if missing_new:
        errors.append(f"missing NEW in details: {missing_new}")

    by = {e["name"]: e for e in details}
    for adv, ab_names in EXPECTED_UPDATED_SPOT.items():
        if adv not in by:
            errors.append(f"missing updated spot {adv}")
            continue
        have = {a["name"] for a in by[adv].get("abilities") or []}
        for an in ab_names:
            if an not in have:
                errors.append(f"{adv} missing ability {an}")
        # 斗士 numeric spot-check
        if adv == "斗士":
            desc = next(
                (a.get("desc_html") or "" for a in by[adv]["abilities"] if a["name"] == "无畏斗志"),
                "",
            )
            if "+10" not in desc and "＋10" not in desc:
                errors.append("斗士.无畏斗志 expected +10 in docx sync")

    skills_path = ROOT / "advisor" / "advancement_skills.json"
    skills = json.loads(skills_path.read_text(encoding="utf-8"))
    doc_count = skills.get("meta", {}).get("documentedCount")
    if doc_count is None:
        # fallback: count documented entries
        entries = skills.get("advancements") or skills.get("skills") or []
        if isinstance(entries, dict):
            doc_count = sum(1 for v in entries.values() if (v.get("confidence") == "documented"))
        else:
            doc_count = skills.get("meta", {}).get("count")
    if not doc_count or doc_count < 49:
        # try alternate meta keys
        alt = skills.get("meta", {})
        doc_count = alt.get("documentedCount") or alt.get("documented") or 0
    if doc_count < 49:
        errors.append(f"advisor documentedCount={doc_count} want >=49")

    electron_details = ELECTRON_ADV / "advancement_details.js"
    if not electron_details.exists():
        errors.append("electron advancement_details.js missing")
    elif electron_details.read_text(encoding="utf-8") != DETAILS_JS.read_text(encoding="utf-8"):
        errors.append("electron advancement_details.js out of sync")

    # spot: 战士·进阶 should have detail-btn for 武器大师
    warrior = (ROOT / "职业页" / "战士·进阶.html").read_text(encoding="utf-8")
    if 'data-adv-name="武器大师"' not in warrior and "武器大师" in warrior:
        if 'data-name="武器大师"' in warrior and "查看详情" not in warrior.split('data-name="武器大师"', 1)[1][:800]:
            errors.append("战士·进阶 武器大师 still locked")
    if 'data-adv-name="武器大师"' not in warrior:
        # may live on another class page — check any
        found = False
        for p in (ROOT / "职业页").glob("*·进阶.html"):
            if 'data-adv-name="武器大师"' in p.read_text(encoding="utf-8"):
                found = True
                break
        if not found:
            errors.append("no page has detail-btn for 武器大师")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("PASS")
    print(json.dumps({
        "details": len(details),
        "incomplete": extract["incomplete_names"],
        "documented": doc_count,
        "new_present": len(EXPECTED_NEW & names),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
