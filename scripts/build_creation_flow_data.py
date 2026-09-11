# -*- coding: utf-8 -*-
"""Extract 冒险者角色创建流程.xlsx into a web-friendly JS data file.

Produces both a raw sheet grid (for optional table view) and structured records
(title + horizontal label/value fields) so the web viewer never has to squeeze
long Chinese text into narrow spreadsheet columns.
"""
import json
import os
import openpyxl
from openpyxl.utils import range_boundaries

SRC = '冒险者角色创建流程.xlsx'
OUT_DIR = os.path.join('斯诺德跑团', '资料库')
OUT = os.path.join(OUT_DIR, 'creation_flow_data.js')
GROUP_STARTS = [2, 7, 12, 17, 22, 27]  # B, G, L, Q, V, AA
SECTION_LABELS = {'熟练项', '专精', '起始特性', '属性加成', '其他数据', '天赋'}

def text(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)

def find_band_starts(ws, mode):
    starts = set()
    for r in range(1, ws.max_row + 1):
        for col in GROUP_STARTS:
            try:
                if mode == 0:
                    if text(ws.cell(r, col).value) and text(ws.cell(r + 2, col).value) == '职责定位':
                        starts.add(r)
                elif mode == 1:
                    v = text(ws.cell(r, col).value)
                    v1 = text(ws.cell(r + 1, col).value)
                    v2 = text(ws.cell(r + 2, col).value)
                    v3 = text(ws.cell(r + 3, col).value)
                    if v and not v1 and len(v2) >= 40 and not v3:
                        starts.add(r)
                else:
                    if text(ws.cell(r, col).value) and text(ws.cell(r + 2, col).value) == '生命值加成':
                        starts.add(r)
            except Exception:
                pass
    return sorted(starts)

def build_records(ws, band_starts):
    records = []
    for bi, start in enumerate(band_starts):
        end = band_starts[bi + 1] - 1 if bi + 1 < len(band_starts) else ws.max_row
        for col in GROUP_STARTS:
            title = text(ws.cell(start, col).value)
            if not title:
                continue
            fields = []
            for r in range(start + 1, end + 1):
                vals = []
                for c in range(col, min(col + 4, ws.max_column + 1)):
                    v = text(ws.cell(r, c).value)
                    if v:
                        vals.append(v)
                if not vals:
                    continue
                if len(vals) == 1:
                    if vals[0] in SECTION_LABELS:
                        fields.append({'type': 'section', 'text': vals[0]})
                    else:
                        fields.append({'type': 'text', 'text': vals[0]})
                elif len(vals) == 2:
                    fields.append({'type': 'kv', 'label': vals[0], 'value': vals[1]})
                else:
                    pairs = []
                    for i in range(0, len(vals), 2):
                        if i + 1 < len(vals):
                            pairs.append(vals[i] + ' ' + vals[i + 1])
                        else:
                            pairs.append(vals[i])
                    fields.append({'type': 'kv', 'label': '数值', 'value': '、'.join(pairs)})
            records.append({'title': title, 'fields': fields})
    return records

def raw_sheet(ws):
    max_r = 0
    max_c = 0
    for row in ws.iter_rows():
        for c in row:
            if c.value not in (None, ''):
                max_r = max(max_r, c.row)
                max_c = max(max_c, c.column)
    for rng in ws.merged_cells.ranges:
        c1, r1, c2, r2 = range_boundaries(str(rng))
        max_r = max(max_r, r2)
        max_c = max(max_c, c2)
    rows = []
    for r in range(1, max_r + 1):
        rows.append([text(ws.cell(r, c).value) for c in range(1, max_c + 1)])
    merges = []
    for rng in ws.merged_cells.ranges:
        c1, r1, c2, r2 = range_boundaries(str(rng))
        if c2 <= max_c and r2 <= max_r:
            merges.append([c1, r1, c2, r2])
    return {'name': ws.title, 'maxCol': max_c, 'maxRow': max_r, 'rows': rows, 'merges': merges}

wb = openpyxl.load_workbook(SRC, data_only=True)
modes = [0, 1, 2]
sheets = []
for idx, ws in enumerate(wb.worksheets):
    sh = raw_sheet(ws)
    mode = modes[idx] if idx < len(modes) else 2
    try:
        bands = find_band_starts(ws, mode)
        sh['records'] = build_records(ws, bands)
        print('sheet', ws.title, 'bands', bands[:8], 'records', len(sh['records']))
    except Exception as e:
        sh['records'] = []
        print('records parse failed for', ws.title, e)
    sheets.append(sh)

os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from 冒险者角色创建流程.xlsx\n')
    f.write('var CREATION_FLOW_DATA = ')
    json.dump({'sheets': sheets}, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('written', OUT, 'sheets', len(sheets), 'records', [len(s.get('records', [])) for s in sheets])
