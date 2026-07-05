#!/usr/bin/env python3
"""Shared docx → HTML/JSON sync utilities for class skill pages."""
from __future__ import annotations

import json
import re
import shutil
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
FIELD_ORDER = (
    "前置条件", "额外条件", "施展时间", "施展距离", "持续时间",
    "疲劳消耗", "关键词", "施展条件", "施展限制", "标识",
)
FIELD_PREFIXES = tuple(f"{k}：" for k in FIELD_ORDER) + ("费用：", "描述：")
HEX2NAME = {
    "#FF0000": "红", "#EE822F": "橙", "#FFF32F": "黄", "#00B050": "绿",
    "#00FA99": "青", "#00B0F0": "蓝", "#B3F9FF": "浅", "#B94BFF": "紫",
    "#FFB7E3": "粉", "#843F0B": "棕", "#FFFFFF": "白", "#595959": "黑",
    "#D9D9D9": "无",
}
HEX2FULL = {k: v + "色" if v in "红橙黄绿青蓝紫粉棕黑白" else v for k, v in HEX2NAME.items()}
HEX2FULL["#B3F9FF"] = "浅色"
HEX2FULL["#D9D9D9"] = "无色"
COLOR_TABLE = {
    "FF0000": "#FF0000", "EE822F": "#EE822F", "FFF32F": "#FFF32F", "FFD966": "#FFF32F",
    "00B050": "#00B050", "00FA99": "#00FA99", "00B0F0": "#00B0F0", "B3F9FF": "#B3F9FF",
    "00A0FF": "#B3F9FF", "B94BFF": "#B94BFF", "FFB7E3": "#FFB7E3", "FF66CC": "#FFB7E3",
    "843F0B": "#843F0B", "FFFFFF": "#FFFFFF", "595959": "#595959", "D9D9D9": "#D9D9D9",
    "851321": "#851321",
}
LIGHT_COLORS = {"#FFFFFF", "#B3F9FF", "#FFF32F", "#FFB7E3", "#D9D9D9", "#00FA99"}
LEVEL_RE = re.compile(r"^你的(.+?)等级到达(\d+)级时：(.+)$")
LEVEL_RE2 = re.compile(r"^你的(\d+)级时：(.+)$")
TYPE_HEADS = ("战技", "法术", "能力", "战术", "戏法", "天赋", "功法")
STAT_BLOCK_TAIL = ("其数据如下所示", "其数据如下所示：")
BOILERPLATE_EXACT = frozenset({"你可以通过花费技能点的方式来获取以下能力"})
BOILERPLATE_TALENT_TREE = re.compile(r"^.+天赋树$")


def is_boilerplate_line(text: str) -> bool:
    t = text.strip()
    if t in BOILERPLATE_EXACT:
        return True
    if BOILERPLATE_TALENT_TREE.match(t) and not t.endswith("风格"):
        return True
    return False


def filter_description_lines(lines: list[str]) -> list[str]:
    return [p for p in lines if p.strip() and not is_boilerplate_line(p)]


def wants_stat_block_after_separator(description: list[str], fields: dict) -> bool:
    if not description:
        return False
    tail = description[-1].strip()
    if tail.endswith(STAT_BLOCK_TAIL):
        return True
    desc_field = fields.get("描述", "").strip()
    return bool(desc_field.endswith(STAT_BLOCK_TAIL))


def extract_paragraphs(docx_path: Path) -> list[dict]:
    with zipfile.ZipFile(docx_path) as z:
        tree = ET.fromstring(z.read("word/document.xml"))
    paras = []
    for p in tree.iter(f"{{{NS}}}p"):
        runs = []
        for r in p.iter(f"{{{NS}}}r"):
            txt = "".join(t.text or "" for t in r.iter(f"{{{NS}}}t"))
            if not txt:
                continue
            hex_c = None
            rpr = r.find(f"{{{NS}}}rPr")
            if rpr is not None:
                c = rpr.find(f"{{{NS}}}color")
                if c is not None:
                    v = c.get(f"{{{NS}}}val") or c.get("val")
                    if v and v.lower() != "auto":
                        hex_c = COLOR_TABLE.get(v.upper(), f"#{v.upper()}")
            runs.append({"text": txt, "color": hex_c})
        text = "".join(r["text"] for r in runs).strip()
        if text:
            paras.append({"text": text, "runs": runs})
    return paras


