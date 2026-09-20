# -*- coding: utf-8 -*-
"""One-shot: diagnose nested article stubs in 通用天赋树.html"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "职业页" / "通用天赋树.html"


def main() -> None:
    html = HTML.read_text(encoding="utf-8")
    opens = len(re.findall(r'<article class="skill"', html))
    closes = len(re.findall(r"</article>", html))
    print(f"article open={opens} close={closes} delta={opens - closes}")

    # Find article open tags that are immediately followed by another article
    # (stub pattern: <article...><h4>...</h4>\n        <article)
    stub_pat = re.compile(
        r'(<article class="skill" id="(g-skill-\d+)"[^>]*>\s*<h4>[^<]*(?:<span[^>]*>[^<]*</span>)?</h4>\s*)(?=<article class="skill")',
        re.M,
    )
    stubs = list(stub_pat.finditer(html))
    print(f"stub-before-next-article: {len(stubs)}")
    for m in stubs:
        line = html[: m.start()].count("\n") + 1
        title = re.search(r"<h4>([^<]+)", m.group(1))
        print(f"  L{line}: {m.group(2)} {title.group(1).strip() if title else '?'}")

    # Also stubs before </div> (chips close)
    stub2 = re.compile(
        r'(<article class="skill" id="(g-skill-\d+)"[^>]*>\s*<h4>[^<]*(?:<span[^>]*>[^<]*</span>)?</h4>\s*)(?=</div>)',
        re.M,
    )
    stubs2 = list(stub2.finditer(html))
    print(f"stub-before-close-div: {len(stubs2)}")
    for m in stubs2:
        line = html[: m.start()].count("\n") + 1
        title = re.search(r"<h4>([^<]+)", m.group(1))
        print(f"  L{line}: {m.group(2)} {title.group(1).strip() if title else '?'}")

    # chips containing article
    for m in re.finditer(r'<div class="chips">([\s\S]*?)</div>', html):
        block = m.group(1)
        if "<article" in block:
            ids = re.findall(r'id="(g-skill-\d+)"', block)
            line = html[: m.start()].count("\n") + 1
            print(f"chips-nested L{line}: n={len(ids)} ids={ids}")


if __name__ == "__main__":
    main()
