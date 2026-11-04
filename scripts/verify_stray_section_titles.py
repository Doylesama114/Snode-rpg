
# -*- coding: utf-8 -*-
"""守门：技能正文/升级选项里不得混入「XX天赋树」这类节标题。"""
import glob
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "职业页", "数据")
TITLE = re.compile(r"^[^\s，。；、：]{2,22}天赋树$")
fails = []

def iter_skills(doc):
    if isinstance(doc, dict):
        for s in (doc.get("skills") or []):
            yield s
        domains = doc.get("domains")
        if isinstance(domains, dict):
            for d in domains.values():
                for s in (d.get("skills") or []):
                    yield s
        for a in (doc.get("advancements") or []):
            for s in (a.get("skills") or []):
                yield s

for path in sorted(glob.glob(os.path.join(DATA, "*.json"))):
    name = os.path.basename(path)
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception:
        continue
    for s in iter_skills(doc):
        spots = [("description", x) for x in (s.get("description") or [])]
        f = (s.get("fields") or {}).get("描述")
        if f:
            spots.append(("字段描述", f))
        for u in (s.get("level_upgrades") or []):
            for c in (u.get("choices") or []):
                spots.append(("升级选项", c))
        for kind, v in spots:
            text = str(v).strip()
            if text and TITLE.match(text):
                fails.append("%s / %s / %s / %s" % (name, s.get("name"), kind, text))

print("节标题串行检查：%d 处" % len(fails))
for f in fails[:10]:
    print("  -", f)
sys.exit(1 if fails else 0)
