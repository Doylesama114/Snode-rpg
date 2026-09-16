#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""召唤师创建页接入（M6）：职业条目 + 起始特性全给 + 第 1 步内契约生物选择。

要点（用户确认口径）：
- 关键属性 = 幸运（FP 吃幸运调整值）
- 起始特性 3 条全部获得（复用术士分支）
- 契约生物选择放在第 1 步「选择职业」内（与牧师神祇/魔契师宗主同款），20 选 1 + 随机抽取，
  未选择则「下一步」禁用；结果写入 class_features 的「机缘召唤」描述（可随存档/上传往返）

幂等：重复执行不会重复插入。
用法：
  python scripts/apply_summoner_chargen_entries.py --check
  python scripts/apply_summoner_chargen_entries.py --write
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
CHARGEN = ROOT / '斯诺德跑团' / '角色创建页.html'
CHARGEN_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '角色创建页.html'
UPLOAD = ROOT / '斯诺德跑团' / '上传角色.html'
UPLOAD_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '上传角色.html'

OVERRIDE_LINE = "      '召唤师':{key_attr:'幸运', hp:8, fp:8, saves:'感知、幸运'}\n"
SPECS_LINE = ('  "召唤师":[{n:"召唤联结",d:"与契约生物存在深层联结，可感知其情绪、状态与方位"},{n:"异界感知",'
              'd:"感知周围 24 米内的传送门、异界裂隙、召唤法阵与位面锚点"},{n:"机缘召唤",'
              'd:"与异界灵魂缔结契约，获得契约生物伙伴（创建时随机抽取或自选）"}],\n')
START_LINE = ('  "召唤师":[{n:"魔法飞弹",d:"向一名角色发射魔法飞弹，造成1D8点力场伤害"},{n:"次级召唤术",'
              'd:"随机召唤一名角色或物件来到身边"},{n:"唤回",d:"将契约生物唤回身边或遣返回原位面"}],\n')

