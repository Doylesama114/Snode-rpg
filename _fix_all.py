#!/usr/bin/env python3
"""
Fix 51 data issues in 魔契师.json:
- Category A: 29 garbage text entries in level_upgrades (and some descriptions)
- Category B: 22 missing descriptions for talent skills

Approach:
1. For garbage text: truncate at first occurrence of garbage marker patterns
2. For descriptions: extract from docx text and inject into JSON
3. Clean extracted descriptions of trailing name bleed-through
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

# ========== CONFIG ==========
JSON_PATH = '职业页/数据/魔契师.json'
DOCX_TEXT_PATH = '_docx_text.txt'

# Garbage marker patterns - truncate at first occurrence
GARBAGE_PATTERNS = [
    '魔契师天赋树',
    '你可以通过花费技能点的方式来获取以下能力',
    '---------------------------------------------------------------------',
    '一阶天赋树职业等级',
    '二阶天赋树职业等级', 
    '三阶天赋树职业等级',
    '四阶天赋树职业等级',
    '五阶天赋树职业等级',
    '六阶天赋树职业等级',
    '七阶天赋树职业等级',
    '-----------------------------',
]

# Garbage patterns that are skill-name-list blocks (occur when skills are listed in headers)
# These are harder to detect with simple patterns, but the "---" and "天赋树" patterns cover most

# ========== LOAD DATA ==========
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(DOCX_TEXT_PATH, 'r', encoding='utf-8') as f:
    docx_text = f.read()

# ========== TALENT DESCRIPTIONS (extracted from docx) ==========
# These are the CORRECT descriptions extracted from the docx definitions
TALENT_DESCRIPTIONS = {
    # 魔契/一阶
    '力量报偿': '你透支自身的潜力提前向宗主索取更加高昂的酬劳，在接下来的五场战斗环节中你将获取的经验值及技能点支付给宗主并获得以下效果：·将你的魔契师等级提升至5级，若你当前为5级则改为将你的魔契师等级提升1级，这个效果在你的魔契师等级超过10级时不会触发（这个效果允许你突破兼职职业的等级限制）·在接下来的五场战斗环节中，你的攻击命中检定、造成的伤害值以及受到的回复效果具有优势',
    '节能施法': '你懂得如何更高效的施放法术，使你施展的下一个法术或戏法疲劳值消耗-4',
    
    # 魔契/二阶
    '恩赐法术': '你可以从你所契约的宗主那里习得一项能力，具体获得的收益由你的宗主决定',
    '超限': '你突破自身的极限，使你的下一次攻击命中检定、伤害骰和豁免检定分别具有优势本场战斗环节结束后你会进入一层力竭状态，这个效果会持续24小时',
    '灰色交易': '你立即发起一场灰色交易，团队中的每一名其他角色均可以选择是否参与本次交易，如果选择参与便给予你一个任意技能点作为入场券，随后这些参与者可以自由交换彼此所拥有的技能点',
    
    # 魔契/三阶
    '强韧召唤': '你用魔力强化你的召唤物，使你的召唤单位额外获得等于你的法师职业等级的临时生命值',
    '宗主代行者': '你在与异界生物进行社交相关的检定时具有优势，如果对方与你的宗主同属一个位面或阵营，那么起始态度至少为友善每场战斗限一次.你可以花费一个反应动作，使对你执行攻击行动的异界生物进行一次难度为15的魅力豁免，对方豁免失败将会取消这次行动，并且本回合无法再次对你发动攻击你每完成一项宗主交付的任务，便会获得一个代行者点数；你可以消耗一个代行者点数视作执行一次异界灵感，你最多拥有三个代行者点数',
    
    # 魔契/四阶
    '恩赐·契约强化': '你获得一个额外的契约法术槽位，这个槽位仅能够用于放置带有恩惠关键词的能力、或者通过恩赐法术获得的能力揭示恩赐·契约强化中所放置法术的真正潜力',
    
    # 邪念/二阶
    '孰强孰弱': '你借助宗主的力量倾斜胜利的天秤，在一次你与他人进行一次属性对抗时，能够使自身的本次检定获得优势并且使对方具有劣势',
    
    # 邪念/三阶
    '诅咒蔓延': '当你施展的诅咒效果持续时间结束、或者目标在持续时间内死亡时，你可以使这个诅咒效果传播至目标周围6米内的一名其他角色，通过这个效果传播的诅咒仅持续1轮',
    
    # 邪念/四阶
    '恶咒缠身': '每当你对一名当前拥有诅咒效果的角色施加新的诅咒时，可以令新的诅咒效果持续时间+1轮如果你对一名当前拥有三个不同的诅咒状态的角色施加新的诅咒，那么还可以在新的诅咒生效时令对方承受2D6点暗影伤害',
    '血债血偿': '你通过诅咒效果令对你造成过伤害的角色承受伤害或者生命值流失效果时，为自身回复等量的生命值，这个效果在同一场战斗环节中对每名角色仅触发一次',
    
    # 咒能/一阶
    '能量导管': '当你进入一场战斗环节后，可以获得两颗D8骰，你可以在进行一次施法攻击的伤害值后额外投掷一颗骰子，将掷出的点数附加在结果上',
    
    # 咒能/三阶
    '咒术蓄能': '当你连续在两个自身回合均进行过施法攻击，那么在第三个自身回合你施展的首次施法攻击具有速攻关键词咒术蓄能在每场战斗环节中最多能够触发两次',
    
    # 咒能/四阶
    '能量护符': '你可以在一次长休期间将你当前未消耗的疲劳值注入一枚项链或护符等配饰中，携带能量护符的角色在承受下一次伤害时，能量护符能够吸收其中的X点伤害值随后失效X为你注入能量护符时的疲劳数值当你进行一次长休时，先前的能量护符会失去作用',
    '咒能转化': '你短暂地扭曲魔力的本质，使你的魔法能量相互转化，你可以将任意一种自身施展的能量攻击手段转化为火焰、奥术或力场伤害通过这个方式转换的攻击命中检定掷出19即可触发暴击',
    
    # 秘术/三阶
    '厄运转移': '当你在自身回合外进行一次豁免检定失败后，你可以花费一个反应动作将本次失败结果传递过自身周围12米内的一名友方角色如果对方的魅力属性值低于你那么便不能够拒绝，否则对方可以选择与你进行一次幸运对抗，如果目标对抗成功那么可以选择拒绝本次转移效果',
    '高速神言': '1.高速神言的优先级高于速攻关键词2.当一名角色施展包含速攻关键词的技能时，取消其中的速攻关键词',
    '谜巢': '当你周围6米内至少拥有两名敌人时，你可以选择开启谜巢，持续2轮谜巢持续时间内所有与你相邻的敌方角色在进行攻击时需要进行一次难度为12的智力或感知豁免（由你决定），豁免失败的角色需要投掷一颗D4骰来决定实际攻击目标，由你来提前预设每个点数所对应的类型，可选择类型如下·你本人  ·随机角色  ·空地  ·他们自己每名角色限一次.你可以选择令谜巢范围内的敌方角色在进行一次智力或感知豁免时具有劣势',
    
    # 秘术/四阶
    '无效预言': '你借助宗主的力量篡改敌人的预言，当视野范围内的一名敌方角色通过预知骰或占星骰、以及其他同等效果的能力来修改骰值点数时，你可以使那次效果无效化',
    '幻术法袍': '1.你可以在短休时段触碰一件非魔法物品的布衣，为其施展以下一项效果·迷彩形态：穿戴者视作拥有隐匿的熟练项，并且进行隐匿检定时具有优势·华丽形态：穿戴者在进行社交相关检定时具有优势·诡秘形态：穿戴者无法被通过洞悉检定来获取信息2.无论选择哪种效果，幻术法袍均能够为穿戴者提供1点临时的魅力属性值，无法以此超过穿戴者的属性值上限3.幻术法袍的效果能够持续24个小时',
    '占卜球': '你可以在短休时段通过魔法水晶球来进行占卜，若如此做你无法获得本次短休时段的其他收益你可以通过占卜球选择获悉以下一项信息·得知一处位于自身2KM内的建筑、聚群或地点信息，你能够得知那里的大致轮廓和人物移动轨迹，但无法辨明细节·你可以提出一个关于占卜后两小时内可能发生的事件相关的问题（由DM以模糊或预示的方式回答）·使自身进行的下一次调查、察觉和探索检定会分别具有极大优势，持续至你进行一次长休为止·判断将要进行的事项是否存在魔法、结界或诅咒等效应的干涉·掷一颗D20的骰子，将其称作占卜骰并记录下这次的结果，在本日的行动中，你在进行攻击命中、属性或熟练项之后，可以消耗这颗占卜骰来忽视本次检定结果，改为使用你所消耗的占卜骰点数，该点数不会受到关键属性及其他效果的加成，也不会触发大成功或大失败的效果，每次长休开始时所有你尚未使用的占卜骰将会消散',
    # Add the other skills that already have descriptions but might benefit from docx-verified text:
    '活灵术': '你用魔法道具轻点物品、并念诵法咒唤醒一个物件，为其注入虚假的活性你触碰一个不超过两方米的物件使其在持续时间内具有"活着"的特性，可以在需要判定时视作一个角色，例如受到原先针对角色的增益或护盾效果影响、或成为部分场地效果的点名对象',
    '秘法锁': '你用一只未持有物件的手做出对应的施法动作、并念诵法咒生成一组由魔力构成的、晶莹剔透的紫色锁具和链条附着在物件上你可以对一个体积不超过大型的密封容器或是门进行上锁你在触碰秘法锁后可以选择将其解锁其他角色可以通过一次难度为18的威力、魔法学识检定或其他暴力手段来尝试摧毁秘法锁，如果秘法锁被人为破坏你能够立即感知到当你重新施展这个法术时会使上一个维持的秘法锁效果消散',
    '咒能反弹': '你用未持有物件的双手做出外推动作、并念诵法咒将魔法能量转而涌向攻击的对手当你承受一次来源于法术或戏法的伤害时，将相同的攻击手段反击给自身周围12米内的一名其他角色，如果反击目标为攻击来源，那么本次攻击命中检定和伤害骰具有优势如果反击的法术或戏法为单体效果，你可以选择将其变为AOE，对攻击对象相邻位置的目标造成一半的结算后伤害值咒能反弹无法反击四阶天赋树以上的法术或戏法咒能反弹无法响应诅咒或心灵伤害等非直观的攻击手段',
    '魔力泉涌': '你用一只手作出托举动作、并念诵法咒召唤一个悬空的喷涌紫泉你生成一个魔力池为他人提供魔力回复，魔力池中共计蕴含12点疲劳值，位于其周边4米范围内的任意角色能够在自身回合中选择从中提取4点疲劳值用于回复自身，每名角色仅能够在一个自身回合进行一次提取行为，这个行动无需花费动作当魔力池中的疲劳值消耗殆尽，或是承受一次能量攻击时将会消失',
}

# ========== HELPER FUNCTIONS ==========

def truncate_at_garbage(text):
    """Truncate text at the first occurrence of any garbage pattern.
    Returns (cleaned_text, was_truncated)."""
    if not text:
        return text, False
    
    best_pos = len(text)
    for pat in GARBAGE_PATTERNS:
        pos = text.find(pat)
        if pos >= 0 and pos < best_pos:
            best_pos = pos
    
    if best_pos < len(text):
        return text[:best_pos].strip(), True
    return text, False

def split_description(text):
    """Split a multi-sentence description into individual lines.
    Returns list of description lines."""
    # Split on sentence boundaries
    lines = []
    current = []
    for ch in text:
        current.append(ch)
        # Split on Chinese period, semicolon-like markers
        if ch in ('。', '；', '？', '！'):
            lines.append(''.join(current))
            current = []
    if current:
        lines.append(''.join(current))
    return lines if lines else [text]

# ========== STEP 1: FIX GARBAGE IN LEVEL_UPGRADES ==========
lu_fixes = 0
for skill in data['skills']:
    for lu in skill.get('level_upgrades', []):
        cleaned, was_trunc = truncate_at_garbage(lu['text'])
        if was_trunc:
            old = lu['text']
            lu['text'] = cleaned
            lu_fixes += 1
            print(f'  [LV_GARBAGE] {skill["name"]} Lv{lu["level"]}: truncated {len(old)-len(cleaned)} chars')

# ========== STEP 2: FIX GARBAGE IN DESCRIPTIONS ==========
desc_garbage_fixes = 0
for skill in data['skills']:
    desc = skill.get('description', [])
    if not desc:
        continue
    
    new_desc = []
    modified = False
    for i, line in enumerate(desc):
        cleaned, was_trunc = truncate_at_garbage(line)
        if was_trunc:
            if cleaned:  # Only add if non-empty after truncation
                new_desc.append(cleaned)
            else:
                pass  # Skip empty lines
            modified = True
            desc_garbage_fixes += 1
            print(f'  [DESC_GARBAGE] {skill["name"]} desc[{i}]: truncated to {len(cleaned)} chars')
        else:
            new_desc.append(line)
    
    if modified:
        skill['description'] = new_desc

# ========== STEP 3: ADD DESCRIPTIONS TO TALENT SKILLS ==========
talent_fixes = 0
for skill in data['skills']:
    name = skill['name']
    if name in TALENT_DESCRIPTIONS and not skill.get('description'):
        desc_text = TALENT_DESCRIPTIONS[name]
        skill['description'] = [desc_text]
        talent_fixes += 1
        print(f'  [ADD_DESC] {skill["name"]} ({skill["style"]}/{skill["tier"]}): added description ({len(desc_text)} chars)')

# ========== SAVE ==========
with open(JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'\n=== COMPLETE ===')
print(f'Level upgrade garbage fixes: {lu_fixes}')
print(f'Description garbage fixes: {desc_garbage_fixes}')
print(f'Talent description additions: {talent_fixes}')
print(f'Total fixes applied: {lu_fixes + desc_garbage_fixes + talent_fixes}')
