# -*- coding: utf-8 -*-
"""规则章节验收：内容与 xlsx 一致 + 新章节可用（v1.0.8008）"""
import re, sys
from pathlib import Path
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
ROOT = Path('.').resolve()
text = (ROOT / '斯诺德跑团/help.html').read_text(encoding='utf-8')
mirror = (ROOT / 'electron-app/斯诺德跑团/help.html').read_text(encoding='utf-8')
pass_n = fail_n = 0
def ok(name, cond, extra=''):
    global pass_n, fail_n
    if cond: pass_n += 1; print('  ✓ ' + name)
    else: fail_n += 1; print('  ✗ ' + name + (' → ' + extra if extra else ''))

def section(sid):
    m = re.search(r'<div class="section" id="%s">(.*?)(?=<div class="section" id=|</main>)' % re.escape(sid), text, re.S)
    return m.group(1) if m else ''

print('▌规则章节内容（对照冒险者基础规则.xlsx）')
adv = section('s-adventure')
ok('新增「冒险规则」章节存在', bool(adv))
ok('冒险规则含表（权重占比/时刻表进度）', '冒险故事' in adv and '时刻表' in adv)
ok('冒险规则含「可选扩展规则：荒野之中」', '荒野之中' in adv)
ok('目录含冒险规则条目', 'href="#s-adventure"' in text)
bat = section('s2')
for kw, label in [('战斗区间', '战斗区间'), ('先锋席', '先锋席(16~20+)'), ('中坚席', '中坚席(11~15)'),
                  ('后卫席', '后卫席(6~10)'), ('殿军席', '殿军席(1~5)'), ('敌人阈值', '敌人阈值机制'),
                  ('反应动作', '反应动作(限三次)')]:
    ok('战斗规则含「%s」' % label, kw in bat)
chk = section('s1')
for kw, label in [('事件检定', '事件检定'), ('可选变体检定规则', '可选变体检定规则'), ('D6', '三颗D6判定')]:
    ok('检定规则含「%s」' % label, kw in chk)
oth = section('s10')
ok('其他规则章节仍存在且非空', len(oth) > 200)
ok('页面无未闭合 table（%d 个 <table> / %d 个 </table>）' % (text.count('<table'), text.count('</table>')),
   text.count('<table') == text.count('</table>'))
ok('镜像与源一致', text == mirror)
print('\n' + '─' * 46)
print(('✅ 规则章节验收通过' if fail_n == 0 else '❌ 有失败项') + '  %dP / %dF' % (pass_n, fail_n))
sys.exit(0 if fail_n == 0 else 1)
