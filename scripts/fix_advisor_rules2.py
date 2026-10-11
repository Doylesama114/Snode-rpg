# -*- coding: utf-8 -*-
import io, json, re, shutil
NL = chr(10)
items = sorted(json.load(io.open('_scratch/rules_new.json', encoding='utf-8')), key=lambda x: x['no'])
P = '斯诺德跑团/advisor-tips.js'
t = io.open(P, encoding='utf-8').read()
key = '"rules":'
i = t.find(key)
if i < 0:
    print('FAIL 找不到 rules 键'); raise SystemExit(1)
j = t.find('[', i)
# 括号配对找数组结尾
depth = 0
k = j
while k < len(t):
    if t[k] == '[': depth += 1
    elif t[k] == ']':
        depth -= 1
        if depth == 0: break
    k += 1
print('数组区间: %d → %d（%d 字符）' % (j, k, k - j))
arr = '[' + (',' + NL).join('    ' + json.dumps(it['body'], ensure_ascii=False) for it in items) + NL + '  ]'
t2 = t[:j] + arr + t[k + 1:]
io.open(P, 'w', encoding='utf-8', newline='').write(t2)
shutil.copyfile(P, 'electron-app/' + P)
# 自检
t3 = io.open(P, encoding='utf-8').read()
i3 = t3.find(key); j3 = t3.find('[', i3)
depth = 0; k3 = j3
while k3 < len(t3):
    if t3[k3] == '[': depth += 1
    elif t3[k3] == ']':
        depth -= 1
        if depth == 0: break
    k3 += 1
try:
    data = json.loads(t3[j3:k3 + 1])
    print('OK 解析成功 %d 条 · 首条 %s … · 末条 %s …' % (len(data), data[0][:24], data[-1][:24]))
except Exception as e:
    print('解析失败: %s' % str(e)[:140])
