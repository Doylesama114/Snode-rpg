/* Import vocabulary and business associations; layout code has no item-name branches. */
var SNOWD_CHARACTER_IMPORT_SCHEMA=(function(){
 function normalize(v){return String(v==null?"":v).replace(/[\s\u00a0\u3000]+/g,"").replace(/（/g,"(").replace(/）/g,")").replace(/：/g,":").toLowerCase();}
 var aliases={player:["玩家名称","玩家名","玩家"],name:["角色名称","角色名","姓名"],race:["种族","族裔"],gender:["性别"],age:["年龄"],height:["身高"],weight:["体重"],eye:["瞳色","瞳孔"],skin:["肤色"],hair:["发色","头发","毛发"],keyAttr:["关键属性"],languages:["语言","语言列表"],professionals:["专业","专业列表"],story:["故事","角色故事"],traits:["特性","个性特征"],personality:["特点"],ideals:["理念"],bonds:["羁绊"],flaws:["缺陷"],background:["背景","个性背景","背景故事"],
 hp:["生命值","最大生命值","生命上限","最大HP","HP"],fp:["疲劳值","最大疲劳值","疲劳上限","最大FP","FP"],hpCurrent:["当前生命值","当前HP","剩余生命值"],fpCurrent:["当前疲劳值","当前FP","剩余疲劳值"],ac:["防御等级","AC"],atk:["攻击命中"],spell:["法术命中"],init:["先攻值","先攻调整"],speed:["基础速度","移动速度"],hpRecover:["生命回复","生命恢复"],fpRecover:["疲劳回复","疲劳恢复"],xp:["当前经验值","目前经验","目前经验值","经验值","XP"],sp_points:["当前技能点","目前技能点","技能点"],carryNormal:["常规"],carryFull:["满载"],carryLimit:["极限"],carryCurrent:["携带负重","当前负重"],"金币":["金币"],"银币":["银币"],"铜币":["铜币"],"其他货币":["其他货币"]};
 [["主职业","主职"],["子职业","副职业","副职"],["附赠职业","赠送职业"]].forEach(function(names,i){aliases["classes."+i+".name"]=names;aliases["classes."+i+".level"]=names.map(function(n){return n+"等级";});});
 var attrs=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];attrs.forEach(function(k){aliases["attrs."+k]=[k];});
 var abilityAliases={name:["技能名称","技能名","能力名称","法术名称","天赋名称","天赋名","配方名称","图纸名称","名称"],tm:["施展时间","施放时间","施展动作","施放动作","动作","使用时间"],range:["施展距离","施放距离","距离","范围","射程"],dur:["持续时间","持续"],dr:["疲劳值消耗","疲劳消耗","消耗","费用","FP消耗"],src:["来源","技能来源","职业来源","所属职业","类别"],ds:["效果","描述","说明","技能效果","技能描述"],tier:["阶位","天赋阶位"]};
 function match(text,values){var n=normalize(text);return values.some(function(v){var a=normalize(v);return n===a||n.indexOf(a+"(")===0&&n.slice(-1)===")";});}
 var fieldIndex=Object.create(null),abilityIndex=Object.create(null);Object.keys(aliases).forEach(function(k){aliases[k].forEach(function(a){fieldIndex[normalize(a)]=k;});});Object.keys(abilityAliases).forEach(function(k){abilityAliases[k].forEach(function(a){abilityIndex[normalize(a)]=k;});});
 function field(text){var n=normalize(text);return fieldIndex[n]||fieldIndex[n.replace(/\([^)]*\)$/,"")]||"";}
 function abilityField(text){var n=normalize(text);return abilityIndex[n]||abilityIndex[n.replace(/\([^)]*\)$/,"")]||"";}
 function title(text){
  var t=normalize(text);if(!t||t.length>50)return null;
  if(/^(?:当前角色|玩家角色|角色|主角)(?::.+)$/.test(t))return {kind:"entity",owner:"current",explicitName:String(text).split(/[:：]/).slice(1).join("：").trim()};
  if(/^(?:基础信息|基本信息|角色信息|角色面板|角色资料|角色档案|当前角色|玩家角色)$/.test(t))return {kind:"entity",owner:"current"};
  if(/^(?:敌人|敌方|npc|其他角色|队伍成员|队友)(?:资料|信息|面板|属性|技能|能力|列表)?(?:\([^)]*\))?(?::.*)?$/.test(t))return {kind:"entity",owner:"reference"};
  if(/^(?:宠物|召唤物|伙伴|随从)(?:资料|信息|面板|属性|技能|能力|列表)?(?:\([^)]*\))?(?::.*)?$/.test(t))return {kind:"entity",owner:"companion"};
  if(/^(?:参考|备选|规划|未来|计划|发展方向)(?:资料|技能|天赋|能力|列表|方向)?(?:\([^)]*\))?$/.test(t))return {kind:"entity",owner:"reference"};
  if(/^(?:属性信息|属性表|角色属性)$/.test(t))return {kind:"section",type:"attributes"};
  if(/^(?:战斗信息|战斗数据|战斗数值|数值信息)$/.test(t))return {kind:"section",type:"combat"};
  if(/^(?:职业信息|职业列表)$/.test(t))return {kind:"section",type:"classes"};
  if(/^(?:装备栏|装备信息|装备列表|物品列表|背包)$/.test(t))return {kind:"section",type:"equipment"};
  if(/^(?:种族特性|职业特性(?:\(.*\))?|.{1,24}职业特性)$/.test(t))return {kind:"section",type:"features"};
  if(/^(?:背景信息|背景故事|个性背景)$/.test(t))return {kind:"section",type:"background"};
  if(/^(?:(?:已学|已习得|已掌握|当前)(?:的)?)(?:技能|能力|战术|法术)(?:表|列表|栏)?(?:\(.*\))?$/.test(t))return {kind:"section",type:"skills",owned:true};
  if(/^(?:技能列表|技能栏|技能表|职业技能列表|法术列表|额外能力|额外技能|特殊能力|自定义技能|自定义能力|剧情技能|剧情能力|主持人授予)(?:列表|栏)?(?:\(.*\))?$/.test(t))return {kind:"section",type:"skills",owned:true};
  if(/^(?:天赋列表|天赋树|额外天赋|特殊天赋)$/.test(t))return {kind:"section",type:"talents",owned:true};
  if(/^(?:图纸|配方|专业)(?:列表)?(?:\(.*\))?$/.test(t))return {kind:"section",type:"blueprints"};
  if(t==="角色补充字段")return {kind:"section",type:"fields"};
  if(/^(?:原始未分类内容|未分类字段|导入排除记录|导入备注|额外专长列表|装备补充列表|补充说明|补充备注|故事补充)$/.test(t))return {kind:"section",type:"notes"};
  return null;
 }
 function isLabel(text){return !!field(text)||!!field(String(text).split(/[:：=]/)[0])||!!abilityField(text)||!!title(text)||/^(?:等级|职业等级|职业名|风格|风格名|熟练项|熟练度|属性值|调整值|重量|磅重|数量|价格|总价|类型|原分区)$/.test(normalize(text));}
 var equipmentAbilityRules=[{headings:["战术家棋局战术","战术家的棋局战术"],item:"战术家的棋局",condition:"equipped"}];
 function equipmentRule(text){return equipmentAbilityRules.find(function(r){return match(text,r.headings);})||null;}
 function supplemental(text){
  var n=normalize(text),rule=equipmentRule(text),m;
  if(rule)return {kind:"equipment",label:rule.item,rule:rule,declared:false};
  m=n.match(/^(.+?)进阶(?:战术|能力|特性)(?:表|列表)?\((?:已习得|已学|已掌握)\)$/);if(m)return {kind:"advancement",label:String(text).replace(/进阶.*$/,"").trim(),declared:true};
  m=String(text).trim().match(/^(.+?)(?:授予的?|附加的?|附赠的?)?(?:技能|能力|战术)(?:表|列表)?(?:[（(](已学|已习得|已掌握)[）)])?$/);
  if(m&&!title(text)&&String(text).length<=45)return {kind:"equipment",label:m[1].trim(),rule:null,declared:!!m[2]};
  return null;
 }
 return {normalize:normalize,aliases:aliases,attrs:attrs,abilityAliases:abilityAliases,field:field,abilityField:abilityField,title:title,isLabel:isLabel,match:match,supplemental:supplemental,equipmentRule:equipmentRule,equipmentAbilityRules:equipmentAbilityRules};
})();
