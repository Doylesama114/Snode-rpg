#!/usr/bin/env python3
"""Move newly-added talents from 七阶 to correct tiers."""
import re, sys, io
# Force UTF-8 for stdout on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HTML_PATH = r'D:\Download\scholar-agent-main\职业页\通用天赋树.html'

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    html = f.read()

# --- Tier mapping from docx ground truth ---
# Key = talent name as it appears in the HTML h4
MOVE_MAP = {
    '猛火': '四',
    '剧毒物质': '四',
    '深度创伤': '四',
    '稳固经济': '五',
    '兢业玩家': '五',        # HTML has old name, docx says 功利玩家
    '功利玩家': '五',        # just in case
    '英雄弧光': '五',
    '深渊呢喃': '五',
    '八毫米': '五',
    '哟吼船长的藏宝图': '五',
    '饥饿游戏': '六',
    '回避身形': '六',
    '唤醒': '六',
    '信手拈来': '六',
    '超体': '六',
    '表演型人格': '六',
    '使命必达': '六',
    '利见大人': '六',
}

# Names that STAY in 七阶 (non-抉择, non-structural)
STAYING_7 = {
    '冲击之铠', '对策治疗', '序幕的勋章', '最佳状态', '盛大登场',
    '掷骰狂人', '气定神闲', '裁决者', '极速者', '召唤大师',
    '伤害阈值', '火中人', '蛇之手', '渴血者', '同花顺',
    '光明与黑暗', '俱乐部达人', '以刃承伤', '魔力偏转',
    '化险为夷', '神圣干涉',
}

# Names that should have their tier label corrected inside the h4
# (structural articles with explicit tier text)
# These are recognized by having '抉择' in name or being structural
# They should not be moved

# --- Step 1: Find all tier sections ---
tier_order = ['一', '二', '三', '四', '五', '六', '七']
tier_sections = {}  # tier_num -> {'tier_list_start': int, 'tier_list_end': int}

for tier in tier_order:
    h3_marker = f'<h3>{tier}阶天赋树</h3>'
    h3_pos = html.find(h3_marker)
    if h3_pos == -1:
        print(f'WARNING: {tier}阶 not found!')
        continue
    
    tier_list_start = html.find('<div class="tier-list">', h3_pos)
    if tier_list_start == -1:
        print(f'WARNING: tier-list div not found for {tier}阶')
        continue
    tier_list_start += len('<div class="tier-list">')
    
    next_section = html.find('<section class="style"', h3_pos + len(h3_marker))
    if next_section == -1:
        next_section = len(html)
    
    section_end = html.find('</section>', tier_list_start)
    if section_end == -1:
        section_end = next_section
    
    tier_list_end = html.rfind('</div>', tier_list_start, section_end)
    if tier_list_end == -1:
        tier_list_end = section_end
    
    tier_sections[tier] = {
        'tier_list_start': tier_list_start,
        'tier_list_end': tier_list_end,
    }

# --- Step 2: Extract articles by tier ---
def extract_articles_in_range(html, start_pos, end_pos):
    """Extract full <article>...</article> blocks."""
    articles = []
    pos = start_pos
    while pos < end_pos:
        article_start = html.find('<article class="skill"', pos)
        if article_start == -1 or article_start >= end_pos:
            break
        article_end = html.find('</article>', article_start)
        if article_end == -1:
            break
        article_end += len('</article>')
        
        h4_match = re.search(r'<h4>([^<]+)', html[article_start:article_end])
        name = h4_match.group(1).strip() if h4_match else 'UNKNOWN'
        
        articles.append({
            'name': name,
            'html': html[article_start:article_end],
            'start': article_start,
            'end': article_end,
        })
        pos = article_end
    return articles

tier_articles = {}
for tier, info in tier_sections.items():
    tier_articles[tier] = extract_articles_in_range(
        html, info['tier_list_start'], info['tier_list_end']
    )

# --- Step 3: Identify misplaced articles in 七阶 ---
seven_articles = tier_articles.get('七', [])
to_move = {}  # target_tier -> [article_dicts]
move_count = 0

for article in seven_articles:
    name = article['name']
    if name in STAYING_7:
        continue
    target = MOVE_MAP.get(name)
    if target:
        if target not in to_move:
            to_move[target] = []
        to_move[target].append(article.copy())
        move_count += 1

print(f'Total articles to move: {move_count}')
for tier in tier_order:
    if tier in to_move:
        names = [a['name'] for a in to_move[tier]]
        print(f'  → {tier}阶 ({len(to_move[tier])}): {", ".join(names)}')

# --- Step 4: Rebuild HTML ---
result = html

# 4a. Remove all articles to move from 七阶 (high-to-low position to preserve indices)
all_to_remove = []
for articles in to_move.values():
    all_to_remove.extend(articles)
all_to_remove.sort(key=lambda a: a['start'], reverse=True)

