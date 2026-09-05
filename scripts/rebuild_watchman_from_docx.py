#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 基础职业-守望者.docx 重建守望者 JSON + HTML + skill_effects。

新职业没有历史 HTML 可做增量 patch，所以按萨满祭司重建脚本同款模板
从零生成标准职业页（起始特性 + 守护/警戒/坚韧/原野四风格）。
"""
from __future__ import annotations

import html
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from build_class_features import body_events, is_boundary  # noqa: E402
from class_sync_core import (  # noqa: E402
    build_data_search,
    build_detail_html,
    build_docx_index,
    build_skill_data_attrs,
    cost_json,
    extract_paragraphs,
    extract_skill_block,
    json_to_fx_entry,
    pick_block,
    sanitize_data_search,
    tags_from_keywords,
)

CLASS = "守望者"
DATA = ROOT / "职业页" / "数据" / f"{CLASS}.json"
HTML = ROOT / "职业页" / f"{CLASS}.html"
DOCX = ROOT / f"基础职业-{CLASS}.docx"
FX = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
TEMPLATE = ROOT / "职业页" / "萨满祭司.html"

STYLES = ["守护", "警戒", "坚韧", "原野"]
STYLE_COLORS = {
    "守护": "#74C0FC",
    "警戒": "#FFD43B",
    "坚韧": "#FF8787",
    "原野": "#69DB7C",
}
TIER_ORDER = ["一阶", "二阶", "三阶"]
# docx 起始特性选择表的原始顺序
STARTING_ORDER = ["挫志打击", "警戒之眼", "盾牌格挡", "荒野医疗"]
FEATURE_NAMES = ["哨兵", "铁壁", "荒野庇护"]


def extract_class_features() -> dict:
    """从守望者 docx 的「初始专长」段落区提取职业专长（哨兵/铁壁/荒野庇护）。"""
    events = body_events(DOCX)
    start = next(i for i, (k, t) in enumerate(events) if k == "P" and t == "初始专长")
    end = next(
        (i for i in range(start + 1, len(events)) if is_boundary(*events[i])),
        len(events),
    )

    intro = ""
    features: list[dict] = []
    current: dict | None = None
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
                intro = text
                first_para = False
                continue
            if text in FEATURE_NAMES:
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


SEP_RE = re.compile(r"^-{3,}$")


def render_class_features(info: dict) -> str:
    chips = []
    panels = []
    for i, f in enumerate(info["features"]):
        active = " active" if i == 0 else ""
        selected = "true" if i == 0 else "false"
        chips.append(
            f'<button type="button" class="class-feature-chip{active}" role="tab" '
            f'aria-selected="{selected}" data-feature-index="{i}">{html.escape(f["name"])}</button>'
        )
        body_parts = []
        for b in f["body"]:
            if b["type"] == "p":
                body_parts.append(f"<p>{html.escape(b['text'])}</p>")
            else:
                cells = "".join(
                    f'<span class="class-feature-table-cell">{html.escape(c)}</span>'
                    for c in b["rows"][0]
                )
                body_parts.append(
                    f'<div class="class-feature-table"><div class="class-feature-table-row">{cells}</div></div>'
                )
        panels.append(
            f'<div class="class-feature-panel{active}" role="tabpanel" data-feature-panel="{i}">'
            f'<h3>{html.escape(f["name"])}</h3>'
            f'<div class="class-feature-body">{"".join(body_parts)}</div></div>'
        )
    return (
        f'<section class="class-features" id="wd-class-features" aria-label="职业专长">'
        f'<div class="class-feature-head"><h2>职业专长</h2>'
        f'<p class="class-feature-intro">{html.escape(info["intro"])}</p></div>'
        f'<div class="class-feature-tabs" role="tablist">{"".join(chips)}</div>'
        f'<div class="class-feature-panels">{"".join(panels)}</div></section>'
    )


def candidate_names() -> set[str]:
    import docx

    doc = docx.Document(DOCX)
    names: set[str] = set()
    exclude = {"丛林", "草原", "山地", "沼泽", *STYLES}
    for tb in doc.tables:
        if not tb.rows:
            continue
        text = tb.rows[0].cells[0].text.strip().split("\n")[0].strip()
        if text and text not in exclude:
            names.add(text)
    return names


def collect_stubs() -> tuple[list[dict], dict[str, int]]:
    names = candidate_names()
    paras = extract_paragraphs(DOCX)
    current_style = ""
    current_tier = ""
    found: list[dict] = []
    seen: set[tuple] = set()

    for i, p in enumerate(paras):
        text = p["text"]
        if text.endswith("风格") and text[: -len("风格")] in STYLES:
            current_style = text[: -len("风格")]
            current_tier = ""
            continue
        m = re.match(r"^([一二三四五六七八])阶天赋树$", text)
        if m:
            current_tier = text
            continue
        if text not in names:
            continue
        block = extract_skill_block(paras, i, names)
        if not block:
            continue
        if current_style:
            key = (current_style, current_tier, block["name"])
        else:
            key = ("starting", "", block["name"])
        if key in seen:
            continue
        seen.add(key)
        found.append({
            "name": block["name"],
            "style": current_style,
            "tier": current_tier,
            "_doc_i": i,
        })

    starting = [s for s in found if not s["style"]]
    ordered_starting = sorted(
        starting,
        key=lambda s: STARTING_ORDER.index(s["name"]) if s["name"] in STARTING_ORDER else 99,
    )
    for idx, stub in enumerate(ordered_starting, 1):
        stub["id"] = f"wd-starting-skill-{idx}"

    style_skills = [s for s in found if s["style"]]
    style_skills.sort(
        key=lambda s: (
            STYLES.index(s["style"]) if s["style"] in STYLES else 99,
            TIER_ORDER.index(s["tier"]) if s["tier"] in TIER_ORDER else 99,
            s["_doc_i"],
        )
    )
    for idx, stub in enumerate(style_skills, 1):
        stub["id"] = f"wd-skill-{idx}"

    stubs = ordered_starting + style_skills
    return stubs, {name: i for i, name in enumerate(STARTING_ORDER)}


def clean_level_upgrade_choices(block: dict) -> None:
    """去掉吸收阶段误收的节标题/引言等非 · 开头的行。"""
    for lu in block.get("level_upgrades") or []:
        choices = lu.get("choices") or []
        cleaned = []
        for c in choices:
            if c.startswith("·") or cleaned and c.startswith(("--", "—")):
                cleaned.append(c)
        lu["choices"] = cleaned


def block_to_skill(stub: dict, block: dict) -> dict:
    fields = dict(block["fields"])
    if block["mark_dots"]:
        fields["标识"] = "".join("●" for _ in block["mark_dots"])
    fields.pop("费用", None)
    desc_body = [
        p for p in block["description"]
        if not p.startswith("限制：") and p.strip() != block["name"]
    ]
    if "描述" not in fields and desc_body:
        fields["描述"] = desc_body[0]
    description = desc_body[1:] if len(desc_body) > 1 else ([] if "描述" in fields else desc_body)
    if "描述" in fields and desc_body and fields["描述"] == desc_body[0]:
        description = desc_body[1:]

    skill = {
        "id": stub["id"],
        "name": block["name"],
        "tags": tags_from_keywords(fields.get("关键词", "")),
        "fields": fields,
        "cost": cost_json(block["mark_dots"]),
        "description": description,
        "level_upgrades": block["level_upgrades"],
        "flavor": block["flavor"],
    }
    if stub["id"].startswith("wd-starting-skill-"):
        skill["type"] = "starting"
    else:
        skill["style"] = stub["style"]
        skill["tier"] = stub["tier"].replace("天赋树", "")
    return skill


def chips_html(tags: list[str]) -> str:
    return "".join(f'<span class="chip">{t}</span>' for t in tags)


def render_article(skill: dict, block: dict) -> str:
    sid = skill["id"]
    name = skill["name"]
    tags = skill.get("tags") or []
    if skill.get("type") == "starting":
        chip_label = "起始特性"
        color = "#888"
        style_for_search = "起始"
        tier_label = "起始特性"
    else:
        style = skill["style"]
        tier = skill["tier"]
        chip_label = f"{style} · {tier}天赋树"
        color = STYLE_COLORS.get(style, "#888")
        style_for_search = style
        tier_label = f"{tier}阶天赋树"
    detail = build_detail_html(block)
    data_search = build_data_search(block, style_for_search, tier_label, tags)
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, class_name=CLASS)
    return (
        f'<article class="skill" id="{sid}" data-search="{safe}"{data_attrs}>\n'
        f'        <h4>{name} <span class="chip" style="background:{color};color:#fff">{chip_label}</span></h4>\n'
        f'        <div class="chips">{chips_html(tags)}</div>\n'
        f'        <div class="detail">{detail}</div>\n'
        f"      </article>"
    )


def render_nav(skills: list[dict]) -> str:
    lines = [
        '      <div class="filter-bar" id="wd-filter-bar"></div>',
        '      <a class="style-link" href="#wd-class-features">职业专长</a>',
        '      <a class="style-link" href="#wd-starting-features">起始特性</a>',
        f'<a class="adv-link" href="{CLASS}·进阶.html">→ 查看进阶途径</a>',
        '      <div class="tier-list">',
    ]
    for sk in skills:
        if sk.get("type") == "starting":
            lines.append(f'        <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
    lines.append("      </div>")

    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for sk in skills:
        if sk.get("type") == "starting":
            continue
        grouped[sk["style"]][sk["tier"]].append(sk)

    for style in STYLES:
        if style not in grouped:
            continue
        lines.append("")
        lines.append('            <details class="nav-group">')
        lines.append(
            f'              <summary class="style-summary">'
            f'<a href="#wd-style-{style}">{style}风格</a></summary>'
        )
        for tier in TIER_ORDER:
            tier_skills = grouped[style].get(tier, [])
            if not tier_skills:
                continue
            lines.append('              <details class="nav-tier">')
            lines.append(
                f'                  <summary class="tier-summary">'
                f'<a href="#wd-tier-{style}-{tier}">{tier}天赋树</a></summary>'
            )
            for sk in tier_skills:
                lines.append(f'                  <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
            lines.append("              </details>")
        lines.append("            </details>")
    return "\n".join(lines)


def render_content(skills: list[dict], blocks: dict[str, dict]) -> str:
    parts = [
        '      <div class="empty" id="wd-empty" style="display:none">',
        '        <p style="text-align:center;color:var(--muted);padding:40px 0">'
        "没有匹配的技能。试试其他关键词吧。</p>",
        "      </div>",
        render_class_features(extract_class_features()),
        '      <h3 id="wd-starting-features">起始特性</h3>',
        '      <p class="subtitle">你可以从以下起始特性中选择两项加入你的技能列表：</p>',
    ]
    for sk in skills:
        if sk.get("type") == "starting":
            parts.append(render_article(sk, blocks[sk["id"]]))

    current_style = None
    current_tier = None
    for sk in skills:
        if sk.get("type") == "starting":
            continue
        style = sk["style"]
        tier = sk["tier"]
        if style != current_style:
            parts.append(f'      <h3 id="wd-style-{style}">{style}风格</h3>')
            current_style = style
            current_tier = None
        if tier != current_tier:
            parts.append(f'      <h4 id="wd-tier-{style}-{tier}">{tier}阶天赋树</h4>')
            current_tier = tier
        parts.append(render_article(sk, blocks[sk["id"]]))
    return "\n".join(parts)


def read_head() -> str:
    text = TEMPLATE.read_text(encoding="utf-8")
    end = text.find("<main>")
    if end == -1:
        raise SystemExit("cannot find <main> in shaman template")
    head = text[: end + len("<main>")] + "\n"
    head = head.replace("<title>萨满祭司 · 斯诺德职业技能索引</title>", f"<title>{CLASS} · 斯诺德职业技能索引</title>")
    head = head.replace("萨满祭司天赋索引", f"{CLASS}天赋索引")
    head = head.replace("萨满祭司", CLASS)
    head = head.replace('id="sa-search"', 'id="wd-search"')
    head = head.replace('placeholder="搜索萨满祭司技能、风格、阶位、关键词或正文..."',
                        f'placeholder="搜索{CLASS}技能、风格、阶位、关键词或正文..."')
    return head


FOOT = """
</main>