def split_field(text: str) -> tuple[str | None, str]:
    if text.startswith("限制："):
        return "施展限制", text[len("限制：") :].strip()
    for fk in (*FIELD_ORDER, "费用", "描述"):
        prefix = fk + "："
        if text.startswith(prefix):
            return fk, text[len(prefix) :].strip()
    return None, text


def mark_dots_from_runs(runs: list[dict]) -> list[str]:
    dots = []
    for r in runs:
        if "●" in r["text"] and r["color"]:
            dots.extend([r["color"]] * r["text"].count("●"))
    return dots


def is_skill_name_line(text: str, names: set[str]) -> bool:
    return text in names


def is_section_break(text: str) -> bool:
    if text.startswith("-----"):
        return True
    if "：" in text[:8]:
        return False
    if text.endswith("风格") and "天赋树" not in text and len(text) < 16:
        return True
    if re.match(r"^[一二三四五六七八]阶天赋树", text):
        return True
    if text.startswith("抉择："):
        return True
    return False


def extract_skill_block(paras: list[dict], start: int, names: set[str]) -> dict | None:
    text0 = paras[start]["text"]
    if not is_skill_name_line(text0, names):
        return None

    near = [paras[i]["text"] for i in range(start + 1, min(start + 5, len(paras)))]
    far = [paras[i]["text"] for i in range(start + 1, min(start + 12, len(paras)))]
    has_time_near = any(w.startswith("施展时间：") for w in near)
    has_talent_near = any(w.startswith(("标识：", "费用：")) for w in far[:7]) and any(
        w.startswith("关键词：") for w in far[:8]
    )
    has_kw_only = any(w.startswith("关键词：") for w in far[:4])
    if not has_time_near and not has_talent_near and not has_kw_only:
        return None
    for j in range(start + 1, min(start + 12, len(paras))):
        t = paras[j]["text"]
        if t == text0:
            return None
        if split_field(t)[0] or t.startswith("施展时间：") or t.startswith("关键词："):
            break
    else:
        return None

    fields: dict[str, str] = {}
    field_runs: dict[str, list[dict]] = {}
    mark_dots: list[str] = []
    description: list[str] = []
    description_entries: list[dict] = []
    level_upgrades: list[dict] = []
    flavor_parts: list[str] = []
    phase = "pre"
    i = start + 1

    while i < len(paras):
        text = paras[i]["text"]
        runs = paras[i]["runs"]

        if is_skill_name_line(text, names):
            break
        if is_section_break(text) and not (
            text.startswith("-----") and wants_stat_block_after_separator(description, fields)
        ):
            break

        fk, val = split_field(text)
        if fk in ("标识", "费用"):
            mark_dots = mark_dots_from_runs(runs)
            phase = "post_mark"
            i += 1
            continue
        if fk == "描述":
            if val:
                fields["描述"] = val
                field_runs["描述"] = runs
            phase = "post_mark"
            i += 1
            continue
        if fk:
            fields[fk] = val
            field_runs[fk] = runs
            phase = "fields"
            i += 1
            continue

        if phase == "pre" and not text.startswith("施展时间"):
            if "额外条件" not in fields:
                fields["额外条件"] = text
            i += 1
            continue

        if phase in ("post_mark", "fields") and text.startswith("你的"):
            m = LEVEL_RE.match(text)
            if m:
                cls, lvl, body = m.group(1), m.group(2), m.group(3)
                label = f"你的{cls}等级到达{lvl}级时："
                level_upgrades.append({
                    "class": cls,
                    "level": int(lvl),
                    "text": body,
                    "label": label,
                    "line_runs": runs,
                })
                i += 1
                continue
            m2 = LEVEL_RE2.match(text)
            if m2:
                lvl, body = m2.group(1), m2.group(2)
                label = f"你的{lvl}级时："
                level_upgrades.append({
                    "class": "",
                    "level": int(lvl),
                    "text": body,
                    "label": label,
                    "line_runs": runs,
                })
                i += 1
                continue

        if text.startswith("抉择："):
            i += 1
            continue

        if text.startswith("-----"):
            if wants_stat_block_after_separator(description, fields):
                i += 1
                while i < len(paras):
                    t2 = paras[i]["text"]
                    if is_skill_name_line(t2, names) or is_section_break(t2):
                        break
                    if t2.startswith("你的") and (LEVEL_RE.match(t2) or LEVEL_RE2.match(t2)):
                        break
                    if not is_boilerplate_line(t2):
                        description.append(t2)
                        description_entries.append({"text": t2, "runs": paras[i]["runs"]})
                    i += 1
                continue
            i += 1
            while i < len(paras):
                t2 = paras[i]["text"]
                if is_skill_name_line(t2, names) or is_section_break(t2):
                    break
                if not split_field(t2)[0]:
                    flavor_parts.append(t2)
                i += 1
            break
        elif len(text) > 4 and "天赋树" in text and "解锁" in text:
            i += 1
            while i < len(paras):
                t2 = paras[i]["text"]
                if is_skill_name_line(t2, names) or is_section_break(t2):
                    break
                if not split_field(t2)[0]:
                    flavor_parts.append(t2)
                i += 1
            break

        if phase == "post_mark":
            if not is_boilerplate_line(text):
                description.append(text)
                description_entries.append({"text": text, "runs": runs})
        elif phase == "fields" and not any(text.startswith(p) for p in FIELD_PREFIXES):
            if not is_boilerplate_line(text):
                description.append(text)
                description_entries.append({"text": text, "runs": runs})

        i += 1

    description = filter_description_lines(description)
    description_entries = [
        e for e in description_entries if e["text"].strip() in description
    ]
    return {
        "name": text0,
        "fields": fields,
        "field_runs": field_runs,
        "mark_dots": mark_dots,
        "description": description,
        "description_entries": description_entries,
        "level_upgrades": level_upgrades,
        "flavor": "\n".join(flavor_parts).strip(),
    }


