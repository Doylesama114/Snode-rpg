#!/usr/bin/env python3
"""Fix b-skill-34 静寂术 (灵动) — not present as separate entry in docx."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "职业页" / "数据" / "吟游诗人.json"
HTML = ROOT / "职业页" / "吟游诗人.html"
FX = ROOT / "斯诺德跑团" / "skill_effects_吟游诗人.json"

detail = (
    '<p><span class="field">额外条件：</span>-</p>'
    '<p><span class="field">施展时间：</span>1动作</p>'
    '<p><span class="field">施展距离：</span>自身</p>'
    '<p><span class="field">持续时间：</span>立即</p>'
    '<p><span class="field">疲劳消耗：</span>2</p>'
    '<p><span class="field">关键词：</span>法术.阻碍.激活.感知豁免（15）.短休/长休</p>'
    '<p><span class="field">施展条件：</span>你能够做出对应手势、凭借言语发出声音</p>'
    '<p><span class="field">施展限制：</span>-</p>'
    '<p><span class="field">标识：</span>'
    '<span style="font-size:1.5em;color:#00FA99;text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;">●</span>'
    '<span style="font-size:1.5em;color:#FFFFFF;text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;">●</span></p>'
    '<p><span class="field">描述：</span>你做出对应的施法动作、并念诵法咒在指定位置生成一个半透明的粉色罩子，将声音隔绝在外</p>'
    '<p>你隔绝一片3*3区域内的所有使用，区域外的角色无法听见内部发出的声响，反之亦然</p>'
    '<p>位于区域内的角色承受来自外界的音爆伤害在结算后减半，反之亦然</p>'
    '<p>当静寂术消除了超过30点音爆伤害后，会提前消散</p>'
)

data = json.loads(DATA.read_text(encoding="utf-8"))
for sk in data["skills"]:
    if sk["id"] != "b-skill-34":
        continue
    sk["fields"] = {
        "额外条件": "-",
        "施展时间": "1动作",
        "施展距离": "自身",
        "持续时间": "立即",
        "疲劳消耗": "2",
        "关键词": "法术.阻碍.激活.感知豁免（15）.短休/长休",
        "施展条件": "你能够做出对应手势、凭借言语发出声音",
        "施展限制": "-",
        "标识": "●●",
        "描述": "你做出对应的施法动作、并念诵法咒在指定位置生成一个半透明的粉色罩子，将声音隔绝在外",
    }
    sk["tags"] = ["阻碍", "激活", "感知豁免（15）", "短休/长休"]
    sk["cost"] = [
        {"color": "#00FA99", "count": 1, "name": "青色", "id": "青色"},
        {"color": "#FFFFFF", "count": 1, "name": "白色", "id": "白色"},
    ]
    sk["description"] = [
        "你隔绝一片3*3区域内的所有使用，区域外的角色无法听见内部发出的声响，反之亦然",
        "位于区域内的角色承受来自外界的音爆伤害在结算后减半，反之亦然",
    ]
    sk["flavor"] = "当静寂术消除了超过30点音爆伤害后，会提前消散"
    break

DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

html = HTML.read_text(encoding="utf-8")
sid = "b-skill-34"
pos = html.find(f'id="{sid}"')
article_start = html.rfind("<article", 0, pos)
h4_start = html.find("<h4>", pos)
detail_start = html.find('<div class="detail">', h4_start)
detail_content_start = detail_start + len('<div class="detail">')
detail_end = html.find("</div>", detail_content_start)
article_end = html.find("</article>", detail_end)
search = (
    "灵动 一阶天赋树 静寂术 阻碍 激活 感知豁免（15） 短休 长休 "
    "施展时间：1动作 施展距离：自身 持续时间：立即 疲劳消耗：2 "
    "关键词：法术.阻碍.激活.感知豁免（15）.短休/长休 "
    "施展条件：你能够做出对应手势、凭借言语发出声音 施展限制：- "
    "你做出对应的施法动作、并念诵法咒在指定位置生成一个半透明的粉色罩子，将声音隔绝在外"
)
middle = html[h4_start:detail_content_start]
rebuilt = (
    f'<article class="skill" id="{sid}" data-search="{search}">'
    + middle
    + detail
    + html[detail_end:article_end + len("</article>")]
)
html = html[:article_start] + rebuilt + html[article_end + len("</article>") :]
HTML.write_text(html, encoding="utf-8")

# refresh fx
import sys

sys.path.insert(0, "scripts")
from class_sync_core import json_to_fx_entry

fx_doc = json.loads(FX.read_text(encoding="utf-8"))
fx_doc["吟游诗人"] = [json_to_fx_entry(s, "吟游诗人") for s in data["skills"]]
FX.write_text(json.dumps(fx_doc, ensure_ascii=False, indent=2), encoding="utf-8")

for src, dst in (
    (DATA, ROOT / "electron-app" / "职业页" / "数据" / "吟游诗人.json"),
    (HTML, ROOT / "electron-app" / "职业页" / "吟游诗人.html"),
    (FX, ROOT / "electron-app" / "斯诺德跑团" / "skill_effects_吟游诗人.json"),
):
    shutil.copy2(src, dst)

print("fixed b-skill-34")
