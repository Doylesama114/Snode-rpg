#!/usr/bin/env python3
"""Verify 法师 sync."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = "法师"
html = (ROOT / "职业页" / f"{CLASS}.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / f"{CLASS}.json").read_text(encoding="utf-8"))
fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
fx = json.loads(fx_path.read_text(encoding="utf-8")) if fx_path.exists() else {CLASS: []}

articles = set(re.findall(r'id="(m-[^"]+)"', html))
json_ids = {s["id"] for s in data["skills"]}
fx_ids = {s["id"] for s in fx.get(CLASS, [])}

print("=== ID alignment ===")
print(f"JSON skills: {len(json_ids)}")
print(f"FX entries:  {len(fx_ids)}")
print(f"JSON not in HTML: {len(json_ids - articles)} {sorted(list(json_ids - articles))[:5]}")
print(f"JSON not in FX:   {len(json_ids - fx_ids)}")

print("\n=== Label check ===")
print(f"费用： in HTML: {html.count('费用：')}")
print(f"标识： in HTML: {html.count('标识：')}")

no_mark = [s["name"] for s in data["skills"] if "标识" not in s.get("fields", {})]
print(f"\nSkills without 标识: {len(no_mark)}")

checks = [
    ("m-starting-skill-1", "塑能箭", False),
    ("m-skill-1-1-1", "魔法飞弹", True),
    ("m-skill-1-1-2", "寒冰箭", True),
    ("m-skill-1-6-9", "火山术", True),
    ("m-skill-4-4-9", "防范箭矢", True),
    ("m-skill-3-7-7", "裁剪生命之线", True),
    ("m-skill-1-7-7", "虹光射线", True),
]
fx_by_id = {s["id"]: s for s in fx.get(CLASS, [])}
print("\n=== Spot checks ===")
spot_fail = []
for sid, name, has_mark in checks:
    sk = next((s for s in data["skills"] if s["id"] == sid), None)
    if not sk:
        print(f"  FAIL missing {sid} {name}")
        spot_fail.append(sid)
        continue
    if sk.get("name") != name:
        print(f"  FAIL name {sid}: {sk.get('name')} != {name}")
        spot_fail.append(sid)
        continue
    fx_sk = fx_by_id.get(sid, {})
    ok = ("标识" in sk.get("fields", {})) == has_mark
    if not ok:
        spot_fail.append(sid)
    print(f"  {name}: 标识={('标识' in sk.get('fields',{}))} fx.sp={fx_sk.get('cost',{}).get('sp')} ok={ok}")

# rename + key phrases
extra_fail = []
if "防护箭矢" in html:
    extra_fail.append("防护箭矢 still in HTML")
if "防范箭矢" not in html:
    extra_fail.append("防范箭矢 missing in HTML")
if "触发过暴击" not in html:
    extra_fail.append("炎爆术暴击前置 missing")
if json_ids - articles:
    extra_fail.append(f"JSON not in HTML: {len(json_ids - articles)}")
if json_ids - fx_ids:
    extra_fail.append(f"JSON not in FX: {len(json_ids - fx_ids)}")

print("\n=== RESULT ===")
fails = spot_fail + extra_fail
if fails:
    print("FAIL", fails)
    raise SystemExit(1)
print("PASS")
print(f"JSON skills: {len(json_ids)}")
