"""Simplified fix: move ONLY 四/五/六阶 articles, leave 七阶 alone."""

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Talents that need to move (not in 七阶)
to_move = {
    '猛火':'四阶天赋树', '剧毒物质':'四阶天赋树', '深度创伤':'四阶天赋树',
    '稳固经济':'五阶天赋树', '兢业玩家':'五阶天赋树', '英雄弧光':'五阶天赋树',
    '深渊呢喃':'五阶天赋树', '八毫米':'五阶天赋树', '哟吼船长的藏宝图':'五阶天赋树',
    '饥饿游戏':'六阶天赋树', '回避身形':'六阶天赋树', '唤醒':'六阶天赋树',
    '信手拈来':'六阶天赋树', '超体':'六阶天赋树', '表演型人格':'六阶天赋树',
    '使命必达':'六阶天赋树', '利见大人':'六阶天赋树',
}

# Find tier boundaries (tier-list start and end line)
tier_start = {}
tier_end = {}
current_tier = None
for i, line in enumerate(lines):
    if '<h3>' in line and '阶天赋树' in line:
        import re
        m = re.search(r'<h3>([^<]+)', line)
        if m: current_tier = m.group(1)
    if current_tier and '<div class="tier-list">' in line:
        tier_start[current_tier] = i
    if current_tier and current_tier in tier_start and i > tier_start[current_tier]:
        if '</div>' in line and i+1 < len(lines):
            next_line = lines[i+1].strip()
            if '</div>' in next_line or '<h3>' in next_line or '</section>' in next_line:
                tier_end[current_tier] = i

print('Tier boundaries:')
for t in ['四阶天赋树','五阶天赋树','六阶天赋树','七阶天赋树']:
    print('  %s: L%d-L%d' % (t, tier_start.get(t,-1), tier_end.get(t,-1)))

# Extract articles to move from the 七阶 tier area
q7_end = tier_end.get('七阶天赋树', 9999)
extracted = []
keep_lines = []
for i, line in enumerate(lines):
    should_keep = True
    if i <= q7_end and '<article class="skill"' in line and '<h4>' in line:
        for name in to_move:
            if name in line:
                extracted.append((name, to_move[name], line))
                should_keep = False
                break
    if should_keep:
        keep_lines.append(line)

print('\nExtracted: %d articles' % len(extracted))
for name, tier, _ in extracted:
    print('  %s -> %s' % (name, tier))

# Insert into correct tiers (before closing </div>)
for tier in ['四阶天赋树','五阶天赋树','六阶天赋树']:
    tier_arts = [(n, b) for n, t, b in extracted if t == tier]
    if not tier_arts: continue
    insert_at = tier_end[tier]
    print('\nInserting %d into %s at line %d' % (len(tier_arts), tier, insert_at))
    for name, block in reversed(tier_arts):
        keep_lines.insert(insert_at + 1, block)

# Write
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.writelines(keep_lines)

# Verify
html = ''.join(keep_lines)
dupes = 0
for name in to_move:
    c = html.count(name)
    if c != 1:
        print('ISSUE: %s appears %d times' % (name, c))
        dupes += 1

print('\nDuplicates: %d' % dupes)
print('Total lines: %d -> %d' % (len(lines), len(keep_lines)))
