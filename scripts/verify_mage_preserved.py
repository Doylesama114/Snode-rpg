#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""法师变化五阶保留 + 本次 docx 定向增量校验。

约定：源 docx 目前缺失变化五阶，原作者补齐前站点这 9 条技能必须原样保留。
本脚本同时校验本次明确同步的 4 处，以及 2 处等待作者的项仍保持旧文案。
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from lxml import html as lxml_html

ROOT = Path(__file__).resolve().parent.parent

T5 = {
    "m-skill-8-5-1": ("变形术·枭熊", "e1d648fdbe2e78ec6ea73dffc435674a7ea83b5994cb8146846e110f03a372e4"),
    "m-skill-8-5-2": ("变形术·鱼", "f258f94a405f9275798ed3b505190167693e0f66a18ec47a0859b81e22c96661"),
    "m-skill-8-5-3": ("变形术·鸟", "a37fdbd25e0bf96fa493806d2f7e991d8139544857369c381d3ab12d9d56b7e8"),
    "m-skill-8-5-4": ("四臂术", "03e8d828aa8d9735137edd7312a04ad86c2455f9888fc60aaba8d54ac6c279fa"),
    "m-skill-8-5-5": ("爆裂术", "40d46299cf794f6cb634a740817a993eaa4fc10faff74480e9c96654bdf4ddbc"),
    "m-skill-8-5-6": ("石化术", "8cc08b127cd2e87cad68e311cbc254cd713338792a1419dd04d4503980905bde"),
    "m-skill-8-5-7": ("穿墙术", "b222e81632e170020ac8966c5a4ff41f1d97a63da4efe486d66199723aba7924"),
    "m-skill-8-5-8": ("软泥形态", "98a208c5c7463f26ed67a0b16a370a9377469083195d5a91f7a4dd26cc1c1b7d"),
    "m-skill-8-5-9": ("隐匿传讯术", "90c562221ebdf9298bda1ab5557ae2ece176a9a9f9f9647b648404d404386692"),
}

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


