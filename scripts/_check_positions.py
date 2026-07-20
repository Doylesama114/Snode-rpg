with open(r'D:\Download\scholar-agent-main\职业页\通用天赋树.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

current_tier = '?'
targets = ['猛火','剧毒物质','深度创伤','稳固经济','兢业玩家','英雄弧光','深渊呢喃',
           '八毫米','饥饿游戏','回避身形','唤醒','信手拈来','超体','表演型人格',
           '使命必达','利见大人','哟吼船长的藏宝图','以刃承伤','魔力偏转',
           '化险为夷','神圣干涉','冲击之铠','对策治疗','序幕的勋章','最佳状态',
           '盛大登场','掷骰狂人','气定神闲','裁决者','极速者','召唤大师',
           '伤害阈值','火中人','蛇之手','渴血者','同花顺','光明与黑暗','俱乐部达人']

for line in lines:
    if '<h3>' in line:
        import re
        m = re.search(r'<h3>([^<]+)', line)
        if m: current_tier = m.group(1)
    if '<h4>' in line:
        m = re.search(r'<h4>([^<]+)', line)
        if m:
            name = m.group(1).strip()
            if name in targets:
                print('%s | %s' % (current_tier.ljust(10), name))
