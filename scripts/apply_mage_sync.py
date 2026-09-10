#!/usr/bin/env python3
"""Sync 法师 from docx → HTML + JSON + skill_effects."""
from pathlib import Path

from class_sync_core import sync_class

ROOT = Path(__file__).resolve().parent.parent
CLASS = "法师"

# 源 docx 目前缺失变化五阶；在原作者补齐前，严禁全量同步把这些站点技能删掉。
# 原作者补齐 docx 后：删除此列表，再单独做一次变化五阶正式同步。
PRESERVE_NAMES = {
    "变形术·枭熊",
    "变形术·鱼",
    "变形术·鸟",
    "四臂术",
    "爆裂术",
    "石化术",
    "穿墙术",
    "软泥形态",
    "隐匿传讯术",
}

if __name__ == "__main__":
    import json

    report = sync_class(
        class_name=CLASS,
        docx=ROOT / "基础职业-法师.docx",
        html_path=ROOT / "职业页" / "法师.html",
        data_path=ROOT / "职业页" / "数据" / "法师.json",
        fx_path=ROOT / "斯诺德跑团" / f"skill_effects_{CLASS}.json",
        electron_html=ROOT / "electron-app" / "职业页" / "法师.html",
        electron_data=ROOT / "electron-app" / "职业页" / "数据" / "法师.json",
        electron_fx=ROOT / "electron-app" / "斯诺德跑团" / f"skill_effects_{CLASS}.json",
        report_path=ROOT / "scripts" / "_mage_sync_report.json",
        preserve_names=PRESERVE_NAMES,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