def sha256_skill(skill: dict) -> str:
    blob = json.dumps(skill, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def main() -> int:
    data = json.loads((ROOT / "职业页" / "数据" / "法师.json").read_text(encoding="utf-8"))
    skills = data.get("skills", [])
    by_id = {s.get("id"): s for s in skills}
    names = {s.get("name") for s in skills}

    for sid, (name, expected_hash) in T5.items():
        check(sid in by_id, f"法师 JSON 缺失保留技能 {sid} {name}")
        if sid in by_id:
            check(by_id[sid].get("name") == name, f"{sid} 名称被改动: {by_id[sid].get('name')!r} != {name!r}")
            got = sha256_skill(by_id[sid])
            check(got == expected_hash, f"{sid} {name} 内容被改动（等待原作者补齐前必须原样保留）")

    # HTML：唯一 tier section、9 篇文章在 section 内、无重复 id
    tree = lxml_html.fromstring((ROOT / "职业页" / "法师.html").read_text(encoding="utf-8"))
    tier_nodes = tree.xpath('//*[@id="m-tier-变化-五阶"]')
    check(len(tier_nodes) == 1, f"m-tier-变化-五阶 节点数应为 1，实际 {len(tier_nodes)}")
    if tier_nodes:
        inside = tier_nodes[0].xpath('.//article[contains(@class,"skill")]')
        check(len(inside) == 9, f"变化五阶 section 内 article 数应为 9，实际 {len(inside)}")
        got_ids = [a.get("id") for a in inside]
        check(got_ids == list(T5.keys()), f"变化五阶 article 顺序/ID 不符: {got_ids}")
    all_ids = [e.get("id") for e in tree.xpath("//*[@id]")]
    dup = sorted({x for x in all_ids if all_ids.count(x) > 1})
    check(not dup, f"法师页面存在重复 id: {dup[:10]}")

    # 空导航/空 tier 回归（法师页应无残留）
    for nav_tier in tree.xpath('//details[contains(concat(" ", normalize-space(@class), " "), " nav-tier ")]'):
        links = nav_tier.xpath('.//a[contains(@class,"skill-link")]')
        check(bool(links), f"法师页面存在空 nav-tier: {''.join(nav_tier.itertext()).strip()[:30]}")
    for tier_el in tree.xpath('//*[@id and contains(concat(" ", normalize-space(@class), " "), " tier ")]'):
        arts = tier_el.xpath('.//article[contains(@class,"skill")]')
        check(bool(arts), f"法师页面存在空 tier section: {tier_el.get('id')}")
    t5_nav = tree.xpath('//details[contains(concat(" ", normalize-space(@class), " "), " nav-tier ")][.//a[@href="#m-tier-变化-五阶"]]')
    if t5_nav:
        t5_links = t5_nav[0].xpath('.//a[contains(@class,"skill-link")]')
        check(len(t5_links) == 9, f"变化五阶导航链接数应为 9，实际 {len(t5_links)}")

    html_text = (ROOT / "职业页" / "法师.html").read_text(encoding="utf-8")
    for sid, (name, _h) in T5.items():
        check(f'id="{sid}"' in html_text, f"法师 HTML 缺失保留技能 article {sid} {name}")

    # FX / panel_data SKILL_DATA / search-index / advisor mage_index 保留名称
    fx_doc = json.loads((ROOT / "斯诺德跑团" / "skill_effects_法师.json").read_text(encoding="utf-8"))
    fx_names = {e.get("name") for e in fx_doc.get("法师", [])}
    for _sid, (name, _h) in T5.items():
        check(name in fx_names, f"skill_effects_法师.json 缺失 {name}")

    panel_text = (ROOT / "斯诺德跑团" / "panel_data.js").read_text(encoding="utf-8")
    m = re.search(r"var SKILL_DATA = (\{.*?\});\s*$", panel_text, re.M)
    check(bool(m), "panel_data.js 未找到 SKILL_DATA")
    if m:
        panel_skill_data = json.loads(m.group(1))
        panel_names = {s.get("n") or s.get("name") for s in panel_skill_data.get("法师", [])}
        for _sid, (name, _h) in T5.items():
            check(name in panel_names, f"panel_data.js SKILL_DATA 缺失 {name}")

    search = json.loads((ROOT / "职业页" / "search-index.json").read_text(encoding="utf-8"))
    search_mage = {s.get("skillName") for s in search.get("skills", []) if s.get("classname") == "法师"}
    for _sid, (name, _h) in T5.items():
        check(name in search_mage, f"search-index.json 缺失法师技能 {name}")

    advisor = json.loads((ROOT / "advisor" / "skills" / "mage_index.json").read_text(encoding="utf-8"))
    advisor_names = {s.get("name") for s in advisor.get("skills", [])}
    for _sid, (name, _h) in T5.items():
        check(name in advisor_names, f"advisor mage_index.json 缺失 {name}")

    # 本次 4 处定向同步
    s361 = by_id.get("m-skill-3-6-1", {})
    check("己方阵营先攻顺位的第一位" in json.dumps(s361, ensure_ascii=False), "先攻预感前置条件未同步")
    check("己方阵营最高顺位" in json.dumps(s361, ensure_ascii=False), "先攻预感描述未同步")
    s373 = by_id.get("m-skill-3-7-3", {})
    check("行动顺位" in json.dumps(s373, ensure_ascii=False), "宿命环·未来未同步行动顺位")
    s4511 = by_id.get("m-skill-4-5-11", {})
    check("己方团队中最高" in json.dumps(s4511, ensure_ascii=False), "先制预兆最高顺位未同步")
    check("己方团队中最低" in json.dumps(s4511, ensure_ascii=False), "先制预兆最低顺位未同步")
    s511 = by_id.get("m-skill-5-1-1", {})
    check(s511.get("fields", {}).get("疲劳消耗") == "1", "困惑术疲劳消耗未同步为 1")
    check("每个自身回合限一次" not in json.dumps(s511, ensure_ascii=False), "困惑术仍残留 每个自身回合限一次")

    # 等待原作者的 2 处仍保持旧站点文案
    s278 = by_id.get("m-skill-2-7-8", {})
    check(s278.get("name") == "咒法学派序列", "m-skill-2-7-8 不应在作者修正前改名为预言学派序列")
    s615 = by_id.get("m-skill-6-1-5", {})
    check("先攻时序人非人值" not in json.dumps(s615, ensure_ascii=False), "召唤骷髅士兵不应同步 docx 笔误")

    if errors:
        print(f"FAIL: 法师保留/增量校验失败 {len(errors)} 项")
        for e in errors:
            print("  -", e)
        return 1
    print(f"PASS: 法师变化五阶 9 条原样保留；4 处定向同步有效；2 处待作者项未误改。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
