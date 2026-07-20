import re

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find tier boundaries by looking for <h3> and <div class="tier-list"> lines
tier_start = {}  # tier_name -> line_index of <div class="tier-list">
tier_end = {}    # tier_name -> line_index of closing </div>

current_tier = None
for i, line in enumerate(lines):
    if '<h3>' in line:
        m = re.search(r'<h3>([^<]+)', line)
        if m and '阶天赋树' in m.group(1):
            current_tier = m.group(1)
    if current_tier and '<div class="tier-list">' in line:
        tier_start[current_tier] = i
    if current_tier and '</div>' in line and i > tier_start.get(current_tier, 0):
        # Find the closing </div> that ends this tier-list (next line has <h3> or end of section)
        next_is_h3 = (i+1 < len(lines) and '<h3>' in lines[i+1])
        next_is_section_end = (i+1 < len(lines) and '</section>' in lines[i+1])
        if next_is_h3 or next_is_section_end or '</div>' in lines[i+1]:
            tier_end[current_tier] = i
            current_tier = None

print('Tier boundaries found:')
for t in sorted(tier_start.keys()):
    print('  %s: lines %d-%d' % (t, tier_start[t], tier_end.get(t, -1)))

# Current state: all articles are after 七阶 in one flat list
# Map talents to tiers
tier_map = {
    '猛火':None, '剧毒物质':None, '深度创伤':None,
    '稳固经济':None, '兢业玩家':None, '英雄弧光':None,
    '深渊呢喃':None, '八毫米':None, '哟吼船长的藏宝图':None,
    '饥饿游戏':None, '回避身形':None, '唤醒':None,
    '信手拈来':None, '超体':None, '表演型人格':None,
    '使命必达':None, '利见大人':None,
    '冲击之铠':None, '对策治疗':None, '序幕的勋章':None,
    '最佳状态':None, '盛大登场':None, '掷骰狂人':None,
    '气定神闲':None, '裁决者':None, '极速者':None,
    '召唤大师':None, '伤害阈值':None, '火中人':None,
    '蛇之手':None, '渴血者':None, '同花顺':None,
    '光明与黑暗':None, '俱乐部达人':None,
    '以刃承伤':None, '魔力偏转':None, '化险为夷':None,
    '神圣干涉':None,
}

# Correct tier for each
correct_tier = {
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

# Find where each article is
for i, line in enumerate(lines):
    if '<h4>' not in line: continue
    for name in tier_map:
        if name in line:
            tier_map[name] = i
            break

# Print current positions
print('\nCurrent positions:')
for name in sorted(tier_map.keys(), key=lambda n: tier_map[n] or 9999):
    print('  [%d] %s -> %s' % (tier_map[name], name, correct_tier.get(name, '?')))

# Count how many are in wrong tier
wrong = 0
for name, pos in tier_map.items():
    if pos is None: continue
    correct = correct_tier.get(name, '?')
    # Determine which tier this position falls in
    actual_tier = '?'
    for t in sorted(tier_start.keys(), reverse=True):
        if pos > tier_start[t]:
            actual_tier = t
            break
    if actual_tier != correct:
        wrong += 1
        print('MISPLACED: %s at line %d (in %s, should be %s)' % (name, pos, actual_tier, correct))

print('\nTotal misplaced: %d' % wrong)
