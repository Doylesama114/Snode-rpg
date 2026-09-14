#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""谋士职业专长选择修复：把 6 战斗风格误当专长 改为 3 职业专长，并支持「博闻强识」选 2 项知识熟练度。

背景：v1.0.7270 误将谋士的 6 个战斗风格写入 CLASS_SPECIALIZATIONS（该字段语义是「职业专长」），
导致 博闻强识（获得 2 点任意不同的知识熟练度）在创建时没有选择入口与生效路径。
本脚本幂等执行：
  1) CLASS_SPECIALIZATIONS.谋士 → 运筹帷幄/博闻强识/料敌机先
  2) SPEC_PROF_CHOICES.谋士.博闻强识 → {multi:2, pick:[10 项知识熟练度]}
  3) 创建页 UI/校验/导出/总览、上传角色导入、面板描述 全链路支持 multi 选择
  4) REF_CLASSES.谋士.specializations 与 advisor class_registry.specProfChoices 同步为 3 专长

用法：
  python scripts/apply_strategist_feature_choices.py --check
  python scripts/apply_strategist_feature_choices.py --write
"""
from __future__ import annotations

import argparse
import io
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
CHARGEN = ROOT / '斯诺德跑团' / '角色创建页.html'
CHARGEN_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '角色创建页.html'
UPLOAD = ROOT / '斯诺德跑团' / '上传角色.html'
UPLOAD_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / '上传角色.html'
PANEL = ROOT / '斯诺德跑团' / 'panel_data.js'
PANEL_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_data.js'
ENGINE = ROOT / '斯诺德跑团' / 'panel_engine.js'
ENGINE_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'panel_engine.js'
PROF = ROOT / '斯诺德跑团' / 'chargen_prof.js'
PROF_MIRROR = ROOT / 'electron-app' / '斯诺德跑团' / 'chargen_prof.js'
REGISTRY = ROOT / 'advisor' / 'chargen' / 'class_registry.json'

FEATURES = [
    {'n': '运筹帷幄', 'd': '每次游玩开始时，为每名其他玩家角色指定一个不同的熟练项，其首次对应检定具有优势'},
    {'n': '博闻强识', 'd': '获得 2 点任意不同的知识熟练度'},
    {'n': '料敌机先', 'd': '掷先攻骰后可主动下调自身先攻区间（先锋席→中坚席→后卫席→殿军席）'},
]
KNOWLEDGE = ['知识-历史', '知识-地理', '知识-人文', '知识-政治', '知识-神秘学',
             '知识-工程学', '知识-珠宝学', '知识-草药学', '知识-医药', '知识-烹饪']

SPEC_JS = ('  "谋士":{"博闻强识":{multi:2,pick:[%s]}},\n'
           % ','.join('"%s"' % k for k in KNOWLEDGE))
SPECS_LINE = ('  "谋士":['
              + ','.join('{n:"%s",d:"%s"}' % (f['n'], f['d']) for f in FEATURES)
              + '],\n')


def patch_chargen(text: str) -> str:
    # 1) CLASS_SPECIALIZATIONS.谋士 → 3 职业专长
    text = re.sub(r'^  "谋士":\[\{n:"权谋".*?\n', SPECS_LINE, text, count=1, flags=re.M)

    # 2) SPEC_PROF_CHOICES 增加谋士（放在 奇械师 行后）
    if '"谋士":{"博闻强识"' not in text:
        m = re.search(r'^(  "奇械师":\{"万用模组".*?)\n', text, re.M)
        if not m:
            raise SystemExit('未找到 SPEC_PROF_CHOICES.奇械师 行')
        line = m.group(1).rstrip()
        if not line.endswith(','):
            line += ','
        text = text[:m.start()] + line + '\n' + SPEC_JS + text[m.end(1) + 1:]

    # 3) renderSpecChoices：multi 渲染
    if 'specMultiRow' not in text:
        old = """    if(pc.single){
      h+="<div class='specSingleRow' style='display:flex;gap:6px;flex-wrap:wrap'>";"""
        new = """    if(pc.multi){
      var _picked=(CHAR.specChoices&&CHAR.specChoices[sn]&&CHAR.specChoices[sn].skills)||[];
      h+="<div class='specMultiRow' data-multi='"+pc.multi+"' style='display:flex;gap:6px;flex-wrap:wrap'>";
      for(var mi=0;mi<pc.pick.length;mi++){
        var _sel=_picked.indexOf(pc.pick[mi])>=0;
        h+="<div class='spec-btn spec-skill"+(_sel?" selected":"")+"' data-skill='"+pc.pick[mi]+"'>"+pc.pick[mi]+"</div>";
      }
      h+="</div>";
      h+="<div class='specMultiHint' style='font-size:12px;color:#69706b;margin-top:6px'>已选 <b>"+_picked.length+"</b>/"+pc.multi+"（需 "+pc.multi+" 项不同）</div>";
    }
    if(pc.single){
      h+="<div class='specSingleRow' style='display:flex;gap:6px;flex-wrap:wrap'>";"""
        assert old in text
        text = text.replace(old, new, 1)

    # 4) 点击处理：multi 多选
    if 'isMulti' not in text:
        old = """      var isSingle=t.parentNode.classList.contains("specSingleRow");
      if(!CHAR.specChoices)CHAR.specChoices={};"""
        new = """      var isSingle=t.parentNode.classList.contains("specSingleRow");
      var isMulti=t.parentNode.classList.contains("specMultiRow");
      if(!CHAR.specChoices)CHAR.specChoices={};
      if(isMulti){
        var _grp=t.parentNode;
        var _need=parseInt(_grp.getAttribute("data-multi"),10)||1;
        var _list=(CHAR.specChoices[sn]&&CHAR.specChoices[sn].skills)?CHAR.specChoices[sn].skills.slice():[];
        var _val=t.getAttribute("data-skill");
        var _idx=_list.indexOf(_val);
        if(_idx>=0)_list.splice(_idx,1);
        else{if(_list.length>=_need)_list.shift();_list.push(_val);}
        CHAR.specChoices[sn]={skills:_list.slice()};
        var _btns=_grp.querySelectorAll(".spec-skill");
        for(var _bi=0;_bi<_btns.length;_bi++){
          if(_list.indexOf(_btns[_bi].getAttribute("data-skill"))>=0)_btns[_bi].classList.add("selected");
          else _btns[_bi].classList.remove("selected");
        }
        var _hint=_grp.parentNode.querySelector(".specMultiHint");
        if(_hint)_hint.innerHTML="已选 <b>"+_list.length+"</b>/"+_need+"（需 "+_need+" 项不同）";
        checkSpecDone();return;
      }"""
        assert old in text
        text = text.replace(old, new, 1)

    # 5) checkSpecDone：multi 校验
    if 'pc.multi' not in text.split('function checkSpecDone')[1][:1200]:
        old = """      var ch=CHAR.specChoices?CHAR.specChoices[sn]:null;
      if(!ch||!ch.skill){allDone=false;break;}"""
        new = """      var ch=CHAR.specChoices?CHAR.specChoices[sn]:null;
      if(pc.multi){var _arr=(ch&&ch.skills)||[];if(_arr.length!==pc.multi){allDone=false;break;}continue;}
      if(!ch||!ch.skill){allDone=false;break;}"""
        assert old in text
        text = text.replace(old, new, 1)

    # 6) 总览熟练项：multi 的每项都列出
    if "ch.skills" not in text.split('var profLines = [];')[1][:1600]:
        old = """    for (var sn in CHAR.specChoices) {
      var ch = CHAR.specChoices[sn];
      if (ch && ch.skill) profLines.push({ name: ch.skill, src: '专精' });
    }"""
        new = """    for (var sn in CHAR.specChoices) {
      var ch = CHAR.specChoices[sn];
      if (ch && ch.skills && ch.skills.length) {
        for (var _mi = 0; _mi < ch.skills.length; _mi++) profLines.push({ name: ch.skills[_mi], src: '专长' });
      } else if (ch && ch.skill) profLines.push({ name: ch.skill, src: '专精' });
    }"""
        assert old in text
        text = text.replace(old, new, 1)

    # 7) 导出：applySpecProfs 支持多项
    if 'ch.skills' not in text.split('function applySpecProfs')[1][:900]:
        old = """    for(var sn in CHAR.specChoices){
      var ch=CHAR.specChoices[sn];
      if(!ch||!ch.skill)continue;"""
        new = """    for(var sn in CHAR.specChoices){
      var ch=CHAR.specChoices[sn];
      if(ch&&ch.skills&&ch.skills.length){
        for(var _si3=0;_si3<ch.skills.length;_si3++){
          if(typeof applyResolvedProf==="function")applyResolvedProf(charData.profs,ch.skills[_si3],"");
        }
        continue;
      }
      if(!ch||!ch.skill)continue;"""
        assert old in text
        text = text.replace(old, new, 1)

    # 8) class_features 描述：博闻强识显示已选两项
    if '_cfName==="博闻强识"' not in text:
        old = """    }else if((_cfName==="奥法学者"||_cfName==="知识传承"||_cfName==="万用模组")&&CHAR.specChoices&&CHAR.specChoices[_cfName]&&CHAR.specChoices[_cfName].skill){
      _cfDesc=CHAR.specChoices[_cfName].skill;"""
        new = """    }else if(_cfName==="博闻强识"&&CHAR.specChoices&&CHAR.specChoices["博闻强识"]&&(CHAR.specChoices["博闻强识"].skills||[]).length){
      _cfDesc="知识熟练度："+CHAR.specChoices["博闻强识"].skills.join("、");
    }else if((_cfName==="奥法学者"||_cfName==="知识传承"||_cfName==="万用模组")&&CHAR.specChoices&&CHAR.specChoices[_cfName]&&CHAR.specChoices[_cfName].skill){
      _cfDesc=CHAR.specChoices[_cfName].skill;"""
        assert old in text
        text = text.replace(old, new, 1)
    return text


def patch_upload(text: str) -> str:
    if '博闻强识' not in text:
        old = """    else if(_cfn.indexOf("万用模组")>=0){s.classChoices.specChoices["万用模组"]={attr:"",skill:_cfd.trim()};}"""
        new = old + """
    else if(_cfn.indexOf("博闻强识")>=0){
      var _mbs=String(_cfd||"").replace(/^知识熟练度[:：]\\s*/,"").split(/[、,，]/).map(function(x){return x.trim();}).filter(Boolean);
      s.classChoices.specChoices["博闻强识"]={skills:_mbs};
    }"""
        assert old in text
        text = text.replace(old, new, 1)
    return text


def patch_engine(text: str) -> str:
    if '博闻强识' not in text:
        old = """    } else if (fcls === "法师" && fname.indexOf("奥法学者") >= 0 && sc["奥法学者"] && sc["奥法学者"].skill) {"""
        new = """    } else if (fname.indexOf("博闻强识") >= 0 && sc["博闻强识"] && (sc["博闻强识"].skills || []).length) {
      fdesc = (sc["博闻强识"].skills || []).join("、");
    } else if (fcls === "法师" && fname.indexOf("奥法学者") >= 0 && sc["奥法学者"] && sc["奥法学者"].skill) {"""
        assert old in text
        text = text.replace(old, new, 1)
    return text


def patch_prof(text: str) -> str:
    """overviewNamesFromSpecChoices 支持 skills 多选（博闻强识）。"""
    if 'ch.skills && ch.skills.length' in text:
        return text
    old = """    var ch = specChoices[sn];
    if (!ch || !ch.skill) continue;
    var r = resolveProfSkill(ch.skill);
    out.push((r && r.key) ? r.key : ch.skill);"""
    new = """    var ch = specChoices[sn];
    if (!ch) continue;
    if (ch.skills && ch.skills.length) {
      for (var i = 0; i < ch.skills.length; i++) {
        var rm = resolveProfSkill(ch.skills[i]);
        out.push((rm && rm.key) ? rm.key : ch.skills[i]);
      }
      continue;
    }
    if (!ch.skill) continue;
    var r = resolveProfSkill(ch.skill);
    out.push((r && r.key) ? r.key : ch.skill);"""
    assert old in text, 'chargen_prof 未匹配'
    return text.replace(old, new, 1)


def patch_ref_classes(text: str) -> str:
    m = re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", text, re.S)
    if not m:
        raise SystemExit('未找到 REF_CLASSES')
    ref = json.loads(m.group(1).replace("\\'", "'"))
    ms = ref.get('谋士') or {}
    cur = [s.get('name') for s in (ms.get('specializations') or [])]
    if cur == [f['n'] for f in FEATURES]:
        return text
    ms['specializations'] = [{'name': f['n'], 'desc': f['d']} for f in FEATURES]
    body = json.dumps(ref, ensure_ascii=False).replace("'", "\\'")
    return re.sub(r"const REF_CLASSES = JSON\.parse\('.*?'\);",
                  "const REF_CLASSES = JSON.parse('%s');" % body, text, count=1, flags=re.S)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    chg = CHARGEN.read_text(encoding='utf-8')
    reg = json.loads(REGISTRY.read_text(encoding='utf-8'))
    eng = ENGINE.read_text(encoding='utf-8')

    checks = {
        'CLASS_SPECIALIZATIONS.谋士=3专长': '"谋士":[{n:"运筹帷幄"' in chg,
        'SPEC_PROF_CHOICES.谋士.multi': '"谋士":{"博闻强识":{multi:2' in chg,
        'multi UI/校验/导出': all(k in chg for k in ('specMultiRow', 'isMulti', 'pc.multi', 'ch.skills')),
        'class_features 描述': '_cfName==="博闻强识"' in chg,
        '上传角色导入': '博闻强识' in UPLOAD.read_text(encoding='utf-8'),
        '面板描述': '博闻强识' in eng,
        '概览支持多选': 'ch.skills && ch.skills.length' in PROF.read_text(encoding='utf-8'),
        'REF_CLASSES 专长=3': [s.get('name') for s in (json.loads(re.search(r"const REF_CLASSES = JSON\.parse\('(.*?)'\);", PANEL.read_text(encoding='utf-8'), re.S).group(1).replace("\\'", "'")).get('谋士', {}).get('specializations') or [])] == [f['n'] for f in FEATURES],
        'advisor specProfChoices=3专长': reg['classes'].get('谋士', {}).get('specProfChoices') == [f['n'] for f in FEATURES],
    }
    for k, v in checks.items():
        print('%-34s %s' % (k, 'OK' if v else '缺失'))
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

    up = UPLOAD.read_text(encoding='utf-8')
    new_up = patch_upload(up)
    UPLOAD.write_text(new_up, encoding='utf-8', newline='')
    if UPLOAD_MIRROR.exists():
        UPLOAD_MIRROR.write_text(new_up, encoding='utf-8', newline='')

    pan = PANEL.read_text(encoding='utf-8')
    new_pan = patch_ref_classes(pan)
    PANEL.write_text(new_pan, encoding='utf-8', newline='')
    if PANEL_MIRROR.exists():
        shutil.copyfile(PANEL, PANEL_MIRROR)

    prof = PROF.read_text(encoding='utf-8')
    new_prof = patch_prof(prof)
    if new_prof != prof:
        PROF.write_text(new_prof, encoding='utf-8', newline='')
        if PROF_MIRROR.exists():
            PROF_MIRROR.write_text(new_prof, encoding='utf-8', newline='')

    new_eng = patch_engine(eng)
    ENGINE.write_text(new_eng, encoding='utf-8', newline='')
    if ENGINE_MIRROR.exists():
        shutil.copyfile(ENGINE, ENGINE_MIRROR)

    if reg['classes'].get('谋士', {}).get('specProfChoices') != [f['n'] for f in FEATURES]:
        reg['classes']['谋士']['specProfChoices'] = [f['n'] for f in FEATURES]
        REGISTRY.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('✅ 谋士职业专长/博闻强识选择已修复')
    return 0


if __name__ == '__main__':
    sys.exit(main())
