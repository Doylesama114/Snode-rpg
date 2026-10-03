/* Import edits preserve identity and never invoke learning/reward actions. */
function characterImportRefresh(s) {
  if(typeof autoCorrect==="function"){var result=autoCorrect(s);if(typeof _lastCorrections!=="undefined")_lastCorrections=result;}
  var host=document.getElementById("importIssuesHost");if(host&&typeof renderIssuesTable==="function")host.innerHTML=renderIssuesTable(s);
  if(typeof SB_reinit==="function")SB_reinit();
  if(typeof renderSkillTables==="function")renderSkillTables();
  if(typeof renderTalent==="function")renderTalent();
  if(typeof renderBlueprints==="function")renderBlueprints();
  if(typeof saveState==="function"&&typeof state!=="undefined"&&s===state){state._dirty=true;saveState();}
  renderCharacterImportIssues(s);renderCharacterImportExtras(s);
}
function characterImportDialog(title) {
  var old=document.getElementById("characterIssueDialog");if(old)old.remove();
  var overlay=document.createElement("div");overlay.id="characterIssueDialog";overlay.style.cssText="position:fixed;inset:0;z-index:20000;background:#0009;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box";
  var box=document.createElement("section");box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label",title);box.style.cssText="background:var(--sb-panel,#fffdf8);color:var(--sb-ink,#252b26);padding:18px;border-radius:10px;width:100%;max-width:640px;max-height:85vh;overflow:auto;box-sizing:border-box;overflow-wrap:anywhere";
  function node(tag,text){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  function input(label,value,tag){var wrap=node("label",label+" ");wrap.style.display="block";var control=node(tag||"input");control.setAttribute("aria-label",label);control.value=value==null?"":String(value);control.style.cssText="display:block;width:100%;box-sizing:border-box;margin:4px 0 10px";if(tag==="textarea")control.rows=4;wrap.appendChild(control);box.appendChild(wrap);return control;}
  function select(label,options,value){var wrap=node("label",label+" ");wrap.style.display="block";var control=node("select");control.setAttribute("aria-label",label);control.style.cssText="max-width:100%;margin:4px 8px 8px 0";options.forEach(function(p){var o=node("option",p[1]);o.value=p[0];control.appendChild(o);});control.value=value;wrap.appendChild(control);box.appendChild(wrap);return control;}
  var focused=document.activeElement;
  function close(){document.removeEventListener("keydown",key,true);overlay.remove();if(focused&&focused.focus)focused.focus();}
  function key(e){
    if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();close();}
    if(e.key==="Tab"){
      var all=Array.prototype.slice.call(box.querySelectorAll("button,input,select,textarea")).filter(function(n){return !n.disabled&&n.offsetParent!==null;}),i=all.indexOf(document.activeElement);
      if(all.length&&e.shiftKey&&i===0){e.preventDefault();all[all.length-1].focus();}
      else if(all.length&&!e.shiftKey&&i===all.length-1){e.preventDefault();all[0].focus();}
    }
  }
  box.appendChild(node("h3",title));document.addEventListener("keydown",key,true);overlay.onclick=function(e){if(e.target===overlay)close();};
  overlay.appendChild(box);document.body.appendChild(overlay);
  return {box:box,node:node,input:input,select:select,close:close};
}
function openIssueResolver(uid,targetState) {
  var s=targetState||(typeof pendingState!=="undefined"?pendingState:null)||(typeof state!=="undefined"?state:null);
  if(!s)return;var io=SNOWD_CHARACTER_IO,entry=io.entries(s).find(function(e){return e.uid===uid;});if(!entry)return;
  var d=characterImportDialog("确认能力："+(entry.n||entry.name||"")),box=d.box,node=d.node;
  box.appendChild(node("p","可关联规则、保留额外能力、暂缓确认或重新分类。保存不会重复发放奖励。"));
  if(entry.provenance)box.appendChild(node("p","原始位置："+entry.provenance.sheet+" · "+(entry.provenance.fields.name||entry.cellRef)));
  var search=d.input("搜索技能名称",entry.resolution==="variant"&&entry.baseDefinition?entry.baseDefinition.name:entry.n||entry.name||"");search.type="search";
  var select=d.select("技能候选",[],"");select.size=7;select.style.cssText="display:block;width:100%;box-sizing:border-box;margin-bottom:10px";
  var choices=[],initial=true;
  function fill(){
    var previousMode=select.value,exact=io.candidates(search.value.trim());choices=exact.length?exact:io.search(search.value.trim());select.textContent="";
    [["","保留原文，暂不确认"],["__custom","确认为技能库外的额外能力"],["__exclude","排除此条目，保留排除记录"]].forEach(function(p){var o=node("option",p[1]);o.value=p[0];select.appendChild(o);});
    choices.forEach(function(c,i){var o=node("option",c.name+" · "+c.cls+" · "+(c.style||c.kind||"")+" · "+(c.isStarting?"起始特性":c.tier||""));o.value=String(i);select.appendChild(o);});
    var match=choices.findIndex(function(c){return c.cls===entry.src&&c.id===entry.id;});
    select.value=(initial&&io.isCustom(entry))||previousMode==="__custom"?"__custom":previousMode==="__exclude"?"__exclude":match>=0?String(match):"";initial=false;
  }
  search.oninput=fill;fill();
  var variant=d.node("input");variant.type="checkbox";variant.checked=entry.resolution==="variant";var variantLabel=d.node("label","保留名称及玩家参数，作为基础规则的强化版本 ");variantLabel.appendChild(variant);box.appendChild(variantLabel);
  var place=d.select("所在栏位",[["main","主职业技能栏"],["sub","子职业技能栏"],["talent","天赋栏"],["blueprint","图纸与配方栏"]],entry.place||(s.talent_tree.indexOf(entry)>=0?"talent":"main"));
  var origin=d.select("获得途径类型",[["advancement","进阶职业"],["class-gift","附赠职业"],["dm","主持人或剧情授予"],["feat","特殊专长"],["background","背景"],["equipment","装备"],["learned","学习"],["custom","其他或自定义"]],entry.origin?entry.origin.type:io.isCustom(entry)?"dm":"learned");
  var via=d.input("获取途径",entry.via||entry.grantedBy||"");via.placeholder="例如主持人授予、特殊专长名称";
  var slotMode=d.select("槽位状态",[["known","已确认槽位规则"],["unknown","槽位规则待确认"]],entry.occupies===null?"unknown":"known");
  var freeMode=d.select("获得费用状态",[["known","已确认获得费用"],["unknown","获得费用待确认"]],entry.free===null?"unknown":"known");
  var free=node("input");free.type="checkbox";free.checked=entry.free===undefined?!!entry.freeSlot:!!entry.free;
  var occupies=node("input");occupies.type="checkbox";occupies.checked=entry.occupies===undefined?!entry.freeSlot:entry.occupies===true;
  [[free,"免费获得"],[occupies,"占用栏位"]].forEach(function(p){var label=node("label");label.style.cssText="display:inline-block;margin:0 14px 10px 0";label.appendChild(p[0]);label.appendChild(document.createTextNode(p[1]));box.appendChild(label);});
  function syncModes(){occupies.disabled=slotMode.value==="unknown";free.disabled=freeMode.value==="unknown";}
  slotMode.onchange=freeMode.onchange=syncModes;syncModes();
  select.onchange=function(){if(select.value==="__custom"&&!io.isCustom(entry)){slotMode.value="unknown";freeMode.value="unknown";origin.value="dm";syncModes();}};
  var name=d.input("能力名称",entry.n||entry.name||""),tier=d.input("阶位（可不填）",entry.tier||""),growth=d.input("成长规则（可不填）",entry.growthBy||"");
  var owner=d.select("能力归属职业栏",[["0","主职业"],["1","子职业"],["2","附赠职业"]],String(entry.ownerClassIndex===undefined?(entry.place==="sub"?1:0):entry.ownerClassIndex));
  var controls={};[["tm","施展时间"],["range","施展距离"],["dur","持续时间"],["dr","疲劳消耗"]].forEach(function(p){controls[p[0]]=d.input(p[1],entry[p[0]]);});
  controls.ds=d.input("完整效果与说明",entry.ds||entry.rawDesc||entry.note||"","textarea");
  var summons=d.input("召唤物补充说明",entry.summonNotes||"","textarea");
  var status=node("p");status.setAttribute("role","status");box.appendChild(status);
  var buttons=node("div");buttons.style.cssText="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap";
  var cancel=node("button","取消"),save=node("button","保存");cancel.type=save.type="button";cancel.onclick=d.close;
  save.onclick=function(){
    if(!name.value.trim()){status.textContent="请填写能力名称。";return;}
    if(place.value==="sub"&&!(s.classes&&s.classes[1]&&s.classes[1].name)){status.textContent="请先填写子职业，或选择其他栏位。";return;}
    if(!["","__custom","__exclude"].includes(select.value)&&!choices[Number(select.value)]){status.textContent="请重新选择候选。";return;}
    var previousName=entry.n,previousDr=entry.dr;
    entry.fieldEdits=entry.fieldEdits||{};Object.keys(controls).forEach(function(k){if(String(entry[k]||"")!==controls[k].value)entry.fieldEdits[k]=true;});if(select.value!=="")entry.fieldEdits.src=true;
    entry.n=name.value.trim();if(entry.name!==undefined)entry.name=entry.n;
    entry.tier=tier.value.trim();entry.growthBy=growth.value.trim();Object.keys(controls).forEach(function(k){entry[k]=controls[k].value;});
    if(entry.dr!==previousDr){entry.cost=entry.dr;delete entry.fp;}
    entry.summonNotes=summons.value;entry.via=via.value.trim();entry.grantedBy=entry.via;
    ["skills","talent_tree","blueprints"].forEach(function(k){s[k]=(s[k]||[]).filter(function(e){return e!==entry;});});
    io.removeResolutionIssues(s,entry.uid);
    if(select.value==="__exclude"){
      s.importExcluded=s.importExcluded||[];s.importExcluded.push(entry);entry.excluded=true;entry.exclusionReason="玩家明确排除";
    }else{
      entry.place=place.value;entry.ownerClassIndex=entry.place==="sub"?1:Number(owner.value);entry.sub=entry.place==="sub"?s.classes[1].name:"";
      if(entry.place!=="talent")delete entry.cls;
      entry.free=freeMode.value==="unknown"?null:free.checked;entry.occupies=slotMode.value==="unknown"?null:occupies.checked;entry.freeSlot=entry.occupies===false;
      if(select.value==="__custom")io.confirmCustom(entry,{originType:origin.value,via:entry.via||origin.options[origin.selectedIndex].textContent,free:entry.free,occupies:entry.occupies,growthBy:entry.growthBy});
      else if(select.value===""){
        if(previousName!==entry.n){delete entry.id;delete entry.skillId;delete entry.catalogTier;}
        entry.resolution="deferred";entry.resolutionConfirmed=false;entry.resolutionFingerprint=io.fingerprint(entry);
      }else{
        var c=choices[Number(select.value)];if(!c){status.textContent="请重新选择候选。";return;}
        if(variant.checked){entry.baseDefinition={name:c.name,src:c.cls,id:c.id};entry.resolution="variant";}else{entry.n=c.name;delete entry.baseDefinition;entry.resolution="catalog";}
        entry.src=c.cls;entry.id=c.id;entry.kind=c.kind;entry.catalogTier=c.tier;entry.st=c.style;entry.resolutionConfirmed=true;
        if(!entry.tier&&entry.place!=="blueprint")entry.tier=c.tier;
        entry.origin={type:origin.value,label:entry.via};if(entry.place==="talent")entry.cls=entry.src;
      }
      if(entry.place==="blueprint")entry.note=entry.ds;
      (entry.place==="talent"?s.talent_tree:entry.place==="blueprint"?s.blueprints:s.skills).push(entry);
    }
    d.close();characterImportRefresh(s);
  };
  buttons.appendChild(cancel);buttons.appendChild(save);box.appendChild(buttons);search.focus();
}
function renderCharacterImportIssues(s) {
  var host=document.getElementById("panelImportIssues");if(!host||!s)return;host.textContent="";
  var io=SNOWD_CHARACTER_IO,issues=(Array.isArray(s.importIssues)?s.importIssues:[]).filter(function(i){
    var entry=io.entries(s).find(function(e){return e.uid===i.uid;});
    return !(entry&&(io.isCustom(entry)||io.isDeferred(entry))&&["ambiguous","unmatched","typo-candidate","source-mismatch"].indexOf(i.kind)>=0)&&["ambiguous","unmatched","typo-candidate","source-mismatch","catalog-changed","slot-pending","field-unmapped","field-invalid","field-cleared","mapping-conflict","metadata-invalid","metadata-unsupported","metadata-ambiguous"].indexOf(i.kind)>=0;
  });
  io.entries(s).filter(function(e){return e.occupies===null&&!issues.some(function(i){return i.uid===e.uid&&i.kind==="slot-pending";});}).forEach(function(e){issues.push({uid:e.uid,name:e.n,kind:"slot-pending",note:"能力已保留，槽位规则待确认。"});});
  var editable=io.entries(s).filter(function(e){return io.isCustom(e)||io.isDeferred(e);});
  if(!issues.length&&!editable.length){host.style.display="none";return;}host.style.display="block";
  var title=document.createElement("summary");title.textContent="导入待确认："+issues.length+" 项 · 额外或暂缓确认能力 "+editable.length+" 项";host.appendChild(title);
  function row(entry,note){var p=document.createElement("p");p.textContent=(entry.n||entry.name||"工作簿")+"："+note+" ";if(entry.uid){var b=document.createElement("button");b.type="button";b.textContent="编辑";b.onclick=function(){openIssueResolver(entry.uid,s);};p.appendChild(b);}host.appendChild(p);}
  issues.forEach(function(i){row(i,i.note||"规则来源待确认");});
  editable.filter(function(e){return !issues.some(function(i){return i.uid===e.uid;});}).forEach(function(e){row(e,io.isCustom(e)?"额外能力已确认":"原文已保留，规则暂未确认");});
}
if(typeof document!=="undefined")document.addEventListener("DOMContentLoaded",function(){if(typeof state!=="undefined")renderCharacterImportIssues(state);});

function rebuildImportLayout(s,parsed){
  var previous=SNOWD_CHARACTER_IO.entries(s),excluded=s.importExcluded||[],fresh=buildState(parsed);
  ["skills","talent_tree","blueprints"].forEach(function(k){
    s[k]=(fresh[k]||[]).filter(function(e){return !excluded.some(function(old){return old.cellRef===e.cellRef&&old.original&&old.original.name===e.n;});}).map(function(e){
      var old=previous.find(function(p){return p.cellRef===e.cellRef&&(p.n===e.n||(p.original&&p.original.name===e.n));});
      if(!old)return e;
      var oldVisible=old._visible||{},incoming=e._visible||{};
      ["tm","range","dur","dr","ds","src"].forEach(function(k){var current=old[k]==null?"":String(old[k]),before=oldVisible[k]==null?"":String(oldVisible[k]);if(current===before||current===""||(k==="src"&&!(old.fieldEdits&&old.fieldEdits.src))){old[k]=e[k];if(old.original)old.original[k]=incoming[k]||"";}else if(current!==String(e[k]||"")){s.importIssues=s.importIssues||[];s.importIssues.push({kind:"mapping-conflict",uid:old.uid,name:old.n,note:"新映射读到了不同的"+k+"，保留玩家已编辑内容。"});}});
      old.place=e.place;old.sub=e.sub;old.provenance=e.provenance;old._visible=e._visible;old.mergedNotes=e.mergedNotes||old.mergedNotes;old.ownerClassIndex=e.ownerClassIndex;return old;
    });
  });
  s._abilitySections=fresh._abilitySections;s._importLayoutIssues=fresh._importLayoutIssues;s.importLayoutMappings=parsed.layoutMappings||[];
  s.importIssues=(s.importIssues||[]).filter(function(i){return i.kind!=="layout-unrecognized";}).concat(fresh._importLayoutIssues||[]);
  characterImportRefresh(s);
}
function openLayoutResolver(targetState){
  var s=targetState||(typeof pendingState!=="undefined"?pendingState:null),parsed=typeof pendingParsed!=="undefined"?pendingParsed:null;
  if(!s||!parsed)return;
  var d=characterImportDialog("映射区块或补充字段"),box=d.box,node=d.node,g=SNOWD_CHARACTER_LAYOUT.grid(parsed);
  box.appendChild(node("p","先预览原始单元格，再选择数据范围和各列。已识别能力的确认设置会保留。"));
  var profiles=[];try{profiles=JSON.parse(localStorage.getItem("SNODE_IMPORT_LAYOUT_PROFILES_V1")||"[]");if(!Array.isArray(profiles))profiles=[];profiles=profiles.filter(function(p){return p&&typeof p.name==="string"&&p.mapping&&typeof p.mapping.range==="string"&&p.mapping.fields;});}catch(e){}
  var profile=d.select("个人导入方案",[["","新方案"]].concat(profiles.map(function(p,i){return [String(i),p.name];})),"");
  var range=d.input("数据范围（不含表头）","");range.placeholder="例如 B123:M140";
  var place=d.select("区块类型",[["main","主职业或额外技能"],["sub","子职业技能"],["talent","天赋"],["blueprint","图纸与配方"]],"main");
  var tier=d.input("区块阶位（可不填）","");
  var owner=d.select("映射能力归属职业栏",[["0","主职业"],["1","子职业"],["2","附赠职业"]],"0");
  var columns=[["","不读取"]];for(var col=0;col<=Math.min(100,Math.max(25,g.maxCol));col++){var label=SNOWD_CHARACTER_LAYOUT.ref(col,1).replace("1","");columns.push([label,label]);}
  var controls={},labels={name:"名称列",tm:"施展时间列",range:"距离列",dur:"持续时间列",dr:"消耗列",src:"来源列",ds:"说明列"};
  Object.keys(labels).forEach(function(k){controls[k]=d.select(labels[k],columns,k==="name"?"B":"");});
  var preview=node("pre");preview.style.cssText="font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto";box.appendChild(preview);
  var previewButton=node("button","预览区块");previewButton.type="button";box.appendChild(previewButton);
  function mapping(){var fields={};Object.keys(controls).forEach(function(k){if(controls[k].value)fields[k]=controls[k].value;});return {sheet:parsed.sheetName,range:range.value.toUpperCase().trim(),fields:fields,place:place.value,tier:tier.value.trim(),ownerClassIndex:place.value==="sub"?1:Number(owner.value)};}
  previewButton.onclick=function(){
    try{var m=mapping(),section=SNOWD_CHARACTER_LAYOUT.mappingSection(g,m,parsed.sheetName),lines=[];for(var r=section.start;r<Math.min(section.end,section.start+12);r++)lines.push(Object.keys(section.fields).map(function(k){var ref=SNOWD_CHARACTER_LAYOUT.ref(section.fields[k],r);return labels[k]+" "+ref+"="+g.value(section.fields[k],r);}).join(" | "));preview.textContent=lines.join("\n")||"该范围没有填写内容。";}catch(e){preview.textContent=e.message;}
  };
  profile.onchange=function(){var p=profiles[Number(profile.value)];if(profile.value===""||!p)return;var m=p.mapping;range.value=m.range;place.value=m.place;tier.value=m.tier||"";Object.keys(controls).forEach(function(k){controls[k].value=m.fields[k]||"";});previewButton.onclick();if(m.signature&&SNOWD_CHARACTER_LAYOUT.mappingSignature(parsed,m)!==m.signature)preview.textContent="表头结构已经变化，请重新核对范围和列后保存。\n"+preview.textContent;};
  var exclusions=[];
  (s._importLayoutIssues||[]).forEach(function(issue){
    var check=node("input");check.type="checkbox";var label=node("label",issue.note+" ");label.style.display="block";label.appendChild(check);label.appendChild(document.createTextNode("明确暂不导入此区块"));box.appendChild(label);exclusions.push({issue:issue,control:check});
  });
  var basic={name:d.input("角色名称",s.name),race:d.input("种族",s.race),className:d.input("主职业",s.classes[0].name),level:d.input("主职业等级",s.classes[0].level),keyAttr:d.input("关键属性",s.classes[0].keyAttr||"")};
  var currencyInputs={};["金币","银币","铜币"].forEach(function(k){currencyInputs[k]=d.input(k+"原始单元格","");currencyInputs[k].placeholder="例如 O36；留空则保留当前值";});
  var fields=s.unmappedFields||[];if(fields.length)box.appendChild(node("p","未分类原始值："+fields.map(function(f){return (f.values||[]).map(function(v){return v.cellRef+"="+v.value;}).join("，");}).join("；")));
  var profileName=d.input("方案名称（填写后保存区块映射）","");
  var status=node("p");status.setAttribute("role","status");box.appendChild(status);
  var cancel=node("button","取消"),save=node("button","保存映射与字段");cancel.type=save.type="button";cancel.onclick=d.close;
  save.onclick=function(){
    try{
      var m=null,rebuilt=Object.assign({},parsed),currencyChanges=[],chosen=exclusions.filter(function(x){return x.control.checked;});
      if(range.value.trim()){m=mapping();SNOWD_CHARACTER_LAYOUT.mappingSection(g,m,parsed.sheetName);m.signature=SNOWD_CHARACTER_LAYOUT.mappingSignature(parsed,m);rebuilt.layoutMappings=(parsed.layoutMappings||[]).filter(function(old){return old.range!==m.range;}).concat([m]);}
      Object.keys(currencyInputs).forEach(function(k){
        var ref=currencyInputs[k].value.toUpperCase().trim();if(!ref)return;if(!SNOWD_CHARACTER_LAYOUT.point(ref))throw Error("货币单元格无效："+ref);
        var original=fields.reduce(function(out,f){return out.concat(f.values||[]);},[]).find(function(v){return v.cellRef===ref;});
        var raw=original?original.value:parsed.cells[ref];if(raw===undefined||raw===""||!Number.isFinite(Number(raw)))throw Error(ref+" 不是有效数值");
        currencyChanges.push({field:k,cellRef:ref,value:Number(raw),labelRef:fields[0]&&fields[0].cellRef||"",sheet:parsed.sheetName});
      });
      if(!basic.name.value.trim()||!basic.race.value.trim()||!basic.className.value.trim())throw Error("请填写角色名称、种族和主职业。");
      var level=Number(basic.level.value);if(!Number.isInteger(level)||level<1||level>20)throw Error("职业等级须为 1 至 20 的整数。");
      if(basic.keyAttr.value&&!/^(?:力量|敏捷|体质|智力|感知|魅力|意志|幸运)$/.test(basic.keyAttr.value))throw Error("关键属性须填写八项属性之一，或留空。");
      rebuilt.ignoredLayoutRegions=(parsed.ignoredLayoutRegions||[]).concat(chosen.map(function(x){return x.issue.cellRef;}));
      if(m||chosen.length)rebuildImportLayout(s,rebuilt);
      s.name=basic.name.value.trim();s.race=basic.race.value.trim();s.classes[0].name=basic.className.value.trim();s.classes[0].level=level;s.classes[0].keyAttr=basic.keyAttr.value.trim();
      chosen.forEach(function(x){s.importExcluded=s.importExcluded||[];if(!s.importExcluded.some(function(e){return e.cellRef===x.issue.cellRef;}))s.importExcluded.push({cellRef:x.issue.cellRef,n:"未识别区块 "+x.issue.cellRef,note:x.issue.note,exclusionReason:"玩家明确暂不导入此区块",sheet:parsed.sheetName});});
      currencyChanges.forEach(function(c){
        s.currency[c.field]=c.value;s.importFieldMappings=(s.importFieldMappings||[]).filter(function(m){return m.field!==c.field;}).concat([c]);
        s.unmappedFields=(s.unmappedFields||[]).map(function(f){return Object.assign({},f,{values:(f.values||[]).filter(function(v){return v.cellRef!==c.cellRef;})});}).filter(function(f){return f.values.length;});
      });
      s.importIssues=(s.importIssues||[]).filter(function(i){return i.kind!=="field-unmapped";}).concat(s.unmappedFields||[]);
      if(m&&profileName.value.trim()){
        profiles=profiles.filter(function(p){return p.name!==profileName.value.trim();});profiles.push({name:profileName.value.trim(),mapping:m});try{localStorage.setItem("SNODE_IMPORT_LAYOUT_PROFILES_V1",JSON.stringify(profiles));}catch(e){status.textContent="字段已保存，但个人方案存储失败："+e.message;return;}
      }
      pendingParsed=rebuilt;d.close();characterImportRefresh(s);
    }catch(e){status.textContent=e.message;}
  };
  box.appendChild(cancel);box.appendChild(save);range.focus();
}
async function openImportSheetPicker(){
  if(typeof pendingParsed==="undefined"||!pendingParsed||typeof pendingState==="undefined"||!pendingState)return;
  var d=characterImportDialog("选择角色工作表"),options=(pendingParsed.sheetChoices||[]).map(function(s){return [s.path,s.name+(s.score?" · 识别到 "+s.score+" 项角色特征":" · 需要映射")];});
  var select=d.select("工作表",options,pendingParsed.sheetPath),status=d.node("p");d.box.appendChild(status);var save=d.node("button","使用此工作表");save.type="button";
  save.onclick=async function(){
    try{var buffer=pendingState._uploadedXlsxBuf;if(!buffer)throw Error("请先通过文件选择入口上传工作簿。");var parsed=await parseXLSX(buffer,{sheetPath:select.value}),s=buildState(parsed);autoCorrect(s);s._uploadedXlsxBuf=buffer;pendingState=s;d.close();showPreview(s,parsed);}catch(e){status.textContent=e.message;}
  };d.box.appendChild(save);select.focus();
}

function characterImportState(target){return target||(typeof pendingState!=="undefined"?pendingState:null)||(typeof state!=="undefined"?state:null);}
function openCombatStatResolver(target){
 var s=characterImportState(target);if(!s)return;var api=SNOWD_CHARACTER_STATS,r=api.read(s),d=characterImportDialog("战斗数值采用方式"),controls={};
 d.box.appendChild(d.node("p","填写值默认保留。采用规则值后才随已配置规则变化；当前生命和疲劳不会因打开面板而恢复。"));
 Object.keys(api.labels).forEach(function(k){
  var value=r[k],mode=r.fields[k].mode,select=d.select(api.labels[k]+"采用方式",[["fixed","保留填写值"],["rules","按规则计算"]],mode),input=d.input(api.labels[k]+"数值",value==null?"":value);
  if(k!=="speed")input.type="number";
  d.box.appendChild(d.node("p","规则参考："+(r.computed[k]==null?"暂不可计算":r.computed[k])));
  controls[k]={select:select,input:input,initialMode:mode,initialValue:input.value};
 });
 var scalarControls={};[["xp","经验值"],["sp_points","技能点"]].forEach(function(p){if((s.importIssues||[]).some(function(i){return i.field===p[0]&&i.kind==="field-invalid";})){var input=d.input(p[1]+"数值",s[p[0]]);input.type="number";scalarControls[p[0]]=input;}});
 var status=d.node("p");status.setAttribute("role","status");d.box.appendChild(status);
 var cancel=d.node("button","取消"),save=d.node("button","保存采用方式");cancel.type=save.type="button";cancel.onclick=d.close;
 save.onclick=function(){try{
  var changes=[];
  Object.keys(controls).forEach(function(k){var c=controls[k];if(c.select.value===c.initialMode&&c.input.value===c.initialValue&&!(s.importIssues||[]).some(function(i){return i.field===k&&["field-invalid","field-cleared"].indexOf(i.kind)>=0;}))return;
   var value=k==="speed"?c.input.value.trim():c.input.value.trim()===""?null:Number(c.input.value);
   if(c.select.value==="fixed"&&(value===null||value===""||(k!=="speed"&&!api.valid(value))||((k==="hp"||k==="fp")&&value<0)))throw Error("请填写有效的"+api.labels[k]);
   if(c.select.value==="rules"&&r.computed[k]==null&&!(k==="hpRecover"&&api.valid(r.hp))&&!(k==="fpRecover"&&api.valid(r.fp)))throw Error(api.labels[k]+"规则资料尚未完整，请保留填写值或先确认职业、种族及装备。");
   changes.push({key:k,value:value,mode:c.select.value});
  });
  Object.keys(scalarControls).forEach(function(k){var raw=scalarControls[k].value;if(raw.trim()===""||!Number.isFinite(Number(raw))||Number(raw)<0)throw Error("请填写有效的经验值或技能点");});
  Object.keys(scalarControls).forEach(function(k){s[k]=Number(scalarControls[k].value);});
  changes.forEach(function(c){api.set(s,c.key,c.value,c.mode,{origin:c.mode==="fixed"?"manual":"rules"});});
  s.importIssues=(s.importIssues||[]).filter(function(i){return !scalarControls[i.field]&&!changes.some(function(c){return i.field===c.key&&["field-invalid","field-cleared"].indexOf(i.kind)>=0;});});
  api.synchronize(s);d.close();characterImportRefresh(s);
 }catch(e){status.textContent=e.message;}};
 d.box.appendChild(cancel);d.box.appendChild(save);
}
function openClassResolver(target){
 var s=characterImportState(target);if(!s)return;var d=characterImportDialog("确认职业身份与规则基础"),controls=[],data=SNOWD_CHARACTER_CLASSES.data();
 d.box.appendChild(d.node("p","职业显示名和原等级分别保留。选择规则基础不会重新扣除进阶费用或发放奖励。"));
 (s.classes||[]).forEach(function(c,i){if(!c.name)return;
  d.box.appendChild(d.node("h4",["主职业","子职业","附赠职业"][i]+"："+c.name+" "+c.level+"级"));
  var level=d.input(["主职业","子职业","附赠职业"][i]+"等级",c.level);level.type="number";
  var name=d.input(["主职业","子职业","附赠职业"][i]+"显示名",c.name),id=SNOWD_CHARACTER_CLASSES.identify(c.name),candidates=id.kind==="advanced"?id.baseCandidates:data.base;
  var options=[["","规则基础待确认"],["__custom","自定义职业，暂不自动计算"]].concat(candidates.map(function(n){return [n,n];}));
  var base=d.select(["主职业","子职业","附赠职业"][i]+"规则基础",options,c.rulesDisabled?"__custom":SNOWD_CHARACTER_CLASSES.ruleName(c)||"");
  var meaning=null,total=null;
  if(i===1&&s.classes[0].name===c.name){
   meaning=d.select("同名职业记录含义",[["unconfirmed","尚未确认"],["independent","独立的第二职业记录"],["continuation","续写主职业等级记录"]],c.levelMeaning||"unconfirmed");
   total=d.input("确认后的主职业总等级",s.classes[0].confirmedTotalLevel||"");total.type="number";
  }
  controls.push({entry:c,index:i,level:level,name:name,base:base,meaning:meaning,total:total});
 });
 var races=typeof REF_RACES!=="undefined"?Object.keys(REF_RACES):[],backgrounds=typeof REF_BACKGROUNDS!=="undefined"?Object.keys(REF_BACKGROUNDS):[];
 var race=d.select("种族规则参考（保留原显示名）",[["","尚未确认"]].concat(races.map(function(n){return [n,n];})),s.ruleRace|| (races.indexOf(s.race)>=0?s.race:""));
 var bg=d.select("背景规则参考（保留原显示名）",[["","尚未确认"]].concat(backgrounds.map(function(n){return [n,n];})),s.ruleBackground||(backgrounds.indexOf(s.background)>=0?s.background:""));
 var status=d.node("p");status.setAttribute("role","status");d.box.appendChild(status);
 var cancel=d.node("button","取消"),save=d.node("button","保存职业确认");cancel.type=save.type="button";cancel.onclick=d.close;
 save.onclick=function(){try{
  controls.forEach(function(c){if(c.level.value.trim()===""||!Number.isInteger(Number(c.level.value))||Number(c.level.value)<(c.index===0?1:0))throw Error("请填写有效的职业等级");if(!c.name.value.trim())throw Error("请保留或填写职业显示名");var id=SNOWD_CHARACTER_CLASSES.identify(c.name.value.trim());if(c.base.value!=="__custom"&&id.kind==="advanced"&&c.base.value&&id.baseCandidates.indexOf(c.base.value)<0)throw Error("进阶基础职业不在允许列表内");if(c.meaning&&c.meaning.value==="continuation"&&(!Number.isInteger(Number(c.total.value))||Number(c.total.value)<1))throw Error("续写记录需要明确的总等级，不会自动相加。");});
  controls.forEach(function(c){
   c.entry.level=Number(c.level.value);c.entry.levelStatus="valid";c.entry.name=c.name.value.trim();c.entry.rulesDisabled=c.base.value==="__custom";
   if(c.entry.rulesDisabled){c.entry.baseClass="";c.entry.baseConfirmed=true;}else SNOWD_CHARACTER_CLASSES.confirm(c.entry,c.base.value,c.meaning&&c.meaning.value);
   if(c.meaning){c.entry.levelMeaning=c.meaning.value;if(c.meaning.value==="continuation"){s.classes[0].confirmedTotalLevel=Number(c.total.value);c.entry.ruleEnabled=false;}else{delete s.classes[0].confirmedTotalLevel;c.entry.ruleEnabled=true;}}
  });
  s.ruleRace=race.value;s.ruleBackground=bg.value;s.classIssues=SNOWD_CHARACTER_CLASSES.pending(s);
  d.close();characterImportRefresh(s);
 }catch(e){status.textContent=e.message;}};
 d.box.appendChild(cancel);d.box.appendChild(save);
}
function openMergedNoteResolver(uid,target){
 var s=characterImportState(target),e=s&&SNOWD_CHARACTER_IO.entries(s).find(function(e){return e.uid===uid;});if(!e)return;
 var d=characterImportDialog("确认跨列说明："+e.n),choices=[];
 (e.mergedNotes||[]).forEach(function(n){d.box.appendChild(d.node("p",n.range+"："+n.raw));var select=d.select("原文归属 "+n.range,[["ds","效果与说明"],["condition","施展条件补充"],["note","保留为跨列备注"]],n.target||n.suggestion||"ds");choices.push({note:n,control:select});});
 var save=d.node("button","保存原文归属");save.type="button";save.onclick=function(){choices.forEach(function(c){var n=c.note;n.target=c.control.value;n.status="confirmed";if(n.target==="ds"){if((e.ds||"").indexOf(n.raw)<0)e.ds=(e.ds?e.ds+"\n":"")+n.raw;}else if(n.target==="condition"){if((e.conditionNotes||"").indexOf(n.raw)<0)e.conditionNotes=(e.conditionNotes?e.conditionNotes+"\n":"")+n.raw;}});d.close();characterImportRefresh(s);};d.box.appendChild(save);
}
function openImportCandidateResolver(uid,target){
 var s=characterImportState(target),candidate=s&&(s.importCandidates||[]).find(function(c){return c.uid===uid;});if(!candidate)return;
 var d=characterImportDialog("确认未归属原文"),raw=d.node("pre",candidate.raw);raw.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere";d.box.appendChild(raw);
 var choice=d.select("原文用途",[["reference","仅保留原文说明"],["owned","确认为已拥有条目"],["excluded","明确排除，保留记录"]],candidate.status==="owned"?"owned":"reference"),selected=[];
 if(candidate.kind==="ability-list"||candidate.kind==="feat-options"){
  (candidate.items||[]).forEach(function(item){var existing=SNOWD_CHARACTER_IO.entries(s).find(function(e){return e.n===item.name;}),check=d.node("input");check.type="checkbox";check.checked=false;check.disabled=!!existing;var label=d.node("label",item.name+(existing?"（已经读入，不重复添加）":" "));label.style.display="block";label.appendChild(check);d.box.appendChild(label);selected.push({name:item.name,control:check});});
 }
 var type=d.select("条目类型",[["skill","技能或额外能力"],["talent","天赋"],["feat","特殊专长"]],candidate.kind==="feat"||candidate.kind==="feat-options"?"feat":"skill");
 var status=d.node("p");status.setAttribute("role","status");d.box.appendChild(status);
 var save=d.node("button","保存用途确认");save.type="button";
 save.onclick=function(){
  if(choice.value==="owned"){
   var names=candidate.kind==="ability-list"||candidate.kind==="feat-options"?selected.filter(function(c){return c.control.checked;}).map(function(c){return c.name;}):[candidate.name||candidate.raw];
   if(!names.length){status.textContent="请选择实际已拥有的条目，或保留为原文说明。";return;}
   if(candidate.kind==="feat-options"){s.special_feats=(s.special_feats||[]).filter(function(f){return f.name!==candidate.raw||f.cellRef!==candidate.cellRef;});}
   names.forEach(function(name){
    if(type.value==="feat"){s.special_feats=s.special_feats||[];if(!s.special_feats.some(function(f){return (f.name||f)===name;}))s.special_feats.push({name:name,level:null,uid:"feat-"+candidate.uid+(candidate.kind==="feat-options"?"-"+names.indexOf(name):""),sourceNote:{sheet:candidate.sheet,cellRef:candidate.cellRef},imported:true});}
    else if(!SNOWD_CHARACTER_IO.entries(s).some(function(e){return e.n===name;})){
     var e={n:name,src:"",uid:"extra-"+candidate.uid+"-"+Math.random().toString(36).slice(2,6),place:type.value==="talent"?"talent":"main",tier:"",ds:"原文："+candidate.raw,provenance:{sheet:candidate.sheet,fields:{name:candidate.cellRef}},original:{name:name,raw:candidate.raw}};
     SNOWD_CHARACTER_IO.confirmCustom(e,{originType:"custom",via:"玩家确认的额外记录"});(type.value==="talent"?s.talent_tree:s.skills).push(e);
    }
   });
  }else{s.importNotes=s.importNotes||[];if(!s.importNotes.some(function(n){return n.uid===candidate.uid;}))s.importNotes.push({uid:candidate.uid,raw:candidate.raw,cellRef:candidate.cellRef,sheet:candidate.sheet,kind:choice.value});}
  candidate.status=choice.value;d.close();characterImportRefresh(s);
 };d.box.appendChild(save);
}
function renderCharacterImportExtras(s){
 if(!s)return;var host=document.getElementById("characterImportExtras");
 if(!host){var anchor=document.getElementById("panelImportIssues")||document.getElementById("previewContent");if(!anchor)return;host=document.createElement("details");host.id="characterImportExtras";host.style.cssText="max-width:1100px;margin:12px auto;padding:12px;box-sizing:border-box;overflow-wrap:anywhere";anchor.insertAdjacentElement("afterend",host);}
 host.textContent="";var title=document.createElement("summary");title.textContent=(s.importDraft?"导入草稿 · ":"")+"职业、数值及原始补充资料";host.appendChild(title);
 function button(text,fn){var b=document.createElement("button");b.type="button";b.textContent=text;b.onclick=fn;host.appendChild(b);host.appendChild(document.createTextNode(" "));}
 button("确认职业身份",function(){openClassResolver(s);});button("战斗数值采用方式",function(){openCombatStatResolver(s);});
 SNOWD_CHARACTER_CLASSES.pending(s).forEach(function(i){var p=document.createElement("p");p.textContent=i.name+"："+i.note;host.appendChild(p);});
 SNOWD_CHARACTER_IO.entries(s).filter(function(e){return (e.mergedNotes||[]).length;}).forEach(function(e){var p=document.createElement("p");p.textContent=e.n+"：跨列原文 "+e.mergedNotes.map(function(n){return n.raw;}).join("；")+" ";var b=document.createElement("button");b.textContent="确认归属";b.onclick=function(){openMergedNoteResolver(e.uid,s);};p.appendChild(b);host.appendChild(p);});
 (s.importCandidates||[]).forEach(function(c){var p=document.createElement("p");p.textContent=(c.raw||c.name)+" · "+(c.status||"pending")+" ";var b=document.createElement("button");b.textContent="确认用途";b.onclick=function(){openImportCandidateResolver(c.uid,s);};p.appendChild(b);host.appendChild(p);});
 (s.special_feats||[]).filter(function(f){return f&&f.imported||f&&f.level===null;}).forEach(function(f){var p=document.createElement("p");p.textContent="额外专长："+f.name;host.appendChild(p);});
 Object.keys(s.equipment||{}).filter(function(k){return ["主手武器","副手武器","防具","配饰","背包","杂物包","旅行腰包","材料包"].indexOf(k)<0;}).forEach(function(k){var p=document.createElement("p");p.textContent="原装备分区 "+k+"："+s.equipment[k].map(function(e){return e.item+(e.desc?" · "+e.desc:"")+(e.rawWeight?" · "+e.rawWeight:"");}).join("；");host.appendChild(p);});
 (s.supportingSheets||[]).forEach(function(sheet){var detail=document.createElement("details"),summary=document.createElement("summary");summary.textContent="辅助表："+sheet.name+" · "+({"planning":"计划与进度","enemy":"敌人资料","people":"其他角色资料","class-reference":"职业说明","item-reference":"装备说明","reference":"参考资料"}[sheet.kind]||sheet.kind);detail.appendChild(summary);var pre=document.createElement("pre");pre.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px";pre.textContent=Object.keys(sheet.cells||{}).filter(function(k){return String(sheet.cells[k]).trim();}).map(function(k){return k+"："+sheet.cells[k];}).join("\n");detail.appendChild(pre);host.appendChild(detail);});
 (s.importNotes||[]).forEach(function(n){var p=document.createElement("p");p.textContent="原文说明："+n.raw;host.appendChild(p);});
}
if(typeof document!=="undefined")document.addEventListener("DOMContentLoaded",function(){if(typeof state!=="undefined")renderCharacterImportExtras(state);});
