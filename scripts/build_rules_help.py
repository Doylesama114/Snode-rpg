#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 冒险者基础规则.xlsx 生成 help.html 的规则章节（依照原文件，不做语义改写）。

只重建「非兼职」章节（兼职规则由 sync_multiclass_help.py 管理，含托管标记，不在此处理）。
用法：
  python scripts/build_rules_help.py --check   # 显示将写入的章节与行数
  python scripts/build_rules_help.py --write   # 写入 help.html + 镜像
"""
from __future__ import annotations

import argparse
import html
import json
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

# xlsx 表名 → help.html 章节 id（None = 新增章节，插到 after 之后）
SHEETS = [
    ('检定规则', 's1', None),          # 本次变更 +11 行
    ('战斗规则', 's2', None),          # 本次变更 +18 行（战斗区间制）
    ('冒险规则', 's-adventure', 's2'),  # 本次新增表，插在战斗规则之后
    ('其他规则', 's10', None),         # 本次 1 处措辞更新
]
HEADING_MAX = 16


def sheet_rows(ws) -> list[list[str]]:
    rows = []
    for r in ws.iter_rows(values_only=True):
        cells = [('' if c is None else str(c).strip()) for c in r]
        while cells and cells[-1] == '':
            cells.pop()
        if any(cells):
            rows.append(cells)
    return rows


def cell_html(text: str) -> str:
    return html.escape(text).replace(chr(10), '<br>')


def row_to_html(rows: list[list[str]]) -> str:
    """把一张表渲染为：段落 + 表格（连续多列行合并成一张表）"""
    out: list[str] = []
    table: list[list[str]] = []

    def flush():
        nonlocal table
        if not table:
            return
        out.append('<div class="wrap"><table>')
        for r in table:
            cells = ''.join('<td>%s</td>' % cell_html(c) for c in r)
            out.append('<tr>%s</tr>' % cells)
        out.append('</table></div>')
        table = []

    for r in rows:
        nonempty = [c for c in r if c]
        if len(nonempty) == 1:
            flush()
            t = nonempty[0]
            if len(t) <= HEADING_MAX and '。' not in t and not t.startswith(('·', '★', '→', 'D', '↓')):
                out.append('<h3>%s</h3>' % html.escape(t))
            else:
                out.append('<p>%s</p>' % cell_html(t))
        else:
            table.append(r)
    flush()
    return NL.join(out)


def build_section(title: str, sid: str, body: str) -> str:
    return '<div class="section" id="%s"><h2>%s</h2>%s%s</div>' % (sid, html.escape(title), NL, body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    text = HELP.read_text(encoding='utf-8')
    report = []
    inserts: list[tuple[str, str]] = []      # (after_id, html)

    for name, sid, after in SHEETS:
        if name not in wb.sheetnames:
            report.append('缺少表: %s' % name)
            continue
        rows = sheet_rows(wb[name])
        body = row_to_html(rows)
        section = build_section(name, sid, body)
        block_re = re.compile(r'<div class="section" id="%s">.*?(?=<div class="section" id=|</main>)' % re.escape(sid), re.S)
        if block_re.search(text):
            report.append('替换  %-14s id=%-12s 行数=%d 长度=%d' % (name, sid, len(rows), len(section)))
            if args.write:
                text = block_re.sub(lambda m: section + NL, text, count=1)
        elif after:
            anchor_re = re.compile(r'(<div class="section" id="%s">.*?)(?=<div class="section" id=|</main>)' % re.escape(after), re.S)
            m = anchor_re.search(text)
            if not m:
                report.append('✗ 找不到插入锚点 %s（表 %s）' % (after, name))
                continue
            report.append('新增  %-14s id=%-12s 插在 %s 之后 行数=%d' % (name, sid, after, len(rows)))
            if args.write:
                text = text[:m.end()] + section + NL + text[m.end():]
        else:
            report.append('✗ 未找到章节且无锚点: %s (%s)' % (name, sid))
    wb.close()

    print(NL.join(report))
    if args.check:
        print('OK' if not any(r.startswith('✗') or r.startswith('缺少') for r in report) else 'FAIL')
        return 0
    if not args.write:
        ap.print_help()
        return 0

    HELP.write_text(text, encoding='utf-8', newline='')
    if MIRROR.parent.exists():
        shutil.copyfile(HELP, MIRROR)
    print('✅ help.html 规则章节已按 xlsx 重建并同步镜像')

    # 目录：确保新章节有条目
    if 'href="#s-adventure"' not in text:
        toc_re = re.compile(r'(<a href="#s2">战斗规则</a>\s*)')
        m = toc_re.search(text)
        if m:
            text = text[:m.end()] + '<a href="#s-adventure">冒险规则</a>' + NL + text[m.end():]
            HELP.write_text(text, encoding='utf-8', newline='')
            if MIRROR.parent.exists():
                shutil.copyfile(HELP, MIRROR)
            print('✅ 目录已新增「冒险规则」条目')
        else:
            print('⚠ 目录锚点未匹配，请手工补「冒险规则」目录项')
    return 0


if __name__ == '__main__':
    sys.exit(main())
