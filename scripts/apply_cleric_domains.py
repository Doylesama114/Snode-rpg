# -*- coding: utf-8 -*-
"""
Apply 牧师神圣领域 extracts into:
  - 职业页/数据/牧师·神圣领域.json
  - 职业页/牧师.html (deity chips + panels + nav)
  - electron-app mirrors
  - search-index rebuild
"""
from __future__ import annotations

import html as html_lib
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from apply_class_extract import extract_to_block, extract_to_site_skill  # noqa: E402
from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    sanitize_data_search,
    skill_type_from_keywords,
    tags_from_keywords,
)
from cleric_domain_config import DOMAIN_DOCX, all_deities, pantheon_for_json  # noqa: E402

EXTRACT = ROOT / "scripts" / "extracts" / "牧师_domains.json"
HTML_PATH = ROOT / "职业页" / "牧师.html"
DOMAIN_JSON = ROOT / "职业页" / "数据" / "牧师·神圣领域.json"
TIER_ORDER = ["起始", "起始专长", "一阶", "二阶", "三阶", "四阶", "五阶", "六阶", "七阶"]

CSS_BLOCK = """
    .deity-filter { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 12px; }
    .deity-chip {
      border:1px solid var(--line); background:var(--panel); color:var(--ink);
      border-radius:6px; padding:6px 12px; font-size:13px; cursor:pointer;
    }
    .deity-chip:hover:not(:disabled) { border-color:var(--green); }
    .deity-chip.active { background:var(--green); color:#fff; border-color:var(--green); }
    .deity-chip.locked, .deity-chip:disabled {
      opacity:0.55; cursor:not-allowed; color:var(--muted);
    }
    .deity-chip .lock-mark { margin-left:4px; font-size:12px; }
    .deity-note { color:var(--muted); font-size:12px; margin:0 0 16px; line-height:1.5; }
    .deity-panel.deity-hidden, .deity-nav.deity-hidden { display:none !important; }
    .deity-toast {
      position:fixed; left:50%; bottom:28px; transform:translateX(-50%);
      background:rgba(20,20,20,.92); color:#fff; padding:10px 16px; border-radius:8px;
      font-size:13px; z-index:9999; opacity:0; pointer-events:none; transition:opacity .2s;
    }
    .deity-toast.show { opacity:1; }
"""

SCRIPT_BLOCK = r"""
<script id="pr-deity-switch-script">
(function(){
  var chips = Array.prototype.slice.call(document.querySelectorAll(".deity-chip"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".deity-panel"));
  var navs = Array.prototype.slice.call(document.querySelectorAll(".deity-nav"));
  var toast = document.getElementById("pr-deity-toast");
  var toastTimer = null;

  function showToast(msg){
    if(!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove("show"); }, 1800);
  }

  function setDeity(deity){
    document.body.setAttribute("data-active-deity", deity || "");
    chips.forEach(function(c){
      var d = c.getAttribute("data-deity") || "";
      c.classList.toggle("active", d === deity && !c.classList.contains("locked"));
    });
    panels.forEach(function(p){
      var d = p.getAttribute("data-deity") || "";
      p.classList.toggle("deity-hidden", d !== deity);
    });
    navs.forEach(function(n){
      var d = n.getAttribute("data-deity") || "";
      n.classList.toggle("deity-hidden", d !== deity);
    });
    var fc = window.__filterControllers && window.__filterControllers["view-priest"];
    if(fc){
      if(fc.sr) fc.sr.value = "";
      if(fc.applySearch) fc.applySearch();
      else if(fc.renderFilters) fc.renderFilters();
    }
  }

  chips.forEach(function(c){
    c.addEventListener("click", function(){
      if(c.classList.contains("locked") || c.disabled){
        showToast("该神祇神圣领域法表尚未公布");
        return;
      }
      setDeity(c.getAttribute("data-deity") || "");
    });
  });

  setDeity("");
})();
</script>
"""


def esc(s: str) -> str:
    return html_lib.escape(s or "", quote=True)


def chips_html(skill: dict) -> str:
    kw = (skill.get("fields") or {}).get("关键词", "")
    stype = skill.get("type") or skill_type_from_keywords(kw)
    tags = skill.get("tags") or tags_from_keywords(kw)
    items = []
    if stype:
        items.append(stype)
    for t in tags:
        if t and t not in items:
            items.append(t)
    return "".join(f'<span class="chip">{esc(t)}</span>' for t in items)


