#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""兼职规则四方一致性校验：xlsx ↔ help.html ↔ panel_data.js(REF_SUBCLASS_REQS) ↔ advisor/rules/multiclass.json。

用法: python scripts/verify_multiclass_sync.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / '冒险者基础规则.xlsx'
HELP = ROOT / '斯诺德跑团' / 'help.html'
HELP_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'help.html'
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
ADV = ROOT / 'advisor' / 'rules' / 'multiclass.json'

CLASSES = ['蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司',
           '术士', '武僧', '吟游诗人', '魔契师', '奇械师', '守望者', '谋士']
errors: list[str] = []
notes: list[str] = []


def load_xlsx() -> dict:
    ws = openpyxl.load_workbook(XLSX, data_only=True)['兼职规则']
    data = {}
    for r in range(3, 3 + len(CLASSES)):
        name = str(ws.cell(r, 2).value or '').strip()
        if name not in CLASSES:
            errors.append('xlsx 第 %d 行职业异常: %r' % (r, name))
            continue
        compat = [cn for i, cn in enumerate(CLASSES) if str(ws.cell(r, 6 + i).value or '').strip() == cn]
        data[name] = {
            'attr': str(ws.cell(r, 3).value or '').strip(),
            'prof': str(ws.cell(r, 4).value or '').strip(),
            'other': str(ws.cell(r, 5).value or '').strip(),
            'compatible': compat,
            'incompatible': [c for c in CLASSES if c not in compat],
        }
    return data


def load_help() -> dict:
    html = HELP.read_text(encoding='utf-8')
    body = html
    if '<!-- MULTICLASS-RULES -->' in body:
        body = body[body.index('<!-- MULTICLASS-RULES -->'):]
    rows = re.findall(r'<tr><td><b>([^<]+)</b></td><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td></tr>', body)
    if len(rows) != len(CLASSES):
        errors.append('help.html 兼职规则表行数 %d != %d' % (len(rows), len(CLASSES)))
    data = {}
    for name, attr, prof, other, inc in rows:
        incompatible = [] if inc.strip() in ('—', '-') else [x.strip() for x in inc.split('、') if x.strip()]
        data[name] = {'attr': attr, 'prof': prof, 'other': other, 'incompatible': incompatible}
    return data


def load_help_matrix() -> dict:
    html = HELP.read_text(encoding='utf-8')
    m = re.search(r'<table class="mc-matrix">.*?</table>', html, re.S)
    if not m:
        errors.append('help.html 缺少 mc-matrix 矩阵')
        return {}
    out = {}
    for row in re.findall(r'<tr><th title="([^"]+)">[^<]*</th>((?:<td[^>]*>[^<]*</td>)+)</tr>', m.group(0)):
        main = row[0]
        cells = re.findall(r'<td class="(mc-no|mc-ok|mc-self)"', row[1])
        if len(cells) != len(CLASSES):
            errors.append('help.html 矩阵 %s 列数 %d != %d' % (main, len(cells), len(CLASSES)))
            continue
        out[main] = {cn: (None if cells[i] == 'mc-self' else cells[i] == 'mc-ok')
                     for i, cn in enumerate(CLASSES)}
    if len(out) != len(CLASSES):
        errors.append('help.html 矩阵行数 %d != %d' % (len(out), len(CLASSES)))
    return out


def load_ref() -> dict:
    text = PANEL.read_text(encoding='utf-8')
    m = re.search(r'var REF_SUBCLASS_REQS = (\{.*?\});', text, re.S)
    if not m:
        errors.append('panel_data.js 缺少 REF_SUBCLASS_REQS')
        return {}
    return json.loads(m.group(1))


def load_advisor() -> dict:
    return json.loads(ADV.read_text(encoding='utf-8'))


