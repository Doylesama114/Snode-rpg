#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 冒险者基础规则.xlsx 生成 help.html 的规则章节。

v5（按语义编排，内容照原文单元格）：
  · 战斗规则 = ① 战斗流程图（三列：时刻 | 执行/结算 | 阶段归类，归类列合并）② 动作表（主要/附赠）
              ③ 特别注释（反应动作 / 先攻顺位 / 战斗区间四席位 / 敌人阈值）
  · 冒险规则 = ① 基本架构 ② 时刻表（含进度表）③ 权重占比（含表下注解）④ 荒野之中
  · 其他规则 = 两列（条目 | 内容），**单元格软换行合并为自然段**，仅保留列表标记处断行
用法：python scripts/build_rules_help.py --write
"""
from __future__ import annotations

import argparse
import html
import re
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / '冒险者基础规则.xlsx'
HELP = ROOT / '斯诺德跑团' / 'help.html'
MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'help.html'
NL = chr(10)
LIST_MARK = re.compile(r'^\s*([0-9]+[.、]|[·★①②③④⑤⑥⑦⑧⑨⑩]|D[1-9][.、]|→|↓)')
NAME_W = '150px'


def sheet(name):
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    return wb, wb[name]


def flat(text: str) -> str:
    """单元格软换行 → 自然段：只在列表标记处断行，其余行合并。"""
    if not text:
        return ''
    lines = [l.strip() for l in str(text).split(NL) if l.strip()]
    out = []
    for l in lines:
        if LIST_MARK.match(l) or not out:
            out.append(l)
        else:
            out[-1] = out[-1] + l
    return '<br>'.join(html.escape(x) for x in out)


def table(rows, header=None, widths=None) -> str:
    n = max([len(r) for r in rows] + ([len(header)] if header else [0]))
    widths = widths or [NAME_W] + [''] * (n - 1)
    cols = ''.join('<col style="width:%s">' % w if w else '<col>' for w in widths[:n])
    parts = ['<div class="wrap">', '<table>', '<colgroup>%s</colgroup>' % cols]
    if header:
        parts.append('<tr>%s</tr>' % ''.join('<th>%s</th>' % h for h in header))
    for r in rows:
        tds = []
        for i, cell in enumerate(r):
            if isinstance(cell, tuple):          # (内容, rowspan)
                tds.append('<td rowspan="%d">%s</td>' % (cell[1], cell[0]))
            else:
                tds.append('<td>%s</td>' % cell)
        parts.append('<tr>%s</tr>' % ''.join(tds))
    parts += ['</table>', '</div>']
    return NL.join(parts)


# ---------------- 战斗规则 ----------------

def render_combat() -> str:
    wb, ws = sheet('战斗规则')

    def v(r, c):
        x = ws.cell(row=r, column=c).value
        return '' if x is None else str(x).strip()

    def f(r, c):
        return flat(v(r, c))

    flow = []
    stages = [(4, '战斗开始的准备工作'), (6, None), (8, '战斗环节中的流程' + '<br>（以此循环往复）'), (10, None), (48, None), (50, '最终结果的结算')]
    rows = []
    spans = {0: 2, 2: 3, 5: 1}          # 归类列合并：1-2 / 3-5 / 6
    for idx, (r, label) in enumerate(stages):
        time_cell = f(r, 2)
        if r == 10:                      # 行动时刻：明确列出主要动作与附赠动作
            time_cell = f(r, 2)
            row_content = '主要动作<br>附赠动作<br><span style="color:#69706b">（详见下表）</span>'
        row = [time_cell, row_content if r == 10 else f(r, 8)]
        if idx in spans and label:
            row.append((label, spans[idx]))
        rows.append(row)
    parts = ['<h3>战斗流程图</h3>', table(rows, ['时刻', '该时刻执行 / 结算的内容', '阶段归类'], [NAME_W, '', '190px'])]

    main_items = [v(r, 11) for r in range(10, 25, 2) if v(r, 11)]
    bonus_items = [v(r, 11) for r in range(26, 47, 2) if v(r, 11)]
    nums = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫'
    m_html = '<br>'.join('%s%s' % (nums[i] if i < len(nums) else '%d.' % (i + 1), flat(t)) for i, t in enumerate(main_items))
    b_html = '<br>'.join('%s%s' % (nums[i] if i < len(nums) else '%d.' % (i + 1), flat(t)) for i, t in enumerate(bonus_items))
    parts.append('<h3>行动时刻可执行的动作</h3>')
    parts.append(table([[v(10, 8), m_html], [v(26, 8), b_html]], ['动作类型', '可执行行为'], ['150px', '']))

    parts.append('<h3>特别注释</h3>')
    parts.append(table([[v(52, 8), f(52, 11)], [v(55, 8), f(55, 11)]], ['项目', '说明'], ['150px', '']))
    seats = [[f(r, 11), f(r, 13)] for r in range(59, 63)]
    parts.append(table(seats, ['战斗区间', '先攻检定结果'], ['150px', '']))
    parts.append(table([[v(64, 8), f(64, 11) + '<br>' + f(65, 11)]], ['项目', '说明'], ['150px', '']))
    parts.append(table([[f(r, 11), f(r, 16)] for r in range(66, 69)], ['情形', '阈值变化'], ['320px', '']))
    parts.append('<p style="font-size:13.5px;color:#4a4238;line-height:1.75;margin:-6px 0 14px">%s</p>' % f(69, 11))
    wb.close()
    return NL.join(parts)


# ---------------- 冒险规则 ----------------

def render_adventure() -> str:
    wb, ws = sheet('冒险规则')

    def v(r, c):
        x = ws.cell(row=r, column=c).value
        return '' if x is None else str(x).strip()

    def f(r, c):
        return flat(v(r, c))

    parts = ['<h3>冒险故事的基本架构</h3>', '<p>%s</p>' % flat(v(4, 2))]
    parts.append('<h3>冒险时刻表</h3>')
    parts.append('<p>%s</p>' % flat(v(4, 8)))
    parts.append(table([[v(r, 9), flat(v(r, 10))] for r in (10, 14, 18)], ['进度', '场景'], ['96px', '']))
    parts.append('<h3>冒险故事权重占比</h3>')
    wrows = [[v(14, 2), flat(v(14, 3))], [v(18, 2), flat(v(18, 3))], [v(22, 2), flat(v(22, 3))], [v(26, 2), flat(v(26, 3))]]
    parts.append(table(wrows, ['占比项', '说明'], ['150px', '']))
    parts.append('<p class="rules-note" style="font-size:13px;color:#69706b;line-height:1.8;margin:-6px 0 14px">%s</p>' % flat(v(30, 2)))
    parts.append('<h3>可选扩展规则：荒野之中</h3>')
    parts.append('<p>%s</p>' % flat(v(24, 8)))
    wb.close()
    return NL.join(parts)


# ---------------- 其他规则 ----------------

def render_other_rules() -> str:
    wb, ws = sheet('其他规则')
    covered = {}
    for rng in ws.merged_cells.ranges:
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                if (r, c) != (rng.min_row, rng.min_col):
                    covered[(r, c)] = (rng.min_row, rng.min_col)
    titles, bodies = [], {}
    for rng in ws.merged_cells.ranges:
        t = ws.cell(row=rng.min_row, column=rng.min_col).value
        if t is None or not str(t).strip():
            continue
        t = str(t).strip()
        if rng.max_row > rng.min_row or len(t) > 16 or '。' in t:
            bodies[(rng.min_row, rng.min_col)] = t
        else:
            titles.append((rng.min_row, rng.min_col, t))
    titles.sort(key=lambda x: (x[0], x[1]))
    rows, n = [], 0
    for (r, c, title) in titles:
        n += 1
        body = [t for (br, bc), t in sorted(bodies.items()) if bc == c and r < br <= r + 12]
        clean = re.sub(r'^\s*\d+[.、]\s*', '', title)
        rows.append(['%d. %s' % (n, html.escape(clean)), '<br>'.join(flat(b) for b in body)])
    wb.close()
    return table(rows, ['条目', '内容'], ['190px', ''])


def render_check() -> str:
    """检定规则：两列重排（小节标题 + 名称/说明表），合并单元格感知。"""
    wb, ws = sheet('检定规则')
    covered = set()
    for rng in ws.merged_cells.ranges:
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                if (r, c) != (rng.min_row, rng.min_col):
                    covered.add((r, c))
    parts, buf = [], []

    def flush():
        nonlocal buf
        if buf:
            parts.append(table(buf, ['项目', '说明'], ['168px', '']))
            buf = []

    for r in range(1, ws.max_row + 1):
        texts = []
        for c in range(1, ws.max_column + 1):
            if (r, c) in covered:
                continue
            x = ws.cell(row=r, column=c).value
            if x is not None and str(x).strip():
                texts.append(str(x).strip())
        texts = [t for t in texts if t]
        if not texts:
            continue
        if len(texts) == 1:
            flush()
            t = texts[0]
            if len(t) <= 16 and '。' not in t:
                parts.append('<h3>%s</h3>' % html.escape(t))
            else:
                parts.append('<p>%s</p>' % flat(t))
            continue
        buf.append([html.escape(texts[0]), '<br>'.join(flat(t) for t in texts[1:])])
    flush()
    wb.close()
    return NL.join(parts)


def build_section(title, sid, body):
    return '<div class="section" id="%s"><h2>%s</h2>%s%s</div>' % (sid, html.escape(title), NL, body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    text = HELP.read_text(encoding='utf-8')
    built = {
        's1': ('检定规则', None, render_check()),
        's2': ('战斗规则', None, render_combat()),
        's-adventure': ('冒险规则', 's2', render_adventure()),
        's10': ('其他规则', None, render_other_rules()),
    }
    for sid, (name, after, body) in built.items():
        print('%-10s 表格=%d wrap=%d h3=%d' % (name, body.count('<table'), body.count('class="wrap"'), body.count('<h3>')))
    if args.check:
        print('OK')
        return 0
    if not args.write:
        ap.print_help()
        return 0

    for sid, (name, after, body) in built.items():
        section = build_section(name, sid, body)
        block_re = re.compile(r'<div class="section" id="%s">.*?(?=<div class="section" id=|</main>)' % re.escape(sid), re.S)
        if block_re.search(text):
            text = block_re.sub(lambda m: section + NL, text, count=1)
        elif after:
            anchor_re = re.compile(r'(<div class="section" id="%s">.*?)(?=<div class="section" id=|</main>)' % re.escape(after), re.S)
            m = anchor_re.search(text)
            if m:
                text = text[:m.end()] + section + NL + text[m.end():]
    HELP.write_text(text, encoding='utf-8', newline='')
    if MIRROR.parent.exists():
        shutil.copyfile(HELP, MIRROR)
    print('✅ 战斗/冒险/其他规则已按语义编排重建并同步镜像')
    return 0


if __name__ == '__main__':
    sys.exit(main())
