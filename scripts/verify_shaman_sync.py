#!/usr/bin/env python3
"""Verify 萨满祭司 sync."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = "萨满祭司"
html = (ROOT / "职业页" / f"{CLASS}.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / f"{CLASS}.json").read_text(encoding="utf-8"))
fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
fx = json.loads(fx_path.read_text(encoding="utf-8")) if fx_path.exists() else {CLASS: []}

articles = set(re.findall(r'<article class="skill" id="(sa-skill-[^"]+)"', html))
json_ids = {s["id"] for s in data["skills"]}
fx_ids = {s["id"] for s in fx.get(CLASS, [])}

print("=== ID alignment ===")
print(f"JSON skills: {len(json_ids)}")
print(f"FX entries:  {len(fx_ids)}")
print(f"HTML articles: {len(articles)}")
print(f"JSON not in HTML: {sorted(json_ids - articles)}")
print(f"HTML not in JSON: {sorted(articles - json_ids)[:10]}")
print(f"JSON not in FX:   {sorted(json_ids - fx_ids)}")

print("\n=== Label check ===")
print(f"费用： in HTML: {html.count('费用：')}")
print(f"标识： in HTML: {html.count('标识：')}")
print(f"HTML after </html>: {len(html.split('</html>')[1].strip()) > 0}")

no_mark = [s["name"] for s in data["skills"] if "标识" not in s.get("fields", {})]
print(f"\nSkills without 标识 ({len(no_mark)}): {no_mark[:8]}{'...' if len(no_mark)>8 else ''}")

has_old_fee = [s["name"] for s in data["skills"] if "费用" in s.get("fields", {})]
print(f"JSON fields still using 费用: {has_old_fee}")

checks = [
    ("sa-skill-1", "闪电箭", False),
    ("sa-skill-5", "闪电盾牌", True),
    ("sa-skill-42", "间歇泉", True),
    ("sa-skill-95", "生机潮汐", True),
]
fx_by_id = {s["id"]: s for s in fx.get(CLASS, [])}
print("\n=== Spot checks ===")
for sid, name, has_mark in checks:
    sk = next((s for s in data["skills"] if s["id"] == sid), None)
    if not sk:
        print(f"  {name} ({sid}): MISSING")
        continue
    ok_name = sk["name"] == name or name in sk["name"]
    ok_mark = ("标识" in sk.get("fields", {})) == has_mark
    fx_sk = fx_by_id.get(sid, {})
    print(
        f"  {sk['name']} ({sid}): style={sk.get('style')} "
        f"标识={('标识' in sk.get('fields', {}))} fx.sp={fx_sk.get('cost', {}).get('sp')} "
        f"ok={ok_name and ok_mark}"
    )

errors = []
if html.count("费用："):
    errors.append("HTML still has 费用：")
if len(html.split("</html>")[1].strip()) > 0:
    errors.append("garbage after </html>")
if json_ids != fx_ids or json_ids != articles:
    errors.append("ID mismatch")
if has_old_fee:
    errors.append("JSON has 费用 field")

print("\n=== Result ===")
print("PASS" if not errors else "FAIL: " + "; ".join(errors))
