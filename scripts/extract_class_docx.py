#!/usr/bin/env python3
"""
Universal class skill extractor from 基础职业-*.docx.

Discovers ALL skills (does not require existing JSON name list).
Writes isomorphic intermediate JSON for diff / apply / tests.

Usage:
  python scripts/extract_class_docx.py --class 吟游诗人
  python scripts/extract_class_docx.py --class 吟游诗人 --out scripts/extracts/吟游诗人.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    COLOR_TABLE,
    FIELD_ORDER,
    HEX2NAME,
    LEVEL_RE,
    LEVEL_RE2,
    TYPE_HEADS,
    build_docx_index,
    extract_paragraphs,
    extract_skill_block,
    is_boilerplate_line,
    is_section_break,
    split_field,
    skill_type_from_keywords,
)

TIER_RE = re.compile(r"^([一二三四五六七八])阶天赋树")
STYLE_RE_MAX = 16

# Docx sometimes splits the first glyph of a field label into a colored run (e.g. 施+展条件)
_TRUNCATED_FIELD = re.compile(
    r"^(?:展条件|展限制|展时间|展距离)：(.*)$"
)
_TRUNCATED_MAP = {
    "展条件": "施展条件",
    "展限制": "施展限制",
    "展时间": "施展时间",
    "展距离": "施展距离",
}


def repair_truncated_field_lines(block: dict) -> None:
    fields = block.setdefault("fields", {})
    desc = list(block.get("description") or [])
    kept = []
    for line in desc:
        m = _TRUNCATED_FIELD.match(line.strip())
        if not m:
            kept.append(line)
            continue
        key = _TRUNCATED_MAP[line.strip().split("：", 1)[0]]
        if key not in fields or not fields[key]:
            fields[key] = m.group(1).strip()
        # drop mangled line from description
    block["description"] = kept
    # also scrub description_entries
    entries = []
    for e in block.get("description_entries") or []:
        t = (e.get("text") or "").strip()
        if _TRUNCATED_FIELD.match(t):
            continue
        entries.append(e)
    if "description_entries" in block:
        block["description_entries"] = entries


def cost_meta(dots: list[str]) -> list[dict]:
    out = []
    for hex_c in dots:
        out.append({"hex": hex_c, "name": HEX2NAME.get(hex_c, hex_c)})
    return out


def looks_like_skill_name(text: str) -> bool:
    t = text.strip()
    if not t or len(t) > 18:
        return False
    if "：" in t or ":" in t:
        return False
    if is_section_break(t) or is_boilerplate_line(t):
        return False
    if t.startswith("-----"):
        return False
    if t.startswith("你的") and (LEVEL_RE.match(t) or LEVEL_RE2.match(t)):
        return False
    if t.endswith("风格") and "天赋树" not in t and len(t) <= STYLE_RE_MAX:
        return False
    if TIER_RE.match(t):
        return False
    if t in ("起始特性", "战斗风格", "天赋树"):
        return False
    if split_field(t)[0]:
        return False
    if re.search(r"\dD\d|[０-９]|点伤害|豁免失败|经验值", t):
        return False
    if t.count(" ") >= 3 and "●" not in t:
        return False
    return True


def is_valid_extracted_skill(skill: dict) -> bool:
    fields = skill.get("fields") or {}
    if fields.get("关键词") or fields.get("施展时间"):
        return True
    if skill.get("cost") and (fields.get("前置条件") or fields.get("额外条件")):
        return True
    return False


def dedupe_prefer_richer(skills: list[dict]) -> list[dict]:
    """Keep richer block when same name/style/tier appears twice."""
    best: dict[tuple, dict] = {}
    order: list[tuple] = []
    for s in skills:
        key = (s.get("name"), s.get("style"), s.get("tier"), s.get("choice_group") or "")
        score = (
            1 if (s.get("fields") or {}).get("关键词") else 0,
            1 if (s.get("fields") or {}).get("施展时间") else 0,
            len(s.get("cost") or []),
            len(s.get("fields") or {}),
            len(s.get("description") or []),
        )
        if key not in best:
            best[key] = s
            order.append(key)
        else:
            prev = best[key]
            prev_score = (
                1 if (prev.get("fields") or {}).get("关键词") else 0,
                1 if (prev.get("fields") or {}).get("施展时间") else 0,
                len(prev.get("cost") or []),
                len(prev.get("fields") or {}),
                len(prev.get("description") or []),
            )
            if score > prev_score:
                best[key] = s
    return [best[k] for k in order]


def has_skill_anchors(paras: list[dict], start: int) -> bool:
    far = [paras[i]["text"] for i in range(start + 1, min(start + 14, len(paras)))]
    near = far[:5]
    has_time = any(w.startswith("施展时间：") for w in near)
    has_kw = any(w.startswith("关键词：") for w in far[:8])
    has_mark = any(w.startswith(("标识：", "费用：")) for w in far[:8])
    has_pre = any(w.startswith(("前置条件：", "额外条件：")) for w in far[:6])
    return bool(has_time or (has_kw and (has_mark or has_pre or has_time)))


def discover_skill_names(paras: list[dict]) -> set[str]:
    names: set[str] = set()
    for i, p in enumerate(paras):
        text = p["text"]
        if not looks_like_skill_name(text):
            continue
        if has_skill_anchors(paras, i):
            names.add(text)
    return names


def walk_structured(paras: list[dict], names: set[str]) -> list[dict]:
    """Emit skill blocks with style/tier/source from docx structure."""
    skills: list[dict] = []
    current_style = ""
    current_tier = ""
    choice_group = ""
    seen_sigs: set[tuple] = set()

    i = 0
    while i < len(paras):
        text = paras[i]["text"]

        if (
            text.endswith("风格")
            and "天赋树" not in text
            and len(text) <= STYLE_RE_MAX
            and "：" not in text
        ):
            current_style = text.replace("风格", "")
            choice_group = ""
            i += 1
            continue

        m_tier = TIER_RE.match(text)
        if m_tier:
            current_tier = m_tier.group(1) + "阶"
            choice_group = ""
            i += 1
            continue

        if text.strip() in ("起始特性",) or text.startswith("起始特性"):
            current_tier = "起始"
            i += 1
            continue

        if text.startswith("抉择："):
            choice_group = text[len("抉择：") :].strip() or "抉择"
            i += 1
            continue

        if text not in names:
            i += 1
            continue

        block = extract_skill_block(paras, i, names)
        if not block:
            i += 1
            continue
        repair_truncated_field_lines(block)

        style = current_style
        tier = current_tier or "未知"
        sig = (
            block["name"],
            style,
            tier,
            json.dumps(block["fields"], sort_keys=True, ensure_ascii=False),
            tuple(block["mark_dots"]),
        )
        if sig in seen_sigs:
            # skip exact duplicate parse
            i += 1
            continue
        seen_sigs.add(sig)

        kw = block["fields"].get("关键词", "")
        skill = {
            "name": block["name"],
            "style": style,
            "tier": tier,
            "type": skill_type_from_keywords(kw),
            "fields": block["fields"],
            "cost": list(block["mark_dots"]),
            "cost_meta": cost_meta(block["mark_dots"]),
            "description": block["description"],
            "level_upgrades": block["level_upgrades"],
            "flavor": block["flavor"],
            "field_runs": block.get("field_runs") or {},
            "description_entries": [
                {"text": e["text"], "runs": e.get("runs") or []}
                for e in (block.get("description_entries") or [])
            ],
            "source": {
                "kind": "docx",
                "para_start": i,
                "style_ctx": style,
                "tier_ctx": tier,
            },
        }
        if choice_group:
            skill["choice_group"] = choice_group
        skills.append(skill)
        i += 1

    return skills


def stats_by_style_tier(skills: list[dict]) -> dict:
    counts: dict[str, int] = defaultdict(int)
    for s in skills:
        key = f"{s.get('style') or '无风格'}/{s.get('tier') or '无阶'}"
        counts[key] += 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))


def extract_class(class_name: str, docx: Path | None = None) -> dict:
    docx = docx or (ROOT / f"基础职业-{class_name}.docx")
    if not docx.exists():
        raise FileNotFoundError(docx)

    paras = extract_paragraphs(docx)
    names = discover_skill_names(paras)
    skills = walk_structured(paras, names)
    skills = [s for s in skills if is_valid_extracted_skill(s)]
    skills = dedupe_prefer_richer(skills)

    unknown_colors = sorted(
        {
            h
            for s in skills
            for h in s.get("cost") or []
            if h not in HEX2NAME
        }
    )

    return {
        "meta": {
            "class_name": class_name,
            "source_file": str(docx.relative_to(ROOT)).replace("\\", "/"),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "paragraph_count": len(paras),
            "discovered_names": len(names),
            "skill_count": len(skills),
            "stats": stats_by_style_tier(skills),
            "unknown_mark_colors": unknown_colors,
            "color_table_size": len(COLOR_TABLE),
            "field_order": list(FIELD_ORDER),
        },
        "skills": skills,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract all class skills from docx")
    ap.add_argument("--class", dest="class_name", required=True, help="职业名，如 吟游诗人")
    ap.add_argument("--docx", type=Path, default=None, help="可选自定义 docx 路径")
    ap.add_argument("--out", type=Path, default=None, help="输出 JSON 路径")
    args = ap.parse_args()

    data = extract_class(args.class_name, args.docx)
    out = args.out or (ROOT / "scripts" / "extracts" / f"{args.class_name}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    meta = data["meta"]
    print(f"[EXTRACT] {args.class_name}: {meta['skill_count']} skills "
          f"(names={meta['discovered_names']}) → {out.relative_to(ROOT)}")
    t5 = [s for s in data["skills"] if s.get("tier") == "五阶"]
    if t5:
        print(f"  五阶: {len(t5)}")
        by_style: dict[str, list[str]] = defaultdict(list)
        for s in t5:
            by_style[s.get("style") or "?"].append(s["name"])
        for st, names in by_style.items():
            print(f"    {st}: {', '.join(names)}")
    if meta["unknown_mark_colors"]:
        print("  WARN unknown colors:", meta["unknown_mark_colors"])


if __name__ == "__main__":
    main()
