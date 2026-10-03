/* Shared combat calculation and explicit value ownership. No DOM or state writes in read(). */
var SNOWD_CHARACTER_STATS=(function(){
 var labels={hp:"生命值",fp:"疲劳值",ac:"防御等级",atk:"攻击命中",spell:"法术命中",init:"先攻调整",speed:"基础速度",hpRecover:"生命回复",fpRecover:"疲劳回复"};
 function valid(v){return typeof v==="number"&&Number.isFinite(v);}
 function mod(v){return Math.floor((Number(v)-10)/2);}
 function hpBonus(v,size){if(typeof v==="number")return v;if(!v)return 0;var p=String(v).split("/");if(p.length===2)return Number(String(size||"").indexOf("小")>=0?p[0]:p[1])||0;var m=String(v).match(/[-+]?\d+/);return m?Number(m[0]):0;}
 function refs(){return {classes:typeof REF_CLASSES!=="undefined"?REF_CLASSES:{},races:typeof REF_RACES!=="undefined"?REF_RACES:{},backgrounds:typeof REF_BACKGROUNDS!=="undefined"?REF_BACKGROUNDS:{}};}
 function base(c){return typeof SNOWD_CHARACTER_CLASSES!=="undefined"?SNOWD_CHARACTER_CLASSES.ruleName(c):c&&c.name||"";}
 function totalHP(mc,ml,sc,sl,con,race,bg,fb,size){
  var d=refs();if(!mc||!ml||!d.classes[mc])return 0;var cm=mod(con),hd=d.classes[mc],f=hd.hp_formula.first,u=hd.hp_formula.level_up,r=d.races[race],b=d.backgrounds[bg];
  var value=f+cm+hpBonus(r&&r.hp_bonus,size||r&&r.size)+hpBonus(b&&b.hp_bonus,"")+(u+cm)*(ml-1);
  if(sc&&sl>0&&d.classes[sc])value+=(d.classes[sc].hp_formula.level_up+cm)*(sl-1);
  return Math.max(0,value+(Number(fb)||0));
 }
 function totalFP(mc,ml,sc,sl,ka,kv,race,fb){
  var d=refs();if(!mc||!ml||!d.classes[mc])return 0;var f=d.classes[mc].fp_formula,r=d.races[race];
  var value=f.first+mod(kv)+(Number(r&&r.fp_bonus)||0)+f.level_up*(ml-1);
  if(sc&&sl>0&&d.classes[sc])value+=d.classes[sc].fp_formula.level_up*(sl-1);
  return Math.max(0,value+(Number(fb)||0));
 }
 function name(item){return typeof item==="string"?item:item&&(item.item||item.name||item.n)||"";}
 function armorInfo(item){var n=name(item),map=typeof armorACMap!=="undefined"?armorACMap:{};if(map[n])return map[n];for(var k in map)if(n.indexOf(k)>=0)return map[k];if(["布衣","演出戏服","高档服装","披风"].indexOf(n)>=0)return {base:11,addDex:true,dexCap:2};return null;}
 function shield(s){var n=0;["防具","副手武器"].forEach(function(slot){(s.equipment&&s.equipment[slot]||[]).forEach(function(item){var nm=name(item);if(nm.indexOf("盾牌")<0)return;var text=typeof ITEM_DATA!=="undefined"&&ITEM_DATA[nm]&&ITEM_DATA[nm].description||"",m=text.match(/防御等级\+(\d+)/)||text.match(/防御等级：(\d+)/);if(m)n+=Number(m[1]);});});return n;}
 function armor(s){
  var dex=mod(s.attrs&&s.attrs["敏捷"]||10),result=null,missing=[],medium=false;
  (s.equipment&&s.equipment["防具"]||[]).concat(s.equipment&&s.equipment["服饰"]||[]).forEach(function(item){
   var a=armorInfo(item),nm=name(item);if(!a){if(nm&&nm.indexOf("盾")<0)missing.push(nm);return;}
   var v=a.base+(a.addDex?Math.min(dex,a.dexCap==null?999:a.dexCap):0);if(result===null||v>result)result=v;
   if(/兽皮甲|鳞甲|胸甲|半身板甲/.test(nm))medium=true;
  });
  return {value:(result===null?10+dex:result)+shield(s)+(medium?Number(s._feat_ac_bonus)||0:0),missing:missing};
 }
 function computed(s){
  var d=refs(),mc=s.classes&&s.classes[0]||{},sc=s.classes&&s.classes[1]||{},m=base(mc),sub=sc.ruleEnabled===false?"":base(sc),a=s.attrs||{},key=mc.keyAttr||d.classes[m]&&d.classes[m].key_attr||"力量",reasons=[];
  if(key==="力量或敏捷")key=mc.keyAttr&&mc.keyAttr!=="力量或敏捷"?mc.keyAttr:"力量";
  if(!d.classes[m])reasons.push("主职业规则基础未确认");if(!Number.isInteger(mc.level)||mc.level<1)reasons.push("主职业等级未确认");if(sc.name&&(sc.level===null||sc.levelStatus&&sc.levelStatus!=="valid"))reasons.push("子职业等级未确认");if(sc.name&&sc.ruleEnabled!==false&&!d.classes[sub])reasons.push("子职业规则基础未确认");if(sc.levelMeaning==="unconfirmed")reasons.push("同名职业记录含义未确认");
  var race=s.ruleRace||s.race,bg=s.ruleBackground||s.background;
  if(race&&!d.races[race])reasons.push("种族规则未确认");if(bg&&!d.backgrounds[bg])reasons.push("背景规则未确认");
  var effectiveMain=mc.confirmedTotalLevel||mc.level,effectiveSub=sc.ruleEnabled===false?0:sc.level;
  var feat=0;(s.special_feats||[]).forEach(function(f){var n=typeof f==="string"?f:f.name;if(n==="健壮")feat+=2*((Number(effectiveMain)||0)+(Number(effectiveSub)>0?Number(effectiveSub)-1:0));if(n==="健美教练")feat+=10;});
  if(s.fieldSources){if(!valid(a["体质"]))reasons.push("体质未读取");if(!valid(a[key]))reasons.push("关键属性未读取");}
  var ready=reasons.length===0,hp=ready?totalHP(m,mc.confirmedTotalLevel||mc.level,sub,sc.ruleEnabled===false?0:sc.level,(valid(a["体质"])?a["体质"]:10),race,bg,feat,s.raceSize):null,fp=ready?totalFP(m,mc.confirmedTotalLevel||mc.level,sub,sc.ruleEnabled===false?0:sc.level,key,valid(a[key])?a[key]:10,race,0):null,ac=armor(s),r=d.races[race];
  return {hp:hp,fp:fp,ac:ac.missing.length?null:ac.value,acEstimate:ac.value,atk:Math.max(mod(a["力量"]||10),mod(a["敏捷"]||10))+(Number(s.atk_hit_bonus)||0),spell:mod(a[key]||10)+(Number(s.spell_hit_bonus)||0),init:mod(a["敏捷"]||10),speed:r&&r.speed!==undefined?String(r.speed).replace(/米$/,""):null,hpRecover:hp===null?null:Math.floor(hp/2),fpRecover:fp===null?null:Math.floor(fp/2),keyAttr:key,reasons:reasons,unknownArmor:ac.missing};
 }
 function policy(s){return s.combatStats&&s.combatStats.fields||{};}
 function mode(s,k){var p=policy(s)[k];if(p)return p.mode;if(k==="hp"&&s._hpManual)return "fixed";if(k==="fp"&&s._fpManual)return "fixed";return "rules";}
 function currentValue(s,k){return k==="hp"||k==="fp"?s[k]:s.combatValues&&s.combatValues[k];}
 function set(s,k,value,how,source){
  if(!Object.prototype.hasOwnProperty.call(labels,k))throw new Error("未知战斗字段");s.combatStats=s.combatStats||{schemaVersion:1,fields:{}};s.combatStats.fields=s.combatStats.fields||{};
  var old=s.combatStats.fields[k]||{};s.combatStats.fields[k]=Object.assign({},old,{mode:how||"fixed",source:source||old.source||{origin:"manual"}});
  if(k==="hp"||k==="fp"){s[k]=value;s[k==="hp"?"_hpManual":"_fpManual"]=(how||"fixed")==="fixed";}else{(s.combatValues=s.combatValues||{})[k]=value;}
 }
 function fromSheet(s,values){
  Object.keys(values).forEach(function(k){var v=values[k];if(v.status==="valid"){set(s,k,v.value,"fixed",{origin:"sheet",sheet:v.sheet,cellRef:v.cellRef,raw:v.raw,formula:v.formula||""});policy(s)[k].baseline=v.raw;policy(s)[k].originalValue=v.value;}else if(["hp","fp"].indexOf(k)>=0||v.cellRef&&v.status!=="missing"){s.importIssues=s.importIssues||[];s.importIssues.push({kind:"field-invalid",field:k,note:labels[k]+"无法可靠读取，原文已保留："+v.raw,source:v});}});
 }
 function read(s){
  var calc=computed(s),out={computed:calc,fields:{},keyAttr:calc.keyAttr};Object.keys(labels).forEach(function(k){
   var m=mode(s,k),v=currentValue(s,k);if(m!=="fixed")v=calc[k];if(k==="hpRecover"&&m!=="fixed"){var h=mode(s,"hp")==="fixed"?s.hp:calc.hp;v=valid(h)?Math.floor(h/2):null;}if(k==="fpRecover"&&m!=="fixed"){var f=mode(s,"fp")==="fixed"?s.fp:calc.fp;v=valid(f)?Math.floor(f/2):null;}
   out[k]=v===undefined?null:v;out.fields[k]={mode:m,value:out[k],computed:calc[k],source:policy(s)[k]&&policy(s)[k].source||{origin:"rules"}};
  });return out;
 }
 function synchronize(s){
  var r=read(s);if(valid(r.hp))s.hp=r.hp;if(valid(r.fp))s.fp=r.fp;
  s._hpManual=mode(s,"hp")==="fixed";s._fpManual=mode(s,"fp")==="fixed";return r;
 }
 function migrate(s){
  if(s.combatStats)return;
  if(s._chargenOrigin==="upload"){["hp","fp"].forEach(function(k){if(valid(s[k]))set(s,k,s[k],"fixed",{origin:"legacy-upload"});});}
 }
 return {labels:labels,valid:valid,mod:mod,hpBonus:hpBonus,totalHP:totalHP,totalFP:totalFP,computed:computed,armorInfo:armorInfo,shield:shield,read:read,set:set,mode:mode,fromSheet:fromSheet,synchronize:synchronize,migrate:migrate};
})();
