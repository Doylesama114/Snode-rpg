#!/usr/bin/env python3
"""One-shot: extract 已公布进阶职业.docx → upsert advancement_details.js → advisor + electron."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from published_advancement_core import (
    EXTRACT_OUT,
    ROOT,
    extract_all,
    load_details_js,
    refresh_detail_buttons,
    sync_electron_details,
    upsert_details,
    write_details_js,
)


def rebuild_advisor_skills() -> dict:
    proc = subprocess.run(
        ["node", str(ROOT / "scripts" / "build-advisor-advancement-skills.mjs")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if proc.returncode != 0:
        print(proc.stdout, file=sys.stderr)
        print(proc.stderr, file=sys.stderr)
        raise RuntimeError("build-advisor-advancement-skills.mjs failed")
    skills = json.loads((ROOT / "advisor" / "advancement_skills.json").read_text(encoding="utf-8"))
    return {
        "documented_count": skills.get("meta", {}).get("documentedCount"),
        "log_tail": (proc.stdout or "").strip().splitlines()[-5:],
    }


def main() -> dict:
    extract = extract_all()
    EXTRACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    EXTRACT_OUT.write_text(json.dumps(extract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    existing = load_details_js()
    merged, upsert_report = upsert_details(extract, existing)
    write_details_js(merged)

    buttons = refresh_detail_buttons({e["name"] for e in merged})
    copied = sync_electron_details()
    advisor = rebuild_advisor_skills()

    report = {
        "extract": {
            "count": extract["count"],
            "complete": len(extract["complete_names"]),
            "incomplete": extract["incomplete_names"],
        },
        "upsert": upsert_report,
        "buttons": buttons,
        "electron_copied": len(copied),
        "advisor": advisor,
        "details_total": len(merged),
    }
    report_path = Path(__file__).resolve().parent / "_published_advancement_sync_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == "__main__":
    main()
