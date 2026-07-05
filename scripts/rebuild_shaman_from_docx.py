#!/usr/bin/env python3
"""Rebuild 萨满祭司 JSON + HTML + skill_effects from docx (HTML was corrupted)."""
from __future__ import annotations

import json
import re
import shutil
from collections import defaultdict
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from class_sync_core import (
    build_data_search,
    build_detail_html,
    build_docx_index,
    cost_json,
    extract_paragraphs,
    json_to_fx_entry,
    pick_block,
    sanitize_data_search,
    tags_from_keywords,
    tier_label_from_skill,
)

CLASS = "萨满祭司"
DATA = ROOT / "职业页" / "数据" / f"{CLASS}.json"
HTML = ROOT / "职业页" / f"{CLASS}.html"
DOCX = ROOT / f"基础职业-{CLASS}.docx"
FX = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"

STYLE_COLORS = {
    "起始": "#888",
    "风暴": "#89CFF0",
    "火焰": "#FF6B6B",
    "水源": "#4FC3F7",
    "大地": "#8D6E63",
    "巫术": "#CE93D8",
}
STYLE_ORDER = ["风暴", "火焰", "水源", "大地", "巫术"]
TIER_ORDER = ["一阶", "二阶", "三阶", "四阶", "五阶"]
STARTING_IDS = {"sa-skill-1", "sa-skill-2", "sa-skill-3", "sa-skill-4"}

ARTICLE = re.compile(
    r'<article class="skill(?: starting)?" id="([^"]+)"[^>]*>.*?<h4>([^<]+)\s*'
    r'(?:<span class="chip"[^>]*>([^<]+)</span>)?',
    re.S,
)
TIER_CHIP = re.compile(r"([^·]+)(?:风格)? · ([^<]+)天赋树")
STARTING_NAMES = {"闪电箭", "烈焰冲击", "治疗波", "大地之盾"}


def parse_html_meta(html: str) -> dict[str, dict]:
    meta: dict[str, dict] = {}
    for m in ARTICLE.finditer(html):
        sid = m.group(1)
        if not sid.startswith("sa-skill-"):
            continue
        name = m.group(2).strip().split()[0]
        chip = (m.group(3) or "").strip()
        style, tier = "", ""
        if "起始特性" in chip:
            style, tier = "起始", ""
        else:
            cm = TIER_CHIP.search(chip)
            if cm:
                style = cm.group(1).strip().removesuffix("风格")
                tier = cm.group(2).strip()
        meta[sid] = {"name": name, "style": style, "tier": tier}
    return meta


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
    if stub.get("style") and stub["style"] != "起始":
        style = stub["style"].removesuffix("风格")
        skill["style"] = style
    if stub.get("tier"):
        skill["tier"] = stub["tier"]
    return skill


def skill_sort_key(s: dict) -> tuple:
    sid = s["id"]
    if sid in STARTING_IDS or s.get("name") in STARTING_NAMES:
        return (0, int(sid.rsplit("-", 1)[-1]))
    style = s.get("style", "")
    tier = s.get("tier", "")
    num_m = re.search(r"(\d+)$", sid)
    num = int(num_m.group(1)) if num_m else 9999
    return (
        STYLE_ORDER.index(style) + 1 if style in STYLE_ORDER else 99,
        TIER_ORDER.index(tier) + 1 if tier in TIER_ORDER else 99,
        num,
    )


def chips_html(tags: list[str]) -> str:
    return "".join(f'<span class="chip">{t}</span>' for t in tags)


def render_article(skill: dict, block: dict) -> str:
    sid = skill["id"]
    name = skill["name"]
    style = skill.get("style", "起始")
    tier = skill.get("tier", "")
    tags = skill.get("tags") or tags_from_keywords(skill["fields"].get("关键词", ""))
    if sid in STARTING_IDS:
        chip_label = "起始特性"
        color = STYLE_COLORS["起始"]
        style_for_search = "起始"
        tier_label = "起始特性"
    else:
        chip_label = f"{style} · {tier}天赋树"
        color = STYLE_COLORS.get(style, "#888")
        style_for_search = style
        tier_label = f"{tier}阶天赋树" if tier else tier_label_from_skill(skill)

    detail = build_detail_html(block)
    data_search = build_data_search(block, style_for_search, tier_label, tags)
    safe = sanitize_data_search(data_search)
    return (
        f'<article class="skill" id="{sid}" data-search="{safe}">\n'
        f'        <h4>{name} <span class="chip" style="background:{color};color:#fff">{chip_label}</span></h4>\n'
        f'        <div class="chips">{chips_html(tags)}</div>\n'
        f'        <div class="detail">{detail}</div>\n'
        f"      </article>"
    )


