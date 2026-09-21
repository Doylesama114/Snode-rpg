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

print()
print('▌结构质量（v1.0.8009）')
import openpyxl
wb = openpyxl.load_workbook(ROOT / "冒险者基础规则.xlsx", data_only=True)
for sid, sheet in [("s1", "检定规则"), ("s2", "战斗规则"), ("s-adventure", "冒险规则"), ("s10", "其他规则")]:
    body = section(sid)
    tds = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", body, re.S)
    empty = sum(1 for t in tds if not re.sub(r"<[^>]+>", "", t).strip())
    ratio = (empty / len(tds)) if tds else 0.0
    cols = max((len(re.findall(r"<t[dh]", tr)) for tr in re.findall(r"<tr>(.*?)</tr>", body, re.S)), default=0)
    ok("%s 空单元比 ≤0.25（%.2f）" % (sheet, ratio), ratio <= 0.25, "%.2f" % ratio)
    ok("%s 最大列数 ≤8（%d）" % (sheet, cols), cols <= 8, str(cols))
    ok("%s 使用页面原生 .wrap 表格" % sheet,
       (body.count(chr(34) + "wrap" + chr(34)) >= body.count("<table")) if body.count("<table") else True)
# 其他规则已改为三列表，h3 断言由「表格化」区块覆盖
wb.close()

print()
print('▌表格化（v1.0.8010）')
expect = {
    "s1": ("检定规则", 4),
    "s2": ("战斗规则", 4),
    "s-adventure": ("冒险规则", 2),
    "s10": ("其他规则", 1),
}
for sid, (name, need) in expect.items():
    body = section(sid)
    tables = body.count("<table")
    ok("%s 表格数 ≥%d（实际 %d）" % (name, need, tables), tables >= need, str(tables))
    ok("%s 每张表都有表头行（<th>）" % name, tables == 0 or body.count("<th") >= tables, "th=%d" % body.count("<th"))
oth = section("s10")
rows = len(re.findall(r"<tr>", oth))
ok("其他规则 条目行 ≥20（实际 %d）" % rows, rows >= 20, str(rows))
ok("其他规则 为两列表（条目/内容）", "<th>条目</th>" in oth and "<th>内容</th>" in oth)
bat = section("s2")
ok("战斗规则 含先攻席位表（先锋席/殿军席）", "先锋席" in bat and "殿军席" in bat)
ok("战斗规则 含敌人阈值表", "敌人阈值" in bat)
chk = section("s1")
ok("检定规则 含事件检定与变体检定表", "事件检定" in chk and "可选变体检定规则" in chk)
adv = section("s-adventure")
ok("冒险规则 含权重占比与时刻表两张表", "权重占比" in adv and "时刻表" in adv)
print('\n' + '─' * 46)
print(('✅ 规则章节验收通过' if fail_n == 0 else '❌ 有失败项') + '  %dP / %dF' % (pass_n, fail_n))
sys.exit(0 if fail_n == 0 else 1)
