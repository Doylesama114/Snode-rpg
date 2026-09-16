#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""召唤师面板接入（M7）：
1) panel_data.js：REF_CLASSES.召唤师 + CLASS_WEAPON_PROF_DOCX/CLASS_WEAPON_PROFS（含 electron 镜像）
2) 角色面板.html：引入契约生物数据脚本
3) panel_engine.js：风格配色 STYLE_COLOR_MAP、起始特性风格映射 STARTING_STYLE_OVERRIDE、
   以及契约生物卡渲染（等级/羁绊点数手填）

用法：
  python scripts/apply_summoner_panel_entries.py --check
  python scripts/apply_summoner_panel_entries.py --write
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
PANEL_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_data.js'
PANEL_HTML = ROOT / '斯诺德跑团' / '角色面板.html'
PANEL_HTML_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '角色面板.html'
ENGINE = ROOT / '斯诺德跑团' / 'panel_engine.js'
ENGINE_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_engine.js'

CLASS = '召唤师'
WEAPON_DOCX = '法杖、魔棒、匕首、手弩、简易武器'
WEAPON_CATS = ['法器', '剑类', '弓箭', '简易']  # 与法师同款武器表
STYLE_COLORS = {'咒法': 'C0A8FF', '降灵': '8ED7F5'}
STARTING_STYLE = {'魔法飞弹': '咒法', '次级召唤术': '咒法', '唤回': '降灵'}
FEATURES = [
    {'name': '召唤联结', 'desc': '与契约生物存在深层联结，可感知其情绪、状态与方位'},
    {'name': '异界感知', 'desc': '感知周围 24 米内的传送门、异界裂隙、召唤法阵与位面锚点'},
    {'name': '机缘召唤', 'desc': '与异界灵魂缔结契约，获得契约生物伙伴（创建时随机抽取或自选）'},
]
STARTING = [
    {'name': '魔法飞弹', 'desc': '向一名角色发射魔法飞弹，造成1D8点力场伤害'},
    {'name': '次级召唤术', 'desc': '随机召唤一名角色或物件来到身边'},
    {'name': '唤回', 'desc': '将契约生物唤回身边或遣返回原位面'},
]
ENTRY = {
    'id': CLASS, 'name': CLASS,
    'key_attr': '幸运', 'armor': '轻甲', 'weapons': WEAPON_DOCX,
    'saves': ['感知', '幸运'],
    'skills': '从专注、奥秘、多元宇宙、神秘学、洞悉、驯兽、感悟、机遇中选择四项熟练度各+1',
    'specializations': FEATURES,
    'starting_features': STARTING,
    'starting_choice': 3,
    'hp_formula': {'first': 8, 'level_up': 2},
    'fp_formula': {'first': 8, 'level_up': 1},
}

