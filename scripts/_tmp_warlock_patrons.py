# -*- coding: utf-8 -*-
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(r"D:\Download\scholar-agent-main")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

with ZipFile(ROOT / "基础职业-魔契师.docx") as z:
    root = ET.fromstring(z.read("word/document.xml"))
paras = []
for p in root.iter(W + "p"):
    texts = []
    for t in p.iter(W + "t"):
        if t.text:
            texts.append(t.text)
    text = "".join(texts).strip()
    if text:
        paras.append(text)

# Find all mentions of 列表 or category-like patron names
out = []
for i, t in enumerate(paras):
    if any(k in t for k in ("宗主", "列表", "天界", "深渊", "妖精", "魔鬼", "旧日", "星界", "虚空", "梦境", "大妖精", "邪魔", "异界", "D8", "D10", "D12", "分类")):
        if len(t) < 200:
            out.append(f"{i}|{t}")
        else:
            out.append(f"{i}|{t[:200]}...")

# Also search repo for patron catalog files
cands = list(ROOT.glob("*宗主*")) + list(ROOT.glob("*契约*")) + list(ROOT.glob("*异界*"))
out.append("\n=== glob ===")
for c in cands:
    out.append(str(c))

# Search in 角色创建页 for patron select
html = (ROOT / "斯诺德跑团" / "角色创建页.html").read_text(encoding="utf-8")
idx = html.find("宗主")
out.append(f"\n创建 page 宗主 idx={idx}")
if idx >= 0:
    out.append(html[max(0,idx-200):idx+400])

Path(r"D:\Download\scholar-agent-main\scripts\_tmp_warlock_patrons.txt").write_text("\n".join(out), encoding="utf-8")
print("paras", len(paras), "hits", len(out))
