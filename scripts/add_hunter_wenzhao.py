# -*- coding: utf-8 -*-
"""Add missing 蚊沼专精 card to hunter site data/HTML/FX (no docx table exists)."""
from __future__ import annotations
import json, re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "职业页" / "数据" / "猎人.json"
HTML_PATH = ROOT / "职业页" / "猎人.html"
FX_PATH = ROOT / "斯诺德跑团" / "skill_effects_猎人.json"

DESC = "你的蚊沼类野兽伙伴（泛指蚊、蝇、水蛭等栖息于沼泽与湿地、以吸食血液或体液为生的生物）在每个自身回合结束时可以吸取一名相邻角色的血液，对其造成4点毒性伤害，并为你回复4点生命值"
L12 = "蚊沼专精的吸取效果改为造成6点毒性伤害并回复6点生命值，同时目标需要进行一次难度为12的体质豁免，豁免失败将进入中毒状态"

NEW_JSON = {
    "id": "h-skill-1091",
    "name": "蚊沼专精",
    "tags": ["增益", "机制"],
    "fields": {
        "前置条件": "你拥有昆虫类的野兽伙伴",
        "额外条件": "本风格不能是你的猎人职业的第三或第四种战斗风格",
        "关键词": "天赋.增益.机制",
        "标识": "●●",
        "描述": DESC,
    },
    "cost": [
        {"color": "#00B050", "count": 1, "name": "绿色", "id": "绿色"},
        {"color": "#EE822F", "count": 1, "name": "橙色", "id": "橙色"},
    ],
    "description": [],
    "level_upgrades": [
        {
            "class": "猎人职业",
            "level": 12,
            "text": L12,
            "label": "你的猎人职业等级到达12级时：",
            "line_runs": [
                {"text": "你的"}, {"text": "猎人"}, {"text": "职业等级到达12级时："}, {"text": L12}
            ],
        }
    ],
    "flavor": "",
    "style": "兽群",
    "tier": "五阶",
    "choice_group": "捕食专精/践踏专精/飞禽专精/蚊沼专精",
}

NEW_FX = {
    "id": "h-skill-1091",
    "name": "蚊沼专精",
    "class": "猎人",
    "style": "兽群风格",
    "tier": "五阶天赋树",
    "type": "天赋",
    "tags": ["增益", "机制"],
    "cost": {"sp": ["绿", "橙"]},
    "effects": [DESC, f"L12: {L12}"],
    "prerequisite": "你拥有昆虫类的野兽伙伴",
    "extra_condition": "本风格不能是你的猎人职业的第三或第四种战斗风格",
    "upgrades": [{"level": 12, "change": L12}],
}

def patch_json():
    d = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    skills = d["skills"]
    if any(s.get("id") == NEW_JSON["id"] for s in skills):
        return False
    pos = next(i for i, s in enumerate(skills) if s.get("id") == "h-skill-1083")
    skills.insert(pos + 1, NEW_JSON)
    JSON_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    return True

def article_text():
    marks = '#00B050,#EE822F'
    search = ("兽群 五阶天赋树 蚊沼专精 增益 机制 "
              "前置条件：你拥有昆虫类的野兽伙伴 "
              "额外条件：本风格不能是你的猎人职业的第三或第四种战斗风格 "
              "关键词：天赋.增益.机制 " + DESC + " " + L12)
    return f'''      <article class="skill" id="h-skill-1091" data-search="{search}" data-tags="增益,机制" data-type="天赋" data-tier="五阶" data-style="兽群" data-marks="{marks}" data-mark-count="2" data-class="猎人"><h4>蚊沼专精 <span class="chip" style="background:#69DB7C">兽群风格</span></h4>
        <div class="chips">
          <span class="chip">天赋</span>
          <span class="chip">增益</span>
          <span class="chip">机制</span>
        </div>
        <div class="detail"><div class="cond-row"><span class="cond-label">前置条件：</span><span class="cond-text">你拥有昆虫类的野兽伙伴</span></div><div class="cond-row"><span class="cond-label">额外条件：</span><span class="cond-text">本风格不能是你的猎人职业的第三或第四种战斗风格</span></div><div class="attr-table"><div class="attr-row"><span class="attr-name">施展时间：</span><span class="attr-val">-</span><span class="attr-name">施展距离</span><span class="attr-val">-</span></div><div class="attr-row"><span class="attr-name">持续时间：</span><span class="attr-val">-</span><span class="attr-name">疲劳消耗</span><span class="attr-val">-</span></div><div class="attr-row wide"><span class="attr-name">关键词：</span><span class="attr-val">天赋.增益.机制</span></div><div class="attr-row wide"><span class="attr-name">标识：</span><span class="attr-val"><span style="font-size:1.5em;color:#00B050;">●</span><span style="font-size:1.5em;color:#EE822F;">●</span></span></div></div><div class="desc-cell"><span class="desc-label">描述：</span><span class="desc-text">{DESC}</span></div><div class="upgrade-cell"><span class="upgrade-label">你的猎人职业等级到达12级时：</span>{L12}</div></div>
      </article>
'''

def patch_html():
    h = HTML_PATH.read_text(encoding="utf-8")
    if 'id="h-skill-1091"' in h:
        return False
    pos = h.find('id="h-skill-1083"')
    end = h.find('</article>', pos) + len('</article>')
    h = h[:end] + article_text() + h[end:]
    # nav link after 践踏专精 nav link
    m = re.search(r'<a class="skill-link" href="#h-skill-1083">[^<]*</a>', h)
    if not m:
        raise SystemExit("nav link for h-skill-1083 not found")
    nav = '<a class="skill-link" href="#h-skill-1091">蚊沼专精</a>'
    h = h[: m.end()] + nav + h[m.end():]
    HTML_PATH.write_text(h, encoding="utf-8", newline="\n")
    return True

def patch_fx():
    d = json.loads(FX_PATH.read_text(encoding="utf-8"))
    sk = d["猎人"]
    if any(s.get("id") == NEW_FX["id"] for s in sk):
        return False
    pos = next(i for i, s in enumerate(sk) if s.get("id") == "h-skill-1083")
    sk.insert(pos + 1, NEW_FX)
    FX_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    return True

if __name__ == "__main__":
    a = patch_json(); b = patch_html(); c = patch_fx()
    print("json", a, "html", b, "fx", c)
    for src, rel in [
        (JSON_PATH, "electron-app/职业页/数据/猎人.json"),
        (HTML_PATH, "electron-app/职业页/猎人.html"),
        (FX_PATH, "electron-app/斯诺德跑团/skill_effects_猎人.json"),
    ]:
        dst = ROOT / rel
        shutil.copy2(src, dst)
        print("sync", dst)
