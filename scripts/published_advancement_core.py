#!/usr/bin/env python3
"""Parse 已公布进阶职业.docx → ADVANCEMENT_DETAILS-shaped records."""
from __future__ import annotations

import json
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "已公布进阶职业.docx"
ADV_PAGE = ROOT / "职业页"
DETAILS_JS = ADV_PAGE / "advancement_details.js"
ELECTRON_ADV = ROOT / "electron-app" / "职业页"
EXTRACT_OUT = Path(__file__).resolve().parent / "extracts" / "published_advancements.json"

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{NS}}}"

TAG_RE = re.compile(
    r"^(天赋|机制|配方|战技|法术|异能|功法|神术|能力|本能)(\.|$)"
)
FIELD_KEYS = (
    "施展时间", "施展距离", "持续时间", "疲劳消耗", "关键词",
    "施展条件", "施展限制", "限制", "描述", "配方", "负重", "品质", "效果",
    "制作时间", "参考价格", "类别", "注释", "职业要求",
)
FIELD_RE = re.compile(r"^(" + "|".join(FIELD_KEYS) + r")[：:]")
SEP_RE = re.compile(r"^-{3,}$")


def extract_paragraphs(docx_path: Path) -> list[str]:
    with zipfile.ZipFile(docx_path) as z:
        tree = ET.fromstring(z.read("word/document.xml"))
    paras: list[str] = []
    for p in tree.iter(f"{W}p"):
        text = "".join((t.text or "") for t in p.iter(f"{W}t")).strip()
        if text:
            paras.append(text)
    return paras


def split_advancement_sections(paras: list[str]) -> list[tuple[str, list[str]]]:
    """Return [(name, body_paras)] where body starts after 进阶效果."""
    effect_idxs = [i for i, p in enumerate(paras) if p == "进阶效果"]
    sections: list[tuple[str, list[str]]] = []
    for ei, idx in enumerate(effect_idxs):
        name = paras[idx - 1] if idx > 0 else f"未知{ei}"
        end = effect_idxs[ei + 1] - 1 if ei + 1 < len(effect_idxs) else len(paras)
        # body: after 进阶效果, up to (but not including) next title which sits just before next 进阶效果
        body = paras[idx + 1 : end]
        sections.append((name, body))
    return sections


def is_tag(line: str) -> bool:
    return bool(TAG_RE.match(line.strip()))


def split_tag_and_overflow(line: str) -> tuple[str, str]:
    """Split '天赋.短词.长句…' into (tags, overflow_desc)."""
    line = line.strip()
    if not is_tag(line):
        return "", line
    parts = line.split(".")
    tags_parts = [parts[0]]
    i = 1
    while i < len(parts):
        seg = parts[i]
        # Prose / long segment → remainder is description overflow
        if (
            len(seg) > 16
            or "。" in seg
            or "，" in seg
            or seg.startswith("你")
            or seg.startswith("剑")
            or seg.startswith("使")
        ):
            break
        tags_parts.append(seg)
        i += 1
        if len(tags_parts) >= 6:
            break
    tags = ".".join(tags_parts)
    rest = ".".join(parts[i:]).lstrip(".")
    return tags, rest


def is_field(line: str) -> bool:
    return bool(FIELD_RE.match(line.strip()))


def is_sep(line: str) -> bool:
    return bool(SEP_RE.match(line.strip()))


def is_insight_title(line: str, adv_name: str) -> bool:
    t = line.strip()
    return t == f"{adv_name}心得" or (t.endswith("心得") and adv_name in t)


def looks_like_title(line: str) -> bool:
    t = line.strip()
    if not t or is_tag(t) or is_field(t) or is_sep(t):
        return False
    if t == "进阶效果":
        return False
    if "获得以下增益效果" in t:
        return False
    if len(t) > 40:
        return False
    if t.startswith("·") or t.startswith("（") or t[0].isdigit():
        return False
    return True


def join_desc(lines: list[str]) -> str:
    return "\n".join(x.strip() for x in lines if x.strip())


def rows_from_skill_buf(title: str, buf: list[str]) -> list[list[str]]:
    rows: list[list[str]] = [[title]]
    for bl in buf:
        if is_sep(bl):
            continue
        rows.append([bl])
    return rows


