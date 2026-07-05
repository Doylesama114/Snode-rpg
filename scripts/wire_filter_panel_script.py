#!/usr/bin/env python3
"""Insert filter-panel.js before filter.js in class skill pages."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_DIR = ROOT / "职业页"
ELECTRON = ROOT / "electron-app" / "职业页"
TAG = '<script src="filter-panel.js"></script>\n'

for html_path in sorted(HTML_DIR.glob("*.html")):
    if html_path.name == "首页.html":
        continue
    text = html_path.read_text(encoding="utf-8")
    if "filter-panel.js" in text:
        continue
    if 'src="filter.js"' not in text:
        continue
    text = text.replace('<script src="filter.js"></script>', TAG + '<script src="filter.js"></script>', 1)
    html_path.write_text(text, encoding="utf-8")
    electron = ELECTRON / html_path.name
    if electron.parent.exists():
        electron.write_text(text, encoding="utf-8")
    print("OK:", html_path.name)

print("done")
