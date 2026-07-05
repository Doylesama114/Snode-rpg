#!/usr/bin/env python3
"""Verify 吟游诗人 sync."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = "吟游诗人"
html = (ROOT / "职业页" / f"{CLASS}.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / f"{CLASS}.json").read_text(encoding="utf-8"))
fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
fx = json.loads(fx_path.read_text(encoding="utf-8")) if fx_path.exists() else {CLASS: []}

articles = set(re.findall(r'id="(b-[^"]+)"', html))
json_ids = {s["id"] for s in data["skills"]}
fx_ids = {s["id"] for s in fx.get(CLASS, [])}

print("=== ID alignment ===")
print(f"JSON skills: {len(json_ids)}")
print(f"FX entries:  {len(fx_ids)}")
print(f"JSON not in HTML: {sorted(json_ids - articles)}")
print(f"JSON not in FX:   {sorted(json_ids - fx_ids)}")

print("\n=== Label check ===")
print(f"费用： in HTML: {html.count('费用：')}")
print(f"标识： in HTML: {html.count('标识：')}")

no_mark = [s["name"] for s in data["skills"] if "标识" not in s.get("fields", {})]
print(f"\nSkills without 标识 ({len(no_mark)}): {no_mark[:20]}{'...' if len(no_mark)>20 else ''}")

checks = [
    ("b-starting-skill-1", "激励乐章", False),
    ("b-skill-1", "雷鸣和弦", True),
    ("b-skill-23", "静寂术", True),
    ("b-skill-34", "静寂术", True),
]
fx_by_id = {s["id"]: s for s in fx.get(CLASS, [])}
print("\n=== Spot checks ===")
for sid, name, has_mark in checks:
    sk = next(s for s in data["skills"] if s["id"] == sid)
    fx_sk = fx_by_id.get(sid, {})
    ok_id = ("标识" in sk.get("fields", {})) == has_mark
    print(f"  {sid} {name} style={sk.get('style')} 标识={('标识' in sk.get('fields',{}))} fx.sp={fx_sk.get('cost',{}).get('sp')} ok={ok_id}")
