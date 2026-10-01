# -*- coding: utf-8 -*-
import shutil
p = '斯诺德跑团/上传角色.html'
t = open(p, encoding='utf-8').read()
old = 'var src2=info2[0]===mc||info2[0]===sc?info2[0]:mc;'
cnt = t.count(old)
t = t.replace(old, 'var src2=info2[0];')
open(p, 'w', encoding='utf-8', newline='').write(t)
shutil.copyfile(p, 'electron-app/斯诺德跑团/上传角色.html')
print('替换: %d 处' % cnt)
t2 = open(p, encoding='utf-8').read()
import re
left = re.findall(r'info2?\[0\]\s*===\s*mc', t2)
print('残留「===mc」判断: %d 处' % len(left))
for k in ['var tCls=info[0];', 'sk.src=info[0];if(info[0]===sc)sk.sub=sc;', 'var src2=info2[0];', 'tn.cls=info2[0];', 'state.talent_tree=_nt;', 'state.importIssues=_c;']:
    print('  %s %s' % ('✓' if k in t2 else '✗', k))
