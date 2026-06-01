"""Accurate garbage checker - only REAL garbage patterns, not skill names"""
import json

with open('职业页/数据/魔契师.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

# REAL garbage patterns (not skill names that appear in legitimate text)
real_garbage = [
    '魔契师天赋树',
    '你可以通过花费技能点的方式来获取以下能力',
    '---------------------------------------------------------------------',
    '-----------------------------',
    '一阶天赋树职业等级',
    '二阶天赋树职业等级',
    '三阶天赋树职业等级',
    '四阶天赋树职业等级',
    '五阶天赋树职业等级',
    '六阶天赋树职业等级',
    '七阶天赋树职业等级',
]

# Also: concatenated skill lists (multiple skill names together)
# This is harder to detect but the "---" and "天赋树" patterns should catch most

issues = []
for s in d['skills']:
    name = s['name']
    
    # Check descriptions
    for i, line in enumerate(s.get('description', [])):
        for pat in real_garbage:
            if pat in line:
                issues.append((name, s['style'], s['tier'], f'desc[{i}] GARBAGE: contains "{pat}"'))
                break
    
    # Check level_upgrades
    for lu in s.get('level_upgrades', []):
        for pat in real_garbage:
            if pat in lu['text']:
                issues.append((name, s['style'], s['tier'], f'Lv{lu["level"]} GARBAGE: contains "{pat}"'))
                break

# Check for empty descriptions in talent skills (non-starting, no 施展时间)
for s in d['skills']:
    name = s['name']
    desc_lines = s.get('description', [])
    if len(desc_lines) == 0 and s['style'] != '起始特性':
        if '施展时间' not in s.get('fields', {}):
            issues.append((name, s['style'], s['tier'], 'MISSING description (talent skill)'))

if issues:
    print(f"REAL issues remaining: {len(issues)}")
    for name, style, tier, detail in issues:
        print(f"  [{style}/{tier}] {name}: {detail}")
else:
    print("ALL CLEAN! No garbage text, all talent skills have descriptions.")

# Also count empty-description skills
talent_no_desc = [s for s in d['skills'] if len(s.get('description',[]))==0 
                   and s['style']!='起始特性' and '施展时间' not in s.get('fields',{})]
print(f"\nTalent skills with 0 desc: {len(talent_no_desc)}")
