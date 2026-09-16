#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全职业技能描述完整性校验：docx 的规则描述行必须全部出现在 JSON（fields.描述 + description）中。

背景：重建脚本的 block_to_skill 曾无条件丢弃描述首行，导致 5 个职业共 158 个技能丢失规则首句
（如召唤师 D100 随机表的施法说明）。本校验作为回归门禁，防止同类缺陷再次出现。

用法: python scripts/verify_skill_description_complete.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

import class_sync_core as C  # noqa: E402
from class_sync_core import split_skill_description  # noqa: E402

CLASSES = ['蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司', '术士',
           '武僧', '吟游诗人', '魔契师', '奇械师', '守望者', '谋士', '召唤师']

# 策划保护项：docx 明确笔误，站点保留正确文案，不做同步
WHITELIST = {
    ('法师', '召唤骷髅士兵'): 'docx 笔误「先攻时序人非人值6」，站点保留「先攻时序值6」',
}


def norm(text: str) -> str:
    return re.sub(r'\s+', '', text or '')


def main() -> int:
    errors: list[str] = []
    stats: dict[str, tuple[int, int]] = {}
    for cls in CLASSES:
        docx = ROOT / f'基础职业-{cls}.docx'
        js = ROOT / '职业页' / '数据' / f'{cls}.json'
        if not docx.exists() or not js.exists():
            continue
        data = json.loads(js.read_text(encoding='utf-8'))
        skills = data.get('skills') or []
        names = {s['name'] for s in skills}
        paras = C.extract_paragraphs(docx)
        index = C.build_docx_index(paras, names)
        used: set[int] = set()
        checked = 0
        for skill in skills:
            block = C.pick_block(index, skill, used)
            if not block:
                continue
            checked += 1
            fields = dict(skill.get('fields') or {})
            skip_line = {f'{cls}天赋树', f'{cls}技能', '天赋树', '技能列表'}
            body = [x for x in C.filter_description_lines(block.get('description') or [])
                    if x.strip() and x.strip() != skill['name'] and x.strip() not in skip_line]
            lines = split_skill_description(fields, body)
            if not lines:
                continue
            haystack = norm(''.join([fields.get('描述', '')] + list(skill.get('description') or [])))
            miss = [x for x in lines if norm(x) and norm(x) not in haystack]
            if miss and (cls, skill['name']) in WHITELIST:
                continue
            if miss:
                errors.append('%s/%s 缺失 %d 行：%s' % (cls, skill['name'], len(miss), miss[0][:40]))
        stats[cls] = (checked, len([e for e in errors if e.startswith(cls + '/')]))

    for cls, (checked, bad) in stats.items():
        print('%-5s 校验 %3d 个技能 %s' % (cls, checked, '✅' if bad == 0 else '❌ %d 处缺失' % bad))
    if errors:
        print('\nFAIL：技能描述完整性校验未通过（%d 处）' % len(errors))
        for e in errors[:20]:
            print('  -', e)
        return 1
    print('\nOK：17 个职业技能描述完整（docx 规则行全部入库）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