def render_article(skill: dict, block: dict, deity: str) -> str:
    style = skill.get("style") or ""
    tier = skill.get("tier") or ""
    if skill.get("kind") == "initial_feat" or tier == "起始专长":
        label = "起始专长"
    elif tier == "起始" or skill.get("kind") == "starting":
        label = "起始特性"
    elif style:
        label = f"{style} · {tier}天赋树" if tier and tier not in ("起始", "起始专长") else f"{style}风格"
    else:
        label = tier or "神圣领域"

    detail = build_detail_html(block, {
        "unit_tables": block.get("unit_tables") or [],
        "roll_tables": block.get("roll_tables") or [],
    })
    if not (block.get("fields") or {}) and (block.get("description") or []):
        # feat-only body：与表格化样式统一（效果块）
        paras = "".join(f'<div class="effect-cell">{esc(p)}</div>' for p in block["description"] if p.strip())
        detail = paras or detail

    tier_label = f"{tier}天赋树" if tier and "阶" in tier else (tier or "")
    data_search = build_data_search(
        block, style or deity, tier_label or label, skill.get("tags") or []
    )
    data_search = f"{deity} {data_search}"
    data_search = append_tables_to_search(data_search, block)
    safe = sanitize_data_search(data_search)
    data_attrs = build_skill_data_attrs(skill, block.get("mark_dots") or [], "牧师")
    return (
        f'<article class="skill" id="{skill["id"]}" data-deity="{esc(deity)}" '
        f'data-search="{safe}"{data_attrs}>'
        f'<h4>{esc(skill["name"])} <span class="chip" style="background:#888">{esc(label)}</span></h4>\n'
        f'<div class="chips">{chips_html(skill)}</div>\n'
        f'<div class="detail">{detail}</div>\n'
        f"</article>\n"
    )


def assign_ids(deity_id: str, feats: list, skills: list) -> list[dict]:
    out = []
    n = 0
    for f in feats:
        n += 1
        sid = f"pr-d-{deity_id}-{n}"
        row = dict(f)
        row["id"] = sid
        row["kind"] = "initial_feat"
        row["tier"] = "起始专长"
        row["type"] = "专长"
        row["tags"] = []
        out.append(row)
    for s in skills:
        n += 1
        sid = f"pr-d-{deity_id}-{n}"
        row = dict(s)
        row["id"] = sid
        if row.get("tier") == "起始":
            row["kind"] = "starting"
        else:
            row["kind"] = row.get("kind") or "skill"
        kw = (row.get("fields") or {}).get("关键词", "")
        row["tags"] = tags_from_keywords(kw)
        row["type"] = skill_type_from_keywords(kw) or row.get("type") or "技能"
        out.append(row)
    return out