def main() -> int:
    xls = load_xlsx()
    hp = load_help()
    matrix = load_help_matrix()
    ref = load_ref()
    adv = load_advisor()

    # 1) 要求文本：xlsx ↔ help ↔ advisor.requirements
    adv_req = {r['class']: r for r in adv.get('requirements', [])}
    for c in CLASSES:
        x = xls.get(c)
        if not x:
            continue
        h = hp.get(c, {})
        if h.get('attr') != x['attr'] or h.get('prof') != x['prof'] or h.get('other') != x['other']:
            errors.append('%s：help 要求文本与 xlsx 不一致' % c)
        a = adv_req.get(c)
        if not a:
            errors.append('%s：advisor requirements 缺失' % c)
        else:
            if (a.get('attrRequired') or '') != (x['attr'] if x['attr'] != '-' else ''):
                errors.append('%s：advisor attrRequired 不一致 (%r)' % (c, a.get('attrRequired')))
            if (a.get('profRequired') or '') != (x['prof'] if x['prof'] != '-' else ''):
                errors.append('%s：advisor profRequired 不一致 (%r)' % (c, a.get('profRequired')))
            if (a.get('otherRequired') or '') != (x['other'] if x['other'] != '-' else ''):
                errors.append('%s：advisor otherRequired 不一致 (%r)' % (c, a.get('otherRequired')))
            if sorted(a.get('incompatibleWith') or []) != sorted(x['incompatible']):
                errors.append('%s：advisor incompatibleWith 与 xlsx 不一致' % c)

    # 2) 兼容矩阵：xlsx ↔ help.html 矩阵 ↔ REF_SUBCLASS_REQS ↔ advisor.compatibility
    adv_compat = adv.get('compatibility', {})
    for r in CLASSES:
        x = xls.get(r)
        if not x:
            continue
        compat = set(x['compatible'])
        hm = matrix.get(r, {})
        if hm:
            # 对角线在 help 中固定渲染为「—（自身）」，比较时剔除
            hm_compat = {c for c, v in hm.items() if v is True and c != r}
            x_compat = {c for c in compat if c != r}
            if hm_compat != x_compat:
                errors.append('矩阵 %s：help ↔ xlsx 不一致 %s' % (r, sorted(hm_compat ^ x_compat)))
        ref_inc = set(ref.get(r, {}).get('incompatible', []))
        if ref_inc != set(x['incompatible']):
            errors.append('REF_SUBCLASS_REQS %s：不兼容列表与 xlsx 不一致' % r)
        ac = adv_compat.get(r)
        if ac is None:
            errors.append('advisor compatibility 缺 %s' % r)
        else:
            ac_compat = {c for c, v in ac.items() if v is True and c != r}
            x_compat2 = {c for c in compat if c != r}
            if ac_compat != x_compat2:
                errors.append('advisor compatibility %s 与 xlsx 不一致 %s' % (r, sorted(ac_compat ^ x_compat2)))
        # REF 的属性/熟练度键
        e = ref.get(r, {})
        if not e.get('attrs'):
            errors.append('REF_SUBCLASS_REQS %s 缺 attrs' % r)

    # 3) 镜像一致性
    if HELP_MIRROR.exists() and HELP.read_bytes() != HELP_MIRROR.read_bytes():
        errors.append('help.html 与 electron 镜像不一致（请重跑 sync_multiclass_help.py）')

    # 4) 非对称提示（保留原样，仅记录）
    asym = []
    for a in CLASSES:
        for b in CLASSES:
            if a >= b:
                continue
            if (b in xls[a]['compatible']) != (a in xls[b]['compatible']):
                asym.append('%s↔%s' % (a, b))
    if asym:
        notes.append('源表非对称（按 PNG 原样保留）: ' + '、'.join(asym))

    if errors:
        print('FAIL：兼职规则四方校验未通过（%d 处）' % len(errors))
        for e in errors:
            print('  -', e)
        return 1
    print('OK：兼职规则四方一致（%d 职业 × %d 方向；要求文本 + 兼容矩阵 + 镜像）'
          % (len(CLASSES), len(CLASSES) ** 2))
    for n in notes:
        print('  注：', n)
    return 0


if __name__ == '__main__':
    sys.exit(main())
