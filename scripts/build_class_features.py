# -*- coding: utf-8 -*-
"""Extract 初始专长 blocks from each 基础职业-*.docx front matter.

Output: 职业页/数据/class_features.json
Only the "初始专长" section (职业专长) is extracted, as requested.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "职业页" / "数据" / "class_features.json"
CLASSES = [
    "蛮斗士", "战士", "法师", "猎人", "牧师", "圣骑士", "游荡者",
    "德鲁伊", "萨满祭司", "术士", "武僧", "吟游诗人", "魔契师", "奇械师", "守望者",
]
SEP_RE = re.compile(r"^-{3,}$")
STYLE_OR_TIER_RE = re.compile(r"^([一二三四五六七八])阶天赋树")


def body_events(path: Path):
    doc = Document(str(path))
    events = []
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            text = "".join(n.text or "" for n in child.iter(qn("w:t"))).strip()
            if text:
                events.append(("P", text))
        elif child.tag == qn("w:tbl"):
            rows = []
            for tr in child.iter(qn("w:tr")):
                cells = [
                    "".join(n.text or "" for n in tc.iter(qn("w:t"))).strip()
                    for tc in tr.iter(qn("w:tc"))
                ]
                cells = [c for c in cells if c]
                if cells:
                    rows.append(cells)
            if rows:
                events.append(("T", rows))
    return events


def is_boundary(kind, text):
    if kind != "P":
        return False
    t = text.strip()
    if t in ("战斗风格", "起始特性", "起始技能"):
        return True
    if t.endswith("风格") and "天赋树" not in t and "：" not in t:
        return True
    if STYLE_OR_TIER_RE.match(t):
        return True
    return False


def normalize_intro(text):
    text = text.replace("，，", "，")
    return text.strip()


def extract_class(path: Path):
    events = body_events(path)
    try:
        start = next(i for i, (k, t) in enumerate(events) if k == "P" and t == "初始专长")
    except StopIteration:
        raise SystemExit(f"初始专长 heading not found in {path}")
    end = next((i for i in range(start + 1, len(events)) if is_boundary(*events[i])), len(events))

    intro = ""
    features = []
    current = None
    first_feature = True

    for kind, payload in events[start + 1 : end]:
        if kind == "P":
            text = payload.strip()
            if SEP_RE.match(text):
                if current is not None:
                    features.append(current)
                    current = None
                continue
            if first_feature:
                intro = normalize_intro(text)
                first_feature = False
                continue
            if current is None:
                # feature title; ignore stray explanatory line before first title
                if text.startswith("你") or text.startswith("作为一名"):
                    intro = normalize_intro(text)
                    continue
                current = {"name": text, "body": []}
            else:
                current["body"].append({"type": "p", "text": text})
        else:  # table
            if current is None:
                continue
            current["body"].append({"type": "table", "rows": payload})

    if current is not None:
        features.append(current)

    return {"intro": intro, "features": features}


WATCHMAN_FEATURE_NAMES = ["哨兵", "铁壁", "荒野庇护"]


def extract_watchman_class(path: Path):
    """守望者 docx 的职业专长标题没有独立分隔线，按已知标题切分。"""
    events = body_events(path)
    start = next(i for i, (k, t) in enumerate(events) if k == "P" and t == "初始专长")
    end = next((i for i in range(start + 1, len(events)) if is_boundary(*events[i])), len(events))

    intro = ""
    features = []
    current = None
    first_para = True
    for kind, payload in events[start + 1:end]:
        if kind == "P":
            text = payload.strip()
            if SEP_RE.match(text):
                if current is not None:
                    features.append(current)
                    current = None
                continue
            if first_para:
                intro = normalize_intro(text)
                first_para = False
                continue
            if text in WATCHMAN_FEATURE_NAMES:
                if current is not None:
                    features.append(current)
                current = {"name": text, "body": []}
            elif current is not None:
                current["body"].append({"type": "p", "text": text})
        else:
            if current is not None:
                current["body"].append({"type": "table", "rows": payload})
    if current is not None:
        features.append(current)
    return {"intro": intro, "features": features}


def prefix_for(class_name):
    html = (ROOT / "职业页" / f"{class_name}.html").read_text(encoding="utf-8")
    m = re.search(r'id="([A-Za-z]+)-filter-bar"', html)
    if not m:
        raise SystemExit(f"filter prefix not found for {class_name}")
    return m.group(1)


def main():
    out = {"version": 1, "classes": {}}
    for cls in CLASSES:
        docx = ROOT / f"基础职业-{cls}.docx"
        if not docx.exists():
            print("MISSING", docx)
            continue
        if cls == "守望者":
            data = extract_watchman_class(docx)
        else:
            data = extract_class(docx)
        data["prefix"] = prefix_for(cls)
        out["classes"][cls] = data
        print(cls, "features:", [f["name"] for f in data["features"]])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