def parse_section(name: str, body: list[str]) -> dict:
    """Parse one advancement body into details schema + completeness flags."""
    i = 0
    n = len(body)

    # Flavor / desc
    desc_lines: list[str] = []
    while i < n:
        line = body[i]
        if is_tag(line) or is_insight_title(line, name):
            break
        if looks_like_title(line) and i + 1 < n and is_tag(body[i + 1]):
            break
        desc_lines.append(line)
        i += 1
        if "获得以下增益效果" in line:
            break

    desc_html = join_desc(desc_lines)

    abilities: list[dict] = []
    insight: dict | None = None
    tables: list[list[list[str]]] = []

    def read_block_after_title(start: int) -> tuple[str, str, list[str], int]:
        """title at start; optional tag; body until next title/insight/end."""
        title = body[start].strip()
        j = start + 1
        tags = ""
        buf: list[str] = []
        if j < n and is_tag(body[j]):
            tags, overflow = split_tag_and_overflow(body[j])
            if overflow:
                buf.append(overflow)
            j += 1
        # Morph packages (猛兽形态): keep nested form/stat blocks in one ability
        absorb_nested = title.endswith("形态") or ("变形" in tags and "激活" in tags)
        while j < n:
            cur = body[j]
            if is_insight_title(cur, name):
                break
            if absorb_nested:
                if cur in ("野性猎杀", "利爪攻势"):
                    break
            else:
                # Skill/item cards are separated by ---- in the docx
                if is_sep(cur):
                    break
                if looks_like_title(cur) and j + 1 < n and is_tag(body[j + 1]):
                    break
                if looks_like_title(cur) and j + 1 < n and is_field(body[j + 1]):
                    break
            if is_sep(cur):
                buf.append(cur)
                j += 1
                continue
            buf.append(cur)
            j += 1
        return title, tags, buf, j

    def block_has_skill_fields(buf: list[str]) -> bool:
        return any(is_field(x) for x in buf[:8])

    def is_skill_card_at(idx: int) -> bool:
        """Title followed by field lines (skill / recipe / item card)."""
        if idx >= n or not looks_like_title(body[idx]):
            return False
        if is_insight_title(body[idx], name):
            return False
        if idx + 1 >= n:
            return False
        nxt = body[idx + 1]
        return is_field(nxt) and not is_tag(nxt)

    def is_ability_at(idx: int) -> bool:
        if idx >= n or not looks_like_title(body[idx]):
            return False
        if is_insight_title(body[idx], name):
            return False
        return idx + 1 < n and is_tag(body[idx + 1])

    def absorb_nested_skills(target: dict) -> None:
        """Pull following skill/recipe cards (+ intervening prose) into nested_skills."""
        nested: list = []
        nonlocal i
        while i < n:
            if is_sep(body[i]):
                i += 1
                continue
            if is_insight_title(body[i], name):
                break
            if is_ability_at(i):
                break
            if is_skill_card_at(i):
                title, _tags, buf, i = read_block_after_title(i)
                nested.append(rows_from_skill_buf(title, buf))
                continue
            # Intervening prose belonging to the parent ability/insight
            line = body[i].strip()
            if line and not is_tag(line):
                if nested:
                    # Keep document order between nested skills
                    nested.append({"prose": line})
                else:
                    prev = (target.get("desc_html") or "").rstrip()
                    target["desc_html"] = (prev + "\n" + line).strip() if prev else line
            i += 1
        if nested:
            target["nested_skills"] = nested

    while i < n:
        line = body[i]
        if is_sep(line):
            i += 1
            continue

        if is_insight_title(line, name):
            title, tags, buf, i = read_block_after_title(i)
            insight = {
                "name": title,
                "tags": tags or "天赋",
                "desc_html": join_desc(buf),
            }
            absorb_nested_skills(insight)
            continue

        if is_ability_at(i) or is_skill_card_at(i):
            title, tags, buf, i = read_block_after_title(i)
            if block_has_skill_fields(buf) or (not tags and any(is_field(x) for x in buf)):
                # Orphan skill card (no parent) — keep as top-level table
                tables.append(rows_from_skill_buf(title, buf))
            else:
                ability = {
                    "name": title,
                    "tags": tags or "天赋",
                    "desc_html": join_desc(buf),
                }
                absorb_nested_skills(ability)
                abilities.append(ability)
            continue

        # orphan body lines — append to last ability if any
        if abilities and not is_tag(line):
            abilities[-1]["desc_html"] = (
                (abilities[-1]["desc_html"] + "\n" + line.strip()).strip()
            )
        i += 1

    nonempty = [a for a in abilities if (a.get("desc_html") or "").strip()]
    incomplete_reasons: list[str] = []
    if not abilities:
        incomplete_reasons.append("no_abilities")
    elif not nonempty:
        incomplete_reasons.append(
            "empty_ability_bodies:" + ",".join(a["name"] for a in abilities)
        )
    if not nonempty and insight and not (insight.get("desc_html") or "").strip():
        incomplete_reasons.append("empty_insight")

    incomplete = bool(incomplete_reasons)

    nested_ability = sum(
        1
        for a in abilities
        for item in (a.get("nested_skills") or [])
        if isinstance(item, list)
    )
    nested_insight = sum(
        1
        for item in ((insight or {}).get("nested_skills") or [])
        if isinstance(item, list)
    )

    entry: dict = {
        "name": name,
        "desc_html": desc_html,
        "abilities": abilities,
    }
    if insight:
        entry["insight"] = insight
    if tables:
        entry["tables"] = tables

    return {
        "entry": entry,
        "incomplete": incomplete,
        "incomplete_reasons": incomplete_reasons,
        "stats": {
            "ability_count": len(abilities),
            "table_count": len(tables),
            "nested_ability_skills": nested_ability,
            "nested_insight_skills": nested_insight,
            "has_insight": bool(insight),
            "desc_chars": len(desc_html),
        },
    }