CONTRACT_JS = r'''
/** 召唤师：契约生物选择（第 1 步「选择职业」内）——数据来自 CONTRACT_CREATURES */
function showSummonerContractChoice(clsName){
  var old=document.getElementById("summonerContractArea");
  if(old)old.remove();
  if(clsName!=="召唤师")return;
  if(typeof CONTRACT_CREATURES==="undefined"||!CONTRACT_CREATURES.length)return;
  var p=document.getElementById("classDetail");
  var box=document.createElement("div");box.id="summonerContractArea";
  box.style.cssText="margin-top:12px;padding:16px 20px;background:#fffdf8;border:1px solid #d8d2c4;border-radius:10px";box.className='popup-box';
  var h="<div style='font-size:15px;font-weight:bold;margin-bottom:6px'>选择契约生物（机缘召唤）</div>";
  h+="<div style='font-size:12px;color:#69706b;margin-bottom:10px'>共 "+CONTRACT_CREATURES.length+" 个系别，可自选或随机抽取；未选择无法进入下一步</div>";
  h+="<div style='margin-bottom:10px'><button type='button' class='btn btn-secondary' onclick='rollSummonerContract()'>🎲 随机抽取</button></div>";
  h+="<div id='contractChips' style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px'>";
  for(var i=0;i<CONTRACT_CREATURES.length;i++){
    var c=CONTRACT_CREATURES[i];
    h+="<div class='skill-chip' data-cycle='"+i+"' onclick='pickSummonerContract(this)' style='font-size:12px;padding:6px 10px'>"+c.category+"·"+c.name+"</div>";
  }
  h+="</div><div id='contractCard'></div>";
  box.innerHTML=h;
  p.parentNode.insertBefore(box, p.nextSibling);
  if(CHAR.contractCreature)selectSummonerContractChip(CHAR.contractCreature.name);
  else renderSummonerContractCard(null);
  checkSpecDone();
}
function _contractByName(name){
  if(typeof CONTRACT_CREATURES==="undefined")return null;
  for(var i=0;i<CONTRACT_CREATURES.length;i++)if(CONTRACT_CREATURES[i].name===name)return CONTRACT_CREATURES[i];
  return null;
}
function selectSummonerContractChip(name){
  var chips=document.querySelectorAll("#contractChips .skill-chip");
  for(var i=0;i<chips.length;i++){
    var idx=parseInt(chips[i].getAttribute("data-cycle"),10);
    var c=(typeof CONTRACT_CREATURES!=="undefined")?CONTRACT_CREATURES[idx]:null;
    chips[i].classList.toggle("selected",!!(c&&c.name===name));
  }
}
function renderSummonerContractCard(c){
  var el=document.getElementById("contractCard");
  if(!el)return;
  if(!c){el.innerHTML="<div style='font-size:12px;color:#69706b'>尚未选择契约生物</div>";return;}
  var attrs="";
  var order=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
  attrs+="<div style='display:flex;gap:8px;flex-wrap:wrap;margin:6px 0'>";
  for(var i=0;i<order.length;i++){
    var a=c.attrs[order[i]]||{};
    attrs+="<span style='font-size:12px;background:#f6f4ef;border:1px solid #e8e2d8;border-radius:6px;padding:3px 8px'>"+order[i]+" "+(a.value===null||a.value===undefined?"—":a.value)+(a.mod===null||a.mod===undefined?"":"（"+(a.mod>=0?"+":"")+a.mod+"）")+"</span>";
  }
  attrs+="</div>";
  var t="<div style='font-weight:bold;margin-bottom:4px'>"+c.name+" <span class='chip'>"+c.category+"</span></div>";
  t+="<div style='font-size:12px;color:#69706b;margin-bottom:6px'>"+c.type+" ｜ 防御等级 "+c.ac+" ｜ 生命值 "+c.hp+" ｜ 挑战等级 "+c.cr+"</div>";
  t+=attrs;
  t+="<div style='font-size:12px;margin-bottom:4px'>感官："+c.senses+"　移动速度："+c.speed+"</div>";
  t+="<div style='font-size:12px;margin-bottom:4px'>战斗加成："+c.combat+"</div>";
  var dmg=[];
  if(c.vulnerable&&c.vulnerable.length)dmg.push("伤害易伤："+c.vulnerable.join("、"));
  if(c.resist&&c.resist.length)dmg.push("伤害抗性："+c.resist.join("、"));
  if(c.immune&&c.immune.length)dmg.push("伤害免疫："+c.immune.join("、"));
  if(c.statusImmune&&c.statusImmune.length)dmg.push("状态免疫："+c.statusImmune.join("、"));
  if(dmg.length)t+="<div style='font-size:12px;margin-bottom:4px'>"+dmg.join("　")+"</div>";
  t+="<div style='font-size:12px;margin-bottom:4px'>语言："+(c.languages||"—")+"</div>";
  if(c.traits&&c.traits.length){
    t+="<div style='font-size:12px;font-weight:bold;margin-top:6px'>特性</div><ul style='margin:2px 0 6px 18px;padding:0;font-size:12px'>";
    for(var j=0;j<c.traits.length;j++)t+="<li><b>"+c.traits[j].name+"</b>："+c.traits[j].text+"</li>";
    t+="</ul>";
  }
  if(c.actions&&c.actions.length){
    t+="<div style='font-size:12px;font-weight:bold'>动作</div><ul style='margin:2px 0 0 18px;padding:0;font-size:12px'>";
    for(var k=0;k<c.actions.length;k++)t+="<li><b>"+c.actions[k].name+"</b>："+c.actions[k].text+"</li>";
    t+="</ul>";
  }
  el.innerHTML=t;
}
function pickSummonerContract(el){
  var idx=parseInt(el.getAttribute("data-cycle"),10);
  var c=CONTRACT_CREATURES[idx];
  if(!c)return;
  CHAR.contractCreature={name:c.name,category:c.category};
  selectSummonerContractChip(c.name);
  renderSummonerContractCard(c);
  if(window.snd)snd.play('select');
  checkSpecDone();updateOverview();
}
function rollSummonerContract(){
  if(typeof CONTRACT_CREATURES==="undefined"||!CONTRACT_CREATURES.length)return;
  var c=CONTRACT_CREATURES[Math.floor(Math.random()*CONTRACT_CREATURES.length)];
  CHAR.contractCreature={name:c.name,category:c.category};
  selectSummonerContractChip(c.name);
  renderSummonerContractCard(c);
  if(window.snd)snd.play('select');
  checkSpecDone();updateOverview();
}
'''


