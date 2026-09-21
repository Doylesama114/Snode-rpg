#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 冒险者基础规则.xlsx 生成 help.html 的规则章节（内容照原文，排版对齐手写章节）。

v3 = 逐节模板（表格化，修复 v1.0.8009 线性化导致的"无表格"问题）：
  · 手写章节范式：<h3>分组</h3> + <table><tr><th>名称</th><th>内容</th></tr><tr><td><b>项</b></td><td>正文<br>续行</td></tr></table>
  · 检定规则 / 战斗规则：合并单元格→colspan，空列压缩，首行转 <th> 表头（≥4 张表）
  · 冒险规则：两张表（权重占比 / 时刻表进度）+「荒野之中」小节
  · 其他规则：一张三列表（# | 条目 | 内容），25 行
用法：
  python scripts/build_rules_help.py --check
  python scripts/build_rules_help.py --write
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
HEADING_MAX = 16
NUM_ITEM = re.compile(r'^\s*\d+[.、]\s*\S')

SHEETS = [
    ('检定规则', 's1', None),
    ('战斗规则', 's2', None),
    ('冒险规则', 's-adventure', 's2'),
    ('其他规则', 's10', None),
]

EXTRA_CSS = """
<style>
/* ==== 规则章节表格（v1.0.8010）：对齐手写章节（表头行 + 名称加粗 + 斑马纹） ==== */
.rules-table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 14.5px; line-height: 1.66; }
.rules-table th { background: linear-gradient(180deg, #efe0bd, #e4d2a8); color: #43301a; font-weight: 700; }
.rules-table th, .rules-table td { border: 1px solid rgba(120, 96, 60, .3); padding: 8px 10px; text-align: left; vertical-align: top; }
.rules-table td b { color: #6b4a28; }
.rules-table tbody tr:nth-child(even) td { background: rgba(255, 252, 244, .55); }
.rules-table .col-idx { width: 44px; text-align: center; color: #a8802f; font-weight: 700; }
.rules-table .col-name { width: 210px; }
.rules-table.fixed { table-layout: fixed; }
@media (max-width: 640px) {
  .rules-table { font-size: 14px; }
  .rules-table .col-name { width: 128px; }
}
</style>
"""


def load_blocks(name: str):
    """把 xlsx 解析为 [(标题, 正文)]：标题=短单元格，正文=其下方/右侧的合并块文本。"""
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb[name]
    covered = {}
    for rng in ws.merged_cells.ranges:
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                if (r, c) != (rng.min_row, rng.min_col):
                    covered[(r, c)] = (rng.min_row, rng.min_col)

    def text(r, c):
        v = ws.cell(row=r, column=c).value
        return '' if v is None else str(v).strip()

    items = []          # (row, col, title)
    bodies = {}         # (row, col) -> list[str]
    for rng in ws.merged_cells.ranges:
        r0, c0 = rng.min_row, rng.min_col
        t = text(r0, c0)
        if not t:
            continue
        if rng.max_row > r0:
            bodies[(r0, c0)] = [t]
        elif len(t) > HEADING_MAX or '。' in t:
            bodies[(r0, c0)] = [t]
        else:
            items.append((r0, c0, t))
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            if (r, c) in covered or (r, c) in bodies:
                continue
            t = text(r, c)
            if not t:
                continue
            merged = any(rng.min_row <= r <= rng.max_row and rng.min_col <= c <= rng.max_col for rng in ws.merged_cells.ranges)
            if merged:
                continue
            if len(t) <= HEADING_MAX and '。' not in t and not t.startswith(('·', '★', '↓', '→', 'D')):
                items.append((r, c, t))
            else:
                bodies[(r, c)] = [t]
    wb.close()

    items.sort(key=lambda x: (x[0], x[1]))
    out = []
    for (r, c, title) in items:
        body = []
        for (br, bc), txts in bodies.items():
            if bc == c and br > r and br <= r + 12:
                body.extend(txts)
        out.append((title, body))
    return out, bodies


