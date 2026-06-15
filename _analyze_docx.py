# -*- coding: utf-8 -*-
import json, glob, os, re

root = "D:/Download/scholar-agent-main"
data_dir = os.path.join(root, "职业页/数据")
skip_files = {
    "style_mappings.json", "color_definitions.json", "backgrounds.json",
    "classes.json", "equipment.json", "items.json", "races.json",
    "bg_personality.json", "level_up.json", "gadgets.json", "herbs.json",
    "magic_services.json", "materials.json", "ores.json", "potions.json",
    "scrolls.json", "equipment_catalog.json",
    "backgrounds_data.js", "bg_personality_data.js", "classes_data.js",
    "equipment_catalog_data.js", "equipment_data.js", "items_data.js",
    "races_data.js", "\u7279\u6b8a\u4e13\u957f.json"
}

# Part 1: Analyze JSON
print("=== \u65bd\u5c55\u65f6\u95f4 FIELD COVERAGE IN JSON ===")
ok = 0; err = 0
for fpath in sorted(glob.glob(data_dir + "/*.json")):
    fname = os.path.basename(fpath)
    if fname in skip_files or "\u8fdb\u9636" in fname:
        continue
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "skills" in data:
            total = len(data["skills"])
            sst = sum(1 for s in data["skills"] if "fields" in s and "\u65bd\u5c55\u65f6\u95f4" in s.get("fields", {}))
            vals = set()
            for s in data["skills"]:
                if "fields" in s and "\u65bd\u5c55\u65f6\u95f4" in s["fields"]:
                    vals.add(s["fields"]["\u65bd\u5c55\u65f6\u95f4"])
            samples = list(vals)[:4]
            ok += 1
            print("{:8s} ({:20s}): {:3d}/{:3d} = {:2d}% with \u65bd\u5c55\u65f6\u95f4 | values: {}".format(
                data.get("name", "?"), fname, sst, total, 100*sst//total if total else 0, samples))
    except Exception as e:
        err += 1
        print("ERROR: {}: {}".format(fname, e))

print("\nProcessed {} OK, {} ERROR".format(ok, err))

# Part 2: Analyze data-search attributes
print("\n=== data-search \u65bd\u5c55\u65f6\u95f4 ANALYSIS ===")
html_dir = os.path.join(root, "\u804c\u4e1a\u9875")
classes = {
    "\u5fb7\u9c81\u4f0a": "druid", "\u6cd5\u5e08": "mage", "\u6218\u58eb": "warrior",
    "\u6e38\u8361\u8005": "r", "\u541f\u6e38\u8bd7\u4eba": "bard",
    "\u730e\u4eba": "hunter", "\u5723\u9a91\u58eb": "paladin",
    "\u86ee\u6597\u58eb": "berserker", "\u6b66\u50e7": "monk",
    "\u7267\u5e08": "priest", "\u672f\u58eb": "warlock",
    "\u9b54\u5951\u5e08": "pact", "\u5947\u68b0\u5e08": "artificer",
    "\u8428\u6ee1\u796d\u53f8": "shaman"
}
for cn, cid in classes.items():
    hp = os.path.join(html_dir, cn + ".html")
    if not os.path.exists(hp):
        continue
    with open(hp, "r", encoding="utf-8") as f:
        html = f.read()
    sc = re.findall(r'data-search="([^"]*)"', html)
    sst_count = sum(1 for s in sc if "\u65bd\u5c55\u65f6\u95f4" in s)
    print("  {:8s} ({:12s}): {:3d}/{:3d} data-search mention \u65bd\u5c55\u65f6\u95f4".format(cn, cid, sst_count, len(sc)))

print("\nDone!")