def block_score(block: dict) -> tuple:
    fields = block["fields"]
    kw = fields.get("关键词", "")
    return (
        1 if "施展时间" in fields else 0,
        1 if kw.startswith(TYPE_HEADS) else 0,
        len(fields),
        len(block["mark_dots"]),
        len(block["description"]),
    )


def build_docx_index(paras: list[dict], names: set[str]) -> dict[str, list[dict]]:
    """Name → list of blocks (handles duplicate skill names across styles)."""
    buckets: dict[str, list[dict]] = defaultdict(list)
    current_style = ""

    for i, p in enumerate(paras):
        text = p["text"]
        if (
            text.endswith("风格")
            and "天赋树" not in text
            and len(text) <= 8
            and "：" not in text
        ):
            current_style = text.replace("风格", "")

        if text not in names:
            continue
        block = extract_skill_block(paras, i, names)
        if not block:
            continue
        block["_style"] = current_style
        buckets[text].append(block)

    out: dict[str, list[dict]] = {}
    for name, blocks in buckets.items():
        uniq: list[dict] = []
        seen: set[tuple] = set()
        for b in sorted(blocks, key=block_score, reverse=True):
            sig = (
                b.get("_style", ""),
                json.dumps(b["fields"], sort_keys=True, ensure_ascii=False),
                tuple(b["mark_dots"]),
            )
            if sig not in seen:
                seen.add(sig)
                uniq.append(b)
        out[name] = uniq
    return out


def pick_block(index: dict[str, list[dict]], skill: dict, used: set[int]) -> dict | None:
    candidates = index.get(skill["name"], [])
    if not candidates:
        return None
    style = skill.get("style", "")
    for b in candidates:
        if id(b) in used:
            continue
        if style and b.get("_style") == style:
            used.add(id(b))
            return b
    for b in candidates:
        if id(b) not in used:
            used.add(id(b))
            return b
    return None


def dots_html(dots: list[str]) -> str:
    parts = []
    for hex_c in dots:
        shadow = (
            "text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;"
            if hex_c in LIGHT_COLORS
            else ""
        )
        parts.append(f'<span style="font-size:1.5em;color:{hex_c};{shadow}">●</span>')
    return "".join(parts)


def runs_have_colored_dots(runs: list[dict]) -> bool:
    for r in runs:
        if r.get("color") and "●" in r.get("text", ""):
            return True
    return False


def slice_runs_after_prefix(runs: list[dict], prefix_len: int) -> list[dict]:
    if prefix_len <= 0:
        return runs
    out: list[dict] = []
    pos = 0
    for r in runs:
        text = r.get("text") or ""
        start, end = pos, pos + len(text)
        pos = end
        if end <= prefix_len:
            continue
        if start >= prefix_len:
            out.append(r)
        else:
            cut = prefix_len - start
            rest = text[cut:]
            if rest:
                out.append({"text": rest, "color": r.get("color")})
    return out


