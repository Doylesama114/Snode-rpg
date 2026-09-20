# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
html = Path("职业页/通用天赋树.html").read_text(encoding="utf-8")

for m in re.finditer(
    r'<article class="skill" id="(g-skill-\d+)"[^>]*>\s*<h4>哟吼船长的藏宝图\s*<span[^>]*>([^<]+)</span>',
    html,
):
    chunk = html[m.start() : m.start() + 2000]
    print("藏宝图", m.group(1), m.group(2), "complete", "</div>" in chunk and "</article>" in chunk, "奇珍", "奇珍" in chunk)

idx = html.find("哟吼船长的藏宝图")
h3s = list(re.finditer(r"<h3>[^<]+</h3>", html[:idx]))
print("section", h3s[-1].group(0) if h3s else None)
print("nav #g-skill-387", "#g-skill-387" in html)
print("nav g-skill-421", "g-skill-421" in html)
print("伤害阈值 count", html.count("伤害阈值"))
print("七阶 nav 藏宝图", bool(re.search(r'g-tier-七[\s\S]*?哟吼船长的藏宝图', html)))
print("五阶 nav 藏宝图", bool(re.search(r'g-tier-五[\s\S]*?哟吼船长的藏宝图[\s\S]*?</details>', html)))

# 冲击之铠 structure
m = re.search(
    r'<article class="skill" id="g-skill-371"[\s\S]*?</article>',
    html,
)
if m:
    block = m.group(0)
    print("冲击之铠 nested article", "<article" in block[10:])
    print("冲击之铠 has chips+detail", "chips" in block and "detail" in block)

# remaining orphans
from scripts.fix_universal_talent_stubs import find_orphan_bodies, STUB_OPEN_RE

print("orphans left", len(find_orphan_bodies(html)))
print("stubs left", len(list(STUB_OPEN_RE.finditer(html))))
