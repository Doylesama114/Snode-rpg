#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 基础职业-召唤师.docx 重建召唤师技能数据 + 职业页 + skill_effects。

与谋士版差异：
- 列表驱动：先读 docx 每个风格/位阶的「技能清单表」，再按名称在对应区段内提取详情块；
  同名多块（灵猫/灵枭/灵狐守护 = 异能主块 + 天赋被动块）合并为一条技能。
- 蓝焰术（咒法二阶）docx 缺详情表：按用户口径复用其他职业同名条目（法师版），
  升级条目职业名替换为「召唤师」。
- 召唤物数据块（隐形战仆/魅影杀手/风火水土元素）与契约生物列表不属于技能，不采集。
- 契约生物切换区由 apply_summoner_contracts.py 注入（M3）。
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
from extract_unit_tables import parse_unit_block
from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    collect_roll_rows,
    cost_json,
    detect_unit_blocks,
    extract_paragraphs,
    extract_skill_block,
    filter_description_lines,
    json_to_fx_entry,
    sanitize_data_search,
    split_skill_description,
    tags_from_keywords,
)

CLASS = "召唤师"
PREFIX = "sm"
VIEW_ID = "view-summoner"
DATA = ROOT / "职业页" / "数据" / f"{CLASS}.json"
HTML = ROOT / "职业页" / f"{CLASS}.html"
DOCX = ROOT / f"基础职业-{CLASS}.docx"
FX = ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json"
TEMPLATE = ROOT / "职业页" / "萨满祭司.html"
REF_MAGE = ROOT / "职业页" / "数据" / "法师.json"

STYLES = ["咒法", "降灵"]
STYLE_COLORS = {
    "咒法": "#C0A8FF",
    "降灵": "#8ED7F5",
}
TIER_ORDER = ["一阶", "二阶", "三阶"]
STARTING_ORDER = ["魔法飞弹", "次级召唤术", "唤回"]
FEATURE_NAMES = ["召唤联结", "异界感知", "机缘召唤"]
FEATURE_SECTION_ID = f"{PREFIX}-class-features"
SEP_RE = re.compile(r"^-{3,}$")
DICE_RANGE_RE = re.compile(r'^\d{3}(-\d{3})?$')
REUSE_FROM_OTHER = {"蓝焰术": ("法师", "咒法", "二阶")}
# 清单笔误 → 详情表真名（用户确认）
LIST_ALIASES = {"召唤指令·回避": "契约指令·回避"}

def extract_class_features() -> dict:
    """从谋士 docx 的「初始专长」段落区提取职业专长。"""
    events = body_events(DOCX)
    start = next(i for i, (k, t) in enumerate(events) if k == "P" and t == "初始专长")
    end = next((i for i in range(start + 1, len(events)) if is_boundary(*events[i])), len(events))

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
        f'<section class="class-features" id="{FEATURE_SECTION_ID}" aria-label="职业专长">'
        f'<div class="class-feature-head"><h2>职业专长</h2>'
        f'<p class="class-feature-intro">{html.escape(info["intro"])}</p></div>'
        f'<div class="class-feature-tabs" role="tablist">{"".join(chips)}</div>'
        f'<div class="class-feature-panels">{"".join(panels)}</div></section>'
    )

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
    tables = {'unit_tables': skill.get('unit_tables') or [], 'roll_tables': skill.get('roll_tables') or []}
    detail = build_detail_html(block, tables)
    data_search = build_data_search(block, style_for_search, tier_label, tags)
    data_search = append_tables_to_search(data_search, skill)
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
        f'      <div class="filter-bar" id="{PREFIX}-filter-bar"></div>',
        f'      <a class="style-link" href="#{FEATURE_SECTION_ID}">职业专长</a>',
        f'      <a class="style-link" href="#{PREFIX}-starting-features">起始特性</a>',
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
            f'<a href="#{PREFIX}-style-{style}">{style}风格</a></summary>'
        )
        for tier in TIER_ORDER:
            tier_skills = grouped[style].get(tier, [])
            if not tier_skills:
                continue
            lines.append('              <details class="nav-tier">')
            lines.append(
                f'                  <summary class="tier-summary">'
                f'<a href="#{PREFIX}-tier-{style}-{tier}">{tier}天赋树</a></summary>'
            )
            for sk in tier_skills:
                lines.append(f'                  <a class="skill-link" href="#{sk["id"]}">{sk["name"]}</a>')
            lines.append("              </details>")
        lines.append("            </details>")
    return "\n".join(lines)


