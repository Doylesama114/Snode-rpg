# -*- coding: utf-8 -*-
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
NAME = "哟吼船长的藏宝图"


def patch_obj(obj):
    changed = False
    if not isinstance(obj, dict):
        return False
    if obj.get("name") != NAME and obj.get("id") != "g-skill-387":
        return False
    if obj.get("tier") in ("七阶", "七阶天赋树"):
        obj["tier"] = "五阶" if obj["tier"] == "七阶" else "五阶天赋树"
        changed = True
    if isinstance(obj.get("fields"), dict) and "描述" in obj["fields"]:
        if "传说品质" in obj["fields"]["描述"]:
            obj["fields"]["描述"] = obj["fields"]["描述"].replace("传说品质", "奇珍品质")
            changed = True
    for key in ("summary", "searchText"):
        if isinstance(obj.get(key), str) and ("传说品质" in obj[key] or " 七阶 " in f" {obj[key]} "):
            obj[key] = obj[key].replace("传说品质", "奇珍品质").replace("七阶", "五阶")
            changed = True
    if isinstance(obj.get("effects"), list):
        for i, e in enumerate(obj["effects"]):
            if isinstance(e, str) and "传说品质" in e:
                obj["effects"][i] = e.replace("传说品质", "奇珍品质")
                changed = True
    return changed


def patch_json(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    n = 0

    def walk(o):
        nonlocal n
        if isinstance(o, dict):
            if patch_obj(o):
                n += 1
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(data)
    for skill in data.get("skills", []):
        if skill.get("name") == NAME:
            if skill.get("tier") in ("", "七阶"):
                skill["tier"] = "五阶"
                n += 1
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name}: patched={n}")


def main():
    patch_json(ROOT / "职业页" / "数据" / "通用天赋树.json")
    patch_json(ROOT / "斯诺德跑团" / "skill_effects_通用天赋树.json")
    patch_json(ROOT / "advisor" / "skills" / "universal_index.json")

    up = ROOT / "斯诺德跑团" / "上传角色.html"
    t = up.read_text(encoding="utf-8")
    t2 = t.replace(f'"{NAME}":"七阶"', f'"{NAME}":"五阶"')
    print("upload", "ok" if t2 != t else "miss")
    up.write_text(t2, encoding="utf-8")

    pd = ROOT / "斯诺德跑团" / "panel_data.js"
    pt = pd.read_text(encoding="utf-8")
    idx = pt.find(NAME)
    if idx < 0:
        print("panel: miss name")
        return
    start, end = max(0, idx - 300), min(len(pt), idx + 900)
    w = pt[start:end]
    w2 = w.replace("七阶天赋树", "五阶天赋树").replace("传说品质神奇道具", "奇珍品质神奇道具")
    w2 = re.sub(r'("tier"\s*:\s*")七阶(")', r"\1五阶\2", w2)
    pt2 = pt[:start] + w2 + pt[end:]
    pd.write_text(pt2, encoding="utf-8")
    print("panel", "ok" if w2 != w else "nochange")

    j = json.loads((ROOT / "职业页" / "数据" / "通用天赋树.json").read_text(encoding="utf-8"))
    for s in j["skills"]:
        if s["name"] == NAME:
            print("verify json", s["tier"], s["fields"].get("描述", "")[:50])
            break


if __name__ == "__main__":
    main()
