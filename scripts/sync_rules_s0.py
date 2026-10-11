# -*- coding: utf-8 -*-
import io, json, shutil, os, re, time
NL = chr(10)
items = json.load(io.open('_scratch/rules_new.json', encoding='utf-8'))
items.sort(key=lambda x: x['no'])
print('规范条目: %d 条' % len(items))
def esc(s):
    return s.replace('&', '&amp;')
# 生成卡片 HTML（保持 help.html 既有排版：num/desc 内部换行）
cards = []
for it in items:
    cards.append('<div class="card">' + NL + '<div class="num">' + str(it['no']) + '.' + esc(it['title']) + NL + '</div>' + NL +
                 '<div class="desc">' + esc(it['body']) + NL + '</div>' + NL + '</div>' + NL)
block = NL.join(cards)
P = '斯诺德跑团/help.html'
t = io.open(P, encoding='utf-8').read()
ts = time.strftime('%Y%m%d-%H%M%S')
os.makedirs('备份区/2026-10', exist_ok=True)
shutil.copyfile(P, '备份区/2026-10/help_基本规则同步前_' + ts + '.html')
s0 = t.find('<div class="section" id="s0">')
s1 = t.find('<div class="section" id="s1">')
if s0 < 0 or s1 <= s0:
    print('FAIL 未找到 #s0/#s1 边界'); raise SystemExit(1)
seg = t[s0:s1]
# 保留 h2 与 note，仅替换 card 区域
h2_end = seg.find('</h2>')
note_start = seg.find('<div class="note">')
note_end = seg.find('</div>', note_start) + len('</div>') if note_start >= 0 else h2_end + 5
head = seg[:note_end] + NL
newseg = head + NL + block + NL
t2 = t[:s0] + newseg + t[s1:]
io.open(P, 'w', encoding='utf-8', newline='').write(t2)
shutil.copyfile(P, 'electron-app/' + P)
# 校验
t3 = io.open(P, encoding='utf-8').read()
s0b = t3.find('<div class="section" id="s0">'); s1b = t3.find('<div class="section" id="s1">')
seg2 = t3[s0b:s1b]
nums = re.findall(r'<div class="num">([^<]*)', seg2)
print('重建后卡片 %d 张:' % len(nums))
for n in nums: print('   ' + n.replace(chr(10), '').strip())
print(NL + '区间长度 %d → %d' % (len(seg), len(seg2)))
print('残留旧标题: ' + (', '.join([x for x in ['这不是D&amp;D','了解这里的风土人情','说，你要干嘛','假如...？','摆烂不救'] if x in seg2]) or '无 ✓'))
