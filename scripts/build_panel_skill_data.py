#!/usr/bin/env python3
"""Rebuild SKILL_DATA in 斯诺德跑团/panel_data.js from 职业页/数据/*.json."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DATA = ROOT / "斯诺德跑团" / "panel_data.js"
ELECTRON_PANEL = ROOT / "electron-app" / "斯诺德跑团" / "panel_data.js"
DATA_DIR = ROOT / "职业页" / "数据"

# JSON filename → SKILL_DATA key (panel uses 通用 not 通用天赋树)
CLASS_MAP: dict[str, str] = {
    "蛮斗士": "蛮斗士",
    "吟游诗人": "吟游诗人",
    "圣骑士": "圣骑士",
    "德鲁伊": "德鲁伊",
    "战士": "战士",
    "术士": "术士",
    "武僧": "武僧",
    "法师": "法师",
    "游荡者": "游荡者",
    "牧师": "牧师",
    "猎人": "猎人",
    "萨满祭司": "萨满祭司",
    "通用天赋树": "通用",
    "魔契师": "魔契师",
    "奇械师": "奇械师",
}

SKIP_JSON = {
    "classes", "style_mappings", "color_definitions", "level_up", "backgrounds",
    "races", "items", "equipment", "equipment_catalog", "materials", "ores",
    "herbs", "potions", "scrolls", "gadgets", "magic_services", "bg_personality",
    "特殊专长", "通用·进阶",
}

PANEL_SKILL_KEYS = (
    "id", "name", "type", "style", "tier", "tags", "fields", "cost",
    "description", "flavor", "level_upgrades", "field_runs", "description_entries",
    "grants", "color", "composite", "choices",
)


def tier_to_panel(tier) -> str | int | None:
    if tier is None:
        return None
    if isinstance(tier, int):
        cn = "一二三四五六七八九"
        if 1 <= tier <= 9:
            return f"{cn[tier - 1]}阶"
        return tier
    return tier


def json_skill_to_panel(skill: dict) -> dict:
    out: dict = {}
    for key in PANEL_SKILL_KEYS:
        if key in skill and skill[key] not in (None, [], {}, ""):
            out[key] = skill[key]
    out["name"] = skill["name"]
    out["id"] = skill["id"]
    if "tags" not in out and skill.get("fields", {}).get("关键词"):
        out["tags"] = [t for t in skill["fields"]["关键词"].split(".") if t]
    if "tier" in skill:
        out["tier"] = tier_to_panel(skill["tier"])
    return out


def load_old_skill_data(text: str) -> dict:
    start = text.index("SKILL_DATA = ")
    end = text.index("const STYLE_MAP", start)
    blob = text[start + len("SKILL_DATA = ") : end].strip().rstrip(";")
    return json.loads(blob)


def merge_class(old_skills: list[dict], new_skills: list[dict]) -> list[dict]:
    """JSON is source of truth; keep old panel-only entries (starting/composite/etc.)."""
    by_id = {s["id"]: json_skill_to_panel(s) for s in new_skills}
    json_ids = set(by_id)
    extra_types = {"starting", "upgrade", "granted", "composite"}
    merged = list(by_id.values())
    for s in old_skills:
        sid = s.get("id")
        if sid in json_ids:
            continue
        if s.get("type") in extra_types or sid and sid.endswith("-starting"):
            merged.append(s)
    return merged


def build_skill_data(old: dict) -> dict:
    out: dict = {}
    for json_name, panel_key in CLASS_MAP.items():
        path = DATA_DIR / f"{json_name}.json"
        if not path.exists():
            if panel_key in old:
                out[panel_key] = old[panel_key]
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        skills = doc.get("skills") or []
        old_skills = old.get(panel_key, [])
        out[panel_key] = merge_class(old_skills, skills)
    for key, skills in old.items():
        if key not in out:
            out[key] = skills
    return out


def patch_panel_data(path: Path, skill_data: dict) -> None:
    text = path.read_text(encoding="utf-8")
    start = text.index("SKILL_DATA = ")
    end = text.index("const STYLE_MAP", start)
    prefix = text[:start]
    suffix = text[end:]
    new_blob = json.dumps(skill_data, ensure_ascii=False, separators=(",", ":"))
    new_text = f"{prefix}SKILL_DATA = {new_blob};\n{suffix}"
    path.write_text(new_text, encoding="utf-8")


def main() -> None:
    text = PANEL_DATA.read_text(encoding="utf-8")
    old = load_old_skill_data(text)
    new = build_skill_data(old)
    patch_panel_data(PANEL_DATA, new)
    if ELECTRON_PANEL.parent.exists():
        shutil.copy2(PANEL_DATA, ELECTRON_PANEL)
    med = next(s for s in new["通用"] if s["name"] == "冥想")
    report = {
        "classes": len(new),
        "skills_total": sum(len(v) for v in new.values()),
        "meditation_has_field_runs": "field_runs" in med,
        "meditation_cost": med.get("cost"),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