def patch_chargen(text: str) -> str:
    # 1) 引入契约生物数据
    if 'summoner_contracts_data.js' not in text:
        old = '<script src="../职业页/数据/classes_data.js"></script>'
        assert old in text, '未找到 classes_data.js 引入行'
        text = text.replace(old, '<script src="../职业页/数据/summoner_contracts_data.js"></script>\n' + old, 1)

    # 2) CLS_OVERRIDE（注意：末行需要补逗号）
    if "'召唤师':{key_attr" not in text:
        pat = r"^      '谋士':\{key_attr:'智力', hp:8, fp:10, saves:'智力、魅力'\}"
        m = re.search(pat, text, re.M)
        assert m, '未找到 CLS_OVERRIDE 谋士行'
        line = m.group(0).rstrip()
        if not line.endswith(','):
            line += ','
        text = text[:m.start()] + line + chr(10) + OVERRIDE_LINE + text[m.end() + 1:]

    # 3) CLASS_SPECIALIZATIONS（职业专长 3 条）
    if '"召唤师":[{n:"召唤联结"' not in text:
        m = re.search(r'^(  "谋士":\[\{n:"运筹帷幄".*?)\n', text, re.M)
        assert m, '未找到 CLASS_SPECIALIZATIONS 谋士行'
        line = m.group(1).rstrip()
        if not line.endswith(','):
            line += ','
        text = text[:m.start()] + line + '\n' + SPECS_LINE + text[m.end(1) + 1:]

    # 4) CLASS_STARTING_FEATURES（3 条全给）
    if '"召唤师":[{n:"魔法飞弹"' not in text:
        m = re.search(r'^(  "谋士":\[\{n:"交友术".*?)\n', text, re.M)
        assert m, '未找到 CLASS_STARTING_FEATURES 谋士行'
        line = m.group(1).rstrip()
        if not line.endswith(','):
            line += ','
        text = text[:m.start()] + line + '\n' + START_LINE + text[m.end(1) + 1:]

    # 5) 起始特性：召唤师 = 全部获得（与术士一致）
    if 'CHAR.className==="术士"||CHAR.className==="召唤师"' not in text:
        old = 'if(CHAR.className==="术士"){maxPick=features.length;'
        new = 'if(CHAR.className==="术士"||CHAR.className==="召唤师"){maxPick=features.length;'
        assert old in text, '未找到起始特性术士分支'
        text = text.replace(old, new, 1)
    text = text.replace("(CHAR.className===\"术士\"?'术士初始拥有全部起始特性'",
                        "(CHAR.className===\"术士\"||CHAR.className===\"召唤师\"?(CHAR.className+'初始拥有全部起始特性')", 1)

    # 6) 契约生物选择 JS
    if 'function showSummonerContractChoice' not in text:
        anchor = 'function selectClass(idx){'
        assert anchor in text, '未找到 selectClass'
        text = text.replace(anchor, CONTRACT_JS + '\n' + anchor, 1)

    # 7) selectClass 内调用 + 重置
    if 'showSummonerContractChoice(CLASSES[idx].name);' not in text:
        old = 'showWarlockPatronChoice(CLASSES[idx].name);'
        assert old in text
        text = text.replace(old, old + '\n  showSummonerContractChoice(CLASSES[idx].name);', 1)
    if 'CHAR.contractCreature=null;' not in text:
        old2 = 'CHAR.deity="";CHAR.deityAttr="";CHAR.patron="";'
        assert old2 in text
        text = text.replace(old2, old2 + 'CHAR.contractCreature=null;', 1)

    # 8) checkSpecDone 门禁
    if 'clsName==="召唤师"&&!CHAR.contractCreature' not in text:
        old3 = 'if(clsName==="魔契师"&&!CHAR.patron)allDone=false;'
        assert old3 in text
        text = text.replace(old3, old3 + '\n  if(clsName==="召唤师"&&!CHAR.contractCreature)allDone=false;', 1)

    # 9) class_features 描述：机缘召唤 → 契约生物
    if '_cfName==="机缘召唤"' not in text:
        old4 = '}else if((_cfName==="奥法学者"||_cfName==="知识传承"||_cfName==="万用模组")'
        assert old4 in text
        text = text.replace(
            old4,
            '}else if(_cfName==="机缘召唤"&&CHAR.contractCreature){'
            '_cfDesc="契约生物："+CHAR.contractCreature.name+"（"+CHAR.contractCreature.category+"）";\n    '
            + old4, 1)

    # 10) 快照：构建 + 还原
    if 'contractCreature:CHAR.contractCreature' not in text:
        old5 = '    selectedFeatures:(CHAR.selectedFeatures||[]).slice(),'
        assert old5 in text
        text = text.replace(old5, old5 + '\n    contractCreature:CHAR.contractCreature?JSON.parse(JSON.stringify(CHAR.contractCreature)):null,', 1)
    if 'CHAR.contractCreature=snap.contractCreature' not in text:
        old6 = 'CHAR.selectedFeatures=(snap.selectedFeatures||[]).slice();'
        assert old6 in text
        text = text.replace(old6, old6 + '\n  CHAR.contractCreature=snap.contractCreature?JSON.parse(JSON.stringify(snap.contractCreature)):null;', 1)
    return text


