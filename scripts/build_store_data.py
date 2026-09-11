# -*- coding: utf-8 -*-
"""Build 斯诺德物资大全.xlsx -> 斯诺德跑团/store_data.js

v1.0.7269 重写（修复内容缺失）：
- 保留原文件全部列内容：简介（武器伤害/护甲属性/药水与卷轴效果）、品质、负重、第二价格列
  （生物·载具的「租借/天·购买」，酒水的「杯·瓶」）——旧版只导出了 名称/小类/售价/载重 与少量简介。
- 品质与类别按合并单元格向下填充：旧版只取合并区首行，导致 258 条品质只写入 41 条。
- 以「小类 + 名称」为唯一键：修复同名条目被误删（奇械齿轮、零件包 各出现于两个小类）。
- 列标签跟随表头行/子表头行：原文件同一列在不同子表语义不同（如 c15 在容器=载重、在生物=购买价）。

用法：
  python scripts/build_store_data.py            # 生成 store_data.js
  python scripts/build_store_data.py --check    # 只校验现有文件与源文件是否一致
"""
import io
import os
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '斯诺德物资大全.xlsx')
OUT = os.path.join(ROOT, '斯诺德跑团', 'store_data.js')

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# 大分类（与历史数据保持一致，避免破坏商店/角色面板既有分类名）
SHEET_CATS = ['杂物', '武器', '草药', '宝石', '零件', '常见道具', '卷轴', '生物素材', '魔法道具']

# 已知标签（用于识别子表头行）
LABELS = {'类别', '名称', '简介', '售价', '载重', '负重', '品质', '租借/天', '购买', '杯', '瓶'}

# 源数据人工修正（xlsx 笔误，无法程序化推导）
OVERRIDES = {
    '虾肉': {'weight': '1磅'},  # 载重列写成 '2银币'，实际 1磅
}

CORE = {'类别', '名称', '简介', '售价', '载重', '负重', '品质'}


def build_merged_index(ws):
    """(r,c) -> 合并区左上角坐标。

    横向合并（跨列）只把内容算在首列：如 I69:J69「浮动」是售价，不应同时当成载重。
    纵向合并（同列跨行）保留给区间内每一行：类别/品质靠它向下填充。
    """
    idx = {}
    for rng in ws.merged_cells.ranges:
        for r in range(rng.min_row, rng.max_row + 1):
            for c in range(rng.min_col, rng.max_col + 1):
                if rng.min_col != rng.max_col and c != rng.min_col:
                    continue
                idx[(r, c)] = (rng.min_row, rng.min_col)
    return idx


