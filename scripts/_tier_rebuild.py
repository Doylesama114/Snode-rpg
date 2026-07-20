"""Rebuild: extract all articles, sort by tier, rewrite into correct tier-lists."""

import re

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find all tier-list sections and their content
# Pattern: <h3>TIER</h3>\n        <div class="tier-list">CONTENT</div>
tier_pattern = r'(<h3>[^<]+阶天赋树[^<]*</h3>\s*<div class="tier-list">)(.*?)(</div>\s*(?=<h3>|</div>\s*</section>))'
tiers = list(re.finditer(tier_pattern, html, re.DOTALL))

print('Found %d tier sections' % len(tiers))

# Extract all articles from ALL tier sections
all_articles = []  # (article_html, tier_name, article_name)
tier_content = {}   # tier_name -> (prefix, suffix)

for m in tiers:
    full = m.group(0)
    prefix = m.group(1)   # <h3>...</h3><div class="tier-list">
    content = m.group(2)  # articles inside
    suffix = m.group(3)   # </div>
    
    tier_name = re.search(r'<h3>([^<]+)', prefix).group(1)
    tier_content[tier_name] = (prefix, suffix)
    
    # Extract individual article blocks from content
    for article in re.finditer(r'<article class="skill".*?</article>', content, re.DOTALL):
        block = article.group(0)
        # Find the talent name
        name_match = re.search(r'<h4>([^<]+)', block)
        name = name_match.group(1).strip() if name_match else '?'
        all_articles.append((block, tier_name, name))

print('Extracted %d total articles' % len(all_articles))

# Map each talent to its correct tier
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

# Reassign tier for known talents
reassigned = 0
for i, (block, tier, name) in enumerate(all_articles):
    if name in correct_tier:
        new_tier = correct_tier[name]
        if tier != new_tier:
            all_articles[i] = (block, new_tier, name)
            reassigned += 1
            print('MOVE: %s from %s to %s' % (name, tier, new_tier))

print('Reassigned: %d articles' % reassigned)

# Build new HTML: group articles by tier
tier_articles = {}
for block, tier, name in all_articles:
    if tier not in tier_articles:
        tier_articles[tier] = []
    tier_articles[tier].append(block)

# Replace tier-list content with sorted articles
for tier, (prefix, suffix) in tier_content.items():
    articles = tier_articles.get(tier, [])
    new_content = '\n        '.join(articles)
    old_full = prefix + '.*?' + suffix
    new_full = prefix + '\n        ' + new_content + '\n      ' + suffix
    # Replace in html
    # Find the old tier section
    old_pattern = re.escape(prefix) + '.*?' + re.escape(suffix)
    html = re.sub(old_pattern, lambda m: new_full, html, count=1, flags=re.DOTALL)

# Write
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.write(html)

# Quick verify
vcount = 0
for name in correct_tier:
    c = html.count(name)
    if c == 0:
        print('LOST: %s' % name)
    elif c > 1:
        print('DUPE: %s (%d)' % (name, c))
        vcount += c - 1

print('\nVerification issues: %d' % vcount)
print('Done. Size: %d -> %d' % (len(html.split('\n')), len(html)))
