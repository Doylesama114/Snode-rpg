#!/usr/bin/env python3
"""Apply advancement sync from 《基础职业进阶途径》.docx."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from advancement_sync_core import DOCX, sync_advancements

ROOT = Path(__file__).resolve().parent.parent


def rebuild_advisor_indices() -> dict:
    """Regenerate advisor L3 / L3A from synced 职业页 data."""
    scripts = (
        "build-advisor-advancements.mjs",
        "build-advisor-advancement-skills.mjs",
    )
    out: dict = {}
    for name in scripts:
        proc = subprocess.run(
            ["node", str(ROOT / "scripts" / name)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if proc.returncode != 0:
            print(proc.stdout, file=sys.stderr)
            print(proc.stderr, file=sys.stderr)
            raise RuntimeError(f"{name} failed with code {proc.returncode}")
        out[name] = (proc.stdout or "").strip().splitlines()[-3:]
    adv = json.loads((ROOT / "advisor" / "advancements.json").read_text(encoding="utf-8"))
    skills = json.loads((ROOT / "advisor" / "advancement_skills.json").read_text(encoding="utf-8"))
    return {
        "advancements_count": adv.get("meta", {}).get("count"),
        "documented_count": skills.get("meta", {}).get("documentedCount"),
        "log_tail": out,
    }


if __name__ == "__main__":
    report_path = Path(__file__).resolve().parent / "_advancement_sync_report.json"
    report = sync_advancements(DOCX)
    report["advisor"] = rebuild_advisor_indices()
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
