#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 基础职业-战舞者.docx（+ scripts/extracts/战舞者.json）重建战舞者技能数据 + 职业页 + skill_effects。

与召唤师版差异：
- 技能内容直接取自 extract_class_docx 的提取产物（54 条，含 fields/description/level_upgrades/flavor）。
- 页面模板沿用「法师.html」骨架（风格分组：5 战斗风格 × 三阶，与法师学派同构）。
- 额外产出：起始装备 4 组（A/B/C/D）→ scripts/extracts/战舞者_equipment.json（供创建页 M4 使用）。
"""
from __future__ import annotations

import html
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    cost_json,
    extract_paragraphs,
    json_to_fx_entry,
    sanitize_data_search,
    tags_from_keywords,
)

CLASS = "战舞者"
PREFIX = "zw"
VIEW_ID = "view-zhanwuzhe"
DATA = ROOT / "职业页" / "数据" / f"{CLASS}.json"
HTML = ROOT / "职业页" / f"{CLASS}.html"
DOCX = ROOT / f"基础职业-{CLASS}.docx"
FX = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
EXTRACT = ROOT / "scripts" / "extracts" / f"{CLASS}.json"
EQUIP_OUT = ROOT / "scripts" / "extracts" / f"{CLASS}_equipment.json"
TEMPLATE = ROOT / "职业页" / "法师.html"
FEATURE_SECTION_ID = f"{PREFIX}-class-features"

TIER_ORDER = ["一阶", "二阶", "三阶"]
STYLE_ORDER = ["刃舞", "迷情", "谐合", "机敏", "激昂"]
STYLE_COLORS = {
    "刃舞": "#c2410c",
    "迷情": "#be185d",
    "谐合": "#0f766e",
    "机敏": "#1d4ed8",
    "激昂": "#b45309",
}
STARTING_COLOR = "#a46d1f"


def chips_html(tags: list[str]) -> str:
    return "".join(f'<span class="chip">{html.escape(t)}</span>' for t in tags)


def render_article(skill: dict, block: dict) -> str:
    sid = skill["id"]
    name = skill["name"]
    tags = skill.get("tags") or []
    if skill.get("type") == "starting":
        chip_label = "起始特性"
        color = STARTING_COLOR
        style_for_search = "起始"
        tier_label = "起始特性"
    else:
        style = skill["style"]
        tier = skill["tier"]
        chip_label = f"{style} · {tier}天赋树"
        color = STYLE_COLORS.get(style, "#888")
        style_for_search = style
        tier_label = f"{tier}阶天赋树"
    tables = {"unit_tables": skill.get("unit_tables") or [], "roll_tables": skill.get("roll_tables") or []}
    detail = build_detail_html(block, tables)
    data_search = build_data_search(block, style_for_search, tier_label, tags)
    data_search = append_tables_to_search(data_search, skill)
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, class_name=CLASS)
    return (
        f'<article class="skill" id="{sid}" data-search="{safe}"{data_attrs}>\n'
        f'        <h4>{name} <span class="chip" style="background:{color};color:#fff">{chip_label}</span></h4>\n'
        f'        <div class="chips">{chips_html(tags)}</div>\n'
        f'        <div class="detail">{detail}</div>\n'
        f"      </article>"
    )


def render_nav(skills: list[dict]) -> str:
    lines = [
        f'      <div class="filter-bar" id="{PREFIX}-filter-bar"></div>',
        f'      <a class="style-link" href="#{FEATURE_SECTION_ID}">职业专长</a>',
        f'      <a class="style-link" href="#{PREFIX}-starting-features">起始特性</a>',
        f'<a class="adv-link" href="{CLASS}·进阶.html">→ 查看进阶途径</a>',
        '      <div class="tier-list">',
    ]
    for sk in skills:
        if sk.get("type") == "starting":
            lines.append(f'        <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
    lines.append("      </div>")

    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for sk in skills:
        if sk.get("type") == "starting":
            continue
        grouped[sk["style"]][sk["tier"]].append(sk)

    for style in STYLE_ORDER:
        if style not in grouped:
            continue
        lines.append("")
        lines.append('            <details class="nav-group">')
        lines.append(
            f'              <summary class="style-summary">'
            f'<a href="#{PREFIX}-style-{style}">{style}风格</a></summary>'
        )
        for tier in TIER_ORDER:
            tier_skills = grouped[style].get(tier, [])
            if not tier_skills:
                continue
            lines.append('              <details class="nav-tier">')
            lines.append(
                f'                  <summary class="tier-summary">'
                f'<a href="#{PREFIX}-tier-{style}-{tier}">{tier}天赋树</a></summary>'
            )
            for sk in tier_skills:
                lines.append(f'                  <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
            lines.append("              </details>")
        lines.append("            </details>")
    return "\n".join(lines)


def render_class_features(features: dict) -> str:
    chips = []
    panels = []
    for i, f in enumerate(features["features"]):
        active = " active" if i == 0 else ""
        selected = "true" if i == 0 else "false"
        chips.append(
            f'<button type="button" class="class-feature-chip{active}" role="tab" '
            f'aria-selected="{selected}" data-feature-index="{i}">{html.escape(f["name"])}</button>'
        )
        body_parts = []
        for b in f["body"]:
            body_parts.append(f"<p>{html.escape(b)}</p>")
        panels.append(
            f'<div class="class-feature-panel{active}" role="tabpanel" data-feature-panel="{i}">'
            f'<h3>{html.escape(f["name"])}</h3>'
            f'<div class="class-feature-body">{"".join(body_parts)}</div></div>'
        )
    return (
        f'<section class="class-features" id="{FEATURE_SECTION_ID}" aria-label="职业专长">'
        f'<div class="class-feature-head"><h2>职业专长</h2>'
        f'<p class="class-feature-intro">{html.escape(features["intro"])}</p></div>'
        f'<div class="class-feature-tabs" role="tablist">{"".join(chips)}</div>'
        f'<div class="class-feature-panels">{"".join(panels)}</div></section>'
    )


def render_content(skills: list[dict], blocks: dict[str, dict], features: dict) -> str:
    parts = [
        f'      <div class="empty" id="{PREFIX}-empty" style="display:none">',
        '        <p style="text-align:center;color:var(--muted);padding:40px 0">'
        "没有匹配的技能。试试其他关键词吧。</p>",
        "      </div>",
        render_class_features(features),
        f'      <h3 id="{PREFIX}-starting-features">起始特性</h3>',
        '      <p class="subtitle">你可以从以下起始特性中选择两项加入你的技能或天赋列表：</p>',
    ]
    for sk in skills:
        if sk.get("type") == "starting":
            parts.append(render_article(sk, blocks[sk["id"]]))

    current_style = None
    current_tier = None
    for sk in skills:
        if sk.get("type") == "starting":
            continue
        style = sk["style"]
        tier = sk["tier"]
        if style != current_style:
            parts.append(f'      <h3 id="{PREFIX}-style-{style}">{style}风格</h3>')
            current_style = style
            current_tier = None
        if tier != current_tier:
            parts.append(f'      <h4 id="{PREFIX}-tier-{style}-{tier}">{tier}阶天赋树</h4>')
            current_tier = tier
        parts.append(render_article(sk, blocks[sk["id"]]))
    return "\n".join(parts)


def read_head() -> str:
    text = TEMPLATE.read_text(encoding="utf-8")
    end = text.find("<main>")
    if end == -1:
        raise SystemExit("cannot find <main> in mage template")
    head = text[: end + len("<main>")] + "\n"
    head = head.replace("<title>法师 · 斯诺德职业技能索引</title>", f"<title>{CLASS} · 斯诺德职业技能索引</title>")
    head = head.replace("法师天赋索引", f"{CLASS}天赋索引")
    head = head.replace("法师八大学派天赋索引", f"{CLASS}天赋索引")
    head = head.replace('id="m-search"', f'id="{PREFIX}-search"')
    head = head.replace('id="m-filter-bar"', f'id="{PREFIX}-filter-bar"')
    head = head.replace("八大学派 · 一至四阶 · 法术详情 · 关键词搜索", "五种战斗风格 · 一至三阶 · 战技详情 · 关键词搜索")
    head = head.replace('placeholder="搜索法师技能、学派、阶位、关键词或正文..."', f'placeholder="搜索{CLASS}技能、风格、阶位、关键词或正文..."')
    head = head.replace("法师", CLASS)
    return head


FOOT_TEMPLATE = """
</main>

