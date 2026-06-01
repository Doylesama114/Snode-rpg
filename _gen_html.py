#!/usr/bin/env python3
"""
Generate 魔契师.html from 魔契师.json.
Produces a self-contained HTML page with skill cards, navigation, filter/search.
"""
import json

# Load data
with open('职业页/数据/魔契师.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

skills = data['skills']
class_name = data['name']

# Order skills by style and tier
style_order = ['起始特性', '魔契', '邪念', '咒能', '秘术']
tier_order = ['起始特性', '一阶', '二阶', '三阶', '四阶']

import re

def sort_key(s):
    si = style_order.index(s['style']) if s['style'] in style_order else 99
    ti = tier_order.index(s['tier']) if s['tier'] in tier_order else 99
    # Extract numeric part of ID for correct ordering
    m = re.search(r'\d+', s['id'])
    id_num = int(m.group()) if m else 0
    return (si, ti, id_num)

skills_sorted = sorted(skills, key=sort_key)

# ======== GENERATE HTML ========

def cost_to_html(cost_list):
    """Generate cost dots HTML from cost array"""
    parts = []
    for c in cost_list:
        color = c['color']
        name = c.get('name', '')
        # Determine if light color (needs text-shadow)
        light_colors = {'#FFFFFF', '#D9D9D9', '#FFB7E3', '#00FA99', '#FFF32F', '#00B0F0'}
        if color.upper() in light_colors:
            style = f'font-size:1.5em;color:{color};text-shadow:0 0 1.5px #000,0 0 1.5px #000,0 0 1.5px #000,0 0 1.5px #000'
        else:
            style = f'font-size:1.5em;color:{color}'
        parts.append(f'<span style="{style}">●</span>')
    return ''.join(parts)

def get_field_order(skill):
    """Return ordered list of field keys for display"""
    fields = skill.get('fields', {})
    standard_order = ['前置条件', '额外条件', '施展时间', '施展距离', '持续时间', '疲劳消耗', '施展条件', '施展限制']
    result = []
    for key in standard_order:
        if key in fields:
            result.append(key)
    # Add any remaining keys not in standard order
    for key in fields:
        if key not in result:
            result.append(key)
    return result

def get_data_search(skill):
    """Build data-search attribute value"""
    parts = [skill['name'], skill['style'], skill['tier']]
    # Add field values
    for key in get_field_order(skill):
        val = skill['fields'].get(key, '')
        if val and val != '-':
            parts.append(val)
    return ' '.join(parts)

def generate_skill_card(skill):
    """Generate HTML for a single skill card"""
    name = skill['name']
    style = skill['style']
    tier = skill['tier']
    tags = skill.get('tags', [])
    fields = skill.get('fields', {})
    desc = skill.get('description', [])
    cost = skill.get('cost', [])
    level_ups = skill.get('level_upgrades', [])
    flavor = skill.get('flavor', '')
    
    skill_id = skill['id']
    data_search = get_data_search(skill)
    
    html = []
    html.append(f'      <article class="skill" id="{skill_id}" data-search="{data_search}">')
    
    # Title with style tier chip
    if style == '起始特性':
        chip_text = f'{style}'
    else:
        chip_text = f'{style} · {tier}'
    html.append(f'        <h4>{name} <span class="chip" style="background:#888">{chip_text}</span></h4>')
    
    # Tags
    if tags:
        html.append(f'        <div class="chips">')
        for tag in tags:
            html.append(f'          <span class="chip">{tag}</span>')
        html.append(f'        </div>')
    
    # Detail section
    html.append(f'        <div class="detail">')
    
    # Fields
    field_keys = get_field_order(skill)
    for key in field_keys:
        val = fields[key]
        html.append(f'          <p><span class="field">{key}：</span>{val}</p>')
    
    # Cost
    if cost:
        html.append(f'          <p><span class="field">费用：</span>{cost_to_html(cost)}</p>')
    
    # Description
    if desc:
        for dline in desc:
            if dline.strip():
                html.append(f'          <p>{dline}</p>')
    
    # Level upgrades
    for lu in level_ups:
        level = lu['level']
        text = lu['text']
        html.append(f'          <p><span class="field">你的魔契师职业等级到达{level}级时：</span>{text}</p>')
    
    html.append(f'        </div>')
    html.append(f'      </article>')
    
    return '\n'.join(html)

def generate_nav():
    """Generate the navigation sidebar"""
    html = []
    
    # Starting section
    html.append('<a class="style-link" href="#p-starting">起始特性</a>')
    html.append('<a class="adv-link" href="魔契师·进阶.html">→ 查看进阶途径</a>')
    
    # Group starting skills
    starting = [s for s in skills_sorted if s['style'] == '起始特性']
    if starting:
        html.append('<div class="tier-list">')
        for s in starting:
            html.append(f'<a class="skill-link" href="#{s["id"]}">{s["name"]}</a>')
        html.append('</div>')
    
    # Style groups
    for style_name in ['魔契', '邪念', '咒能', '秘术']:
        style_skills = [s for s in skills_sorted if s['style'] == style_name]
        if not style_skills:
            continue
        
        html.append(f'<details class="nav-group"><summary class="style-summary"><a href="#p-style-{style_name}">{style_name}风格</a></summary>')
        
        # Tiers within style
        for tier_name in ['一阶', '二阶', '三阶', '四阶']:
            tier_skills = [s for s in style_skills if s['tier'] == tier_name]
            if not tier_skills:
                continue
            
            tier_short = {'一阶': '一', '二阶': '二', '三阶': '三', '四阶': '四'}[tier_name]
            html.append(f'<details class="nav-tier"><summary class="tier-summary"><a href="#p-tier-{style_name}-{tier_short}">{tier_name}天赋树</a></summary>')
            for s in tier_skills:
                html.append(f'<a class="skill-link" href="#{s["id"]}">{s["name"]}</a>')
            html.append('</details>')
        
        html.append('</details>')
    
    return '\n'.join(html)

def generate_content():
    """Generate the main content area with all skill cards"""
    html = []
    
    current_style = None
    current_tier = None
    
    for skill in skills_sorted:
        style = skill['style']
        tier = skill['tier']
        
        # Start new style section
        if style != current_style:
            if current_style is not None:
                html.append('</section>')
            html.append(f'<section class="style" id="p-style-{style}">')
            current_style = style
            current_tier = None
        
        # Start new tier section
        if tier != current_tier:
            if style != '起始特性':
                tier_short = {'一阶': '一', '二阶': '二', '三阶': '三', '四阶': '四'}.get(tier, tier)
                html.append(f'<div class="tier-section" id="p-tier-{style}-{tier_short}"><h3 class="tier-title">{tier}天赋树</h3></div>')
            current_tier = tier
        
        html.append(generate_skill_card(skill))
    
    if current_style is not None:
        html.append('</section>')
    
    return '\n'.join(html)

# ======== FULL HTML OUTPUT ========

full_html = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>魔契师 · 斯诺德职业技能索引</title>
<link rel="stylesheet" href="common.css"/>
<style>
    body {{ background: var(--bg); }}
    .class-view {{ display: block !important; }}
    .view-home {{ display: none !important; }}

    .adv-link {{
        display: block;
        margin: 14px 0;
        padding: 16px 20px;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--red), #c0392b);
        color: #fff !important;
        text-decoration: none;
        font-weight: 900;
        font-size: 18px;
        text-align: center;
        letter-spacing: 2px;
        box-shadow: 0 3px 12px rgba(157,47,47,0.4);
        transition: transform 0.15s, box-shadow 0.15s;
    }}
    .adv-link:hover {{
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(157,47,47,0.5);
    }}
</style>

</head>
<body>

<a href="首页.html" class="back-btn">← 返回</a>
<header><div class="topbar"><div><h1>魔契师天赋索引</h1><p class="subtitle">魔契 · 邪念 · 咒能 · 秘术风格 · 一至二阶 · 技能详情 · 关键词搜索</p></div>
<label class="searchbox"><input id="pt-search" type="search" placeholder="搜索技能、风格、阶位、关键词或正文..." autocomplete="off" /></label>
</div></header><main>
<nav aria-label="魔契师天赋索引">
<div class="nav-inner"><div class="filter-bar" id="pt-filter-bar"></div>
{generate_nav()}
</div>
</nav><div class="content">
{generate_content()}
</div>
</main>

<script src="common.js"></script>
<script src="filter.js"></script>
<script>
(function() {{
    const ctrl = createFilterController('view-pact', 'pt');
}})();
</script>
</body>
</html>'''

# Write to file
output_path = '职业页/魔契师.html'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(full_html)

print(f'Generated {output_path}')
print(f'Skills: {len(skills_sorted)}')
