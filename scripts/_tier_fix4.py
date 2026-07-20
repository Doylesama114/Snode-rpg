"""Fix remaining 8 mismatches using CORRECT docx tier mapping."""

with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# CORRECTED mapping (from docx verification)
# Docx tier boundaries: 四阶L1482, 五阶L1967, 六阶L2419, 七阶L2894
correct_tier = {
    # These 3 are under 五阶 (L1967), NOT 四阶
    '猛火':'五阶天赋树',
    '剧毒物质':'五阶天赋树',
    '深度创伤':'五阶天赋树',
    # These 4 are under 五阶 (L1967), NOT 七阶
    '以刃承伤':'五阶天赋树',
    '魔力偏转':'五阶天赋树',
    '化险为夷':'五阶天赋树',
    '神圣干涉':'五阶天赋树',
    # 伤害阈值 is under 七阶 (L2894), NOT 六阶
    '伤害阈值':'七阶天赋树',
}

# Find tier boundaries in HTML
tier_end = {}
for i, line in enumerate(lines):
    for tier in ['五阶天赋树','六阶天赋树','七阶天赋树']:
        if tier not in tier_end and '<h3>%s</h3>' % tier in line:
            # Find the closing </div> of the tier-list
            for j in range(i+1, len(lines)):
                if '</div>' in lines[j].strip() and (j+1 >= len(lines) or '<h3>' in lines[j+1] or '</section>' in lines[j+1] or '</div>' in lines[j+1]):
                    tier_end[tier] = j
                    break

print('Tier close lines:')
for t in ['五阶天赋树','六阶天赋树','七阶天赋树']:
    print('  %s: L%d' % (t, tier_end.get(t, -1)))

# Find and extract articles to move
to_move = {}  # name -> (target_tier, line_index, line_content)
for i, line in enumerate(lines):
    if '<h4>' not in line: continue
    for name in correct_tier:
        if name in line:
            to_move[name] = (correct_tier[name], i, line)
            break

print('\nArticles to move:')
for name, (tier, idx, _) in sorted(to_move.items(), key=lambda x: x[1][1]):
    print('  L%d: %s -> %s' % (idx, name, tier))

# Cut: remove from original positions
new_lines = []
for i, line in enumerate(lines):
    is_moved = False
    for name, (_, idx, _) in to_move.items():
        if i == idx:
            is_moved = True
            break
    if not is_moved:
        new_lines.append(line)

# Paste: insert before tier closing </div>
for name, (tier, _, content) in to_move.items():
    insert_at = tier_end[tier]
    new_lines.insert(insert_at, content)

# Write
with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

# Quick verify
html = ''.join(new_lines)
import re
print('\nVerification:')
for name, target_tier in correct_tier.items():
    # Find which tier section contains this talent
    lines2 = html.split('\n')
    current = '?'
    for line in lines2:
        if '<h3>' in line and '阶天赋树' in line:
            current = line.split('<h3>')[1].split('</h3>')[0].strip()
        if '<h4>' in line and name in line:
            status = 'OK' if current == target_tier else 'WRONG'
            print('  %s: in %s (target %s) — %s' % (name, current, target_tier, status))
            break

# Count occurrences in h4
for name in correct_tier:
    h4s = re.findall(r'<h4>.*?' + name + r'.*?</h4>', html)
    if len(h4s) != 1:
        print('  COUNT ISSUE: %s (%d h4s)' % (name, len(h4s)))
