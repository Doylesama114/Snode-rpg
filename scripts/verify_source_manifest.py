
# -*- coding: utf-8 -*-
"""真值清单校验：manifest 与磁盘一致、无孤儿文件。"""
import hashlib, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'D:/Download/scholar-agent-main'
SRC = os.path.join(ROOT, '源文件')
MANIFEST = os.path.join(SRC, 'manifest.json')
IGNORE = {'manifest.json', 'README.md'}

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    if not os.path.exists(MANIFEST):
        print('FAIL 缺少 源文件/manifest.json')
        return 1
    meta = json.load(open(MANIFEST, encoding='utf-8'))
    problems, seen = [], set()
    for it in meta.get('items', []):
        p = os.path.join(SRC, it['path'])
        seen.add(it['path'])
        if not os.path.exists(p):
            problems.append('缺失: ' + it['path']); continue
        if os.path.getsize(p) != it['bytes']:
            problems.append('大小不符: ' + it['path']); continue
        if sha256(p) != it['sha256']:
            problems.append('sha256 不符: ' + it['path'])
    for base, _, files in os.walk(SRC):
        for f in files:
            if f in IGNORE:
                continue
            rel = os.path.relpath(os.path.join(base, f), SRC).replace('\\', '/')
            if rel not in seen:
                problems.append('未登记: ' + rel)
    if problems:
        print('FAIL 真值清单异常（%d 项）：' % len(problems))
        for p in problems[:10]:
            print('  - ' + p)
        return 1
    print('OK 真值清单一致：%d 个文件（%s）' % (len(seen), meta.get('generated','')))
    return 0

if __name__ == '__main__':
    sys.exit(main())
