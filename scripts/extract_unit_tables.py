#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阶段 2：为技能数据补充“单位属性表 / 随机效果表”。

  A 类（单位表）：从对应基础职业 docx 的单位表提取结构化数据；
  B 类（随机效果表）：从技能描述的“点数/区间 → 效果”行提取。

用法：
  python scripts/extract_unit_tables.py --dry     # 仅预览
  python scripts/extract_unit_tables.py --apply   # 写回 JSON
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    collect_roll_rows,
    detect_unit_blocks,
    extract_paragraphs,
    is_section_break,
)

# 每个技能对应的单位表名称（docx 为准）
A_SPECS: dict[str, dict[str, list[str]]] = {
    "吟游诗人": {
        "焰火音符": ["焰火妖精"],
        "净泉音符": ["净泉妖精"],
        "召唤隐形战仆": ["隐形战仆"],
    },
    "圣骑士": {
        "召唤神圣战驹": ["神圣战驹"],
    },
    "奇械师": {
        "自爆绵羊（图纸）": ["自爆绵羊"],
        "擂台机器人W-BA！（图纸）": ["擂台机器人"],
        "医护机器人IR（图纸）": ["医护机器人"],
    },
    "德鲁伊": {
        "野兽形态": ["黑豹形态", "斑鹿形态", "老鼠形态", "野猪"],
        "棕熊形态": ["棕熊"],
    },
    "法师": {
        "召唤隐形战仆": ["隐形战仆"],
        "召唤火元素": ["火元素"],
        "召唤水元素": ["水元素"],
        "召唤骨爪": ["骨爪"],
        "召唤骷髅士兵": ["骷髅士兵"],
        "蛇影缠身": ["毒蛇"],
        "召唤魅影杀手": ["魅影杀手"],
        "变形术·野猪": ["野猪"],
        "变形术·棕熊": ["棕熊"],
    },
    "猎人": {
        "蜂蜜陷阱（图纸）": ["棕熊"],
        "魔刃豹陷阱（图纸）": ["魔刃豹"],
    },
    "萨满祭司": {
        "召唤风元素": ["风元素"],
        "召唤火元素": ["火元素"],
        "召唤水元素": ["水元素"],
        "召唤土元素": ["土元素"],
    },
    "术士": {
        "秘仪之力·午夜": ["暗影魔"],
    },
    "魔契师": {
        "蛇影缠身": ["毒蛇"],
        "召唤隐形战仆": ["隐形战仆"],
    },
    "牧师·神圣领域": {
        "召唤战斗学者": ["战斗学者"],
        "活木偶（图纸）": ["活木偶"],
    },
}

# 每个技能需要渲染为随机效果表（点数/区间 → 效果）
B_SPECS: dict[str, list[str]] = {
    "吟游诗人": ["妖精演奏", "笑料不断", "召唤精类生物"],
    "法师": [
        "召唤坐骑", "召唤次级恶魔", "召唤宝石兽", "召唤精类生物",
        "痛苦之墙", "衰变飞弹", "召唤天界生物", "召唤灵界坐骑",
    ],
    "术士": ["混沌法术", "混乱箭", "召唤次级恶魔", "召唤宝石兽"],
    "游荡者": ["杂耍打击"],
    "魔契师": [
        "召唤坐骑", "混乱箭", "咒能虹吸",
        "召唤域外生命", "召唤深渊恶魔", "召唤精类生物",
    ],
    "牧师·神圣领域": ["律动节拍", "妖精演奏", "召唤宝石兽"],
}

ATTR_KEYS = ("力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运")
SEP_RE = re.compile(r"^-{3,}$")
ANCHOR_RE = re.compile(
    r"^(.*?)[，,]\s*防御等级\s*[:：]\s*(\d+)\s*[，,]\s*生命值\s*[:：]\s*(\d+)\s*$"
)
STAT_LABELS = (
    "感官", "移动速度", "战斗加成", "战斗加值", "伤害抗性", "伤害免疫",
    "伤害易伤", "状态免疫", "状态抗性", "状态易伤", "语言", "挑战等级",
)


def balance_ok(text: str) -> bool:
    return text.count("（") == text.count("）") and text.count("(") == text.count(")")


def is_attr_line(ln: str) -> bool:
    if not re.match(r"^(力量|感知|智力|魅力)", ln):
        return False
    return sum(1 for k in ATTR_KEYS if k in ln) >= 3


def is_stat_line(ln: str) -> bool:
    return ln.startswith(tuple(f"{x}：" for x in STAT_LABELS))


