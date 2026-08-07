#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复 fields.描述 被研发材料行误占用的技能，并重建对应页面。

背景：docx 中部分图纸技能没有“描述：”行，同步逻辑曾把正文首行
（研发材料：...）误写入 fields.描述，导致页面显示“描述：研发材料：...”。
这里把研发材料行放回 description（研发时间前），fields.描述 置空。
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from apply_class_extract import extract_to_block  # noqa: E402
from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    json_to_fx_entry,
    patch_html,
    tier_label_from_skill,
)

ROOT = Path(__file__).resolve().parent.parent

CLASSES = ["奇械师", "猎人"]


def fix_skill(sk: dict) -> bool:
    fields = sk.get("fields") or {}
    mat_line = (fields.get("描述") or "").strip()
    if not mat_line.startswith("研发材料"):
        return False
    fields["描述"] = ""
    sk["fields"] = fields
    desc = sk.get("description") or []
    if not any(x.startswith("研发材料") for x in desc):
        idx = next((i for i, x in enumerate(desc) if x.startswith("研发时间")), None)
        if idx is None:
            idx = next((i for i, x in enumerate(desc) if x.startswith("参考价格")), 0)
        desc.insert(idx, mat_line)
        sk["description"] = desc
    return True


def rebuild_class(cls: str) -> list[str]:
    data_path = ROOT / f"职业页/数据/{cls}.json"
    html_path = ROOT / f"职业页/{cls}.html"
    fx_path = ROOT / f"斯诺德跑团/skill_effects_{cls}.json"

    data = json.loads(data_path.read_text(encoding="utf-8"))
    fixed = [sk["name"] for sk in data["skills"] if fix_skill(sk)]
    if not fixed:
        print(f"{cls}: 无修复项")
        return []

    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{cls}: 修复 {len(fixed)} 个技能: {fixed}")

    html = html_path.read_text(encoding="utf-8")
    missing_ids = []
    for sk in data["skills"]:
        if sk.get("name") not in fixed:
            continue
        sid = sk["id"]
        if f'id="{sid}"' not in html:
            missing_ids.append(sid)
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
    html_path.write_text(html, encoding="utf-8")
    if missing_ids:
        print(f"  !! {cls} 页面未找到卡片: {missing_ids}")

    fx = {cls: [json_to_fx_entry(s, cls) for s in data["skills"]]}
    fx_path.write_text(json.dumps(fx, ensure_ascii=False, indent=2), encoding="utf-8")

    for rel in [
        f"职业页/{cls}.html",
        f"职业页/数据/{cls}.json",
        f"斯诺德跑团/skill_effects_{cls}.json",
    ]:
        dst = ROOT / "electron-app" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dst)

    print(f"{cls}: HTML/skill_effects/electron-app 已同步")
    return fixed


def main() -> None:
    all_fixed: list[str] = []
    for cls in CLASSES:
        all_fixed.extend(rebuild_class(cls))
    if all_fixed:
        subprocess.check_call(
            ["node", str(ROOT / "scripts/build_class_search_index.js")],
            cwd=str(ROOT),
        )
        for rel in ["职业页/search-index.json", "职业页/search-index.js"]:
            shutil.copy2(ROOT / rel, ROOT / "electron-app" / rel)
        print("搜索索引已重建并镜像")
    print(f"共修复 {len(all_fixed)} 个技能")


if __name__ == "__main__":
    main()
