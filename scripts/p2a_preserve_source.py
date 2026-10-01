# -*- coding: utf-8 -*-
"""P2a：保留真实来源 + 天赋数组写回 + 问题清单持久化（非下划线字段）。"""
import shutil, time, subprocess
NL = chr(10)
p = '斯诺德跑团/上传角色.html'
t = open(p, encoding='utf-8').read()
ts = time.strftime('%Y%m%d-%H%M%S')
shutil.copyfile(p, '备份区/2026-09/上传角色_来源保留前_%s.html' % ts)
edits = [
  # ① 技能循环：来源不再被改写成主职业
  ('var tCls=info[0]===mc||info[0]===sc?info[0]:mc;', 'var tCls=info[0];'),
  # ② 技能条目：保留真实来源；仅当来源是副职业时打 sub 标记
  ('if(info[0]===mc)sk.src=mc;else if(info[0]===sc){sk.src=sc;sk.sub=sc;}', 'sk.src=info[0];if(info[0]===sc)sk.sub=sc;'),
  # ③ 天赋循环：同上
  ('var src2=info[0]===mc||info[0]===sc?info[0]:mc;', 'var src2=info[0];'),
  ('if(info2[0]===mc)tn.cls=mc;else if(info2[0]===sc)tn.cls=sc;', 'tn.cls=info2[0];'),
]
done = []
for old, new in edits:
    if old in t:
        t = t.replace(old, new, 1); done.append(old[:34])
    else:
        done.append('MISS:' + old[:34])
# ④ 天赋数组写回（原缺陷：生成的 _nt 没写回 state）
old_log = 'console.log("AUTOCORRECT done:'
if 'state.talent_tree=_nt;' not in t and old_log in t:
    t = t.replace(old_log, 'state.talent_tree=_nt;' + NL + old_log, 1)
    done.append('state.talent_tree=_nt 写回')
# ⑤ 问题清单持久化（非下划线字段，避开 getStateSnapshot 的下划线过滤）
if 'state.importIssues=_c;' not in t and old_log in t:
    t = t.replace(old_log, 'state.importIssues=_c;' + NL + old_log, 1)
    done.append('state.importIssues=_c 持久化')
open(p, 'w', encoding='utf-8', newline='').write(t)
shutil.copyfile(p, 'electron-app/斯诺德跑团/上传角色.html')
print('编辑结果:')
for x in done: print('  ' + ('✗ ' if x.startswith('MISS') else '✓ ') + x)
# 自检：文件是否仍是合法 HTML（body/html 标签平衡 + 关键函数仍在）
for k in ['function autoCorrect', 'state.talent_tree=_nt;', 'state.importIssues=_c;', 'sk.src=info[0];', 'tn.cls=info2[0];']:
    print('  含「%s」: %s' % (k, k in t))
print('  残留旧写法: %s' % ('有 ✗' if ('info[0]===mc||info[0]===sc' in t or 'info2[0]===mc' in t) else '无 ✓'))
print('  文件大小: %.1f KB' % (len(t.encode('utf-8')) / 1024))