def load_sheet(name: str):
    """单元格/合并感知的表网格（保留 colspan/rowspan，压掉全空列）。"""
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb[name]
    top_left, covered = {}, set()
    for rng in ws.merged_cells.ranges:
        r1, c1, r2, c2 = rng.min_row, rng.min_col, rng.max_row, rng.max_col
        top_left[(r1, c1)] = (r2 - r1 + 1, c2 - c1 + 1)
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                if (r, c) != (r1, c1):
                    covered.add((r, c))

    def val(r, c):
        v = ws.cell(row=r, column=c).value
        return '' if v is None else str(v).strip()

    rows = []
    for r in range(1, ws.max_row + 1):
        cells = []
        for c in range(1, ws.max_column + 1):
            if (r, c) in covered:
                continue
            t = val(r, c)
            rowspan, colspan = top_left.get((r, c), (1, 1))
            if colspan > 4:
                colspan = 1
            if rowspan > 4:
                rowspan = 1
            if not t and rowspan == 1 and colspan == 1:
                continue
            cells.append({'text': t, 'rowspan': rowspan, 'colspan': colspan})
        if any(x['text'] for x in cells):
            rows.append(cells)
    wb.close()
    used = set()
    for r in rows:
        for i, x in enumerate(r):
            if x['text'] or x['rowspan'] > 1 or x['colspan'] > 1:
                used.add(i)
    if used:
        keep = sorted(used)
        rows = [[x for i, x in enumerate(r) if i in keep] for r in rows]
    return rows


def esc(t: str) -> str:
    return html.escape(t).replace(NL, '<br>').replace(chr(10), '<br>')


def render_table(rows, header: bool = True, cls: str = 'rules-table') -> str:
    out = ['<table class="%s">' % cls]
    for i, row in enumerate(rows):
        tds = []
        for x in row:
            attrs = ''
            if x['colspan'] > 1:
                attrs += ' colspan="%d"' % x['colspan']
            if x['rowspan'] > 1:
                attrs += ' rowspan="%d"' % x['rowspan']
            tag = 'th' if (header and i == 0 and x['text']) else 'td'
            body = esc(x['text'])
            if tag == 'td' and x['text'] and len(x['text']) <= 18 and '。' not in x['text']:
                body = '<b>%s</b>' % body
            tds.append('<%s%s>%s</%s>' % (tag, attrs, body, tag))
        out.append('<tr>%s</tr>' % ''.join(tds))
    out.append('</table>')
    return NL.join(out)


def render_rows(rows) -> str:
    """检定/战斗：连续多列行成表；单列短行→h3；单列长文→p。"""
    parts, table = [], []

    def flush():
        nonlocal table
        if table:
            parts.append(render_table(table))
            table = []

    for row in rows:
        texts = [x['text'] for x in row if x['text']]
        if not texts:
            continue
        if len(texts) == 1:
            flush()
            t = texts[0]
            if len(t) <= HEADING_MAX and '。' not in t:
                parts.append('<h3>%s</h3>' % esc(t))
            else:
                parts.append('<p>%s</p>' % esc(t))
            continue
        table.append(row)
    flush()
    return NL.join(parts)


def render_other_rules(blocks) -> str:
    """其他规则：三列表（# | 条目 | 内容），对齐「名望等级」范式。"""
    rows = ['<table class="rules-table fixed">',
            '<tr><th class="col-idx">#</th><th class="col-name">条目</th><th>内容</th></tr>']
    n = 0
    for title, body in blocks:
        if not title:
            continue
        n += 1
        clean = re.sub(r'^\s*\d+[.、]\s*', '', title)
        content = '<br>'.join(esc(b) for b in body) if body else ''
        rows.append('<tr><td class="col-idx">%d</td><td><b>%s</b></td><td>%s</td></tr>' % (n, esc(clean), content))
    rows.append('</table>')
    return NL.join(rows)


def is_progress(x) -> bool:
    x = (x or '').strip()
    return bool(x) and all(ch.isdigit() or ch in '~-+' for ch in x)


