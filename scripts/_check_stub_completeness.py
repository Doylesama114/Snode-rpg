# -*- coding: utf-8 -*-
"""Check which stub IDs have full articles elsewhere."""
from __future__ import annotations

import re
from pathlib import Path

HTML = Path(__file__).resolve().parent.parent / "职业页" / "通用天赋树.html"
html = HTML.read_text(encoding="utf-8")

stub_ids = [
    "g-skill-380", "g-skill-379", "g-skill-378", "g-skill-377",
    "g-skill-424", "g-skill-423", "g-skill-422",
    "g-skill-421", "g-skill-425", "g-skill-426", "g-skill-427", "g-skill-428", "g-skill-429",
    "g-skill-430", "g-skill-431", "g-skill-432", "g-skill-433", "g-skill-434",
    "g-skill-435", "g-skill-436", "g-skill-437", "g-skill-333",
]

for sid in stub_ids:
    # find all article starts for this id
    starts = [m.start() for m in re.finditer(rf'<article class="skill" id="{sid}"', html)]
    for i, start in enumerate(starts):
        chunk = html[start : start + 800]
        has_chips = '<div class="chips">' in chunk[:500]
        has_detail = '<div class="detail">' in chunk[:1500]
        # crude: does next 2000 chars contain </article> before next <article?
        window = html[start : start + 4000]
        next_art = window.find('<article class="skill"', 10)
        close = window.find("</article>")
        complete = close != -1 and (next_art == -1 or close < next_art)
        line = html[:start].count("\n") + 1
        title_m = re.search(r"<h4>([^<]+)", chunk)
        title = title_m.group(1).strip() if title_m else "?"
        print(f"{sid} #{i+1} L{line} complete={complete} chips={has_chips} detail={has_detail} | {title}")
