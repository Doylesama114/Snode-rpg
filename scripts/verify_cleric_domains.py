# -*- coding: utf-8 -*-
"""Smoke checks for cleric deity panels."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "职业页" / "牧师.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "职业页" / "数据" / "牧师·神圣领域.json").read_text(encoding="utf-8"))
errors = []

if html.count('<div class="deity-chip') < 14 and html.count('class="deity-chip') < 14:
    errors.append("expected 14 deity chips (incl 通用)")
chips = re.findall(r'class="deity-chip[^"]*"', html)
if len(chips) != 14:
    errors.append(f"chip count {len(chips)} != 14")
locked = [p for p in data["pantheon"] if p["locked"]]
if len(locked) != 3:
    errors.append(f"locked {len(locked)} != 3")
if "战争与谋略之神" not in data["domains"]:
    errors.append("missing domain 战争与谋略之神")
if 'class="deity-chip locked" data-deity="战争与谋略之神"' in html:
    errors.append("战争与谋略之神 still locked")
if 'class="deity-chip" data-deity="战争与谋略之神"' not in html:
    errors.append("战争与谋略之神 chip missing/unlocked form")
for name in data["domains"]:
    if f'data-deity="{name}"' not in html:
        errors.append(f"missing panel/chip for {name}")
for name in [p["name"] for p in locked]:
    if "locked" not in html.split(name, 1)[0][-80:] and f'data-deity="{name}"' not in html:
        errors.append(f"locked deity missing chip: {name}")
# locked buttons should be disabled
for name in [p["name"] for p in locked]:
    if f'class="deity-chip locked" data-deity="{name}"' not in html:
        errors.append(f"chip not locked: {name}")

# 通用区块必须完好（防止注入误伤）
if html.count('class="class-features"') != 1:
    errors.append("class-features block missing or duplicated")
if html.count('id="pr-hpcalc"') != 1:
    errors.append("hpcalc block missing or duplicated")

# common skills still present
for sid in ("pr-skill-1", "pr-skill-5", "pr-style-戒律"):
    if sid not in html:
        errors.append(f"missing common {sid}")

# sample domain skills
for needle in ("树莓术", "好运飞弹", "爱箭恋矢", "奥术箭", "快速拨弦", "无形之手", "冲锋", "战争潮流", "审判", "圣光出鞘", "神谕真言·耀", "保护之手", "唤风术", "雨露之赐", "见证新生"):
    if needle not in html:
        errors.append(f"missing skill text {needle}")

if "pr-deity-switch-script" not in html:
    errors.append("missing switch script")
if "isSkillInActiveDeityPanel" not in (ROOT / "职业页" / "filter.js").read_text(encoding="utf-8"):
    errors.append("filter.js not scoped")

# electron mirror size parity
a = (ROOT / "职业页" / "牧师.html").stat().st_size
b = (ROOT / "electron-app" / "职业页" / "牧师.html").stat().st_size
if a != b:
    errors.append(f"electron html size mismatch {a} vs {b}")

# Layout: nav/content div balance — orphan </div> pushes deity panels under the sidebar.
nav = html[html.find("<nav") : html.find("</nav>")]
nav_bal = len(re.findall(r"<div\b", nav)) - len(re.findall(r"</div>", nav))
if nav_bal != 0:
    errors.append(f"nav div imbalance {nav_bal} (extra closes push content under sidebar)")
content_start = html.find('<div class="content">')
main_at = html.find("</main>", content_start)
content_close = html.rfind("</div>", content_start, main_at)
inside = html[content_start:content_close]
outside = html[content_close:main_at]
outside_panels = re.findall(r'id="(pr-panel-[^"]+)"', outside)
if outside_panels:
    errors.append(f"deity panels outside .content: {outside_panels}")
for pid in (
    "pr-panel-common",
    "pr-panel-life",
    "pr-panel-war",
    "pr-panel-lore",
    "pr-panel-art",
    "pr-panel-love",
    "pr-panel-luck",
    "pr-panel-secret",
    "pr-panel-hunger",
    "pr-panel-glory",
    "pr-panel-monsoon",
):
    if f'id="{pid}"' not in inside:
        errors.append(f"panel not inside .content: {pid}")


# ---- 隐藏神系边界：季风之神只在技能树出现 ----
create_html = (ROOT / "斯诺德跑团" / "角色创建页.html").read_text(encoding="utf-8")
_i = create_html.find("var CLERIC_DEITIES")
_j = create_html.find("];", _i)
if _i < 0 or _j < 0:
    errors.append("CLERIC_DEITIES not found in 角色创建页.html")
elif "季风之神" in create_html[_i:_j]:
    errors.append("hidden deity 季风之神 leaked into CLERIC_DEITIES (creation page)")

MONSOON_SKILLS = {"唤风术", "雨露之赐", "见证新生", "和风守护", "风暴之眼", "复苏祈咒"}

panel_text = (ROOT / "斯诺德跑团" / "panel_data.js").read_text(encoding="utf-8")
_m = re.search(r"SKILL_DATA\s*=\s*", panel_text)
if not _m:
    errors.append("SKILL_DATA not found in panel_data.js")
else:
    panel, _ = json.JSONDecoder().raw_decode(panel_text[_m.end():])
    priest_names = {s.get("name") for s in (panel.get("牧师") or [])}
    leaked = priest_names & MONSOON_SKILLS
    if leaked:
        errors.append(f"hidden domain skills leaked into SKILL_DATA['牧师']: {sorted(leaked)}")
    dom_rows = [r for r in (panel.get("牧师·神圣领域") or []) if r.get("deity") == "季风之神"]
    if not dom_rows:
        errors.append("季风之神 rows missing from SKILL_DATA['牧师·神圣领域']")
    elif not all(r.get("hidden") for r in dom_rows):
        errors.append("季风之神 rows in panel data must all carry hidden=true")

# help.html 里的「季风之神」属于世界观九柱神设定（非牧师领域表），不在此约束内

if errors:
    print("FAIL")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("PASS cleric domain smoke")
print("domains", len(data["domains"]), "locked", len(locked))
