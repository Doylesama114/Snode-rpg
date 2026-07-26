# -*- coding: utf-8 -*-
"""
Extract 牧师神圣领域 tables from 牧师子分支/*.docx → scripts/extracts/牧师_domains.json
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    extract_paragraphs,
    extract_skill_block,
    is_section_break,
    skill_type_from_keywords,
)
from cleric_domain_config import DOMAIN_DOCX, docx_path, pantheon_for_json  # noqa: E402
from extract_class_docx import (  # noqa: E402
    cost_meta,
    dedupe_prefer_richer,
    discover_skill_names,
    is_valid_extracted_skill,
    looks_like_skill_name,
    repair_truncated_field_lines,
    walk_structured,
)

OUT = ROOT / "scripts" / "extracts" / "牧师_domains.json"
TIER_RE = re.compile(r"^([一二三四五六七八])阶天赋树")


def _find_idx(paras: list[dict], pred) -> int:
    for i, p in enumerate(paras):
        if pred(p["text"]):
            return i
    return -1


def parse_combat_styles(paras: list[dict]) -> list[str]:
    i = _find_idx(
        paras,
        lambda t: t in ("战斗风格", "【战斗风格说明】") or t.startswith("战斗风格"),
    )
    if i < 0:
        return []
    styles = []
    j = i + 1
    while j < len(paras):
        t = paras[j]["text"].strip()
        if t.startswith("-----") or is_section_break(t):
            j += 1
            continue
        if (
            t.startswith("起始特性")
            or t.endswith("天赋树")
            or t.startswith("你获得以下起始特性")
            or t.startswith("你可以从以下起始特性")
        ):
            break
        if (
            t.startswith("你能够拥有至多")
            or t.startswith("你仅拥有一种")
            or t.startswith("你在学习")
        ):
            j += 1
            continue
        if t.startswith("作为一名") or len(t) > 24:
            j += 1
            continue
        name = t.replace("风格", "") if t.endswith("风格") else t
        if name and (1 <= len(name) <= 8) and "：" not in name and not name.startswith("你"):
            if name not in styles:
                styles.append(name)
        j += 1
    return styles


def parse_initial_feats(paras: list[dict], names: set[str]) -> list[dict]:
    i0 = _find_idx(paras, lambda t: t == "初始专长" or t.startswith("初始专长"))
    i1 = _find_idx(
        paras,
        lambda t: t in ("战斗风格", "【战斗风格说明】") or t.startswith("战斗风格"),
    )
    if i0 < 0 or i1 < 0 or i1 <= i0:
        return []
    feats = []
    i = i0 + 1
    while i < i1:
        t = paras[i]["text"].strip()
        if t.startswith("-----") or is_section_break(t):
            i += 1
            continue
        if t.startswith("作为一名"):
            i += 1
            continue
        if not looks_like_skill_name(t) and not (2 <= len(t) <= 18 and "：" not in t):
            i += 1
            continue
        # feat body until next ----- or next short title
        name = t
        body = []
        i += 1
        while i < i1:
            nt = paras[i]["text"].strip()
            if nt.startswith("-----") or is_section_break(nt):
                i += 1
                break
            if looks_like_skill_name(nt) and len(nt) <= 18 and not nt.startswith("你"):
                # peek: if next lines look like body not skill fields, still feat
                break
            body.append(nt)
            i += 1
        feats.append(
            {
                "name": name,
                "style": "",
                "tier": "起始专长",
                "type": "专长",
                "fields": {},
                "cost": [],
                "cost_meta": [],
                "description": body,
                "level_upgrades": [],
                "flavor": [],
                "kind": "initial_feat",
            }
        )
        # if we broke on next title, don't advance past it
        if i < i1 and looks_like_skill_name(paras[i]["text"].strip()):
            continue
    # de-dupe by name keep first
    seen = set()
    out = []
    for f in feats:
        if f["name"] in seen:
            continue
        seen.add(f["name"])
        if f["description"]:
            out.append(f)
    return out


def normalize_paras(paras: list[dict]) -> list[dict]:
    """Avoid treating the「战斗风格」section title as a combat-style name."""
    out = []
    for p in paras:
        t = (p.get("text") or "").strip()
        if t == "战斗风格":
            out.append({**p, "text": "【战斗风格说明】"})
        else:
            out.append(p)
    return out


def enrich_styles(skills: list[dict], combat_styles: list[str]) -> list[str]:
    """Fix empty/误判 style; align combat_styles spelling with skill headers."""
    default = combat_styles[0] if len(combat_styles) == 1 else ""
    for s in skills:
        st = s.get("style") or ""
        if st == "战斗" or not st:
            if s.get("tier") in ("起始", "起始专长"):
                s["style"] = ""
            elif default:
                s["style"] = default
            else:
                s["style"] = ""
    # Prefer skill-header spellings when they differ by a lookalike glyph
    used = {s.get("style") for s in skills if s.get("style")}
    fixed = []
    for cs in combat_styles:
        if cs in used:
            fixed.append(cs)
            continue
        alt = next((u for u in used if u and abs(len(u) - len(cs)) <= 1 and u[0] == cs[0]), None)
        fixed.append(alt or cs)
    # keep unique order
    out = []
    for x in fixed:
        if x and x not in out:
            out.append(x)
    for u in used:
        if u and u not in out:
            out.append(u)
    return out


def extract_domain(deity: str) -> dict:
    path = docx_path(deity)
    paras = normalize_paras(extract_paragraphs(path))
    names = discover_skill_names(paras)
    combat_styles = parse_combat_styles(paras)
    feats = parse_initial_feats(paras, names)
    skills = walk_structured(paras, names)
    skills = [s for s in skills if is_valid_extracted_skill(s)]
    skills = dedupe_prefer_richer(skills)
    combat_styles = enrich_styles(skills, combat_styles)

    # Drop TOC-like name-only duplicates that appear before full blocks already handled by dedupe
    # Mark starting skills
    for s in skills:
        if s.get("tier") == "起始":
            s["kind"] = "starting"
        else:
            s["kind"] = "skill"
        s["deity"] = deity

    for f in feats:
        f["deity"] = deity

    return {
        "deity": deity,
        "source_file": str(path.relative_to(ROOT)).replace("\\", "/"),
        "combat_styles": combat_styles,
        "initial_feats": feats,
        "skills": skills,
        "skill_count": len(skills),
        "feat_count": len(feats),
    }


def main() -> None:
    domains = {}
    for deity in DOMAIN_DOCX:
        print(f"extract {deity} ...")
        domains[deity] = extract_domain(deity)
        d = domains[deity]
        print(
            f"  styles={d['combat_styles']} feats={d['feat_count']} skills={d['skill_count']}"
        )

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "domain_count": len(domains),
        },
        "pantheon": pantheon_for_json(),
        "domains": domains,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
