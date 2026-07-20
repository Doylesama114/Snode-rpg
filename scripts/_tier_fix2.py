"""Fix tier placement: move misplaced articles from 七阶 to correct tiers."""

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Correct tier for each talent
tier_map = {
    '猛火':'四阶天赋树', '剧毒物质':'四阶天赋树', '深度创伤':'四阶天赋树',
    '稳固经济':'五阶天赋树', '兢业玩家':'五阶天赋树', '英雄弧光':'五阶天赋树',
    '深渊呢喃':'五阶天赋树', '八毫米':'五阶天赋树', '哟吼船长的藏宝图':'五阶天赋树',
    '饥饿游戏':'六阶天赋树', '回避身形':'六阶天赋树', '唤醒':'六阶天赋树',
    '信手拈来':'六阶天赋树', '超体':'六阶天赋树', '表演型人格':'六阶天赋树',
    '使命必达':'六阶天赋树', '利见大人':'六阶天赋树',
    '冲击之铠':'七阶天赋树', '对策治疗':'七阶天赋树', '序幕的勋章':'七阶天赋树',
    '最佳状态':'七阶天赋树', '盛大登场':'七阶天赋树', '掷骰狂人':'七阶天赋树',
    '气定神闲':'七阶天赋树', '裁决者':'七阶天赋树', '极速者':'七阶天赋树',
    '召唤大师':'七阶天赋树', '伤害阈值':'七阶天赋树', '火中人':'七阶天赋树',
    '蛇之手':'七阶天赋树', '渴血者':'七阶天赋树', '同花顺':'七阶天赋树',
    '光明与黑暗':'七阶天赋树', '俱乐部达人':'七阶天赋树',
    '以刃承伤':'七阶天赋树', '魔力偏转':'七阶天赋树', '化险为夷':'七阶天赋树',
    '神圣干涉':'七阶天赋树',
}

# Step 1: Find tier-list boundaries
tier_start = {}  # tier_name -> line_index of tier-list opening
tier_close = {}  # tier_name -> line_index of tier-list closing

current_tier = None
for i, line in enumerate(lines):
    if '<h3>' in line and '阶天赋树' in line:
        import re
        m = re.search(r'<h3>([^<]+)', line)
        if m: current_tier = m.group(1)
    if '<div class="tier-list">' in line and current_tier:
        tier_start[current_tier] = i
    # Find closing: </div> followed by either <h3>, </section>, or another </div>
    if current_tier and current_tier in tier_start and i > tier_start[current_tier] and '</div>' in line:
        # Check next line to confirm this closes the tier-list
        next_line = lines[i+1].strip() if i+1 < len(lines) else ''
        if '</div>' in next_line or '</section>' in next_line or '<h3>' in next_line:
            tier_close[current_tier] = i

# Print found tiers
print('Tier structure:')
for t in ['一阶天赋树','二阶天赋树','三阶天赋树','四阶天赋树','五阶天赋树','六阶天赋树','七阶天赋树']:
    s = tier_start.get(t, -1)
    c = tier_close.get(t, -1)
    print('  %s: start=%d close=%d' % (t, s, c))

# Step 2: Find articles in 七阶 that should be in lower tiers
# The 七阶 tier spans lines tier_start to tier_close
qijie_start = tier_start.get('七阶天赋树', -1)
qijie_close = tier_close.get('七阶天赋树', -1)

# Extract article blocks from 七阶
articles_to_move = []
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if qijie_start <= i <= qijie_close and '<article class="skill" id="g-skill-' in line:
        # Check if this article contains any of our target talents
        found = None
        for name in tier_map:
            if name in line and tier_map[name] != '七阶天赋树':
                found = name
                break
        if found:
            articles_to_move.append((found, tier_map[found], line))
            i += 1
            continue
    new_lines.append(line)
    i += 1

print('\nArticles to move: %d' % len(articles_to_move))
for name, tier, block in articles_to_move:
    print('  %s -> %s' % (name, tier))

# Step 3: Insert articles into correct tiers
# For each tier, insert articles before the closing </div>
for tier in ['四阶天赋树','五阶天赋树','六阶天赋树']:
    tier_articles = [(n, b) for n, t, b in articles_to_move if t == tier]
    if not tier_articles: continue
    
    insert_pos = tier_close[tier]
    print('\nInserting %d articles into %s (before line %d)' % (len(tier_articles), tier, insert_pos))
    
    # Insert before the closing line, reversing to maintain order
    for name, block in reversed(tier_articles):
        new_lines.insert(insert_pos + 1, block)

# Step 4: Write back
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

# Step 5: Verify
print('\nVerification:')
verify_html = ''.join(new_lines)
for name in tier_map:
    count = verify_html.count(name)
    if count == 0:
        print('  MISSING: %s' % name)
    elif count > 1:
        print('  DUPLICATE: %s (%d times)' % (name, count))

# Check tier placement
print('\nTier placement check:')
current = '?'
for line in new_lines:
    if '<h3>' in line and '阶天赋树' in line:
        current = line.split('<h3>')[1].split('</h3>')[0]
    for name in tier_map:
        if name in line and '<h4>' in line:
            correct = tier_map[name]
            ok = 'OK' if current == correct else 'WRONG (in %s, should be %s)' % (current, correct)
            print('  %s | %s | %s' % (current.ljust(10), name, ok))