def is_name_like(ln: str) -> bool:
    return (
        len(ln) <= 18
        and not any(ch in ln for ch in "：:，。;；")
        and not ln.startswith(("·", "•"))
        and "." not in ln
        and not re.match(r"^(力量|感知|智力|魅力)", ln)
    )


def join_ability_text(parts: list[str]) -> str:
    """保留行结构：·子项独立成行，软换行续行合并回上一行。"""
    out: list[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if not out:
            out.append(p)
            continue
        if p.startswith(("·", "•")):
            out.append(p)
            continue
        prev = out[-1]
        if prev.startswith(("·", "•")) or not balance_ok(prev):
            out[-1] = prev + p
        else:
            out.append(p)
    return "\n".join(out)


def parse_unit_block(lines: list[str]) -> dict:
    """把 docx 单位表的原始行解析为结构化单位对象。"""
    body = [ln.strip() for ln in lines if ln.strip()]
    name = body[0] if body else ""
    rest = body[1:]
    head = None
    anchor_idx = None
    for idx, ln in enumerate(rest):
        if "防御等级" in ln and "生命值" in ln:
            m = ANCHOR_RE.match(ln)
            if m:
                head = {"type_size": m.group(1).strip(), "ac": m.group(2), "hp": m.group(3)}
            else:
                head = {
                    "type_size": re.sub(r"[，,]\s*防御等级.*$", "", ln).strip(),
                    "ac": None,
                    "hp": None,
                }
            anchor_idx = idx
            break
    attrs: list[str] = []
    stats: list[list[str]] = []
    abilities: list[dict] = []
    notes: list[str] = []
    if anchor_idx is None:
        notes = rest
        return {
            "name": name,
            "lines": body,
            "head": head,
            "attrs": attrs,
            "stats": stats,
            "abilities": abilities,
            "notes": notes,
        }

    notes.extend(rest[:anchor_idx])
    i = anchor_idx + 1
    n = len(rest)
    while i < n:
        ln = rest[i]
        if is_attr_line(ln):
            merged = ln
            i += 1
            while i < n and not balance_ok(merged) and not is_attr_line(rest[i]):
                merged += rest[i]
                i += 1
            attrs.append(merged)
            continue
        if ln in ("固有技能：", "固有技能"):
            i += 1
            continue
        if is_stat_line(ln):
            k, _, v = ln.partition("：")
            stats.append([k.strip(), v.strip()])
            i += 1
            continue
        # 能力条目：短行名称 + 后续长行描述
        if (
            is_name_like(ln)
            and i + 1 < n
            and not is_name_like(rest[i + 1])
            and not is_stat_line(rest[i + 1])
        ):
            ab_name = ln
            i += 1
            text_parts: list[str] = []
            while i < n:
                t2 = rest[i]
                if is_stat_line(t2) or is_attr_line(t2):
                    break
                if t2.startswith("你的") or t2.startswith(("加工材料：", "研发时间：", "参考价格：", "负重：", "类别：")):
                    break
                if is_name_like(t2):
                    break
                text_parts.append(t2)
                i += 1
            abilities.append({"name": ab_name, "text": join_ability_text(text_parts)})
            continue
        notes.append(ln)
        i += 1
    return {
        "name": name,
        "lines": body,
        "head": head,
        "attrs": attrs,
        "stats": stats,
        "abilities": abilities,
        "notes": notes,
    }


FIELD_STARTS = (
    "前置条件：", "额外条件：", "施展时间：", "持续时间：", "疲劳消耗：",
    "关键词：", "施展条件：", "施展限制：", "限制：", "标识：", "费用：", "描述：",
)


def find_skill_para(paras: list[dict], name: str, all_names: set[str]) -> int | None:
    for i, p in enumerate(paras):
        if p["text"] != name:
            continue
        if i + 1 >= len(paras):
            continue
        # 真正的技能表紧随其后的首行是它自己的字段行；
        # 目录/索引表后面会跟着其他技能名，排除。
        nxt = paras[i + 1]["text"].strip()
        if nxt.startswith(FIELD_STARTS):
            return i
    return None


def collect_unit_blocks(
    paras: list[dict], start: int, unit_names: list[str], all_names: set[str]
) -> list[list[str]]:
    """从技能表之后收集单位表（支持连续多张，如德鲁伊野兽形态）。"""
    unit_set = set(unit_names)
    n = len(paras)
    # 跳过当前技能表自身的字段/描述/升级行，直到分隔线
    i = start + 1
    while i < n:
        t = paras[i]["text"].strip()
        if not t:
            i += 1
            continue
        if SEP_RE.match(t):
            break
        i += 1
    blocks: list[list[str]] = []
    while i < n:
        t = paras[i]["text"].strip()
        if not t:
            i += 1
            continue
        if SEP_RE.match(t):
            j = i + 1
            while j < n and not paras[j]["text"].strip():
                j += 1
            if j < n and paras[j]["text"].strip() in unit_set:
                i = j
                continue
            break
        if t in all_names or is_section_break(t):
            break
        if t in unit_set:
            block = [t]
            i += 1
            while i < n:
                u = paras[i]["text"].strip()
                if not u:
                    i += 1
                    continue
                if u in unit_set:
                    break
                if u in all_names or is_section_break(u) or SEP_RE.match(u):
                    break
                block.append(u)
                i += 1
            blocks.append(block)
            continue
        break
    return blocks


def skill_lines_map(data: dict) -> dict[str, dict]:
    if "domains" in data:
        out = {}
        for dom in data["domains"].values():
            for sk in dom.get("skills") or []:
                out[sk.get("name")] = sk
        return out
    return {sk.get("name"): sk for sk in data.get("skills") or []}


def enrich_base_class(cls: str, apply: bool) -> dict:
    docx_path = ROOT / f"基础职业-{cls}.docx"
    json_path = ROOT / "职业页" / "数据" / f"{cls}.json"
    if not docx_path.exists() or not json_path.exists():
        return {"class": cls, "error": "missing files"}
    data = json.loads(json_path.read_text(encoding="utf-8"))
    skills = {sk.get("name"): sk for sk in data.get("skills") or []}
    names = set(skills)
    paras = extract_paragraphs(docx_path)
    report = {"class": cls, "units": {}, "rolls": {}}
    for skill_name, unit_names in A_SPECS.get(cls, {}).items():
        sk = skills.get(skill_name)
        if sk is None:
            report["units"][skill_name] = "SKILL NOT FOUND"
            continue
        start = find_skill_para(paras, skill_name, names)
        if start is None:
            report["units"][skill_name] = "DOCX SKILL NOT FOUND"
            continue
        blocks = collect_unit_blocks(paras, start, unit_names, names)
        parsed = [parse_unit_block(b) for b in blocks]
        report["units"][skill_name] = [u["name"] for u in parsed]
        if apply:
            sk["unit_tables"] = parsed
    for skill_name in B_SPECS.get(cls, []):
        sk = skills.get(skill_name)
        if sk is None:
            report["rolls"][skill_name] = "SKILL NOT FOUND"
            continue
        rows = collect_roll_rows(sk.get("description") or [])
        report["rolls"][skill_name] = len(rows)
        if apply:
            sk["roll_tables"] = rows
    if apply:
        json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def enrich_domain_json(path: Path, apply: bool) -> dict:
    if not path.exists():
        return {"path": str(path), "error": "missing"}
    data = json.loads(path.read_text(encoding="utf-8"))
    report = {"path": str(path), "units": {}, "rolls": {}}
    for dom in data.get("domains", {}).values():
        for sk in dom.get("skills") or []:
            name = sk.get("name")
            desc = sk.get("description") or []
            if name in A_SPECS.get("牧师·神圣领域", {}):
                blocks = detect_unit_blocks(desc)
                parsed = [parse_unit_block(b["lines"]) for b in blocks]
                report["units"][name] = [u["name"] for u in parsed]
                if apply:
                    sk["unit_tables"] = parsed
            if name in B_SPECS.get("牧师·神圣领域", []):
                rows = collect_roll_rows(desc)
                report["rolls"][name] = len(rows)
                if apply:
                    sk["roll_tables"] = rows
    if apply:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> None:
    apply = "--apply" in sys.argv
    print("apply =", apply)
    for cls in A_SPECS:
        rep = enrich_base_class(cls, apply)
        print("###", cls, "units:", rep.get("units"), "rolls:", rep.get("rolls"))
    rep = enrich_domain_json(ROOT / "职业页" / "数据" / "牧师·神圣领域.json", apply)
    print("### 牧师·神圣领域", "units:", rep.get("units"), "rolls:", rep.get("rolls"))
    rep2 = enrich_domain_json(ROOT / "scripts" / "extracts" / "牧师_domains.json", apply)
    print("### extracts/牧师_domains.json", "units:", rep2.get("units"), "rolls:", rep2.get("rolls"))


if __name__ == "__main__":
    main()
