# -*- coding: utf-8 -*-
"""
生成 AI 顾问入口小贴士数据：斯诺德跑团/advisor-tips.js

内容：
  - tips: 8 条战斗小贴士（人工维护，原文收录）
  - rules: 15 条基础规则全文（从 冒险者基础规则.xlsx「基本规则」提取，不含标题）

用法：
    python scripts/build_advisor_tips.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "冒险者基础规则.xlsx"
OUT = ROOT / "斯诺德跑团" / "advisor-tips.js"
ELECTRON_OUT = ROOT / "electron-app" / "斯诺德跑团" / "advisor-tips.js"

TIPS = [
    "远程单位的身旁有敌人时，进行攻击的检定具有劣势，快速接近远处敌人使其难以打中队友是个快速解决敌人的办法",
    "遇到过于强大的敌人时，移动到地图边缘进行撤离可能才是更好的选择",
    "部分敌人可能拥有反应动作，如何打出敌人的反应动作或者让其释放不出反应动作来躲闪友方的伤害，会将战斗导向更有利的方向",
    "部分对敌人释放异常状态的技能不会让你骰命中，而是让敌人进行豁免检定，对于自己的骰运不自信可以来尝试相信敌人的骰运也不怎么好过",
    "部分控制技能会让友方的攻击能具有优势，给队友造优再进行攻击会让队友更容易命中",
    "让敌人进入失能状态会让队友的具有极大优势，这时会让命中变得非常简单",
    "战斗中，找出敌人阵型的弱点，利用控制拉扯敌人，形成局部多打少，集中火力进行减员至关重要",
    "魔法是会带来物理效应的，释放魔法的时候可以适当考虑结合or注意周边的环境",
]

# 标题所在行列（B/H/N 三列，每 7 行一组），正文在标题下一行
TITLE_CELLS = [
    ("B4", "B5"), ("H4", "H5"), ("N4", "N5"),
    ("B11", "B12"), ("H11", "H12"), ("N11", "N12"),
    ("B18", "B19"), ("H18", "H19"), ("N18", "N19"),
    ("B25", "B26"), ("H25", "H26"), ("N25", "N26"),
    ("B32", "B33"), ("H32", "H33"), ("N32", "N33"),
]


def load_rules() -> list:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["基本规则"]
    rules = []
    for _, body_cell in TITLE_CELLS:
        body = ws[body_cell].value
        rules.append(str(body).strip() if body else "")
    return rules


def main() -> int:
    rules = load_rules()
    if len(rules) != 15 or any(not r for r in rules):
        print("规则提取异常：", len(rules))
        return 1
    payload = {"tips": TIPS, "rules": rules}
    js = (
        "// 斯诺德跑团 - AI \u987e\u95ee\u5165\u53e3\u5c0f\u8d34\u58eb\u6570\u636e\uff08\u7531 "
        "scripts/build_advisor_tips.py \u751f\u6210\uff0c\u8bf7\u52ff\u624b\u6539\uff09\n"
        "window.SNOWD_ADVISOR_TIPS = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    OUT.write_text(js, encoding="utf-8", newline="\n")
    shutil.copyfile(OUT, ELECTRON_OUT)
    print(f"OK: {OUT}（tips={len(TIPS)}，rules={len(rules)}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
