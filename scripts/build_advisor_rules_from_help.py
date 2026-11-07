
# -*- coding: utf-8 -*-
"""从 help.html 生成规则语料（正文）+ 从 advisor/rules/facts 生成事实块。

输出：
  advisor/rules/chunks.jsonl   规则节 + 关键词 + 事实块
  advisor/rules/index.json     版本戳 / 计数 / 锚点 / 源哈希

用法：
  python -X utf8 scripts/build_advisor_rules_from_help.py [--check]
"""
import hashlib, json, os, re, sys, datetime
from lxml import html as LH

ROOT = r'D:/Download/scholar-agent-main'
HELP = os.path.join(ROOT, '斯诺德跑团', 'help.html')
OUT = os.path.join(ROOT, 'advisor', 'rules')
FACTS = os.path.join(OUT, 'facts')
CHECK = '--check' in sys.argv

BLOCK = {'p', 'div', 'table', 'ul', 'ol', 'blockquote', 'pre'}


def clean(s):
    s = re.sub(r'[ \t]+', ' ', str(s or ''))
    s = re.sub(r'\n{2,}', '\n', s)
    return s.strip()


def block_text(el):
    parts = []
    for node in el.iter():
        if not isinstance(node.tag, str):
            continue
        if node.tag in ('script', 'style'):
            continue
        if node.tag == 'tr':
            parts.append('\n')
        elif node.tag in ('td', 'th'):
            parts.append(' | ')
        if node.text:
            parts.append(node.text)
        if node.tail and node is not el:
            parts.append(node.tail)
    return clean(''.join(parts))


def parse_help():
    tree = LH.parse(HELP)
    pane = tree.xpath('//*[@id="help-pane-rules"]')[0]
    main = pane.xpath('./main[contains(@class,"help-content")]')[0]
    secs = [c for c in main if isinstance(c.tag, str) and c.tag == 'div' and 'section' in (c.get('class') or '').split()]
    out = []
    for sec in secs:
        sid = sec.get('id') or ''
        h2 = sec.xpath('./h2')
        sheet = clean(h2[0].text_content()) if h2 else sid
        cur_title, cur_parts, idx = sheet, [], 0
        for child in sec:
            if not isinstance(child.tag, str):
                continue
            if child.tag == 'h2':
                continue
            if child.tag == 'h3':
                if cur_parts:
                    out.append((sid, sheet, cur_title, '\n'.join(cur_parts)))
                idx += 1
                cur_title = clean(child.text_content())
                cur_parts = []
                continue
            if child.tag in BLOCK:
                txt = block_text(child)
                if txt:
                    cur_parts.append(txt)
        if cur_parts:
            out.append((sid, sheet, cur_title, '\n'.join(cur_parts)))
    chunks = []
    for k, (sid, sheet, title, body) in enumerate(out):
        body = clean(body)
        if len(body) < 4:
            continue
        for j, piece in enumerate(split_long(body)):
            chunks.append({
                'id': 'rule:%s:%d-%d' % (sid, k, j),
                'kind': 'section',
                'sheet': sheet,
                'title': title if len(piece) == len(body) else title + '（%d/%d）' % (j + 1, len(split_long(body))),
                'body': piece,
                'anchor': '#' + sid,
            })
    return chunks


def split_long(body, limit=900):
    """长块按段落切分，避免一块吞掉整个章节导致检索粒度太粗。"""
    if len(body) <= limit:
        return [body]
    paras = [p for p in body.split('\n') if p.strip()]
    out, cur = [], ''
    for p in paras:
        if cur and len(cur) + len(p) > limit:
            out.append(cur.strip())
            cur = p
        else:
            cur = (cur + '\n' + p) if cur else p
    if cur.strip():
        out.append(cur.strip())
    return out or [body]


def keyword_chunks(chunks):
    """关键词规则章节里的表格：term | definition"""
    tree = LH.parse(HELP)
    sec = tree.xpath('//*[@id="s8"]')[0]
    out = []
    for tr in sec.xpath('.//tr'):
        cells = [clean(''.join(td.itertext())) for td in tr.xpath('./td|./th')]
        if len(cells) < 2:
            continue
        term, definition = cells[0], ' '.join(cells[1:]).strip()
        if not term or len(definition) < 4 or term in ('关键词', '技能'):
            continue
        out.append({
            'id': 'keyword:' + term,
            'kind': 'keyword',
            'sheet': '关键词规则',
            'title': term,
            'body': definition[:1200],
            'anchor': '#s8',
        })
    return out


