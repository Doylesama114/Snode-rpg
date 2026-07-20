"""Cut articles from 七阶 (L3191-3734), paste into correct tiers (before closing </div>)."""

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Tier closing </div> lines (where to insert BEFORE)
tier_end_lines = {
    '四阶天赋树': 2446,
    '五阶天赋树': 2802,
    '六阶天赋树': 3185,
}

# Correct tier for each talent
tier_map = {
    '猛火':'四阶天赋树', '剧毒物质':'四阶天赋树', '深度创伤':'四阶天赋树',
    '稳固经济':'五阶天赋树', '兢业玩家':'五阶天赋树', '英雄弧光':'五阶天赋树',
    '深渊呢喃':'五阶天赋树', '八毫米':'五阶天赋树', '哟吼船长的藏宝图':'五阶天赋树',
    '饥饿游戏':'六阶天赋树', '回避身形':'六阶天赋树', '唤醒':'六阶天赋树',
    '信手拈来':'六阶天赋树', '超体':'六阶天赋树', '表演型人格':'六阶天赋树',
    '使命必达':'六阶天赋树', '利见大人':'六阶天赋树',
}

# Step 1: Find and extract each article line (they are on single long lines)
# 七阶 tier is from line 3191 to 3734
# Scan lines 3191-3734 for articles containing target talent names in their h4

to_cut = {}  # line_number -> (name, tier, line_content)
for i in range(3191, min(3735, len(lines))):
    line = lines[i]
    if '<h4>' not in line: continue
    for name in tier_map:
        if name in line:
            to_cut[i] = (name, tier_map[name], line)
            break

print('Found %d articles to move:' % len(to_cut))
for lno, (name, tier, _) in sorted(to_cut.items()):
    print('  L%d: %s -> %s' % (lno, name, tier))

# Step 2: Remove these lines (work backwards to maintain indices)
new_lines = []
for i, line in enumerate(lines):
    if i in to_cut:
        continue  # skip
    new_lines.append(line)

# Step 3: Insert each article before its tier's closing </div>
# First, adjust insert positions: since we removed lines, indices have shifted
# Calculate how many lines were removed before each tier end
removed_before = {}
for tier in tier_end_lines:
    end_line = tier_end_lines[tier]
    removed = sum(1 for lno in to_cut if lno < end_line)
    removed_before[tier] = removed

# Sort articles by tier, then insert (in reverse order within each tier to maintain order)
cuts_by_tier = {}
for lno, (name, tier, content) in to_cut.items():
    if tier not in cuts_by_tier: cuts_by_tier[tier] = []
    cuts_by_tier[tier].append((name, content))

for tier in ['四阶天赋树','五阶天赋树','六阶天赋树']:
    if tier not in cuts_by_tier: continue
    arts = cuts_by_tier[tier]
    # Insert position = original_end_line - lines_removed_before_this_point
    insert_at = tier_end_lines[tier] - removed_before.get(tier, 0)
    print('\nInserting %d into %s at adjusted line %d' % (len(arts), tier, insert_at))
    for name, content in reversed(arts):
        new_lines.insert(insert_at, content)

# Step 4: Fix data-tier in moved articles (if needed)
# Articles originally had data-tier="七阶" — change to correct tier
tier_cn = {'四阶天赋树':'四阶','五阶天赋树':'五阶','六阶天赋树':'六阶','七阶天赋树':'七阶'}
for i, line in enumerate(new_lines):
    if '<article class="skill"' in line and 'data-tier=' in line:
        for name, tier in tier_map.items():
            if name in line:
                new_tier = tier_cn.get(tier, '?')
                # Replace data-tier="..." with correct tier
                import re
                old_data_tier = re.search(r'data-tier="([^"]+)"', line)
                if old_data_tier and old_data_tier.group(1) != new_tier:
                    line = line.replace('data-tier="%s"' % old_data_tier.group(1), 'data-tier="%s"' % new_tier)
                new_lines[i] = line

# Write
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

# Verify
html = ''.join(new_lines)
vcount = 0
for name in tier_map:
    c = html.count(name)
    if c > 1:
        vcount += c - 1
        print('DUPE: %s (%d)' % (name, c))
print('\nVerification issues: %d, Lines: %d -> %d' % (vcount, len(lines), len(new_lines)))
