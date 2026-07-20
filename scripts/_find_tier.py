with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find lines with <h3 or tier or section
for i, line in enumerate(lines):
    s = line.strip()
    if '<h3' in s or 'class="tier' in s or 'tier-title' in s or 'p-tier-' in s:
        print('[%d] %s' % (i+1, s[:180]))