for article in all_to_remove:
    # Remove from start of line to end of line after </article>
    line_start = result.rfind('\n', 0, article['start']) + 1
    line_end = result.find('\n', article['end'])
    if line_end == -1:
        line_end = len(result)
    result = result[:line_start] + result[line_end:]

# 4b. Insert articles into correct tiers (insert BEFORE tier-list closing </div>)
# Process higher tiers first to keep positions stable (or from end to start)
# Actually all insertions are in DIFFERENT tiers, so order doesn't matter
for target_tier in tier_order:
    if target_tier not in to_move:
        continue
    
    h3_marker = f'<h3>{target_tier}阶天赋树</h3>'
    h3_pos = result.find(h3_marker)
    
    # Find tier-list closing </div> — the one right before </section>
    section_end = result.find('</section>', h3_pos)
    tier_list_close = result.rfind('</div>', h3_pos, section_end)
    
    if tier_list_close == -1:
        print(f'ERROR: cannot find tier-list close for {target_tier}阶')
        continue
    
    # Build insertion text
    insert_lines = []
    for article in to_move[target_tier]:
        insert_lines.append(article['html'])
    
    insert_text = '\n' + '\n'.join(insert_lines)
    
    # Insert before tier_list_close
    result = result[:tier_list_close] + insert_text + '\n' + result[tier_list_close:]

# --- Step 5: Update tier labels and fix name ---
# 5a. Update tier chip from 七阶 → correct tier
for target_tier, articles in to_move.items():
    for article in articles:
        old_html = article['html']
        
        # Replace tier chip: <span class="chip" style="background:#888">七阶</span>
        old_chip = '<span class="chip" style="background:#888">七阶</span>'
        new_chip = f'<span class="chip" style="background:#888">{target_tier}阶</span>'
        
        if old_chip in old_html:
            new_html = old_html.replace(old_chip, new_chip)
            # Replace in result
            if old_html in result:
                result = result.replace(old_html, new_html)
            else:
                # The article text might have whitespace differences, try the new one
                if new_html.replace(old_chip, new_chip) != new_html:
                    pass  # already done
            print(f'  Tier label: {article["name"]} 七阶 → {target_tier}阶')

# 5b. Fix name: 兢业玩家 → 功利玩家 (per docx correction)
# This only applies to the one article that has this name
if '兢业玩家' in result:
    # Replace in h4 only
    result = result.replace('<h4>兢业玩家', '<h4>功利玩家')
    # Also in data-search value (the name appears in the search string)
    result = result.replace('data-search="兢业玩家', 'data-search="功利玩家')
    print('Fixed name: 兢业玩家 → 功利玩家')

# --- Step 6: Verify the result ---
# Count articles per tier
print('\n=== VERIFICATION ===')
for tier in tier_order:
    h3_marker = f'<h3>{tier}阶天赋树</h3>'
    h3_pos = result.find(h3_marker)
    tier_list_start = result.find('<div class="tier-list">', h3_pos)
    section_end = result.find('</section>', h3_pos)
    tier_list_close = result.rfind('</div>', tier_list_start, section_end)
    
    articles = extract_articles_in_range(result, tier_list_start + len('<div class="tier-list">'), tier_list_close)
    print(f'{tier}阶: {len(articles)} articles')

# Check for moved articles in correct tiers
print('\n=== MOVED ARTICLES CHECK ===')
for target_tier, articles in to_move.items():
    h3_marker = f'<h3>{target_tier}阶天赋树</h3>'
    h3_pos = result.find(h3_marker)
    tier_list_start = result.find('<div class="tier-list">', h3_pos)
    section_end = result.find('</section>', h3_pos)
    tier_list_close = result.rfind('</div>', tier_list_start, section_end)
    
    section_content = result[tier_list_start + len('<div class="tier-list">'):tier_list_close]
    for article in articles:
        name = article['name']
        # Fix name for check
        check_name = '功利玩家' if name == '兢业玩家' else name
        if check_name in section_content:
            print(f'  [OK] {check_name} found in {target_tier}阶')
        else:
            print(f'  [MISSING] {check_name} NOT found in {target_tier}阶!')

# Check for duplicates
article_ids = re.findall(r'id="(g-skill-\d+)"', result)
id_counts = {}
for aid in article_ids:
    id_counts[aid] = id_counts.get(aid, 0) + 1
dups = {k: v for k, v in id_counts.items() if v > 1}
if dups:
    print(f'\n[WARN] DUPLICATE IDs: {dups}')
else:
    print(f'\n[OK] No duplicate IDs ({len(article_ids)} total)')

# --- Write result ---
with open(HTML_PATH, 'r', encoding='utf-8') as f:
    original = f.read()

if result != original:
    with open(HTML_PATH, 'w', encoding='utf-8') as f:
        f.write(result)
    print('\n=== FILE WRITTEN ===')
else:
    print('\n=== NO CHANGES ===')

print(f'Size: {len(original)} → {len(result)} bytes')