def extract_all(docx_path: Path | None = None) -> dict:
    docx_path = docx_path or DOCX
    paras = extract_paragraphs(docx_path)
    sections = split_advancement_sections(paras)
    records = []
    for name, body in sections:
        parsed = parse_section(name, body)
        records.append({
            "name": name,
            "incomplete": parsed["incomplete"],
            "incomplete_reasons": parsed["incomplete_reasons"],
            "stats": parsed["stats"],
            "entry": parsed["entry"],
        })
    return {
        "source": str(docx_path.name),
        "count": len(records),
        "incomplete_names": [r["name"] for r in records if r["incomplete"]],
        "complete_names": [r["name"] for r in records if not r["incomplete"]],
        "records": records,
    }


def load_details_js(path: Path | None = None) -> list[dict]:
    path = path or DETAILS_JS
    text = path.read_text(encoding="utf-8")
    m = re.search(r"var\s+ADVANCEMENT_DETAILS\s*=\s*(\[[\s\S]*\])\s*;", text)
    if not m:
        raise ValueError(f"ADVANCEMENT_DETAILS not found in {path}")
    return json.loads(m.group(1))


def write_details_js(entries: list[dict], path: Path | None = None) -> None:
    path = path or DETAILS_JS
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    path.write_text(
        f"var ADVANCEMENT_DETAILS = {payload};\n",
        encoding="utf-8",
        newline="\n",
    )


def preserve_media_fields(old: dict | None, new_entry: dict) -> dict:
    """Keep hand-tuned images/tables for 怪物 etc. when present in old JS."""
    if not old:
        return new_entry
    out = dict(new_entry)
    for key in ("image_sections", "image_markers"):
        if key in old and key not in out:
            out[key] = old[key]
    # Monster: prefer old multi-col parts tables (docx parse cannot rebuild 2D grid)
    if old.get("name") == "怪物" and old.get("tables"):
        out["tables"] = old["tables"]
    elif old.get("tables") and not out.get("tables"):
        # Only keep structured multi-column tables; skill-card tables are now nested_skills
        structured = [
            t for t in old["tables"]
            if t and t[0] and isinstance(t[0], list) and len(t[0]) > 1
        ]
        if structured:
            out["tables"] = structured
    return out


def upsert_details(extract: dict, existing: list[dict] | None = None) -> tuple[list[dict], dict]:
    existing = existing if existing is not None else load_details_js()
    by_old = {e["name"]: e for e in existing}
    result: list[dict] = []
    applied: list[str] = []
    skipped: list[str] = []

    for rec in extract["records"]:
        if rec["incomplete"]:
            skipped.append(rec["name"])
            # Keep old entry if any
            if rec["name"] in by_old:
                result.append(by_old[rec["name"]])
            continue
        entry = preserve_media_fields(by_old.get(rec["name"]), rec["entry"])
        result.append(entry)
        applied.append(rec["name"])

    # Keep any old entries not in docx (should be none)
    docx_names = {r["name"] for r in extract["records"]}
    extras = [e for e in existing if e["name"] not in docx_names]
    result.extend(extras)

    report = {
        "applied": applied,
        "skipped_incomplete": skipped,
        "preserved_extras": [e["name"] for e in extras],
        "total": len(result),
    }
    return result, report


