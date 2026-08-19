# -*- coding: utf-8 -*-
"""UI 结构回归：原生 JS 对话框清零 / 职业专长导航唯一 / CSS 缓存版本一致 / 文章 div 平衡。"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NATIVE_RE = {
    "alert": re.compile(r"(?<![\w.])alert\s*\("),
    "confirm": re.compile(r"(?<![\w.])confirm\s*\("),
    "prompt": re.compile(r"(?<![\w.])prompt\s*\("),
}
REQUIRED_DIALOG_PAGES = [
    "斯诺德跑团/角色面板.html",
    "斯诺德跑团/角色创建页.html",
    "斯诺德跑团/角色存档页.html",
    "斯诺德跑团/角色选择页.html",
    "斯诺德跑团/上传角色.html",
    "斯诺德跑团/顾问.html",
]
errors = []

for root_name in ("斯诺德跑团", "职业页"):
    root = ROOT / root_name
    for p in root.rglob("*"):
        if p.suffix not in (".html", ".js"):
            continue
        if "ui_dialog.js" in p.name:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except Exception:
            continue
        for name, pat in NATIVE_RE.items():
            for m in pat.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                errors.append(f"{p.relative_to(ROOT)}:{line}: raw {name}()")

for rel in REQUIRED_DIALOG_PAGES:
    p = ROOT / rel
    if not p.exists():
        errors.append(f"missing dialog page {rel}")
        continue
    if 'src="ui_dialog.js"' not in p.read_text(encoding="utf-8"):
        errors.append(f"{rel}: ui_dialog.js not included")

for base in ("职业页", "electron-app/职业页"):
    root = ROOT / base
    if not root.exists():
        continue
    for p in root.glob("*.html"):
        text = p.read_text(encoding="utf-8")
        if "class-features" in text:
            n = len(re.findall(r'<a class="style-link" href="#[^"]*class-features">职业专长</a>', text))
            if n != 1:
                errors.append(f"{p.relative_to(ROOT)}: class-features nav links = {n}")

pkg = ROOT / "electron-app" / "package.json"
expected_css = ""
if pkg.exists():
    try:
        expected_css = json.loads(pkg.read_text(encoding="utf-8")).get("version", "")
    except Exception:
        pass
if expected_css:
    for base in ("职业页", "electron-app/职业页"):
        root = ROOT / base
        for p in root.glob("*.html"):
            text = p.read_text(encoding="utf-8")
            for m in re.finditer(r"common\.css\?v=[\d.]+", text):
                if m.group(0) != f"common.css?v={expected_css}":
                    errors.append(f"{p.relative_to(ROOT)}: {m.group(0)} != v{expected_css}")

# 每个 article 的 div 开闭平衡
for base in ("职业页", "electron-app/职业页"):
    root = ROOT / base
    if not root.exists():
        continue
    for p in root.glob("*.html"):
        text = p.read_text(encoding="utf-8")
        for m in re.finditer(r"<article\b[^>]*>.*?</article>", text, re.S):
            block = m.group(0)
            opens = len(re.findall(r"<div\b", block))
            closes = len(re.findall(r"</div>", block))
            if opens != closes:
                aid = re.search(r'id="([^"]+)"', block)
                errors.append(f"{p.relative_to(ROOT)}: {aid.group(1) if aid else 'article'} div {opens}/{closes}")

if errors:
    print("UI 结构回归失败：")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("UI 结构回归通过：无原生 alert/confirm/prompt；职业专长导航唯一；CSS 版本一致；文章 div 平衡")
