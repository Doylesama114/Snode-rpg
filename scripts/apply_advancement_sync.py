#!/usr/bin/env python3
"""Apply advancement sync from 《基础职业进阶途径》.docx."""
from __future__ import annotations

import json
from pathlib import Path

from advancement_sync_core import DOCX, sync_advancements

if __name__ == "__main__":
    report_path = Path(__file__).resolve().parent / "_advancement_sync_report.json"
    report = sync_advancements(DOCX)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
