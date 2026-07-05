#!/usr/bin/env python3
"""Parse 基础职业-战士.docx and compare with 职业页/战士.html + JSON."""
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "基础职业-战士.docx"
HTML = ROOT / "职业页" / "战士.html"
DATA_JSON = ROOT / "职业页" / "数据" / "战士.json"
FX_JSON = ROOT / "斯诺德跑团" / "skill_effects_战士.json"

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
HEX2NAME = {
    "#FF0000": "红色", "#EE822F": "橙色", "#FFF32F": "黄色", "#00B050": "绿色",
    "#00FA99": "青色", "#00B0F0": "蓝色", "#B3F9FF": "浅色", "#B94BFF": "紫色",
    "#FFB7E3": "粉色", "#843F0B": "棕色", "#FFFFFF": "白色", "#595959": "黑色",
    "#D9D9D9": "无色",
}
COLOR_TABLE = {
    "FF0000": "#FF0000", "EE822F": "#EE822F", "FFF32F": "#FFF32F", "FFD966": "#FFF32F",
    "00B050": "#00B050", "00FA99": "#00FA99", "00B0F0": "#00B0F0", "B3F9FF": "#B3F9FF",
    "00A0FF": "#B3F9FF", "B94BFF": "#B94BFF", "FFB7E3": "#FFB7E3", "FF66CC": "#FFB7E3",
    "843F0B": "#843F0B", "FFFFFF": "#FFFFFF", "595959": "#595959", "D9D9D9": "#D9D9D9",
}
LIGHT_COLORS = {"#FFFFFF", "#B3F9FF", "#FFF32F", "#FFB7E3", "#D9D9D9", "#00FA99"}
FIELD_KEYS = (
    "前置条件", "额外条件", "施展时间", "施展距离", "持续时间", "疲劳消耗",
    "关键词", "施展条件", "施展限制", "标识", "费用", "描述",
)


def extract_paragraphs(docx_path: Path):
    with zipfile.ZipFile(docx_path) as z:
        xml = z.read("word/document.xml")
    tree = ET.fromstring(xml)
    body = tree.find(f"{{{NS}}}body")
    lines = []
    for elem in list(body):
        for p in elem.iter(f"{{{NS}}}p"):
            parts = []
            mark_dots = []
            in_mark = False
            for r in p.iter(f"{{{NS}}}r"):
                t_el = r.find(f"{{{NS}}}t")
                if t_el is None or not t_el.text:
                    continue
                txt = t_el.text
                hex_c = None
                rpr = r.find(f"{{{NS}}}rPr")
                if rpr is not None:
                    c = rpr.find(f"{{{NS}}}color")
                    if c is not None:
                        v = c.get(f"{{{NS}}}val") or c.get("val")
                        if v and v.lower() != "auto":
                            hex_c = COLOR_TABLE.get(v.upper(), f"#{v.upper()}")
                parts.append(txt)
                if "标识" in "".join(parts) or "费用" in "".join(parts):
                    in_mark = True
                if in_mark and "●" in txt and hex_c:
                    mark_dots.extend([hex_c] * txt.count("●"))
            text = "".join(parts).strip()
            if text:
                lines.append({"text": text, "mark_dots": mark_dots})
    return lines


