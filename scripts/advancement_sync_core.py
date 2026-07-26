#!/usr/bin/env python3
"""Sync 职业页/*·进阶 from 《基础职业进阶途径》.docx."""
from __future__ import annotations

import html
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

from class_sync_core import (
    HEX2FULL,
    LIGHT_COLORS,
    dots_html,
    extract_paragraphs,
    mark_dots_from_runs,
    sanitize_data_search,
)

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "《基础职业进阶途径》.docx"
ADV_PAGE = ROOT / "职业页"
ADV_DATA = ADV_PAGE / "数据"
ELECTRON_ADV = ROOT / "electron-app" / "职业页"

STAT_KEYS = ("力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运")
BASE_CLASSES = (
    "蛮斗士", "战士", "法师", "猎人", "牧师", "圣骑士", "游荡者", "德鲁伊",
    "萨满祭司", "术士", "武僧", "吟游诗人", "魔契师", "奇械师",
)
SKIP_NAMES = frozenset({"进阶", "属性值需求", "来源", "标识", "特殊条件", "1", "2", "3", *STAT_KEYS})

# Pathway docx short labels (--- 天父 ---) → class-doc full names (牧师 only)
PRIEST_BRANCH_FULL = {
    "天父": "公正与荣耀之神",
    "圣母": "生命与丰收之神",
    "骑士": "战争与谋略之神",
    "铁匠": "火焰与锻造之神",
    "学者": "知识与智慧之神",
    "艺人": "艺术与创造之神",
    "隐者": "死神",
}
EXPECTED_PRIEST_BRANCHES = tuple(PRIEST_BRANCH_FULL.keys())
EXPECTED_WARLOCK_BRANCHES = (
    "纯白圣女", "夜之国女王", "蝶神", "翡翠之王", "笑神", "四季姐妹",
    "深渊炎魔", "暴虐领主", "龙巫妖", "鲜血大公", "黑暗王子", "终焉骑士",
    "星空吞噬者", "超维元首", "伟大的克拉贡",
)
BRANCHED_CLASSES = frozenset({"牧师", "魔契师"})
BRANCH_LABEL_RE = re.compile(r"^-{3,}\s*(.+?)\s*-{3,}$")

CLASS_SLUG = {
    "蛮斗士": "barb",
    "战士": "warrior",
    "法师": "mage",
    "猎人": "hunter",
    "牧师": "priest",
    "圣骑士": "paladin",
    "游荡者": "rogue",
    "德鲁伊": "druid",
    "萨满祭司": "shaman",
    "术士": "warlock",
    "武僧": "monk",
    "吟游诗人": "bard",
    "魔契师": "sorcerer",
    "奇械师": "artificer",
    "通用": "common",
}

CONTAINER_ID = {
    "蛮斗士": "barb-adv-container",
    "战士": "warrior-adv-container",
    "法师": "mage-adv-container",
    "猎人": "hunter-adv-container",
    "牧师": "priest-adv-container",
    "圣骑士": "paladin-adv-container",
    "游荡者": "rogue-adv-container",
    "德鲁伊": "druid-adv-container",
    "萨满祭司": "shaman-adv-container",
    "术士": "warlock-adv-container",
    "武僧": "monk-adv-container",
    "吟游诗人": "bard-adv-container",
    "魔契师": "sorcerer-adv-container",
    "奇械师": "artificer-adv-container",
    "通用": "common-adv-container",
}

EMPTY_DIV_ID = {
    "蛮斗士": "barb-adv-empty",
    "战士": "warrior-adv-empty",
    "法师": "mage-adv-empty",
    "猎人": "hunter-adv-empty",
    "牧师": "priest-adv-empty",
    "圣骑士": "paladin-adv-empty",
    "游荡者": "rogue-adv-empty",
    "德鲁伊": "druid-adv-empty",
    "萨满祭司": "shaman-adv-empty",
    "术士": "warlock-adv-empty",
    "武僧": "monk-adv-empty",
    "吟游诗人": "bard-adv-empty",
    "魔契师": "sorcerer-adv-empty",
    "奇械师": "artificer-adv-empty",
    "通用": "common-adv-empty",
}

