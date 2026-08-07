#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阶段 3：把 A/B 类表格写入职业页 HTML（只重建受影响的技能卡片）。

不会整体重跑 docx 同步，避免无关内容漂移；同时镜像 JSON/HTML 到 electron-app。
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import html as html_mod

from apply_class_extract import extract_to_block  # noqa: E402
from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    collect_roll_rows,
    detect_unit_blocks,
    patch_html,
    render_roll_tables_html,
    render_unit_tables_html,
    sanitize_data_search,
    tables_skip_lines,
    tier_label_from_skill,
)
from extract_unit_tables import A_SPECS, B_SPECS  # noqa: E402

DOMAIN_SKILLS = set(A_SPECS.get("牧师·神圣领域", {})) | set(B_SPECS.get("牧师·神圣领域", []))


def affected_names(cls: str) -> list[str]:
    names = list(A_SPECS.get(cls, {}))
    names += [n for n in B_SPECS.get(cls, []) if n not in names]
    return names


def mirror(rel: Path) -> None:
    dst = ROOT / "electron-app" / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / rel, dst)


def patch_base_class(cls: str) -> int:
    json_path = ROOT / "职业页" / "数据" / f"{cls}.json"
    html_path = ROOT / "职业页" / f"{cls}.html"
    data = json.loads(json_path.read_text(encoding="utf-8"))
    html = html_path.read_text(encoding="utf-8")
    by_name: dict[str, list[dict]] = {}
    for sk in data.get("skills") or []:
        by_name.setdefault(sk.get("name"), []).append(sk)

    patched = 0
    for name in affected_names(cls):
        for sk in by_name.get(name, []):
            sid = sk["id"]
            if f'id="{sid}"' not in html:
                print(f"  !! {cls} {name}: article {sid} not found")
                continue
            block = extract_to_block(sk)
            mark_dots = []
            for c in block.get("mark_dots") or []:
                if isinstance(c, dict):
                    mark_dots.extend([c["color"]] * c.get("count", 1))
                else:
                    mark_dots.append(c)
            block["mark_dots"] = mark_dots
            tables = {
                "unit_tables": sk.get("unit_tables") or [],
                "roll_tables": sk.get("roll_tables") or [],
            }
            detail = build_detail_html(block, tables)
            tier_lbl = tier_label_from_skill(sk)
            data_search = build_data_search(
                block, sk.get("style") or "", tier_lbl, sk.get("tags") or []
            )
            data_search = append_tables_to_search(data_search, sk)
            data_attrs = build_skill_data_attrs(sk, block.get("mark_dots") or [], cls)
            html = patch_html(html, sid, detail, data_search, data_attrs)
            patched += 1
    if patched:
        html_path.write_text(html, encoding="utf-8")
        mirror(Path("职业页") / f"{cls}.html")
        mirror(json_path.relative_to(ROOT))
        print(f"{cls}: patched {patched} skill card(s)")
    else:
        print(f"{cls}: nothing patched")
    return patched


def patch_domains() -> int:
    json_path = ROOT / "职业页" / "数据" / "牧师·神圣领域.json"
    html_path = ROOT / "职业页" / "牧师.html"
    data = json.loads(json_path.read_text(encoding="utf-8"))
    html = html_path.read_text(encoding="utf-8")
    patched = 0
    for deity, dom in data.get("domains", {}).items():
        for sk in dom.get("skills") or []:
            name = sk.get("name")
            if name not in DOMAIN_SKILLS:
                continue
            sid = sk["id"]
            if f'id="{sid}"' not in html:
                print(f"  !! {deity} {name}: article {sid} not found")
                continue
            block = extract_to_block(sk)
            mark_dots = []
            for c in block.get("mark_dots") or []:
                if isinstance(c, dict):
                    mark_dots.extend([c["color"]] * c.get("count", 1))
                else:
                    mark_dots.append(c)
            block["mark_dots"] = mark_dots
            tables = {
                "unit_tables": sk.get("unit_tables") or [],
                "roll_tables": sk.get("roll_tables") or [],
            }
            detail = build_detail_html(block, tables)
            if not (block.get("fields") or {}) and (block.get("description") or []):
                # 起始专长：效果块渲染（剔除表格行），再追加表格
                skip = tables_skip_lines(tables["unit_tables"], tables["roll_tables"])
                for blk in detect_unit_blocks(block.get("description") or []):
                    skip.update(ln.strip() for ln in blk["lines"] if ln.strip())
                for row in collect_roll_rows(block.get("description") or []):
                    skip.update(x.strip() for x in row["raw"].split("\n") if x.strip())
                paras = "".join(
                    f'<div class="effect-cell">{html_mod.escape(p)}</div>'
                    for p in block["description"]
                    if p.strip() and p.strip() not in skip
                )
                detail = (
                    paras
                    + render_unit_tables_html(tables["unit_tables"])
                    + render_roll_tables_html(tables["roll_tables"])
                )
            style = sk.get("style") or ""
            tier = sk.get("tier") or ""
            tier_label = f"{tier}天赋树" if tier and "阶" in tier else (tier or "")
            data_search = build_data_search(
                block, style or deity, tier_label, sk.get("tags") or []
            )
            data_search = f"{deity} {data_search}"
            data_search = append_tables_to_search(data_search, sk)
            data_attrs = build_skill_data_attrs(sk, block.get("mark_dots") or [], "牧师")
            html = patch_html(html, sid, detail, data_search, data_attrs)
            html = html.replace(
                f'<article class="skill" id="{sid}"',
                f'<article class="skill" id="{sid}" data-deity="{deity}"',
                1,
            )
            patched += 1
    if patched:
        html_path.write_text(html, encoding="utf-8")
        mirror(Path("职业页") / "牧师.html")
        mirror(json_path.relative_to(ROOT))
        print(f"牧师·神圣领域: patched {patched} skill card(s)")
    return patched


def main() -> None:
    total = 0
    for cls in A_SPECS:
        if cls == "牧师·神圣领域":
            continue
        total += patch_base_class(cls)
    total += patch_domains()
    # 同步公共样式
    mirror(Path("职业页") / "common.css")
    print(f"TOTAL patched: {total}")


if __name__ == "__main__":
    main()
