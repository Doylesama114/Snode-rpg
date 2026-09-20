# -*- coding: utf-8 -*-
"""Map repeated 牧师/魔契师 pathway blocks and hunt for branch labels."""
from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import json

ROOT = Path(r"D:\Download\scholar-agent-main")
docx = ROOT / "《基础职业进阶途径》.docx"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

with ZipFile(docx) as z:
    root = ET.fromstring(z.read("word/document.xml"))
    # relationships for images
    rels = {}
    try:
        rel_root = ET.fromstring(z.read("word/_rels/document.xml.rels"))
        for rel in rel_root:
            rid = rel.attrib.get("Id")
            target = rel.attrib.get("Target")
            if rid and target:
                rels[rid] = target
    except KeyError:
        pass

# Extract paragraphs WITH style info and nearby drawing hints
paras = []
for p in root.iter(W + "p"):
    texts = []
    for t in p.iter(W + "t"):
        if t.text:
            texts.append(t.text)
    text = "".join(texts).strip()

    pPr = p.find(W + "pPr")
    style = None
    if pPr is not None:
        ps = pPr.find(W + "pStyle")
        if ps is not None:
            style = ps.attrib.get(W + "val")

    # drawing / blip
    imgs = []
    for blip in p.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
        embed = blip.attrib.get(R + "embed") or blip.attrib.get("embed")
        if embed:
            imgs.append(rels.get(embed, embed))
    # also docProps alt?
    for docPr in p.iter("{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}docPr"):
        name = docPr.attrib.get("name")
        descr = docPr.attrib.get("descr")
        if name or descr:
            imgs.append(f"docPr:{name}|{descr}")

    if text or imgs:
        paras.append({"text": text, "style": style, "imgs": imgs})

# Find bounds of *进阶途径
bounds = []
for i, p in enumerate(paras):
    t = p["text"]
    if t.endswith("进阶途径") and len(t) < 40:
        bounds.append(i)
bounds.append(len(paras))

SKIP = {
    "属性值需求", "来源", "标识", "特殊条件", "1", "2", "3",
    "力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运", "进阶", "",
}

def cards_in(start, end):
    names = []
    i = start + 1
    while i < end:
        if paras[i]["text"] == "进阶" and i + 10 < end:
            names.append(paras[i + 10]["text"])
            i += 11
            continue
        i += 1
    return names

def context_before(idx, n=15):
    rows = []
    for j in range(max(0, idx - n), idx):
        p = paras[j]
        if p["text"] or p["imgs"]:
            rows.append({
                "i": j,
                "text": p["text"][:120],
                "style": p["style"],
                "imgs": p["imgs"],
            })
    return rows

report = {"priest_blocks": [], "warlock_blocks": [], "notes": []}

for bi in range(len(bounds) - 1):
    start = bounds[bi]
    end = bounds[bi + 1]
    title = paras[start]["text"]
    if title not in ("牧师进阶途径", "魔契师进阶途径"):
        continue
    block = {
        "index": len(report["priest_blocks" if "牧师" in title else "warlock_blocks"]),
        "para_start": start,
        "para_end": end,
        "title": title,
        "style": paras[start]["style"],
        "cards": cards_in(start, end),
        "context_before": context_before(start, 20),
        "imgs_in_block": [],
    }
    for j in range(start, min(end, start + 5)):
        if paras[j]["imgs"]:
            block["imgs_in_block"].extend(paras[j]["imgs"])
    # also any non-card short texts that aren't SKIP near start of block
    extras = []
    for j in range(start, min(end, start + 30)):
        t = paras[j]["text"]
        if t and t not in SKIP and t != title and not t.startswith("---") and len(t) < 40:
            if t not in block["cards"] and t not in ("●●●", "-", "X") and not t.isdigit():
                extras.append(f"{j}:{t}")
    block["early_extras"] = extras[:20]
    key = "priest_blocks" if "牧师" in title else "warlock_blocks"
    report[key].append(block)

# Also scan full doc for deity-like short headings near priest/warlock ranges
deity_kw = ("天父", "圣母", "骑士", "铁匠", "导师", "艺人", "隐者", "食尸鬼", "欢愉", "黑月",
            "宗主", "契约", "光耀", "自然", "战争", "知识", "死亡", "生命", "锻造", "艺术",
            "邪魔", "妖精", "深海", "古神", "魔鬼", "天使", "星界", "虚空", "梦境", "旧日")
hits = []
for i, p in enumerate(paras):
    t = p["text"]
    if not t or len(t) > 40:
        continue
    if any(k in t for k in deity_kw):
        if 2900 <= i <= 5200 or 10000 <= i <= 13800:
            hits.append(f"{i}|style={p['style']}|{t}")
report["deity_like_near_sections"] = hits

# Check beginning of doc for legend / deity list
intro = []
for i, p in enumerate(paras[:80]):
    if p["text"]:
        intro.append(f"{i}|{p['style']}|{p['text'][:100]}")
report["intro"] = intro

# Cross-check class docs for deity/patron lists
for cls_docx_name in ("基础职业-牧师.docx", "基础职业-魔契师.docx"):
    pth = ROOT / cls_docx_name
    if not pth.exists():
        report["notes"].append(f"missing {cls_docx_name}")
        continue
    with ZipFile(pth) as z:
        croot = ET.fromstring(z.read("word/document.xml"))
    cparas = []
    for p in croot.iter(W + "p"):
        texts = []
        for t in p.iter(W + "t"):
            if t.text:
                texts.append(t.text)
        text = "".join(texts).strip()
        if text:
            cparas.append(text)
    key_hits = []
    for i, t in enumerate(cparas):
        if any(k in t for k in ("神系", "神明", "神祇", "领域", "宗主", "契约", "信奉", "天父", "圣母", "恩赐")):
            if len(t) < 120:
                key_hits.append(f"{i}|{t}")
            else:
                key_hits.append(f"{i}|{t[:120]}...")
    report[f"class_docx_{cls_docx_name}"] = {
        "para_count": len(cparas),
        "keyword_hits_sample": key_hits[:80],
    }

out = ROOT / "scripts" / "_tmp_adv_branch_map.json"
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("priest blocks:", len(report["priest_blocks"]))
print("warlock blocks:", len(report["warlock_blocks"]))
for b in report["priest_blocks"]:
    print(f"P{b['index']}: {', '.join(b['cards'])}")
print("---")
for b in report["warlock_blocks"]:
    print(f"W{b['index']}: {', '.join(b['cards'])}")
print("wrote", out)
