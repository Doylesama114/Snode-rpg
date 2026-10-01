# -*- coding: utf-8 -*-
import re, shutil
p = '斯诺德跑团/上传角色.html'
t = open(p, encoding='utf-8').read()
n = 0
def rep(m):
    global n; n += 1
    return 'var src2=' + m.group(1) + ';'
t2, cnt = re.subn(r'var src2=info\[0\]\s*===\s*mc\s*\|\|\s*info\[0\]\s*===\s*sc\s*\?\s*info\[0\]\s*:\s*mc\s*;', lambda m: 'var src2=info[0];', t)
if cnt == 0:
    # 兜底：容错任意空白
    t2, cnt = re.subn(r'var\s+src2\s*=.*?;', 'var src2=info[0];', t, count=1)
open(p, 'w', encoding='utf-8', newline='').write(t2)
shutil.copyfile(p, 'electron-app/斯诺德跑团/上传角色.html')
print('替换次数: %d' % cnt)
t3 = open(p, encoding='utf-8').read()
print('残留旧写法: %s' % ('有 ✗' if ('info[0]===mc||info[0]===sc' in t3 or 'info[0] === mc' in t3) else '无 ✓'))
print('含 var src2=info[0]; : %s' % ('var src2=info[0];' in t3))
print('含 state.talent_tree=_nt; : %s | state.importIssues=_c; : %s' % ('state.talent_tree=_nt;' in t3, 'state.importIssues=_c;' in t3))
