import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PATH = r'D:\Download\scholar-agent-main\职业页\通用天赋树.html'
with open(PATH, 'r', encoding='utf-8') as f:
    content = f.read()

moved_ids = [
    'g-skill-422', 'g-skill-423', 'g-skill-424',
    'g-skill-421', 'g-skill-426',
    'g-skill-430', 'g-skill-431', 'g-skill-432',
    'g-skill-433', 'g-skill-434', 'g-skill-435',
    'g-skill-436', 'g-skill-437',
]

changes = 0
for aid in moved_ids:
    old = '\n<article class="skill" id="' + aid + '"'
    new = '\n        <article class="skill" id="' + aid + '"'
    if old in content:
        content = content.replace(old, new)
        changes += 1
        print('Fixed indent for ' + aid)
    elif new in content:
        print('Already indented: ' + aid)
    else:
        print('NOT FOUND: ' + aid)

print('\nFixed ' + str(changes) + ' articles')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