CONTRACT_JS = r'''

/** 召唤师契约生物卡（数据来自 CONTRACT_CREATURES；等级/羁绊点数可手填） */
function summonerContractName(){
  if(state.contract&&state.contract.name)return state.contract.name;
  var feats=state.class_features||[];
  for(var i=0;i<feats.length;i++){
    var nm=String(feats[i].name||""),ds=String(feats[i].desc||"");
    if(nm.indexOf("机缘召唤")>=0){
      var m=ds.match(/契约生物[:：]\s*([^（(]+)(?:[（(]([^）)]+)[）)])?/);
      if(m)return m[1].trim();
    }
  }
  return "";
}
function summonerContractData(){
  var nm=summonerContractName();
  if(!nm||typeof CONTRACT_CREATURES==="undefined")return null;
  for(var i=0;i<CONTRACT_CREATURES.length;i++)if(CONTRACT_CREATURES[i].name===nm)return CONTRACT_CREATURES[i];
  return null;
}
function setContractLevel(v){
  if(!state.contract)state.contract={name:summonerContractName(),level:1,bond:0};
  state.contract.level=Math.max(1,Math.min(15,parseInt(v,10)||1));
  renderTraits();
}
function setContractBond(v){
  if(!state.contract)state.contract={name:summonerContractName(),level:1,bond:0};
  state.contract.bond=Math.max(0,parseInt(v,10)||0);
  renderTraits();
}
function summonerContractHtml(){
  var c=summonerContractData();
  if(!c)return "";
  if(!state.contract)state.contract={name:c.name,level:1,bond:0};
  var order=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
  var attrs="";
  for(var i=0;i<order.length;i++){
    var a=(c.attrs||{})[order[i]]||{};
    attrs+='<span style="display:inline-block;font-size:12px;background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 7px;margin:2px 3px 2px 0">'+order[i]+' '+(a.value===null||a.value===undefined?'—':a.value)+(a.mod===null||a.mod===undefined?'':'（'+(a.mod>=0?'+':'')+a.mod+'）')+'</span>';
  }
  var dmg=[];
  if(c.vulnerable&&c.vulnerable.length)dmg.push("易伤 "+c.vulnerable.join("、"));
  if(c.resist&&c.resist.length)dmg.push("抗性 "+c.resist.join("、"));
  if(c.immune&&c.immune.length)dmg.push("免疫 "+c.immune.join("、"));
  if(c.statusImmune&&c.statusImmune.length)dmg.push("状态免疫 "+c.statusImmune.join("、"));
  var h='<div class="trait-item" style="border-left:4px solid #8ED7F5">';
  h+='<span class="trait-name">契约生物 · '+c.name+'（'+c.category+'）</span>';
  h+='<div style="font-size:12px;color:var(--muted);margin:4px 0 6px">'+c.type+' ｜ 防御等级 '+c.ac+' ｜ 生命值 '+c.hp+' ｜ 挑战等级 '+c.cr+'</div>';
  h+='<div style="margin-bottom:4px">'+attrs+'</div>';
  h+='<div style="font-size:12px;margin-bottom:2px">感官：'+(c.senses||"—")+'　移动速度：'+(c.speed||"—")+'</div>';
  h+='<div style="font-size:12px;margin-bottom:2px">战斗加成：'+(c.combat||"—")+'</div>';
  if(dmg.length)h+='<div style="font-size:12px;margin-bottom:2px">'+dmg.join("　")+'</div>';
  h+='<div style="font-size:12px;margin-bottom:6px">语言：'+(c.languages||"—")+'</div>';
  if(c.traits&&c.traits.length){
    h+='<div style="font-size:12px;font-weight:bold">特性</div><ul style="margin:2px 0 6px 18px;padding:0;font-size:12px">';
    for(var j=0;j<c.traits.length;j++)h+='<li><b>'+c.traits[j].name+'</b>：'+c.traits[j].text+'</li>';
    h+='</ul>';
  }
  if(c.actions&&c.actions.length){
    h+='<div style="font-size:12px;font-weight:bold">动作</div><ul style="margin:2px 0 6px 18px;padding:0;font-size:12px">';
    for(var k=0;k<c.actions.length;k++)h+='<li><b>'+c.actions[k].name+'</b>：'+c.actions[k].text+'</li>';
    h+='</ul>';
  }
  h+='<div style="display:flex;gap:10px;align-items:center;font-size:12px;margin-top:6px">';
  h+='<label>等级 <input type="number" min="1" max="15" value="'+(state.contract.level||1)+'" onchange="setContractLevel(this.value)" style="width:60px"></label>';
  h+='<label>羁绊点数 <input type="number" min="0" value="'+(state.contract.bond||0)+'" onchange="setContractBond(this.value)" style="width:70px"></label>';
  h+='<span style="color:var(--muted)">（成长细则待作者补充，暂为手填）</span>';
  h+='</div></div>';
  return h;
}
'''


def js_const(path: Path, name: str):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'var\s+%s\s*=\s*(\{.*?\});' % re.escape(name), text, re.S)
    if not m:
        raise SystemExit('未找到 %s' % name)
    return json.loads(m.group(1)), m


def patch_ref(text: str) -> str:
    m = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", text, re.S)
    if not m:
        raise SystemExit('未找到 REF_CLASSES')
    ref = json.loads(m.group(1).replace("\\'", "'"))
    if CLASS in ref and ref[CLASS].get('key_attr') == '幸运':
        return text
    ref[CLASS] = ENTRY
    body = json.dumps(ref, ensure_ascii=False).replace("'", "\\'")
    return re.sub(r"const REF_CLASSES = JSON\.parse\('.*?'\);",
                  lambda mm: "const REF_CLASSES = JSON.parse('%s');" % body, text, count=1, flags=re.S)


