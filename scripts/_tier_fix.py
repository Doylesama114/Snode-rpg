import re

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Map talent names to their correct tier (from docx verification)
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

# Step 1: Extract all article blocks for our talents
articles = {}
for name in tier_map:
    # Match from <article to </article> containing this talent's h4
    # The article tag is on one very long line
    pattern = r'(<article class="skill" id="g-skill-\d+"[^>]*?><h4>' + re.escape(name) + r'.*?</article>)'
    match = re.search(pattern, html, re.DOTALL)
    if match:
        articles[name] = match.group(1)
        print('OK: %s (%d chars)' % (name, len(match.group(1))))
    else:
        print('MISS: %s' % name)

# Step 2: Remove all these articles from HTML
for name, block in articles.items():
    html = html.replace(block, '')

# Step 3: Find tier insertion points
# HTML format: <h3>X阶天赋树</h3>\n      <div class="tier-list">
# Insert articles BEFORE the closing </div> of each tier-list

tier_inserts = {}
for tier in ['四阶天赋树','五阶天赋树','六阶天赋树','七阶天赋树']:
    # Find the tier-list div for this tier
    pattern = r'(<h3>' + tier + r'</h3>\s*<div class="tier-list">)(.*?)(</div>\s*(?=<h3>|<div class="tier"|</div>\s*</section>))'
    match = re.search(pattern, html, re.DOTALL)
    if match:
        # Save the position of tier-list closing tag
        tier_inserts[tier] = match.group(3)  # the closing </div>
        print('Found tier: %s' % tier)
    else:
        print('MISSING tier: %s' % tier)

# Step 4: Group articles by tier and insert
for tier in ['四阶天赋树','五阶天赋树','六阶天赋树','七阶天赋树']:
    names_in_tier = [n for n, t in tier_map.items() if t == tier and n in articles]
    if not names_in_tier: continue
    
    blocks = '\n        '.join(articles[n] for n in names_in_tier)
    
    if tier in tier_inserts:
        closing_tag = tier_inserts[tier]
        # Insert before the closing </div>
        html = html.replace(closing_tag, blocks + '\n      ' + closing_tag, 1)
        print('Inserted %d articles into %s' % (len(names_in_tier), tier))

# Step 5: Write back and verify
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.write(html)

# Verify no duplicates
for name in tier_map:
    count = html.count('<h4>' + name + '<')
    if count != 1:
        print('VERIFY: %s appears %d times!' % (name, count))

print('\nDone. Total chars: %d' % len(html))
