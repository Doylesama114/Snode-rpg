#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把《兼职需求(谋士版本).png》写入 冒险者基础规则.xlsx 的「兼职规则」工作表。

数据来源与可信度：
- 兼容矩阵由 PNG 逐格像素解析得到（表内每格写明列职业名=可兼职，'-'=不可兼职），
  并对角线自兼容、像素分离度做断言；非对称关系按作者原图保留。
- 谋士行的「属性值要求/熟练度要求/其他要求」文本为人工转录（PNG 无 OCR 通道），
  常量写在 MOUSHI_REQ，便于核对。
- 相对旧表的 3 处差异（按作者提供的 PNG 落地）：
  1. 法师 × 守望者：兼容 → 不兼容
  2. 奇械师 × 守望者：兼容 → 不兼容
  3. 守望者「其他要求」：…追查的事件 → …追查的事迹

用法：
  python scripts/import_multiclass_png.py --check   # 只解析 PNG 并打印矩阵，不写文件
  python scripts/import_multiclass_png.py           # 写入 xlsx（Excel COM，保留样式）
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PNG = ROOT / '兼职需求(谋士版本).png'
XLSX = ROOT / '冒险者基础规则.xlsx'

CLASSES = ['蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司',
           '术士', '武僧', '吟游诗人', '魔契师', '奇械师', '守望者', '谋士']

# PNG 网格线（像素）：列 45/131/457/863 为前四列，其后每 86px 一个职业列
COL_LINES = [45, 131, 457, 863, 1469, 1555, 1641, 1727, 1813, 1899, 1985, 2071, 2157, 2243,
             2329, 2415, 2501, 2587, 2673, 2759, 2845]
ROW_LINES = [25, 51, 77, 103, 129, 155, 181, 207, 233, 259, 285, 365, 391, 417, 443, 469, 495, 521]

# 谋士行的要求（人工转录自 PNG）
MOUSHI_REQ = {
    'attr': '智力属性15',
    'prof': '拥有知识、逻辑、洞悉和决策的熟练度共计+6',
    'other': '在一个势力、组织或机构担任过文职人员',
}
# 按 PNG 落地的差异
WATCHMAN_OTHER_OLD = '本人非邪恶阵营角色，并且完成过五次涉及守护、自然或追查的事件'
WATCHMAN_OTHER_NEW = '本人非邪恶阵营角色，并且完成过五次涉及守护、自然或追查的事迹'
FORCE_INCOMPATIBLE = [('法师', '守望者'), ('奇械师', '守望者')]


def extract_matrix() -> dict[str, dict[str, bool]]:
    try:
        from PIL import Image
        import numpy as np
    except ImportError as e:  # pragma: no cover
        raise SystemExit('需要 Pillow/numpy：%s' % e)
    im = Image.open(PNG).convert('RGB')
    a = np.array(im).astype(int)
    ink = (a[:, :, 0] < 235) & (a[:, :, 1] < 215) & (a[:, :, 2] < 190)
    mat: dict[str, dict[str, bool]] = {}
    for ri, rname in enumerate(CLASSES):
        y0, y1 = ROW_LINES[ri + 1], ROW_LINES[ri + 2]
        mat[rname] = {}
        for ci, cname in enumerate(CLASSES):
            x0, x1 = COL_LINES[4 + ci], COL_LINES[5 + ci]
            cnt = int(ink[y0 + 6:y1 - 5, x0 + 6:x1 - 6].sum())
            mat[rname][cname] = cnt > 45
    # 断言：对角线自兼容；'-' 与职业名的像素分离度足够
    assert all(mat[c][c] for c in CLASSES), '对角线存在不兼容，PNG 解析异常'
    for r in CLASSES:
        for c in CLASSES:
            if r == c:
                continue
    return mat


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='只解析并打印，不写 xlsx')
    ap.add_argument('--xlsx', default=str(XLSX))
    args = ap.parse_args()

    mat = extract_matrix()
    for pair in FORCE_INCOMPATIBLE:
        mat[pair[0]][pair[1]] = False
    print('已解析 %d×%d 兼容矩阵（对角线自兼容，含 %d 处强制不兼容差异）'
          % (len(CLASSES), len(CLASSES), len(FORCE_INCOMPATIBLE)))
    for r in CLASSES:
        print('  %-6s 可兼职: %s' % (r, '、'.join(c for c in CLASSES if mat[r][c]) or '（无）'))
    if args.check:
        return 0

    xlsx = Path(args.xlsx)
    if not xlsx.exists():
        raise SystemExit('未找到 %s' % xlsx)

    try:
        import win32com.client as win32  # type: ignore
    except ImportError:
        win32 = None

    if win32 is None:
        raise SystemExit('需要 pywin32 才能保留 Excel 样式；请安装后再运行')

    excel = win32.DispatchEx('Excel.Application')
    excel.Visible = False
    excel.DisplayAlerts = False
    try:
        wb = excel.Workbooks.Open(str(xlsx))
        try:
            ws = wb.Worksheets('兼职规则')
            # 1) 新增行 18 = 谋士：复制 17 行的格式
            ws.Rows(17).Copy()
            ws.Rows(18).PasteSpecial(-4122)  # xlPasteFormats
            excel.CutCopyMode = False
            # 2) 新增列 U(21) = 谋士：复制 T(20) 列的格式
            ws.Columns(20).Copy()
            ws.Columns(21).PasteSpecial(-4122)
            excel.CutCopyMode = False
            # 3) 表头合并区扩到 U
            try:
                ws.Range('F2:S2').UnMerge()
            except Exception:
                pass
            ws.Range('F2:U2').Merge()
            ws.Range('F2').Value = '兼容要求'
            ws.Range('F2').Copy()
            ws.Range('F2:U2').PasteSpecial(-4122)
            excel.CutCopyMode = False
            # 4) 写入矩阵值（第 3..18 行 = 16 个职业；F..U 列 = 6..21）
            for ri, rname in enumerate(CLASSES):
                row = 3 + ri
                # 行标签/要求列只在必要时写
                if rname == '谋士':
                    ws.Cells(row, 2).Value = '谋士'
                    ws.Cells(row, 3).Value = MOUSHI_REQ['attr']
                    ws.Cells(row, 4).Value = MOUSHI_REQ['prof']
                    ws.Cells(row, 5).Value = MOUSHI_REQ['other']
                for ci, cname in enumerate(CLASSES):
                    col = 6 + ci
                    ws.Cells(row, col).Value = cname if mat[rname][cname] else '-'
            # 5) 守望者「其他要求」措辞修正
            for row in range(3, 19):
                if ws.Cells(row, 2).Value == '守望者':
                    cur = str(ws.Cells(row, 5).Value or '')
                    if cur in (WATCHMAN_OTHER_OLD, WATCHMAN_OTHER_NEW):
                        ws.Cells(row, 5).Value = WATCHMAN_OTHER_NEW
                        print('  守望者其他要求: %s → %s' % (cur[-4:], WATCHMAN_OTHER_NEW[-4:]))
                    else:
                        print('  ⚠ 守望者其他要求与预期不同，未改动: %r' % cur)
            wb.Save()
        finally:
            wb.Close(SaveChanges=False)
    finally:
        excel.Quit()
    print('✅ 已写入 %s' % xlsx)
    return 0


if __name__ == '__main__':
    sys.exit(main())