<script src="common.js"></script>
<script src="mark-colors.js"></script>
<script src="filter-panel.js"></script>
<script src="filter.js"></script>
<script>
createFilterController("view-watchman", "wd");
</script>
<button class="nav-toggle" id="nav-toggle-btn" aria-label="打开目录">☰</button>
<div class="nav-overlay" id="nav-overlay"></div>
<div class="nav-drawer" id="nav-drawer"><div class="nav-drawer-close"><button id="nav-drawer-close-btn">✕</button></div></div>

<script>
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
  var fb=document.querySelector("nav .filter-bar");
  if(fb){var fc=fb.cloneNode(true);fc.querySelectorAll(".filter-tag .remove").forEach(function(b){b.onclick=function(){var kw=this.parentElement.textContent.replace("×","").trim();var orig=fb.querySelector(".filter-tag");if(orig)orig.querySelector(".remove").click();};});fc.querySelectorAll(".chip").forEach(function(c){c.onclick=function(){var orig=fb.querySelector('.chip[data-kw="'+c.getAttribute("data-kw")+'"]');if(orig)orig.click();else{var orig2=fb.querySelector(".chip");if(orig2&&c.textContent===orig2.textContent)orig2.click();}};});inner.appendChild(fc);}
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
</script>
<script src="common_tooltip.js"></script>
<script src="../斯诺德跑团/shortcuts.js"></script>
</body>
</html>
"""


def main() -> None:
    stubs, _ = collect_stubs()
    all_names = {s["name"] for s in stubs}
    paras = extract_paragraphs(DOCX)
    idx = build_docx_index(paras, all_names)
    used: set[int] = set()

    skills: list[dict] = []
    blocks: dict[str, dict] = {}
    for stub in stubs:
        pick_style = "" if stub["id"].startswith("wd-starting-skill-") else stub["style"]
        block = pick_block(idx, {"name": stub["name"], "style": pick_style}, used)
        if not block:
            raise RuntimeError(f"docx block not found: {stub['name']} ({stub['id']})")
        clean_level_upgrade_choices(block)
        skill = block_to_skill(stub, block)
        skills.append(skill)
        blocks[skill["id"]] = block

    doc = {"id": CLASS, "name": CLASS, "skills": skills}
    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    fx_doc = {CLASS: [json_to_fx_entry(s, CLASS) for s in skills]}
    FX.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    head = read_head()
    nav = render_nav(skills)
    content = render_content(skills, blocks)
    page = (
        head
        + f'    <nav aria-label="{CLASS}天赋索引">\n      <div class="nav-inner">\n'
        + nav
        + "\n      </div>\n    </nav>\n    <div class=\"content\">\n"
        + content
        + "\n    </div>\n"
        + FOOT
    )
    HTML.write_text(page, encoding="utf-8")

    for src, dst in (
        (DATA, ROOT / "electron-app" / "职业页" / "数据" / f"{CLASS}.json"),
        (FX, ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json"),
        (HTML, ROOT / "electron-app" / "职业页" / f"{CLASS}.html"),
    ):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    print(json.dumps({
        "class": CLASS,
        "skills": len(skills),
        "starting": sum(1 for s in skills if s.get("type") == "starting"),
        "style_skills": sum(1 for s in skills if s.get("type") != "starting"),
        "fx_entries": len(fx_doc[CLASS]),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
