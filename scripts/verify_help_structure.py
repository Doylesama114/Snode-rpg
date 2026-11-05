# -*- coding: utf-8 -*-
"""帮助页结构守门（v1.0.8103）

教训：help.html 的「基本规则」段少了一个 </div>，导致后面 10 个规则段整段嵌套进它，
页面看起来「文字跑到了 section 外面」，但 JS 不报错、原有断言也抓不到。
本脚本用严格解析断言结构，防止同类问题再次静默上线。
"""
import sys
from lxml import html as LH

PATH = sys.argv[1] if len(sys.argv) > 1 else 'D:/Download/scholar-agent-main/斯诺德跑团/help.html'
PANES = ('help-pane-rules', 'help-pane-world')
BLOCK_TAGS = ('p', 'h2', 'h3', 'h4', 'ul', 'ol', 'table', 'blockquote')


def main():
    raw = open(PATH, encoding='utf-8').read()
    problems = []

    opens, closes = raw.count('<div'), raw.count('</div>')
    if opens != closes:
        problems.append('<div> 与 </div> 数量不等：%d / %d' % (opens, closes))

    tree = LH.fromstring(raw)
    for pane_id in PANES:
        found = tree.xpath('//*[@id="%s"]' % pane_id)
        if not found:
            problems.append('缺少面板 #%s' % pane_id)
            continue
        pane = found[0]
        mains = pane.xpath('./main[contains(concat(" ", normalize-space(@class), " "), " help-content ")]')
        if not mains:
            problems.append('#%s 内缺少 main.help-content' % pane_id)
            continue
        main = mains[0]

        sections = [c for c in main if isinstance(c.tag, str) and 'section' in (c.get('class') or '').split()]
        if not sections:
            problems.append('#%s 内没有 section' % pane_id)

        # ① 每个 section 必须是 main 的直接子元素
        for sec in main.iter('div'):
            cls = (sec.get('class') or '').split()
            if 'section' not in cls:
                continue
            parent = sec.getparent()
            if parent is not main:
                problems.append('#%s 的 section#%s 不是 main 的直接子元素（parent=%s）' % (
                    pane_id, sec.get('id') or '?', parent.tag + '.' + (parent.get('class') or '')))

        # ② section 不得嵌套 section
        for sec in main.iter('div'):
            if 'section' not in (sec.get('class') or '').split():
                continue
            inner = [d for d in sec.iter('div') if d is not sec and 'section' in (d.get('class') or '').split()]
            if inner:
                problems.append('section#%s 内部嵌套了 %d 个 section' % (sec.get('id') or '?', len(inner)))

        # ③ 正文块必须落在某个 section 内（防止内容越界）
        for el in main.iter():
            if not isinstance(el.tag, str) or el.tag not in BLOCK_TAGS:
                continue
            cur = el.getparent()
            inside = False
            while cur is not None:
                if 'section' in (cur.get('class') or '').split():
                    inside = True
                    break
                cur = cur.getparent()
            if not inside:
                text = ' '.join((el.text_content() or '').split())[:24]
                problems.append('#%s 有 <%s> 落在所有 section 之外：%s' % (pane_id, el.tag, text))

    if problems:
        print('FAIL 帮助页结构异常（%d 项）：' % len(problems))
        for p in problems[:12]:
            print('  - ' + p)
        return 1
    print('OK 帮助页结构：section 均为 main 直接子元素、无嵌套、无越界内容、div 平衡')
    return 0


if __name__ == '__main__':
    sys.exit(main())