def parse_skills(lines):
    """Parse docx lines into skill records keyed by name (last occurrence wins)."""
    skills_by_name = {}
    order = []
    current_style = ""
    current_tier = ""
    current = None

    def flush():
        nonlocal current
        if current and current.get("name"):
            name = current["name"]
            if name not in skills_by_name:
                order.append(name)
            skills_by_name[name] = current.copy()
        current = None

    for item in lines:
        text = item["text"]
        if text.startswith("-----"):
            continue
        if text.endswith("风格") and "天赋树" not in text and len(text) < 16:
            flush()
            current_style = text
            continue
        if re.match(r"^[一二三四五六七八]阶天赋树", text):
            flush()
            current_tier = text.split("职业等级")[0].strip()
            continue
        if text.startswith("起始特性"):
            flush()
            current_style = "起始特性"
            current_tier = "起始特性"
            continue

        matched_field = None
        for fk in FIELD_KEYS:
            if text.startswith(fk + "：") or text.startswith(fk + ":"):
                matched_field = fk
                val = text.split("：", 1)[-1].split(":", 1)[-1].strip()
                break

        if matched_field:
            if current is None:
                continue
            if matched_field in ("标识", "费用"):
                current["fields"]["标识"] = val
                current["mark_dots"] = item["mark_dots"]
            else:
                current["fields"][matched_field] = val
            if matched_field == "描述" and val:
                current["description"].append(val)
            continue

        # level upgrade lines
        if text.startswith("你的") and "级时" in text:
            if current:
                current["level_upgrades"].append(text)
            continue

        # standalone description paragraph
        if current and current.get("_in_desc"):
            if any(text.startswith(k + "：") for k in FIELD_KEYS):
                pass
            else:
                current["description"].append(text)
                continue

        if matched_field == "描述":
            current["_in_desc"] = True
            continue

        # skill name candidate: no colon, reasonable length, not section headers
        if "：" not in text and len(text) <= 20:
            skip = (
                "天赋树", "职业等级", "风格", "战士", "抉择", "解锁", "选择",
                "等级到达", "XP", "经验", "附赠", "子职业", "关键属性",
            )
            if any(s in text for s in skip):
                continue
            # if previous line was a field, this might be flavor after description
            if current and current.get("_in_desc"):
                current["flavor"] = (current.get("flavor", "") + "\n" + text).strip()
                continue
            flush()
            current = {
                "name": text,
                "style": current_style,
                "tier": current_tier,
                "fields": {},
                "mark_dots": [],
                "description": [],
                "level_upgrades": [],
                "flavor": "",
                "_in_desc": False,
            }
            if current_style == "起始特性":
                current["type"] = "starting"
            continue

        if current and current.get("_in_desc") and not matched_field:
            if text.startswith("----------------------------------------------------------------"):
                current["_in_desc"] = False
            else:
                current["description"].append(text)

    flush()
    return [skills_by_name[n] for n in order], skills_by_name


def dots_html(dots):
    parts = []
    for hex_c in dots:
        shadow = (
            'text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;'
            if hex_c in LIGHT_COLORS else ""
        )
        parts.append(f'<span style="font-size:1.5em;color:{hex_c};{shadow}">●</span>')
    return "".join(parts)


def cost_json(dots):
    counts = {}
    for h in dots:
        counts[h] = counts.get(h, 0) + 1
    out = []
    for hex_c, count in counts.items():
        name = HEX2NAME.get(hex_c, "无色")
        out.append({"color": hex_c, "count": count, "name": name, "id": name})
    return out


def sp_names(dots):
    names = []
    for h in dots:
        names.append(HEX2NAME.get(h, "无色"))
    return names


def main():
    lines = extract_paragraphs(DOCX)
    docx_skills, docx_map = parse_skills(lines)
    print(f"Docx paragraphs: {len(lines)}")
    print(f"Docx skills parsed: {len(docx_skills)}")

    html = HTML.read_text(encoding="utf-8")
    html_ids = re.findall(r'id="(w-[^"]+)"', html)
    html_skill_ids = [i for i in html_ids if "skill" in i or "starting" in i]
    fee_count = html.count('class="field">费用：</span>')
    mark_count = html.count('class="field">标识：</span>')
    print(f"HTML skill articles: {len(set(html_skill_ids))}")
    print(f"HTML 费用: {fee_count}, 标识: {mark_count}")

    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
    data_by_name = {s["name"]: s for s in data["skills"]}
    print(f"JSON skills: {len(data['skills'])}")

    fx = json.loads(FX_JSON.read_text(encoding="utf-8"))
    fx_list = fx.get("战士", [])
    fx_by_name = {s["name"]: s for s in fx_list}
    print(f"skill_effects entries: {len(fx_list)}")

    only_docx = [s["name"] for s in docx_skills if s["name"] not in data_by_name]
    only_data = [n for n in data_by_name if n not in docx_map]
    print(f"Only in docx: {len(only_docx)}", only_docx[:10])
    print(f"Only in JSON: {len(only_data)}", only_data[:10])

    mark_mismatches = []
    for s in docx_skills:
        name = s["name"]
        if name not in data_by_name:
            continue
        old = data_by_name[name]
        old_cost = old.get("cost") or []
        new_cost = cost_json(s.get("mark_dots", []))
        if json.dumps(old_cost, sort_keys=True) != json.dumps(new_cost, sort_keys=True):
            mark_mismatches.append(name)

    print(f"Cost/mark color mismatches vs JSON: {len(mark_mismatches)}")
    if mark_mismatches[:15]:
        print("  sample:", mark_mismatches[:15])

    # write parsed for inspection
    out = ROOT / "scripts" / "_warrior_docx_parsed.json"
    out.write_text(json.dumps(docx_skills, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