def fact_chunks():
    out = []
    def add(anchor, sheet, title, body):
        body = clean(body)
        if body:
            out.append({'id': 'fact:%s:%s' % (anchor, title), 'kind': 'fact', 'sheet': sheet,
                        'title': clean(title), 'body': sheet + '：' + body[:1500], 'anchor': '#' + anchor})
    p = os.path.join(FACTS, 'states.json')
    if os.path.exists(p):
        for s in json.load(open(p, encoding='utf-8')):
            add('s7', '异常状态', s.get('name', ''), '[%s] %s' % (s.get('type', ''), s.get('effect', '')))
    p = os.path.join(FACTS, 'interludes.json')
    if os.path.exists(p):
        for it in json.load(open(p, encoding='utf-8')):
            add('s5', '幕间规则', it.get('content', ''),
                '3个月 %s；6个月 %s；1年 %s。%s' % (it.get('threeMonth', '-'), it.get('sixMonth', '-'), it.get('oneYear', '-'), it.get('note', '')))
    p = os.path.join(FACTS, 'marks.json')
    if os.path.exists(p):
        for m in json.load(open(p, encoding='utf-8')):
            add('s6', '色彩标识', m.get('color', ''), '%s（关键词：%s）' % (m.get('meaning', ''), '、'.join(m.get('keywords', []))))
    p = os.path.join(FACTS, 'levels.json')
    if os.path.exists(p):
        for lv in (json.load(open(p, encoding='utf-8')).get('levels') or []):
            add('s3', '升级规则', ('子职' if lv.get('track') == 'sub' else '主职') + ' %s 级' % lv.get('level'),
                '经验 %s；熟练 %s；属性 %s；技能槽 %s；%s；属性上限 %s；熟练上限 %s' % (
                    lv.get('xp', '-'), lv.get('prof', '-'), lv.get('attr', '-'), lv.get('slots', '-'),
                    lv.get('other', ''), lv.get('attrCap', '-'), lv.get('profCap', '-')))
    p = os.path.join(FACTS, 'multiclass.json')
    if os.path.exists(p):
        for mc in json.load(open(p, encoding='utf-8')):
            add('s4', '兼职规则', mc.get('class', ''),
                '属性要求 %s；熟练要求 %s；其他 %s；可兼容 %s' % (
                    mc.get('attrReq', '-'), mc.get('profReq', '-'), mc.get('otherReq', '-'), '、'.join(mc.get('compat', []))))
    p = os.path.join(FACTS, 'renown.json')
    if os.path.exists(p):
        for rn in (json.load(open(p, encoding='utf-8')).get('levels') or []):
            add('s9', '名望', rn.get('title', ''), '范围 %s。%s 正面：%s' % (rn.get('range', ''), rn.get('intro', ''), rn.get('positive', '')))
    return out


def main():
    chunks = parse_help() + keyword_chunks([]) + fact_chunks()
    # 去重（同 id）
    seen, uniq = set(), []
    for c in chunks:
        if c['id'] in seen:
            continue
        seen.add(c['id'])
        uniq.append(c)
    counts = {
        'sections': sum(1 for c in uniq if c['kind'] == 'section'),
        'keywords': sum(1 for c in uniq if c['kind'] == 'keyword'),
        'facts': sum(1 for c in uniq if c['kind'] == 'fact'),
    }
    digest = hashlib.sha1(''.join(c['id'] + c['title'] + c['body'] for c in uniq).encode('utf-8')).hexdigest()[:16]
    ver = json.load(open(os.path.join(ROOT, 'electron-app', 'package.json'), encoding='utf-8'))['version']
    index = {
        'buildTime': datetime.datetime.now().isoformat(timespec='seconds'),
        'sourceVersion': ver,
        'source': '斯诺德跑团/help.html + advisor/rules/facts（lab 快照）',
        'counts': counts,
        'sourceHash': digest,
    }
    if CHECK:
        idx = json.load(open(os.path.join(OUT, 'index.json'), encoding='utf-8'))
        same = idx.get('sourceHash') == digest
        print(('OK 规则语料与 help.html 一致（%d 节 / %d 关键词 / %d 事实块）' % (counts['sections'], counts['keywords'], counts['facts'])) if same
              else 'FAIL 规则语料过期：请重新生成')
        return 0 if same else 1
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'chunks.jsonl'), 'w', encoding='utf-8') as f:
        for c in uniq:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print('规则语料已生成: %d 节 / %d 关键词 / %d 事实块（共 %d）' % (counts['sections'], counts['keywords'], counts['facts'], len(uniq)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
