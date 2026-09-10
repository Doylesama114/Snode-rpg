# -*- coding: utf-8 -*-
"""
法师 docx 定向增量同步（不跑全量 sync_class）。

背景：
- 新版源 docx 缺失“变化五阶”，原作者待补。站点现有 9 个变化五阶技能必须保留。
- 除变化五阶外，本次只同步 4 处明确改动；另有 2 处 docx 内部矛盾/笔误等待原作者修改，暂不同步。

本脚本只改：
  1) m-skill-3-6-1 先攻预感
  2) m-skill-3-7-3 宿命环·未来
  3) m-skill-4-5-11 先制预兆
  4) m-skill-5-1-1 困惑术
并做“变化五阶”最小结构修复：把 9 个 article 移入唯一的
<section class="tier" id="m-tier-变化-五阶">，删除重复空节点；不改任何技能文案。
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import (  # noqa: E402
    append_tables_to_search,
    build_data_search,
    build_detail_html,
    build_skill_data_attrs,
    json_to_fx_entry,
    marks_from_cost,
    patch_html,
    tier_label_from_skill,
)

CLASS = "法师"
HTML_PATH = ROOT / "职业页" / "法师.html"
DATA_PATH = ROOT / "职业页" / "数据" / "法师.json"
FX_PATH = ROOT / "斯诺德跑团" / "skill_effects_法师.json"
ELECTRON_HTML = ROOT / "electron-app" / "职业页" / "法师.html"
ELECTRON_DATA = ROOT / "electron-app" / "职业页" / "数据" / "法师.json"
ELECTRON_FX = ROOT / "electron-app" / "斯诺德跑团" / "skill_effects_法师.json"

# 源 docx 缺失的五阶技能：只做结构修复，内容保持不动。
T5_IDS = [
    "m-skill-8-5-1",
    "m-skill-8-5-2",
    "m-skill-8-5-3",
    "m-skill-8-5-4",
    "m-skill-8-5-5",
    "m-skill-8-5-6",
    "m-skill-8-5-7",
    "m-skill-8-5-8",
    "m-skill-8-5-9",
]
T5_NAMES = [
    "变形术·枭熊",
    "变形术·鱼",
    "变形术·鸟",
    "四臂术",
    "爆裂术",
    "石化术",
    "穿墙术",
    "软泥形态",
    "隐匿传讯术",
]

TEXT_REPLACEMENTS = {
    "m-skill-3-6-1": [
        ("你在本次游玩的战斗环节中为闪电区间", "你在本次游玩的战斗环节中为己方阵营先攻顺位的第一位"),
        ("改为令你的先攻时序值变为闪电区间", "改为令你的先攻时序值变为己方阵营最高顺位"),
    ],
    "m-skill-3-7-3": [
        ("可以自行选择行动区间", "可以自行选择行动顺位"),
    ],
    "m-skill-4-5-11": [
        ("如果你的先攻时序为闪电区间", "如果你的先攻时序值为己方团队中最高"),
        ("如果你的先攻时序为迟缓区间", "如果你的先攻时序值为己方团队中最低"),
    ],
    # 新版 docx 该处为笔误；等待原作者修正期间，站点恢复旧版正确文案。
    "m-skill-6-1-5": [
        ("先攻时序人非人值", "先攻时序值"),
    ],
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def apply_replacements_everywhere(obj, old: str, new: str):
    """对 JSON 子树中所有字符串做精确替换。"""
    if isinstance(obj, str):
        return obj.replace(old, new)
    if isinstance(obj, list):
        return [apply_replacements_everywhere(x, old, new) for x in obj]
    if isinstance(obj, dict):
        return {k: apply_replacements_everywhere(v, old, new) for k, v in obj.items()}
    return obj


def patch_json_skills(data: dict, report: dict) -> list[dict]:
    updated: list[dict] = []
    for skill in data["skills"]:
        sid = skill.get("id")
        if sid in TEXT_REPLACEMENTS:
            for old, new in TEXT_REPLACEMENTS[sid]:
                skill = apply_replacements_everywhere(skill, old, new)
            updated.append(skill)
        if sid == "m-skill-5-1-1":
            fields = skill.setdefault("fields", {})
            fields["疲劳消耗"] = "1"
            fields["关键词"] = "法术.惑控.感知豁免（15）"
            skill["tags"] = [t for t in (skill.get("tags") or []) if t != "每个自身回合限一次"]
            updated.append(skill)
    # 写回 data["skills"]（上面的 skill 对象原地更新，但替换函数返回了新对象，需要重建列表）
    by_id = {s.get("id"): s for s in updated}
    data["skills"] = [by_id.get(s.get("id"), s) for s in data["skills"]]
    report["updated_ids"] = [s["id"] for s in updated]
    return updated


def rebuild_article(html: str, skill: dict) -> str:
    mark_dots = marks_from_cost(skill)
    block = {
        "name": skill.get("name", ""),
        "fields": skill.get("fields", {}),
        "description": skill.get("description", []),
        "level_upgrades": skill.get("level_upgrades", []),
        "flavor": skill.get("flavor", ""),
        "mark_dots": mark_dots,
        "field_runs": skill.get("field_runs") or {},
        "description_entries": skill.get("description_entries") or [],
    }
    tables = {
        "unit_tables": skill.get("unit_tables") or [],
        "roll_tables": skill.get("roll_tables") or [],
    }
    detail_html = build_detail_html(block, tables)
    tier_lbl = tier_label_from_skill(skill)
    data_search = build_data_search(block, skill.get("style", ""), tier_lbl, skill.get("tags") or [])
    data_search = append_tables_to_search(data_search, skill)
    data_attrs = build_skill_data_attrs(skill, mark_dots, CLASS)
    return patch_html(html, skill["id"], detail_html, data_search, data_attrs)


def extract_article(html: str, sid: str) -> tuple[str, str]:
    marker = f'id="{sid}"'
    pos = html.find(marker)
    if pos < 0:
        raise ValueError(f"article not found: {sid}")
    start = html.rfind("<article", 0, pos)
    end = html.find("</article>", pos)
    if start < 0 or end < 0:
        raise ValueError(f"article bounds not found: {sid}")
    end += len("</article>")
    return html[:start] + html[end:], html[start:end]


def repair_t5_structure(html: str, report: dict) -> str:
    """保留 9 个五阶技能原文，移入唯一 tier section，删除重复空节点。"""
    blocks: list[str] = []
    for sid in T5_IDS:
        html, block = extract_article(html, sid)
        blocks.append(block)

    # 删除历史残留的两个空 m-tier-变化-五阶 节点
    html = re.sub(
        r"\s*<div class=\"tier\" id=\"m-tier-变化-五阶\">\s*<h3>五阶天赋树</h3>\s*</div>",
        "",
        html,
        count=1,
    )
    html = re.sub(
        r"\s*<section class=\"tier\" id=\"m-tier-变化-五阶\">\s*<h3>五阶天赋树</h3>\s*</section>",
        "",
        html,
        count=1,
    )

    anchor = 'id="m-skill-8-4-9"'
    anchor_pos = html.find(anchor)
    if anchor_pos < 0:
        raise ValueError("变化四阶 anchor m-skill-8-4-9 not found")
    article_end = html.find("</article>", anchor_pos)
    if article_end < 0:
        raise ValueError("变化四阶 anchor article end not found")
    article_end += len("</article>")
    sec_close = html.find("</section>", article_end)
    if sec_close < 0:
        raise ValueError("变化四阶 section close not found")
    insert_at = sec_close + len("</section>")

    section = (
        "\n    <section class=\"tier\" id=\"m-tier-变化-五阶\">\n"
        "      <h3>五阶天赋树</h3>\n"
        + "\n".join(blocks)
        + "\n    </section>"
    )
    html = html[:insert_at] + section + html[insert_at:]
    report["t5_articles"] = len(blocks)
    report["t5_section_count"] = html.count('id="m-tier-变化-五阶"')
    return html


def main() -> None:
    report: dict = {}
    data = load_json(DATA_PATH)
    updated = patch_json_skills(data, report)

    html = HTML_PATH.read_text(encoding="utf-8")
    for skill in updated:
        html = rebuild_article(html, skill)
    html = repair_t5_structure(html, report)

    dump_json(DATA_PATH, data)
    HTML_PATH.write_text(html, encoding="utf-8")

    fx_doc = load_json(FX_PATH)
    fx_list = fx_doc.get(CLASS, [])
    fx_by_id = {e.get("id"): i for i, e in enumerate(fx_list)}
    for skill in updated:
        entry = json_to_fx_entry(skill, CLASS)
        if skill["id"] in fx_by_id:
            fx_list[fx_by_id[skill["id"]]] = entry
        else:
            fx_list.append(entry)
    fx_doc[CLASS] = fx_list
    dump_json(FX_PATH, fx_doc)

    for src, dst in (
        (HTML_PATH, ELECTRON_HTML),
        (DATA_PATH, ELECTRON_DATA),
        (FX_PATH, ELECTRON_FX),
    ):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    report["json_skills"] = len(data["skills"])
    report["fx_entries"] = len(fx_list)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
