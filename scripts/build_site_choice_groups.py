# -*- coding: utf-8 -*-
"""Build scripts/site_choice_groups.json from root docx + HTML article order.

Authoritative choice groups are derived from the docx "抉择" paragraphs:
- base class pages: "抉择：A/B/..." lists its members explicitly;
- 通用天赋树: lettered headings (A-U etc.) delimit groups; explicit titles
  "抉择：英雄弧光/深渊呢喃" and "抉择：额外攻击/额外施法" list members.
User-confirmed overrides: 通用 M = 4 skills; H = 8 skills (docx already 8).
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "site_choice_groups.json"

BASE_CLASSES = [
    "吟游诗人", "圣骑士", "奇械师", "德鲁伊", "战士", "术士", "武僧",
    "法师", "游荡者", "牧师", "猎人", "萨满祭司", "蛮斗士", "魔契师",
]
TIER_HEAD = re.compile(r"^([一二三四五六七八])阶天赋树")


def body_events(path: Path):
    doc = Document(str(path))
    events = []
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            text = "".join(node.text or "" for node in child.iter(qn("w:t"))).strip()
            if text:
                events.append(("P", text))
        elif child.tag == qn("w:tbl"):
            cells = [
                "".join(node.text or "" for node in tc.iter(qn("w:t"))).strip()
                for tc in child.iter(qn("w:tc"))
            ]
            cells = [c for c in cells if c]
            events.append(("T", cells[0] if cells else ""))
    return events


def split_title(title: str):
    """Return (parts, max). parts are raw member names from a choice title."""
    body = title
    m = re.search(r"[:：]\s*(.+)$", body)
    if not m:
        return [], 1
    raw = m.group(1)
    # repair malformed docx parentheses in hunter trap titles
    raw = raw.replace("））", "）").replace(")）", "）")
    raw = raw.strip().strip("（）()")
    parts = [p.strip() for p in re.split(r"[/&]", raw) if p.strip()]
    parts = [re.sub(r"^[（(].*?[）)]", "", p).strip(" ()）") for p in parts]
    max_n = 2 if ("两项" in title or "（2）" in title or "(2)" in title) else 1
    return parts, max_n


def canonical_name(raw: str, names: set[str]) -> str | None:
    if not raw:
        return None
    cands = [raw]
    if "侦查" in raw:
        cands.append(raw.replace("侦查", "侦测"))
    if "侦测" in raw:
        cands.append(raw.replace("侦测", "侦查"))
    if raw == "天鹅之匕":
        cands.append("天鹅湖之匕")
    if raw == "天鹅湖之匕":
        cands.append("天鹅之匕")
    # page names sometimes omit/add （图纸）/（配方）
    for suffix in ("（图纸）", "（配方）"):
        if raw.endswith(suffix):
            cands.append(raw[: -len(suffix)])
        else:
            cands.append(raw + suffix)
        if raw.endswith(suffix[:-1]):
            cands.append(raw[: -(len(suffix) - 1)])
        else:
            cands.append(raw + suffix[:-1])
    # docx malformed title may lose the closing full-width parenthesis
    for c in list(cands):
        if c.endswith(("（图纸", "（配方")):
            cands.append(c + "）")
    for c in cands:
        if c in names:
            return c
    for c in cands:
        for n in names:
            if n == c or n.replace("（图纸）", "") == c or n.replace("（配方）", "") == c:
                return n
    return None


def article_order(html: str):
    arts = []
    for m in re.finditer(r'<article class="skill[^"]*" id="([^"]+)"[^>]*><h4>(.*?)</h4>', html, re.S):
        inner = m.group(2)
        name = inner[: inner.find("<span")] if "<span" in inner else inner
        name = re.sub(r"<[^>]+>", "", name).strip()
        arts.append((m.group(1), name))
    return arts


def add_group(groups, page, title, max_n, members, html_order_index):
    members = list(dict.fromkeys(members))  # dedupe, keep order
    if not members:
        print(f"WARN {page}: no members for {title}")
        return
    slug = hashlib.sha1((page + "\0" + title).encode("utf-8")).hexdigest()[:10]
    key = f"{page}-choice-{slug}"
    for g in groups:
        if g["page"] == page and g["title"] == title:
            g["members"] = list(dict.fromkeys(g["members"] + members))
            return
    groups.append({
        "page": page,
        "key": key,
        "title": title,
        "max": max_n,
        "members": members,
    })


def compute_runs(group, html_order):
    pos = {sid: i for i, (sid, _) in enumerate(html_order)}
    idx = [(sid, pos[sid]) for sid in group["members"] if sid in pos]
    idx.sort(key=lambda x: x[1])
    runs = []
    cur = []
    for sid, i in idx:
        if cur and i != cur[-1][1] + 1:
            runs.append({"before": cur[0][0], "ids": [x[0] for x in cur]})
            cur = []
        cur.append((sid, i))
    if cur:
        runs.append({"before": cur[0][0], "ids": [x[0] for x in cur]})
    return runs


def parse_base_groups():
    groups = []
    for cls in BASE_CLASSES:
        data_path = ROOT / "职业页" / "数据" / f"{cls}.json"
        docx_path = ROOT / f"基础职业-{cls}.docx"
        if not data_path.exists() or not docx_path.exists():
            continue
        data = json.loads(data_path.read_text(encoding="utf-8"))
        skills = data.get("skills", data if isinstance(data, list) else [])
        names = {s["name"] for s in skills}
        name2id = {s["name"]: s["id"] for s in skills}
        html = (ROOT / "职业页" / f"{cls}.html").read_text(encoding="utf-8")
        order = article_order(html)
        for kind, text in body_events(docx_path):
            if kind != "P" or not text.startswith("抉择"):
                continue
            parts, max_n = split_title(text)
            mapped = [canonical_name(p, names) for p in parts]
            ids = [name2id[n] for n in mapped if n]
            if len(ids) != len(parts):
                print(f"WARN {cls}: partial match {text!r} -> {parts} -> {mapped}")
            # canonical display title uses page names where available
            display_parts = [n if n else p for p, n in zip(parts, mapped)]
            if "：" in text:
                prefix = text.split("：", 1)[0] + "："
                display = prefix + "/".join(display_parts)
            else:
                display = text
            add_group(groups, cls, display, max_n, ids, order)
        for g in groups:
            if g["page"] == cls:
                g["runs"] = compute_runs(g, order)
    return groups


def parse_general_groups():
    docx = ROOT / "通用天赋树.docx"
    html = (ROOT / "职业页" / "通用天赋树.html").read_text(encoding="utf-8")
    order = article_order(html)
    data = json.loads((ROOT / "职业页" / "数据" / "通用天赋树.json").read_text(encoding="utf-8"))
    name2id = {s["name"]: s["id"] for s in data["skills"]}
    groups = []
    pending = None
    members = []
    for kind, text in body_events(docx):
        if kind == "P" and TIER_HEAD.match(text):
            if pending:
                add_group(groups, "通用天赋树", pending["title"], pending["max"], members, order)
            pending = None
            members = []
            continue
        if kind == "P" and text.startswith("抉择"):
            if pending:
                add_group(groups, "通用天赋树", pending["title"], pending["max"], members, order)
            if "：" in text:
                parts, max_n = split_title(text)
                ids = [name2id.get(parts[0])] if parts and name2id.get(parts[0]) else []
                # title explicitly lists members; parse all
                ids = [name2id[n] for n in parts if n in name2id]
                if len(ids) != len(parts):
                    print("WARN general explicit partial", text, parts, ids)
                add_group(groups, "通用天赋树", text, max_n, ids, order)
                pending = None
                members = []
            else:
                pending = {"title": text, "max": 2 if "两项" in text else 1}
                members = []
            continue
        if kind == "T" and pending:
            if text in name2id:
                members.append(name2id[text])
    if pending:
        add_group(groups, "通用天赋树", pending["title"], pending["max"], members, order)

    # user-confirmed overrides
    m_ids = [
        name2id["以刃承伤"], name2id["魔力偏转"],
        name2id["化险为夷"], name2id["神圣干涉"],
    ]
    for g in groups:
        if g["page"] == "通用天赋树" and g["title"].startswith("抉择M"):
            g["members"] = m_ids
    for g in groups:
        if g["page"] == "通用天赋树":
            g["runs"] = compute_runs(g, order)
    return groups


def main():
    groups = parse_base_groups() + parse_general_groups()
    # fill key marker suffix stable, sorted by page order then title
    page_order = BASE_CLASSES + ["通用天赋树"]
    groups.sort(key=lambda g: (page_order.index(g["page"]) if g["page"] in page_order else 99, g["title"]))
    out = {
        "version": 1,
        "generated_from": "root 基础职业-*.docx + 通用天赋树.docx",
        "groups": groups,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT}: {len(groups)} groups")
    for g in groups:
        print(g["page"], g["title"], "n=", len(g["members"]), "runs=", len(g.get("runs", [])))


if __name__ == "__main__":
    main()
