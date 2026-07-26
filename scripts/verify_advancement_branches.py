#!/usr/bin/env python3
"""Verify 牧师/魔契师 pathway branches from 《基础职业进阶途径》.docx."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from advancement_sync_core import (
    ADV_PAGE,
    EXPECTED_PRIEST_BRANCHES,
    EXPECTED_WARLOCK_BRANCHES,
    parse_docx,
)

sys.stdout.reconfigure(encoding="utf-8")


def main() -> int:
    errors: list[str] = []
    parsed = parse_docx()

    priest = parsed.get("牧师") or []
    warlock = parsed.get("魔契师") or []

    p_branches = []
    for c in priest:
        b = c.get("branch")
        if not b:
            errors.append(f"牧师 card missing branch: {c.get('name')}")
        elif b not in p_branches:
            p_branches.append(b)
    if tuple(p_branches) != EXPECTED_PRIEST_BRANCHES:
        errors.append(f"牧师 branches={p_branches} want {list(EXPECTED_PRIEST_BRANCHES)}")
    if any(c.get("name") == "圣堂刺客" and c.get("branch") == "天父" for c in priest) is False:
        errors.append("牧师 天父 missing 圣堂刺客")

    w_branches = []
    for c in warlock:
        b = c.get("branch")
        if not b:
            errors.append(f"魔契师 card missing branch: {c.get('name')}")
        elif b not in w_branches:
            w_branches.append(b)
    if tuple(w_branches) != EXPECTED_WARLOCK_BRANCHES:
        errors.append(f"魔契师 branches={w_branches} want {list(EXPECTED_WARLOCK_BRANCHES)}")
    if any(c.get("name") == "守护骑士" and c.get("branch") == "纯白圣女" for c in warlock) is False:
        errors.append("魔契师 纯白圣女 missing 守护骑士")

    # per-branch sizes
    from collections import Counter
    pc = Counter(c["branch"] for c in priest if c.get("branch"))
    wc = Counter(c["branch"] for c in warlock if c.get("branch"))
    if any(n < 9 or n > 10 for n in pc.values()):
        errors.append(f"牧师 expected 9–10 cards/branch, got {dict(pc)}")
    if any(n != 8 for n in wc.values()):
        errors.append(f"魔契师 expected 8 cards/branch, got {dict(wc)}")

    # HTML presence
    priest_html = (ADV_PAGE / "牧师·进阶.html").read_text(encoding="utf-8")
    warlock_html = (ADV_PAGE / "魔契师·进阶.html").read_text(encoding="utf-8")
    for br in EXPECTED_PRIEST_BRANCHES:
        if f'data-branch="{br}"' not in priest_html:
            errors.append(f"牧师 HTML missing branch {br}")
    for br in EXPECTED_WARLOCK_BRANCHES:
        if f'data-branch="{br}"' not in warlock_html:
            errors.append(f"魔契师 HTML missing branch {br}")
    if "branch-filter" not in priest_html or "branch-filter" not in warlock_html:
        errors.append("missing branch-filter toolbar")
    if "adv-branch-filter-script" not in priest_html:
        errors.append("牧师 missing branch filter script")
    if "神祇分支" not in priest_html and "个神祇分支" not in priest_html:
        errors.append("牧师 subtitle missing 神祇分支")
    if "宗主分支" not in warlock_html and "个宗主分支" not in warlock_html:
        errors.append("魔契师 subtitle missing 宗主分支")

    pjson = json.loads((ADV_PAGE / "数据" / "牧师·进阶.json").read_text(encoding="utf-8"))
    class_only = [a for a in pjson["advancements"] if a.get("branch")]
    if len(class_only) != len(priest):
        errors.append(f"牧师 JSON branched={len(class_only)} parse={len(priest)}")

    # Advisor sample
    adv = json.loads((Path(__file__).resolve().parent.parent / "advisor" / "advancements.json").read_text(encoding="utf-8"))
    by = {a["name"]: a for a in adv.get("advancements") or []}
    oracle = by.get("神谕使者")
    if oracle:
        brs = oracle.get("branches") or []
        if "天父" not in brs or len(brs) < 5:
            errors.append(f"advisor 神谕使者 branches={brs} expect multi priest branches")
    saint = by.get("守护骑士")
    if saint and "纯白圣女" not in (saint.get("branches") or []):
        # may also appear on priest pages without branch if ingested from other class first
        if not (saint.get("branches") or []):
            errors.append("advisor 守护骑士 missing branches")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("PASS")
    print(json.dumps({
        "priest_cards": len(priest),
        "priest_branches": p_branches,
        "warlock_cards": len(warlock),
        "warlock_branches": w_branches,
        "priest_per_branch": dict(pc),
        "warlock_per_branch": dict(wc),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
