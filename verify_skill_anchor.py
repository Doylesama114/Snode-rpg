#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""技能定位与描述完整性断言（2026-10-15 新增）。

背景：2026-10-15 发现 5 个技能的 source.para_start 指到了列表里的同名条目，
      且 class_sync_core 的 break 条件 text.endswith("天赋树") 会误伤以「…天赋树」
      结尾的正文，导致描述被静默丢弃。本脚本把这两类问题固化为门禁。
"""
import json, sys, glob
sys.path.insert(0, "scripts")
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
import class_sync_core as C
import extract_class_docx as E

SKIP = {"classes","style_mappings","color_definitions","level_up","backgrounds","races",
        "items","equipment","equipment_catalog","materials","ores","herbs","potions",
        "scrolls","gadgets","magic_services","bg_personality","特殊专长","通用·进阶"}
PASS, FAIL = 0, 0
def ok(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1; print("  PASS " + name + (("  " + extra) if extra else ""))
    else:
        FAIL += 1; print("  FAIL " + name + (("  " + extra) if extra else ""))

def skills_of(dd):
    if isinstance(dd, dict): return dd.get("skills") or []
    if isinstance(dd, list):
        out = []
        for x in dd:
            if isinstance(x, dict) and x.get("skills"): out += x["skills"]
            elif isinstance(x, dict) and x.get("name"): out.append(x)
        return out
    return []

BLANK = []          # fields 无描述 且 description 空 且 level_upgrades 空
cache = {}
checked = 0
hit = 0
anchored = 0
ANCHOR_IDS = {"m-skill-3-3-9","wd-skill-27","st-skill-46","st-skill-74","st-skill-78","st-skill-80"}
for f in sorted(glob.glob("职业页/数据/*.json")):
    cn = Path(f).stem
    if cn in SKIP: continue
    docx = Path("基础职业-%s.docx" % cn)
    if not docx.exists(): continue
    try: dd = json.loads(Path(f).read_text(encoding="utf-8"))
    except Exception: continue
    if cn not in cache:
        psx = C.extract_paragraphs(docx)
        cache[cn] = (psx, E.discover_skill_names(psx))
    psx, names = cache[cn]
    for s in skills_of(dd):
        fields = s.get("fields") or {}
        base = str(fields.get("描述") or "").strip()
        desc = s.get("description") or []
        ups = s.get("level_upgrades") or []
        if not base and not [x for x in desc if str(x).strip()] and not ups:
            BLANK.append("%s / %s (%s)" % (cn, s.get("name"), s.get("id")))
        st = (s.get("source") or {}).get("para_start")
        if not st: continue
        checked += 1
        b = C.extract_skill_block(psx, st, names)
        good = bool(b) and b.get("name") == s.get("name")
        if good: hit += 1
        if s.get("id") in ANCHOR_IDS:
            if good: anchored += 1
print("=== 技能定位与描述完整性 ===")
print("  有 para_start 的技能: %d · 命中自身技能名: %d (%.0f%%)" % (checked, hit, 100.0 * hit / checked if checked else 0))
ok("无「描述全空」的技能", len(BLANK) == 0, ("共 %d 个: %s" % (len(BLANK), "; ".join(BLANK[:4]))) if BLANK else "")
ok("定位命中率不低于基线 1079/1954", hit >= 1079, "当前 %d" % hit)
ok("2026-10-15 修复的 6 个技能全部命中自身", anchored == len(ANCHOR_IDS), "%d/%d" % (anchored, len(ANCHOR_IDS)))
print("")
print("技能定位校验: %dP %dF" % (PASS, FAIL))
sys.exit(0 if FAIL == 0 else 1)