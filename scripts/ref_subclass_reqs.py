#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""由 冒险者基础规则.xlsx「兼职规则」生成面板用 REF_SUBCLASS_REQS。

- 兼容矩阵（incompatible）以 xlsx 为唯一来源（v1.0.7270 起含谋士，共 16 职业）。
- 属性/熟练度要求从文本解析；为避免改变既有判定语义，已存在职业的
  profAttr / profAttrAlt / profNames 若原本就有值则原样保留（仅新增职业走解析结果）。
- 输出写入 斯诺德跑团/panel_data.js（并同步 electron-app 镜像）。

用法：
  python scripts/ref_subclass_reqs.py --check    # 校验文件中字面量是否与 xlsx 一致
  python scripts/ref_subclass_reqs.py --write    # 重新生成并写入
  python scripts/ref_subclass_reqs.py --print    # 打印生成结果
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import OrderedDict
from pathlib import Path

import openpyxl

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / '冒险者基础规则.xlsx'
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
PANEL_ELECTRON = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_data.js'

CLASSES = ['蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司',
           '术士', '武僧', '吟游诗人', '魔契师', '奇械师', '守望者', '谋士', '召唤师', '战舞者']
# 表内熟练项 → 应用侧熟练项键名（战舞者的「舞蹈」属于 表演 系列）
PROF_ALIAS = {'舞蹈': '表演-舞蹈', '歌唱': '表演-歌唱', '演奏': '表演-演奏'}
ATTRS = ['力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运']
LINE_RE = re.compile(r'var REF_SUBCLASS_REQS = \{.*?\};', re.S)


def parse_attrs(text: str):
    """'力量/敏捷属性13，体质属性13' → ({力量:13, 体质:13}, '敏捷')"""
    attrs, alt = OrderedDict(), ''
    for part in re.split(r'[，,]', text or ''):
        m = re.match(r'^(.*?)属性(\d+)$', part.strip())
        if not m:
            continue
        names = [n for n in m.group(1).split('/') if n]
        if not names:
            continue
        attrs[names[0]] = int(m.group(2))
        if len(names) > 1 and not alt:
            alt = names[1]
    return attrs, alt


def parse_profs(text: str):
    """'拥有敏捷、伪造和欺瞒的熟练度共计+4' → ('敏捷', '', ['伪造','欺瞒'], 4)"""
    m = re.match(r'^拥有(.+?)的熟练度共计\+(\d+)$', (text or '').strip())
    if not m:
        return '', '', [], 0
    body, total = m.group(1), int(m.group(2))
    tokens = []
    for seg in body.replace('和', '、').split('、'):
        for t in seg.split('或'):
            t = t.strip()
            if t:
                tokens.append(t)
    prof_attr = prof_attr_alt = ''
    names = []
    for t in tokens:
        if t in ATTRS:
            if not prof_attr:
                prof_attr = t
            elif not prof_attr_alt:
                prof_attr_alt = t
        else:
            names.append(PROF_ALIAS.get(t, t))
    return prof_attr, prof_attr_alt, names, total


def load_multiclass() -> 'OrderedDict[str, dict]':
    ws = openpyxl.load_workbook(XLSX, data_only=True)['兼职规则']
    data: 'OrderedDict[str, dict]' = OrderedDict()
    for r in range(3, 3 + len(CLASSES)):
        name = str(ws.cell(r, 2).value or '').strip()
        if name not in CLASSES:
            raise SystemExit('xlsx 第 %d 行职业异常: %r' % (r, name))
        compatible = []
        for ci, cn in enumerate(CLASSES):
            if str(ws.cell(r, 6 + ci).value or '').strip() == cn:
                compatible.append(cn)
        data[name] = {
            'attr': str(ws.cell(r, 3).value or '').strip(),
            'prof': str(ws.cell(r, 4).value or '').strip(),
            'other': str(ws.cell(r, 5).value or '').strip(),
            'compatible': compatible,
        }
    return data


def build(prev: dict | None) -> 'OrderedDict[str, dict]':
    mc = load_multiclass()
    out: 'OrderedDict[str, dict]' = OrderedDict()
    for name in CLASSES:
        row = mc[name]
        attrs, attr_alt = parse_attrs(row['attr'])
        prof_attr, prof_attr_alt, names, total = parse_profs(row['prof'])
        entry: dict = OrderedDict()
        entry['attrs'] = attrs
        entry['attrAlt'] = attr_alt
        old = (prev or {}).get(name)
        if old:
            for k in ('profAttr', 'profAttrAlt', 'profNames'):
                if k in old:
                    entry[k] = old[k]
            entry['profTotal'] = old.get('profTotal', total)
            if entry['profTotal'] != total:
                raise SystemExit('%s 熟练度要求与 xlsx 不一致：字面量 %s vs xlsx %s'
                                 % (name, entry['profTotal'], total))
        else:
            if prof_attr:
                entry['profAttr'] = prof_attr
            if prof_attr_alt:
                entry['profAttrAlt'] = prof_attr_alt
            if total > 0:
                entry['profNames'] = names
            entry['profTotal'] = total
        entry['incompatible'] = [c for c in CLASSES if c not in row['compatible']]
        out[name] = entry
    return out


def render(entries: dict) -> str:
    return 'var REF_SUBCLASS_REQS = %s;' % json.dumps(entries, ensure_ascii=False,
                                                      separators=(',', ':'))


def read_current_line() -> str | None:
    if not PANEL.exists():
        return None
    m = LINE_RE.search(PANEL.read_text(encoding='utf-8'))
    return m.group(0) if m else None


def read_prev_entries() -> dict | None:
    line = read_current_line()
    if not line:
        return None
    return json.loads(line[len('var REF_SUBCLASS_REQS = '):-1])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--print', dest='do_print', action='store_true')
    args = ap.parse_args()

    prev = read_prev_entries()
    entries = build(prev)
    line = render(entries)
    if args.do_print:
        print(line)
        return 0
    if args.check:
        cur = read_current_line()
        if cur == line:
            print('OK：REF_SUBCLASS_REQS 与 xlsx 一致（%d 职业）' % len(entries))
            return 0
        print('FAIL：REF_SUBCLASS_REQS 与 xlsx 不一致，请运行 --write 重新生成')
        return 1
    if not args.write:
        ap.print_help()
        return 0

    text = PANEL.read_text(encoding='utf-8')
    if not LINE_RE.search(text):
        raise SystemExit('未在 panel_data.js 找到 REF_SUBCLASS_REQS')
    PANEL.write_text(LINE_RE.sub(line, text, count=1), encoding='utf-8', newline='')
    if PANEL_ELECTRON.exists():
        shutil.copyfile(PANEL, PANEL_ELECTRON)
    print('✅ REF_SUBCLASS_REQS 已写入（%d 职业，含谋士）' % len(entries))
    for name in CLASSES:
        inc = entries[name]['incompatible']
        print('   %-6s 不可兼职: %s' % (name, '、'.join(inc) or '—'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
