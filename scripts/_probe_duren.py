# -*- coding: utf-8 -*-
import json, re
from pathlib import Path
ROOT = Path(r"D:\Download\scholar-agent-main")

# REF_RACES talents
p = (ROOT / "斯诺德跑团" / "panel_data.js").read_text(encoding="utf-8")
m = re.search(r"const REF_RACES = JSON\.parse\('(.+?)'\)", p, re.S)
if m:
    d = json.loads(m.group(1))
    for k in ["卓尔精灵", "黑暗精灵"]:
        r = d.get(k, {})
        print("REF_RACES", k, json.dumps(r.get("talents"), ensure_ascii=False))

# 毒刃 in STYLE_MAP / SKILL_DATA
print("毒刃 in panel_data.js:", "毒刃" in p)
if "毒刃" in p:
    i = p.index("毒刃")
    print("context:", p[max(0,i-60):i+80])

# SKILL_LOOKUP
sl = re.search(r'var SKILL_LOOKUP=(\{.+?\});', p, re.S)
if sl:
    lookup = json.loads(sl.group(1))
    print("SKILL_LOOKUP 毒刃:", lookup.get("毒刃"))

# RACES json 毒吻者
races = json.loads((ROOT / "职业页/数据/races.json").read_text(encoding="utf-8"))
for name in ["卓尔精灵", "黑暗精灵"]:
    r = next(x for x in races if x["name"] == name)
    print(name, "traits:", [(t["name"], t["desc"]) for t in r["特性"]])
