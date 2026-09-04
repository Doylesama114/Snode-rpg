#!/usr/bin/env python3
"""Verify 守望者 sync: docx 结构 == JSON == FX == HTML == panel."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASS = "守望者"

html_path = ROOT / "职业页" / f"{CLASS}.html"
data_path = ROOT / "职业页" / "数据" / f"{CLASS}.json"
fx_path = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

html = html_path.read_text(encoding="utf-8")
data = json.loads(data_path.read_text(encoding="utf-8"))
fx = json.loads(fx_path.read_text(encoding="utf-8")) if fx_path.exists() else {CLASS: []}

skills = data["skills"]
articles = set(re.findall(r'<article class="skill" id="(wd-[^"]+)"', html))
json_ids = {s["id"] for s in skills}
fx_ids = {s["id"] for s in fx.get(CLASS, [])}
starting = [s for s in skills if s["id"].startswith("wd-starting-skill-")]
style_skills = [s for s in skills if s["id"].startswith("wd-skill-")]

styles = {}
for s in style_skills:
    styles.setdefault(s.get("style"), []).append(s.get("tier"))

errors: list[str] = []

def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)

check(len(skills) == 40, f"技能总数应为 40，实际 {len(skills)}")
check(len(starting) == 4, f"起始特性应为 4，实际 {len(starting)}")
check([s["name"] for s in starting] == ["挫志打击", "警戒之眼", "盾牌格挡", "荒野医疗"],
      f"起始特性顺序错误: {[s['name'] for s in starting]}")
check(set(styles) == {"守护", "警戒", "坚韧", "原野"},
      f"风格应为 守护/警戒/坚韧/原野，实际 {set(styles)}")
for style, tiers in styles.items():
    check(len(tiers) == 9 and tiers == ["一阶"] * 3 + ["二阶"] * 3 + ["三阶"] * 3,
          f"{style} 应为每阶 3 技能，实际 {tiers}")
check(json_ids == articles, f"JSON/HTML ID 不一致: json-html={json_ids - articles} html-json={articles - json_ids}")
check(json_ids == fx_ids, f"JSON/FX ID 不一致: json-fx={json_ids - fx_ids} fx-json={fx_ids - json_ids}")

# 荒野医疗 wording
wh = next((s for s in skills if s["id"] == "wd-starting-skill-4"), None)
check(wh is not None, "缺少 wd-starting-skill-4")
if wh is not None:
    text = json.dumps(wh, ensure_ascii=False)
    check("一组草药" in text, "荒野医疗应消耗一组草药")
    check("一份草药" not in text, "荒野医疗仍出现一份草药")

# 起始特性选择数 + 面板元数据
panel_text = (ROOT / "斯诺德跑团" / "panel_data.js").read_text(encoding="utf-8")
engine_text = (ROOT / "斯诺德跑团" / "panel_engine.js").read_text(encoding="utf-8")
check('"守望者"' in panel_text, "panel_data.js 缺少 守望者")
check("wd-starting-skill-1" in panel_text, "panel_data.js SKILL_DATA 缺少守望者技能")
check("STARTING_STYLE_OVERRIDE" in engine_text and "挫志打击" in engine_text,
      "panel_engine.js 起始风格映射缺少守望者")

# 首页 / 搜索 / 角色创建页入口
home = (ROOT / "职业页" / "首页.html").read_text(encoding="utf-8")
check('href="守望者.html"' in home, "职业页/首页.html 缺少守望者入口")
check("守望者·进阶.html" in home, "职业页/首页.html 缺少守望者进阶入口")
cc = (ROOT / "斯诺德跑团" / "角色创建页.html").read_text(encoding="utf-8")
check("'守望者':{key_attr:'意志'" in cc, "角色创建页 CLS_OVERRIDE 缺少守望者")
check('"守望者":[{n:"哨兵"' in cc, "角色创建页 CLASS_SPECIALIZATIONS 缺少守望者")
check('"守望者":[{n:"挫志打击"' in cc, "角色创建页 CLASS_STARTING_FEATURES 缺少守望者")

print("=== 守望者 sync 校验 ===")
print(f"skills={len(skills)} starting={len(starting)} styles={styles}")
print(f"html articles={len(articles)} fx={len(fx_ids)}")
if errors:
    print("\nFAIL")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("\nPASS")