def render_adventure(blocks, rows=None) -> str:
    """冒险规则：权重占比表 + 时刻表 + 荒野之中（从表网格取行，保证成表）"""
    parts: list[str] = []
    flat = rows or []
    texts = [[x["text"] for x in r if x["text"]] for r in flat]

    def find_row(*keys):
        for ts in texts:
            if ts and any(k in ts[0] for k in keys):
                return ts
        return None

    # 1) 基本架构说明
    intro = find_row("冒险的过程")
    parts.append("<h3>冒险故事的基本架构</h3>")
    if intro:
        parts.append("<p>%s</p>" % esc(" ".join(intro)))
    # 2) 权重占比表
    parts.append("<h3>冒险故事权重占比</h3>")
    wrows = [[{"text": "占比项", "rowspan": 1, "colspan": 1}, {"text": "说明", "rowspan": 1, "colspan": 1}]]
    for ts in texts:
        if not ts:
            continue
        head = ts[0].replace(chr(10), "")
        if head in ("不可避免的战斗", "可避免的战斗", "剧情交涉", "解谜"):
            wrows.append([{"text": head, "rowspan": 1, "colspan": 1},
                          {"text": " ".join(ts[1:]).strip(), "rowspan": 1, "colspan": 1}])
    if len(wrows) > 1:
        parts.append(render_table(wrows))
    # 3) 时刻表
    parts.append("<h3>冒险时刻表</h3>")
    trows = [[{"text": "进度", "rowspan": 1, "colspan": 1}, {"text": "场景", "rowspan": 1, "colspan": 1}]]
    for ts in texts:
        if len(ts) >= 2 and is_progress(ts[-2] if len(ts) >= 3 else ""):
            key = ts[-2]
            scene = ts[-1]
            trows.append([{"text": key, "rowspan": 1, "colspan": 1}, {"text": scene, "rowspan": 1, "colspan": 1}])
        elif len(ts) >= 3 and is_progress(ts[1]):
            trows.append([{"text": ts[1], "rowspan": 1, "colspan": 1}, {"text": " ".join(ts[2:]), "rowspan": 1, "colspan": 1}])
    if len(trows) > 1:
        parts.append(render_table(trows))
    else:
        parts.append("<p>一个 DM 与玩家均可视化的进度条：玩家在特定场景做出决定即推进时刻表；达到阈值仍未执行对应行动时会产生后果。</p>")
    # 4) 荒野之中
    wild = [ts for ts in texts if ts and "荒野" in ts[0]]
    parts.append("<h3>可选扩展规则：荒野之中</h3>")
    for ts in wild:
        body = " ".join(ts[1:]).strip()
        if body:
            parts.append("<p>%s</p>" % esc(body))
    return NL.join(parts)

def build_section(title: str, sid: str, body: str) -> str:
    return '<div class="section" id="%s"><h2>%s</h2>%s%s</div>' % (sid, html.escape(title), NL, body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    text = HELP.read_text(encoding='utf-8')
    report, built = [], {}
    for name, sid, after in SHEETS:
        if name in ('其他规则', '冒险规则'):
            blocks, _ = load_blocks(name)
            grid = load_sheet(name)
            body = render_other_rules(blocks) if name == '其他规则' else render_adventure(blocks, grid)
        else:
            body = render_rows(load_sheet(name))
        tables = body.count('<table')
        built[sid] = (name, after, build_section(name, sid, body))
        report.append('%-12s id=%-12s 表格=%-2d h3=%-3d p=%-3d 长度=%d' % (
            name, sid, tables, body.count('<h3>'), body.count('<p>'), len(body)))

    for sid, (name, after, section) in built.items():
        block_re = re.compile(r'<div class="section" id="%s">.*?(?=<div class="section" id=|</main>)' % re.escape(sid), re.S)
        if block_re.search(text):
            if args.write:
                text = block_re.sub(lambda m: section + NL, text, count=1)
        elif after:
            anchor_re = re.compile(r'(<div class="section" id="%s">.*?)(?=<div class="section" id=|</main>)' % re.escape(after), re.S)
            m = anchor_re.search(text)
            if m:
                if args.write:
                    text = text[:m.end()] + section + NL + text[m.end():]
                report.append('  （%s 为新增章节，插在 %s 之后）' % (name, after))
            else:
                report.append('✗ 找不到插入锚点 %s' % after)
        else:
            report.append('✗ 未找到章节 %s' % sid)

    print(NL.join(report))
    if args.check:
        print('OK')
        return 0
    if not args.write:
        ap.print_help()
        return 0

    if 'rules-table' not in text:
        text = text.replace('</body>', EXTRA_CSS + NL + '</body>', 1)
    if 'href="#s-adventure"' not in text:
        m = re.search(r'(<a href="#s2">战斗规则</a>\s*)', text)
        if m:
            text = text[:m.end()] + '<a href="#s-adventure">冒险规则</a>' + NL + text[m.end():]
    HELP.write_text(text, encoding='utf-8', newline='')
    if MIRROR.parent.exists():
        shutil.copyfile(HELP, MIRROR)
    print('✅ help.html 规则章节已按 xlsx 重建（逐节表格模板）并同步镜像')
    return 0


if __name__ == '__main__':
    sys.exit(main())
