#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把谋士写入角色创建页（CLS_OVERRIDE / CLASS_SPECIALIZATIONS / CLASS_STARTING_FEATURES）。

用法：
  python scripts/apply_strategist_chargen_entries.py --check
  python scripts/apply_strategist_chargen_entries.py --write
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
CHARGEN = ROOT / '斯诺德跑团' / '角色创建页.html'
MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '角色创建页.html'

OVERRIDE_LINE = "      '谋士':{key_attr:'智力', hp:8, fp:10, saves:'智力、魅力'}\n"
SPECS_LINE = ('  "谋士":['
              '{n:"权谋",d:"洞察人心、操弄信息，以言语与策略改变局势"},'
              '{n:"军团",d:"指挥调度与布阵，为团队提供战术增益"},'
              '{n:"先见",d:"对战局的前瞻洞察与精密预判"},'
              '{n:"鸩毒",d:"以毒物与毒计让敌人悄然衰弱"},'
              '{n:"混乱",d:"以干扰、误导与谣言制造无序"},'
              '{n:"博物",d:"博闻广识，以知识本身为武器"}],\n')
START_LINE = ('  "谋士":[{n:"交友术",d:"使一名角色将你视作好友"},{n:"战术部署",d:"为友方角色分配战术增益效果"},'
              '{n:"毒刃",d:"在武器上淬毒并发起一击"},{n:"离间",d:"离间敌人和其盟友，令关系暂时恶化"}],\n')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    text = CHARGEN.read_text(encoding='utf-8')
    has_override = re.search(r"'谋士':\s*\{key_attr", text) is not None
    has_specs = re.search(r'^\s*"谋士":\[\{n:"权谋"', text, re.M) is not None
    has_start = re.search(r'^\s*"谋士":\[\{n:"交友术"', text, re.M) is not None
    print('CLS_OVERRIDE: %s' % ('已写入' if has_override else '缺失'))
    print('CLASS_SPECIALIZATIONS: %s' % ('已写入' if has_specs else '缺失'))
    print('CLASS_STARTING_FEATURES: %s' % ('已写入' if has_start else '缺失'))

    if args.check:
        ok = has_override and has_specs and has_start
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    if not has_override:
        text = re.sub(r"(      '守望者':\{key_attr:'意志', hp:12, fp:8, saves:'体质、意志'\}\n)",
                      r"\1" + OVERRIDE_LINE, text, count=1)
    if not has_specs:
        m = re.search(r'^(  "守望者":\[\{n:"哨兵".*?)\n', text, re.M)
        if not m:
            raise SystemExit('未找到 CLASS_SPECIALIZATIONS 守望者行')
        line = m.group(1).rstrip()
        if not line.endswith(','):
            line += ','
        text = text[:m.start()] + line + '\n' + SPECS_LINE + text[m.end(1) + 1:]
    if not has_start:
        m = re.search(r'^(  "守望者":\[\{n:"挫志打击".*?)\n', text, re.M)
        if not m:
            raise SystemExit('未找到 CLASS_STARTING_FEATURES 守望者行')
        line = m.group(1).rstrip()
        if not line.endswith(','):
            line += ','
        text = text[:m.start()] + line + '\n' + START_LINE + text[m.end(1) + 1:]

    CHARGEN.write_text(text, encoding='utf-8', newline='')
    if MIRROR.exists():
        MIRROR.write_text(text, encoding='utf-8', newline='')
    print('✅ 角色创建页谋士条目已写入')
    return 0


if __name__ == '__main__':
    sys.exit(main())