<script src="common.js"></script>
<script src="mark-colors.js"></script>
<script src="filter-panel.js"></script>
<script src="filter.js"></script>
<script>
createFilterController("__VIEW_ID__", "__PREFIX__");
</script>
<script src="common_tooltip.js"></script>
<script src="../斯诺德跑团/shortcuts.js"></script>
</body>
</html>
"""


def load_skills() -> tuple[list[dict], dict[str, dict]]:
    raw = json.loads(EXTRACT.read_text(encoding="utf-8"))
    entries = raw["skills"]
    skills: list[dict] = []
    blocks: dict[str, dict] = {}
    counters: dict[str, int] = defaultdict(int)
    for e in entries:
        tier = e.get("tier") or "起始"
        style = e.get("style") or "战斗"
        is_starting = tier == "起始"
        if is_starting:
            counters["starting"] += 1
            sid = f"{PREFIX}-starting-skill-{counters['starting']}"
        else:
            key = f"{style}-{tier}"
            counters[key] += 1
            sid = f"{PREFIX}-skill-{key}-{counters[key]}"
        fields = dict(e.get("fields") or {})
        # cost 为十六进制色值列表（cost_meta 提供色名）；目标 schema 为 [{color,count,name,id}]
        cost_hexes = list(e.get("cost") or [])
        meta_by_hex = {m.get("hex"): m.get("name") for m in (e.get("cost_meta") or []) if isinstance(m, dict)}
        mark_dots = list(cost_hexes)
        cost_list = []
        for hexv in dict.fromkeys(cost_hexes):
            nm = meta_by_hex.get(hexv) or hexv
            cost_list.append({"color": hexv, "count": cost_hexes.count(hexv), "name": nm, "id": nm})
        if mark_dots:
            fields["标识"] = "".join("●" for _ in mark_dots)
        keyword = fields.get("关键词", "")
        tags: list[str] = []
        for t in tags_from_keywords(keyword):
            for part in re.split(r"[/,，]", t):
                part = part.strip()
                if part and part not in tags:
                    tags.append(part)
        skill = {
            "id": sid,
            "name": e["name"],
            "fields": fields,
            "cost": cost_list,
            "tags": tags,
            "description": list(e.get("description") or []),
            "level_upgrades": list(e.get("level_upgrades") or []),
            "flavor": e.get("flavor") or "",
        }
        if is_starting:
            skill["type"] = "starting"
        else:
            skill["type"] = e.get("type") or "战技"
            skill["style"] = style
            skill["tier"] = tier
        skills.append(skill)
        blocks[sid] = {
            "name": e["name"],
            "fields": fields,
            "description": list(e.get("description") or []),
            "level_upgrades": list(e.get("level_upgrades") or []),
            "mark_dots": mark_dots,
            "flavor": e.get("flavor") or "",
        }
    # 排序：起始优先，其余按 STYLE_ORDER × TIER_ORDER
    def sort_key(s: dict):
        if s.get("type") == "starting":
            return (-1, 0, 0)
        return (
            STYLE_ORDER.index(s["style"]) if s["style"] in STYLE_ORDER else 99,
            TIER_ORDER.index(s["tier"]) if s["tier"] in TIER_ORDER else 99,
            0,
        )
    skills.sort(key=sort_key)
    return skills, blocks


def docx_paragraphs() -> list[str]:
    paras = extract_paragraphs(DOCX)
    out = []
    for p in paras:
        out.append(p.get("text", "") if isinstance(p, dict) else str(p))
    return out


def extract_features_and_equipment() -> tuple[dict, list[dict]]:
    paras = docx_paragraphs()
    # 职业专长：从「战舞者专精 / 初始专长」到「战斗风格」之前，再补一条战斗风格总述
    features = {"intro": "战舞者的关键属性为敏捷或魅力，你必须在创建角色时选择其中一项作为你的关键属性，作为一名战舞者，你获得以下职业专长。", "features": []}
    try:
        i0 = next(i for i, t in enumerate(paras) if t.strip().endswith("专精"))
    except StopIteration:
        i0 = -1
    if i0 >= 0:
        cur = None
        i = i0 + 1
        while i < len(paras):
            line = paras[i].strip()
            i += 1
            if not line:
                continue
            if line.startswith("---"):
                continue
            if line.startswith("战斗风格"):
                break
            if line in ("初始专长",):
                continue
            is_name = (
                len(line) <= 10
                and "：" not in line
                and "。" not in line
                and not line.startswith(("·", "你", "每", "此", "该", "若", "D1", "D2", "D3", "D4", "D5", "D6"))
            )
            if is_name and (cur is None or cur["body"]):
                cur = {"name": line, "body": []}
                features["features"].append(cur)
            elif cur is not None:
                cur["body"].append(line)
    # 战斗风格总述（5 种风格名）
    style_line = next((t.strip() for t in paras if t.strip().startswith("战斗风格")), "")
    style_names = [st for st in STYLE_ORDER if any(t.strip() == st for t in paras)]
    if style_line:
        features["features"].append({
            "name": "战斗风格",
            "body": [style_line] + ["可用战斗风格：" + "、".join(style_names)],
        })
    # 起始装备：A/B/C/D 四组
    sets: list[dict] = []
    for t in paras:
        m = re.match(r"^([A-D])·(.+)$", t.strip())
        if m and ("金币" in t or "套装" in t):
            sets.append({"key": m.group(1), "text": m.group(2).strip()})
    return features, sets


def main() -> None:
    skills, blocks = load_skills()
    features, equipment = extract_features_and_equipment()
    if not features["features"]:
        features = {"intro": "战舞者的职业专长与初始专长。", "features": [{"name": "战斗风格", "body": ["你能够拥有至多四种战斗风格。"]}]}

    doc = {"id": CLASS, "name": CLASS, "skills": skills}
    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    fx_doc = {CLASS: [json_to_fx_entry(s, CLASS) for s in skills]}
    FX.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    EQUIP_OUT.write_text(
        json.dumps({"class": CLASS, "sets": equipment}, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    head = read_head()
    nav = render_nav(skills)
    content = render_content(skills, blocks, features)
    foot = FOOT_TEMPLATE.replace("__VIEW_ID__", VIEW_ID).replace("__PREFIX__", PREFIX)
    page = (
        head
        + f'    <nav aria-label="{CLASS}天赋索引">\n      <div class="nav-inner">\n'
        + nav
        + '\n      </div>\n    </nav>\n    <div class="content">\n'
        + content
        + "\n    </div>\n"
        + foot
    )
    HTML.write_text(page, encoding="utf-8")

    for src, dst in (
        (DATA, ROOT / "electron-app" / "职业页" / "数据" / f"{CLASS}.json"),
        (FX, ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json"),
        (HTML, ROOT / "electron-app" / "职业页" / f"{CLASS}.html"),
    ):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    starting = sum(1 for s in skills if s.get("type") == "starting")
    print(f"[战舞者] 技能 {len(skills)} 条（起始 {starting}）")
    print(f"  数据: {DATA.relative_to(ROOT)}")
    print(f"  页面: {HTML.relative_to(ROOT)}  {len(page) // 1024} KB")
    print(f"  FX:   {FX.relative_to(ROOT)}")
    print(f"  装备组 {len(equipment)} 个 / 专长 {len(features['features'])} 项")
    by = defaultdict(int)
    for s in skills:
        if s.get("type") != "starting":
            by[f"{s['style']}/{s['tier']}"] += 1
    print("  分布: " + ", ".join(f"{k}={v}" for k, v in sorted(by.items())))


if __name__ == "__main__":
    main()
