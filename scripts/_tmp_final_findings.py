# -*- coding: utf-8 -*-
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import json
import re

ROOT = Path(r"D:\Download\scholar-agent-main")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

def paras_of(docx: Path):
    with ZipFile(docx) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    for p in root.iter(W + "p"):
        texts = []
        for t in p.iter(W + "t"):
            if t.text:
                texts.append(t.text)
        text = "".join(texts).strip()
        if text:
            out.append(text)
    return out

# Extract warlock patron list section
wparas = paras_of(ROOT / "基础职业-魔契师.docx")
lines = ["=== 魔契师 宗主-related paras ==="]
capture = False
for i, t in enumerate(wparas):
    if "宗主" in t or "契约" in t or capture:
        if t in ("宗主契约",) or "宗主列表" in t or t.startswith("·") or re.match(r"^[一二三四五六七八九十]+[、.．]", t) or "位面" in t or "分类" in t:
            lines.append(f"{i}|{t}")
            capture = True
        elif capture and (t.startswith("·") or "宗主" in t or re.match(r"^\d+[\.、]", t) or "D" in t[:3]):
            lines.append(f"{i}|{t[:160]}")
        elif capture and i < 120:
            lines.append(f"{i}|{t[:160]}")
        if capture and i > 120 and "起始特性" in t:
            break

# Broader dump around paras 40-110
lines.append("\n=== 魔契师 paras 40-110 ===")
for i in range(40, min(110, len(wparas))):
    lines.append(f"{i}|{wparas[i][:180]}")

# Priest deity section already known; dump 45-75
pparas = paras_of(ROOT / "基础职业-牧师.docx")
lines.append("\n=== 牧师 paras 45-70 ===")
for i in range(45, min(70, len(pparas))):
    lines.append(f"{i}|{pparas[i][:180]}")

# JSON counts + duplicate names
for cls in ("牧师", "魔契师"):
    data = json.loads((ROOT / "职业页" / "数据" / f"{cls}·进阶.json").read_text(encoding="utf-8"))
    names = [a["name"] for a in data["advancements"]]
    from collections import Counter
    c = Counter(names)
    dups = {k: v for k, v in c.items() if v > 1}
    # check branch field absence
    sample_keys = sorted(data["advancements"][0].keys())
    lines.append(f"\n=== {cls}·进阶.json ===")
    lines.append(f"count={len(names)} unique={len(c)} dups={len(dups)}")
    lines.append(f"keys={sample_keys}")
    lines.append(f"dup sample={list(dups.items())[:12]}")

# advancement_details keys
import re as _re
adet = (ROOT / "职业页" / "advancement_details.js").read_text(encoding="utf-8")
# first object fields
m = _re.search(r"\{\s*\"name\":\s*\"[^\"]+\",([\s\S]*?)\n  \},", adet)
lines.append("\n=== advancement_details first-entry field names ===")
if m:
    fields = _re.findall(r"\"([a-zA-Z_]+)\"\s*:", m.group(0))
    lines.append(str(fields))

# advisor entry keys
adv = json.loads((ROOT / "advisor" / "advancements.json").read_text(encoding="utf-8"))
lines.append("advisor advancement keys: " + str(sorted(adv["advancements"][0].keys())))

# bg deities full list
bg = (ROOT / "职业页" / "数据" / "bg_personality_data.js").read_text(encoding="utf-8")
# crude extract first deities array
m = _re.search(r"\"deities\"\s*:\s*\[(.*?)\]", bg, _re.S)
if m:
    lines.append("acolyte deities raw: " + m.group(1)[:500])

# HTML structure check: any section/h2/h3 inside container?
for cls in ("牧师", "魔契师"):
    html = (ROOT / "职业页" / f"{cls}·进阶.html").read_text(encoding="utf-8")
    # between container start and empty
    start = html.find('class="adv-container"')
    chunk = html[start:start+5000]
    has_section = "<section" in chunk or "<h2" in chunk or "<h3" in chunk
    art_count = html.count('class="adv-card"')
    lines.append(f"\n{cls}·进阶.html cards={art_count} early_chunk_has_section/h2/h3={has_section}")

# Infer priest branch labels from 七神 order in class doc vs thematic cards
priest_infer = [
    ("P0", "公正与荣耀之神 / 天父 / 神圣", "圣堂刺客…光之侍…"),
    ("P1", "生命与丰收之神 / 圣母 / 自然", "自然行者…丰收祭司…祈雨者"),
    ("P2", "战争与谋略之神 / 骑士 / 物理", "武器大师…剑圣…骑兵"),
    ("P3", "火焰与锻造之神 / 铁匠 / 火焰", "火焰法师…战锤祭司…熔炉守护者"),
    ("P4", "知识与智慧之神 / 导师 / 奥术", "奥术师…博学者…卷轴学者"),
    ("P5", "艺术与创造之神 / 艺人 / 音爆", "戏法师…圣乐演奏家…绘梦画师"),
    ("P6", "死神 / 隐者 / 无属性", "死灵法师…灵媒…渡魂典卫"),
]
lines.append("\n=== inferred priest branch mapping (thematic; NOT labeled in pathway docx) ===")
for row in priest_infer:
    lines.append(f"{row[0]} => {row[1]} | theme: {row[2]}")

# Infer warlock from themes
warlock_infer = [
    ("W0", "天界/神圣？", "守护骑士 圣洁骑士 独角兽骑士 净化…"),
    ("W1", "冬/暗影/寂静？", "冰霜 冬霜 午夜 梦魇 影裔 寂静者"),
    ("W2", "妖精/飞行？", "妖精召唤者 花之舞者 翼法师 蝶魔术师"),
    ("W3", "梦境/绿野？", "梦境编织者 绿骑士 妖精龙骑士"),
    ("W4", "欢愉/小丑？", "秀逗 笑匠 狂欢 小丑 泡泡"),
    ("W5", "夏/自然妖精？", "繁春 仲夏 热情 季节 丰收"),
    ("W6", "深渊/火焰恶魔？", "火焰 毁灭 深渊召唤 恶魔使徒 纵火"),
    ("W7", "毁灭/狱卒？", "行刑官 毁灭 邪魂典狱长"),
    ("W8", "死灵/亵渎？", "死灵 亵渎祭司 奇美拉"),
    ("W9", "血疫/恐惧？", "血魔法 红袍 疫病 恐惧主教 屠夫"),
    ("W10", "魔鬼/地狱？", "炼狱 魔鬼收契人 小鬼 地狱犬"),
    ("W11", "灾厄/天启？", "混沌魔灵 天启 疫病 恐惧"),
    ("W12", "星界/宇宙？", "升腾 星骸 虚空 宇宙海妖"),
    ("W13", "空间/星炬？", "空间架构师 破界者 星之炬"),
    ("W14", "虚空侵蚀/先知？", "虚空之嗣 秽形 虚妄先知 超侵蚀者"),
]
lines.append("\n=== inferred warlock branch themes (NOT labeled in pathway docx) ===")
for row in warlock_infer:
    lines.append(f"{row[0]} => {row[1]} | {row[2]}")

Path(r"D:\Download\scholar-agent-main\scripts\_tmp_final_findings.txt").write_text("\n".join(lines), encoding="utf-8")
print("done")
