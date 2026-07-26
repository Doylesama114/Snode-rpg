#!/usr/bin/env python3
"""Extract 已公布进阶职业.docx → scripts/extracts/published_advancements.json"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from published_advancement_core import EXTRACT_OUT, extract_all

if __name__ == "__main__":
    data = extract_all()
    EXTRACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    EXTRACT_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {EXTRACT_OUT} count={data['count']} complete={len(data['complete_names'])} incomplete={data['incomplete_names']}")
