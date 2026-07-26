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

if html.count('<div class="deity-chip') < 13 and html.count('class="deity-chip') < 13:
    errors.append("expected 13 deity chips (incl 通用)")
chips = re.findall(r'class="deity-chip[^"]*"', html)
if len(chips) != 13:
    errors.append(f"chip count {len(chips)} != 13")
locked = [p for p in data["pantheon"] if p["locked"]]
if len(locked) != 5:
    errors.append(f"locked {len(locked)} != 5")
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

# common skills still present
for sid in ("pr-skill-1", "pr-skill-5", "pr-style-戒律"):
    if sid not in html:
        errors.append(f"missing common {sid}")

# sample domain skills
for needle in ("树莓术", "好运飞弹", "爱箭恋矢", "奥术箭", "快速拨弦", "无形之手", "冲锋", "战争潮流"):
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

if errors:
    print("FAIL")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("PASS cleric domain smoke")
print("domains", len(data["domains"]), "locked", len(locked))
