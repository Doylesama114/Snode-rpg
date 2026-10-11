# -*- coding: utf-8 -*-
import io, json, re, shutil
NL = chr(10)
items = sorted(json.load(io.open('_scratch/rules_new.json', encoding='utf-8')), key=lambda x: x['no'])
P = '斯诺德跑团/advisor-tips.js'
t = io.open(P, encoding='utf-8').read()
# 重建 rules 数组（正确的 JSON 数组：元素间逗号、无前导逗号）
arr = '[' + (',' + NL).join('    ' + json.dumps(it['body'], ensure_ascii=False) for it in items) + NL + '  ]'
m = re.search(r'"rules"\s*:\s*\[[\s\S]*?\n\s*\]', t)
if m:
    t2 = t[:m.start()] + '"rules": ' + arr + t[m.end():]
    io.open(P, 'w', encoding='utf-8', newline='').write(t2)
    shutil.copyfile(P, 'electron-app/' + P)
    print('OK 已重建 rules 数组')
else:
    print('FAIL 未匹配')
# 自检：能否被 JSON.parse 解析
t3 = io.open(P, encoding='utf-8').read()
m3 = re.search(r'"rules"\s*:\s*(\[[\s\S]*?\n\s*\])', t3)
if m3:
    try:
        data = json.loads(m3.group(1))
        print('解析成功: %d 条' % len(data))
        print('  首条前 30 字: ' + data[0][:30])
        print('  末条前 30 字: ' + data[-1][:30])
    except Exception as e:
        print('解析失败: %s' % str(e)[:120])
else:
    print('未取到数组文本')
