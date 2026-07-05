#!/usr/bin/env python3
"""Verify warrior sync results."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "职业页" / "战士.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / "战士.json").read_text(encoding="utf-8"))
fx = json.loads((ROOT / "斯诺德跑团" / "skill_effects_战士.json").read_text(encoding="utf-8"))

articles = set(re.findall(r'id="(w-[^"]+)"', html))
json_ids = {s["id"] for s in data["skills"]}
fx_ids = {s["id"] for s in fx["战士"]}

print("=== ID alignment ===")
print(f"HTML article ids: {len(articles)}")
print(f"JSON skill ids:   {len(json_ids)}")
print(f"FX skill ids:     {len(fx_ids)}")
print(f"JSON not in HTML: {sorted(json_ids - articles)}")
print(f"JSON not in FX:   {sorted(json_ids - fx_ids)}")

print("\n=== Label check ===")
print(f"费用： in HTML: {html.count('费用：')}")
print(f"标识： in HTML: {html.count('标识：')}")

no_mark = [s["name"] for s in data["skills"] if "标识" not in s.get("fields", {})]
print(f"\nSkills without 标识 ({len(no_mark)}): {no_mark}")

with_fee = [s["name"] for s in data["skills"] if "费用" in s.get("fields", {})]
print(f"Skills with old 费用 field: {with_fee}")

print("\n=== Spot checks ===")
checks = {
    "w-skill-1-1-1": ("重殴", ["橙"], True),
    "w-starting-skill-1": ("猛击", None, False),
    "w-starting-skill-2": ("冲锋", None, False),
    "w-skill-3-4-3": ("不屈", ["黄", "橙"], True),
}
fx_by_id = {s["id"]: s for s in fx["战士"]}
for sid, (name, sp, has_mark) in checks.items():
    sk = next(s for s in data["skills"] if s["id"] == sid)
    fx_sk = fx_by_id.get(sid, {})
    has_id = "标识" in sk.get("fields", {})
    fx_sp = fx_sk.get("cost", {}).get("sp")
    restr = sk.get("fields", {}).get("施展限制", "")
    ok = has_id == has_mark and (sp is None or fx_sp == sp)
    print(f"  {name}: 标识={has_id} fx.sp={fx_sp} ok={ok}")
    if sid == "w-starting-skill-2":
        print(f"    施展限制: {restr}")
