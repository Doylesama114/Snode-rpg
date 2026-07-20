with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

current_tier = '?'
for line in lines:
    if '<h3>' in line:
        import re
        m = re.search(r'<h3>([^<]+)', line)
        if m: current_tier = m.group(1)
    if '<h4>' in line:
        m = re.search(r'<h4>([^<]+)', line)
        if m:
            name = m.group(1).strip()
            if len(name) < 25 and '抉择' not in name:
                print('%s | %s' % (current_tier.ljust(6), name))
