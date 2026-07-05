#!/usr/bin/env python3
"""Find plain ● in .detail blocks (not wrapped in color spans)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "职业页"
COLOR_DOT = re.compile(r'font-size:1\.5em;color:#[0-9A-Fa-f]{6}')

issues: list[tuple[str, str]] = []
for html in sorted(ROOT.glob("*.html")):
    text = html.read_text(encoding="utf-8")
    for m in re.finditer(r'<div class="detail">(.*?)</div>', text, re.S):
        block = m.group(1)
        for pm in re.finditer("●", block):
            ctx = block[max(0, pm.start() - 150) : pm.start() + 10]
            if not COLOR_DOT.search(ctx):
                issues.append((html.name, ctx.replace("\n", " ")[:120]))
                break

print(f"Files with plain dots in detail: {len(issues)}")
for name, ctx in issues:
    print(f"  {name}: ...{ctx}...")
