# -*- coding: utf-8 -*-
"""Restore 伤害阈值 and clean empty nav lines."""
from pathlib import Path
import re

HTML = Path(__file__).resolve().parent.parent / "职业页" / "通用天赋树.html"
html = HTML.read_text(encoding="utf-8")

if "伤害阈值" not in html:
    article = '''        <article class="skill" id="g-skill-333" data-search="伤害阈值 防御 每日限一次 前置条件：你在本次游玩的战斗环节中最终以生命值降低至0或以下结束 额外条件：你在本位阶及后承受过一次过量伤害 关键词：天赋.防御.每日限一次 你可以在任意角色的回合选择令本回合你承受的伤害值不能超过30点 这个效果无法使自身在本回合已经承受的伤害值被回退" data-tags="防御,每日限一次" data-type="天赋" data-marks="#FF0000,#EE822F,#B94BFF,#FFFFFF" data-mark-count="4"><h4>伤害阈值 <span class="chip" style="background:#888">六阶</span></h4>
        <div class="chips">
          <span class="chip" data-kw="天赋">天赋</span>
          <span class="chip" data-kw="防御">防御</span>
          <span class="chip" data-kw="每日限一次">每日限一次</span>
        </div>
        <div class="detail"><p><span class="field">前置条件：</span>你在本次游玩的战斗环节中最终以生命值降低至0或以下结束</p><p><span class="field">额外条件：</span>你在本位阶及后承受过一次过量伤害</p><p><span class="field">关键词：</span>天赋.防御.每日限一次</p><p><span class="field">标识：</span><span style="font-size:1.5em;color:#FF0000;">●</span><span style="font-size:1.5em;color:#EE822F;">●</span><span style="font-size:1.5em;color:#B94BFF;">●</span><span style="font-size:1.5em;color:#FFFFFF;text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;">●</span></p><p><span class="field">描述：</span>你可以在任意角色的回合选择令本回合你承受的伤害值不能超过30点</p><p>这个效果无法使自身在本回合已经承受的伤害值被回退</p></div>
      </article>
'''
    # insert after 机制怪
    pat = re.compile(
        r'(<article class="skill" id="g-skill-332"[\s\S]*?</article>)',
        re.M,
    )
    m = pat.search(html)
    if not m:
        raise SystemExit("机制怪 not found")
    html = html[: m.end()] + "\n" + article + html[m.end() :]
    print("inserted 伤害阈值 after 机制怪")

    # nav: add under 六阶 after 机制怪 if missing
    if 'href="#g-skill-333"' not in html:
        html = re.sub(
            r'(<a class="skill-link" href="#g-skill-332">机制怪</a>\n)',
            r'\1  <a class="skill-link" href="#g-skill-333">伤害阈值</a>\n',
            html,
            count=1,
        )
        print("added 伤害阈值 nav")
else:
    print("伤害阈值 already present")

# collapse blank lines inside nav details (cosmetic)
html = re.sub(r"(</summary>\n)(?:[ \t]*\n){2,}", r"\1", html)
html = re.sub(r"(\n[ \t]*\n){3,}", "\n\n", html)

opens = len(re.findall(r'<article class="skill"', html))
closes = len(re.findall(r"</article>", html))
print(f"balance {opens}/{closes}")
if opens != closes:
    raise SystemExit("imbalance")

HTML.write_text(html, encoding="utf-8")
print("ok")
