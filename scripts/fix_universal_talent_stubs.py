# -*- coding: utf-8 -*-
"""
Repair broken article stubs in 职业页/通用天赋树.html caused by bad tier cut-paste.

Rejoins orphan openings (article+h4 only) with orphan bodies (chips+detail),
places complete cards into correct tiers, fixes 冲击之铠 nesting, updates nav.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "职业页" / "通用天赋树.html"

# Title -> target tier digit (一二三四五六七)
TIER_MAP = {
    "猛火": "四",
    "剧毒物质": "四",
    "深度创伤": "四",
    "稳固经济": "五",
    "兢业玩家": "五",
    "英雄弧光": "五",
    "深渊呢喃": "五",
    "八毫米": "五",
    "哟吼船长的藏宝图": "五",
    "饥饿游戏": "六",
    "回避身形": "六",
    "唤醒": "六",
    "信手拈来": "六",
    "超体": "六",
    "表演型人格": "六",
    "使命必达": "六",
    "利见大人": "六",
    "伤害阈值": "六",
    "以刃承伤": "七",
    "魔力偏转": "七",
    "化险为夷": "七",
    "神圣干涉": "七",
}

# Prefer data-side id for 藏宝图
ID_OVERRIDE = {
    "哟吼船长的藏宝图": "g-skill-387",
}

STUB_OPEN_RE = re.compile(
    r'[ \t]*<article class="skill" id="(g-skill-\d+)"([^>]*)>'
    r'\s*<h4>([^<]+?)\s*<span class="chip"[^>]*>[^<]*</span></h4>\s*'
    r'(?=<article class="skill"|</div>)',
    re.M,
)


def find_orphan_bodies(html: str) -> list[tuple[int, int, str]]:
    """Return list of (start, end, text) for orphan chips+detail+</article>."""
    out = []
    for m in re.finditer(
        r'[ \t]*<div class="chips">[\s\S]*?</div>\s*<div class="detail">[\s\S]*?</div>\s*</article>\s*',
        html,
    ):
        before = html[max(0, m.start() - 250) : m.start()]
        # Proper articles have <article ...><h4> then chips; orphans have </article> or section noise before chips
        if re.search(r'<article class="skill"[^>]*>\s*<h4>[^<]*</h4>\s*$', before):
            continue
        # also skip if immediately after h4 of same article (complete)
        if re.search(r'<h4>[^<]*(?:<span[^>]*>[^<]*</span>)?</h4>\s*$', before):
            continue
        out.append((m.start(), m.end(), m.group(0)))
    return out


def set_tier_chip(opening: str, tier_digit: str) -> str:
    return re.sub(
        r'(<span class="chip" style="background:#888">)[^<]*(</span>)',
        rf"\g<1>{tier_digit}阶\2",
        opening,
        count=1,
    )


def set_article_id(opening: str, new_id: str) -> str:
    return re.sub(r'id="g-skill-\d+"', f'id="{new_id}"', opening, count=1)


def main() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")
    original = html

    # --- Collect stub openings ---
    stubs = []
    for m in STUB_OPEN_RE.finditer(html):
        sid, attrs, title = m.group(1), m.group(2), m.group(3).strip()
        stubs.append(
            {
                "id": sid,
                "title": title,
                "opening": m.group(0),
                "start": m.start(),
                "end": m.end(),
            }
        )
    print(f"stub openings: {len(stubs)}")
    for s in stubs:
        print(f"  {s['id']} {s['title']}")

    # --- Collect orphan bodies ---
    orphans = find_orphan_bodies(html)
    print(f"orphan bodies: {len(orphans)}")

    # Identify 伤害阈值 orphan in 六阶 by content
    shang_body = None
    other_orphans = []
    for start, end, text in orphans:
        if "不能超过30点" in text:
            shang_body = (start, end, text)
        else:
            other_orphans.append((start, end, text))

    # Match stubs (excluding 伤害阈值) to orphan bodies after 抉择R by fingerprint
    def fingerprint(text: str) -> str:
        # Use distinctive precondition snippet
        m = re.search(r"前置条件：</span>([^<]{8,40})", text)
        if m:
            return m.group(1).strip()
        m = re.search(r"data-search=\"([^\"]{10,40})", text)
        return m.group(1) if m else text[:40]

    stub_by_fp = {}
    for s in stubs:
        if s["title"] == "伤害阈值":
            continue
        fp = fingerprint(s["opening"])
        # opening uses data-search
        m = re.search(r'data-search="([^"]+)"', s["opening"])
        key = m.group(1)[:50] if m else s["title"]
        stub_by_fp[s["title"]] = s

    # Pair by title keywords in orphan detail
    title_keys = {
        "哟吼船长的藏宝图": "奇珍品质神奇道具",
        "猛火": "烈火侵袭",
        "剧毒物质": "猛毒侵袭",
        "深度创伤": "重创侵袭",
        "稳固经济": "共享钱袋",
        "兢业玩家": "经验值礼包或技能点礼包",
        "英雄弧光": "弧光标记",
        "深渊呢喃": "呢喃标记",
        "八毫米": "奇械摄影",
        "饥饿游戏": "兽人式狂怒",
        "回避身形": "猫之优雅",
        "唤醒": "良好休息或韧性",
        "信手拈来": "天赋异禀",
        "超体": "心电感应",
        "表演型人格": "表演家或领袖气质",
        "使命必达": "钢铁毅力或殊死一搏",
        "利见大人": "意外横财或投机客",
        "以刃承伤": "必须持有武器",
        "魔力偏转": "疲劳值低于1",
        "化险为夷": "禁锢和压制状态下施展这个效果",
        "神圣干涉": "虔诚的信仰",
    }

    paired: dict[str, tuple[dict, str]] = {}
    used_orphan_idx = set()
    for title, key in title_keys.items():
        stub = next((s for s in stubs if s["title"] == title), None)
        if not stub:
            print(f"WARN: no stub for {title}")
            continue
        found = None
        for i, (start, end, text) in enumerate(other_orphans):
            if i in used_orphan_idx:
                continue
            if key in text:
                found = (i, text)
                break
        if not found:
            print(f"WARN: no orphan body for {title} key={key}")
            continue
        used_orphan_idx.add(found[0])
        paired[title] = (stub, found[1])
        print(f"paired: {title}")

    if shang_body:
        stub333 = next((s for s in stubs if s["title"] == "伤害阈值"), None)
        if stub333:
            paired["伤害阈值"] = (stub333, shang_body[2])
            print("paired: 伤害阈值")

    # --- Remove all stub openings and orphan bodies from HTML (high to low index) ---
    removals: list[tuple[int, int]] = []
    for s in stubs:
        removals.append((s["start"], s["end"]))
    for start, end, _ in orphans:
        removals.append((start, end))

    # Also remove the 伤害阈值 stub that sits between 冲击之铠 chips and detail
    # (already in stubs via STUB_OPEN_RE if followed by... wait, it's followed by <div class="detail">
    # STUB_OPEN_RE only matches before <article or </div>. 伤害阈值 is before <div class="detail">.
    # Handle explicitly:
    dmg_stub = re.search(
        r'[ \t]*<article class="skill" id="g-skill-333"[^>]*>\s*'
        r'<h4>伤害阈值\s*<span class="chip"[^>]*>[^<]*</span></h4>\s*'
        r'(?=<div class="detail">)',
        html,
    )
    if dmg_stub:
        removals.append((dmg_stub.start(), dmg_stub.end()))
        print("found 伤害阈值 nest stub inside 冲击之铠")

    removals.sort(key=lambda x: x[0], reverse=True)
    # Deduplicate overlapping
    cleaned = []
    last_start = len(html) + 1
    for start, end in removals:
        if end <= last_start:
            cleaned.append((start, end))
            last_start = start
    for start, end in cleaned:
        html = html[:start] + html[end:]

    # Fix 冲击之铠: ensure </div> after chips before detail
    html = re.sub(
        r'(id="g-skill-371"[\s\S]*?<div class="chips">[\s\S]*?短休/长休</span>\s*)\s*(<div class="detail">)',
        r"\1</div>\n        \2",
        html,
        count=1,
    )
    # If chips already closed, leave it; if we doubled </div>, fix
    html = re.sub(
        r'(短休/长休</span>\s*</div>\s*)</div>\s*(<div class="detail">)',
        r"\1\2",
        html,
        count=1,
    )

    # --- Build complete articles ---
    def build_article(title: str, stub: dict, body: str) -> str:
        tier = TIER_MAP[title]
        opening = set_tier_chip(stub["opening"].rstrip(), tier)
        if title in ID_OVERRIDE:
            opening = set_article_id(opening, ID_OVERRIDE[title])
        # opening currently ends before next tag; ensure newline
        opening = opening.rstrip() + "\n"
        body = body.strip()
        if not body.startswith("<div"):
            # body may include leading whitespace already stripped
            pass
        # Ensure body has chips
        if not body.lstrip().startswith('<div class="chips">'):
            raise SystemExit(f"bad body for {title}")
        return opening + "        " + body.lstrip() + "\n"

    articles_by_tier: dict[str, list[str]] = {t: [] for t in "一二三四五六七"}
    for title, (stub, body) in paired.items():
        art = build_article(title, stub, body)
        tier = TIER_MAP[title]
        articles_by_tier[tier].append((title, art))
        print(f"built {title} -> {tier}阶 len={len(art)}")

    # Special: 藏宝图 — ensure 奇珍 in body (already) and id g-skill-387

    # --- Insert into tiers ---
    # Insertion anchors (after these skill articles' closing)
    INSERT_AFTER = {
        "四": "烈火侵袭",  # insert 猛火/剧毒/深度 after related skills if possible; else end of 四 before 五
        "五": "辩护人",  # 藏宝图 after 辩护人; others near end of 五 / after 功利玩家 cluster
        "六": "祈雨节的渴望",  # 饥饿游戏 cluster before 冬幕节; 伤害阈值 near existing nav
        "七": "抉择R·你仅能够选择其中一项习得",
    }

    def insert_after_skill(html_text: str, skill_name: str, block: str) -> str:
        # Find </article> that closes the named skill
        pat = re.compile(
            rf'(<article class="skill"[^>]*>\s*<h4>{re.escape(skill_name)}\s*<span[\s\S]*?</article>)',
            re.M,
        )
        m = pat.search(html_text)
        if not m:
            print(f"WARN: anchor skill not found: {skill_name}")
            return html_text
        return html_text[: m.end()] + "\n" + block + html_text[m.end() :]

    def insert_before_skill(html_text: str, skill_name: str, block: str) -> str:
        pat = re.compile(
            rf'(<article class="skill"[^>]*>\s*<h4>{re.escape(skill_name)}\s*)',
            re.M,
        )
        m = pat.search(html_text)
        if not m:
            print(f"WARN: before-anchor not found: {skill_name}")
            return html_text
        return html_text[: m.start()] + block + "\n" + html_text[m.start() :]

    def insert_end_of_tier(html_text: str, tier_digit: str, block: str) -> str:
        # Before closing </div></section> of that tier
        h3 = f"<h3>{tier_digit}阶天赋树</h3>"
        pos = html_text.find(h3)
        if pos < 0:
            raise SystemExit(f"tier {tier_digit} missing")
        # find end of this section's tier-list
        sec_end = html_text.find("</section>", pos)
        list_close = html_text.rfind("</div>", pos, sec_end)
        return html_text[:list_close] + block + "\n" + html_text[list_close:]

    # Place 四阶: after 绝境反击 or before end of 四 — use insert before first 五阶 skill 自由攻势
    four_block = "\n".join(a for _, a in articles_by_tier["四"])
    if four_block:
        html = insert_before_skill(html, "自由攻势", four_block)

    # Place 五阶: 藏宝图 after 辩护人; rest after 功利玩家 (or after 藏宝图)
    five = dict(articles_by_tier["五"])
    if "哟吼船长的藏宝图" in five:
        html = insert_after_skill(html, "辩护人", five.pop("哟吼船长的藏宝图"))
    five_rest = "\n".join(five.values())
    if five_rest:
        # after 功利玩家 if present else after 藏宝图
        if 'id="g-skill-279"' in html or "功利玩家" in html:
            html = insert_after_skill(html, "功利玩家", five_rest)
        else:
            html = insert_after_skill(html, "哟吼船长的藏宝图", five_rest)

    # Place 六阶: 伤害阈值 — reattach opening to orphan that was in 六阶 (already removed); insert after 机制怪
    six = dict(articles_by_tier["六"])
    if "伤害阈值" in six:
        html = insert_after_skill(html, "机制怪", six.pop("伤害阈值"))
    # 饥饿游戏 cluster: before 冬幕节的礼物
    six_rest = "\n".join(six.values())
    if six_rest:
        html = insert_before_skill(html, "冬幕节的礼物", six_rest)

    # Place 七阶: after 抉择R
    seven_block = "\n".join(a for _, a in articles_by_tier["七"])
    if seven_block:
        html = insert_after_skill(html, "抉择R·你仅能够选择其中一项习得", seven_block)

    # --- Fix navigation ---
    # Remove from 七阶 nav the moved skills; add to correct nav sections
    move_nav_titles = list(TIER_MAP.keys())

    def strip_nav_link(html_text: str, title: str) -> str:
        return re.sub(
            rf'[ \t]*<a class="skill-link" href="#[^"]+">{re.escape(title)}</a>\s*\n?',
            "",
            html_text,
        )

    for title in move_nav_titles:
        html = strip_nav_link(html, title)

    # Add nav links using article ids from built HTML
    def find_id(html_text: str, title: str) -> str | None:
        m = re.search(
            rf'<article class="skill" id="(g-skill-\d+)"[^>]*>\s*<h4>{re.escape(title)}\s',
            html_text,
        )
        return m.group(1) if m else None

    def add_nav(html_text: str, tier_digit: str, title: str, after_title: str | None) -> str:
        sid = find_id(html_text, title)
        if not sid:
            print(f"WARN: no id for nav {title}")
            return html_text
        link = f'  <a class="skill-link" href="#{sid}">{title}</a>\n'
        # find nav-tier details for this tier
        marker = f'<summary class="tier-summary"><a href="#g-tier-{tier_digit}">{tier_digit}阶天赋树</a></summary>'
        pos = html_text.find(marker)
        if pos < 0:
            print(f"WARN: nav tier {tier_digit} missing")
            return html_text
        end = html_text.find("</details>", pos)
        section = html_text[pos:end]
        if title in section:
            return html_text
        if after_title and after_title in section:
            section2 = re.sub(
                rf'(<a class="skill-link" href="#[^"]+">{re.escape(after_title)}</a>\n)',
                rf"\1{link}",
                section,
                count=1,
            )
        else:
            section2 = section + link
        return html_text[:pos] + section2 + html_text[end:]

    # Nav placement hints
    nav_plan = [
        ("四", "猛火", "绝境反击"),
        ("四", "剧毒物质", "猛火"),
        ("四", "深度创伤", "剧毒物质"),
        ("五", "哟吼船长的藏宝图", "辩护人"),
        ("五", "稳固经济", "功利玩家"),
        ("五", "兢业玩家", "稳固经济"),
        ("五", "英雄弧光", "兢业玩家"),
        ("五", "深渊呢喃", "英雄弧光"),
        ("五", "八毫米", "深渊呢喃"),
        ("六", "伤害阈值", "机制怪"),
        ("六", "饥饿游戏", "祈雨节的渴望"),
        ("六", "回避身形", "饥饿游戏"),
        ("六", "唤醒", "回避身形"),
        ("六", "信手拈来", "唤醒"),
        ("六", "超体", "信手拈来"),
        ("六", "表演型人格", "超体"),
        ("六", "使命必达", "表演型人格"),
        ("六", "利见大人", "使命必达"),
        ("七", "以刃承伤", "抉择R·你仅能够选择其中一项习得"),
        ("七", "魔力偏转", "以刃承伤"),
        ("七", "化险为夷", "魔力偏转"),
        ("七", "神圣干涉", "化险为夷"),
    ]
    for tier, title, after in nav_plan:
        html = add_nav(html, tier, title, after)

    # --- Validate ---
    opens = len(re.findall(r'<article class="skill"', html))
    closes = len(re.findall(r"</article>", html))
    print(f"article open={opens} close={closes} delta={opens - closes}")

    nested = 0
    for m in re.finditer(r'<div class="chips">([\s\S]*?)</div>', html):
        if "<article" in m.group(1):
            nested += 1
    print(f"chips-nested-article sites: {nested}")

    # 藏宝图 checks
    if "哟吼船长的藏宝图" not in html:
        raise SystemExit("FAIL: 藏宝图 missing")
    if 'href="#g-skill-421"' in html:
        print("WARN: old id g-skill-421 still in nav")
    if not re.search(r'id="g-skill-387"[^>]*>\s*<h4>哟吼船长的藏宝图\s*<span[^>]*>五阶</span>', html):
        # soft check
        m = re.search(r'<h4>哟吼船长的藏宝图\s*<span[^>]*>([^<]+)</span>', html)
        print(f"藏宝图 chip: {m.group(1) if m else 'MISSING'}")
        mid = re.search(r'<article class="skill" id="(g-skill-\d+)"[^>]*>\s*<h4>哟吼船长的藏宝图', html)
        print(f"藏宝图 id: {mid.group(1) if mid else 'MISSING'}")

    # Remaining stubs?
    left = list(STUB_OPEN_RE.finditer(html))
    print(f"remaining stubs: {len(left)}")
    for m in left[:5]:
        print(" ", m.group(3).strip())

    if opens != closes:
        raise SystemExit("FAIL: article tag imbalance")
    if nested:
        raise SystemExit("FAIL: nested articles in chips remain")

    HTML_PATH.write_text(html, encoding="utf-8")
    print(f"wrote {HTML_PATH} ({len(html)} chars, was {len(original)})")


if __name__ == "__main__":
    main()
