/* Structural scalar, inventory and feature reader. Every extracted value keeps its source. */
var SNOWD_CHARACTER_FIELDS=(function(){
 function layout(){return SNOWD_CHARACTER_LAYOUT;}
 function numeric(raw,formula,nonnegative){
  var text=String(raw==null?"":raw).trim();
  if(formula&&formula.cached===false)return {status:"uncached",value:null,raw:text,formula:formula.formula};
  if(!text)return {status:"missing",value:null,raw:text};
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))return {status:"invalid",value:null,raw:text};
  var value=Number(text);if(!Number.isFinite(value)||(nonnegative&&value<0))return {status:"invalid",value:null,raw:text};
  return {status:"valid",value:value,raw:text,formula:formula&&formula.formula||""};
 }
 function label(g,texts){return g.all.find(function(a){return texts.indexOf(a.text)>=0;});}
 function named(g,n){return g.all.filter(function(a){return a.text===n||new RegExp("^"+n+"(?:\\([^)]*\\))?$").test(a.text);});}
 function refValue(g,col,row){var l=layout(),ref=l.ref(col,row),span=g.span(ref);return {value:g.value(col,row),cellRef:g.cells[ref]?ref:l.ref(span.left,span.top)};}
 function right(g,a,max){
  if(!a)return null;var span=g.span(a.ref),col=span.right+1,row=a.row;
  for(var i=0;i<(max||3);i++){var v=refValue(g,col+i,row);if(String(v.value).trim())return v;}
  return {value:"",cellRef:layout().ref(col,row)};
 }
 function readLabel(parsed,g,texts,options){
  options=options||{};var l=layout(),a=label(g,texts),out=null;
  if(!a&&options.inline){
   for(var i=0;i<g.all.length;i++){var c=g.all[i];if(c.value.length>65)continue;for(var j=0;j<texts.length;j++){var m=c.value.match(new RegExp("^\\s*"+texts[j]+"\\s*[:：]\\s*(.*?)\\s*$"));if(m){a=c;out={value:m[1],cellRef:c.ref};break;}}if(a)break;}
  }
  if(!a)return {status:"missing",value:null,raw:"",sheet:parsed.sheetName||"",cellRef:""};
  if(!out)out=right(g,a,options.max||3);
  var result=options.numeric?numeric(out.value,(parsed.formulas||{})[out.cellRef],options.nonnegative):{status:String(out.value).trim()?"valid":"missing",value:String(out.value),raw:String(out.value)};
  return Object.assign(result,{sheet:parsed.sheetName||"",cellRef:out.cellRef,labelRef:a.ref,inline:!!options.inline&&out.cellRef===a.ref,label:a.value});
 }
 var scalarLabels={player:["玩家名称","玩家名"],name:["角色名称","角色名"],race:["种族"],gender:["性别"],age:["年龄"],height:["身高"],weight:["体重"],eye:["瞳色"],skin:["肤色"],hair:["发色"],keyAttr:["关键属性"],languages:["语言","语言列表"],professionals:["专业","专业列表"],story:["故事","角色故事"],traits:["特性","个性特征"],personality:["特点"],ideals:["理念"],bonds:["羁绊"],flaws:["缺陷"]};
 var statLabels={hp:["生命值","最大生命值","HP"],fp:["疲劳值","最大疲劳值","FP"],ac:["防御等级"],atk:["攻击命中"],spell:["法术命中"],init:["先攻值","先攻调整"],speed:["基础速度"],hpRecover:["生命回复"],fpRecover:["疲劳回复"]};
 function read(parsed){
  var l=layout(),g=l.grid(parsed),values={},stats={},sources={},issues=[],notes=[];
  Object.keys(scalarLabels).forEach(function(k){var v=readLabel(parsed,g,scalarLabels[k]);sources[k]=v;if(v.status==="valid")values[k]=v.value;});
  Object.keys(statLabels).forEach(function(k){var v=readLabel(parsed,g,statLabels[k],{numeric:k!=="speed",nonnegative:k==="hp"||k==="fp",max:2});stats[k]=v;sources[k]=v;});
  var bg=g.all.find(function(a){return a.text==="背景故事";});if(bg){var span=g.span(bg.ref);for(var r=span.bottom+1;r<=Math.min(span.bottom+3,g.maxRow);r++){var v=refValue(g,bg.col,r);if(v.value&&!/^(?:故事|特性)$/.test(l.normalize(v.value))){values.background=v.value;sources.background={status:"valid",value:v.value,raw:v.value,cellRef:v.cellRef,sheet:parsed.sheetName,labelRef:bg.ref};break;}}}
  var xp=readLabel(parsed,g,["当前经验值","目前经验","目前经验值","经验值","XP"],{numeric:true,nonnegative:true,inline:true,max:2}),sp=readLabel(parsed,g,["当前技能点","目前技能点","技能点"],{numeric:true,nonnegative:true,inline:true,max:2});sources.xp=xp;sources.sp_points=sp;if(xp.status==="valid")values.xp=xp.value;if(sp.status==="valid")values.sp_points=sp.value;
  if(values.languages)values.languages=String(values.languages).split(/[、，,\/]/).map(function(n){return n.trim();}).filter(Boolean);
  if(values.professionals)values.professionals=String(values.professionals).split(/[、，,]/).map(function(n){return n.trim();}).filter(function(n){return n&&n!=="无";});
  var carry={},carrySources={},weightHead=label(g,["负重","负重信息"]);if(weightHead){var b=g.span(weightHead.ref);["常规","满载","极限"].forEach(function(k,i){
   var a=g.all.find(function(x){return x.row>=weightHead.row&&x.row<=b.bottom+3&&x.col>weightHead.col&&x.col<=weightHead.col+3&&x.text===k;}),v=a?right(g,a,2):refValue(g,b.right+1,weightHead.row+i);
   var n=numeric(v.value,(parsed.formulas||{})[v.cellRef],true);if(n.status==="valid"){carry[k]=n.value;carrySources[k]=v.cellRef;}
  });}var held=readLabel(parsed,g,["携带负重","当前负重"],{numeric:true,nonnegative:true});if(held.status==="valid"){carry.当前=held.value;carrySources.当前=held.cellRef;}
  var attrNames=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"],attrs={},attrSources={},profs={},profSources={},attrHead=label(g,["属性信息"]),attrArea=attrHead?g.span(attrHead.ref):null;
  attrNames.forEach(function(k){var a=g.all.find(function(x){return x.text===k&&(!attrHead||x.row>attrHead.row&&x.col>=attrArea.left&&x.col<=attrArea.right);});if(!a)return;var v=right(g,a,2),n=numeric(v.value,(parsed.formulas||{})[v.cellRef],false);attrSources[k]=v.cellRef;if(n.status==="valid"){attrs[k]=n.value;}
   var previous=g.all.filter(function(x){return x.row<a.row&&/^(?:熟练项|熟练度)$/.test(x.text);}).sort(function(x,y){return y.row-x.row;})[0];if(!previous)return;
   var end=g.maxRow+1;g.all.forEach(function(x){if(x.row>a.row&&x.col===a.col&&(attrNames.indexOf(x.text)>=0||x.text==="类别"||x.text==="技能列表"))end=Math.min(end,x.row);});
   var pcol=previous.col;
   for(var r=a.row;r<end;r++){var raw=g.cells[l.ref(pcol,r)];if(!raw)continue;var name=String(raw).trim();if(!name||/^(?:熟练项|熟练度|属性值|调整值)$/.test(name))continue;var span=g.span(l.ref(pcol,r)),val=right(g,{row:r,col:pcol,ref:l.ref(pcol,r)},2),n=numeric(val.value,null,true);(profSources[k]=profSources[k]||{})[name]=val.cellRef;if(n.status==="valid"){(profs[k]=profs[k]||{})[name]=n.value;}}
  });
  function features(type){
   var headings=g.all.filter(function(a){return type==="race"?a.text==="种族特性":/^(?:职业特性(?:\(.*\))?|.{1,20}职业特性)$/.test(a.text);}),result=[];
   headings.forEach(function(h){var span=g.span(h.ref),end=g.maxRow+1;g.all.forEach(function(a){if(a.row>h.row&&a.col===h.col&&(/特性/.test(a.text)&&headings.some(function(x){return x.ref===a.ref;})||/^(?:技能列表|天赋列表|专业列表)$/.test(a.text)))end=Math.min(end,a.row);});
    var stop=g.all.find(function(a){return a.row>h.row&&/^(?:技能列表|天赋列表)$/.test(a.text);});if(stop)end=Math.min(end,stop.row);
    for(var r=span.bottom+1;r<end;r++){var value=g.cells[l.ref(h.col,r)];if(!value)continue;var name=String(value).trim();if(!name||/职业特性|种族特性/.test(name))continue;var spanN=g.span(l.ref(h.col,r)),desc=refValue(g,spanN.right+1,r);if(desc.cellRef&&l.point(desc.cellRef).col>span.right)desc={value:"",cellRef:""};result.push({name:name,desc:desc.value||"",provenance:{sheet:parsed.sheetName,nameRef:l.ref(h.col,r),descRef:desc.cellRef,header:h.ref,label:h.value}});}
   });return result;
  }
  var racial=features("race"),classFeatures=features("class"),supp=l.supplemental(parsed);
  var eqHead=label(g,["装备栏","装备信息","装备列表"]),equipment={},groups=[];
  if(eqHead){
   var headers=g.all.filter(function(a){return a.row>eqHead.row&&a.col===eqHead.col&&/^(?:武器|主手武器|副手武器|防具|服装|服饰|配饰|背包(?:\(.*\))?|旅行腰包(?:\(.*\))?|杂物(?:包)?|材料包(?:\(.*\))?|.{1,12}材料包)$/.test(a.text);});
   var abilityBoundary=g.all.filter(function(a){return a.row>eqHead.row&&/^(?:种族特性|职业特性|技能列表|天赋列表)$/.test(a.text);}).reduce(function(n,a){return Math.min(n,a.row);},g.maxRow+1);headers=headers.filter(function(a){return a.row<abilityBoundary;}).sort(function(a,b){return a.row-b.row;});var weaponNumber=0;
   headers.forEach(function(h,i){var label=h.value.trim(),clean=h.text.replace(/\([^)]*\)/g,""),slot=clean;if(clean==="武器")slot=weaponNumber++===0?"主手武器":"副手武器";if(clean==="杂物")slot="杂物包";if(clean==="服装")slot="服饰";if(/材料包$/.test(clean))slot="材料包";
    var end=i+1<headers.length?headers[i+1].row:abilityBoundary,items=[],nameCol=null,descCol=null,weightCol=null;
    var titleRow=g.byRow[h.row]||[],explicit=titleRow.find(function(a){return a.col>h.col&&a.text==="名称";});if(explicit)nameCol=explicit.col;
    var effect=titleRow.find(function(a){return a.col>h.col&&/^(?:效果|说明|描述)$/.test(a.text);});if(effect)descCol=effect.col;
    var weight=titleRow.find(function(a){return a.col>h.col&&/^(?:磅重|重量|重量\(磅\)|磅重\/数量)$/.test(a.text);});if(weight)weightCol=weight.col;
    if(nameCol===null)nameCol=h.col+2;if(descCol===null)descCol=h.col+4;
    if(weightCol===null){
     var from=(g.byRow[headers[0].row]||[]).find(function(a){return a.col>h.col&&/^(?:磅重|重量)$/.test(a.text);});if(from)weightCol=from.col;
     else{var counts={};g.all.forEach(function(a){if(a.row>=h.row&&a.row<end&&a.col>descCol&&a.col<=descCol+9&&/^(?:\d+(?:\.\d+)?)(?:磅|瓶|个|件|枚)?$/.test(a.text)&&!(parsed.formulas||{})[a.ref])counts[a.col]=(counts[a.col]||0)+1;});var keys=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];});weightCol=keys.length?Number(keys[0]):h.col+10;}
    }
    var start=h.row;for(var r=start;r<end;r++){var ref=l.ref(nameCol,r),raw=g.cells[ref];if(!raw||/^(?:名称|效果|说明|磅重|重量)$/.test(l.normalize(raw)))continue;var desc=refValue(g,descCol,r),w=refValue(g,weightCol,r),number=numeric(String(w.value).replace(/\s*磅$/,""),(parsed.formulas||{})[w.cellRef],true),quantity=String(w.value).match(/^(\d+)\s*(瓶|个|件|枚|包)$/);
     var item={item:String(raw).trim(),weight:number.status==="valid"?number.value:0,desc:desc.value||"",weightStatus:number.status==="valid"?"known":"unknown",rawWeight:w.value,sourceSlot:label,uid:"item-"+ref,provenance:{sheet:parsed.sheetName,nameRef:ref,descRef:desc.cellRef,weightRef:w.cellRef}};
     if(quantity){item.count=Number(quantity[1]);item.quantityUnit=quantity[2];item.weight=0;item.weightStatus="quantity";}
     items.push(item);
    }
    if(slot==="材料包"){if(items.length)equipment[slot]=(equipment[slot]||[]).concat([{type:clean==="材料包"?"":clean,rawLabel:label,items:items,uid:"container-"+h.ref}]);}
    else equipment[slot]=(equipment[slot]||[]).concat(items);
    groups.push({slot:slot,label:label,header:h.ref,start:start,end:end,nameCol:nameCol,descCol:descCol,weightCol:weightCol,items:items.map(function(x){return x.uid;})});
   });
  }
  g.all.filter(function(a){return a.text==="装备补充列表";}).forEach(function(h){
   for(var r=h.row+2;r<=g.maxRow;r++){var nm=g.cells["B"+r];if(!nm)break;var slot=g.cells["D"+r]||"杂物包",weight=numeric(g.cells["E"+r],null,true),q=String(g.cells["F"+r]||"").match(/^(\d+)\s*(.*)$/);
    (equipment[slot]=equipment[slot]||[]).push({item:nm,weight:weight.status==="valid"?weight.value:0,weightStatus:weight.status==="valid"?"known":q?"quantity":"unknown",count:q?Number(q[1]):undefined,quantityUnit:q?q[2]:"",desc:g.cells["G"+r]||"",uid:"item-B"+r,provenance:{sheet:parsed.sheetName,nameRef:"B"+r,descRef:"G"+r,weightRef:"E"+r}});
   }
  });
  g.all.filter(function(a){return /^(?:补充说明|补充备注|故事补充)$/.test(a.text);}).forEach(function(h){var v=refValue(g,h.col,g.span(h.ref).bottom+1);if(v.value)notes.push({uid:"note-"+h.ref,raw:v.value,cellRef:v.cellRef,sheet:parsed.sheetName,kind:"reference"});});
  g.all.filter(function(a){return a.text==="额外专长列表";}).forEach(function(h){
   supp.feats=supp.feats||[];
   for(var r=h.row+2;r<=g.maxRow;r++){var name=g.cells["B"+r];if(!name)break;if(!supp.feats.some(function(f){return f.name===name;}))supp.feats.push({name:name,level:null,imported:true,via:g.cells["D"+r]||"",note:g.cells["F"+r]||"",provenance:{sheet:parsed.sheetName,nameRef:"B"+r}});}
  });
  Object.keys(sources).forEach(function(k){var v=sources[k];if(["invalid","uncached"].indexOf(v.status)>=0)issues.push({kind:"field-invalid",field:k,note:"字段“"+k+"”无法解析，保留原文："+v.raw,source:v});});
  return {values:values,stats:stats,sources:sources,attrs:attrs,attrSources:attrSources,profs:profs,profSources:profSources,carry:carry,carrySources:carrySources,equipment:eqHead?equipment:null,equipmentGroups:groups,racial_traits:racial,class_features:classFeatures,special_feats:supp.feats,currency:supp.values.currency||{},issues:issues.concat(supp.issues),notes:notes};
 }
 function apply(s,parsed){
  var r=read(parsed),v=r.values;
  Object.keys(v).forEach(function(k){s[k]=v[k];});Object.keys(r.attrs).forEach(function(k){s.attrs[k]=r.attrs[k];});s.profs=r.profs;
  Object.keys(r.carry).forEach(function(k){s.carry_capacity[k]=r.carry[k];});Object.keys(r.currency).forEach(function(k){s.currency[k]=r.currency[k];});
  if(r.equipment!==null){s.equipment=Object.assign({"主手武器":[],"副手武器":[],"防具":[],"配饰":[],"背包":[],"杂物包":[],"旅行腰包":[],"材料包":[]},r.equipment);s.equipmentLayoutGroups=r.equipmentGroups;}
  if(r.special_feats!==null)s.special_feats=r.special_feats;s.racial_traits=r.racial_traits;s.class_features=r.class_features;
  s.fieldSources={schemaVersion:1,scalar:r.sources,attrs:r.attrSources,profs:r.profSources,carry:r.carrySources};
  s.importIssues=(s.importIssues||[]).filter(function(i){return i.kind!=="field-unmapped"&&i.kind!=="field-invalid";}).concat(r.issues);s.unmappedFields=r.issues.filter(function(i){return i.kind==="field-unmapped";});
  s.importNotes=r.notes;SNOWD_CHARACTER_STATS.fromSheet(s,r.stats);return r;
 }
 return {numeric:numeric,read:read,apply:apply,readLabel:readLabel,statLabels:statLabels};
})();
