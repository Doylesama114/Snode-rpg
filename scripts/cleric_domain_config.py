# -*- coding: utf-8 -*-
"""牧师神圣领域神祇名单与 docx 映射（权威：基础职业-牧师.docx）。"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOMAIN_DIR = ROOT / "牧师子分支"

# Official pantheon from 基础职业-牧师.docx「神圣领域」
OFFICIAL_PANTHEON: list[dict] = [
    {"name": "公正与荣耀之神", "attr": "神圣", "id": "glory"},
    {"name": "生命与丰收之神", "attr": "自然", "id": "life"},
    {"name": "火焰与锻造之神", "attr": "火焰", "id": "forge"},
    {"name": "战争与谋略之神", "attr": "物理", "id": "war"},
    {"name": "知识与智慧之神", "attr": "奥术", "id": "lore"},
    {"name": "艺术与创造之神", "attr": "音爆", "id": "art"},
    {"name": "死神", "attr": "无属性", "id": "death"},
    {"name": "无尽饥饿与吞噬之神", "attr": "暗影", "id": "hunger"},
    {
        "name": "爱、欲望与激情之神",
        "attr": "心灵",
        "id": "love",
        "aliases": ["爱、激情与欢愉之神"],
    },
    {"name": "潮汐、引力与崩坏之神", "attr": "力场", "id": "tide"},
]

# Extra deities with domain tables but not in official 10
EXTRA_DEITIES: list[dict] = [
    {"name": "幸运女神", "attr": "", "id": "luck"},
    {"name": "隐秘与变化之神", "attr": "", "id": "secret"},
]

# Canonical deity name -> source docx under 牧师子分支/
DOMAIN_DOCX: dict[str, str] = {
    "生命与丰收之神": "神圣领域-生命与丰收之神.docx",
    "战争与谋略之神": "神圣领域-战争与谋略之神.docx",
    "知识与智慧之神": "神圣领域-知识与智慧之神.docx",
    "艺术与创造之神": "神圣领域-艺术与创造之神.docx",
    "爱、欲望与激情之神": "神圣领域-爱、激情与欢愉之神.docx",
    "幸运女神": "神圣领域-幸运女神（争锋模式）.docx",
    "隐秘与变化之神": "神圣领域-隐秘与变化之神（争锋模式）.docx",
    "无尽饥饿与吞噬之神": "神圣领域-无尽饥饿与吞噬之神.docx",
}


def all_deities() -> list[dict]:
    return list(OFFICIAL_PANTHEON) + list(EXTRA_DEITIES)


def pantheon_for_json() -> list[dict]:
    unlocked = set(DOMAIN_DOCX)
    out = []
    for d in all_deities():
        row = {
            "id": d["id"],
            "name": d["name"],
            "attr": d.get("attr") or "",
            "locked": d["name"] not in unlocked,
            "official": d["name"] in {x["name"] for x in OFFICIAL_PANTHEON},
        }
        if d.get("aliases"):
            row["aliases"] = list(d["aliases"])
        if d["name"] in DOMAIN_DOCX:
            row["source"] = DOMAIN_DOCX[d["name"]]
        out.append(row)
    return out


def docx_path(deity_name: str) -> Path:
    return DOMAIN_DIR / DOMAIN_DOCX[deity_name]