def inline_runs_html(runs: list[dict]) -> str:
    import html as html_mod

    parts: list[str] = []
    for r in runs:
        text = r.get("text") or ""
        if not text:
            continue
        hex_c = r.get("color")
        if hex_c and "●" in text:
            shadow = (
                "text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;"
                if hex_c in LIGHT_COLORS
                else ""
            )
            for ch in text:
                if ch == "●":
                    parts.append(
                        f'<span style="font-size:1.5em;color:{hex_c};{shadow}">●</span>'
                    )
                else:
                    parts.append(html_mod.escape(ch))
        else:
            parts.append(html_mod.escape(text))
    return "".join(parts)


def field_p(label: str, value: str) -> str:
    return f'<p><span class="field">{label}：</span>{value}</p>'


def field_p_html(label: str, value: str, runs: list[dict] | None = None) -> str:
    if runs and runs_have_colored_dots(runs):
        return f'<p><span class="field">{label}：</span>{inline_runs_html(runs)}</p>'
    return field_p(label, value)


def build_detail_html(block: dict) -> str:
    fields = block["fields"]
    field_runs = block.get("field_runs") or {}
    runs_by_text = {
        e["text"]: e["runs"] for e in (block.get("description_entries") or [])
    }
    ordered: list[str] = []
    for fk in FIELD_ORDER:
        if fk == "标识":
            if block["mark_dots"]:
                ordered.append(
                    f'<p><span class="field">标识：</span>{dots_html(block["mark_dots"])}</p>'
                )
            continue
        if fk in fields:
            ordered.append(field_p_html(fk, fields[fk], field_runs.get(fk)))

    desc = filter_description_lines(block["description"])
    desc = [p for p in desc if p.strip() and p.strip() != block["name"]]
    if desc:
        if "描述" in fields:
            if not any(
                x.startswith('<p><span class="field">描述：</span>')
                for x in ordered
            ):
                ordered.append(
                    field_p_html("描述", fields["描述"], field_runs.get("描述"))
                )
            for para in desc:
                if para != fields.get("描述"):
                    runs = runs_by_text.get(para)
                    inner = (
                        inline_runs_html(runs)
                        if runs and runs_have_colored_dots(runs)
                        else para
                    )
                    ordered.append(f"<p>{inner}</p>")
        else:
            first_runs = runs_by_text.get(desc[0])
            ordered.append(
                field_p_html(
                    "描述",
                    desc[0],
                    first_runs if first_runs else None,
                )
            )
            for para in desc[1:]:
                runs = runs_by_text.get(para)
                inner = (
                    inline_runs_html(runs)
                    if runs and runs_have_colored_dots(runs)
                    else para
                )
                ordered.append(f"<p>{inner}</p>")

    for lu in block["level_upgrades"]:
        label = lu.get("label")
        if not label:
            cls = lu.get("class") or ""
            label = (
                f"你的{cls}等级到达{lu['level']}级时："
                if cls
                else f"你的等级到达{lu['level']}级时："
            )
        line_runs = lu.get("line_runs") or []
        body_runs = slice_runs_after_prefix(line_runs, len(label))
        if body_runs and runs_have_colored_dots(body_runs):
            body_html = inline_runs_html(body_runs)
        else:
            body_html = lu["text"]
        ordered.append(f'<p><span class="field">{label}</span>{body_html}</p>')

    if block["flavor"]:
        ordered.append("<p>---------------------------------------------------------------------</p>")
        for line in block["flavor"].split("\n"):
            if line.strip():
                ordered.append(f"<p>{line.strip()}</p>")

    return "".join(ordered)


def tags_from_keywords(kw: str) -> list[str]:
    if not kw or kw == "-":
        return []
    parts = [p.strip() for p in kw.split(".") if p.strip()]
    if parts and parts[0] in TYPE_HEADS:
        return parts[1:] if len(parts) > 1 else parts
    return parts


def cost_json(dots: list[str]) -> list[dict]:
    merged: dict[str, dict] = {}
    for hex_c in dots:
        name = HEX2FULL.get(hex_c, "无色")
        if hex_c not in merged:
            merged[hex_c] = {"color": hex_c, "count": 0, "name": name, "id": name}
        merged[hex_c]["count"] += 1
    return list(merged.values())


def sp_list(dots: list[str]) -> list[str]:
    return [HEX2NAME.get(h, "无") for h in dots]


def parse_fp(val: str) -> int | None:
    if not val or val == "-":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def tier_label_from_skill(old: dict) -> str:
    t = old.get("tier")
    if old.get("type") == "starting":
        return "一阶天赋树"
    if isinstance(t, int):
        cn = "一二三四五六七八"[t - 1] if 1 <= t <= 8 else str(t)
        return f"{cn}阶天赋树"
    if isinstance(t, str) and t.endswith("阶"):
        return f"{t}天赋树"
    return str(t or "")


