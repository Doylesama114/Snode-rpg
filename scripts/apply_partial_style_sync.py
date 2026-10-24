#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""窄口径同步：只更新 docx 中出现的「某几个风格」的技能，其余技能一律保留不删。

适用于「只更新了部分风格」的源文档（例如 10.24 的奇械师·炽擎风格）。

用法：
  python scripts/apply_partial_style_sync.py --class 奇械师 \
      --docx '10.24更新内容/基础职业-奇械师·炽擎风格(1).docx' --styles 炽擎
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from class_sync_core import sync_class  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--class', dest='cls', required=True)
    ap.add_argument('--docx', required=True)
    ap.add_argument('--styles', required=True, help='逗号分隔，例如 炽擎')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    styles = {s.strip() for s in args.styles.split(',') if s.strip()}
    data_path = ROOT / '职业页' / '数据' / (args.cls + '.json')
    data = json.loads(data_path.read_text(encoding='utf-8'))
    targets = {s['name'] for s in data['skills'] if (s.get('style') or '') in styles}
    keep = {s['name'] for s in data['skills']} - targets
    print('目标风格 %s：匹配 %d 条；其余 %d 条将保留' % (sorted(styles), len(targets), len(keep)))
    if args.dry_run:
        return 0
    report = sync_class(
        class_name=args.cls,
        docx=ROOT / args.docx,
        html_path=ROOT / '职业页' / (args.cls + '.html'),
        data_path=data_path,
        fx_path=ROOT / '斯诺德跑团' / ('skill_effects_' + args.cls + '.json'),
        electron_html=ROOT / 'electron-app' / '职业页' / (args.cls + '.html'),
        electron_data=ROOT / 'electron-app' / '职业页' / '数据' / (args.cls + '.json'),
        electron_fx=ROOT / 'electron-app' / '斯诺德跑团' / ('skill_effects_' + args.cls + '.json'),
        report_path=ROOT / 'scripts' / ('_partial_sync_' + args.cls + '.json'),
        preserve_names=keep,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report.get('removed_not_in_docx'):
        print('!! 有技能被判为删除：', report['removed_not_in_docx'])
        return 3
    untouch = [n for n in targets if n not in report.get('updated_names', [])]
    return 0


if __name__ == '__main__':
    sys.exit(main())