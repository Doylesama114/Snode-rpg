#!/usr/bin/env python3
"""Fix warrior skill_effects ID drift and fill gaps from 战士.json."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "职业页" / "数据" / "战士.json"
FX_PATH = ROOT / "斯诺德跑团" / "skill_effects_战士.json"
ELECTRON_FX = ROOT / "electron-app" / "斯诺德跑团" / "skill_effects_战士.json"

HEX2SP = {
    "#FF0000": "红",
    "#EE822F": "橙",
    "#FFF32F": "黄",
    "#00B050": "绿",
    "#00FA99": "青",
    "#00B0F0": "蓝",
    "#B3F9FF": "浅",
    "#B94BFF": "紫",
    "#FFB7E3": "粉",
    "#843F0B": "棕",
    "#FFFFFF": "白",
    "#595959": "黑",
    "#D9D9D9": "无",
}

# Old fx id → canonical HTML/JSON id (same skill name, renumbered tier slots)
ID_RENAMES = {
    "w-skill-4-4-3": "w-skill-4-4-4",
    "w-skill-4-4-4": "w-skill-4-4-6",
    "w-skill-5-5-2": "w-skill-5-5-3",
    "w-skill-5-5-3": "w-skill-5-5-5",
    "w-skill-5-5-4": "w-skill-5-5-7",
    "w-skill-5-5-5": "w-skill-5-5-8",
    "w-skill-6-6-5": "w-skill-6-6-6",
}

CHOICE_GROUP = "抉择·选择其中两项习得：龙卷风射击/陆行鲨之咬/天鹅湖之匕"


def sp_from_cost(cost_list: list[dict]) -> list[str]:
    out = []
    for item in cost_list:
        name = HEX2SP.get(item.get("color", ""), "无")
        out.extend([name] * item.get("count", 1))
    return out


def skill_type(keywords: str) -> str:
    if not keywords:
        return "战技"
    head = keywords.split(".")[0]
    return head if head in ("战技", "法术", "天赋", "战术", "能力") else "战技"


def tier_label(tier) -> str:
    if isinstance(tier, int):
        cn = "一二三四五六七八"[tier - 1] if 1 <= tier <= 8 else str(tier)
        return f"{cn}阶天赋树"
    if tier and str(tier).endswith("阶"):
        return f"{tier}天赋树"
    return str(tier or "")


def style_label(style: str) -> str:
    return style if style.endswith("风格") else f"{style}风格"


def build_effects(skill: dict, existing: dict | None) -> list[str]:
    if existing and existing.get("effects"):
        return existing["effects"]
    parts = []
    fields = skill.get("fields", {})
    if fields.get("描述"):
        parts.append(fields["描述"])
    parts.extend(skill.get("description") or [])
    for u in skill.get("level_upgrades") or []:
        parts.append(f"L{u['level']}: {u['text']}")
    return [p for p in parts if p.strip()]


def json_to_fx(skill: dict, existing: dict | None) -> dict:
    fields = skill.get("fields", {})
    kw = fields.get("关键词", "")
    tags = skill.get("tags") or []
    st = style_label(skill.get("style", ""))
    tier = tier_label(skill.get("tier"))
    tp = skill_type(kw)

    entry: dict = {
        "id": skill["id"],
        "name": skill["name"],
        "class": "战士",
        "style": st,
        "tier": tier,
        "type": tp,
        "tags": tags,
        "cost": {},
        "effects": build_effects(skill, existing),
    }

    fp = fields.get("疲劳消耗")
    if fp and fp != "-":
        try:
            entry["cost"]["fp"] = int(fp)
        except ValueError:
            pass

    sp = sp_from_cost(skill.get("cost") or [])
    if sp:
        entry["cost"]["sp"] = sp

    cast_fields = ("施展时间", "施展距离", "持续时间")
    cast = {}
    for fk, ck in zip(cast_fields, ("time", "range", "duration")):
        if fields.get(fk) and fields[fk] != "-":
            cast[ck] = fields[fk]
    if cast:
        entry["cast"] = cast
    elif existing and existing.get("cast"):
        entry["cast"] = existing["cast"]

    for jk, fk in (
        ("prerequisite", "前置条件"),
        ("extra_condition", "额外条件"),
        ("requirement", "施展条件"),
        ("restriction", "施展限制"),
    ):
        if fields.get(fk) and fields[fk] != "-":
            entry[jk] = fields[fk]

    upgrades = skill.get("level_upgrades") or []
    if upgrades:
        entry["upgrades"] = [{"level": u["level"], "change": u["text"]} for u in upgrades]
    elif existing and existing.get("upgrades"):
        entry["upgrades"] = existing["upgrades"]

    if skill["id"] in ("w-skill-6-6-2", "w-skill-6-6-3", "w-skill-6-6-4"):
        entry["choices_from"] = CHOICE_GROUP
    elif existing and existing.get("choices_from"):
        entry["choices_from"] = existing["choices_from"]

    return entry


def apply_renames(fx_list: list[dict]) -> list[dict]:
    """Rename ids in two passes via temporary suffix to avoid collisions."""
    by_id = {e["id"]: e for e in fx_list}
    temp: dict[str, dict] = {}
    for old, new in ID_RENAMES.items():
        if old in by_id:
            e = by_id.pop(old)
            e["id"] = new + "__tmp"
            temp[new + "__tmp"] = e
    for e in temp.values():
        e["id"] = e["id"].replace("__tmp", "")
        by_id[e["id"]] = e
    return list(by_id.values())


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fx_doc = json.loads(FX_PATH.read_text(encoding="utf-8"))
    fx_list = apply_renames(fx_doc["战士"])

    by_id = {e["id"]: e for e in fx_list}
    by_name = {e["name"]: e for e in fx_list}

    json_ids = {s["id"] for s in data["skills"]}
    updated = []
    added = []

    for skill in data["skills"]:
        sid = skill["id"]
        existing = by_id.get(sid) or by_name.get(skill["name"])
        entry = json_to_fx(skill, existing)
        if not entry["effects"] and sid == "w-skill-6-6-2":
            entry["effects"] = [
                "抉择技能（从龙卷风射击/陆行鲨之咬/天鹅湖之匕中选2项）",
                "消耗一发箭矢或弹药对一名角色发起三次攻击，每次结算后附加1×敏捷调整值",
                "无论命中与否，目标周围4米内所有角色DC15力量豁免，失败被拖拽至目标相邻位置",
            ]
        if sid in by_id:
            by_id[sid] = entry
            updated.append(sid)
        else:
            by_id[sid] = entry
            added.append(sid)

    # Drop fx entries whose ids are not in JSON (orphaned renumber slots)
    final = [by_id[sid] for sid in sorted(by_id.keys()) if sid in json_ids]
    # preserve starting skills + others: include all json ids only
    final = [by_id[s["id"]] for s in data["skills"] if s["id"] in by_id]

    missing = sorted(json_ids - {e["id"] for e in final})
    fx_doc["战士"] = final
    FX_PATH.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    ELECTRON_FX.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(FX_PATH, ELECTRON_FX)

    report = {
        "fx_entries": len(final),
        "json_skills": len(data["skills"]),
        "added": added,
        "updated_from_json": len(updated),
        "still_missing": missing,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