def build_data_search(block: dict, style: str, tier_label: str, tags: list[str]) -> str:
    parts = [style, tier_label, block["name"], *tags]
    for fk in FIELD_ORDER:
        if fk in block["fields"]:
            parts.append(f"{fk}：{block['fields'][fk]}")
    desc = [p for p in block["description"] if p.strip() != block["name"]]
    parts.extend(desc)
    if block["flavor"]:
        parts.append(block["flavor"])
    return " ".join(parts)


def sanitize_data_search(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return text.replace('"', "").strip()


def patch_html(html: str, skill_id: str, detail_html: str, data_search: str, data_attrs: str = "") -> str:
    id_marker = f'id="{skill_id}"'
    pos = html.find(id_marker)
    if pos == -1:
        raise ValueError(f"article not found: {skill_id}")

    article_start = html.rfind("<article", 0, pos)
    h4_start = html.find("<h4>", pos)
    detail_start = html.find('<div class="detail">', h4_start)
    detail_content_start = detail_start + len('<div class="detail">')
    detail_end = html.find("</div>", detail_content_start)
    article_end = html.find("</article>", detail_end)

    # preserve original article class attribute
    article_tag = html[article_start:pos]
    cls_m = re.search(r'<article\s+class="([^"]*)"', article_tag)
    article_class = cls_m.group(1) if cls_m else "skill"

    safe_search = sanitize_data_search(data_search)
    middle = html[h4_start:detail_content_start]
    rebuilt = (
        f'<article class="{article_class}" id="{skill_id}" data-search="{safe_search}"{data_attrs}>'
        + middle
        + detail_html
        + html[detail_end:article_end + len("</article>")]
    )
    return html[:article_start] + rebuilt + html[article_end + len("</article>") :]


def remove_skill_from_html(html: str, skill_id: str, skill_name: str) -> str:
    id_marker = f'id="{skill_id}"'
    pos = html.find(id_marker)
    if pos != -1:
        article_start = html.rfind("<article", 0, pos)
        h4_start = html.find("<h4>", pos)
        detail_start = html.find('<div class="detail">', h4_start)
        detail_content_start = detail_start + len('<div class="detail">')
        detail_end = html.find("</div>", detail_content_start)
        article_end = html.find("</article>", detail_end)
        html = html[:article_start] + html[article_end + len("</article>") :]

    nav_link = f'<a class="skill-link" href="#{skill_id}">{skill_name}</a>'
    html = html.replace(nav_link, "")
    return html


def skill_type_from_keywords(kw: str) -> str:
    if not kw:
        return "战技"
    head = kw.split(".")[0]
    return head if head in TYPE_HEADS else "法术"


def marks_from_cost(skill: dict, mark_dots: list[str] | None = None) -> list[str]:
    if mark_dots:
        return list(mark_dots)
    out: list[str] = []
    for c in skill.get("cost") or []:
        out.extend([c["color"]] * c.get("count", 1))
    return out


def build_skill_data_attrs(skill: dict, mark_dots: list[str] | None = None) -> str:
    import html as html_mod

    tags = skill.get("tags") or []
    fields = skill.get("fields") or {}
    kw = fields.get("关键词", "")
    stype = skill_type_from_keywords(kw)
    tier = skill.get("tier", "")
    if skill.get("type") == "starting":
        tier_val = "0"
    elif isinstance(tier, int):
        tier_val = str(tier)
    else:
        tier_val = str(tier)
    style = (skill.get("style") or "").replace("风格", "")
    marks = marks_from_cost(skill, mark_dots)
    pairs = {
        "data-tags": ",".join(tags),
        "data-type": stype,
        "data-tier": tier_val,
        "data-style": style,
        "data-marks": ",".join(marks),
        "data-mark-count": str(len(marks)),
    }
    parts = []
    for key, val in pairs.items():
        if val:
            parts.append(f'{key}="{html_mod.escape(str(val), quote=True)}"')
    return (" " + " ".join(parts)) if parts else ""


def style_label(style: str) -> str:
    if not style:
        return ""
    return style if style.endswith("风格") else f"{style}风格"


def json_to_fx_entry(skill: dict, class_name: str) -> dict:
    fields = skill.get("fields") or {}
    kw = fields.get("关键词", "")
    tags = skill.get("tags") or []
    st = style_label(skill.get("style", ""))
    tier = tier_label_from_skill(skill)

    effects = []
    if fields.get("描述"):
        effects.append(fields["描述"])
    effects.extend(skill.get("description") or [])
    for u in skill.get("level_upgrades") or []:
        effects.append(f"L{u['level']}: {u['text']}")
    if skill.get("flavor"):
        effects.append(skill["flavor"])
    effects = [e for e in effects if e and e.strip()]

    entry: dict = {
        "id": skill["id"],
        "name": skill["name"],
        "class": class_name,
        "style": st,
        "tier": tier,
        "type": skill_type_from_keywords(kw),
        "tags": tags,
        "cost": {},
        "effects": effects,
    }

    fp = parse_fp(fields.get("疲劳消耗", ""))
    if fp is not None:
        entry["cost"]["fp"] = fp

    sp = []
    for c in skill.get("cost") or []:
        name = HEX2NAME.get(c.get("color", ""), "无")
        sp.extend([name] * c.get("count", 1))
    if sp:
        entry["cost"]["sp"] = sp

    cast = {}
    for fk, ck in (("施展时间", "time"), ("施展距离", "range"), ("持续时间", "duration")):
        if fields.get(fk) and fields[fk] != "-":
            cast[ck] = fields[fk]
    if cast:
        entry["cast"] = cast

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

    return entry


def sync_class(
    class_name: str,
    docx: Path,
    html_path: Path,
    data_path: Path,
    fx_path: Path | None,
    electron_html: Path,
    electron_data: Path,
    electron_fx: Path | None,
    report_path: Path,
) -> dict:
    data = json.loads(data_path.read_text(encoding="utf-8"))
    fx_doc = None
    fx_by_id: dict = {}
    if fx_path and fx_path.exists():
        fx_doc = json.loads(fx_path.read_text(encoding="utf-8"))
        fx_by_id = {s["id"]: s for s in fx_doc[class_name]}

    names = {s["name"] for s in data["skills"]}
    paras = extract_paragraphs(docx)
    docx_index = build_docx_index(paras, names)
    used: set[int] = set()

    html = html_path.read_text(encoding="utf-8")
    removed = []
    changed = []

    for skill in data["skills"]:
        sid = skill["id"]
        block = pick_block(docx_index, skill, used)
        if not block:
            removed.append(skill["name"])
            html = remove_skill_from_html(html, sid, skill["name"])
            continue

        fields = dict(block["fields"])
        if block["mark_dots"]:
            fields["标识"] = "".join("●" for _ in block["mark_dots"])
        fields.pop("费用", None)
        desc_body = [p for p in block["description"] if not p.startswith("限制：") and p.strip() != block["name"]]
        if "描述" not in fields and desc_body:
            fields["描述"] = desc_body[0]

        skill["fields"] = fields
        skill["description"] = desc_body[1:] if len(desc_body) > 1 else ([] if "描述" in fields else desc_body)
        if "描述" in fields and desc_body and fields["描述"] == desc_body[0]:
            skill["description"] = desc_body[1:]
        skill["level_upgrades"] = block["level_upgrades"]
        skill["flavor"] = block["flavor"]
        skill["tags"] = tags_from_keywords(fields.get("关键词", ""))
        skill["cost"] = cost_json(block["mark_dots"])

        tier_lbl = tier_label_from_skill(skill)
        style = skill.get("style", "")
        detail_html = build_detail_html(block)
        data_search = build_data_search(block, style, tier_lbl, skill["tags"])
        data_attrs = build_skill_data_attrs(skill, block["mark_dots"])
        html = patch_html(html, sid, detail_html, data_search, data_attrs)
        changed.append(skill["name"])

    if removed:
        removed_set = set(removed)
        data["skills"] = [s for s in data["skills"] if s["name"] not in removed_set]

    html = html.replace('class="field">费用：</span>', 'class="field">标识：</span>')
    html = re.sub(r"费用：●", "标识：●", html)

    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")

    fx_entries = [json_to_fx_entry(s, class_name) for s in data["skills"]]
    if fx_path:
        fx_doc = {class_name: fx_entries}
        fx_path.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    for src, dst in ((html_path, electron_html), (data_path, electron_data)):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    if fx_path and electron_fx:
        electron_fx.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(fx_path, electron_fx)

    report = {
        "class": class_name,
        "docx_skills_indexed": sum(len(v) for v in docx_index.values()),
        "json_skills": len(data["skills"]),
        "updated": len(changed),
        "removed_not_in_docx": removed,
        "fx_entries": len(fx_entries),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