def render_content(skills: list[dict], blocks: dict[str, dict]) -> str:
    parts = [
        f'      <div class="empty" id="{PREFIX}-empty" style="display:none">',
        '        <p style="text-align:center;color:var(--muted);padding:40px 0">'
        "没有匹配的技能。试试其他关键词吧。</p>",
        "      </div>",
        render_class_features(extract_class_features()),
        f'      <h3 id="{PREFIX}-starting-features">起始特性</h3>',
        ('      <p class="subtitle">你获得以下全部起始特性，直接加入你的技能或天赋列表：</p>'
         if CLASS == '召唤师' else
         '      <p class="subtitle">你可以从以下起始特性中选择两项加入你的技能列表：</p>'),
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
            parts.append(f'      <h3 id="{PREFIX}-style-{style}">{style}风格</h3>')
            current_style = style
            current_tier = None
        if tier != current_tier:
            parts.append(f'      <h4 id="{PREFIX}-tier-{style}-{tier}">{tier}阶天赋树</h4>')
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
    head = head.replace('id="sa-search"', f'id="{PREFIX}-search"')
    head = head.replace('五种元素风格 · 一至四阶 · 技能详情 · 关键词搜索',
                        f'{"、".join(STYLES)}两种战斗风格 · 一至三阶 · 技能详情 · 关键词搜索')
    head = head.replace('placeholder="搜索萨满祭司技能、风格、阶位、关键词或正文..."',
                        f'placeholder="搜索{CLASS}技能、风格、阶位、关键词或正文..."')
    return head

FOOT_TEMPLATE = """
</main>

<script src="common.js"></script>
<script src="mark-colors.js"></script>
<script src="filter-panel.js"></script>
<script src="filter.js"></script>
<script>
createFilterController("__VIEW_ID__", "__PREFIX__");
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

# ============ 召唤师专用：列表驱动解析 ============

def docx_structure() -> dict:
    """解析 docx 结构：技能清单表 + 各风格/位阶在「段落流」中的区段（与 extract_paragraphs 同序）。

    直接解析 document.xml：段落流包含表格内段落（与 class_sync_core.extract_paragraphs 一致），
    表格事件记录其首段在流中的下标，从而与区段索引可比。
    """
    import zipfile
    import xml.etree.ElementTree as ET

    NS = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    with zipfile.ZipFile(DOCX) as z:
        tree = ET.fromstring(z.read('word/document.xml'))

    parents = {}
    for parent in tree.iter():
        for child in parent:
            parents[child] = parent

    def in_table(el) -> bool:
        cur = parents.get(el)
        while cur is not None:
            if cur.tag == NS + 'tbl':
                return True
            cur = parents.get(cur)
        return False

    def para_text(p) -> str:
        runs = []
        for r in p.iter(NS + 'r'):
            runs.append(''.join(t.text or '' for t in r.iter(NS + 't')))
        return ''.join(runs).strip()

    # 段落流：仅非空段落（与 class_sync_core.extract_paragraphs 完全同序）
    entries = []         # (元素, 文本)
    for p in tree.iter(NS + 'p'):
        t = para_text(p)
        if t:
            entries.append((p, t))
    stream = [t for _p, t in entries]
    idx_of = {p: i for i, (p, _t) in enumerate(entries)}
    is_top = {i: (not in_table(p)) for i, (p, _t) in enumerate(entries)}

    def rows_of_tbl(tbl):
        rows = []
        for tr in tbl.iter(NS + 'tr'):
            cells = []
            for tc in tr.iter(NS + 'tc'):
                txt = ''.join(t.text or '' for t in tc.iter(NS + 't'))
                cells.append(' '.join(txt.split()))
            if cells:
                rows.append(cells)
        return rows

    events = []          # (kind, payload, stream_idx)
    for child in tree.iter():
        if child.tag == NS + 'tbl':
            rows = rows_of_tbl(child)
            first_p = next((p for p in child.iter(NS + 'p')), None)
            events.append(('T', rows, idx_of.get(first_p, 0)))
    for p, t in entries:
        if is_top[idx_of[p]]:
            events.append(('P', t, idx_of[p]))
    events.sort(key=lambda e: e[2])

    lists: dict = {'starting': []}
    regions: dict = {}
    talents_start = None
    _holder = {'talents_start': None}
    starting_region = None
    style = tier = None
    tier_start = None

    def close_tier(end_idx):
        nonlocal tier_start
        if style and tier and tier_start is not None:
            regions[(style, tier)] = (tier_start, end_idx)
        tier_start = None

    for k, v, p_idx in events:
        if k == 'P':
            t = v
            if t == '起始特性':
                starting_region = p_idx
                continue
            if t == '召唤师天赋树':
                _holder['talents_start'] = p_idx
                close_tier(p_idx)
                if starting_region is not None:
                    regions[('起始特性', None)] = (starting_region, p_idx)
                style = tier = None
                continue
            if t.endswith('风格') and t[:-2] in STYLES:
                close_tier(p_idx)
                style, tier = t[:-2], None
                continue
            if re.match(r'^[一二三四五六七八]阶天赋树$', t):
                close_tier(p_idx)
                tier = t.split('天赋树')[0]
                tier_start = p_idx
                continue
            continue
        rows = v
        if not rows:
            continue
        flat = ' '.join(' '.join(r) for r in rows)
        is_list = len(rows) >= 2 and all(len(r) == 1 for r in rows) and '：' not in flat and len(flat) < 220
        if not is_list:
            continue
        names = [r[0] for r in rows]
        if style and tier and (style, tier) not in lists:
            lists[(style, tier)] = names
        elif (starting_region is not None and not lists['starting']
              and p_idx > starting_region and (_holder['talents_start'] is None or p_idx < _holder['talents_start'])):
            lists['starting'] = names
    close_tier(len(stream) - 1)
    return {'lists': lists, 'regions': regions, 'paras': stream}


def merge_blocks(primary: dict, extra: dict) -> dict:
    """合并同名技能的多个详情块（异能主块 + 天赋被动块）。"""
    out = dict(primary)
    out['fields'] = dict(primary['fields'])
    kws = [out['fields'].get('关键词', '')]
    if extra['fields'].get('关键词'):
        kws.append(extra['fields']['关键词'])
    out['fields']['关键词'] = ' / '.join([k for k in kws if k])
    for k2, v2 in extra['fields'].items():
        if k2 not in out['fields'] and v2:
            out['fields'][k2] = v2
    out['description'] = list(primary['description']) + list(extra['description'])
    out['level_upgrades'] = list(primary['level_upgrades']) + list(extra['level_upgrades'])
    out['mark_dots'] = list(primary['mark_dots'])
    for d in extra['mark_dots']:
        if d not in out['mark_dots']:
            out['mark_dots'].append(d)
    if not out.get('flavor') and extra.get('flavor'):
        out['flavor'] = extra['flavor']
    out['_merged_parts'] = 2
    return out


def collect_blocks() -> tuple[list[dict], dict[str, dict], dict]:
    """返回 (stubs, blocks, stats)：按 docx 清单顺序提取详情块，同名多块合并。"""
    import class_sync_core as C

    struct = docx_structure()
    paras = C.extract_paragraphs(DOCX)
    texts = [p['text'] for p in paras]
    all_names = set()
    for k, v in struct['lists'].items():
        all_names.update(v)
    all_names.update(LIST_ALIASES.values())

    stubs: list[dict] = []
    blocks: dict[str, dict] = {}
    stats = {'multi_block': [], 'missing': []}

    def extract_all(name: str, lo: int, hi: int) -> list[dict]:
        """区段内提取该技能的详情块。

        - 过滤「清单行」误判：清单行的下一段是另一个技能名，真详情块的下一段是字段行；
        - 保留主块（最高分）与不同类型头的附加块（异能主块 + 天赋被动块）。
        """
        cands = []
        for i in range(max(lo, 0), min(hi + 1, len(paras))):
            if texts[i] != name:
                continue
            nxt = texts[i + 1] if i + 1 < len(texts) else ''
            if nxt in all_names:      # 清单行 → 跳过
                continue
            b = C.extract_skill_block(paras, i, all_names)
            if b:
                cands.append(b)
        if not cands:
            return []
        cands.sort(key=C.block_score, reverse=True)
        best = cands[0]
        best_head = (best['fields'].get('关键词') or '').split('.')[0]
        keep = [best]
        for b in cands[1:]:
            head = (b['fields'].get('关键词') or '').split('.')[0]
            if head and head != best_head and b['description']:
                keep.append(b)
        return keep

    lo, hi = struct['regions'].get(('起始特性', None), (0, len(paras) - 1))
    for idx, name in enumerate(struct['lists'].get('starting', []), 1):
        bl = extract_all(name, lo, hi)
        if not bl:
            stats['missing'].append(name)
            continue
        block = bl[0]
        for extra in bl[1:]:
            block = merge_blocks(block, extra)
            stats['multi_block'].append(name)
        sid = f'{PREFIX}-starting-skill-{idx}'
        stubs.append({'id': sid, 'name': name, 'style': '', 'tier': '', 'type': 'starting'})
        blocks[sid] = block

    idx = 0
    for style in STYLES:
        for tier in TIER_ORDER:
            names = struct['lists'].get((style, tier), [])
            lo, hi = struct['regions'].get((style, tier), (0, len(paras) - 1))
            for name in names:
                probe = LIST_ALIASES.get(name, name)
                bl = extract_all(probe, lo, hi)
                if not bl and name in REUSE_FROM_OTHER:
                    idx += 1
                    sid = f'{PREFIX}-skill-{idx}'
                    stubs.append({'id': sid, 'name': probe, 'style': style, 'tier': tier,
                                  'reuse': REUSE_FROM_OTHER[name]})
                    continue
                if not bl:
                    stats['missing'].append(f'{style}/{tier}/{name}')
                    continue
                block = bl[0]
                if len(bl) > 1:
                    for extra in bl[1:]:
                        block = merge_blocks(block, extra)
                    stats['multi_block'].append(f'{style}/{tier}/{name}')
                idx += 1
                sid = f'{PREFIX}-skill-{idx}'
                stubs.append({'id': sid, 'name': probe, 'style': style, 'tier': tier})
                blocks[sid] = block
    return stubs, blocks, stats


def build_reused_block(name: str, src_cls: str) -> dict | None:
    """蓝焰术：docx 缺详情，按用户口径复用其他职业同名条目（法师版），职业名替换为召唤师。"""
    src_doc = json.loads((ROOT / '职业页' / '数据' / f'{src_cls}.json').read_text(encoding='utf-8'))
    src = next((s for s in src_doc['skills'] if s['name'] == name), None)
    if not src:
        return None
    block = {
        'name': name,
        'fields': dict(src.get('fields') or {}),
        'description': list(src.get('description') or []),
        'level_upgrades': list(src.get('level_upgrades') or []),
        'mark_dots': [c['color'] for c in (src.get('cost') or []) for _ in range(int(c.get('count') or 0))],
        'flavor': src.get('flavor') or '',
        'level_upgrade_choices': [],
        '_reused_from': src_cls,
    }
    for lu in block['level_upgrades']:
        for key in ('lines', 'text', 'class', 'label'):
            if isinstance(lu.get(key), str):
                lu[key] = lu[key].replace('法师', CLASS)
            elif isinstance(lu.get(key), list):
                lu[key] = [x.replace('法师', CLASS) if isinstance(x, str) else x for x in lu[key]]
    return block


def block_to_skill(stub: dict, block: dict) -> dict:
    fields = dict(block['fields'])
    if block['mark_dots']:
        fields['标识'] = ''.join('●' for _ in block['mark_dots'])
    fields.pop('费用', None)
    desc_body = [p for p in (block.get('description') or [])
                 if not p.startswith('限制：') and p.strip() != block['name']]
    if '描述' not in fields and desc_body:
        fields['描述'] = desc_body[0]
        description = desc_body[1:] if len(desc_body) > 1 else []
    else:
        description = split_skill_description(fields, desc_body)
    raw_tags = tags_from_keywords(fields.get('关键词', ''))
    tags: list[str] = []
    for t in raw_tags:
        for part in re.split(r'[/,，]', t):
            part = part.strip()
            if part and part not in tags:
                tags.append(part)
    _desc_for_tables = [p for p in filter_description_lines(block.get('description') or [])
                        if p.strip() and p.strip() != block['name']]
    unit_tables = [parse_unit_block(b['lines']) for b in detect_unit_blocks(_desc_for_tables)]
    roll_tables = collect_roll_rows(_desc_for_tables)
    skill = {
        'id': stub['id'],
        'name': block['name'],
        'tags': tags,
        'fields': fields,
        'cost': cost_json(block['mark_dots']),
        'unit_tables': unit_tables,
        'roll_tables': roll_tables,
        'description': description,
        'level_upgrades': block['level_upgrades'],
        'flavor': block['flavor'],
    }
    if stub.get('type') == 'starting':
        skill['type'] = 'starting'
    else:
        skill['style'] = stub['style']
        skill['tier'] = stub['tier']
    if block.get('_merged_parts'):
        skill['merged_parts'] = block['_merged_parts']
    return skill


def build_skill_list() -> tuple[list[dict], dict[str, dict], dict]:
    stubs, blocks, stats = collect_blocks()
    reused: list[str] = []
    for stub in stubs:
        if 'reuse' in stub:
            src_cls, _style, _tier = stub['reuse']
            block = build_reused_block(stub['name'], src_cls)
            if block:
                blocks[stub['id']] = block
                reused.append(stub['name'])
    stats['reused'] = reused
    skills: list[dict] = []
    for stub in stubs:
        block = blocks.get(stub['id'])
        if not block:
            continue
        skills.append(block_to_skill(stub, block))
    return skills, blocks, stats


def main() -> None:
    skills, blocks, stats = build_skill_list()
    by_style_tier: dict[str, int] = defaultdict(int)
    for s in skills:
        if s.get('type') != 'starting':
            by_style_tier[f"{s['style']}/{s['tier']}"] += 1

    doc = {'id': CLASS, 'name': CLASS, 'skills': skills}
    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding='utf-8')

    fx_doc = {CLASS: [json_to_fx_entry(s, CLASS) for s in skills]}
    FX.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding='utf-8')

    head = read_head()
    nav = render_nav(skills)
    content = render_content(skills, blocks)
    foot = FOOT_TEMPLATE.replace("__VIEW_ID__", VIEW_ID).replace("__PREFIX__", PREFIX)
    page = (
        head
        + f'    <nav aria-label="{CLASS}天赋索引">\n      <div class="nav-inner">\n'
        + nav
        + "\n      </div>\n    </nav>\n    <div class=\"content\">\n"
        + content
        + "\n    </div>\n"
        + foot
    )
    HTML.write_text(page, encoding='utf-8')

    for src, dst in (
        (DATA, ROOT / 'electron-app' / '职业页' / '数据' / f'{CLASS}.json'),
        (FX, ROOT / 'electron-app' / '斯诺德跑团' / f'skill_effects_{CLASS}.json'),
        (HTML, ROOT / 'electron-app' / '职业页' / f'{CLASS}.html'),
    ):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    print(json.dumps({
        'class': CLASS,
        'skills': len(skills),
        'starting': sum(1 for s in skills if s.get('type') == 'starting'),
        'talent': sum(1 for s in skills if s.get('type') != 'starting'),
        'by_style_tier': dict(sorted(by_style_tier.items())),
        'multi_block_merged': stats['multi_block'],
        'reused_from_other_class': stats['reused'],
        'missing': stats['missing'],
        'features': [f['name'] for f in extract_class_features()['features']],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
