
# -*- coding: utf-8 -*-
"""生成 源文件/manifest.json（sha256 + 分类 + 来源）。"""
import hashlib, json, os, sys, datetime
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '源文件')
CATS = ['职业', '规则', '角色档案', '素材', '更新内容']

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

items = []
for cat in CATS:
    d = os.path.join(SRC, cat)
    if not os.path.isdir(d):
        continue
    for base, _, files in os.walk(d):
        for f in sorted(files):
            p = os.path.join(base, f)
            rel = os.path.relpath(p, SRC).replace('\\', '/')
            st = os.stat(p)
            items.append({
                'path': rel,
                'bytes': st.st_size,
                'sha256': sha256(p),
                'category': cat,
                'imported_at': datetime.date.today().isoformat(),
                'source': '仓库迁移',
            })
meta = {
    'generated': datetime.datetime.now().isoformat(timespec='seconds'),
    'root': '源文件',
    'count': len(items),
    'totalBytes': sum(i['bytes'] for i in items),
    'items': items,
}
open(os.path.join(SRC, 'manifest.json'), 'w', encoding='utf-8').write(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
from collections import Counter
print('manifest: %d 个, %.1f MB' % (len(items), meta['totalBytes']/1024/1024))
for k, v in Counter(i['category'] for i in items).items():
    print('   %-6s %d' % (k, v))
