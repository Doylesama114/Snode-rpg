#!/usr/bin/env python3
"""Print 基础职业-法师.docx paragraphs as JSON array."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

path = sys.argv[1]
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
with zipfile.ZipFile(path) as z:
    root = ET.fromstring(z.read("word/document.xml"))
paras = []
for p in root.iter(W + "p"):
    t = "".join(x.text for x in p.iter(W + "t") if x.text)
    if t.strip():
        paras.append(t.strip())
print(json.dumps(paras, ensure_ascii=False))