COLOR_ID = {
    "#FF0000": "red",
    "#EE822F": "orange",
    "#FFF32F": "yellow",
    "#00B050": "green",
    "#00FA99": "cyan",
    "#00B0F0": "blue",
    "#B3F9FF": "light",
    "#B94BFF": "purple",
    "#FFB7E3": "pink",
    "#843F0B": "brown",
    "#FFFFFF": "white",
    "#595959": "black",
    "#D9D9D9": "colorless",
    "#851321": "colorless",
}


def parse_source_classes(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if text == "全职业":
        return ["全职业"]
    return [p.strip() for p in text.split("、") if p.strip()]


def cost_entries(dots: list[str]) -> list[dict]:
    merged: dict[str, dict] = {}
    for hex_c in dots:
        name = HEX2FULL.get(hex_c, "无色")
        cid = COLOR_ID.get(hex_c, "colorless")
        if hex_c not in merged:
            merged[hex_c] = {
                "color": hex_c,
                "name": name,
                "id": cid,
                "amount": 0,
            }
        merged[hex_c]["amount"] += 1
    return list(merged.values())


def cost_html_compact(dots: list[str]) -> str:
    parts: list[str] = []
    prev: str | None = None
    for hex_c in dots:
        if prev is not None and hex_c != prev:
            parts.append(" ")
        shadow = (
            "text-shadow:0 0 1.5px #000,0 0 1.5px #000,0 0 1.5px #000,0 0 1.5px #000;"
            if hex_c in LIGHT_COLORS
            else ""
        )
        parts.append(f'<span style="font-size:1.2em;color:{hex_c};{shadow}">●</span>')
        prev = hex_c
    return "".join(parts)


def parse_card(paras: list[dict], i: int) -> tuple[dict | None, int]:
    if i >= len(paras) or paras[i]["text"] != "进阶":
        return None, i + 1
    if i + 11 >= len(paras) or paras[i + 1]["text"] != "属性值需求":
        return None, i + 1

    name = paras[i + 10]["text"]
    if name in SKIP_NAMES:
        return None, i + 1

    attrs: dict[str, int | str] = {}
    attrs_max: dict[str, bool] = {}
    for si, key in enumerate(STAT_KEYS):
        cell = paras[i + 11 + si]
        val = cell["text"]
        if val in ("", "-"):
            continue
        if val == "X":
            attrs[key] = "X"
            continue
        try:
            num = int(val)
        except ValueError:
            attrs[key] = val
            continue
        attrs[key] = num
        if any(r.get("color") == "#FF0000" for r in cell["runs"]):
            attrs_max[key] = True

    j = i + 19
    source = ""
    dots: list[str] = []
    conditions: list[str] = []

    while j < len(paras):
        text = paras[j]["text"]
        if text == "进阶" and j + 1 < len(paras) and paras[j + 1]["text"] == "属性值需求":
            break
        if text.endswith("进阶途径"):
            break
        if text.startswith("---"):
            # New deity/patron banner — stop so outer loop can switch branch
            if BRANCH_LABEL_RE.match(text):
                break
            j += 1
            continue
        if text == "来源" and j + 1 < len(paras):
            source = paras[j + 1]["text"]
            j += 2
            continue
        if text == "标识":
            k = j + 1
            group_colors: list[str] = []
            while k < len(paras) and "●" in paras[k]["text"]:
                group_colors.extend(mark_dots_from_runs(paras[k]["runs"]))
                k += 1
            dots = group_colors
            j = k
            continue
        if text == "特殊条件":
            j += 1
            while j < len(paras) and paras[j]["text"] in ("1", "2", "3") and j + 1 < len(paras):
                conditions.append(paras[j + 1]["text"])
                j += 2
            continue
        j += 1

    card = {
        "name": name,
        "source_classes": parse_source_classes(source),
        "attrs": attrs,
        "cost_dots": dots,
        "conditions": conditions,
    }
    if attrs_max:
        card["attrs_max"] = attrs_max
    return card, j


def parse_branch_label(text: str) -> str | None:
    m = BRANCH_LABEL_RE.match(text.strip())
    return m.group(1).strip() if m else None


def parse_docx(docx: Path = DOCX) -> dict[str, list[dict]]:
    paras = extract_paragraphs(docx)
    bounds: list[tuple[int, str]] = []
    for i, p in enumerate(paras):
        text = p["text"]
        if text.endswith("进阶途径") and len(text) < 20:
            bounds.append((i, text.replace("进阶途径", "")))

    bounds.append((len(paras), "END"))
    by_class: dict[str, list[dict]] = defaultdict(list)

    for bi in range(len(bounds) - 1):
        start, cls = bounds[bi]
        end, _ = bounds[bi + 1]
        if cls not in BASE_CLASSES and cls != "通用":
            continue
        i = start + 1
        active_branch: str | None = None
        while i < end:
            label = parse_branch_label(paras[i]["text"])
            if label:
                active_branch = label
                i += 1
                continue
            if paras[i]["text"].startswith("---"):
                i += 1
                continue
            card, ni = parse_card(paras, i)
            if card:
                if active_branch:
                    card["branch"] = active_branch
                    if cls == "牧师" and active_branch in PRIEST_BRANCH_FULL:
                        card["branch_full"] = PRIEST_BRANCH_FULL[active_branch]
                by_class[cls].append(card)
                i = ni
            else:
                i += 1
    return dict(by_class)


def load_detail_names() -> set[str]:
    details_js = ADV_PAGE / "advancement_details.js"
    if not details_js.exists():
        return set()
    text = details_js.read_text(encoding="utf-8")
    return set(re.findall(r'"name"\s*:\s*"([^"]+)"', text))


def make_adv_id(slug: str, name: str, seen: dict[str, int], branch: str | None = None) -> str:
    base = f"adv-{slug}-{branch}-{name}" if branch else f"adv-{slug}-{name}"
    n = seen.get(base, 0)
    seen[base] = n + 1
    if n == 0:
        return base
    return f"{base}-{n + 1}"


def card_to_json_entry(card: dict, class_name: str, slug: str, seen_ids: dict[str, int]) -> dict:
    entry = {
        "id": make_adv_id(slug, card["name"], seen_ids, card.get("branch")),
        "name": card["name"],
        "source_classes": card["source_classes"],
        "attrs": card["attrs"],
        "cost": cost_entries(card["cost_dots"]),
        "conditions": card["conditions"],
    }
    if card.get("attrs_max"):
        entry["attrs_max"] = card["attrs_max"]
    if card.get("branch"):
        entry["branch"] = card["branch"]
    if card.get("branch_full"):
        entry["branch_full"] = card["branch_full"]
    return entry


def attrs_html(attrs: dict, attrs_max: dict | None) -> str:
    parts: list[str] = []
    for key in STAT_KEYS:
        if key not in attrs:
            continue
        val = attrs[key]
        text = f"{key}{val}"
        if attrs_max and attrs_max.get(key):
            parts.append(f'<span style="color:#FF0000">{html.escape(str(text))}</span>')
        else:
            parts.append(f"<span>{html.escape(str(text))}</span>")
    return "  ".join(parts)


def data_search(card: dict) -> str:
    parts = [
        card["name"],
        "、".join(card["source_classes"]),
        *card["conditions"],
    ]
    if card.get("branch"):
        parts.insert(1, card["branch"])
    if card.get("branch_full"):
        parts.insert(2, card["branch_full"])
    return sanitize_data_search(" ".join(parts))


def grouped_dots_html(dots: list[str]) -> str:
    """Render dots with a space between each color group (docx 标识 layout)."""
    if not dots:
        return ""
    parts: list[str] = []
    group: list[str] = [dots[0]]
    for hex_c in dots[1:]:
        if hex_c == group[0]:
            group.append(hex_c)
        else:
            if parts:
                parts.append(" ")
            parts.append(dots_html(group))
            group = [hex_c]
    if parts:
        parts.append(" ")
    parts.append(dots_html(group))
    return "".join(parts)


def build_article(card: dict, adv_id: str, detail_names: set[str]) -> str:
    ds = html.escape(data_search(card), quote=True)
    src = html.escape("、".join(card["source_classes"]))
    attrs_line = attrs_html(card["attrs"], card.get("attrs_max"))
    marks = grouped_dots_html(card["cost_dots"])
    cond_items = "".join(f"\n          <li>{html.escape(c)}</li>" for c in card["conditions"])
    has_detail = card["name"] in detail_names
    if has_detail:
        btn = f'              <button class="detail-btn" data-adv-name="{html.escape(card["name"])}">查看详情</button>'
    else:
        btn = '              <button class="locked-btn" disabled>🔒 未解锁</button>'

    branch_attr = ""
    if card.get("branch"):
        branch_attr = f' data-branch="{html.escape(card["branch"], quote=True)}"'

    return (
        f'            <article data-name="{html.escape(card["name"])}" class="adv-card" '
        f'id="{adv_id}"{branch_attr} data-search="{ds}">\n'
        f"        <h4>{html.escape(card['name'])}</h4>\n"
        f'        <p><span class="field">来源：</span>{src}</p>\n'
        f'        <p><span class="field">属性需求：</span>{attrs_line}</p>\n'
        f'        <p><span class="field">标识：</span>{marks}</p>\n'
        f'        <p><span class="field">特殊条件：</span></p>\n'
        f"        <ol>{cond_items}\n        </ol>\n"
        f"{btn}\n"
        f'        <div class="adv-detail collapse"></div>\n'
        f"      </article>"
    )


def build_branched_articles(
    cards: list[dict],
    entries: list[dict],
    detail_names: set[str],
    class_name: str,
) -> str:
    """Filter chips + section.adv-branch blocks for 牧师 / 魔契师."""
    order: list[str] = []
    groups: dict[str, list[tuple[dict, dict]]] = {}
    for card, entry in zip(cards, entries):
        br = card.get("branch") or "未标注"
        if br not in groups:
            groups[br] = []
            order.append(br)
        groups[br].append((card, entry))

    kind = "神祇" if class_name == "牧师" else "宗主"
    chips = [
        '<button type="button" class="branch-chip active" data-branch="">全部</button>'
    ]
    for br in order:
        title = br
        full = PRIEST_BRANCH_FULL.get(br) if class_name == "牧师" else None
        tip = f"{br}（{full}）" if full else br
        chips.append(
            f'<button type="button" class="branch-chip" data-branch="{html.escape(br, quote=True)}" '
            f'title="{html.escape(tip, quote=True)}">{html.escape(br)}</button>'
        )

    parts: list[str] = [
        f'            <div class="branch-filter" role="toolbar" aria-label="{kind}分支筛选">',
        "              " + "\n              ".join(chips),
        "            </div>",
    ]
    if class_name == "牧师":
        parts.append(
            '            <p class="adv-branch-note">'
            "按途径短称分列七神分支（天父=公正与荣耀之神 … 隐者=死神）；"
            "秘教神（无尽饥饿等）暂无独立进阶表。"
            "</p>"
        )

    for br in order:
        full = groups[br][0][0].get("branch_full") or (
            PRIEST_BRANCH_FULL.get(br) if class_name == "牧师" else ""
        )
        heading = f"{br} · {full}" if full else br
        sec_id = f"branch-{html.escape(br, quote=True)}"
        parts.append(
            f'            <section class="adv-branch" data-branch="{html.escape(br, quote=True)}" '
            f'id="{sec_id}">'
        )
        parts.append(f'              <h2 class="adv-branch-title">{html.escape(heading)}</h2>')
        for card, entry in groups[br]:
            parts.append(build_article(card, entry["id"], detail_names))
        parts.append("            </section>")

    return "\n".join(parts)


BRANCH_CSS = """
    .branch-filter { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 16px; }
    .branch-chip {
      border:1px solid var(--line); background:var(--panel); color:var(--ink);
      border-radius:6px; padding:6px 12px; font-size:13px; cursor:pointer;
    }
    .branch-chip:hover { border-color:var(--green); }
    .branch-chip.active { background:var(--green); color:#fff; border-color:var(--green); }
    .adv-branch { margin: 8px 0 28px; }
    .adv-branch-title {
      margin: 0 0 12px; font-size:18px; color:var(--ink);
      padding-bottom:8px; border-bottom:2px solid var(--green);
    }
    .adv-branch.branch-hidden { display:none; }
    .adv-branch-note { color:var(--muted); font-size:12px; margin:0 0 16px; line-height:1.5; }
"""

BRANCH_SCRIPT = r"""
<script id="adv-branch-filter-script">
(function(){
  var filter = document.querySelector(".branch-filter");
  if (!filter) return;
  var chips = filter.querySelectorAll(".branch-chip");
  var sections = document.querySelectorAll(".adv-branch");
  function setBranch(br) {
    chips.forEach(function(c){
      c.classList.toggle("active", (c.getAttribute("data-branch") || "") === br);
    });
    sections.forEach(function(sec){
      var sb = sec.getAttribute("data-branch") || "";
      sec.classList.toggle("branch-hidden", br !== "" && sb !== br);
    });
  }
  chips.forEach(function(c){
    c.addEventListener("click", function(){
      setBranch(c.getAttribute("data-branch") || "");
    });
  });
})();
</script>
"""


def ensure_branch_page_assets(content: str) -> str:
    """Inject branch CSS + filter script once into 牧师/魔契师 pages."""
    if ".branch-filter" not in content:
        content = content.replace(
            "    .adv-card.filter-hidden { opacity: 0.4; }\n",
            "    .adv-card.filter-hidden { opacity: 0.4; }\n" + BRANCH_CSS,
            1,
        )
    if 'id="adv-branch-filter-script"' not in content:
        # Insert before first back-to-top or before nav-toggle
        marker = '<button class="back-to-top"'
        if marker in content:
            content = content.replace(marker, BRANCH_SCRIPT + "\n" + marker, 1)
        else:
            content = content.replace("</body>", BRANCH_SCRIPT + "\n</body>", 1)
    return content


def patch_html_page(
    class_name: str,
    articles_html: str,
    *,
    subtitle: str | None = None,
) -> None:
    html_path = ADV_PAGE / f"{class_name}·进阶.html"
    if not html_path.exists():
        raise FileNotFoundError(html_path)
    content = html_path.read_text(encoding="utf-8")
    container_id = CONTAINER_ID[class_name]
    empty_id = EMPTY_DIV_ID[class_name]
    pattern = re.compile(
        rf'(<div class="adv-container" id="{re.escape(container_id)}">\s*)'
        rf'(.*?)'
        rf'(<div id="{re.escape(empty_id)}"[^>]*>)',
        re.DOTALL,
    )
    m = pattern.search(content)
    if not m:
        raise ValueError(f"Cannot find adv-container in {html_path.name}")
    new_block = f"{m.group(1)}{articles_html}\n\n{m.group(3)}"
    content = content[: m.start()] + new_block + content[m.end() :]
    if subtitle:
        content = re.sub(
            r'(<p class="subtitle">)[^<]*(</p>)',
            rf"\g<1>{html.escape(subtitle)}\g<2>",
            content,
            count=1,
        )
    if class_name in BRANCHED_CLASSES:
        content = ensure_branch_page_assets(content)
    html_path.write_text(content, encoding="utf-8")


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync_advancements(docx: Path = DOCX) -> dict:
    parsed = parse_docx(docx)
    universal = parsed.get("通用", [])
    detail_names = load_detail_names()
    report: dict = {"classes": {}, "universal_count": len(universal), "branches": {}}

    flat_data: list[dict] = []

    for cls in BASE_CLASSES:
        slug = CLASS_SLUG[cls]
        class_cards = list(parsed.get(cls, []))
        merged_cards = class_cards + universal
        seen_ids: dict[str, int] = {}
        entries = [card_to_json_entry(c, cls, slug, seen_ids) for c in merged_cards]

        # Universal cards appended after class cards have no branch — OK
        write_json(ADV_DATA / f"{cls}·进阶.json", {"class": cls, "advancements": entries})

        if cls in BRANCHED_CLASSES:
            # Only section the class's own cards; keep universal flat after last section
            class_n = len(class_cards)
            branched = build_branched_articles(
                class_cards, entries[:class_n], detail_names, cls
            )
            uni_part = ""
            if universal:
                uni_part = (
                    '\n            <section class="adv-branch" data-branch="__universal__" '
                    'id="branch-universal">\n'
                    '              <h2 class="adv-branch-title">通用进阶</h2>\n'
                    + "\n".join(
                        build_article(c, e["id"], detail_names)
                        for c, e in zip(universal, entries[class_n:])
                    )
                    + "\n            </section>"
                )
            articles = branched + uni_part
            branches = []
            for c in class_cards:
                b = c.get("branch")
                if b and b not in branches:
                    branches.append(b)
            report["branches"][cls] = branches
            kind = "神祇" if cls == "牧师" else "宗主"
            subtitle = f"{len(merged_cards)} 个可选进阶 · {len(branches)} 个{kind}分支"
        else:
            articles = "\n".join(
                build_article(c, e["id"], detail_names) for c, e in zip(merged_cards, entries)
            )
            subtitle = f"{len(merged_cards)} 个可选进阶"

        patch_html_page(cls, articles, subtitle=subtitle)

        for c in class_cards:
            row = {
                "class": cls,
                "name": c["name"],
                "attrs": c["attrs"],
                "source": "、".join(c["source_classes"]),
                "cost_html": cost_html_compact(c["cost_dots"]),
                "conditions": c["conditions"],
            }
            if c.get("branch"):
                row["branch"] = c["branch"]
            if c.get("branch_full"):
                row["branch_full"] = c["branch_full"]
            flat_data.append(row)

        report["classes"][cls] = {
            "class_only": len(class_cards),
            "with_universal": len(entries),
        }

    # 通用·进阶 (universal only)
    slug = CLASS_SLUG["通用"]
    seen_ids = {}
    uni_entries = [card_to_json_entry(c, "通用", slug, seen_ids) for c in universal]
    write_json(ADV_DATA / "通用·进阶.json", {"class": "通用", "advancements": uni_entries})
    uni_articles = "\n".join(
        build_article(c, e["id"], detail_names) for c, e in zip(universal, uni_entries)
    )
    patch_html_page("通用", uni_articles, subtitle=f"{len(universal)} 个可选进阶")

    for c in universal:
        flat_data.append({
            "class": "通用",
            "name": c["name"],
            "attrs": c["attrs"],
            "source": "、".join(c["source_classes"]),
            "cost_html": cost_html_compact(c["cost_dots"]),
            "conditions": c["conditions"],
        })

    write_json(ADV_PAGE / "advancement_data.json", flat_data)

    # Mirror to electron-app
    for cls in (*BASE_CLASSES, "通用"):
        src_json = ADV_DATA / f"{cls}·进阶.json"
        dst_json = ELECTRON_ADV / "数据" / f"{cls}·进阶.json"
        dst_json.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_json, dst_json)
        src_html = ADV_PAGE / f"{cls}·进阶.html"
        dst_html = ELECTRON_ADV / f"{cls}·进阶.html"
        shutil.copy2(src_html, dst_html)

    shutil.copy2(ADV_PAGE / "advancement_data.json", ELECTRON_ADV / "advancement_data.json")

    report["advancement_data_count"] = len(flat_data)
    return report


if __name__ == "__main__":
    print(json.dumps(sync_advancements(), ensure_ascii=False, indent=2))