def build_domain_panel_html(deity: str, deity_id: str, items: list[dict], combat_styles: list[str]) -> tuple[str, str]:
    """Return (content_html, nav_html)."""
    feats = [x for x in items if x.get("kind") == "initial_feat"]
    starting = [x for x in items if x.get("kind") == "starting"]
    rest = [x for x in items if x.get("kind") not in ("initial_feat", "starting")]

    parts = [
        f'<div class="deity-panel deity-hidden" data-deity="{esc(deity)}" id="pr-panel-{deity_id}">\n',
        f'<section class="style" id="pr-d-{deity_id}-head">\n',
        f"<h2>{esc(deity)} · 神圣领域</h2>\n",
        "<p>神圣领域战斗风格与牧师通用战斗风格共享上限（至多四种）。</p>\n",
        "</section>\n",
    ]
    nav = [
        f'<div class="deity-nav deity-hidden" data-deity="{esc(deity)}" id="pr-nav-{deity_id}">\n',
        f'<a class="style-link" href="#pr-d-{deity_id}-head">{esc(deity)}</a>\n',
    ]

    if feats:
        parts.append(f'<section class="style" id="pr-d-{deity_id}-feats"><h2>起始专长</h2>\n')
        nav.append(f'<a class="style-link" href="#pr-d-{deity_id}-feats">起始专长</a>\n')
        nav.append('<div class="tier-list">\n')
        for f in feats:
            block = extract_to_block(
                {
                    "name": f["name"],
                    "fields": {},
                    "cost": [],
                    "description": f.get("description") or [],
                    "level_upgrades": [],
                    "flavor": [],
                }
            )
            site = {
                "id": f["id"],
                "name": f["name"],
                "style": "",
                "tier": "起始专长",
                "type": "专长",
                "tags": [],
                "fields": {},
                "kind": "initial_feat",
            }
            parts.append(render_article(site, block, deity))
            nav.append(f'<a class="skill-link" href="#{f["id"]}">{esc(f["name"])}</a>\n')
        nav.append("</div>\n")
        parts.append("</section>\n")

    if starting:
        parts.append(
            f'<section class="style starting" id="pr-d-{deity_id}-starting"><h2>起始特性</h2>\n'
            "<p>领域起始特性：</p>\n"
        )
        nav.append(f'<a class="style-link" href="#pr-d-{deity_id}-starting">起始特性</a>\n')
        nav.append('<div class="tier-list">\n')
        for s in starting:
            block = extract_to_block(s)
            site = extract_to_site_skill(s, s["id"])
            site["kind"] = "starting"
            site["tier"] = "起始"
            parts.append(render_article(site, block, deity))
            nav.append(f'<a class="skill-link" href="#{s["id"]}">{esc(s["name"])}</a>\n')
        nav.append("</div>\n")
        parts.append("</section>\n")

    by_style: dict[str, list] = defaultdict(list)
    for s in rest:
        by_style[s.get("style") or "领域"].append(s)

    style_order = [x for x in combat_styles if x in by_style] + [
        x for x in by_style if x not in combat_styles
    ]

    for si, style in enumerate(style_order, 1):
        group = by_style[style]
        style_aid = f"pr-d-{deity_id}-style-{si}"
        parts.append(
            f'<section class="style" id="{style_aid}" data-style="{esc(style)}">\n'
            f"<h2>{esc(style)}风格</h2>\n"
        )
        nav.append(
            f'<details class="nav-group"><summary class="style-summary">'
            f'<a href="#{style_aid}">{esc(style)}风格</a></summary>\n'
        )

        by_tier: dict[str, list] = defaultdict(list)
        for s in group:
            by_tier[s.get("tier") or "未知"].append(s)

        ti = 0
        for tier in list(TIER_ORDER) + [t for t in by_tier if t not in TIER_ORDER]:
            if tier not in by_tier:
                continue
            ti += 1
            tier_skills = by_tier[tier]
            tier_aid = f"{style_aid}-t{ti}"
            heading = f"{tier}天赋树" if "阶" in tier else tier
            parts.append(f'<section class="tier" id="{tier_aid}"><h3>{esc(heading)}</h3>\n')
            nav.append(
                f'<details class="nav-tier"><summary class="tier-summary">'
                f'<a href="#{tier_aid}">{esc(heading)}</a></summary>\n'
            )
            for s in tier_skills:
                block = extract_to_block(s)
                site = extract_to_site_skill(s, s["id"])
                site["kind"] = "skill"
                parts.append(render_article(site, block, deity))
                nav.append(f'<a class="skill-link" href="#{s["id"]}">{esc(s["name"])}</a>\n')
            parts.append("</section>\n")
            nav.append("</details>\n")

        parts.append("</section>\n")
        nav.append("</details>\n")

    parts.append("</div>\n")
    nav.append("</div>\n")
    return "".join(parts), "".join(nav)


def build_chips_html(pantheon: list[dict]) -> str:
    bits = [
        '<!-- PR-DEITY-CHIPS -->\n',
        '<div class="deity-filter" role="toolbar" aria-label="神圣领域神祇切换">\n',
        '<button type="button" class="deity-chip active" data-deity="">通用风格</button>\n',
    ]
    for d in pantheon:
        name = d["name"]
        attr = d.get("attr") or ""
        title = f"神祇属性：{attr}" if attr else name
        if d.get("locked"):
            bits.append(
                f'<button type="button" class="deity-chip locked" data-deity="{esc(name)}" '
                f'disabled title="{esc(title)}（法表未公布）">{esc(name)}'
                f'<span class="lock-mark">锁定</span></button>\n'
            )
        else:
            bits.append(
                f'<button type="button" class="deity-chip" data-deity="{esc(name)}" '
                f'title="{esc(title)}">{esc(name)}</button>\n'
            )
    bits.append("</div>\n")
    bits.append(
        '<p class="deity-note">选择神祇查看对应神圣领域法表；灰色「锁定」表示该神祇领域表尚未公布。'
        "领域战斗风格与通用战斗风格共享上限（至多四种）。</p>\n"
        "<!-- /PR-DEITY-CHIPS -->\n"
    )
    return "".join(bits)


