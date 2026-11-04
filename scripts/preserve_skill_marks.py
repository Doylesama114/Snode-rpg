
# -*- coding: utf-8 -*-
"""把旧 JSON 里的色彩标识（cost / 标识）回填到新数据：新 docx 已取消标识，界面隐藏但数据保留。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD = ROOT / "_scratch" / "11.04a" / "oldjson"

RENAMES = {
    "战士": {"机敏的韵律": "机敏光环", "逆流诀窍": "逆流技巧"},
    "蛮斗士": {},
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    report = {}
    for cls in ["战士", "蛮斗士"]:
        old = load(OLD / f"{cls}.json")
        new = load(ROOT / "职业页" / "数据" / f"{cls}.json")
        by_name = {}
        for s in old["skills"]:
            if s.get("cost"):
                by_name[s["name"]] = s["cost"]
        by_id = {s["id"]: s["cost"] for s in old["skills"] if s.get("cost")}
        rename = RENAMES.get(cls, {})
        hit = miss = 0
        filled = []
        for s in new["skills"]:
            if s.get("cost"):
                hit += 1
                continue
            src = by_id.get(s["id"])
            if not src:
                base = rename.get(s["name"], s["name"])
                src = by_name.get(base)
            if src:
                s["cost"] = src
                hit += 1
                filled.append(s["name"])
            else:
                miss += 1
        (ROOT / "职业页" / "数据" / f"{cls}.json").write_text(
            json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
        for mirror in [ROOT / "electron-app" / "职业页" / "数据" / f"{cls}.json"]:
            if mirror.parent.exists():
                mirror.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
        report[cls] = {
            "skills": len(new["skills"]),
            "with_marks": hit,
            "without_marks": miss,
            "refilled": len(filled),
            "refilled_sample": filled[:8],
        }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
