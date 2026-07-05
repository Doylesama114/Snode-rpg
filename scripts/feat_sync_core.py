#!/usr/bin/env python3
"""Parse and sync 特殊专长 (format differs from class skill pages)."""
from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path

from class_sync_core import (
    HEX2FULL,
    dots_html,
    extract_paragraphs,
    mark_dots_from_runs,
    split_field,
)

SEP_LINE = re.compile(r"^-{3,}$")
SEP_INLINE = re.compile(r"-{5,}")


def feat_name_from_prev(text: str) -> str:
    if SEP_INLINE.search(text):
        return SEP_INLINE.split(text)[-1].strip() or text.strip()
    return text.strip()


def render_body_html(body: list[tuple[str, list]]) -> str:
    parts = []
    for text, runs in body:
        if not runs:
            parts.append(html.escape(text))
            continue
        seg = []
        for r in runs:
            t = r["text"]
            if "●" in t and r.get("color"):
                seg.append(dots_html([r["color"]] * t.count("●")))
                rest = t.replace("●", "")
                if rest:
                    seg.append(html.escape(rest))
            else:
                seg.append(html.escape(t))
        parts.append("".join(seg))
    return "<br>".join(parts)


def parse_feats(paras: list[dict]) -> list[dict]:
    feats = []
    i = 0
    while i < len(paras):
        text = paras[i]["text"]
        if not text.startswith("前置条件："):
            i += 1
            continue
        _, prereq = split_field(text)
        name = feat_name_from_prev(paras[i - 1]["text"]) if i > 0 else ""
        i += 1
        body: list[tuple[str, list]] = []
        mark_dots: list[str] = []
        while i < len(paras):
            t = paras[i]["text"]
            if t.startswith("前置条件："):
                break
            if SEP_LINE.match(t):
                i += 1
                break
            body.append((t, paras[i]["runs"]))
            mark_dots.extend(mark_dots_from_runs(paras[i]["runs"]))
            i += 1
        if not name:
            continue
        desc_text = "\n".join(x[0] for x in body)
        feats.append({
            "name": name,
            "prerequisite": prereq or "无",
            "description": desc_text,
            "body_html": render_body_html(body),
            "mark_dots": mark_dots,
        })
    return feats


def data_search_text(feat: dict) -> str:
    plain = feat["description"].replace("\n", " ")
    return f"{feat['name']} {feat['prerequisite']} {plain}"


def build_article(feat_id: str, feat: dict) -> str:
    ds = html.escape(data_search_text(feat), quote=True)
    prereq = html.escape(feat["prerequisite"])
    return (
        f'<article class="skill" id="{feat_id}" data-search="{ds}">\n'
        f"<h4>{html.escape(feat['name'])}</h4>\n"
        f'<div class="detail">\n'
        f'<p><span class="field">前置条件：</span>{prereq}</p>\n'
        f"<p>{feat['body_html']}</p>\n"
        f"</div>\n"
        f"</article>"
    )


def json_entry(feat_id: str, feat: dict) -> dict:
    return {
        "id": feat_id,
        "name": feat["name"],
        "prerequisite": feat["prerequisite"],
        "description": feat["description"],
    }


def fx_entry(feat_id: str, feat: dict) -> dict:
    effects = [p.strip() for p in feat["description"].split("\n") if p.strip()]
    entry = {
        "id": feat_id,
        "name": feat["name"],
        "class": "特殊专长",
        "type": "专长",
        "prerequisite": feat["prerequisite"],
        "effects": effects,
    }
    if feat["mark_dots"]:
        entry["cost"] = {"sp": [HEX2FULL.get(c, c) for c in feat["mark_dots"]]}
    return entry


def sync_special_feats(
    docx: Path,
    html_path: Path,
    data_path: Path,
    fx_path: Path,
    electron_html: Path,
    electron_data: Path,
    electron_fx: Path | None,
    report_path: Path,
    old_data: list | None = None,
) -> dict:
    feats = parse_feats(extract_paragraphs(docx))
    old_names = {x["name"] for x in (old_data or [])}
    new_names = {f["name"] for f in feats}

    articles = []
    nav_links = []
    json_out = []
    fx_out = []
    for i, feat in enumerate(feats, 1):
        fid = f"feat-{i}"
        json_out.append(json_entry(fid, feat))
        fx_out.append(fx_entry(fid, feat))
        articles.append(build_article(fid, feat))
        nav_links.append(
            f'<a class="skill-link" href="#{fid}">{html.escape(feat["name"])}</a>'
        )

    page = html_path.read_text(encoding="utf-8")
    page = re.sub(
        r'(<a class="style-link" href="#feat-1">全部特殊专长</a>\n)(.*?)(\n</div></nav>)',
        lambda m: m.group(1) + "\n".join(nav_links) + m.group(3),
        page,
        count=1,
        flags=re.S,
    )
    page = re.sub(
        r'(<div class="empty" id="feat-empty">.*?</div>\n)(.*?)(\n</div>\n</main>)',
        lambda m: m.group(1) + "\n".join(articles) + m.group(3),
        page,
        count=1,
        flags=re.S,
    )
    html_path.write_text(page, encoding="utf-8")

    data_path.write_text(json.dumps(json_out, ensure_ascii=False, indent=2), encoding="utf-8")
    fx_doc = {"特殊专长": fx_out}
    fx_path.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    for src, dst in ((html_path, electron_html), (data_path, electron_data)):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    if electron_fx:
        electron_fx.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(fx_path, electron_fx)

    report = {
        "module": "特殊专长",
        "docx_feats": len(feats),
        "json_feats": len(json_out),
        "fx_entries": len(fx_out),
        "removed_not_in_docx": sorted(old_names - new_names),
        "added_from_docx": sorted(new_names - old_names),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report
