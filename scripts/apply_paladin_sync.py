#!/usr/bin/env python3
"""Sync 圣骑士 from docx → HTML + JSON + skill_effects."""
from pathlib import Path

from class_sync_core import sync_class

ROOT = Path(__file__).resolve().parent.parent
CLASS = "圣骑士"

if __name__ == "__main__":
    import json

    report = sync_class(
        class_name=CLASS,
        docx=ROOT / "基础职业-圣骑士.docx",
        html_path=ROOT / "职业页" / "圣骑士.html",
        data_path=ROOT / "职业页" / "数据" / "圣骑士.json",
        fx_path=ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json",
        electron_html=ROOT / "electron-app" / "职业页" / f"{CLASS}.html",
        electron_data=ROOT / "electron-app" / "职业页" / "数据" / f"{CLASS}.json",
        electron_fx=ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json",
        report_path=ROOT / "scripts" / "_paladin_sync_report.json",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
