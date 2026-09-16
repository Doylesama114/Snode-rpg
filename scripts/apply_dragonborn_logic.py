#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""龙裔详情更新（M2 逻辑层）：DRAGON_TYPES 重写 + XD6 等级联动显示。

改动：
  1) 角色创建页.html
     - DRAGON_TYPES 10 条按 PNG 重写（含术语：闪电→雷电、毒素→剧毒、寒冷→冰冻、黑龙/赤铜龙→强酸（2 点））
     - 龙种选择提示文案更新（去掉旧的「冰霜+护甲检定」）
     - 导出文案：吐息带出骰数规则「吐息：<类型>（XD6，X=角色等级）」
  2) panel_engine.js
     - 龙裔特性显示：吐息带出当前等级骰数（如 3 级 → 3D6），抗性显示类型
  3) electron 镜像

用法：
  python scripts/apply_dragonborn_logic.py --check
  python scripts/apply_dragonborn_logic.py --write
"""
from __future__ import annotations

import argparse
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
CHARGEN = ROOT / '斯诺德跑团' / '角色创建页.html'
CHARGEN_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '角色创建页.html'
ENGINE = ROOT / '斯诺德跑团' / 'panel_engine.js'
ENGINE_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_engine.js'

# PNG 顺序 + 用户确认口径（黑龙/赤铜龙=强酸，不带护甲检定）
DRAGON_TYPES = [
    ('红龙', '火焰'), ('金龙', '火焰'),
    ('蓝龙', '雷电'), ('银龙', '奥术'),
    ('绿龙', '剧毒'), ('青铜龙', '雷电'),
    ('黑龙', '强酸'), ('黄铜龙', '火焰'),
    ('白龙', '冰冻'), ('赤铜龙', '强酸'),
]
DRAGON_JS = 'var DRAGON_TYPES=[' + ', '.join(
    '{name:"%s",breath:"%s",resistance:"%s（2 点）"}' % (n, d, d) for n, d in DRAGON_TYPES) + '];'
HINT_OLD = "不同龙种决定吐息伤害类型和抗性。黑龙/赤铜龙按原文为冰霜伤害+护甲检定。"
HINT_NEW = ("不同龙种决定吐息伤害类型与抗性（对应类型 2 点）。巨龙吐息为 XD6（X=角色等级），"
            "闪避成功仍承受一半；黑龙/赤铜龙为强酸。")
EXPORT_OLD = 'else if(_rn.indexOf("巨龙吐息")>=0&&CHAR.dragonBreath)_rd2="吐息："+CHAR.dragonBreath;'
EXPORT_NEW = ('else if(_rn.indexOf("巨龙吐息")>=0&&CHAR.dragonBreath)'
              '_rd2="吐息："+CHAR.dragonBreath+"（XD6，X=角色等级）";')
PANEL_OLD = 'else if (name.indexOf("巨龙吐息") >= 0 && state.dragonBreath) desc = "吐息：" + state.dragonBreath;'
PANEL_NEW = ('else if (name.indexOf("巨龙吐息") >= 0 && state.dragonBreath) {'
             ' var _lv = (state.classes && state.classes[0] && state.classes[0].level) || 1;'
             ' desc = "吐息：" + state.dragonBreath + "（" + _lv + "D6 · X=角色等级）"; }')


def patch_chargen(text: str) -> str:
    text = re.sub(r'var DRAGON_TYPES=\[[\s\S]*?\];', lambda m: DRAGON_JS, text, count=1)
    if HINT_OLD in text:
        text = text.replace(HINT_OLD, HINT_NEW, 1)
    elif HINT_NEW not in text:
        raise SystemExit('未找到龙种提示文案')
    if EXPORT_OLD in text:
        text = text.replace(EXPORT_OLD, EXPORT_NEW, 1)
    elif EXPORT_NEW not in text:
        raise SystemExit('未找到吐息导出文案')
    return text


def patch_engine(text: str) -> str:
    if PANEL_OLD in text:
        text = text.replace(PANEL_OLD, PANEL_NEW, 1)
    elif PANEL_NEW not in text:
        raise SystemExit('未找到面板吐息显示行')
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    chg = CHARGEN.read_text(encoding='utf-8')
    eng = ENGINE.read_text(encoding='utf-8')
    checks = {
        'DRAGON_TYPES 已按新版重写': DRAGON_JS in chg,
        '无旧「冰霜 + 护甲检定」': '冰霜 + 护甲检定' not in chg,
        '龙种提示已更新': HINT_NEW in chg,
        '吐息导出含 XD6': EXPORT_NEW in chg or 'XD6，X=角色等级' in chg,
        '面板吐息含等级骰数': 'D6 · X=角色等级' in eng,
    }
    for k, v in checks.items():
        print('%-24s %s' % (k, 'OK' if v else '缺失'))
    if args.check:
        ok = all(checks.values())
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    new_chg = patch_chargen(chg)
    CHARGEN.write_text(new_chg, encoding='utf-8', newline='')
    if CHARGEN_MIRROR.exists():
        CHARGEN_MIRROR.write_text(new_chg, encoding='utf-8', newline='')
    new_eng = patch_engine(eng)
    ENGINE.write_text(new_eng, encoding='utf-8', newline='')
    if ENGINE_MIRROR.exists():
        ENGINE_MIRROR.write_text(new_eng, encoding='utf-8', newline='')
    print('✅ 龙裔逻辑层已更新（DRAGON_TYPES + XD6 显示）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