def trim_excess_div_closes(fragment: str) -> str:
    """Remove trailing orphan </div> so open/close counts balance (never strip opens)."""
    while True:
        opens = len(re.findall(r"<div\b", fragment))
        closes = len(re.findall(r"</div>", fragment))
        if closes <= opens:
            return fragment
        idx = fragment.rfind("</div>")
        if idx < 0:
            return fragment
        # keep surrounding whitespace tidy
        start = idx
        while start > 0 and fragment[start - 1] in "\n\r\t ":
            start -= 1
        fragment = fragment[:start] + fragment[idx + 6 :]


def find_div_close(html: str, open_at: int) -> int:
    """Return index of the </div> that matches the <div at open_at."""
    if not html.startswith("<div", open_at):
        raise ValueError("open_at must point at <div")
    depth = 0
    idx = open_at
    while idx < len(html):
        if html.startswith("<div", idx) and (idx + 4 >= len(html) or html[idx + 4] in " \t\n>"):
            depth += 1
            gt = html.find(">", idx)
            idx = gt + 1 if gt != -1 else idx + 4
            continue
        if html.startswith("</div>", idx):
            depth -= 1
            if depth == 0:
                return idx
            idx += 6
            continue
        idx += 1
    raise ValueError("matching </div> not found")


def strip_previous(html: str) -> str:
    html = re.sub(
        r"<!-- PR-DEITY-CHIPS -->.*?<!-- /PR-DEITY-CHIPS -->\n?",
        "",
        html,
        flags=re.S,
    )
    html = re.sub(
        r"<!-- PR-DEITY-PANELS -->.*?<!-- /PR-DEITY-PANELS -->\n?",
        "",
        html,
        flags=re.S,
    )
    html = re.sub(
        r"<!-- PR-DEITY-NAVS -->.*?<!-- /PR-DEITY-NAVS -->\n?",
        "",
        html,
        flags=re.S,
    )
    html = re.sub(
        r'<script id="pr-deity-switch-script">.*?</script>\n?',
        "",
        html,
        flags=re.S,
    )
    html = re.sub(
        r'<div id="pr-deity-toast"[^>]*>.*?</div>\n?',
        "",
        html,
        flags=re.S,
    )
    # unwrap previous common wrappers if re-run (open+close together, avoid orphan </div>)
    # Collapse accidental extra </div> before markers (closes .content / nav-inner early).
    html = re.sub(
        r"(?:\n?</div>){1,3}\s*<!-- /PR-PANEL-COMMON -->\n?",
        "\n",
        html,
        count=1,
    )
    html = re.sub(
        r'<div class="deity-panel" data-deity="" id="pr-panel-common">\n?',
        "",
        html,
        count=1,
    )
    html = re.sub(
        r"(?:\n?</div>){1,3}\s*<!-- /PR-NAV-COMMON -->\n?",
        "\n",
        html,
        count=1,
    )
    html = re.sub(
        r'<div class="deity-nav" data-deity="" id="pr-nav-common">\n?',
        "",
        html,
        count=1,
    )
    # leftover markers from older builds
    html = html.replace("<!-- /PR-PANEL-COMMON -->\n", "")
    html = html.replace("<!-- /PR-NAV-COMMON -->\n", "")
    return html


def inject_css(html: str) -> str:
    if ".deity-filter" in html:
        # replace old block between markers if present
        html = re.sub(
            r"/\* PR-DEITY-CSS \*/.*?/\* /PR-DEITY-CSS \*/",
            f"/* PR-DEITY-CSS */{CSS_BLOCK}/* /PR-DEITY-CSS */",
            html,
            flags=re.S,
        )
        if "/* PR-DEITY-CSS */" in html:
            return html
    # insert before </style> in head
    idx = html.find("</style>")
    if idx == -1:
        raise SystemExit("no </style>")
    return html[:idx] + f"/* PR-DEITY-CSS */{CSS_BLOCK}/* /PR-DEITY-CSS */\n" + html[idx:]


