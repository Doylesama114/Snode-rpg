# -*- coding: utf-8 -*-
"""Force-sync 哟吼船长的藏宝图 to 五阶 / 奇珍 across remaining data files."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
NAME = "哟吼船长的藏宝图"


def fix_skill_effects() -> None:
    path = ROOT / "斯诺德跑团" / "skill_effects_通用天赋树.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    n = 0
    for skill in data.get("通用天赋树", []):
        if skill.get("name") == NAME or skill.get("id") == "g-skill-387":
            if skill.get("tier") != "五阶":
                skill["tier"] = "五阶"
                n += 1
            effects = skill.get("effects") or []
            for i, e in enumerate(effects):
                if isinstance(e, str) and "传说品质" in e:
                    effects[i] = e.replace("传说品质", "奇珍品质")
                    n += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"skill_effects patched={n}")


def check_upload() -> None:
    t = (ROOT / "斯诺德跑团" / "上传角色.html").read_text(encoding="utf-8")
    m = re.search(re.escape(NAME) + r'":"([^"]+)"', t)
    print("upload tier:", m.group(1) if m else "MISSING")
    if m and m.group(1) != "五阶":
        t2 = t.replace(f'"{NAME}":"{m.group(1)}"', f'"{NAME}":"五阶"')
        (ROOT / "斯诺德跑团" / "上传角色.html").write_text(t2, encoding="utf-8")
        print("upload fixed")


def fix_panel() -> None:
    pd = ROOT / "斯诺德跑团" / "panel_data.js"
    pt = pd.read_text(encoding="utf-8")
    # Find SKILL_DATA entry window around name
    idx = pt.find(NAME)
    if idx < 0:
        print("panel: name missing")
        return
    # Expand window to capture style/tier fields near the skill
    start, end = max(0, idx - 500), min(len(pt), idx + 1200)
    w = pt[start:end]
    print("panel before window has 七阶:", "七阶" in w, "五阶:", "五阶" in w, "传说:", "传说" in w)
    w2 = w.replace("七阶天赋树", "五阶天赋树").replace("传说品质神奇道具", "奇珍品质神奇道具")
    w2 = re.sub(r'("tier"\s*:\s*")七阶(")', r"\1五阶\2", w2)
    # Also STYLE_MAP style may encode tier as "七阶天赋树" in nearby JSON
    if w2 != w:
        pd.write_text(pt[:start] + w2 + pt[end:], encoding="utf-8")
        print("panel patched")
    else:
        print("panel nochange in window")
    # Broader: any occurrence of name followed soon by 七阶
    # Check STYLE_MAP entry for this skill
    m = re.search(
        r'"\d+":\s*\{[^}]*"name"\s*:\s*"' + re.escape(NAME) + r'"[^}]*\}',
        pt,
    )
    if m:
        print("STYLE_MAP entry:", m.group(0)[:200])
        if "七阶" in m.group(0):
            fixed = m.group(0).replace("七阶", "五阶")
            pt = pd.read_text(encoding="utf-8")
            pd.write_text(pt.replace(m.group(0), fixed), encoding="utf-8")
            print("STYLE_MAP fixed")


def verify() -> None:
    j = json.loads((ROOT / "职业页/数据/通用天赋树.json").read_text(encoding="utf-8"))
    s = next(x for x in j["skills"] if x["name"] == NAME)
    print("json", s["tier"], "奇珍" in s["fields"]["描述"])

    e = json.loads((ROOT / "斯诺德跑团/skill_effects_通用天赋树.json").read_text(encoding="utf-8"))
    s = next(x for x in e["通用天赋树"] if x["name"] == NAME)
    print("effects", s["tier"], any("奇珍" in x for x in s.get("effects", [])))

    a = json.loads((ROOT / "advisor/skills/universal_index.json").read_text(encoding="utf-8"))
    s = next(x for x in a["skills"] if x["name"] == NAME)
    print("advisor", s["tier"], "奇珍" in s.get("searchText", ""))

    u = (ROOT / "斯诺德跑团/上传角色.html").read_text(encoding="utf-8")
    m = re.search(re.escape(NAME) + r'":"([^"]+)"', u)
    print("upload", m.group(1) if m else None)

    p = (ROOT / "斯诺德跑团/panel_data.js").read_text(encoding="utf-8")
    i = p.find(NAME)
    chunk = p[max(0, i - 80) : i + 200]
    print("panel_near:", chunk.replace("\n", " ")[:180])
    print("search", NAME in (ROOT / "职业页/search-index.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    fix_skill_effects()
    check_upload()
    fix_panel()
    verify()
