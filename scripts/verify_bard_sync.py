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
    ("b-skill-120", "冲锋号角", False),
    ("b-skill-122", "弗拉门戈狂击", True),
    ("b-skill-149", "铜管重音", True),
]
fx_by_id = {s["id"]: s for s in fx.get(CLASS, [])}
spot_fail = []
print("\n=== Spot checks ===")
for sid, name, has_mark in checks:
    sk = next((s for s in data["skills"] if s["id"] == sid), None)
    if not sk:
        print(f"  FAIL missing skill {sid} {name}")
        spot_fail.append(sid)
        continue
    if sk.get("name") != name:
        print(f"  FAIL name mismatch {sid}: {sk.get('name')} != {name}")
        spot_fail.append(sid)
        continue
    fx_sk = fx_by_id.get(sid, {})
    ok_id = ("标识" in sk.get("fields", {})) == has_mark
    if not ok_id:
        spot_fail.append(sid)
    print(f"  {sid} {name} style={sk.get('style')} tier={sk.get('tier')} 标识={('标识' in sk.get('fields',{}))} fx.sp={fx_sk.get('cost',{}).get('sp')} ok={ok_id}")

# 静寂术：HTML 有独立卡片；JSON 历史上可能缺条（已知 drift，不阻断五阶发版闸门）
print("\n=== 静寂术 HTML presence ===")
has_23_html = 'id="b-skill-23"' in html
print(f"  b-skill-23 in HTML: {has_23_html}")
print(f"  b-skill-23 in JSON: {'b-skill-23' in json_ids}")

t5 = [s for s in data["skills"] if s.get("tier") == "五阶"]
print(f"\n=== 五阶 ===")
print(f"JSON 五阶 count: {len(t5)} (expect 30)")
print(f"subtitle 一至五阶: {'一至五阶' in html}")
for style in ("激昂", "舒缓", "灵动", "诙谐", "集中"):
    nav = f'href="#b-tier-{style}-5"' in html
    sec = f'id="b-tier-{style}-5"' in html
    print(f"  {style}: nav={nav} section={sec}")
    if not (nav and sec):
        spot_fail.append(f"tier5-{style}")
fail = list(spot_fail)
if len(t5) != 30:
    fail.append(f"五阶 count {len(t5)} != 30")
if "一至五阶" not in html:
    fail.append("missing 一至五阶 subtitle")
if json_ids - articles:
    fail.append("JSON ids missing from HTML")
if json_ids - fx_ids:
    fail.append("JSON ids missing from FX")
if "费用：" in html:
    fail.append("HTML still has 费用：")
print("\n=== RESULT ===")
print("PASS" if not fail else "FAIL: " + "; ".join(fail))
if fail:
    raise SystemExit(1)
