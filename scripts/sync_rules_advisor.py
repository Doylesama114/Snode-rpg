# -*- coding: utf-8 -*-
import io, json, shutil, re, time
NL = chr(10)
items = sorted(json.load(io.open('_scratch/rules_new.json', encoding='utf-8')), key=lambda x: x['no'])
ts = time.strftime('%Y%m%d-%H%M%S')
report = []
# ---- ① advisor-tips.js：rules 数组 ----
P = '斯诺德跑团/advisor-tips.js'
t = io.open(P, encoding='utf-8').read()
shutil.copyfile(P, '备份区/2026-10/advisor-tips_基本规则同步前_' + ts + '.js')
m = re.search(r'("rules"\s*:\s*\[)([\s\S]*?)(\n\s*\])', t)
if m:
    body = ',' + NL.join('    ' + json.dumps(it['body'], ensure_ascii=False) for it in items)
    t2 = t[:m.start(2)] + body + NL + '  ' + t[m.end(3):]
    io.open(P, 'w', encoding='utf-8', newline='').write(t2)
    shutil.copyfile(P, 'electron-app/' + P)
    report.append('advisor-tips.js rules 数组 → %d 条' % len(items))
else:
    report.append('FAIL advisor-tips.js 未匹配 rules 数组')
# ---- ② mage-advisor.mjs：第 12 条引用 ----
Q = 'scripts/mage-advisor.mjs'
q = io.open(Q, encoding='utf-8').read()
shutil.copyfile(Q, '备份区/2026-10/mage-advisor_基本规则同步前_' + ts + '.mjs')
before = q
q = q.replace('引用基本规则第六条「说，你要干嘛」', '引用基本规则第 12 条「说，您要干嘛」')
old_quote = '按《基本规则》第六条「说，你要干嘛」：告诉 DM 你到底想干嘛。如果你自己都不清楚行动的目标，那么这可能并不是一个合适的选择；只有在了解你角色行为逻辑的前提下，主持人'
new_quote = '按《基本规则》第 12 条「说，您要干嘛」：告诉主持人您要做什么，也告诉主持人您的具体假设。与其只说“我要用某能力”，不如说清：角色想达成什么、打算怎么做、处于什么场景、依赖哪些条件。主持人只有理解您角色的行为逻辑和具体情境，才能'
if old_quote in q:
    q = q.replace(old_quote, new_quote)
    report.append('mage-advisor.mjs 文案已改（第 12 条 + 新正文）')
else:
    report.append('WARN mage-advisor.mjs 未匹配旧引文（可能已改）')
if q != before:
    io.open(Q, 'w', encoding='utf-8', newline='').write(q)
report.append('mage-advisor 注释改动: %s' % ('是' if '第 12 条' in q else '否'))
io.open('_scratch/sync2.txt', 'w', encoding='utf-8').write(NL.join(report))
print(NL.join(report))
# 校验 advisor 数组条数
t3 = io.open(P, encoding='utf-8').read()
m2 = re.search(r'"rules"\s*:\s*\[([\s\S]*?)\n\s*\]', t3)
cnt = len(re.findall(r'^\s*"', m2.group(1), re.M)) if m2 else -1
print('advisor rules 条目数: %d' % cnt)
