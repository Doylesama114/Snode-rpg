#!/usr/bin/env python3
"""Verify 通用天赋树 sync."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = "通用天赋树"
html = (ROOT / "职业页" / f"{CLASS}.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / f"{CLASS}.json").read_text(encoding="utf-8"))
fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
fx = json.loads(fx_path.read_text(encoding="utf-8")) if fx_path.exists() else {CLASS: []}

articles = set(re.findall(r'<article class="skill(?: starting)?" id="(g-[^"]+)"', html))
json_ids = {s["id"] for s in data["skills"]}
fx_ids = {s["id"] for s in fx.get(CLASS, [])}

print("=== ID alignment ===")
print(f"JSON skills: {len(json_ids)}")
print(f"FX entries:  {len(fx_ids)}")
print(f"HTML articles: {len(articles)}")
print(f"JSON not in HTML: {len(json_ids - articles)}")
print(f"HTML not in JSON: {len(articles - json_ids)}")
print(f"JSON not in FX:   {len(json_ids - fx_ids)}")

print("\n=== Label check ===")
print(f"费用： in HTML: {html.count('费用：')}")
print(f"标识： in HTML: {html.count('标识：')}")

no_mark = [s["name"] for s in data["skills"] if "标识" not in s.get("fields", {})]
print(f"\nSkills without 标识 ({len(no_mark)}): {no_mark[:15]}{'...' if len(no_mark) > 15 else ''}")

has_old_fee = [s["name"] for s in data["skills"] if "费用" in s.get("fields", {})]
print(f"JSON fields still using 费用: {len(has_old_fee)}")

checks = [
    ("g-skill-1", "先发制人", True),
    ("g-skill-12", "抉择A·你仅能够选择其中一项习得", False),
    ("g-skill-100", None, True),
]
fx_by_id = {s["id"]: s for s in fx.get(CLASS, [])}
print("\n=== Spot checks ===")
for sid, name, has_mark in checks:
    sk = next((s for s in data["skills"] if s["id"] == sid), None)
    if not sk:
        print(f"  {name or sid} ({sid}): MISSING")
        continue
    fx_sk = fx_by_id.get(sid, {})
    ok = ("标识" in sk.get("fields", {})) == has_mark
    print(
        f"  {sk['name']} ({sid}): "
        f"标识={('标识' in sk.get('fields', {}))} "
        f"fx.sp={fx_sk.get('cost', {}).get('sp')} ok={ok}"
    )

errors = []
if html.count("费用："):
    errors.append("HTML still has 费用：")
if json_ids != fx_ids or json_ids != articles:
    errors.append("ID mismatch")
if has_old_fee:
    errors.append("JSON has 费用 field")

print("\n=== Result ===")
print("PASS" if not errors else "FAIL: " + "; ".join(errors))
