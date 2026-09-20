# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAME = "哟吼船长的藏宝图"


def main() -> None:
    j = json.loads((ROOT / "职业页/数据/通用天赋树.json").read_text(encoding="utf-8"))
    s = next(x for x in j["skills"] if x["name"] == NAME)
    print("json", s["id"], s["tier"], "奇珍" in s["fields"]["描述"], "传说" in s["fields"]["描述"])

    e = json.loads((ROOT / "斯诺德跑团/skill_effects_通用天赋树.json").read_text(encoding="utf-8"))
    s = next(x for x in e["skills"] if x["name"] == NAME)
    print("effects", s["tier"], "奇珍" in s["fields"]["描述"], "传说" in s["fields"]["描述"])

    a = json.loads((ROOT / "advisor/skills/universal_index.json").read_text(encoding="utf-8"))
    s = next(x for x in a["skills"] if x["name"] == NAME)
    print("advisor", s["tier"], "奇珍" in s["summary"], "传说" in s["summary"])

    u = (ROOT / "斯诺德跑团/上传角色.html").read_text(encoding="utf-8")
    m = re.search(re.escape(NAME) + r'":"([^"]+)"', u)
    print("upload", m.group(1) if m else None)

    p = (ROOT / "斯诺德跑团/panel_data.js").read_text(encoding="utf-8")
    i = p.find(NAME)
    chunk = p[i : i + 120]
    print("panel_chunk", chunk)
    print("panel_五阶", "五阶" in chunk, "七阶" in chunk)

    si = (ROOT / "职业页/search-index.json").read_text(encoding="utf-8")
    print("search", NAME in si)

    html = (ROOT / "职业页/通用天赋树.html").read_text(encoding="utf-8")
    # article in 五阶 section
    t5 = re.search(r'id="g-tier-5".*?</section>', html, re.S)
    t7 = re.search(r'id="g-tier-7".*?</section>', html, re.S)
    print("html_in_t5", bool(t5 and NAME in t5.group(0)))
    print("html_in_t7", bool(t7 and NAME in t7.group(0)))
    print("html_id_387", 'id="g-skill-387"' in html and NAME in html)
    # nav
    print("nav5", bool(re.search(r'g-nav-tier-5[\s\S]*?' + re.escape(NAME), html)))
    print("nav7_has", bool(re.search(r'g-nav-tier-7[\s\S]*?' + re.escape(NAME), html)))


if __name__ == "__main__":
    main()
