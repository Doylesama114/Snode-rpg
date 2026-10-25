#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把《冒险者基础规则》xlsx 的内容同步进 help.html 的对应章节。

原则（防缺失/错位/撕裂）：
1. 只更新/追加，不删除站点已有内容；
2. 工作簿里已经能在站点章节文本中找到的内容一律跳过（避免重复）；
3. 能 1:1 对应（相似度 ≥ 0.6）的单元，原地替换该元素的文本，保留标签与表格结构；
4. 找不到归属的新内容，按「段落 / 表格」追加到章节末尾；
5. 每次运行输出统计，配合结构指纹校验使用。
"""
from __future__ import annotations
import argparse, difflib, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ROOT = Path(__file__).resolve().parent.parent
HELP = ROOT / '斯诺德跑团' / 'help.html'

CHAPTERS = {
    '基本规则': ('s0', 's1'),
    '检定规则': ('s1', 's2'),
    '战斗规则': ('s2', 's-adventure'),
    '冒险规则': ('s-adventure', 's3'),
    '升级规则': ('s3', 's4'),
    '兼职规则': ('s4', 's5'),
    '幕间规则': ('s5', 's6'),
    '技能点和色彩标识规则': ('s6', 's7'),
    '异常状态规则': ('s7', 's8'),
    '关键词规则': ('s8', 's9'),
    '名望等级和声望规则': ('s9', 's10'),
    '其他规则': ('s10', None),
}


def norm(t: str) -> str:
    t = re.sub(r'\s+', '', t or '')
    return re.sub(r'[，。！？；：、（）()【】“”"\'·.,!?;:—\-]', '', t)


def read_sheet(xlsx: Path, sheet: str) -> dict[int, dict[str, str]]:
    z = zipfile.ZipFile(xlsx)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        st = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in st.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap = {r.get('Id'): r.get('Target') for r in rels}
    for sh in wb.find('m:sheets', NS):
        if sh.get('name') != sheet:
            continue
        tgt = relmap[sh.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')].lstrip('/')
        if not tgt.startswith('xl/'):
            tgt = 'xl/' + tgt
        root = ET.fromstring(z.read(tgt))
        rows = {}
        for row in root.findall('.//m:sheetData/m:row', NS):
            cells = {}
            for c in row.findall('m:c', NS):
                ref = c.get('r'); t = c.get('t'); v = c.find('m:v', NS); isel = c.find('m:is', NS)
                val = ''
                if t == 's' and v is not None and v.text is not None:
                    val = shared[int(v.text)]
                elif t == 'inlineStr' and isel is not None:
                    val = ''.join(x.text or '' for x in isel.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
                elif v is not None and v.text is not None:
                    val = v.text
                if val.strip():
                    cells[ref] = val.strip()
            if cells:
                rows[int(row.get('r'))] = cells
        return rows
    raise SystemExit('sheet not found: ' + sheet)


def col_order(ref: str):
    letters = re.sub(r'\d', '', ref)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n


def section_bounds(html: str, sid: str, nxt: str | None):
    start = html.find('<div class="section" id="' + sid + '"')
    if start < 0:
        raise SystemExit('section not found: ' + sid)
    if nxt:
        end = html.find('<div class="section" id="' + nxt + '"')
    else:
        end = html.find('</main>', start)
    return start, end


def escape(t: str) -> str:
    return (t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--verbose', action='store_true')
    args = ap.parse_args()
    rows = read_sheet(ROOT / '10.25更新内容' / '冒险者基础规则.xlsx', args.sheet)
    sid, nxt = CHAPTERS[args.sheet]
    html = HELP.read_text(encoding='utf-8')
    start, end = section_bounds(html, sid, nxt)
    seg = html[start:end]
    seg_norm = norm(re.sub(r'<[^>]+>', ' ', seg))
    # 站点可替换元素
    elems = []
    for m in re.finditer(r'<(h3|p|td|th|li)\b[^>]*>(.*?)</\1>', seg, re.S):
        txt = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        elems.append((m.start(2), m.end(2), txt))
    used = set()
    replaced = 0
    appended = []
    for r in sorted(rows):
        row_units = []
        for k in sorted(rows[r], key=col_order):
            v = rows[r][k]
            if len(v) < 20 or not any(ch in v for ch in '。，；：、'):
                continue
            nv = norm(v)
            if not nv:
                continue
            if nv in seg_norm:
                continue
            row_units.append(v)
        for v in row_units:
            nv = norm(v)
            best = None; best_ratio = 0.0
            for idx, (s0, e0, txt) in enumerate(elems):
                if idx in used or not txt or len(norm(txt)) < 8:
                    continue
                nt = norm(txt)
                ratio = difflib.SequenceMatcher(None, nv, nt).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio; best = idx
            # 表格首列已显示颜色名时，去掉正文里重复的颜色前缀（工作簿写作「红色象征…」）
            if best is not None and best_ratio >= 0.6:
                _m = re.match(r'^(红色|蓝色|绿色|黄色|橙色|青色|碧色|紫色|粉色|棕色|黑色|白色|无色)', v)
                if _m:
                    _rest = v[_m.end():]
                    _old = elems[best][2]
                    if norm(_rest) == norm(_old) or difflib.SequenceMatcher(None, norm(_rest), norm(_old)).ratio() >= 0.8:
                        v = _rest.lstrip('象征').strip()

                s0, e0, txt = elems[best]
                if args.verbose:
                    print('  [替换] %s\n      -> %s' % (txt[:60], v[:60]))
                seg = seg[:s0] + escape(v) + seg[e0:]
                replaced += 1
                # 位置已变化：重扫元素列表后继续
                elems = []
                for m in re.finditer(r'<(h3|p|td|th|li)\b[^>]*>(.*?)</\1>', seg, re.S):
                    t2 = re.sub(r'<[^>]+>', '', m.group(2)).strip()
                    elems.append((m.start(2), m.end(2), t2))
                seg_norm = norm(re.sub(r'<[^>]+>', ' ', seg))
                used = set()
            elif best_ratio < 0.6:
                appended.append(v)
    if appended and args.verbose:
        for v in appended[:20]:
            print('  [追加] ' + v[:70])
    if appended:
        blocks = []
        if len(appended) >= 4:
            blocks.append('<h3>补充规则（10.25 更新）</h3>')
            blocks.append('<div class="wrap">')
            blocks.append('<table>')
            blocks.append('<colgroup><col style="width:200px"><col></colgroup>')
            blocks.append('<tr><th>条目</th><th>内容</th></tr>')
            for v in appended:
                blocks.append('<tr><td>—</td><td>' + escape(v) + '</td></tr>')
            blocks.append('</table>')
            blocks.append('</div>')
        else:
            for v in appended:
                blocks.append('<p>' + escape(v) + '</p>')
        seg = seg.rstrip() + chr(10) + chr(10).join(blocks) + chr(10)
    print('%s(%s) 替换 %d 处 | 追加 %d 段' % (args.sheet, sid, replaced, len(appended)))
    if args.apply:
        HELP.write_text(html[:start] + seg + html[end:], encoding='utf-8')
        print('  已写入 help.html')
    return 0


if __name__ == '__main__':
    sys.exit(main())