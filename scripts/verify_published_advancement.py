#!/usr/bin/env python3
"""Verify published advancement pipeline outputs."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from published_advancement_core import (
    DETAILS_JS,
    ELECTRON_ADV,
    EXTRACT_OUT,
    ROOT,
    extract_all,
    load_details_js,
)

EXPECTED_NEW = {
    "武器大师", "旗手", "圣洁骑士", "耀阳德鲁伊", "凤凰术士", "巨龙术士",
    "秀逗魔导士", "奥术师", "卷轴学者", "近卫", "高阶冒险者", "战斗大师",
    "战地医师", "塑形者", "离群野兽", "魔剑士", "狮心骑士", "牧魂人",
    "丰收祭司", "骑兵", "自然行者", "利爪德鲁伊",
    "冰霜法师", "狂热十字军", "刺客", "防御者", "青龙尊者", "朱鹤尊者",
}
EXPECTED_UPDATED_SPOT = {
    "斗士": ["无畏斗志"],
    "蝰蛇": ["血循破坏"],
}

# Ability mid-nest: parent → skill names
NESTED_ABILITY_CHECKS = {
    "诡术师": ("神秘佳人", ["午夜假面", "魔术手套", "幻魅魔宠"]),
    "秀逗魔导士": ("秀逗戏法", ["火花喷嚏", "变装蛋糕", "香蕉皮陷阱"]),
    "赋生者": ("生命赠礼", ["次级复活术", "次级复原术"]),
    "战地医师": ("对策联动", ["对策治疗"]),
    "丰收祭司": ("丰收庇护", ["丰收节的喜悦"]),
    "原始人英雄": ("刀耕火种", ["骨火战斧", "雷兽重锤", "棘藤长矛"]),
}

# Insight post-skills
NESTED_INSIGHT_CHECKS = {
    "狂徒": ["狂兽之跃", "狂徒硬币", "终局狂暴"],
    "醉酒大师": ["活血酒", "龙焰酒", "逍遥酒"],
    "耀阳德鲁伊": ["光斑跃迁", "天火坠临", "永昼形态"],
    "蝰蛇": ["蛇语毒药（配方）", "酷烈毒药（配方）"],
    "棍术师": ["拨草寻蛇", "惊雷一棍", "画地为牢"],
    "惩戒骑士": ["圣光裁决", "灼光洗礼", "圣焰共鸣"],
    "狮心骑士": ["圣光狮鬃", "正义猛扑"],
    "奥术师": ["奥能禁锢", "奥术之月"],
    "自然行者": ["自然狂怒"],
}


def nested_skill_names(items) -> list[str]:
    names = []
    for item in items or []:
        if isinstance(item, list) and item and item[0]:
            names.append(item[0][0] if isinstance(item[0], list) else str(item[0]))
    return names


def top_table_names(entry: dict) -> list[str]:
    names = []
    for t in entry.get("tables") or []:
        if t and t[0]:
            names.append(t[0][0] if isinstance(t[0], list) else str(t[0]))
    return names


def main() -> int:
    errors: list[str] = []
    extract = extract_all() if not EXTRACT_OUT.exists() else json.loads(
        EXTRACT_OUT.read_text(encoding="utf-8")
    )
    # refresh extract if stale / missing nested fields
    need_refresh = extract.get("count") != 55
    if not need_refresh:
        sample = next(
            (r for r in extract.get("records", []) if r.get("name") == "诡术师"),
            None,
        )
        if sample:
            myst = next(
                (
                    a
                    for a in (sample.get("entry") or {}).get("abilities") or []
                    if a.get("name") == "神秘佳人"
                ),
                None,
            )
            if not (myst and myst.get("nested_skills")):
                need_refresh = True
    if need_refresh:
        extract = extract_all()

    if extract["count"] != 55:
        errors.append(f"extract count={extract['count']} want 55")
    if extract.get("incomplete_names") != []:
        errors.append(f"incomplete={extract.get('incomplete_names')} want []")
    if len(extract.get("complete_names", [])) != 55:
        errors.append(f"complete={len(extract.get('complete_names', []))} want 55")

    details = load_details_js()
    names = {e["name"] for e in details}
    if len(details) < 55:
        errors.append(f"details count={len(details)} want >=55")
    missing_new = sorted(EXPECTED_NEW - names)
    if missing_new:
        errors.append(f"missing NEW in details: {missing_new}")

    by = {e["name"]: e for e in details}
    for adv, ab_names in EXPECTED_UPDATED_SPOT.items():
        if adv not in by:
            errors.append(f"missing updated spot {adv}")
            continue
        have = {a["name"] for a in by[adv].get("abilities") or []}
        for an in ab_names:
            if an not in have:
                errors.append(f"{adv} missing ability {an}")
        # 斗士 numeric spot-check
        if adv == "斗士":
            desc = next(
                (a.get("desc_html") or "" for a in by[adv]["abilities"] if a["name"] == "无畏斗志"),
                "",
            )
            if "+10" not in desc and "＋10" not in desc:
                errors.append("斗士.无畏斗志 expected +10 in docx sync")

    for adv, (parent, skill_names) in NESTED_ABILITY_CHECKS.items():
        if adv not in by:
            errors.append(f"missing nested-ability adv {adv}")
            continue
        entry = by[adv]
        tops = top_table_names(entry)
        ab = next((a for a in entry.get("abilities") or [] if a.get("name") == parent), None)
        if not ab:
            errors.append(f"{adv} missing parent ability {parent}")
            continue
        nested = nested_skill_names(ab.get("nested_skills"))
        for sn in skill_names:
            if sn not in nested:
                errors.append(f"{adv}.{parent} missing nested {sn} (have {nested})")
            if sn in tops:
                errors.append(f"{adv} still has top-level table {sn}")
        if adv == "诡术师":
            if any(str(x).startswith("限制") for x in nested + tops):
                errors.append("诡术师 has fake 限制： skill title")

    for adv, skill_names in NESTED_INSIGHT_CHECKS.items():
        if adv not in by:
            errors.append(f"missing nested-insight adv {adv}")
            continue
        entry = by[adv]
        tops = top_table_names(entry)
        insight = entry.get("insight") or {}
        nested = nested_skill_names(insight.get("nested_skills"))
        for sn in skill_names:
            if sn not in nested:
                errors.append(f"{adv}.insight missing nested {sn} (have {nested})")
            if sn in tops:
                errors.append(f"{adv} still has top-level table {sn}")

    # detail-btn integrity: no cross-card wrong data-adv-name / undocumented unlock
    article_re = re.compile(r"<article\b([^>]*)>([\s\S]*?)</article>", re.I)
    name_re = re.compile(r'\bdata-name="([^"]+)"')
    btn_re = re.compile(
        r'<button class="(detail-btn|locked-btn)"([^>]*)>'
    )
    adv_attr_re = re.compile(r'data-adv-name="([^"]+)"')
    btn_mismatch = 0
    for page in (ROOT / "职业页").glob("*·进阶.html"):
        text = page.read_text(encoding="utf-8")
        for m in article_re.finditer(text):
            open_tag, body = m.group(1), m.group(2)
            nm = name_re.search(open_tag) or name_re.search(body)
            if not nm:
                continue
            card_name = nm.group(1)
            bm = btn_re.search(body)
            if not bm:
                continue
            kind, attrs = bm.group(1), bm.group(2)
            adv_m = adv_attr_re.search(attrs)
            adv_name = adv_m.group(1) if adv_m else None
            if kind == "detail-btn":
                if card_name not in names:
                    errors.append(
                        f"{page.name}: undocumented '{card_name}' has detail-btn→{adv_name}"
                    )
                    btn_mismatch += 1
                elif adv_name != card_name:
                    errors.append(
                        f"{page.name}: '{card_name}' detail-btn points to '{adv_name}'"
                    )
                    btn_mismatch += 1
            elif kind == "locked-btn" and card_name in names:
                errors.append(f"{page.name}: documented '{card_name}' still locked")
                btn_mismatch += 1
            if btn_mismatch >= 20:
                errors.append("... more detail-btn mismatches truncated")
                break
        if btn_mismatch >= 20:
            break

    # spot: 影舞者 must stay locked; 飞贼 unlocked as itself
    rogue = (ROOT / "职业页" / "游荡者·进阶.html").read_text(encoding="utf-8")
    if 'data-name="影舞者"' in rogue:
        chunk = rogue.split('data-name="影舞者"', 1)[1].split("</article>", 1)[0]
        if "detail-btn" in chunk:
            errors.append("游荡者·进阶 影舞者 must stay locked (no published details)")
        if 'data-adv-name="飞贼"' in chunk:
            errors.append("游荡者·进阶 影舞者 wrongly bound to 飞贼")
    if 'data-adv-name="飞贼"' not in rogue:
        errors.append("游荡者·进阶 missing detail-btn for 飞贼")

    skills_path = ROOT / "advisor" / "advancement_skills.json"
    skills = json.loads(skills_path.read_text(encoding="utf-8"))
    doc_count = skills.get("meta", {}).get("documentedCount")
    if doc_count is None:
        # fallback: count documented entries
        entries = skills.get("advancements") or skills.get("skills") or []
        if isinstance(entries, dict):
            doc_count = sum(1 for v in entries.values() if (v.get("confidence") == "documented"))
        else:
            doc_count = skills.get("meta", {}).get("count")
    if not doc_count or doc_count < 55:
        # try alternate meta keys
        alt = skills.get("meta", {})
        doc_count = alt.get("documentedCount") or alt.get("documented") or 0
    if doc_count < 55:
        errors.append(f"advisor documentedCount={doc_count} want >=55")

    electron_details = ELECTRON_ADV / "advancement_details.js"
    if not electron_details.exists():
        errors.append("electron advancement_details.js missing")
    elif electron_details.read_text(encoding="utf-8") != DETAILS_JS.read_text(encoding="utf-8"):
        errors.append("electron advancement_details.js out of sync")

    electron_renderer = ELECTRON_ADV / "advancement_renderer.js"
    root_renderer = ROOT / "职业页" / "advancement_renderer.js"
    if root_renderer.exists():
        if not electron_renderer.exists():
            errors.append("electron advancement_renderer.js missing")
        elif electron_renderer.read_text(encoding="utf-8") != root_renderer.read_text(encoding="utf-8"):
            errors.append("electron advancement_renderer.js out of sync")
        renderer_text = root_renderer.read_text(encoding="utf-8")
        for needle in ("nested_skills", "renderNestedSkills"):
            if needle not in renderer_text:
                errors.append(f"advancement_renderer.js missing {needle}")

    # spot: 战士·进阶 should have detail-btn for 武器大师
    warrior = (ROOT / "职业页" / "战士·进阶.html").read_text(encoding="utf-8")
    if 'data-adv-name="武器大师"' not in warrior and "武器大师" in warrior:
        if 'data-name="武器大师"' in warrior and "查看详情" not in warrior.split('data-name="武器大师"', 1)[1][:800]:
            errors.append("战士·进阶 武器大师 still locked")
    if 'data-adv-name="武器大师"' not in warrior:
        # may live on another class page — check any
        found = False
        for p in (ROOT / "职业页").glob("*·进阶.html"):
            if 'data-adv-name="武器大师"' in p.read_text(encoding="utf-8"):
                found = True
                break
        if not found:
            errors.append("no page has detail-btn for 武器大师")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print("PASS")
    print(json.dumps({
        "details": len(details),
        "incomplete": extract["incomplete_names"],
        "documented": doc_count,
        "new_present": len(EXPECTED_NEW & names),
        "nested_ability_checks": len(NESTED_ABILITY_CHECKS),
        "nested_insight_checks": len(NESTED_INSIGHT_CHECKS),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
