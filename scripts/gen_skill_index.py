# -*- coding: utf-8 -*-
"""gen_skill_index.py —— 生成上传页/面板共用技能索引（瘦身版，自动生成勿手改）。"""
import json, os, re, time, shutil, hashlib
from pathlib import Path
from collections import Counter
ROOT = Path(__file__).resolve().parent.parent
D = ROOT / '职业页' / '数据'
FX = ROOT / '斯诺德跑团'
CLASSES = ['召唤师','吟游诗人','圣骑士','奇械师','守望者','德鲁伊','战士','战舞者','术士','武僧','法师','游荡者','牧师','猎人','萨满祭司','蛮斗士','谋士','魔契师']
KIND = {'法术':'技能','战技':'技能','戏法':'技能','天赋':'天赋','图纸':'图纸'}
def load_fx(cls):
    p = FX / ('skill_effects_%s.json' % cls)
    if not p.exists(): return {}
    try: j = json.load(open(p, encoding='utf-8'))
    except Exception: return {}
    arr = j if isinstance(j, list) else list(j.values())[0]
    out = {}
    for s in arr:
        if isinstance(s, dict) and s.get('name'):
            out.setdefault(s['name'], {'type': (s.get('type') or '').replace('风格',''), 'has': bool(s.get('effects'))})
    return out
rows = []
def add(name, sid, cls, kind, typ, style, tier, isStart, has):
    rows.append([name, sid, cls, kind, typ, style, tier, 1 if isStart else 0, 1 if has else 0])
for cls in CLASSES:
    p = D / ('%s.json' % cls)
    if not p.exists(): raise FileNotFoundError(p)
    j = json.load(open(p, encoding='utf-8'))
    fx = load_fx(cls)
    for s in (j.get('skills') or []):
        if not isinstance(s, dict) or not s.get('name'): continue
        nm = s['name']; f = fx.get(nm, {}); ftype = f.get('type') or ''
        kind = KIND.get(ftype, '') or ('天赋' if s.get('tier') else '技能')
        if re.search(r'（图纸）|\\(图纸\\)', nm) or ftype == '图纸': kind = '图纸'
        add(nm, s.get('id') or '', cls, kind, ftype or (s.get('type') or ''), s.get('style') or '', s.get('tier') or '',
            s.get('type') == 'starting', bool(s.get('description') or s.get('fields') or s.get('level_upgrades') or f.get('has')))
p = D / '通用天赋树.json'
if p.exists():
    j = json.load(open(p, encoding='utf-8'))
    for s in (j.get('skills') or []):
        if isinstance(s, dict) and s.get('name'):
            add(s['name'], s.get('id') or '', '通用', '天赋', '天赋', s.get('style') or '', s.get('tier') or '', False, bool(s.get('description') or s.get('fields')))
p = D / '特殊专长.json'
if p.exists():
    j = json.load(open(p, encoding='utf-8'))
    arr = j if isinstance(j, list) else (j.get('skills') or j.get('feats') or [])
    for s in arr:
        if isinstance(s, dict) and s.get('name'):
            _hd = bool(s.get('description') or s.get('fields') or s.get('level_upgrades') or s.get('text') or s.get('effect') or s.get('desc'))
            add(s['name'], s.get('id') or '', '特殊专长', '特殊专长', '专长', s.get('style') or '', '', False, _hd)
p = D / '牧师·神圣领域.json'
if p.exists():
    j = json.load(open(p, encoding='utf-8'))
    doms = j.get('domains') or {}
    _n = 0
    for _dk in doms:
        _dv = doms[_dk] or {}
        for _s in (_dv.get('skills') or []):
            if not isinstance(_s, dict) or not _s.get('name'): continue
            _tier = _s.get('tier') or ''
            _kind = '专长' if ('专长' in str(_tier)) else ('天赋' if _tier else '技能')
            add(_s.get('name'), _s.get('id') or '', '牧师·神圣领域', _kind, _s.get('type') or '', _dv.get('name') or '', _tier,
                ('起始' in str(_tier)), bool(_s.get('description') or _s.get('fields') or _s.get('effects')))
            _n += 1
    meta_src_note = _n
    print('  神圣领域: %d 条' % _n)