def extract():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    store = {}
    order = []
    stats = {'rows': 0, 'desc': 0, 'quality': 0, 'cap': 0, 'price2': 0, 'extra': 0}
    warnings = []

    for si, ws in enumerate(wb.worksheets):
        big = SHEET_CATS[si] if si < len(SHEET_CATS) else ws.title
        merged = build_merged_index(ws)
        max_col = ws.max_column

        def cell(r, c):
            key = merged.get((r, c))
            if key:
                return ws.cell(row=key[0], column=key[1]).value
            return ws.cell(row=r, column=c).value

        def text(v):
            if v is None:
                return ''
            return str(v).strip()

        # 列块：第 2 行「类别」所在列为块起点
        starts = [c for c in range(1, max_col + 1) if text(ws.cell(row=2, column=c).value) == '类别']
        blocks = []
        for i, s in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else max_col + 1
            base, sub = {}, {}
            for c in range(s, end):
                lb = text(ws.cell(row=2, column=c).value)
                if lb:
                    base[c] = lb
            blocks.append({'s': s, 'end': end, 'base': base, 'sub': sub, 'cat': ''})

        if not blocks:
            continue
        if big not in store:
            store[big] = []
            order.append(big)

        for r in range(3, ws.max_row + 1):
            for blk in blocks:
                s, end = blk['s'], blk['end']
                vals = {c: text(cell(r, c)) for c in range(s, end)}
                nonempty = {c: v for c, v in vals.items() if v}
                if not nonempty:
                    continue

                # 名称列：块内 base==名称 的列（子表头行会重排，但名称列始终固定）
                name_cols = [c for c in range(s, end) if blk['base'].get(c) == '名称']
                name_col = name_cols[0] if name_cols else None
                name = vals.get(name_col, '') if name_col else ''
                if name == '名称':
                    # 重复表头行（xlsx 里表头被复制到各子表之间）：当作表头处理，不是物品
                    name = ''

                # 子表头行 / 完整表头行：无名称，且「本行实际写入」的单元格内容为表头标签
                # 注意用 raw（不含合并继承）判断：原文件里 类别/名称/载重 表头常纵向合并两行，
                # 若用合并后的值判断，子表头行（如 租借/天·购买）会被误当作完整表头而覆盖基线标签。
                raw = {c: text(ws.cell(row=r, column=c).value) for c in range(s, end)}
                label_cells = {c: v for c, v in raw.items() if v in LABELS}
                if not name and label_cells:
                    is_header = any(v in ('类别', '名称', '简介', '售价', '载重', '负重', '品质') for v in label_cells.values())
                    if is_header:
                        # 完整表头：整块列标签以此行重排（原文件同一列在不同子表语义不同，
                        # 例如 c16 在容器块=负重、在生物/酒水子表=载重）
                        blk['base'] = dict(label_cells)
                        blk['sub'] = {}
                    else:
                        blk['sub'].update(label_cells)
                    continue
                if not name:
                    continue

                # 类别（小类）按列块作用域向下填充
                cat_cols = [c for c in range(s, end) if blk['base'].get(c) == '类别']
                for c in cat_cols:
                    v = vals.get(c, '')
                    if v and v != '类别':
                        blk['cat'] = v.replace('\n', '')
                        break

                item = {'name': name}
                if blk['cat']:
                    item['cat'] = blk['cat']
                price_seen = False
                for c in range(s, end):
                    v = vals.get(c, '')
                    if not v:
                        continue
                    lb = blk['base'].get(c, '')
                    sb = blk['sub'].get(c, '')
                    if c == name_col:
                        continue
                    if lb == '类别':
                        continue
                    if lb == '简介':
                        item['desc'] = v
                    elif lb == '品质':
                        item['quality'] = v
                    elif lb == '载重':
                        item['weight'] = v
                    elif lb == '负重':
                        item['cap'] = v
                    elif lb == '售价':
                        item['price'] = v
                        if sb and sb != '售价':
                            item['priceLabel'] = sb
                        price_seen = True
                    elif lb == '' and sb:
                        # 无基线标签、但有子表头（购买 / 瓶）
                        if not price_seen:
                            item['price'] = v
                            item['priceLabel'] = sb
                            price_seen = True
                        else:
                            item['price2'] = v
                            item['price2Label'] = sb
                    else:
                        label = sb or lb
                        item.setdefault('extra', []).append([label, v])

                ov = OVERRIDES.get(name)
                if ov:
                    item.update(ov)
                store[big].append(item)
                stats['rows'] += 1
                for k, key in (('desc', 'desc'), ('quality', 'quality'), ('cap', 'cap'), ('price2', 'price2')):
                    if key in item:
                        stats[k] += 1
                if 'extra' in item:
                    stats['extra'] += 1
                if 'weight' in item and item['weight'] and '磅' not in item['weight']:
                    warnings.append((ws.title, r, name, item['weight']))

        # 该 sheet 处理完毕
    return store, order, stats, warnings


def render_js(store, order):
    buf = io.StringIO()
    buf.write('// Auto-generated from 斯诺德物资大全.xlsx — store data\n')
    buf.write('var STORE_DATA = {\n')
    for cat in order:
        buf.write('  %s: [\n' % repr(cat))
        for it in store[cat]:
            parts = ['name:%s' % repr(it['name'])]
            for key in ('cat', 'price', 'priceLabel', 'price2', 'price2Label', 'weight', 'cap', 'desc', 'quality'):
                if it.get(key):
                    parts.append('%s:%s' % (key, repr(it[key])))
            if it.get('extra'):
                parts.append('extra:%s' % repr([list(x) for x in it['extra']]))
            buf.write('    {%s},\n' % ','.join(parts))
        buf.write('  ],\n')
    buf.write('};\n')
    return buf.getvalue()


def main():
    check = '--check' in sys.argv
    store, order, stats, warnings = extract()
    js = render_js(store, order)

    if check:
        cur = io.open(OUT, encoding='utf-8').read()
        if cur == js:
            print('OK: store_data.js 与源文件一致')
            print('条目 %d ｜ 简介 %d ｜ 品质 %d ｜ 负重 %d ｜ 第二价格 %d ｜ 其他附加列 %d'
                  % (stats['rows'], stats['desc'], stats['quality'], stats['cap'], stats['price2'], stats['extra']))
            return 0
        print('FAIL: store_data.js 与源文件不一致（重新运行 python scripts/build_store_data.py 生成）')
        return 1

    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(js)
    print('categories:', order)
    print('items:', stats['rows'])
    print('with desc:', stats['desc'], '| with quality:', stats['quality'], '| with cap:', stats['cap'],
          '| with price2:', stats['price2'], '| with extra:', stats['extra'])
    if warnings:
        print('weight warnings:')
        for w in warnings:
            print('  ', w)
    print('written:', OUT)
    return 0


if __name__ == '__main__':
    sys.exit(main())
