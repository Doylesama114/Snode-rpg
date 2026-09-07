#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验职业技能页左侧导航：nav-tier 分组必须与 article data-tier/style 一致。

可发现两类历史 bug：
1. 高阶技能链接被错误塞进低阶 nav-tier；
2. 技能缺少导航链接，或同一技能出现在多个 nav-tier。
"""
from __future__ import annotations

import sys
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parent.parent
PAGES_DIR = ROOT / "职业页"

STANDARD_TIERS = ("一阶", "二阶", "三阶", "四阶", "五阶", "六阶", "七阶", "八阶", "九阶")


def tier_from_label(label: str) -> str | None:
    for tier in STANDARD_TIERS:
        if tier in label:
            return tier
    return None


def style_from_summary(summary) -> str | None:
    text = "".join(summary.itertext()).strip()
    if not text:
        return None
    return text.replace("风格", "").strip() or None


def audit_page(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    if '<article class="skill' not in text:
        return []
    tree = html.fromstring(text)

    articles = {}
    for a in tree.xpath('//article[contains(@class,"skill")]'):
        aid = a.get("id")
        if not aid:
            continue
        articles[aid] = {
            "tier": a.get("data-tier"),
            "style": a.get("data-style"),
        }

    navs = tree.xpath('//nav')
    if not navs:
        return ["no <nav>"]
    nav = navs[0]

    errors: list[str] = []
    seen: dict[str, tuple[str | None, str]] = {}

    for details in nav.xpath('.//details[contains(concat(" ", normalize-space(@class), " "), " nav-tier ")]'):
        summary = details.xpath("./summary[1]")
        if not summary:
            continue
        summary = summary[0]
        label = "".join(summary.itertext()).strip()
        tier = tier_from_label(label)
        if not tier:
            continue

        group = details.xpath(
            './ancestor::details[contains(concat(" ", normalize-space(@class), " "), " nav-group ")][1]'
        )
        if group:
            gs = group[0].xpath("./summary[1]")
            style = style_from_summary(gs[0]) if gs else None
        else:
            prev = details.xpath(
                './preceding-sibling::summary[contains(concat(" ", normalize-space(@class), " "), " style-summary ")][1]'
            )
            style = style_from_summary(prev[0]) if prev else None

        for a in details.xpath('.//a[contains(@class,"skill-link")]'):
            sid = (a.get("href") or "").lstrip("#")
            txt = "".join(a.itertext()).strip()
            art = articles.get(sid)
            if not art:
                errors.append(f"导航链接指向不存在的技能：#{sid}（{txt}）")
                continue
            art_tier = art.get("tier")
            art_style = art.get("style")
            if art_tier not in STANDARD_TIERS:
                continue
            if art_tier != tier:
                errors.append(
                    f"阶位错放：{sid} {txt} 在导航「{style}/{tier}」，文章为「{art_style}/{art_tier}」"
                )
            if style and art_style and style != art_style:
                errors.append(
                    f"风格错放：{sid} {txt} 在导航「{style}/{tier}」，文章为「{art_style}/{art_tier}」"
                )
            if sid in seen:
                errors.append(f"重复导航：{sid} {txt}")
            else:
                seen[sid] = (style, tier)

    for sid, art in articles.items():
        art_tier = art.get("tier")
        if art_tier not in STANDARD_TIERS:
            continue
        if sid not in seen:
            errors.append(f"缺少导航：{sid}（{art.get('style')}/{art_tier}）")
        else:
            style, tier = seen[sid]
            if tier != art_tier or (style and art.get("style") and style != art.get("style")):
                errors.append(f"导航分组错误：{sid} 实际 {seen[sid]}，文章 {art}")

    return errors


def main() -> int:
    total = 0
    pages = 0
    for path in sorted(PAGES_DIR.glob("*.html")):
        errors = audit_page(path)
        if errors:
            total += len(errors)
            print(f"FAIL {path.name} ({len(errors)})")
            for e in errors[:60]:
                print("  -", e)
        elif '<article class="skill' in path.read_text(encoding="utf-8"):
            pages += 1
    if total:
        print(f"导航阶位分组校验失败：{total} 处")
        return 1
    print(f"PASS: 导航阶位分组校验通过（{pages} 个技能页）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
