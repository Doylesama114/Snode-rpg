# -*- coding: utf-8 -*-
"""Verify HTML structure for 通用天赋树 after stub repair."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "职业页/通用天赋树.html").read_text(encoding="utf-8")
NAME = "哟吼船长的藏宝图"

opens = len(re.findall(r"<article\b", html))
closes = len(re.findall(r"</article>", html))
print(f"article balance {opens}/{closes}")

# chips containing nested article
bad = 0
for m in re.finditer(r'<div class="chips">(.*?)</div>', html, re.S):
    if "<article" in m.group(1):
        bad += 1
print(f"chips_nested_article={bad}")

# stubs: article with h4 but no chips before next article/section end — crude
stubs = 0
for m in re.finditer(r'<article[^>]*>\s*<h4[^>]*>.*?</h4>\s*(?=<article|</section)', html, re.S):
    stubs += 1
print(f"stub_openings={stubs}")

# location of 藏宝图
art = re.search(
    r'<article[^>]*id="g-skill-387"[^>]*>.*?</article>',
    html,
    re.S,
)
if not art:
    print("MISSING article g-skill-387")
else:
    body = art.group(0)
    print("chip_五阶", "五阶" in body and "七阶" not in body.split("chips")[0] if "chips" in body else False)
    print("desc_奇珍", "奇珍" in body, "传说" in body)
    # which tier section
    before = html[: art.start()]
    last_tier = re.findall(r'id="g-tier-(\d+)"', before)
    print("in_tier", last_tier[-1] if last_tier else "?")

# nav
nav5 = re.search(r'<details[^>]*id="g-nav-tier-5"[^>]*>.*?</details>', html, re.S)
nav7 = re.search(r'<details[^>]*id="g-nav-tier-7"[^>]*>.*?</details>', html, re.S)
# fallback: details containing 五阶
if not nav5:
    for m in re.finditer(r"<details[\s\S]*?</details>", html):
        if "五阶" in m.group(0)[:200] and "g-tier-5" in m.group(0):
            nav5 = m
            break
if not nav7:
    for m in re.finditer(r"<details[\s\S]*?</details>", html):
        if "七阶" in m.group(0)[:200] and "g-tier-7" in m.group(0):
            nav7 = m
            break

def nav_has(block, name):
    return bool(block and name in block.group(0))

print("nav5_has", nav_has(nav5, NAME))
print("nav7_has", nav_has(nav7, NAME))
print("orphan_421", 'id="g-skill-421"' in html)
