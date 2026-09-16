#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 基础职业-召唤师.docx 提取 20 个契约生物（初始形态）→ JSON + 前端数据文件。

产出：
  职业页/数据/召唤师契约生物.json        规范数据（机器可读）
  职业页/数据/summoner_contracts_data.js 前端数据（var CONTRACT_CREATURES = [...]）
  + electron-app 镜像

用法：
  python scripts/rebuild_summoner_contracts.py [--check]
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / '基础职业-召唤师.docx'
OUT_JSON = ROOT / '职业页' / '数据' / '召唤师契约生物.json'
OUT_JS = ROOT / '职业页' / '数据' / 'summoner_contracts_data.js'
MIRRORS = [
    (OUT_JSON, ROOT / 'electron-app' / '职业页' / '数据' / '召唤师契约生物.json'),
    (OUT_JS, ROOT / 'electron-app' / '职业页' / '数据' / 'summoner_contracts_data.js'),
]

FIELD_KEYS = {
    '感官': 'senses',
    '移动速度': 'speed',
    '战斗加成': 'combat',
    '伤害易伤': 'vulnerable',
    '伤害抗性': 'resist',
    '伤害免疫': 'immune',
    '状态免疫': 'statusImmune',
    '语言': 'languages',
}
ACTION_HINT = re.compile(r'主要动作|附赠动作|反应动作|徒手攻击|施法攻击|远程攻击|近战攻击')
ATTR_KEYS = ['力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运']


def body_paragraphs() -> list[str]:
    import docx
    doc = docx.Document(str(DOCX))
    out = []
    for p in doc.paragraphs:
        t = ' '.join(p.text.split())
        if t:
            out.append(t)
    return out


def split_list(text: str) -> list[str]:
    if text in ('-', '', '—'):
        return []
    return [x.strip() for x in re.split(r'[、,，]', text) if x.strip()]


def parse_creatures() -> list[dict]:
    paras = body_paragraphs()
    start = paras.index('契约生物列表.')
    end = paras.index('战斗风格')
    seg = paras[start:end]

    creatures: list[dict] = []
    i = 0
    while i < len(seg):
        t = seg[i]
        nxt = seg[i + 1] if i + 1 < len(seg) else ''
        if re.match(r'^[\u4e00-\u9fa5·]{2,8}$', t) and re.match(r'^[^（]+（[^）]+系）', nxt):
            name = t
            lines = []
            i += 1
            while i < len(seg):
                if seg[i].startswith('---'):
                    break
                if re.match(r'^[\u4e00-\u9fa5·]{2,8}$', seg[i]) and i + 1 < len(seg) and re.match(r'^[^（]+（[^）]+系）', seg[i + 1]):
                    break
                lines.append(seg[i])
                i += 1
            creatures.append({'name': name, '_lines': lines})
        i += 1

    out = []
    for c in creatures:
        lines = c['_lines']
        head = lines[0] if lines else ''
        m = re.match(r'^([^（]+)（([^）]+系)），防御等级：(\d+)，生命值(\d+)，挑战等级：([^\s]+)', head)
        item = {
            'name': c['name'],
            'type': m.group(1) if m else '',
            'category': m.group(2) if m else '',
            'ac': int(m.group(3)) if m else None,
            'hp': int(m.group(4)) if m else None,
            'cr': m.group(5) if m else '',
            'attrs': {},
            'senses': '', 'speed': '', 'combat': '',
            'vulnerable': [], 'resist': [], 'immune': [], 'statusImmune': [],
            'languages': '',
            'traits': [], 'actions': [],
        }
        # 属性行（可能两行）
        for ln in lines:
            for am in re.finditer(r'(力量|敏捷|体质|智力|感知|魅力|意志|幸运)\s*(-|\d+)\s*(?:\(([+-]?\d+)\))?', ln):
                key, val, mod = am.group(1), am.group(2), am.group(3)
                if key in item['attrs']:
                    continue
                item['attrs'][key] = {
                    'value': None if val == '-' else int(val),
                    'mod': None if mod is None else int(mod),
                }
        # 单值字段
        for ln in lines:
            for k, key in FIELD_KEYS.items():
                if ln.startswith(k + '：'):
                    val = ln.split('：', 1)[1].strip()
                    if key in ('vulnerable', 'resist', 'immune', 'statusImmune'):
                        item[key] = split_list(val)
                    else:
                        item[key] = val
        # 特性 / 动作：跳过头部/属性/单值字段行，其余按「名称：内容」归入特性或动作
        # （注：部分契约生物的 docx 缺少「特性」小标题，因此不能依赖该行）
        cur = None
        for ln in lines[1:]:
            if ln.startswith('---') or '系）' in ln:
                continue
            if any(ln.startswith(k + '：') for k in FIELD_KEYS):
                continue
            if re.match(r'^(力量|敏捷|体质|智力|感知|魅力|意志|幸运)\s', ln):
                continue
            if ln == '特性':
                continue
            if '：' in ln[:12]:
                nm, val = ln.split('：', 1)
                nm, val = nm.strip(), val.strip()
                is_action = bool(ACTION_HINT.search(val))
                cur = {'name': nm, 'text': val}
                (item['actions'] if is_action else item['traits']).append(cur)
            elif cur is not None:
                cur['text'] += ln
        out.append(item)
    return out


def main() -> int:
    check = '--check' in sys.argv
    creatures = parse_creatures()
    missing_attr = [c['name'] for c in creatures if len(c['attrs']) != 8]
    no_head = [c['name'] for c in creatures if not (c['ac'] and c['hp'] and c['cr'])]
    no_trait_or_action = [c['name'] for c in creatures if not c['traits'] and not c['actions']]

    print('契约生物 %d 个' % len(creatures))
    print('  8 属性不全:', missing_attr or '无')
    print('  头部字段缺失:', no_head or '无')
    print('  无特性/动作:', no_trait_or_action or '无')
    print('  系别:', '、'.join(c['category'] for c in creatures))
    print('  样例:', json.dumps(creatures[0], ensure_ascii=False)[:320])

    if check:
        ok = not (missing_attr or no_head)
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1

    payload = {
        'version': 1,
        'source': '基础职业-召唤师.docx',
        'class': '召唤师',
        'note': '契约生物初始形态（挑战等级 1/4）；成长细则待作者补充',
        'creatures': creatures,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    js = ('// 召唤师契约生物（初始形态）——由 scripts/rebuild_summoner_contracts.py 生成\n'
          'var CONTRACT_CREATURES = ' + json.dumps(creatures, ensure_ascii=False) + ';\n')
    OUT_JS.write_text(js, encoding='utf-8')
    for src, dst in MIRRORS:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    print('→ 写出', OUT_JSON.relative_to(ROOT), '与', OUT_JS.relative_to(ROOT), '（含 electron 镜像）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
