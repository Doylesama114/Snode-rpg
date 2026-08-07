#!/usr/bin/env python3
"""
Apply extract JSON into site HTML/JSON — hard-gated for safety.

Currently only supports:
  --class 吟游诗人 --tier 五阶

Never apply image/fixture extracts (e.g. 法师 预言七阶).

Usage:
  python scripts/apply_class_extract.py --class 吟游诗人 --tier 五阶
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    cost_json,
    json_to_fx_entry,
    sanitize_data_search,
    skill_type_from_keywords,
    tags_from_keywords,
)

# Hard allow-list for this apply path.
# 法师六/七/四阶新增走 scripts/apply_mage_missing_extract.py（HTML 结构不同）。
ALLOWED = {
    ("吟游诗人", "五阶"),
    ("法师", "四阶"),
    ("法师", "六阶"),
    ("法师", "七阶"),
}

STYLE_ORDER = ["激昂", "舒缓", "灵动", "诙谐", "集中"]
STYLE_CHIP = {
    "激昂": "#FF6B6B",
    "舒缓": "#69DB7C",
    "灵动": "#74C0FC",
    "诙谐": "#DA77F2",
    "集中": "#FFD43B",
}
ID_PREFIX = "b-skill"
TIER_NUM = {
    "一阶": "1",
    "二阶": "2",
    "三阶": "3",
    "四阶": "4",
    "五阶": "5",
    "六阶": "6",
    "七阶": "7",
}


def skill_key(s: dict) -> tuple:
    return (s.get("name") or "", s.get("style") or "", s.get("tier") or "")


def next_skill_id(skills: list[dict], prefix: str = ID_PREFIX) -> int:
    mx = 0
    pat = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    for s in skills:
        m = pat.match(s.get("id") or "")
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1


def extract_to_block(ex: dict) -> dict:
    fields = dict(ex.get("fields") or {})
    mark_dots = [c for c in (ex.get("cost") or []) if c]
    if mark_dots:
        fields["标识"] = "".join("●" for _ in mark_dots)
    fields.pop("费用", None)
    return {
        "name": ex["name"],
        "fields": fields,
        "mark_dots": mark_dots,
        "field_runs": ex.get("field_runs") or {},
        "description": list(ex.get("description") or []),
        "description_entries": ex.get("description_entries") or [],
        "level_upgrades": list(ex.get("level_upgrades") or []),
        "flavor": ex.get("flavor") or "",
        "unit_tables": ex.get("unit_tables") or [],
        "roll_tables": ex.get("roll_tables") or [],
    }


def extract_to_site_skill(ex: dict, sid: str) -> dict:
    block = extract_to_block(ex)
    fields = dict(block["fields"])
    tags = tags_from_keywords(fields.get("关键词", ""))
    skill = {
        "id": sid,
        "name": ex["name"],
        "tags": tags,
        "fields": fields,
        "cost": cost_json(block["mark_dots"]),
        "description": block["description"],
        "level_upgrades": block["level_upgrades"],
        "flavor": block["flavor"],
        "style": ex.get("style") or "",
        "tier": ex.get("tier") or "",
    }
    if block["field_runs"]:
        skill["field_runs"] = block["field_runs"]
    if block["description_entries"]:
        skill["description_entries"] = block["description_entries"]
    if ex.get("choice_group"):
        skill["choice_group"] = ex["choice_group"]
    if block["unit_tables"]:
        skill["unit_tables"] = block["unit_tables"]
    if block["roll_tables"]:
        skill["roll_tables"] = block["roll_tables"]
    return skill


def chips_html(skill: dict) -> str:
    kw = (skill.get("fields") or {}).get("关键词", "")
    stype = skill_type_from_keywords(kw)
    tags = skill.get("tags") or []
    items = [stype] + [t for t in tags if t != stype]
    return "\n".join(f'          <span class="chip">{t}</span>' for t in items)


def render_article(skill: dict, block: dict) -> str:
    sid = skill["id"]
    style = skill.get("style") or ""
    tier = skill.get("tier") or ""
    color = STYLE_CHIP.get(style, "#888")
    chip_label = f"{style}风格" if style else ""
    tier_lbl = f"{tier}天赋树" if tier.endswith("阶") else tier
    detail = build_detail_html(block, {
        "unit_tables": block.get("unit_tables") or [],
        "roll_tables": block.get("roll_tables") or [],
    })
    data_search = build_data_search(block, style, tier_lbl, skill.get("tags") or [])
    data_search = append_tables_to_search(data_search, block)
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, block["mark_dots"])
    return (
        f'      <article class="skill" id="{sid}" data-search="{safe}"{data_attrs}>'
        f'<h4>{skill["name"]} <span class="chip" style="background:{color}">{chip_label}</span></h4>\n'
        f'        <div class="chips">\n'
        f"{chips_html(skill)}\n"
        f"        </div>\n"
        f'        <div class="detail">{detail}</div>\n'
        f"      </article>"
    )


def render_tier_section(style: str, tier: str, skills: list[dict], blocks: dict[str, dict]) -> str:
    num = TIER_NUM.get(tier, tier)
    lines = [f'    <div class="tier" id="b-tier-{style}-{num}">', f"      <h3>{tier}天赋树</h3>"]
    for sk in skills:
        lines.append(render_article(sk, blocks[sk["id"]]))
    lines.append("    </div>")
    return "\n".join(lines)


def render_nav_tier(style: str, tier: str, skills: list[dict]) -> str:
    num = TIER_NUM.get(tier, tier)
    lines = [
        '              <details class="nav-tier">',
        f'                  <summary class="tier-summary"><a href="#b-tier-{style}-{num}">{tier}天赋树</a></summary>',
    ]
    for sk in skills:
        lines.append(f'                  <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
    lines.append("                </details>")
    return "\n".join(lines)


def close_div_after(html: str, id_attr: str) -> int:
    """Return index just after the closing </div> of the element that has id_attr."""
    pos = html.find(id_attr)
    if pos == -1:
        raise ValueError(f"not found: {id_attr}")
    div_start = html.rfind("<div", 0, pos)
    if div_start == -1:
        raise ValueError(f"div start not found for {id_attr}")
    depth = 0
    i = div_start
    n = len(html)
    while i < n:
        if html.startswith("<div", i) and (i + 4 == n or html[i + 4] in " \t\n>"):
            depth += 1
            gt = html.find(">", i)
            i = gt + 1 if gt != -1 else i + 4
            continue
        if html.startswith("</div>", i):
            depth -= 1
            i += 6
            if depth == 0:
                return i
            continue
        i += 1
    raise ValueError(f"unclosed div for {id_attr}")


def insert_nav_after_tier4(html: str, style: str, nav_html: str) -> str:
    marker = f'href="#b-tier-{style}-4"'
    pos = html.find(marker)
    if pos == -1:
        raise ValueError(f"nav marker missing for {style}")
    # find enclosing <details class="nav-tier"> ... </details>
    det_start = html.rfind('<details class="nav-tier">', 0, pos)
    if det_start == -1:
        raise ValueError(f"nav-tier start missing for {style}")
    depth = 0
    i = det_start
    n = len(html)
    while i < n:
        if html.startswith("<details", i):
            depth += 1
            i = html.find(">", i) + 1
            continue
        if html.startswith("</details>", i):
            depth -= 1
            i += len("</details>")
            if depth == 0:
                # skip if already has 五阶
                if f'href="#b-tier-{style}-5"' in html[det_start:i + 200]:
                    return html
                return html[:i] + "\n" + nav_html + html[i:]
            continue
        i += 1
    raise ValueError(f"nav-tier close missing for {style}")


def insert_content_after_tier4(html: str, style: str, section_html: str) -> str:
    id_attr = f'id="b-tier-{style}-4"'
    if f'id="b-tier-{style}-5"' in html:
        return html
    end = close_div_after(html, id_attr)
    return html[:end] + "\n" + section_html + html[end:]


def apply_bard_tier5(extract_path: Path, dry_run: bool = False) -> dict:
    class_name = "吟游诗人"
    tier = "五阶"
    html_path = ROOT / "职业页" / f"{class_name}.html"
    data_path = ROOT / "职业页" / "数据" / f"{class_name}.json"
    fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{class_name}.json"

    extract = json.loads(extract_path.read_text(encoding="utf-8"))
    if extract.get("meta", {}).get("fixture_only"):
        raise SystemExit("refusing to apply fixture_only extract")
    if extract.get("meta", {}).get("class_name") not in (None, class_name):
        if extract["meta"]["class_name"] != class_name:
            raise SystemExit(f"extract class mismatch: {extract['meta']['class_name']}")

    site = json.loads(data_path.read_text(encoding="utf-8"))
    site_keys = {skill_key(s) for s in site["skills"]}
    candidates = [
        s for s in extract["skills"]
        if s.get("tier") == tier and skill_key(s) not in site_keys
    ]
    if not candidates:
        return {"added": 0, "message": "nothing to add"}

    # stable order by style then name
    candidates.sort(key=lambda s: (STYLE_ORDER.index(s["style"]) if s.get("style") in STYLE_ORDER else 99, s["name"]))

    next_n = next_skill_id(site["skills"])
    new_skills: list[dict] = []
    blocks: dict[str, dict] = {}
    by_style: dict[str, list[dict]] = defaultdict(list)

    for ex in candidates:
        sid = f"{ID_PREFIX}-{next_n}"
        next_n += 1
        skill = extract_to_site_skill(ex, sid)
        block = extract_to_block(ex)
        new_skills.append(skill)
        blocks[sid] = block
        by_style[skill["style"]].append(skill)

    html = html_path.read_text(encoding="utf-8")
    html = html.replace("一至四阶", "一至五阶")

    for style in STYLE_ORDER:
        skills = by_style.get(style) or []
        if not skills:
            continue
        nav = render_nav_tier(style, tier, skills)
        html = insert_nav_after_tier4(html, style, nav)
        section = render_tier_section(style, tier, skills, blocks)
        html = insert_content_after_tier4(html, style, section)

    site["skills"].extend(new_skills)

    # skill_effects
    fx_entries = None
    if fx_path.exists():
        fx_doc = json.loads(fx_path.read_text(encoding="utf-8"))
        arr = fx_doc.get(class_name) or []
        existing_ids = {e.get("id") for e in arr}
        for sk in new_skills:
            if sk["id"] not in existing_ids:
                arr.append(json_to_fx_entry(sk, class_name))
        fx_doc[class_name] = arr
        fx_entries = len(arr)

    report = {
        "class": class_name,
        "tier": tier,
        "added": len(new_skills),
        "ids": [s["id"] for s in new_skills],
        "names": [{"id": s["id"], "style": s["style"], "name": s["name"]} for s in new_skills],
        "fx_entries": fx_entries,
    }

    if dry_run:
        report["dry_run"] = True
        return report

    data_path.write_text(json.dumps(site, ensure_ascii=False, indent=2), encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")
    if fx_path.exists() and fx_entries is not None:
        fx_path.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    # electron mirrors
    pairs = [
        (html_path, ROOT / "electron-app" / "职业页" / f"{class_name}.html"),
        (data_path, ROOT / "electron-app" / "职业页" / "数据" / f"{class_name}.json"),
    ]
    if fx_path.exists():
        pairs.append(
            (fx_path, ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{class_name}.json")
        )
    for src, dst in pairs:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    # search index
    idx_script = ROOT / "scripts" / "build_class_search_index.js"
    if idx_script.exists():
        subprocess.run(["node", str(idx_script)], cwd=str(ROOT), check=True)
        idx = ROOT / "职业页" / "search-index.json"
        eidx = ROOT / "electron-app" / "职业页" / "search-index.json"
        if idx.exists():
            eidx.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(idx, eidx)

    report_path = ROOT / "scripts" / "_bard_t5_apply_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--class", dest="class_name", required=True)
    ap.add_argument("--tier", required=True)
    ap.add_argument("--extract", type=Path, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    key = (args.class_name, args.tier)
    if key not in ALLOWED:
        raise SystemExit(
            f"apply refused: only allowed pairs are {sorted(ALLOWED)}; got {key}. "
            "Image/fixture extracts must never be applied."
        )

    extract_path = args.extract or (ROOT / "scripts" / "extracts" / f"{args.class_name}.json")
    if not extract_path.exists():
        raise SystemExit(f"missing extract: {extract_path}")

    if args.class_name == "法师":
        raise SystemExit(
            "法师新增技能请使用: python scripts/apply_mage_missing_extract.py "
            f"(已允许门禁 {key}，但 HTML 结构需专用脚本)"
        )

    report = apply_bard_tier5(extract_path, dry_run=args.dry_run)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