def render_nav(skills: list[dict]) -> str:
    lines = [
        '      <div class="filter-bar" id="sa-filter-bar"></div>',
        '      <a class="style-link" href="#sa-starting-features">起始特性</a>',
        f'<a class="adv-link" href="{CLASS}·进阶.html">→ 查看进阶途径</a>',
        '      <div class="tier-list">',
    ]
    for sk in skills:
        if sk["id"] in STARTING_IDS:
            lines.append(f'        <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
    lines.append("      </div>")

    grouped: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for sk in skills:
        if sk["id"] in STARTING_IDS:
            continue
        grouped[sk.get("style", "")][sk.get("tier", "")].append(sk)

    for style in STYLE_ORDER:
        if style not in grouped:
            continue
        lines.append("")
        lines.append('            <details class="nav-group">')
        lines.append(
            f'              <summary class="style-summary">'
            f'<a href="#sa-style-{style}">{style}风格</a></summary>'
        )
        for tier in TIER_ORDER:
            tier_skills = grouped[style].get(tier, [])
            if not tier_skills:
                continue
            lines.append('              <details class="nav-tier">')
            lines.append(
                f'                  <summary class="tier-summary">'
                f'<a href="#sa-tier-{style}-{tier}">{tier}阶天赋树</a></summary>'
            )
            for sk in tier_skills:
                lines.append(
                    f'                  <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>'
                )
            lines.append("              </details>")
        lines.append("            </details>")

    return "\n".join(lines)


def render_content(skills: list[dict], blocks: dict[str, dict]) -> str:
    parts = [
        '      <div class="empty" id="sa-empty" style="display:none">',
        '        <p style="text-align:center;color:var(--muted);padding:40px 0">'
        "没有匹配的技能。试试其他关键词吧。</p>",
        "      </div>",
        '      <h3 id="sa-starting-features">起始特性</h3>',
        '      <p class="subtitle">你可以从以下起始特性中选择两项加入你的技能列表：</p>',
    ]
    for sk in skills:
        if sk["id"] in STARTING_IDS:
            parts.append(render_article(sk, blocks[sk["id"]]))

    current_style = None
    current_tier = None
    for sk in skills:
        if sk["id"] in STARTING_IDS:
            continue
        style = sk.get("style", "")
        tier = sk.get("tier", "")
        if style != current_style:
            parts.append(f'      <h3 id="sa-style-{style}">{style}风格</h3>')
            current_style = style
            current_tier = None
        if tier != current_tier:
            parts.append(f'      <h4 id="sa-tier-{style}-{tier}">{tier}阶天赋树</h4>')
            current_tier = tier
        parts.append(render_article(sk, blocks[sk["id"]]))
    return "\n".join(parts)


def read_head() -> str:
    text = HTML.read_text(encoding="utf-8")
    end = text.find("<main>")
    if end == -1:
        raise SystemExit("cannot find <main> in HTML")
    return text[: end + len("<main>")] + "\n"


FOOT = """
</main>

<script src="common.js"></script>
<script src="filter.js"></script>
<script>
createFilterController("view-shaman", "sa");
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
    html_old = HTML.read_text(encoding="utf-8")
    data = json.loads(DATA.read_text(encoding="utf-8"))
    html_meta = parse_html_meta(html_old)

    stubs: dict[str, dict] = {}
    for sk in data["skills"]:
        style = sk.get("style", "")
        if style:
            style = style.removesuffix("风格")
        stubs[sk["id"]] = {
            "id": sk["id"],
            "name": sk["name"],
            "style": style,
            "tier": sk.get("tier", ""),
        }
    for sid, meta in html_meta.items():
        if sid not in stubs:
            stubs[sid] = {"id": sid, **meta}

    all_names = {s["name"] for s in stubs.values()} | {m["name"] for m in html_meta.values()}
    paras = extract_paragraphs(DOCX)
    idx = build_docx_index(paras, all_names)
    used: set[int] = set()

    skills: list[dict] = []
    blocks: dict[str, dict] = {}
    removed: list[str] = []

    for sid in sorted(stubs.keys(), key=lambda x: skill_sort_key({"id": x, **stubs[x]})):
        stub = stubs[sid]
        pick_style = stub.get("style", "")
        if sid in STARTING_IDS:
            pick_style = ""
        block = pick_block(idx, {"name": stub["name"], "style": pick_style}, used)
        if not block:
            removed.append(f"{sid} {stub['name']}")
            continue
        skill = block_to_skill(stub, block)
        skills.append(skill)
        blocks[sid] = block

    skills.sort(key=skill_sort_key)

    doc = {"id": CLASS, "name": CLASS, "skills": skills}
    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    fx_doc = {CLASS: [json_to_fx_entry(s, CLASS) for s in skills]}
    FX.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    head = read_head()
    nav = render_nav(skills)
    content = render_content(skills, blocks)
    page = (
        head
        + "    <nav aria-label=\"萨满祭司天赋索引\">\n      <div class=\"nav-inner\">\n"
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
        "skills": len(skills),
        "removed_not_in_docx": removed,
        "fx_entries": len(fx_doc[CLASS]),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