def inject_html(html: str, chips: str, panels: str, navs: str) -> str:
    html = strip_previous(html)
    html = inject_css(html)

    # subtitle
    html = html.replace(
        "三种战斗风格 · 一至四阶 · 技能详情 · 关键词搜索",
        "通用三风格 · 神圣领域 · 关键词搜索",
        1,
    )

    # wrap nav content after filter-bar
    marker = '<div class="filter-bar" id="pr-filter-bar"></div>'
    pos = html.find(marker)
    if pos == -1:
        raise SystemExit("filter-bar not found")
    after = pos + len(marker)
    # Prefer the literal nav-inner closer before </nav>. Do NOT walk by depth here:
    # leftover orphan </div> from prior injects would make depth match too early.
    nav_end = html.find("</div></nav>", after)
    if nav_end == -1:
        m = re.search(r"</div>\s*</nav>", html[after:])
        if not m:
            raise SystemExit("nav end not found")
        nav_end = after + m.start()
    common_nav = trim_excess_div_closes(html[after:nav_end])
    wrapped_nav = (
        f'\n<div class="deity-nav" data-deity="" id="pr-nav-common">\n'
        f"{common_nav}"
        f"\n</div><!-- /PR-NAV-COMMON -->\n"
        f"<!-- PR-DEITY-NAVS -->\n{navs}<!-- /PR-DEITY-NAVS -->\n"
    )
    html = html[:after] + wrapped_nav + html[nav_end:]

    # chips + wrap content
    content_marker = '<div class="content">\n  <div id="pr-empty" class="empty hidden">没有找到匹配内容。</div>\n'
    cpos = html.find(content_marker)
    if cpos == -1:
        content_marker = '<div class="content">\n  <div id="pr-empty" class="empty hidden">没有找到匹配内容。</div>'
        cpos = html.find(content_marker)
        if cpos == -1:
            raise SystemExit("content marker not found")
    insert_at = cpos + len(content_marker)
    content_start = html.find('<div class="content">', cpos)
    if content_start == -1:
        raise SystemExit("content start not found")
    # Use the </div> immediately before </main> — depth-walk can stop early on orphan closes.
    main_at = html.find("</main>", insert_at)
    if main_at == -1:
        raise SystemExit("</main> not found")
    close_at = html.rfind("</div>", insert_at, main_at)
    if close_at == -1:
        raise SystemExit("content close not found before </main>")

    common_body = html[insert_at:close_at]
    # Drop stray chips if re-injecting over an already-injected page
    common_body = re.sub(
        r"<!-- PR-DEITY-CHIPS -->.*?<!-- /PR-DEITY-CHIPS -->\n?",
        "",
        common_body,
        flags=re.S,
    )
    # Drop any domain panels that leaked outside the previous common wrapper
    common_body = re.sub(
        r"<!-- PR-DEITY-PANELS -->.*?<!-- /PR-DEITY-PANELS -->\n?",
        "",
        common_body,
        flags=re.S,
    )
    common_body = re.sub(
        r'\n*<div class="deity-panel deity-hidden"[^>]*>.*?(?=(?:<div class="deity-panel"|</div>\s*$))',
        "",
        common_body,
        flags=re.S,
    )
    common_body = trim_excess_div_closes(common_body)
    new_body = (
        f"\n{chips}\n"
        f'<div class="deity-panel" data-deity="" id="pr-panel-common">\n'
        f"{common_body}"
        f"\n</div><!-- /PR-PANEL-COMMON -->\n"
        f"<!-- PR-DEITY-PANELS -->\n{panels}<!-- /PR-DEITY-PANELS -->\n"
    )
    html = html[:insert_at] + new_body + html[close_at:]

    # toast + script before nav-toggle or after filter.js
    if 'id="pr-deity-switch-script"' not in html:
        inject = (
            '<div id="pr-deity-toast" class="deity-toast" role="status" aria-live="polite"></div>\n'
            + SCRIPT_BLOCK
        )
        anchor = 'createFilterController("view-priest", "pr");\n</script>'
        if anchor in html:
            html = html.replace(anchor, anchor + "\n" + inject, 1)
        else:
            html = html.replace("</body>", inject + "\n</body>", 1)

    return html


