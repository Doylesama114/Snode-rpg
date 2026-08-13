# -*- coding: utf-8 -*-
"""Build 斯诺德物资大全.xlsx -> 斯诺德跑团/store_data.js"""
import io
import openpyxl

SRC = r'D:\Download\scholar-agent-main\斯诺德物资大全.xlsx'
OUT = r'D:\Download\scholar-agent-main\斯诺德跑团\store_data.js'

HEADER_NAMES = {'类别': 'cat', '名称': 'name', '售价': 'price', '载重': 'weight', '负重': 'weight',
                '简介': 'desc', '品质': 'quality'}

SHEET_CATS = {1: '杂物', 2: '武器', 3: '草药', 4: '宝石', 5: '零件',
              6: '常见道具', 7: '卷轴', 8: '生物素材', 9: '魔法道具'}

wb = openpyxl.load_workbook(SRC, data_only=True)
store = {}
order = []
total = 0

for ws in wb.worksheets:
    max_col = ws.max_column
    sheet_cat = SHEET_CATS.get(wb.worksheets.index(ws) + 1, '未分类')
    # 表头行（第 2 行）
    header = {}
    for c in range(1, max_col + 1):
        v = ws.cell(row=2, column=c).value
        if v and str(v).strip() in HEADER_NAMES:
            header[c] = HEADER_NAMES[str(v).strip()]
    if not header:
        continue
    # 数据行（第 3 行起）
    cur_cat = None
    group = None
    def flush():
        global total
        if group and group.get('name'):
            cat = sheet_cat
            if cat not in store:
                store[cat] = []
                order.append(cat)
            for _prev in store[cat]:
                if _prev['name'] == group['name']:
                    return
            group['cat'] = cur_cat or ''
            store[cat].append(group)
            total += 1
    for r in range(3, ws.max_row + 1):
        row_vals = {}
        for c, key in header.items():
            row_vals[c] = ws.cell(row=r, column=c).value
        # 按组切分：'类别' 列是组起点
        cols = sorted(header.keys())
        starts = [c for c in cols if header[c] == 'cat']
        groups_bound = []
        for i, s in enumerate(starts):
            end = starts[i + 1] if i + 1 < len(starts) else (max(cols) + 1)
            groups_bound.append((s, end))
        row_had_new = False
        for (s, end) in groups_bound:
            cat = row_vals.get(s)
            if cat is not None and str(cat).strip():
                flush()
                cur_cat = str(cat).strip()
                group = {'cat': cur_cat}
            elif group is None:
                group = {'cat': cur_cat or ''}
            name = None
            price = None
            weight = None
            desc = None
            quality = None
            for c in range(s, end):
                key = header.get(c)
                if key is None:
                    continue
                v = row_vals.get(c)
                if v is None:
                    continue
                sv = str(v).strip()
                if key == 'name' and not name and sv:
                    name = sv
                elif key == 'price' and not price and sv:
                    price = sv
                elif key == 'weight' and not weight and sv:
                    weight = sv
                elif key == 'desc' and not desc and sv:
                    desc = sv
                elif key == 'quality' and not quality and sv:
                    quality = sv
            if name:
                group['name'] = name
                if price:
                    group['price'] = price
                if weight:
                    group['weight'] = weight
                if desc:
                    group['desc'] = desc
                if quality:
                    group['quality'] = quality
                flush()
                group = None
    flush()

# 输出 JS
buf = io.StringIO()
buf.write('// Auto-generated from 斯诺德物资大全.xlsx — store data\n')
buf.write('var STORE_DATA = {\n')
for cat in order:
    items = store[cat]
    buf.write('  %s: [\n' % repr(cat))
    for it in items:
        buf.write('    {name:%s' % repr(it['name']))
        if 'price' in it:
            buf.write(',price:%s' % repr(it['price']))
        if 'weight' in it:
            buf.write(',weight:%s' % repr(it['weight']))
        if 'desc' in it:
            buf.write(',desc:%s' % repr(it['desc']))
        if 'quality' in it:
            buf.write(',quality:%s' % repr(it['quality']))
        buf.write('},\n')
    buf.write('  ],\n')
buf.write('};\n')
io.open(OUT, 'w', encoding='utf-8').write(buf.getvalue())
print('categories:', order)
print('total items:', total)
print('written:', OUT)
