#!/usr/bin/env python3
"""
Diff extract JSON vs site 职业页/数据/{class}.json.

Usage:
  python scripts/diff_class_extract.py --class 吟游诗人
  python scripts/diff_class_extract.py --class 吟游诗人 --extract scripts/extracts/吟游诗人.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def skill_key(s: dict) -> tuple:
    return (s.get("name") or "", s.get("style") or "", s.get("tier") or "")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--class", dest="class_name", required=True)
    ap.add_argument("--extract", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--tier", default=None, help="可选：只报告该阶位，如 五阶")
    args = ap.parse_args()

    extract_path = args.extract or (ROOT / "scripts" / "extracts" / f"{args.class_name}.json")
    data_path = ROOT / "职业页" / "数据" / f"{args.class_name}.json"
    if not extract_path.exists():
        raise SystemExit(f"missing extract: {extract_path} (run extract_class_docx.py first)")
    if not data_path.exists():
        raise SystemExit(f"missing site data: {data_path}")

    extract = json.loads(extract_path.read_text(encoding="utf-8"))
    site = json.loads(data_path.read_text(encoding="utf-8"))

    ex_skills = extract.get("skills") or []
    site_skills = site.get("skills") or []
    if args.tier:
        ex_skills = [s for s in ex_skills if s.get("tier") == args.tier]
        site_skills = [s for s in site_skills if s.get("tier") == args.tier]

    ex_map = {skill_key(s): s for s in ex_skills}
    site_map = {skill_key(s): s for s in site_skills}

    missing_on_site = []
    for k, s in ex_map.items():
        if k not in site_map:
            missing_on_site.append({
                "name": s["name"],
                "style": s.get("style"),
                "tier": s.get("tier"),
                "cost": s.get("cost") or [],
                "cost_meta": s.get("cost_meta") or [],
            })

    missing_in_docx = []
    for k, s in site_map.items():
        if k not in ex_map:
            missing_in_docx.append({
                "id": s.get("id"),
                "name": s["name"],
                "style": s.get("style"),
                "tier": s.get("tier"),
            })

    field_diffs = []
    mark_diffs = []
    for k in sorted(set(ex_map) & set(site_map)):
        a, b = ex_map[k], site_map[k]
        af = a.get("fields") or {}
        bf = b.get("fields") or {}
        keys = sorted(set(af) | set(bf))
        changed = {}
        for fk in keys:
            if (af.get(fk) or "") != (bf.get(fk) or ""):
                changed[fk] = {"extract": af.get(fk), "site": bf.get(fk)}
        if changed:
            field_diffs.append({
                "name": a["name"], "style": a.get("style"), "tier": a.get("tier"),
                "id": b.get("id"), "fields": changed,
            })
        ac = list(a.get("cost") or [])
        # site cost is [{color,hex}] or similar
        bc = []
        for c in b.get("cost") or []:
            if isinstance(c, dict):
                bc.append(c.get("hex") or c.get("color") or "")
            else:
                bc.append(str(c))
        if ac != bc:
            mark_diffs.append({
                "name": a["name"], "style": a.get("style"), "tier": a.get("tier"),
                "id": b.get("id"), "extract": ac, "site": bc,
            })

    report = {
        "class_name": args.class_name,
        "tier_filter": args.tier,
        "extract_count": len(ex_skills),
        "site_count": len(site_skills),
        "missing_on_site": missing_on_site,
        "missing_in_docx": missing_in_docx,
        "field_diffs_count": len(field_diffs),
        "mark_diffs_count": len(mark_diffs),
        "field_diffs": field_diffs[:50],
        "mark_diffs": mark_diffs[:50],
    }

    out = args.out
    if out is None:
        suffix = f"_{args.tier}" if args.tier else ""
        out = ROOT / "scripts" / "extracts" / f"_diff_{args.class_name}{suffix}.json"

    out = out if out.is_absolute() else (ROOT / out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[DIFF] {args.class_name}" + (f" tier={args.tier}" if args.tier else ""))
    print(f"  extract={len(ex_skills)} site={len(site_skills)}")
    print(f"  missing_on_site={len(missing_on_site)} missing_in_docx={len(missing_in_docx)}")
    print(f"  field_diffs={len(field_diffs)} mark_diffs={len(mark_diffs)}")
    try:
        shown = out.relative_to(ROOT)
    except ValueError:
        shown = out
    print(f"  → {shown}")
    if missing_on_site:
        print("  missing_on_site names:")
        for m in missing_on_site:
            print(f"    [{m['style']}/{m['tier']}] {m['name']} marks={m['cost_meta']}")


if __name__ == "__main__":
    main()
