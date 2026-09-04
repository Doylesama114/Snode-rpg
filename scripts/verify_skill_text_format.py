#!/usr/bin/env python3
"""Verify that bullet continuation lines and level-up bullet choices stay merged.

After class_sync_core extracts docx blocks, compare each site JSON skill with the
docx block: every docx bullet entry must appear as one contiguous entry (or a
longer merged entry), and every docx level-up choice must appear in choices.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from class_sync_core import build_docx_index, extract_paragraphs, pick_block  # noqa: E402

CLASSES = (
    "蛮斗士", "吟游诗人", "圣骑士", "德鲁伊", "战士", "术士", "武僧",
    "法师", "游荡者", "牧师", "猎人", "萨满祭司", "魔契师", "守望者", "通用天赋树",
)


def docx_for(cls: str) -> Path:
    if cls == "通用天赋树":
        return ROOT / "通用天赋树.docx"
    return ROOT / f"基础职业-{cls}.docx"


def contains_entry(haystack: list[str], needle: str) -> bool:
    for entry in haystack:
        if entry.startswith(needle):
            return True
    return False


def main() -> int:
    errors: list[str] = []
    for cls in CLASSES:
        data_path = ROOT / "职业页" / "数据" / f"{cls}.json"
        data = json.loads(data_path.read_text(encoding="utf-8"))
        skills = data.get("skills") or []
        docx = docx_for(cls)
        names = {s.get("name") for s in skills if isinstance(s, dict)}
        index = build_docx_index(extract_paragraphs(docx), names)
        used: set[int] = set()

        for skill in skills:
            block = pick_block(index, skill, used)
            if block is None:
                continue

            expected_desc = block.get("description") or []
            actual_desc = skill.get("description") or []
            for entry in expected_desc:
                if not entry.startswith("·"):
                    continue
                if not contains_entry(actual_desc, entry):
                    errors.append(
                        f"{cls}/{skill.get('name')} 描述断行或缺失：{entry[:48]}"
                    )

            expected_up = block.get("level_upgrades") or []
            actual_up = skill.get("level_upgrades") or []
            for eu in expected_up:
                choices = eu.get("choices") or []
                if not choices:
                    continue
                au = next(
                    (
                        u
                        for u in actual_up
                        if u.get("level") == eu.get("level")
                        and u.get("class") == eu.get("class")
                    ),
                    None,
                )
                if au is None:
                    errors.append(
                        f"{cls}/{skill.get('name')} 缺少L{eu.get('level')}升级"
                    )
                    continue
                actual_choices = au.get("choices") or []
                for choice in choices:
                    if not choice.startswith("·"):
                        continue
                    if not contains_entry(actual_choices, choice):
                        errors.append(
                            f"{cls}/{skill.get('name')} L{eu.get('level')} choice断行或缺失：{choice[:48]}"
                        )

    if errors:
        print(f"FAIL: {len(errors)} issues")
        for e in errors[:50]:
            print(" -", e)
        return 1
    print("PASS: 技能文本续行与升级选项格式一致")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
