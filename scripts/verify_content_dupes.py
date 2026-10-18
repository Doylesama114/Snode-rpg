# -*- coding: utf-8 -*-
"""技能内容重复门禁（2026-10-18）。

检查四类已发生过的重复/残留：
1. <template class="skill-body"> 之前出现 detail 类节点（旧版渲染残留）；
2. 同一技能的单位卡数量与 unit_tables 数量不一致（重复渲染/丢失）；
3. 单位行仍作为 upgrade-cell sub 输出（choices 未去重）；
4. data-search 中单位行重复（P0 类型；P1 的 description 内单位行不计，渲染层已去重）；
5. 技能 description 吞掉同池兄弟技能的整块（兄弟卡片仍独立存在）。

用法：python -X utf8 scripts/verify_content_dupes.py
退出码 0 = 通过。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import class_sync_core as C  # noqa: E402

PAGE_DIR = ROOT / "职业页"
DATA_DIR = PAGE_DIR / "数据"
SKIP_JSON = {
    "classes", "style_mappings", "color_definitions", "level_up",
    "backgrounds", "races", "items", "equipment", "equipment_catalog",
    "materials", "ores", "herbs", "potions", "scrolls", "gadgets",
    "magic_services", "bg_personality", "通用·进阶",
}
DETAIL_CLASSES = {
    "effect-cell", "unit-card", "unit-note", "upgrade-cell", "desc-cell",
    "cond-row", "attr-table", "roll-table", "process-block", "group-row",
    "choice-row", "flavor-cell",
}
FIELD_LABEL = re.compile(
    r"^(前置条件|额外条件|施展时间|施展距离|持续时间|疲劳消耗|关键词|施展条件|施展限制|限制|标识|费用|描述)[：:]"
)

PASS = 0
FAIL = 0
DETAILS: list[str] = []


def ok(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  PASS " + name)
    else:
        FAIL += 1
        print("  FAIL " + name + (("  " + detail) if detail else ""))
        DETAILS.append(name + ((" — " + detail) if detail else ""))


def skills_of(doc) -> list[dict]:
    if isinstance(doc, list):
        return [s for s in doc if isinstance(s, dict)]
    if isinstance(doc, dict):
        return doc.get("skills") or []
    return []


def load_site() -> dict[str, dict[str, dict]]:
    """page name -> {skill id: skill}."""
    by_page: dict[str, dict[str, dict]] = {}
    for path in sorted(DATA_DIR.glob("*.json")):
        name = path.stem
        if name in SKIP_JSON:
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if name == "牧师·神圣领域":
            for dom in (doc.get("domains") or {}).values():
                for s in dom.get("skills") or []:
                    by_page.setdefault("牧师", {})[s.get("id")] = s
        else:
            by_page[name] = {s.get("id"): s for s in skills_of(doc) if s.get("id")}
    return by_page


def strip_attrs(html: str) -> str:
    return re.sub(r'\sdata-[a-z-]+="[^"]*"', "", html)


def text_of(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", strip_attrs(html))).strip()


def pre_template(art: str) -> str:
    return art.split('<template class="skill-body">')[0]


def has_detail_node(prefix: str) -> list[str]:
    found: list[str] = []
    i, n = 0, len(prefix)
    while i < n:
        m = re.match(r'<div\s+class="([^"]*)"', prefix[i:])
        if m:
            classes = set(m.group(1).split())
            if classes & DETAIL_CLASSES:
                found.append(next(iter(classes & DETAIL_CLASSES)))
                depth = 0
                j = i
                while j < n:
                    if prefix.startswith("<div", j):
                        depth += 1
                        gt = prefix.find(">", j)
                        j = gt + 1 if gt != -1 else j + 4
                        continue
                    if prefix.startswith("</div>", j):
                        depth -= 1
                        j += 6
                        if depth == 0:
                            break
                        continue
                    j += 1
                i = j
                continue
        i += 1
    return found


def main() -> None:
    by_page = load_site()
    pages = sorted(p for p in by_page.keys() if (PAGE_DIR / (p + ".html")).exists())
    total_articles = 0
    total_unit_skills = 0
    pre_bad: list[str] = []
    card_bad: list[str] = []
    sub_bad: list[str] = []
    ds_bad: list[str] = []
    sibling_bad: list[str] = []

    for page in pages:
        html = (PAGE_DIR / (page + ".html")).read_text(encoding="utf-8")
        articles = re.findall(r'<article class="skill" id="([^"]+)"[\s\S]*?</article>', html)
        # full article blocks
        for m in re.finditer(r'<article class="skill" id="([^"]+)"[\s\S]*?</article>', html):
            sid, art = m.group(1), m.group(0)
            total_articles += 1
            prefix = pre_template(art)
            bad = has_detail_node(prefix)
            if bad:
                pre_bad.append(f"{page}/{sid} ({','.join(bad)})")
            skill = (by_page.get(page) or {}).get(sid)
            if not skill:
                continue
            units = skill.get("unit_tables") or []
            if not units:
                continue
            total_unit_skills += 1
            unit_keys: set[str] = set()
            for u in units:
                unit_keys |= C.unit_text_keys(u)
            cards = len(re.findall(r'<div class="unit-card">', art))
            if cards != len(units):
                card_bad.append(f"{page}/{sid} cards={cards} units={len(units)}")
            post = art.split('<template class="skill-body">')[1] if '<template class="skill-body">' in art else art
            for m2 in re.finditer(r'<div class="upgrade-cell sub">([\s\S]*?)</div>', post):
                if C.rendered_text_key(m2.group(1)) in unit_keys:
                    sub_bad.append(f"{page}/{sid}: {m2.group(1)[:30]}")
            ds = re.search(r'data-search="([^"]*)"', art)
            ds_text = ds.group(1) if ds else ""
            desc_keys = {C.rendered_text_key(x) for x in (skill.get("description") or [])}
            unit_lines = []
            for u in units:
                unit_lines.extend([x for x in (u.get("lines") or []) if x])
            for line in unit_lines:
                k = C.rendered_text_key(line)
                if len(k) < 10 or k in desc_keys:
                    continue
                if C.rendered_text_key(ds_text).count(k) > 1:
                    ds_bad.append(f"{page}/{sid}: {line[:30]}")
                    break

    # sibling blocks in description
    for page, skills in by_page.items():
        names = {s.get("name") for s in skills.values() if s.get("name")}
        for s in skills.values():
            desc = [str(x).strip() for x in (s.get("description") or [])]
            for i, line in enumerate(desc):
                if line in names and line != s.get("name"):
                    fields = 0
                    for nxt in desc[i + 1:i + 9]:
                        if FIELD_LABEL.match(nxt):
                            fields += 1
                        else:
                            break
                    if fields >= 2:
                        sibling_bad.append(f"{page}/{s.get('id')} -> {line}")

    print("=== 技能内容重复门禁 ===")
    print(f"  页面 {len(pages)} · 技能卡 {total_articles} · 带单位技能 {total_unit_skills}")
    ok("模板外无 detail 残留", not pre_bad, "; ".join(pre_bad[:6]))
    ok("单位卡数量与 unit_tables 一致", not card_bad, "; ".join(card_bad[:6]))
    ok("升级子行无单位行残留", not sub_bad, "; ".join(sub_bad[:6]))
    ok("data-search 无单位行重复", not ds_bad, "; ".join(ds_bad[:6]))
    ok("描述无兄弟技能整块", not sibling_bad, "; ".join(sibling_bad[:6]))
    print(f"\n内容重复校验: {PASS}P {FAIL}F")
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