def patch_engine(text: str) -> str:
    if '"召唤师": {"咒法"' not in text:
        anchor = '"谋士": {"权谋":"E4D9FF","军团":"D6EAFF","先见":"FFF0B3","鸩毒":"D6F7D8","混乱":"FFD8D8","博物":"FFE7CC"},'
        assert anchor in text, '未找到 STYLE_COLOR_MAP 谋士行'
        text = text.replace(anchor, anchor + '\n  "召唤师": {"咒法":"%s","降灵":"%s"},' % (STYLE_COLORS['咒法'], STYLE_COLORS['降灵']), 1)
    if '"召唤师": {"魔法飞弹"' not in text:
        anchor2 = '"谋士": {"交友术":"权谋","战术部署":"军团","毒刃":"鸩毒","离间":"混乱"}'
        assert anchor2 in text, '未找到 STARTING_STYLE_OVERRIDE 谋士行'
        items = ','.join('"%s":"%s"' % (k, v) for k, v in STARTING_STYLE.items())
        text = text.replace(anchor2, anchor2 + ',\n  "召唤师": {%s}' % items, 1)
    if 'function summonerContractData' not in text:
        text = text.replace('function renderTraits(){', CONTRACT_JS + '\n\nfunction renderTraits(){', 1)
        anchor3 = "  var cfh=\"\";for(var ci=0;ci<state.class_features.length;ci++){"
        assert anchor3 in text, '未找到 class-features 渲染行'
        text = text.replace(anchor3, '  cfh+=summonerContractHtml();\n' + anchor3, 1)
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    panel = PANEL.read_text(encoding='utf-8')
    engine = ENGINE.read_text(encoding='utf-8')
    html = PANEL_HTML.read_text(encoding='utf-8')
    _rm = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", panel, re.S)
    if not _rm:
        raise SystemExit('未找到 REF_CLASSES')
    ref = json.loads(_rm.group(1).replace("\'", "'"))
    prof_docx, _ = js_const(PANEL, 'CLASS_WEAPON_PROF_DOCX')
    prof_cat, _ = js_const(PANEL, 'CLASS_WEAPON_PROFS')

    checks = {
        'REF_CLASSES.召唤师': CLASS in ref,
        '武器 docx 映射': CLASS in prof_docx,
        '武器类别映射': CLASS in prof_cat,
        '面板引入契约数据': 'summoner_contracts_data.js' in html,
        '风格配色': '"召唤师": {"咒法"' in engine,
        '起始特性映射': '"召唤师": {"魔法飞弹"' in engine,
        '契约生物卡': 'function summonerContractData' in engine,
    }
    for k, v in checks.items():
        print('%-20s %s' % (k, 'OK' if v else '缺失'))
    if args.check:
        ok = all(checks.values())
        print('OK' if ok else 'FAIL')
        return 0 if ok else 1
    if not args.write:
        ap.print_help()
        return 0

    new_panel = patch_ref(panel)
    if CLASS not in prof_docx:
        prof_docx[CLASS] = WEAPON_DOCX
        new_panel = re.sub(r'var CLASS_WEAPON_PROF_DOCX=\{[^;]+\};',
                           lambda m: 'var CLASS_WEAPON_PROF_DOCX=%s;' % json.dumps(prof_docx, ensure_ascii=False),
                           new_panel, count=1)
    if CLASS not in prof_cat:
        prof_cat[CLASS] = WEAPON_CATS
        new_panel = re.sub(r'var CLASS_WEAPON_PROFS=\{[^;]+\};',
                           lambda m: 'var CLASS_WEAPON_PROFS=%s;' % json.dumps(prof_cat, ensure_ascii=False),
                           new_panel, count=1)
    PANEL.write_text(new_panel, encoding='utf-8', newline='')
    if PANEL_MIRROR.exists():
        shutil.copyfile(PANEL, PANEL_MIRROR)

    new_engine = patch_engine(engine)
    ENGINE.write_text(new_engine, encoding='utf-8', newline='')
    if ENGINE_MIRROR.exists():
        shutil.copyfile(ENGINE, ENGINE_MIRROR)

    # 面板页内联 renderTraits 会覆盖 panel_engine 的同名函数 → 也把契约卡挂到 #classTraits
    if 'summonerContractHtml()' not in html:
        anchor_ct = "  document.getElementById('classTraits').innerHTML = ct;"
        assert anchor_ct in html, '未找到内联 renderTraits 的 classTraits 赋值'
        html = html.replace(
            anchor_ct,
            "  ct += (typeof summonerContractHtml === 'function' ? summonerContractHtml() : '');" + chr(10) + anchor_ct, 1)
    if 'summoner_contracts_data.js' not in html:
        anchor = '<script src="../职业页/数据/items_data.js"></script>'
        assert anchor in html
        html = html.replace(anchor, '<script src="../职业页/数据/summoner_contracts_data.js"></script>\n' + anchor, 1)
    PANEL_HTML.write_text(html, encoding='utf-8', newline='')
    if PANEL_HTML_MIRROR.exists():
        PANEL_HTML_MIRROR.write_text(html, encoding='utf-8', newline='')
    print('✅ 召唤师面板接入完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
