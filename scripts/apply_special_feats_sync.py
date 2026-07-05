#!/usr/bin/env python3
"""Sync 特殊专长 from docx → HTML + JSON + skill_effects."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from feat_sync_core import sync_special_feats

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "职业页" / "数据" / "特殊专长.json"

if __name__ == "__main__":
    old = json.loads(DATA.read_text(encoding="utf-8"))
    report = sync_special_feats(
        docx=ROOT / "特殊专长.docx",
        html_path=ROOT / "职业页" / "特殊专长.html",
        data_path=DATA,
        fx_path=ROOT / "斯诺德跑团" / "skill_effects_特殊专长.json",
        electron_html=ROOT / "electron-app" / "职业页" / "特殊专长.html",
        electron_data=ROOT / "electron-app" / "职业页" / "数据" / "特殊专长.json",
        electron_fx=ROOT / "electron-app" / "斯诺德跑团" / "skill_effects_特殊专长.json",
        report_path=ROOT / "scripts" / "_special_feats_sync_report.json",
        old_data=old,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
