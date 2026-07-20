import re
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find tier sections and talents
pattern = r'<div class="tier" id="([^"]+)">.*?<h4>([^<]+)</h4>'
# Actually let's find tier divs, then find h4 inside them
tier_pattern = r'<div class="tier" id="p-tier-([^"]+)">(.*?)(?=<div class="tier"|</div>\s*</section>)'
tiers = re.findall(tier_pattern, html, re.DOTALL)

print('Found %d tier sections\n' % len(tiers))
for tier_name, content in tiers:
    # Extract talent names from h4
    h4s = re.findall(r'<h4>([^<]+)</h4>', content)
    names = [h.strip() for h in h4s if '抉择' not in h and len(h.strip()) < 20]
    if names:
        print('=== %s (%d talents) ===' % (tier_name, len(names)))
        for n in names:
            print('  %s' % n)
        print()
