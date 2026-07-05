#!/usr/bin/env python3
"""Verify 特殊专长 sync."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
MODULE = "特殊专长"
html = (ROOT / "职业页" / f"{MODULE}.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / f"{MODULE}.json").read_text(encoding="utf-8"))
fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{MODULE}.json"
fx = json.loads(fx_path.read_text(encoding="utf-8")) if fx_path.exists() else {MODULE: []}

articles = re.findall(r'<article class="skill" id="(feat-\d+)"', html)
article_ids = set(articles)
json_ids = {x["id"] for x in data}
fx_ids = {x["id"] for x in fx.get(MODULE, [])}
json_by_id = {x["id"]: x for x in data}

print("=== ID alignment ===")
print(f"JSON: {len(json_ids)}  HTML articles: {len(article_ids)}  FX: {len(fx_ids)}")
print(f"JSON not in HTML: {sorted(json_ids - article_ids)}")
print(f"HTML not in JSON: {sorted(article_ids - json_ids)}")
print(f"JSON not in FX:   {sorted(json_ids - fx_ids)}")

print("\n=== Label check ===")
print(f"费用： in HTML: {html.count('费用：')}")
print(f"标识： in HTML: {html.count('标识：')}")

print("\n=== Spot checks ===")
checks = ["feat-1", "feat-5", "feat-100"]
for fid in checks:
    sk = json_by_id.get(fid)
    if not sk:
        print(f"  {fid}: MISSING")
        continue
    m = re.search(rf'id="{fid}"[^>]*>.*?<h4>([^<]+)', html, re.S)
    hname = m.group(1).strip() if m else "?"
    ok = hname == sk["name"]
    print(f"  {sk['name']} ({fid}): html_h4={hname} ok={ok}")

errors = []
if html.count("费用："):
    errors.append("HTML still has 费用：")
if json_ids != article_ids or json_ids != fx_ids:
    errors.append("ID mismatch")
expected = {f"feat-{i}" for i in range(1, len(data) + 1)}
if json_ids != expected:
    errors.append("IDs not contiguous feat-1..feat-N")

print("\n=== Result ===")
print("PASS" if not errors else "FAIL: " + "; ".join(errors))
