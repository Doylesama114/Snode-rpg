#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""数据一致性校验：职业页/数据/*.json vs panel_data.js SKILL_DATA vs skill_effects_*.json
用法: python scripts/verify_panel_data_sync.py
退出码 0=一致, 1=有差异
"""
from __future__ import annotations

import glob
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DATA = ROOT / "斯诺德跑团" / "panel_data.js"
DATA_DIR = ROOT / "职业页" / "数据"
EFFECTS_DIR = ROOT / "斯诺德跑团"

BASE_CLASSES = [
    "蛮斗士", "战士", "法师", "猎人", "牧师", "圣骑士", "游荡者",
    "德鲁伊", "萨满祭司", "术士", "武僧", "吟游诗人", "魔契师", "奇械师",
]

CLASS_JSON_FILES = {c: DATA_DIR / f"{c}.json" for c in BASE_CLASSES}
CLASS_JSON_FILES["通用天赋树"] = DATA_DIR / "通用天赋树.json"

# 职业页 JSON 文件名 → SKILL_DATA 键名（panel 用 通用 而非 通用天赋树）
JSON_TO_SKILL_KEY = {c: c for c in BASE_CLASSES}
JSON_TO_SKILL_KEY["通用天赋树"] = "通用"

# 合理例外白名单：通用天赋树 effects 中的"抉择X"提示卡（HTML 提示卡保留，不入 JSON/索引）
EFFECTS_ALLOWLIST_PREFIXES = ("抉择",)


def norm_style(s: str) -> str:
    s = str(s or "").strip()
    if s.endswith("风格"):
        s = s[:-2]
    return s


def norm_tier(t) -> str:
    s = str(t or "").strip()
    if s in ("起始", "起始特性"):
        return "一阶"
    s = re.sub(r"天赋树.*$", "", s)
    s = re.sub(r"[（(]\d+[）)]", "", s).strip()
    return s


def json_skill_tier(j: dict) -> str:
    """JSON 侧 tier：起始特性技能（type=starting）tier 缺失时语义等同 一阶。"""
    t = j.get("tier")
    if not t and j.get("type") == "starting":
        return "一阶"
    return norm_tier(t)


def sd_skill_tier(s: dict) -> str:
    """SKILL_DATA/effects 侧 tier：同样将 starting 类型缺失 tier 视作 一阶。"""
    t = s.get("tier")
    if not t and s.get("type") == "starting":
        return "一阶"
    return norm_tier(t)


def parse_skill_data() -> dict:
    text = PANEL_DATA.read_text(encoding="utf-8")
    m = re.search(r"var SKILL_DATA = (\{.*?\});\s*$", text, re.M)
    if not m:
        raise ValueError("SKILL_DATA not found in panel_data.js")
    return json.loads(m.group(1))


def load_class_json(cls: str) -> dict:
    path = CLASS_JSON_FILES[cls]
    if not path.exists():
        return {"missing": True}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data


def load_effects(cls: str) -> list:
    path = EFFECTS_DIR / f"skill_effects_{cls}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    key = cls
    return data.get(key, data if isinstance(data, list) else [])


def skill_map(skills: list, key) -> dict:
    out = {}
    for s in skills or []:
        name = s.get("name") or s.get("n")
        if not name:
            continue
        out[name] = s
    return out


def main() -> int:
    errors: list[str] = []
    sd = parse_skill_data()

    # ========== A: 职业页 JSON vs SKILL_DATA（同源，期望 0 差异） ==========
    for cls in list(CLASS_JSON_FILES):
        jd = load_class_json(cls)
        if jd.get("missing"):
            errors.append(f"[A] 职业页/数据/{cls}.json 缺失")
            continue
        sd_key = JSON_TO_SKILL_KEY[cls]
        j_skills = skill_map(jd.get("skills", []), "name")
        sd_skills = skill_map(sd.get(sd_key, []), "name")
        only_json = sorted(set(j_skills) - set(sd_skills))
        only_sd = sorted(set(sd_skills) - set(j_skills))
        if only_json:
            errors.append(f"[A] {cls}: 职业页 JSON 有但 SKILL_DATA 缺 {len(only_json)}: {only_json[:8]}")
        if only_sd:
            errors.append(f"[A] {cls}: SKILL_DATA 有但职业页 JSON 缺 {len(only_sd)}: {only_sd[:8]}")
        for name in sorted(set(j_skills) & set(sd_skills)):
            j, s = j_skills[name], sd_skills[name]
            if norm_style(j.get("style")) != norm_style(s.get("style")):
                errors.append(f"[A] {cls}/{name}: style 不一致 JSON={j.get('style')!r} SKILL_DATA={s.get('style')!r}")
            if json_skill_tier(j) != sd_skill_tier(s):
                errors.append(f"[A] {cls}/{name}: tier 不一致 JSON={j.get('tier')!r} SKILL_DATA={s.get('tier')!r}")

    # ========== B: 职业页 JSON vs skill_effects ==========
    for cls in list(CLASS_JSON_FILES):
        jd = load_class_json(cls)
        if jd.get("missing"):
            continue
        eff = load_effects(cls)
        if eff is None:
            errors.append(f"[B] {cls}: skill_effects_{cls}.json 缺失")
            continue
        j_skills = skill_map(jd.get("skills", []), "name")
        e_skills = skill_map(eff, "name")
        only_json = sorted(set(j_skills) - set(e_skills))
        only_eff = sorted(
            n for n in (set(e_skills) - set(j_skills))
            if not n.startswith(EFFECTS_ALLOWLIST_PREFIXES)
        )
        if only_json:
            errors.append(f"[B] {cls}: 职业页 JSON 有但 effects 缺 {len(only_json)}: {only_json[:10]}")
        if only_eff:
            errors.append(f"[B] {cls}: effects 有但职业页 JSON 缺 {len(only_eff)}: {only_eff[:10]}")
        for name in sorted(set(j_skills) & set(e_skills)):
            j, e = j_skills[name], e_skills[name]
            if norm_style(j.get("style")) != norm_style(e.get("style")):
                errors.append(f"[B] {cls}/{name}: style 不一致 JSON={j.get('style')!r} effects={e.get('style')!r}")
            if json_skill_tier(j) != sd_skill_tier(e):
                errors.append(f"[B] {cls}/{name}: tier 不一致 JSON={j.get('tier')!r} effects={e.get('tier')!r}")

    # ========== 统计 ==========
    total_json = sum(len(load_class_json(c).get("skills", [])) for c in CLASS_JSON_FILES)
    total_sd = sum(len(v) for v in sd.values())
    total_eff = sum(len(load_effects(c) or []) for c in CLASS_JSON_FILES)

    print(f"技能数统计: 职业页JSON={total_json} SKILL_DATA={total_sd} skill_effects={total_eff}")
    if errors:
        print(f"FAIL: {len(errors)} 处差异")
        for e in errors[:80]:
            print(" -", e)
        if len(errors) > 80:
            print(f" ... 其余 {len(errors) - 80} 条省略")
        return 1
    print("PASS: 三数据源完全一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