def patch_filter_js() -> None:
    path = ROOT / "职业页" / "filter.js"
    text = path.read_text(encoding="utf-8")
    if "isSkillInActiveDeityPanel" in text:
        return
    helper = """
    function isSkillInActiveDeityPanel(skill) {
        var panel = skill.closest ? skill.closest(".deity-panel") : null;
        if (!panel) return true;
        return !panel.classList.contains("deity-hidden");
    }

"""
    # insert after canonicalizeMarkHex function block near top — after readMarksFromSkill
    needle = "    function FilterController(viewId, prefix) {"
    if needle not in text:
        raise SystemExit("FilterController not found")
    text = text.replace(needle, helper + needle, 1)

    text = text.replace(
        '        q("article.skill").forEach(function(skill) {\n'
        '            skill.classList.toggle("filter-hidden", !self.skillMatchesFilters(skill));\n'
        "        });",
        '        q("article.skill").forEach(function(skill) {\n'
        "            if (!isSkillInActiveDeityPanel(skill)) {\n"
        '                skill.classList.add("filter-hidden");\n'
        "                return;\n"
        "            }\n"
        '            skill.classList.toggle("filter-hidden", !self.skillMatchesFilters(skill));\n'
        "        });",
        1,
    )
    text = text.replace(
        '        q(".skill").forEach(function(skill) {\n'
        '            var data = (skill.getAttribute("data-search") || "").toLowerCase();\n'
        '            var text = (skill.textContent || "").toLowerCase();\n'
        "            var matchAll = terms.every(function(t) { return data.indexOf(t) !== -1 || text.indexOf(t) !== -1; });\n"
        '            skill.classList.toggle("hidden", !matchAll);\n'
        "            if (matchAll) any = true;\n"
        "        });",
        '        q(".skill").forEach(function(skill) {\n'
        "            if (!isSkillInActiveDeityPanel(skill)) {\n"
        '                skill.classList.add("hidden");\n'
        "                return;\n"
        "            }\n"
        '            var data = (skill.getAttribute("data-search") || "").toLowerCase();\n'
        '            var text = (skill.textContent || "").toLowerCase();\n'
        "            var matchAll = terms.every(function(t) { return data.indexOf(t) !== -1 || text.indexOf(t) !== -1; });\n"
        '            skill.classList.toggle("hidden", !matchAll);\n'
        "            if (matchAll) any = true;\n"
        "        });",
        1,
    )
    # when clearing search, still keep inactive panels' skills hidden via CSS parent
    path.write_text(text, encoding="utf-8")
    print("patched filter.js")


def mirror(paths: list[Path]) -> None:
    for src in paths:
        rel = src.relative_to(ROOT)
        dst = ROOT / "electron-app" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print("mirror", rel)


def main() -> None:
    data = json.loads(EXTRACT.read_text(encoding="utf-8"))
    pantheon = pantheon_for_json()
    # ensure pantheon locked flags match extract domains
    unlocked = set(data.get("domains") or {})
    for p in pantheon:
        p["locked"] = p["name"] not in unlocked

    site_domains = {}
    panel_html_parts = []
    nav_html_parts = []
    id_map = {d["name"]: d["id"] for d in all_deities()}

    for deity, dom in data["domains"].items():
        deity_id = id_map.get(deity) or re.sub(r"\W+", "", deity)[:12]
        items = assign_ids(deity_id, dom.get("initial_feats") or [], dom.get("skills") or [])
        site_domains[deity] = {
            "id": deity_id,
            "name": deity,
            "combat_styles": dom.get("combat_styles") or [],
            "source_file": dom.get("source_file"),
            "skills": items,
        }
        ph, nh = build_domain_panel_html(
            deity, deity_id, items, dom.get("combat_styles") or []
        )
        panel_html_parts.append(ph)
        nav_html_parts.append(nh)
        print(f"built {deity}: {len(items)} entries")

    payload = {
        "meta": data.get("meta") or {},
        "pantheon": pantheon,
        "domains": site_domains,
    }
    DOMAIN_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("wrote", DOMAIN_JSON)

    chips = build_chips_html(pantheon)
    html = HTML_PATH.read_text(encoding="utf-8")
    html = inject_html(html, chips, "".join(panel_html_parts), "".join(nav_html_parts))
    HTML_PATH.write_text(html, encoding="utf-8")
    print("wrote", HTML_PATH)

    patch_filter_js()

    mirror(
        [
            HTML_PATH,
            DOMAIN_JSON,
            ROOT / "职业页" / "filter.js",
        ]
    )

    subprocess.check_call(
        ["node", str(ROOT / "scripts" / "build_class_search_index.js")],
        cwd=str(ROOT),
    )
    shutil.copy2(
        ROOT / "职业页" / "search-index.json",
        ROOT / "electron-app" / "职业页" / "search-index.json",
    )
    print("search-index rebuilt + mirrored")


if __name__ == "__main__":
    main()
