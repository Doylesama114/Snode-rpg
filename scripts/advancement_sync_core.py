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


def expand_group_dots(group_colors: list[str]) -> list[str]:
    """Docx summary table: one colored dot per group → three dots of that color."""
    out: list[str] = []
    for hex_c in group_colors:
        out.extend([hex_c] * 3)
    return out


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
    for i, hex_c in enumerate(dots):
        if i and i % 3 == 0:
            parts.append(" ")
        shadow = (
            "text-shadow:0 0 1.5px #000,0 0 1.5px #000,0 0 1.5px #000,0 0 1.5px #000;"
            if hex_c in LIGHT_COLORS
            else ""
        )
        parts.append(f'<span style="font-size:1.2em;color:{hex_c};{shadow}">●</span>')
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
            dots = expand_group_dots(group_colors)
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
        while i < end:
            if paras[i]["text"].startswith("---"):
                i += 1
                continue
            card, ni = parse_card(paras, i)
            if card:
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


def make_adv_id(slug: str, name: str, seen: dict[str, int]) -> str:
    base = f"adv-{slug}-{name}"
    n = seen.get(base, 0)
    seen[base] = n + 1
    if n == 0:
        return base
    return f"{base}-{n + 1}"


def card_to_json_entry(card: dict, class_name: str, slug: str, seen_ids: dict[str, int]) -> dict:
    entry = {
        "id": make_adv_id(slug, card["name"], seen_ids),
        "name": card["name"],
        "source_classes": card["source_classes"],
        "attrs": card["attrs"],
        "cost": cost_entries(card["cost_dots"]),
        "conditions": card["conditions"],
    }
    if card.get("attrs_max"):
        entry["attrs_max"] = card["attrs_max"]
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
    return sanitize_data_search(" ".join(parts))


def grouped_dots_html(dots: list[str]) -> str:
    """Render dots with a space between each group of three (docx 标识 layout)."""
    parts: list[str] = []
    for i in range(0, len(dots), 3):
        chunk = dots[i : i + 3]
        if i and chunk:
            parts.append(" ")
        parts.append(dots_html(chunk))
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

    return (
        f'            <article data-name="{html.escape(card["name"])}" class="adv-card" '
        f'id="{adv_id}" data-search="{ds}">\n'
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


def patch_html_page(class_name: str, articles_html: str) -> None:
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
    html_path.write_text(content, encoding="utf-8")


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sync_advancements(docx: Path = DOCX) -> dict:
    parsed = parse_docx(docx)
    universal = parsed.get("通用", [])
    detail_names = load_detail_names()
    report: dict = {"classes": {}, "universal_count": len(universal)}

    flat_data: list[dict] = []

    for cls in BASE_CLASSES:
        slug = CLASS_SLUG[cls]
        class_cards = list(parsed.get(cls, []))
        merged_cards = class_cards + universal
        seen_ids: dict[str, int] = {}
        entries = [card_to_json_entry(c, cls, slug, seen_ids) for c in merged_cards]
        write_json(ADV_DATA / f"{cls}·进阶.json", {"class": cls, "advancements": entries})

        articles = "\n".join(
            build_article(c, e["id"], detail_names) for c, e in zip(merged_cards, entries)
        )
        patch_html_page(cls, articles)

        for c in class_cards:
            flat_data.append({
                "class": cls,
                "name": c["name"],
                "attrs": c["attrs"],
                "source": "、".join(c["source_classes"]),
                "cost_html": cost_html_compact(c["cost_dots"]),
                "conditions": c["conditions"],
            })

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
    patch_html_page("通用", uni_articles)

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
