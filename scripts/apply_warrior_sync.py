#!/usr/bin/env python3
"""Sync 战士 from 基础职业-战士.docx → HTML + 数据 JSON + skill_effects JSON."""
from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "基础职业-战士.docx"
HTML_PATH = ROOT / "职业页" / "战士.html"
DATA_PATH = ROOT / "职业页" / "数据" / "战士.json"
FX_PATH = ROOT / "斯诺德跑团" / "skill_effects_战士.json"
ELECTRON_HTML = ROOT / "electron-app" / "职业页" / "战士.html"
ELECTRON_DATA = ROOT / "electron-app" / "职业页" / "数据" / "战士.json"
ELECTRON_FX = ROOT / "electron-app" / "斯诺德跑团" / "skill_effects_战士.json"

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
}
LIGHT_COLORS = {"#FFFFFF", "#B3F9FF", "#FFF32F", "#FFB7E3", "#D9D9D9", "#00FA99"}
LEVEL_RE = re.compile(r"^你的(.+?)等级到达(\d+)级时：(.+)$")
LEVEL_RE2 = re.compile(r"^你的(\d+)级时：(.+)$")


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
            return fk, text[len(prefix):].strip()
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
    if not has_time_near and not has_talent_near:
        return None
    # tier-list duplicate: another same-name line appears before the first field
    first_field_at = None
    for j in range(start + 1, min(start + 12, len(paras))):
        t = paras[j]["text"]
        if t == text0:
            return None
        if split_field(t)[0] or t.startswith("施展时间："):
            first_field_at = j
            break
    if first_field_at is None:
        return None

    fields: dict[str, str] = {}
    mark_dots: list[str] = []
    description: list[str] = []
    level_upgrades: list[dict] = []
    flavor_parts: list[str] = []
    choice_notes: list[str] = []
    phase = "pre"  # pre | fields | post_mark | done
    i = start + 1

    while i < len(paras):
        text = paras[i]["text"]
        runs = paras[i]["runs"]

        if is_skill_name_line(text, names) or is_section_break(text):
            break

        fk, val = split_field(text)
        if fk == "标识" or fk == "费用":
            mark_dots = mark_dots_from_runs(runs)
            phase = "post_mark"
            i += 1
            continue
        if fk == "描述":
            if val:
                description.append(val)
            phase = "post_mark"
            i += 1
            continue
        if fk:
            fields[fk] = val
            phase = "fields"
            i += 1
            continue

        if phase == "pre" and not text.startswith("施展时间"):
            # unlabeled line before fields → 额外条件
            if "额外条件" not in fields:
                fields["额外条件"] = text
            i += 1
            continue

        if phase in ("post_mark", "fields") and text.startswith("你的"):
            m = LEVEL_RE.match(text)
            if m:
                cls, lvl, body = m.group(1), m.group(2), m.group(3)
                level_upgrades.append({"class": cls, "level": int(lvl), "text": body})
                i += 1
                continue
            m2 = LEVEL_RE2.match(text)
            if m2:
                lvl, body = m2.group(1), m2.group(2)
                level_upgrades.append({"class": "战士", "level": int(lvl), "text": body})
                i += 1
                continue

        if text.startswith("抉择："):
            choice_notes.append(text)
            i += 1
            continue

        if text.startswith("-----") or (len(text) > 4 and "天赋树" in text and "解锁" in text):
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
            description.append(text)
        elif phase == "fields" and not any(text.startswith(p) for p in FIELD_PREFIXES):
            description.append(text)

        i += 1

    return {
        "name": text0,
        "fields": fields,
        "mark_dots": mark_dots,
        "description": description,
        "level_upgrades": level_upgrades,
        "flavor": "\n".join(flavor_parts).strip(),
        "choice_notes": choice_notes,
    }


def block_score(block: dict) -> tuple:
    fields = block["fields"]
    kw = fields.get("关键词", "")
    return (
        1 if "施展时间" in fields else 0,
        1 if kw.startswith("战技.") or kw.startswith("天赋.") else 0,
        len(fields),
        len(block["mark_dots"]),
        len(block["description"]),
    )


def build_docx_index(paras: list[dict], names: set[str]) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for i, p in enumerate(paras):
        if p["text"] not in names:
            continue
        block = extract_skill_block(paras, i, names)
        if not block:
            continue
        name = block["name"]
        prev = index.get(name)
        if prev is None or block_score(block) > block_score(prev):
            index[name] = block
    return index


def dots_html(dots: list[str]) -> str:
    if not dots:
        return ""
    parts = []
    for hex_c in dots:
        shadow = (
            "text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;"
            if hex_c in LIGHT_COLORS else ""
        )
        parts.append(f'<span style="font-size:1.5em;color:{hex_c};{shadow}">●</span>')
    return "".join(parts)


def field_p(label: str, value: str) -> str:
    return f'<p><span class="field">{label}：</span>{value}</p>'


def build_detail_html(block: dict) -> str:
    fields = block["fields"]
    ordered: list[str] = []

    for fk in FIELD_ORDER:
        if fk == "标识":
            if block["mark_dots"]:
                ordered.append(
                    f'<p><span class="field">标识：</span>{dots_html(block["mark_dots"])}</p>'
                )
            continue
        if fk in fields:
            ordered.append(field_p(fk, fields[fk]))

    desc = block["description"]
    if desc:
        ordered.append(field_p("描述", desc[0]))
        for para in desc[1:]:
            ordered.append(f"<p>{para}</p>")

    for lu in block["level_upgrades"]:
        lvl = lu["level"]
        cls = lu.get("class", "战士")
        ordered.append(f'<p><span class="field">你的{cls}等级到达{lvl}级时：</span>{lu["text"]}</p>')

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
    if parts and parts[0] in ("战技", "法术", "能力", "战术"):
        return parts[1:] if len(parts) > 1 else parts
    return parts


