import re
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

current_tier = 'unknown'
for line in lines:
    if 'class="tier"' in line and 'id="p-tier-' in line:
        m = re.search(r'id="p-tier-([^"]+)"', line)
        if m: current_tier = m.group(1)
    if '<h4>' in line:
        m = re.search(r'<h4>([^<]+)', line)
        if m:
            name = m.group(1).strip()
            if '抉择' not in name and len(name) < 25:
                print('%s: %s' % (current_tier, name))