def refresh_detail_buttons(detail_names: set[str] | None = None) -> dict:
    """Reconcile each adv-card button with ADVANCEMENT_DETAILS (article-scoped).

    Must NOT match across </article> — a previous cross-article regex caused
    undocumented cards (e.g. 影舞者) to inherit a neighbour's data-adv-name.
    """
    if detail_names is None:
        detail_names = {e["name"] for e in load_details_js()}
    changed_files = []
    pages = list(ADV_PAGE.glob("*·进阶.html"))
    article_re = re.compile(r"(<article\b[^>]*>)([\s\S]*?)(</article>)", re.I)
    name_re = re.compile(r'\bdata-name="([^"]+)"')
    btn_re = re.compile(
        r'<button class="(?:detail-btn|locked-btn)"[^>]*>[\s\S]*?</button>'
    )
    detail_btn = (
        '<button class="detail-btn" data-adv-name="{name}">查看详情</button>'
    )
    locked_btn = '<button class="locked-btn" disabled>🔒 未解锁</button>'

    def fix_article(m: re.Match) -> str:
        open_tag, body, close_tag = m.group(1), m.group(2), m.group(3)
        nm = name_re.search(open_tag) or name_re.search(body)
        if not nm:
            return m.group(0)
        name = nm.group(1)
        want = (
            detail_btn.format(name=name)
            if name in detail_names
            else locked_btn
        )

        def repl_btn(_bm: re.Match) -> str:
            return want

        new_body, n = btn_re.subn(repl_btn, body, count=1)
        if n == 0:
            # No button yet — insert before adv-detail or at end of body
            insert_at = new_body.find('<div class="adv-detail')
            if insert_at >= 0:
                new_body = new_body[:insert_at] + want + "\n        " + new_body[insert_at:]
            else:
                new_body = new_body.rstrip() + "\n              " + want + "\n"
        return open_tag + new_body + close_tag

    for page in pages:
        text = page.read_text(encoding="utf-8")
        new_text, n = article_re.subn(fix_article, text)
        if new_text != text:
            page.write_text(new_text, encoding="utf-8", newline="\n")
            changed_files.append({"file": page.name, "articles_touched": n})
    return {"files": changed_files, "detail_name_count": len(detail_names)}


def sync_electron_details(extra_globs: list[str] | None = None) -> list[str]:
    ELECTRON_ADV.mkdir(parents=True, exist_ok=True)
    copied = []
    src = DETAILS_JS
    dst = ELECTRON_ADV / "advancement_details.js"
    shutil.copy2(src, dst)
    copied.append(str(dst.relative_to(ROOT)))
    renderer = ADV_PAGE / "advancement_renderer.js"
    if renderer.exists():
        shutil.copy2(renderer, ELECTRON_ADV / "advancement_renderer.js")
        copied.append(str((ELECTRON_ADV / "advancement_renderer.js").relative_to(ROOT)))
    for page in ADV_PAGE.glob("*·进阶.html"):
        shutil.copy2(page, ELECTRON_ADV / page.name)
        copied.append(str((ELECTRON_ADV / page.name).relative_to(ROOT)))
    # images already shared as adv_img_*.png — copy if missing
    for img in ADV_PAGE.glob("adv_img_*.png"):
        target = ELECTRON_ADV / img.name
        if not target.exists() or img.stat().st_mtime > target.stat().st_mtime:
            shutil.copy2(img, target)
            copied.append(str(target.relative_to(ROOT)))
    if extra_globs:
        for g in extra_globs:
            for p in ADV_PAGE.glob(g):
                shutil.copy2(p, ELECTRON_ADV / p.name)
                copied.append(str((ELECTRON_ADV / p.name).relative_to(ROOT)))
    return copied


if __name__ == "__main__":
    data = extract_all()
    EXTRACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    EXTRACT_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "count": data["count"],
        "incomplete": data["incomplete_names"],
        "complete": len(data["complete_names"]),
    }, ensure_ascii=False, indent=2))
