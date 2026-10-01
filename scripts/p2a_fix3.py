# -*- coding: utf-8 -*-
import shutil
p = '斯诺德跑团/上传角色.html'
t = open(p, encoding='utf-8').read()
bad = 'var src2=info[0];'
cnt = t.count(bad)
t = t.replace(bad, 'var src2=info2[0];')
open(p, 'w', encoding='utf-8', newline='').write(t)
shutil.copyfile(p, 'electron-app/斯诺德跑团/上传角色.html')
print('修正 src2: %d 处 → var src2=info2[0];' % cnt)
t2 = open(p, encoding='utf-8').read()
print('校验: %s' % ('✓ 全部到位' if all(k in t2 for k in ['var tCls=info[0];', 'sk.src=info[0];if(info[0]===sc)sk.sub=sc;', 'var src2=info2[0];', 'tn.cls=info2[0];', 'state.talent_tree=_nt;', 'state.importIssues=_c;']) else '✗ 有缺'))
