#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""覆盖源文件前的逐文件体检（防呆）。

用途：在把新一版源文档覆盖到仓库根目录之前，先跑本脚本。
规则：若【新文件明显小于现有文件】（默认阈值 60%），判定为"疑似残缺版本"并【拒绝覆盖】，
      除非显式加 --force。历史上 基础职业技能表 中的「基础职业-奇械师.docx」
      就是 34KB 的残缺版，而根目录的正确版本是 265KB。

用法：python -X utf8 scripts/check_source_replacement.py <新文件> <目标文件> [--force]
"""
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8")
argv = [a for a in sys.argv[1:] if not a.startswith("--")]
force = "--force" in sys.argv
if len(argv) != 2:
    print("用法: python -X utf8 scripts/check_source_replacement.py <新文件> <目标文件> [--force]")
    raise SystemExit(2)
new, old = Path(argv[0]), Path(argv[1])
if not new.exists():
    print("✗ 新文件不存在: %s" % new); raise SystemExit(1)
if not old.exists():
    print("✓ 目标不存在 → 属新增文件，可直接落位: %s" % old); raise SystemExit(0)
ns, osz = new.stat().st_size, old.stat().st_size
ratio = ns / osz if osz else 1
print("新 %d 字节 / 现 %d 字节（比例 %.0f%%）" % (ns, osz, ratio * 100))
if ratio < 0.6 and not force:
    print("✗ 拒绝覆盖：新文件明显小于现有文件，疑似残缺版本。")
    print("  如确认无误，请加 --force。")
    raise SystemExit(1)
print("✓ 体检通过，可覆盖。")
