#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""定向修复：按 docx 修正个别技能的（描述）字段与规则行。

背景：法师「预言学派序列」两条技能存在既有数据漂移（一条描述写成「预言学派」而 docx 为「咒法学派」，
另一条 fields 全空）——属于与召唤师 D100 说明丢失同源的「描述未入库」缺陷，按 docx 定向修复。

说明：docx 明确笔误（如「召唤骷髅士兵」的「先攻时序人非人值6」）保持站点既有正确文案，不做同步
（见 scripts/verify_mage_preserved.py 的策划保护项，verify_skill_description_complete.py 亦有白名单）。

用法：
  python scripts/repair_skill_desc_entries.py --check
  python scripts/repair_skill_desc_entries.py --write
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import class_sync_core as C  # noqa: E402
from class_sync_core import (  # noqa: E402
    build_data_search, build_detail_html, build_skill_data_attrs, cost_json,
    json_to_fx_entry, patch_html, split_skill_description, tags_from_keywords, tier_label_from_skill,
)

REPAIRS = [
    ('法师', 'm-skill-2-7-7', '预言学派序列'),
    ('法师', 'm-skill-3-7-8', '预言学派序列'),
]


def do_repair(cls: str, sid: str, name: str, write: bool) -> list[str]:
    data_path = ROOT / '职业页' / '数据' / f'{cls}.json'
    html_path = ROOT / '职业页' / f'{cls}.html'
    fx_path = ROOT / '斯诺德跑团' / f'skill_effects_{cls}.json'
    e_data = ROOT / 'electron-app' / '职业页' / '数据' / f'{cls}.json'
    e_html = ROOT / 'electron-app' / '职业页' / f'{cls}.html'
    e_fx = ROOT / 'electron-app' / '斯诺德跑团' / f'skill_effects_{cls}.json'

    data = json.loads(data_path.read_text(encoding='utf-8'))
    skills = data['skills']
    names = {s['name'] for s in skills}
    paras = C.extract_paragraphs(ROOT / f'基础职业-{cls}.docx')
    index = C.build_docx_index(paras, names)
    used: set[int] = set()
    target = None
    block = None
    for sk in skills:
        blk = C.pick_block(index, sk, used)
        if sk['id'] == sid:
            target, block = sk, blk
    if target is None or block is None:
        return [f'{cls}/{sid} 未定位到技能或 docx 块']

    fields = dict(block['fields'])
    if block['mark_dots']:
        fields['标识'] = ''.join('●' for _ in block['mark_dots'])
    fields.pop('费用', None)
    body = [x for x in (block.get('description') or []) if x.strip() != target['name']]
    if '描述' not in fields and body:
        fields['描述'] = body[0]
        description = body[1:] if len(body) > 1 else []
    else:
        description = split_skill_description(fields, body)

    was = (dict(target.get('fields') or {}).get('描述', ''), list(target.get('description') or []))
    now = (fields.get('描述', ''), list(description))
    notes = [f'{cls}/{sid} {name}: 描述 {was[0][:28]!r}→{now[0][:28]!r}；规则行 {len(was[1])}→{len(now[1])}']
    if was == now:
        notes.append('  已一致，跳过')
        return notes
    if not write:
        return notes

    target['fields'] = fields
    target['description'] = description
    target['tags'] = tags_from_keywords(fields.get('关键词', ''))
    target['cost'] = cost_json(block['mark_dots'])
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if e_data.parent.exists():
        shutil.copyfile(data_path, e_data)

    html = html_path.read_text(encoding='utf-8')
    detail = build_detail_html(block)
    tags = [t for t in fields.get('关键词', '').split('.') if t]
    search = build_data_search(block, target.get('style', ''), tier_label_from_skill(target), tags)
    attrs = build_skill_data_attrs(target, block.get('mark_dots'), class_name=cls)
    html = patch_html(html, sid, detail, search, attrs)
    html_path.write_text(html, encoding='utf-8', newline='')
    if e_html.parent.exists():
        shutil.copyfile(html_path, e_html)

    fx_doc = json.loads(fx_path.read_text(encoding='utf-8'))
    entry = json_to_fx_entry(target, cls)
    fx_doc[cls] = [entry if e.get('id') == sid else e for e in fx_doc[cls]]
    fx_path.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if e_fx.parent.exists():
        shutil.copyfile(fx_path, e_fx)
    notes.append('  已写入 JSON / HTML / skill_effects（含镜像）')
    return notes


