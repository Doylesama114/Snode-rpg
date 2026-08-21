# -*- coding: utf-8 -*-
"""校验 14 个基础职业武器熟练度：docx 原文 == CLASSES == REF_CLASSES == CLASS_WEAPON_PROF_DOCX。"""
import json
import re
import sys
from pathlib import Path

try:
    import docx
except Exception:
    print("缺少 python-docx")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent

# 1) docx 原文
docx_weapons = {}
for f in sorted((ROOT).glob("基础职业-*.docx")):
    name = f.stem.split("-", 1)[1]
    d = docx.Document(str(f))
    for p in d.paragraphs:
        t = p.text.strip()
        if t.startswith("武器："):
            docx_weapons[name] = t[len("武器："):].strip()
            break
    if name not in docx_weapons:
        docx_weapons[name] = ""

# 2) 创建页 CLASSES
classes_text = (ROOT / "职业页" / "数据" / "classes_data.js").read_text(encoding="utf-8")
classes_list = json.loads(classes_text[classes_text.index("["):classes_text.rindex("]") + 1])
classes_weapons = {c["name"]: c.get("武器", "") for c in classes_list}

# 3) 面板 REF_CLASSES 与两个武器映射
panel_text = (ROOT / "斯诺德跑团" / "panel_data.js").read_text(encoding="utf-8")
m_ref = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", panel_text, re.S)
if not m_ref:
    print("未找到 REF_CLASSES")
    sys.exit(1)
ref_classes = json.loads(m_ref.group(1).replace("\\'", "'"))
m_docx_map = re.search(r"var CLASS_WEAPON_PROF_DOCX=(\{[^;]+\});", panel_text)
m_cat_map = re.search(r"var CLASS_WEAPON_PROFS=(\{[^;]+\});", panel_text)
if not m_docx_map or not m_cat_map:
    print("未找到武器熟练映射")
    sys.exit(1)
prof_docx = json.loads(m_docx_map.group(1))
prof_cat = json.loads(m_cat_map.group(1))

CLASS_NAMES = ["蛮斗士", "战士", "法师", "猎人", "牧师", "圣骑士", "游荡者", "德鲁伊", "萨满祭司", "术士", "武僧", "吟游诗人", "魔契师", "奇械师"]

errors = []
for name in CLASS_NAMES:
    expected = docx_weapons.get(name, "")
    if not expected:
        errors.append(f"{name}: docx 未提取到武器行")
        continue
    if classes_weapons.get(name) != expected:
        errors.append(f"{name}: CLASSES 武器不符\n  期望: {expected}\n  实际: {classes_weapons.get(name)}")
    if ref_classes.get(name, {}).get("weapons") != expected:
        errors.append(f"{name}: REF_CLASSES.weapons 不符\n  期望: {expected}\n  实际: {ref_classes.get(name, {}).get('weapons')}")
    if prof_docx.get(name) != expected:
        errors.append(f"{name}: CLASS_WEAPON_PROF_DOCX 不符\n  期望: {expected}\n  实际: {prof_docx.get(name)}")

# 奇械师 REF 字段串位修复
art = ref_classes.get("奇械师", {})
if art.get("armor") != "轻甲、中甲、盾牌":
    errors.append(f"奇械师 REF armor 错误: {art.get('armor')}")
if art.get("saves") != ["智力", "意志"]:
    errors.append(f"奇械师 REF saves 错误: {art.get('saves')}")
if art.get("skills") != "从巧手、专注、逻辑、奥秘、知识、工程学、医药、洞悉中选择四项各+1":
    errors.append(f"奇械师 REF skills 错误: {art.get('skills')}")

# 大类映射修正点
if "火器" not in prof_cat.get("猎人", []):
    errors.append("猎人内部类别映射缺少 火器")
if not {"拳刃", "长柄"}.issubset(set(prof_cat.get("武僧", []))):
    errors.append(f"武僧内部类别映射缺少 拳刃/长柄: {prof_cat.get('武僧')}")

if errors:
    print("武器熟练度 docx 一致性校验失败：")
    for e in errors:
        print(" -", e)
    sys.exit(1)

print("武器熟练度 docx 一致性校验通过：14 职业 CLASSES / REF_CLASSES / CLASS_WEAPON_PROF_DOCX 全部一致；奇械师字段已恢复；猎人/武僧类别映射已修正")