byName, byKey, starts, byId = {}, {}, {}, {}
for i, r in enumerate(rows):
    byName.setdefault(r[0], []).append(i)
    if r[1]:
        key = r[2] + chr(9) + r[1]
        if key in byKey: raise ValueError('技能来源+ID冲突: ' + key)
        byKey[key] = i
        byId.setdefault(r[1], []).append(i)
    if r[7]: starts.setdefault(r[0], []).append(i)
aliases = {}
for cls in CLASSES:
    data = json.loads((D / f"{cls}.json").read_text(encoding="utf8"))
    for skill in data.get("skills", []):
        for old_id in skill.get("legacy_ids", []):
            old_key = cls + chr(9) + old_id
            new_key = cls + chr(9) + skill["id"]
            if old_key in byKey and byKey[old_key] != byKey[new_key]:
                raise ValueError("Conflicting legacy skill ID: " + old_key)
            byKey[old_key] = byKey[new_key]
            aliases[old_key] = skill["id"]
meta = {'entries': len(rows), 'dupIds': sum(1 for v in byId.values() if len(v) > 1), 'dupNames': sum(1 for v in byName.values() if len(v) > 1),
        'starts': len(starts), 'noDetail': sum(1 for r in rows if not r[8]), 'perClass': {}}
for r in rows: meta['perClass'][r[2]] = meta['perClass'].get(r[2], 0) + 1
out = {'v': 1, 'at': time.strftime('%Y-%m-%d %H:%M'), 'cols': ['name','id','cls','kind','type','style','tier','isStarting','hasDetail'],
       'rows': rows, 'aliases': aliases, 'byName': byName, 'byKey': byKey, 'starts': starts, 'byId': byId, 'meta': meta}
source_files = [D / f"{cls}.json" for cls in CLASSES] + [D / "\u7267\u5e08\u00b7\u795e\u5723\u9886\u57df.json", D / "\u901a\u7528\u5929\u8d4b\u6811.json", D / "\u7279\u6b8a\u4e13\u957f.json"]
out["sourceHash"] = hashlib.sha256(b"".join(p.read_bytes() for p in source_files if p.exists())).hexdigest()
previous = FX / "skill_index.js"
if previous.exists():
    text = previous.read_text(encoding="utf8")
    start = text.find("window.SNOWD_SKILL_INDEX = ")
    if start >= 0:
        prior, _ = json.JSONDecoder().raw_decode(text[start + len("window.SNOWD_SKILL_INDEX = "):])
        if prior.get("sourceHash") == out["sourceHash"]:
            out["at"] = prior["at"]
js = ('// 自动生成，勿手改。生成：python scripts/gen_skill_index.py\n'
      'window.SNOWD_SKILL_INDEX = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(FX / 'skill_index.js', 'w', encoding='utf-8', newline='').write(js)
shutil.copyfile(FX / 'skill_index.js', ROOT / 'electron-app' / '斯诺德跑团' / 'skill_index.js')
print('OK 索引: 斯诺德跑团/skill_index.js  %.0f KB' % (len(js.encode('utf-8')) / 1024))
print('  条目 %d · 重号ID %d 组 · 同名 %d 组 · 起始特性 %d 个 · 无详情 %d' % (meta['entries'], meta['dupIds'], meta['dupNames'], meta['starts'], meta['noDetail']))
print('  kind: ' + ', '.join('%s=%d' % kv for kv in Counter(r[3] for r in rows).most_common()))
print('  isStarting=%d · tier非空=%d' % (sum(1 for r in rows if r[7]), sum(1 for r in rows if r[6])))
