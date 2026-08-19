# -*- coding: utf-8 -*-
"""Insert 职业专长 chips/panels at the top of each base class page.

Reads 职业页/数据/class_features.json. Idempotent: removes an existing
class-features block for the page before insertion.
Usage: python scripts/apply_class_features.py [--apply]
"""
from __future__ import annotations

import html as html_mod
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "职业页" / "数据" / "class_features.json"
PAGES = ROOT / "职业页"
ELECTRON = ROOT / "electron-app" / "职业页"
BACKUP = ROOT / "备份区"

CLASS_FEATURES_RE = re.compile(
    r'\s*<section class="class-features"[^>]*>.*?</section>', re.S
)


def escape(s):
    return html_mod.escape(s or "", quote=True)


def render_item(item):
    if item["type"] == "table":
        rows = []
        for row in item.get("rows", []):
            cells = "".join(
                f'<span class="class-feature-table-cell">{escape(c)}</span>'
                for c in row
            )
            rows.append(f'<div class="class-feature-table-row">{cells}</div>')
        return '<div class="class-feature-table">' + "".join(rows) + "</div>"
    text = item.get("text", "").strip()
    if not text:
        return ""
    if item.get("type") == "note":
        return f'<p class="class-feature-note">{escape(text)}</p>'
    if text.startswith("·"):
        return f'<p class="class-feature-bullet">{escape(text)}</p>'
    return f"<p>{escape(text)}</p>"


def build_panel(prefix, data):
    features = data["features"]
    chips = []
    panels = []
    for i, feat in enumerate(features):
        active = ' active' if i == 0 else ""
        aria = "true" if i == 0 else "false"
        chips.append(
            f'<button type="button" class="class-feature-chip{active}" '
            f'role="tab" aria-selected="{aria}" data-feature-index="{i}">{escape(feat["name"])}</button>'
        )
        body_items = feat.get("body", [])
        if prefix == "pr" and feat["name"] == "神圣领域":
            # 神祇列表已由下方既有神圣领域 chips 完整展示，此处只保留导语。
            body_items = [x for x in body_items if x.get("type") != "p" or not x.get("text", "").startswith("·")]
            body_items.append({"type": "note", "text": "具体神祇与对应法表请使用下方「神圣领域」切换查看。"})
        body = "".join(render_item(x) for x in body_items)
        panels.append(
            f'<div class="class-feature-panel{active}" role="tabpanel" data-feature-panel="{i}">'
            f"<h3>{escape(feat['name'])}</h3>"
            f'<div class="class-feature-body">{body}</div>'
            "</div>"
        )
    intro = data.get("intro") or ""
    html = (
        f'\n<section class="class-features" id="{prefix}-class-features" aria-label="职业专长">'
        '<div class="class-feature-head"><h2>职业专长</h2>'
        + (f'<p class="class-feature-intro">{escape(intro)}</p>' if intro else "")
        + '</div>'
        '<div class="class-feature-tabs" role="tablist">'
        + "".join(chips)
        + "</div>"
        '<div class="class-feature-panels">'
        + "".join(panels)
        + "</div>"
        "</section>\n"
    )
    return html


def patch_page(path, prefix, data, apply):
    text = path.read_text(encoding="utf-8")
    # idempotent: remove previous block
    text = CLASS_FEATURES_RE.sub("", text)
    panel = build_panel(prefix, data)

    nav_end = text.find("</nav>")
    if nav_end == -1:
        raise SystemExit(f"</nav> not found in {path}")
    after = text[nav_end:]
    m = re.search(r'<section\b|<div class="deity-filter"', after)
    if not m:
        raise SystemExit(f"content insertion point not found in {path}")
    content_pos = nav_end + m.start()
    text = text[:content_pos] + panel + text[content_pos:]

    # idempotent: remove any previously inserted class-features nav links first
    text = re.sub(
        r'\s*<a class="style-link" href="#[^"]*class-features">职业专长</a>',
        "",
        text,
    )
    # nav link before starting-features link
    mnav = re.search(
        r'<a class="style-link" href="#[^"]*starting[^"]*"',
        text,
    )
    if not mnav:
        raise SystemExit(f"starting nav link not found in {path}")
    nav_link = f'<a class="style-link" href="#{prefix}-class-features">职业专长</a>\n'
    text = text[: mnav.start()] + nav_link + text[mnav.start():]

    if apply:
        path.write_text(text, encoding="utf-8", newline="\n")
    return text


def main():
    apply = "--apply" in sys.argv
    doc = json.loads(DATA.read_text(encoding="utf-8"))
    backup_dir = BACKUP / f"class-features-fix-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    if apply:
        backup_dir.mkdir(parents=True, exist_ok=True)

    for cls, data in doc["classes"].items():
        prefix = data["prefix"]
        page = PAGES / f"{cls}.html"
        if not page.exists():
            print("MISSING", page)
            continue
        if apply:
            shutil.copy2(page, backup_dir / page.name)
        patch_page(page, prefix, data, apply)
        print(cls, prefix, len(data["features"]), "features", "APPLIED" if apply else "dry")
        if apply:
            dst = ELECTRON / page.name
            shutil.copy2(page, dst)

    if apply:
        print("backup:", backup_dir)
    else:
        print("DRY RUN -- use --apply")


if __name__ == "__main__":
    main()
