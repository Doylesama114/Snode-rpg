"""Verify generated HTML has all talent skill descriptions"""
import json

# Load JSON
with open('职业页/数据/魔契师.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Load HTML
with open('职业页/魔契师.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Talent skills that should now have descriptions
talent_skills_need_desc = [
    '力量报偿', '节能施法', '恩赐法术', '超限', '灰色交易',
    '强韧召唤', '宗主代行者', '恩赐·契约强化',
    '孰强孰弱', '诅咒蔓延', '恶咒缠身', '血债血偿',
    '能量导管', '咒术蓄能', '能量护符', '咒能转化',
    '厄运转移', '高速神言', '谜巢',
    '无效预言', '幻术法袍', '占卜球',
]

# Check garbage patterns
garbage_patterns = [
    '魔契师天赋树',
    '你可以通过花费技能点的方式来获取以下能力',
    '---------------------------------------------------------------------',
    '一阶天赋树职业等级',
    '二阶天赋树职业等级',
    '三阶天赋树职业等级',
    '四阶天赋树职业等级',
]

garbage_found = False
for pat in garbage_patterns:
    if pat in html:
        print(f'GARBAGE FOUND: {pat}')
        garbage_found = True

if not garbage_found:
    print('NO GARBAGE TEXT FOUND - PASS')

# Check talent skills
missing = []
for name in talent_skills_need_desc:
    # Find skill in JSON
    skill = None
    for s in data['skills']:
        if s['name'] == name:
            skill = s
            break
    
    if not skill:
        print(f'NOT IN JSON: {name}')
        continue
    
    desc = skill.get('description', [])
    if not desc:
        missing.append(f'{name}: NO DESC IN JSON')
        continue
    
    # Check if description exists in HTML
    desc_preview = desc[0][:30]
    if desc_preview not in html:
        missing.append(f'{name}: DESC NOT IN HTML (preview: {desc_preview})')
    else:
        print(f'OK: {name} ({skill["style"]}/{skill["tier"]}) - desc {len(desc[0])} chars')

if missing:
    print(f'\nMISSING ({len(missing)}):')
    for m in missing:
        print(f'  {m}')
else:
    print(f'\nALL {len(talent_skills_need_desc)} TALENT SKILLS HAVE DESCRIPTIONS')

# Also verify total skill count
total_cards = html.count('<article class="skill"')
print(f'\nTotal skill cards in HTML: {total_cards}')
print(f'Total skills in JSON: {len(data["skills"])}')
