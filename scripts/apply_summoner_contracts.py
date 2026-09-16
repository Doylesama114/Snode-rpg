#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把「契约生物」切换区注入 职业页/召唤师.html（chip 切换 + 完整数据卡）。

复用页面既有 class-features 组件（common.css 样式 + common.js 的 initClassFeatureTabs 交互），
因此无需新增 JS。幂等：已存在则替换。

用法：
  python scripts/apply_summoner_contracts.py [--check]
"""
from __future__ import annotations

import html
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
PAGE = ROOT / '职业页' / '召唤师.html'
MIRROR = ROOT / 'electron-app' / '职业页' / '召唤师.html'
DATA = ROOT / '职业页' / '数据' / '召唤师契约生物.json'
SECTION_ANCHOR = '<h3 id="sm-starting-features">起始特性</h3>'
ATTR_ORDER = ['力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运']


def attr_cell(name: str, info: dict) -> str:
    if not info or info.get('value') is None:
        return f'{name} —'
    mod = info.get('mod')
    mod_txt = f'（{mod:+d}）' if isinstance(mod, int) else ''
    return f'{name} {info["value"]}{mod_txt}'


def render_section(creatures: list[dict]) -> str:
    chips, panels = [], []
    for i, c in enumerate(creatures):
        active = ' active' if i == 0 else ''
        sel = 'true' if i == 0 else 'false'
        label = f'{c["category"]}·{c["name"]}'
        chips.append(f'<button type="button" class="class-feature-chip{active}" role="tab" '
                     f'aria-selected="{sel}" data-feature-index="{i}">{html.escape(label)}</button>')
        attr_cells = ''.join(
            f'<span class="class-feature-table-cell">{html.escape(attr_cell(k, c["attrs"].get(k)))}</span>'
            for k in ATTR_ORDER
        )
        head = (f'{html.escape(c["type"])} ｜ 防御等级 {c["ac"]} ｜ 生命值 {c["hp"]} ｜ '
                f'挑战等级 {c["cr"]} ｜ {html.escape(c["category"])}')
        lines = [f'<div class="class-feature-table"><div class="class-feature-table-row">{attr_cells}</div></div>',
                 f'<p><span class="field">感官：</span>{html.escape(c["senses"])}</p>',
                 f'<p><span class="field">移动速度：</span>{html.escape(c["speed"])}'
                 f'　<span class="field">战斗加成：</span>{html.escape(c["combat"])}</p>']
        dmg = []
        for key, name in (('vulnerable', '伤害易伤'), ('resist', '伤害抗性'), ('immune', '伤害免疫'), ('statusImmune', '状态免疫')):
            if c.get(key):
                dmg.append(f'{name}：{"、".join(c[key])}')
        if dmg:
            lines.append('<p>' + '　'.join(html.escape(x) for x in dmg) + '</p>')
        lines.append(f'<p><span class="field">语言：</span>{html.escape(c["languages"] or "—")}</p>')
        if c['traits']:
            items = ''.join(f'<li><b>{html.escape(t["name"])}</b>：{html.escape(t["text"])}</li>' for t in c['traits'])
            lines.append(f'<p><span class="field">特性</span></p><ul class="contract-list">{items}</ul>')
        if c['actions']:
            items = ''.join(f'<li><b>{html.escape(a["name"])}</b>：{html.escape(a["text"])}</li>' for a in c['actions'])
            lines.append(f'<p><span class="field">动作</span></p><ul class="contract-list">{items}</ul>')
        panels.append(
            f'<div class="class-feature-panel{active}" role="tabpanel" data-feature-panel="{i}" '
            f'id="sm-contract-{html.escape(c["name"])}">'
            f'<h3>{html.escape(c["name"])} <span class="chip">{html.escape(c["category"])}</span></h3>'
            f'<div class="class-feature-body"><p class="contract-head">{head}</p>{"".join(lines)}</div></div>'
        )
    return (
        '<section class="class-features" id="sm-contract-creatures" aria-label="契约生物">'
        '<div class="class-feature-head"><h2>契约生物（初始形态）</h2>'
        f'<p class="class-feature-intro">共 {len(creatures)} 个系别，创建角色时可随机抽取或自选一只作为初始伙伴；'
        '本节为初始形态（挑战等级 1/4）数据，成长细则待作者补充。</p></div>'
        f'<div class="class-feature-tabs" role="tablist">{"".join(chips)}</div>'
        f'<div class="class-feature-panels">{"".join(panels)}</div></section>'
    )


def main() -> int:
    check = '--check' in sys.argv
    data = json.loads(DATA.read_text(encoding='utf-8'))
    creatures = data['creatures']
    section = render_section(creatures)

    text = PAGE.read_text(encoding='utf-8')
    has = 'id="sm-contract-creatures"' in text
    if check:
        print('契约生物区:', '已注入' if has else '缺失', '| 生物数:', len(creatures))
        print('OK' if has else 'FAIL')
        return 0 if has else 1

    if has:
        start = text.index('<section class="class-features" id="sm-contract-creatures"')
        end = text.index('</section>', start) + len('</section>')
        text = text[:start] + section + text[end:]
    else:
        anchor = text.index(SECTION_ANCHOR)
        # 插到「起始特性」标题之前，并补一个导航链接
        text = text[:anchor] + section + '\n      ' + text[anchor:]
        nav_anchor = '<a class="style-link" href="#sm-starting-features">起始特性</a>'
        if 'href="#sm-contract-creatures"' not in text:
            text = text.replace(
                nav_anchor,
                nav_anchor + '\n        <a class="style-link" href="#sm-contract-creatures">契约生物</a>',
                1,
            )
    # 数据卡样式（列表紧凑化），只注入一次
    if '.contract-list' not in text:
        style_anchor = '</style>'
        css = ('.contract-list { margin: 4px 0 8px 18px; padding: 0; }\n'
               '.contract-list li { font-size: 14px; margin: 2px 0; }\n'
               '.contract-head { color: var(--muted); font-size: 13px; }\n')
        text = text.replace(style_anchor, css + style_anchor, 1)

    PAGE.write_text(text, encoding='utf-8')
    if MIRROR.exists():
        shutil.copy2(PAGE, MIRROR)
    print('✅ 契约生物区已注入（%d 个系别）' % len(creatures))
    return 0


if __name__ == '__main__':
    sys.exit(main())
