#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 召唤师·进阶.html 占位页（M8）：通用进阶 10 条 + 页首「等待更新」提示。

背景：《基础职业进阶途径》尚无召唤师专属章节（仅 3 张卡的来源含召唤师）。
按用户口径：先放通用，并在最前面标注等待更新的提示。

用法：
  python scripts/build_summoner_advancement_placeholder.py [--check]
"""
from __future__ import annotations

import html as html_mod
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

import advancement_sync_core as A  # noqa: E402

CLASS = '召唤师'
PREFIX = 'sm'
PAGE = ROOT / '职业页' / f'{CLASS}·进阶.html'
MIRROR = ROOT / 'electron-app' / '职业页' / f'{CLASS}·进阶.html'
TEMPLATE = ROOT / '职业页' / '守望者·进阶.html'
NOTICE = (
    '<div class="adv-notice" style="max-width:900px;margin:16px auto 0;padding:12px 18px;'
    'border:1px solid #e0c98a;background:#fff8e6;border-radius:8px;color:#7a5c12;font-size:14px;line-height:1.7">'
    '⏳ <b>《基础职业进阶途径》暂无召唤师专属章节</b><br>'
    '本页收录<b>来源包含「召唤师」的进阶 25 条</b>（咒法师、召唤大师、龙脉誓约者、焰灵师、霜灵师、星灵师、魔兽使…）'
    '与<b>通用进阶 10 条</b>，共 35 条；进阶文档中新增的召唤师相关卡片会随来源自动并入本页。'
    '</div>'
)


def build_articles() -> tuple[str, int]:
    parsed = A.parse_docx(A.DOCX)
    universal = parsed.get('通用', [])
    detail_names = A.load_detail_names()
    seen: dict = {}
    entries = [A.card_to_json_entry(c, '通用', A.CLASS_SLUG['通用'], seen) for c in universal]
    articles = '\n'.join(A.build_article(c, e['id'], detail_names) for c, e in zip(universal, entries))
    return articles, len(universal)


def update_notice_only() -> int:
    """sync 之后仅刷新页首提示文案（不动卡片）。"""
    for path in (PAGE, MIRROR):
        if not path.exists():
            continue
        text = path.read_text(encoding='utf-8')
        if 'class="adv-notice"' in text:
            start = text.index('<div class="adv-notice"')
            end = text.index('</div>', start) + len('</div>')
            text = text[:start] + NOTICE + text[end:]
        else:
            text = text.replace('</header>', '</header>' + chr(10) + NOTICE, 1)
        path.write_text(text, encoding='utf-8')
    print('✅ 已刷新召唤师·进阶页提示文案')
    return 0


def main() -> int:
    if '--notice-only' in sys.argv:
        return update_notice_only()
    check = '--check' in sys.argv
    if check:
        ok = PAGE.exists() and 'adv-notice' in PAGE.read_text(encoding='utf-8')
        print('召唤师·进阶占位页:', '已生成' if ok else '缺失')
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1

    text = TEMPLATE.read_text(encoding='utf-8')
    for a, b in (('wd-adv-search', f'{PREFIX}-adv-search'), ('wd-adv-container', f'{PREFIX}-adv-container'),
                 ('wd-adv-empty', f'{PREFIX}-adv-empty'), ('守望者', CLASS)):
        text = text.replace(a, b)

    articles, n = build_articles()
    pattern = re.compile(
        rf'(<div class="adv-container" id="{PREFIX}-adv-container">\s*)(.*?)(<div id="{PREFIX}-adv-empty"[^>]*>)',
        re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        raise SystemExit('无法定位进阶容器')
    text = text[:m.start()] + m.group(1) + articles + '\n\n' + m.group(3) + text[m.end():]
    text = re.sub(r'(<p class="subtitle">)[^<]*(</p>)', rf'\g<1>通用进阶 {n} 条 · 专属进阶等待更新\g<2>', text, count=1)
    text = text.replace('</header>', '</header>\n' + NOTICE, 1)
    PAGE.write_text(text, encoding='utf-8')
    if MIRROR.exists() or (ROOT / 'electron-app' / '职业页').exists():
        MIRROR.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(PAGE, MIRROR)
    print(f'✅ 已生成 {PAGE.relative_to(ROOT)}（通用进阶 {n} 条 + 等待更新提示）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