def patch_upload(text: str) -> str:
    """上传角色：从「机缘召唤」描述解析契约生物。"""
    if 'contractCreature' in text:
        return text
    old = '    else if(_cfn.indexOf("万用模组")>=0){s.classChoices.specChoices["万用模组"]={attr:"",skill:_cfd.trim()};}'
    new = old + '''
    else if(_cfn.indexOf("机缘召唤")>=0){
      var _mcc=String(_cfd||"").match(/契约生物[:：]\\s*([^（(]+)(?:[（(]([^）)]+)[）)])?/);
      if(_mcc)s.contractCreature={name:_mcc[1].trim(),category:(_mcc[2]||"").trim()};
    }'''
    if old in text:
        text = text.replace(old, new, 1)
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    chg = CHARGEN.read_text(encoding='utf-8')
    up = UPLOAD.read_text(encoding='utf-8')
    checks = {
        '数据脚本引入': 'summoner_contracts_data.js' in chg,
        'CLS_OVERRIDE': "'召唤师':{key_attr:'幸运'" in chg,
        '专长 3 条': '"召唤师":[{n:"召唤联结"' in chg,
        '起始特性 3 条': '"召唤师":[{n:"魔法飞弹"' in chg,
        '起始特性全给分支': 'CHAR.className==="术士"||CHAR.className==="召唤师"' in chg,
        '契约生物选择 JS': 'function showSummonerContractChoice' in chg,
        '第 1 步调用': 'showSummonerContractChoice(CLASSES[idx].name);' in chg,
        '未选门禁': 'clsName==="召唤师"&&!CHAR.contractCreature' in chg,
        '导出描述': '_cfName==="机缘召唤"' in chg,
        '快照往返': 'contractCreature:CHAR.contractCreature' in chg and 'CHAR.contractCreature=snap.contractCreature' in chg,
        '上传解析': 'contractCreature' in up,
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

    new_chg = patch_chargen(chg)
    CHARGEN.write_text(new_chg, encoding='utf-8', newline='')
    if CHARGEN_MIRROR.exists():
        CHARGEN_MIRROR.write_text(new_chg, encoding='utf-8', newline='')
    new_up = patch_upload(up)
    if new_up != up:
        UPLOAD.write_text(new_up, encoding='utf-8', newline='')
        if UPLOAD_MIRROR.exists():
            UPLOAD_MIRROR.write_text(new_up, encoding='utf-8', newline='')
    print('✅ 召唤师创建页接入完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
