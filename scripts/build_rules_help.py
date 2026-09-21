#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 冒险者基础规则.xlsx 生成 help.html 的规则章节（依照原文件，不做语义改写）。

v2 渲染层（修复桌面端可读性）：
  1) 还原合并单元格 → colspan/rowspan（不再补空 <td>，空单元比 0.7→≤0.2）
  2) 按「有效单元格数」选形态：1→段落/小标题；2→字段对(.kv)；≥3→表格
  3) 纯符号行（↓/→）→ 流程行(.flow-arrow)，保留流程图语义
  4) 编号行（1.关于…）→ <h3> + 段落
  5) 表格统一 .rules-table（表头 <th>、斑马纹）
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
SYMBOLS = {'↓', '→', '←', '↑'}
NUM_ITEM = re.compile(r'^\s*\d+[.、]\s*\S')

SHEETS = [
    ('检定规则', 's1', None),
    ('战斗规则', 's2', None),
    ('冒险规则', 's-adventure', 's2'),
    ('其他规则', 's10', None),
]

EXTRA_CSS = """
<style>
/* ==== 规则章节表格统一（v1.0.8009）：表头/斑马纹/内距，与手写章节一致 ==== */
.rules-table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 14.5px; line-height: 1.62; }
.rules-table th, .rules-table td { border: 1px solid rgba(120, 96, 60, .28); padding: 8px 10px; text-align: left; vertical-align: top; }
.rules-table thead th { background: linear-gradient(180deg, #efe0bd, #e4d2a8); color: #43301a; font-weight: 700; }
.rules-table tbody tr:nth-child(even) td { background: rgba(255, 252, 244, .55); }
.kv-list { margin: 8px 0 14px; }
.kv-list .kv { display: grid; grid-template-columns: minmax(96px, 168px) 1fr; gap: 6px 12px; padding: 7px 10px;
  border: 1px solid rgba(120, 96, 60, .22); border-radius: 7px; background: rgba(255, 252, 244, .5); margin-bottom: 6px; }
.kv-list .kv b { color: #6b4a28; font-weight: 700; }
.flow-arrow { text-align: center; color: #a8802f; font-size: 17px; line-height: 1.1; margin: 2px 0; }
@media (max-width: 640px) {
  .rules-table { font-size: 14px; }
  .kv-list .kv { grid-template-columns: 1fr; gap: 2px; }
}
</style>
"""


def load_sheet(name: str):
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
            text = val(r, c)
            rowspan, colspan = top_left.get((r, c), (1, 1))
            # 超宽合并（>4 列/行）是 xlsx 的「段落块」排版，不当作表格跨列
            if colspan > 4:
                colspan = 1
            if rowspan > 4:
                rowspan = 1
            if not text and rowspan == 1 and colspan == 1:
                continue
            cells.append({'text': text, 'rowspan': rowspan, 'colspan': colspan})
        if any(x['text'] for x in cells):
            rows.append(cells)
    wb.close()
    # 压掉「全空列」：表格不再被空列撑宽
    used = set()
    for r in rows:
        for c_idx, x in enumerate(r):
            if x["text"] or x["rowspan"] > 1 or x["colspan"] > 1:
                used.add(c_idx)
    if used:
        keep = sorted(used)
        rows = [[x for c_idx, x in enumerate(r) if c_idx in keep] for r in rows]
    return rows

def esc(t: str) -> str:
    return html.escape(t).replace(NL, '<br>').replace(chr(10), '<br>')


def render_table(block) -> str:
    out = ['<table class="rules-table">']
    for i, row in enumerate(block):
        tds = []
        for x in row:
            attrs = ''
            if x['colspan'] > 1:
                attrs += ' colspan="%d"' % x['colspan']
            if x['rowspan'] > 1:
                attrs += ' rowspan="%d"' % x['rowspan']
            tag = 'th' if (i == 0 and x['text']) else 'td'
            tds.append('<%s%s>%s</%s>' % (tag, attrs, esc(x['text']), tag))
        out.append('<tr>%s</tr>' % ''.join(tds))
    out.append('</table>')
    body = NL.join(out)
    first = block[0]
    if first and all(len(x['text']) <= 14 and '。' not in x['text'] for x in first if x['text']):
        body = body.replace('<table class="rules-table">' + NL + '<tr>', '<table class="rules-table">' + NL + '<thead>' + NL + '<tr>', 1)
        body = body.replace('</tr>' + NL + '<tr>', '</tr>' + NL + '</thead>' + NL + '<tbody>' + NL + '<tr>', 1)
        if '</tbody>' not in body:
            body = body.replace(NL + '</table>', NL + '</tbody>' + NL + '</table>')
    return '<div class="wrap">' + NL + body + NL + '</div>'


def render_rows(rows) -> str:
    parts: list[str] = []
    table: list = []

    def flush():
        nonlocal table
        if table:
            parts.append(render_table(table))
            table = []

    for row in rows:
        texts = [x['text'] for x in row if x['text']]
        if not texts:
            continue
        if len(texts) == 1 and texts[0] in SYMBOLS:
            flush()
            parts.append('<div class="flow-arrow">%s</div>' % esc(texts[0]))
            continue
        if len(texts) == 1:
            flush()
            t = texts[0]
            if NUM_ITEM.match(t) or (len(t) <= HEADING_MAX and '。' not in t):
                parts.append('<h3>%s</h3>' % esc(t))
            else:
                parts.append('<p>%s</p>' % esc(t))
            continue
        if len(texts) == 2 and all(len(t) < 60 for t in texts):
            flush()
            kv = '<div class="kv"><b>%s</b><span>%s</span></div>' % (esc(texts[0]), esc(texts[1]))
            if parts and parts[-1].startswith('<div class="kv-list">'):
                parts[-1] = parts[-1][: -len('</div>')] + kv + '</div>'
            else:
                parts.append('<div class="kv-list">' + kv + '</div>')
            continue
        table.append(row)
    flush()
    return NL.join(parts)


def render_prose(rows) -> str:
    """杂志式多栏排版 → 按阅读顺序线性化：编号项→<h3>，正文→<p>"""
    parts: list[str] = []
    for row in rows:
        for x in row:
            t = x["text"]
            if not t:
                continue
            if NUM_ITEM.match(t) or (len(t) <= HEADING_MAX and "。" not in t and t not in SYMBOLS):
                parts.append("<h3>%s</h3>" % esc(t))
            else:
                parts.append("<p>%s</p>" % esc(t))
    return NL.join(parts)


def build_section(title: str, sid: str, body: str) -> str:
    return '<div class="section" id="%s"><h2>%s</h2>%s%s</div>' % (sid, html.escape(title), NL, body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    text = HELP.read_text(encoding='utf-8')
    report = []
    sections = {}
    for name, sid, after in SHEETS:
        rows = load_sheet(name)
        # 杂志式多栏排版（其他规则）：线性化，避免三栏超高单元格
        body = render_prose(rows) if name in ('其他规则', '冒险规则') else render_rows(rows)
        sections[sid] = (name, after, build_section(name, sid, body), rows, body)
        report.append('%-14s id=%-12s 行=%-3d 表格=%d 标题/段落=%d 最大有效列=%d' % (
            name, sid, len(rows), body.count('<table'), body.count('<p>') + body.count('<h3>'),
            max((sum(1 for x in r if x['text']) for r in rows), default=0)))

    for sid, (name, after, section, rows, body) in sections.items():
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
    print('✅ help.html 规则章节已按 xlsx 重建（colspan 还原 + 统一表格样式）并同步镜像')
    return 0


if __name__ == '__main__':
    sys.exit(main())
