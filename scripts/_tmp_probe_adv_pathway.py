# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

docx = Path(r"D:\Download\scholar-agent-main\《基础职业进阶途径》.docx")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
with ZipFile(docx) as z:
    root = ET.fromstring(z.read("word/document.xml"))

paras: list[str] = []
for p in root.iter(W + "p"):
    texts = []
    for t in p.iter(W + "t"):
        if t.text:
            texts.append(t.text)
    text = "".join(texts).strip()
    if text:
        paras.append(text)

out = Path(r"D:\Download\scholar-agent-main\scripts\_tmp_adv_pathway_probe.txt")
lines: list[str] = []
lines.append(f"TOTAL PARAS: {len(paras)}")
lines.append("=== ALL *进阶途径 HEADERS ===")
for i, t in enumerate(paras):
    if t.endswith("进阶途径") and len(t) < 40:
        lines.append(f"{i}|{t}")

kw = re.compile(r"神明|神系|领域|宗主|契约|信奉|神祇|教团|恩赐|神灵")
lines.append("")
lines.append("=== KEYWORD PARAS ===")
for i, t in enumerate(paras):
    if kw.search(t):
        lines.append(f"{i}|{t}")

bounds = [(i, t) for i, t in enumerate(paras) if t.endswith("进阶途径") and len(t) < 40]
bounds.append((len(paras), "END"))

SKIP = {
    "属性值需求",
    "来源",
    "标识",
    "特殊条件",
    "1",
    "2",
    "3",
    "力量",
    "敏捷",
    "体质",
    "智力",
    "感知",
    "魅力",
    "意志",
    "幸运",
    "进阶",
}


def dump_section(start: int, end: int, title: str) -> None:
    lines.append("")
    lines.append(f"--- SECTION {start}-{end}: {title} ({end - start} paras) ---")
    i = start + 1
    card_names: list[str] = []
    other: list[str] = []
    while i < end:
        t = paras[i]
        if t == "进阶" and i + 10 < end:
            name = paras[i + 10]
            card_names.append(f"{i}:{name}")
            i += 11
            continue
        if t.startswith("---"):
            i += 1
            continue
        if t not in SKIP and len(t) < 80:
            other.append(f"  [{i}] {t}")
        i += 1
    joined = " / ".join(card_names)
    lines.append(f"  cards ({len(card_names)}): {joined}")
    if other:
        lines.append("  other short paras:")
        for o in other[:50]:
            lines.append(o)


# Dump all sections that mention priest/warlock in title OR are between priest/warlock class blocks
for bi in range(len(bounds) - 1):
    start, title = bounds[bi]
    end = bounds[bi + 1][0]
    if "牧师" in title or "魔契师" in title:
        dump_section(start, end, title)

# Also dump paragraphs immediately before each 牧师/魔契师 section for context
lines.append("")
lines.append("=== CONTEXT BEFORE EACH 牧师/魔契师 HEADER (±5) ===")
for i, t in enumerate(paras):
    if ("牧师" in t or "魔契师" in t) and t.endswith("进阶途径"):
        lo = max(0, i - 5)
        hi = min(len(paras), i + 8)
        lines.append(f"--- around {i} ---")
        for j in range(lo, hi):
            mark = ">>>" if j == i else "   "
            lines.append(f"{mark}{j}|{paras[j]}")

# Check if headings use heading styles via runs - also look for non-ending headers
lines.append("")
lines.append("=== SHORT PARAS CONTAINING 神/宗主/契约/领域 NEAR PRIEST/WARLOCK RANGES ===")
# priest approx 3020-5132, warlock 10090-13720 from earlier
for i, t in enumerate(paras):
    if i < 2900 or (5200 < i < 10000) or i > 13800:
        continue
    if len(t) < 60 and re.search(r"神|宗主|契约|领域|信奉|教团", t):
        lines.append(f"{i}|{t}")

out.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out}")
print("headers:", sum(1 for t in paras if t.endswith("进阶途径") and len(t) < 40))
