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
    cost_json,
    dots_html,
    extract_paragraphs,
    inline_runs_html,
    mark_dots_from_runs,
    normalize_runs,
    runs_have_colored_dots,
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
        if SEP_INLINE.search(text):
            text = SEP_INLINE.split(text)[0].rstrip()
        if not text:
            continue
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
        if SEP_INLINE.search(desc_text):
            desc_text = SEP_INLINE.split(desc_text)[0].rstrip()
            body = [(desc_text, body[0][1])] if body else []
        desc_entries: list[dict] = []
        for text, runs in body:
            if not text.strip():
                continue
            entry: dict = {"text": text}
            if runs_have_colored_dots(runs):
                entry["runs"] = normalize_runs(runs)
            desc_entries.append(entry)
        feats.append({
            "name": name,
            "prerequisite": prereq or "无",
            "description": desc_text,
            "description_entries": desc_entries,
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
    marks = feat.get("mark_dots") or []
    mark_attrs = ""
    if marks:
        mark_attrs = (
            f' data-marks="{html.escape(",".join(marks), quote=True)}"'
            f' data-mark-count="{len(marks)}"'
        )
    return (
        f'<article class="skill" id="{feat_id}" data-search="{ds}"{mark_attrs}>\n'
        f"<h4>{html.escape(feat['name'])}</h4>\n"
        f'<div class="detail">\n'
        f'<p><span class="field">前置条件：</span>{prereq}</p>\n'
        f"<p>{feat['body_html']}</p>\n"
        f"</div>\n"
        f"</article>"
    )


def json_entry(feat_id: str, feat: dict) -> dict:
    out: dict = {
        "id": feat_id,
        "name": feat["name"],
        "prerequisite": feat["prerequisite"],
        "description": feat["description"],
    }
    colored = [
        e for e in (feat.get("description_entries") or []) if e.get("runs")
    ]
    if colored:
        out["description_entries"] = colored
    if feat.get("mark_dots"):
        out["cost"] = cost_json(feat["mark_dots"])
    return out


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


CATEGORIES = [
    {"id": "战斗强化", "color": "#C0392B", "desc": "强化武器、战技与战斗节奏，让角色在战场上更具压制力。"},
    {"id": "防御与生存", "color": "#2E86C1", "desc": "提升护甲、生命、豁免与恢复能力，让角色更难被击倒。"},
    {"id": "属性与潜力", "color": "#7D3C98", "desc": "直接提升属性、熟练度、槽位与成长资源，奠定角色成长基础。"},
    {"id": "施法与神秘", "color": "#8E44AD", "desc": "强化施法、元素、仪式与神秘侧能力，探索魔法与位面的力量。"},
    {"id": "探索与冒险", "color": "#1E8449", "desc": "强化侦查、潜行、寻宝与旅行能力，让冒险之路更顺畅。"},
    {"id": "社交与扮演", "color": "#D68910", "desc": "强化交涉、表演、领导与个性表达，让人物在故事中更具魅力。"},
    {"id": "生产与生活", "color": "#148F77", "desc": "围绕烹饪、垂钓、园艺、棋牌等趣味玩法，丰富角色的日常生活。"},
    {"id": "特殊彩蛋", "color": "#566573", "desc": "打破常规的奇趣专长，为角色带来出人意料的惊喜与转折。"},
]
DEFAULT_CATEGORY = "特殊彩蛋"
NOTES_PREFIXES = (
    "这个特殊专长无法",
    "这个效果每日仅",
    "这个效果在每日仅",
    "这个效果每个自身回合仅",
    "这个效果在进行一次短休或长休前仅",
    "未使用的幸运骰将会",
    "你拥有且仅有一次",
)


def split_feat_description(description):
    raw = (description or "").replace("\r", "").split("\n")
    paras = [x.strip() for x in raw if x.strip()]
    intro = ""
    if paras and (paras[0].endswith("：") or paras[0].endswith(":") or "获得以下增益效果" in paras[0]):
        intro = paras[0]
        paras = paras[1:]
    effects = []
    notes = []
    for p in paras:
        if len(p) <= 48 and p.startswith(NOTES_PREFIXES):
            notes.append(p)
        else:
            effects.append(p)
    return intro, effects, notes


def enriched_json_entry(feat_id, feat, old_by_id, old_by_name):
    entry = json_entry(feat_id, feat)
    old = old_by_id.get(feat_id) or old_by_name.get(feat["name"]) or {}
    entry["category"] = old.get("category") or DEFAULT_CATEGORY
    entry["tags"] = list(old.get("tags") or [])
    intro, effects, notes = split_feat_description(feat["description"])
    entry["intro"] = intro
    entry["effects"] = effects
    entry["notes"] = notes
    return entry


def build_feats_page(feats, categories=None):
    cats = categories if categories is not None else CATEGORIES
    cat_by_id = {c["id"]: c for c in cats}
    by_id = {f["id"]: f for f in feats}
    if len(feats) != 100:
        raise ValueError("unexpected feat count %d" % len(feats))

    def esc_attr(t):
        return html.escape(t or "", quote=True)

    def esc_text(t):
        return html.escape(t or "", quote=False)

    def build_article(f):
        fid = f["id"]
        name = f["name"]
        cat = f.get("category") or DEFAULT_CATEGORY
        color = cat_by_id.get(cat, cat_by_id[DEFAULT_CATEGORY])["color"]
        prereq = f.get("prerequisite") or "无"
        intro = f.get("intro") or ""
        effects = f.get("effects") or []
        notes = f.get("notes") or []
        tags = f.get("tags") or []
        desc = f.get("description") or ""
        costs = f.get("cost") or []
        mark_colors = [str(c.get("color") or "") for c in costs if c.get("color")]
        mark_count = sum(int(c.get("count") or 0) for c in costs)
        expanded_marks = []
        for c in costs:
            expanded_marks.extend([str(c.get("color"))] * int(c.get("count") or 1))
        # ??/?????? run??? docx ?????
        colored_lines = {}
        for e in f.get("description_entries") or []:
            runs = e.get("runs") or []
            if not runs_have_colored_dots(runs):
                continue
            lines = [[]]
            for r in runs:
                text = r.get("text") or ""
                color = r.get("color")
                for idx, part in enumerate(text.split("\n")):
                    if idx > 0:
                        lines.append([])
                    if part:
                        lines[-1].append({"text": part, "color": color})
            for line in lines:
                if line:
                    colored_lines["".join(x["text"] for x in line)] = line

        def colored_html(para, run_lines, fallback_colors):
            if para in run_lines:
                runs = run_lines[para]
                if runs_have_colored_dots(runs):
                    return inline_runs_html(runs)
            if "●" in para and fallback_colors:
                out_parts = []
                ci = 0
                for ch in para:
                    if ch == "●":
                        out_parts.append('<span style="font-size:1.5em;color:%s;">●</span>' % fallback_colors[ci % len(fallback_colors)])
                        ci += 1
                    else:
                        out_parts.append(html.escape(ch))
                return "".join(out_parts)
            return esc_text(para)

        ds = " ".join([name, prereq, cat, " ".join(tags), desc.replace("\n", " ").replace("\r", " ")])
        parts = []
        parts.append('<article class="skill" id="%s" data-search="%s" data-tags="%s" data-marks="%s" data-mark-count="%d" data-category="%s">' % (
            esc_attr(fid), esc_attr(ds), esc_attr(",".join(tags)), esc_attr(",".join(mark_colors)), mark_count, esc_attr(cat)))
        parts.append('<h4>%s <span class="chip" style="background:%s">%s</span></h4>' % (esc_text(name), color, esc_text(cat)))
        chip_html = "".join('<span class="chip">%s</span>' % esc_text(t) for t in tags[:6])
        parts.append('<div class="chips">%s</div>' % chip_html)
        parts.append('<div class="detail">')
        parts.append('<div class="cond-row"><span class="cond-label">前置条件：</span><span class="cond-text">%s</span></div>' % esc_text(prereq))
        if intro:
            parts.append('<div class="desc-cell"><span class="desc-label">描述：</span><span class="desc-text">%s</span></div>' % colored_html(intro, colored_lines, expanded_marks))
        for e in effects:
            parts.append('<div class="effect-cell">%s</div>' % colored_html(e, colored_lines, expanded_marks))
        for n in notes:
            parts.append('<div class="note-cell">%s</div>' % esc_text(n))
        if expanded_marks:
            parts.append('<div class="mark-row"><span class="mark-label">标识：</span>%s</div>' % dots_html(expanded_marks))
        parts.append("</div>")
        parts.append("</article>")
        return "\n".join(parts)

    nav_parts = []
    nav_parts.append('<a class="style-link" href="#feat-content">全部特殊专长</a>')
    for c in cats:
        links = []
        for f in feats:
            if f.get("category") == c["id"]:
                links.append('<a class="skill-link" href="#%s">%s</a>' % (esc_attr(f["id"]), esc_text(f["name"])))
        nav_parts.append('<details class="nav-group" data-category="%s" open><summary class="style-summary"><a href="#cat-%s">%s</a></summary><div class="nav-tier">%s</div></details>' % (
            esc_attr(c["id"]), esc_attr(c["id"]), esc_text(c["id"]), "\n".join(links)))

    cat_bar = ['<div class="cat-bar" id="feat-cat-bar">']
    cat_bar.append('<button type="button" class="cat-chip active" data-cat="all" data-color="#6b7f6f" onclick="setFeatCategory(\'all\')">全部</button>')
    for c in cats:
        cat_bar.append('<button type="button" class="cat-chip" data-cat="%s" data-color="%s" onclick="setFeatCategory(\'%s\')">%s</button>' % (
            esc_attr(c["id"]), c["color"], esc_attr(c["id"]), esc_text(c["id"])))
    cat_bar.append("</div>")

    sections = []
    for c in cats:
        arts = [build_article(f) for f in feats if f.get("category") == c["id"]]
        sections.append('<section class="style" id="cat-%s" data-category="%s">\n<h2>%s</h2>\n<p class="cat-desc">%s</p>\n%s\n</section>' % (
            esc_attr(c["id"]), esc_attr(c["id"]), esc_text(c["id"]), esc_text(c["desc"]), "\n".join(arts)))

    cat_js = r"""
(function() {
  function setFeatCategory(name) {
    var sections = document.querySelectorAll("section.style[data-category]");
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      sec.classList.toggle("cat-hidden", name !== "all" && sec.getAttribute("data-category") !== name);
    }
    var groups = document.querySelectorAll("details.nav-group[data-category]");
    for (var j = 0; j < groups.length; j++) {
      var g = groups[j];
      g.classList.toggle("cat-hidden", name !== "all" && g.getAttribute("data-category") !== name);
    }
    var btns = document.querySelectorAll(".cat-chip");
    for (var k = 0; k < btns.length; k++) {
      var b = btns[k];
      var on = b.getAttribute("data-cat") === name;
      var col = b.getAttribute("data-color") || "#6b7f6f";
      b.classList.toggle("active", on);
      b.style.background = on ? col : "";
      b.style.borderColor = on ? col : "";
      b.style.color = on ? "#fff" : "";
    }
    var fc = window.__filterControllers && window.__filterControllers["view-feat"];
    if (fc) fc.renderFilters();
  }
  window.setFeatCategory = setFeatCategory;
})();
"""

    drawer_js = r"""
(function(){
var t=document.getElementById("nav-toggle-btn"),o=document.getElementById("nav-overlay"),d=document.getElementById("nav-drawer");
if(!t||!o||!d)return;
var inner=document.createElement("div");inner.className="nav-inner";d.appendChild(inner);
function build(){
  inner.innerHTML="";
  var h=document.querySelector("header");
  var si=h?h.querySelector('input[type="search"]'):null;
  if(si){
    var sc=si.cloneNode(true);sc.id="drawer-search";sc.placeholder="搜索技能、关键词...";
    sc.addEventListener("input",function(){si.value=this.value;si.dispatchEvent(new Event("input",{bubbles:true}));});
    sc.addEventListener("keydown",function(e){if(e.key==="Enter"){d.classList.remove("open");o.classList.remove("show");}});
    inner.appendChild(sc);
  }
  var nav=document.querySelector("nav .nav-inner");
  if(nav){
    var nc=document.createElement("div");
    nc.innerHTML=nav.innerHTML;
    nc.querySelectorAll("a").forEach(function(a){a.addEventListener("click",function(){setTimeout(function(){d.classList.remove("open");o.classList.remove("show");},150);});});
    inner.appendChild(nc);
  }
}
t.onclick=function(){build();d.classList.add("open");o.classList.add("show");};
o.onclick=function(){d.classList.remove("open");o.classList.remove("show");};
document.getElementById("nav-drawer-close-btn").onclick=o.onclick;
window.addEventListener("resize",function(){if(window.innerWidth>860){d.classList.remove("open");o.classList.remove("show");}});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){d.classList.remove("open");o.classList.remove("show");}});
})();
"""

    return """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>特殊专长索引 · 斯诺德职业技能索引</title>
<link rel="stylesheet" href="common.css?v=1.0.7259"/>
<style>
    body { background: var(--bg); }
    .class-view { display: block !important; }
    .view-home { display: none !important; }
    .cat-hidden { display: none !important; }
    .cat-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
    .cat-chip { cursor: pointer; padding: 3px 11px; border-radius: 999px; border: 1px solid rgba(47,111,94,.25); background: transparent; color: var(--ink); font-size: 12px; line-height: 1.5; }
    .cat-chip.active { color: #fff; }
    .note-cell { padding: 6px 10px; margin-top: 6px; border-left: 3px solid rgba(127,127,127,.55); background: rgba(127,127,127,.08); font-size: 13px; line-height: 1.7; color: var(--muted, #69706b); }
    .mark-row { margin-top: 6px; padding: 2px 4px; font-size: 14px; }
    .mark-row .mark-label { font-weight: 700; color: var(--red); margin-right: 4px; }
    .cat-desc { margin: 2px 0 10px; color: var(--muted, #69706b); font-size: 13px; }
</style>
</head>
<body>

<a href="首页.html" class="back-btn">← 返回</a>
<header>
    <div class="topbar">
      <div>
        <h1>特殊专长索引</h1>
        <p class="subtitle">全区块 · 特殊专长详情 · 名称与描述搜索</p>
      </div>
      <label class="searchbox">
        <input id="feat-search" type="search" placeholder="搜索特殊专长名称、前置条件或正文..." autocomplete="off" />
      </label>
    </div>
</header>
<main>
<nav aria-label="特殊专长目录"><div class="nav-inner">
<div class="filter-bar" id="feat-filter-bar"></div>
{cat_bar}
{nav}
</div></nav>
<div class="content" id="feat-content">
  <div class="empty" id="feat-empty">没有找到匹配的特殊专长</div>
  {sections}
</div>
</main>

<script src="common.js"></script>
<script src="mark-colors.js"></script>
<script src="filter-panel.js"></script>
<script src="filter.js"></script>
<script> createFilterController("view-feat", "feat"); </script>
<script>{cat_js}</script>
<button class="nav-toggle" id="nav-toggle-btn" aria-label="打开目录">☰</button>
<div class="nav-overlay" id="nav-overlay"></div>
<div class="nav-drawer" id="nav-drawer"><div class="nav-drawer-close"><button id="nav-drawer-close-btn">✕</button></div></div>
<script>{drawer_js}</script>
<script src="common_tooltip.js"></script>
<script src="../斯诺德跑团/shortcuts.js"></script>
</body>
</html>
""".replace('{cat_bar}', '\n'.join(cat_bar)).replace('{nav}', '\n'.join(nav_parts)).replace('{sections}', '\n'.join(sections)).replace('{cat_js}', cat_js).replace('{drawer_js}', drawer_js)

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
    old_data_list = old_data or []
    old_by_id = {x.get("id"): x for x in old_data_list}
    old_by_name = {x.get("name"): x for x in old_data_list}
    old_names = {x.get("name") for x in old_data_list}
    new_names = {f["name"] for f in feats}

    json_out = []
    fx_out = []
    for i, feat in enumerate(feats, 1):
        fid = f"feat-{i}"
        json_out.append(enriched_json_entry(fid, feat, old_by_id, old_by_name))
        fx_out.append(fx_entry(fid, feat))

    page = build_feats_page(json_out)
    html_path.write_text(page, encoding="utf-8")
    data_path.write_text(json.dumps(json_out, ensure_ascii=False, indent=1), encoding="utf-8")
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