def restore_missing_first_lines(cls: str, write: bool) -> list[str]:
    """按 docx 补回「描述开头缺失行」：仅补 L 的前缀缺失（保守，不重排既有行）。"""
    data_path = ROOT / '职业页' / '数据' / f'{cls}.json'
    html_path = ROOT / '职业页' / f'{cls}.html'
    fx_path = ROOT / '斯诺德跑团' / f'skill_effects_{cls}.json'
    e_data = ROOT / 'electron-app' / '职业页' / '数据' / f'{cls}.json'
    e_html = ROOT / 'electron-app' / '职业页' / f'{cls}.html'
    e_fx = ROOT / 'electron-app' / '斯诺德跑团' / f'skill_effects_{cls}.json'

    data = json.loads(data_path.read_text(encoding='utf-8'))
    skills = data['skills']
    names = {s['name'] for s in skills}
    paras = C.extract_paragraphs(ROOT / f'基础职业-{cls}.docx')
    index = C.build_docx_index(paras, names)
    used: set[int] = set()
    html = html_path.read_text(encoding='utf-8')
    fx_doc = json.loads(fx_path.read_text(encoding='utf-8'))
    notes: list[str] = []
    touched = 0
    for skill in skills:
        block = C.pick_block(index, skill, used)
        if not block:
            continue
        fields = dict(skill.get('fields') or {})
        body = [x for x in C.filter_description_lines(block.get('description') or [])
                if x.strip() and x.strip() != skill['name']]
        want = split_skill_description(fields, body)
        json_lines = [fields.get('描述', '')] + list(skill.get('description') or [])
        def _norm(t):
            return re.sub(r'\s+', '', t or '')
        haystack = _norm(''.join(json_lines))
        skip_line = {f'{cls}天赋树', f'{cls}技能', '天赋树', '技能列表'}
        miss = [x for x in want
                if _norm(x) and _norm(x) not in haystack and x.strip() not in skip_line]
        if not miss:
            continue
        if want[:len(miss)] == miss:
            where = 'front'
        elif want[-len(miss):] == miss:
            where = 'back'
        else:
            where = 'back'
            notes.append(f'  ⚠ {skill["name"]} 缺失行不连续（按末尾补入，需人工核对）')
        notes.append(f'  + {skill["name"]} 补 {len(miss)} 行（{where}）：{miss[0][:34]}')
        touched += 1
        if not write:
            continue
        if where == 'front':
            skill['description'] = miss + list(skill.get('description') or [])
        else:
            skill['description'] = list(skill.get('description') or []) + miss
        tables = {'unit_tables': skill.get('unit_tables') or [], 'roll_tables': skill.get('roll_tables') or []}
        detail = build_detail_html(block, tables)
        tags = [t for t in fields.get('关键词', '').split('.') if t]
        search = build_data_search(block, skill.get('style', ''), tier_label_from_skill(skill), tags)
        search = C.append_tables_to_search(search, skill)
        attrs = build_skill_data_attrs(skill, block.get('mark_dots'), class_name=cls)
        html = patch_html(html, skill['id'], detail, search, attrs)
        entry = json_to_fx_entry(skill, cls)
        fx_doc[cls] = [entry if e.get('id') == skill['id'] else e for e in fx_doc[cls]]
    if write and touched:
        data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')
        html_path.write_text(html, encoding='utf-8', newline='')
        fx_path.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')
        for src, dst in ((data_path, e_data), (html_path, e_html), (fx_path, e_fx)):
            if dst.parent.exists():
                shutil.copyfile(src, dst)
        notes.append('  已写入 JSON / HTML / skill_effects（含镜像）')
    return notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--restore-first-lines', metavar='CLASS', help='按职业补回描述开头缺失行')
    args = ap.parse_args()
    if args.restore_first_lines:
        notes = restore_missing_first_lines(args.restore_first_lines, write=args.write)
        for n in notes:
            print(n)
        print('✅ 已补回缺失行（%s）' % args.restore_first_lines if args.write else '（预览）')
        return 0
    if not args.check and not args.write:
        ap.print_help()
        return 0
    changed = 0
    for cls, sid, name in REPAIRS:
        notes = do_repair(cls, sid, name, write=args.write)
        for n in notes:
            print(n)
        if any('已写入' in n for n in notes) or any('→' in n and '已一致' not in n for n in notes):
            changed += 1
    if args.check:
        print('OK（待修复 %d 处）' % changed if changed else 'OK（无需修复）')
    else:
        print('✅ 定向修复完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