def cost_json(dots: list[str]) -> list[dict]:
    out = []
    for hex_c in dots:
        name = HEX2FULL.get(hex_c, "无色")
        out.append({"color": hex_c, "count": 1, "name": name.replace("色", "色") if name.endswith("色") else name, "id": name})
    # merge same color for data json count field
    merged: dict[str, dict] = {}
    for item in out:
        h = item["color"]
        if h not in merged:
            merged[h] = {**item, "count": 0}
        merged[h]["count"] += 1
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


def build_data_search(block: dict, style: str, tier_label: str, tags: list[str]) -> str:
    parts = [style, tier_label, block["name"], *tags]
    for fk in FIELD_ORDER:
        if fk in block["fields"]:
            parts.append(f"{fk}：{block['fields'][fk]}")
    parts.extend(block["description"])
    if block["flavor"]:
        parts.append(block["flavor"])
    return " ".join(parts)


def sanitize_data_search(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return text.replace('"', "").strip()


def patch_html(html: str, skill_id: str, detail_html: str, data_search: str) -> str:
    id_marker = f'id="{skill_id}"'
    pos = html.find(id_marker)
    if pos == -1:
        raise ValueError(f"article not found: {skill_id}")

    article_start = html.rfind("<article", 0, pos)
    h4_start = html.find("<h4>", pos)
    if h4_start == -1:
        raise ValueError(f"h4 not found for {skill_id}")

    detail_start = html.find('<div class="detail">', h4_start)
    if detail_start == -1:
        raise ValueError(f"detail not found for {skill_id}")
    detail_content_start = detail_start + len('<div class="detail">')
    detail_end = html.find("</div>", detail_content_start)
    article_end = html.find("</article>", detail_end)

    safe_search = sanitize_data_search(data_search)
    middle = html[h4_start:detail_content_start]
    rebuilt = (
        f'<article class="skill " id="{skill_id}" data-search="{safe_search}">\n        '
        + middle
        + detail_html
        + html[detail_end:article_end + len("</article>")]
    )
    return html[:article_start] + rebuilt + html[article_end + len("</article>") :]


def tier_label_from_skill(old: dict) -> str:
    t = old.get("tier")
    if old.get("type") == "starting":
        return "一阶天赋树"
    if isinstance(t, int):
        cn = "一二三四五六七八"[t - 1] if 1 <= t <= 8 else str(t)
        return f"{cn}阶天赋树"
    return str(t)


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fx = json.loads(FX_PATH.read_text(encoding="utf-8"))
    fx_by_id = {s["id"]: s for s in fx["战士"]}

    names = {s["name"] for s in data["skills"]}
    paras = extract_paragraphs(DOCX)
    docx_index = build_docx_index(paras, names)

    html = HTML_PATH.read_text(encoding="utf-8")
    missing = []
    changed = []

    for skill in data["skills"]:
        sid = skill["id"]
        name = skill["name"]
        block = docx_index.get(name)
        if not block:
            missing.append(name)
            continue

        # JSON update
        fields = dict(block["fields"])
        if block["mark_dots"]:
            fields["标识"] = "".join("●" for _ in block["mark_dots"])
        fields.pop("费用", None)
        desc_body = [p for p in block["description"] if not p.startswith("限制：")]
        if "描述" not in fields and desc_body:
            fields["描述"] = desc_body[0]

        skill["fields"] = fields
        if block["description"]:
            skill["description"] = desc_body[1:] if len(desc_body) > 1 else desc_body
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
        html = patch_html(html, sid, detail_html, data_search)

        # skill_effects sync
        if sid in fx_by_id:
            f = fx_by_id[sid]
            cast = f.setdefault("cast", {})
            if "施展时间" in fields:
                cast["time"] = fields["施展时间"]
            if "施展距离" in fields:
                cast["range"] = fields["施展距离"]
            if "持续时间" in fields:
                cast["duration"] = fields["持续时间"]
            cost = f.setdefault("cost", {})
            fp = parse_fp(fields.get("疲劳消耗", ""))
            if fp is not None:
                cost["fp"] = fp
            elif fields.get("疲劳消耗") == "-":
                cost.pop("fp", None)
            if block["mark_dots"]:
                cost["sp"] = sp_list(block["mark_dots"])
            else:
                cost.pop("sp", None)
            if "额外条件" in fields:
                f["extra_condition"] = fields["额外条件"]
            elif "extra_condition" in f:
                del f["extra_condition"]
            if "前置条件" in fields:
                f["prerequisite"] = fields["前置条件"]
            if "施展条件" in fields:
                f["requirement"] = fields["施展条件"]
            if "施展限制" in fields:
                f["restriction"] = fields["施展限制"]
            if block["level_upgrades"]:
                f["upgrades"] = [
                    {"level": u["level"], "change": u["text"]} for u in block["level_upgrades"]
                ]
            f["tags"] = skill["tags"]

        changed.append(name)

    # global replace leftover 费用 labels in html
    html = html.replace('class="field">费用：</span>', 'class="field">标识：</span>')
    html = re.sub(r"费用：●", "标识：●", html)

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    HTML_PATH.write_text(html, encoding="utf-8")
    FX_PATH.write_text(json.dumps(fx, ensure_ascii=False, indent=2), encoding="utf-8")

    for src, dst in (
        (HTML_PATH, ELECTRON_HTML),
        (DATA_PATH, ELECTRON_DATA),
        (FX_PATH, ELECTRON_FX),
    ):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    report = {
        "docx_skills_indexed": len(docx_index),
        "json_skills": len(data["skills"]),
        "updated": len(changed),
        "missing_in_docx": missing,
    }
    (ROOT / "scripts" / "_warrior_sync_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
