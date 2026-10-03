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
 function label(g,texts){var hits=g.all.filter(function(a){return SNOWD_CHARACTER_IMPORT_SCHEMA.match(a.value,texts);});return hits.length===1?hits[0]:null;}
 function refValue(g,col,row){var l=layout(),ref=l.ref(col,row),span=g.span(ref);return {value:g.value(col,row),cellRef:g.cells[ref]?ref:l.ref(span.left,span.top)};}
 function right(g,a,max){if(!a)return null;return SNOWD_CHARACTER_STRUCTURE.afterLabel(g._parsed||{cells:g.cells},g,a,g._context||SNOWD_CHARACTER_STRUCTURE.analyze(g._parsed||{cells:g.cells},g));}
 function readLabel(parsed,g,texts,options){
  options=options||{};var key=options.key||Object.keys(SNOWD_CHARACTER_IMPORT_SCHEMA.aliases).find(function(k){return texts.some(function(t){return SNOWD_CHARACTER_IMPORT_SCHEMA.match(t,SNOWD_CHARACTER_IMPORT_SCHEMA.aliases[k]);});})||"",context=g._context||SNOWD_CHARACTER_STRUCTURE.analyze(parsed,g),manual=(parsed.fieldBindings||[]).filter(function(m){return (!m.sheet||m.sheet===parsed.sheetName)&&m.field===key&&m.confirmed;});
  var stale=manual.filter(function(m){var w=m.witness;if(!w)return false;var area=context.sectionAt(m.cellRef);return w.labelRef&&String(g.cells[w.labelRef]||"")!==String(w.labelRaw||"")||w.section&&(!area||area.type!==w.section)||w.owner&&context.owner(m.cellRef).owner!==w.owner;});if(stale.length)return {status:"ambiguous",value:null,raw:"",sheet:parsed.sheetName,cellRef:"",confidence:"stale-confirmation",candidates:stale.map(function(m){return {cellRef:m.cellRef,raw:g.cells[m.cellRef]||""};}),evidence:"binding-witness-changed"};
  var candidates=manual.length?manual.map(function(m){var p=SNOWD_CHARACTER_LAYOUT.point(m.cellRef);if(!p)return null;var c=SNOWD_CHARACTER_STRUCTURE.cell(parsed,g,p.col,p.row);return Object.assign(c,{sheet:parsed.sheetName,labelRef:m.labelRef||"",label:m.label||"",confidence:"confirmed",evidence:"player-binding",confirmed:true,entity:context.owner(m.cellRef).id});}).filter(Boolean):SNOWD_CHARACTER_STRUCTURE.fieldCandidates(parsed,g,texts,context);
  if(!candidates.length)return {status:"missing",value:null,raw:"",sheet:parsed.sheetName||"",cellRef:"",confidence:"missing",candidates:[]};
  if(candidates.length>1||candidates[0].ambiguous)return {status:"ambiguous",value:null,raw:"",sheet:parsed.sheetName||"",cellRef:"",confidence:"ambiguous",candidates:candidates.reduce(function(out,c){return out.concat(c.candidates||[{cellRef:c.cellRef,labelRef:c.labelRef,raw:c.value,entity:c.entity}]);},[]),evidence:"multiple-field-bindings"};
  var c=candidates[0],result=options.numeric?numeric(c.value,c.formula,options.nonnegative):{status:String(c.value).trim()?"valid":"missing",value:String(c.value),raw:String(c.value)};
  return Object.assign(result,{sheet:parsed.sheetName||"",cellRef:c.cellRef,labelRef:c.labelRef,inline:!!c.inline,label:c.label,evidence:c.evidence,confidence:c.confidence,confirmed:!!c.confirmed,entity:c.entity,candidates:[]});
 }
 var scalarLabels={background:["背景","个性背景","背景故事"],player:["玩家名称","玩家名"],name:["角色名称","角色名"],race:["种族"],gender:["性别"],age:["年龄"],height:["身高"],weight:["体重"],eye:["瞳色"],skin:["肤色"],hair:["发色"],keyAttr:["关键属性"],languages:["语言","语言列表"],professionals:["专业","专业列表"],story:["故事","角色故事"],traits:["特性","个性特征"],personality:["特点"],ideals:["理念"],bonds:["羁绊"],flaws:["缺陷"]};
 var statLabels={hp:["生命值","最大生命值","HP"],fp:["疲劳值","最大疲劳值","FP"],ac:["防御等级"],atk:["攻击命中"],spell:["法术命中"],init:["先攻值","先攻调整"],speed:["基础速度"],hpRecover:["生命回复"],fpRecover:["疲劳回复"]};
 function read(parsed){
  var l=layout(),originalGrid=l.grid(parsed),context=SNOWD_CHARACTER_STRUCTURE.analyze(parsed,originalGrid),g=Object.assign({},originalGrid,{all:context.pending?[]:originalGrid.all.filter(context.eligible),_parsed:parsed,_context:context}),values={},stats={},sources={},issues=[],notes=[];
  if(context.pending)issues.push({kind:"entity-unconfirmed",field:"entity",note:"同一工作表存在多个角色主体，请选择当前角色范围。",entities:context.current.map(function(e){return {id:e.id,name:e.name,bounds:e.bounds};})});
  Object.keys(scalarLabels).forEach(function(k){scalarLabels[k]=SNOWD_CHARACTER_IMPORT_SCHEMA.aliases[k]||scalarLabels[k];});Object.keys(statLabels).forEach(function(k){statLabels[k]=SNOWD_CHARACTER_IMPORT_SCHEMA.aliases[k]||statLabels[k];});
  Object.keys(scalarLabels).forEach(function(k){var v=readLabel(parsed,g,scalarLabels[k],{key:k});sources[k]=v;if(v.status==="valid")values[k]=v.value;});
  Object.keys(statLabels).forEach(function(k){var v=readLabel(parsed,g,statLabels[k],{key:k,numeric:k!=="speed",nonnegative:k==="hp"||k==="fp"});stats[k]=v;sources[k]=v;});
  ["hpCurrent","fpCurrent"].forEach(function(k){var v=readLabel(parsed,g,SNOWD_CHARACTER_IMPORT_SCHEMA.aliases[k],{key:k,numeric:true,nonnegative:true});sources[k]=v;if(v.status==="valid")values[k==="hpCurrent"?"_hpCurrent":"_fpCurrent"]=v.value;});
  var bg=g.all.find(function(a){return a.text==="背景故事";});if(bg){var span=g.span(bg.ref);for(var r=span.bottom+1;r<=Math.min(span.bottom+1,g.maxRow);r++){var v=refValue(g,bg.col,r);if(v.value&&!/^(?:故事|特性)$/.test(l.normalize(v.value))){values.background=v.value;sources.background={status:"valid",value:v.value,raw:v.value,cellRef:v.cellRef,sheet:parsed.sheetName,labelRef:bg.ref};break;}}}
  var xp=readLabel(parsed,g,["当前经验值","目前经验","目前经验值","经验值","XP"],{numeric:true,nonnegative:true,inline:true,max:2}),sp=readLabel(parsed,g,["当前技能点","目前技能点","技能点"],{numeric:true,nonnegative:true,inline:true,max:2});sources.xp=xp;sources.sp_points=sp;if(xp.status==="valid")values.xp=xp.value;if(sp.status==="valid")values.sp_points=sp.value;
  if(values.languages)values.languages=String(values.languages).split(/[、，,\/]/).map(function(n){return n.trim();}).filter(Boolean);
  if(values.professionals)values.professionals=String(values.professionals).split(/[、，,]/).map(function(n){return n.trim();}).filter(function(n){return n&&n!=="无";});
  var carry={},carrySources={},weightHead=label(g,["负重","负重信息"]);if(weightHead){var b=g.span(weightHead.ref);["常规","满载","极限"].forEach(function(k,i){
   var a=g.all.find(function(x){return x.row>=weightHead.row&&x.row<=b.bottom+3&&x.col>weightHead.col&&x.col<=weightHead.col+3&&x.text===k;}),v=a?right(g,a,2):refValue(g,b.right+1,weightHead.row+i);
   var n=numeric(v.value,(parsed.formulas||{})[v.cellRef],true);if(n.status==="valid"){carry[k]=n.value;carrySources[k]=v.cellRef;}
  });}var held=readLabel(parsed,g,["携带负重","当前负重"],{numeric:true,nonnegative:true});if(held.status==="valid"){carry.当前=held.value;carrySources.当前=held.cellRef;}
  var attrNames=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"],attrs={},attrSources={},profs={},profSources={},attrHead=label(g,["属性信息"]),attrArea=attrHead?g.span(attrHead.ref):null;
  attrNames.forEach(function(k){
   var v=readLabel(parsed,g,[k],{key:"attrs."+k,numeric:true,nonnegative:true});if(v.cellRef)attrSources[k]=v.cellRef;
   if(v.status==="valid")attrs[k]=v.value;else if(v.status!=="missing")issues.push({kind:v.status==="ambiguous"?"field-ambiguous":"field-invalid",field:"attrs."+k,note:k+"无法可靠读取，请绑定原始单元格。",source:v});
   var a=g.all.find(function(a){return a.ref===v.labelRef;});if(!a)return;
   var previous=g.all.filter(function(x){return x.row<a.row&&/^(?:熟练项|熟练度)$/.test(x.text);}).sort(function(x,y){return y.row-x.row;})[0];if(!previous)return;
   var end=g.maxRow+1;g.all.forEach(function(x){if(x.row>a.row&&x.col===a.col&&(attrNames.indexOf(x.text)>=0||x.text==="类别"||x.text==="技能列表"))end=Math.min(end,x.row);});var pcol=previous.col;
   for(var r=a.row;r<end;r++){var raw=g.cells[l.ref(pcol,r)];if(!raw)continue;var name=String(raw).trim();if(!name||SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(name))continue;var val=right(g,{row:r,col:pcol,ref:l.ref(pcol,r)},2),n=numeric(val.value,(parsed.formulas||{})[val.cellRef],true);(profSources[k]=profSources[k]||{})[name]=val.cellRef;if(n.status==="valid")(profs[k]=profs[k]||{})[name]=n.value;}
  });
  function features(type){
   var headings=g.all.filter(function(a){return type==="race"?a.text==="种族特性":/^(?:职业特性(?:\(.*\))?|.{1,20}职业特性)$/.test(a.text);}),result=[];
   headings.forEach(function(h){var span=g.span(h.ref),end=g.maxRow+1;g.all.forEach(function(a){if(a.row>h.row&&a.col===h.col&&(/特性/.test(a.text)&&headings.some(function(x){return x.ref===a.ref;})||/^(?:技能列表|天赋列表|专业列表)$/.test(a.text)))end=Math.min(end,a.row);});
    var stop=g.all.find(function(a){return a.row>h.row&&/^(?:技能列表|天赋列表)$/.test(a.text);});if(stop)end=Math.min(end,stop.row);
    for(var r=span.bottom+1;r<end;r++){var value=g.cells[l.ref(h.col,r)];if(!value)continue;var name=String(value).trim();if(!name||/职业特性|种族特性/.test(name))continue;var spanN=g.span(l.ref(h.col,r)),desc=refValue(g,spanN.right+1,r);if(desc.cellRef&&l.point(desc.cellRef).col>span.right)desc={value:"",cellRef:""};result.push({name:name,desc:desc.value||"",provenance:{sheet:parsed.sheetName,nameRef:l.ref(h.col,r),descRef:desc.cellRef,header:h.ref,label:h.value}});}
   });return result;
  }
  var racial=features("race"),classFeatures=features("class"),supp=l.supplemental(parsed);
  var eqHead=label(g,["\u88c5\u5907\u680f","\u88c5\u5907\u4fe1\u606f","\u88c5\u5907\u5217\u8868"]),equipment={},groups=[],mappedEquipment=parsed.equipmentMappings||[];
  var slotPattern=/^(?:\u6b66\u5668|\u4e3b\u624b\u6b66\u5668|\u526f\u624b\u6b66\u5668|\u9632\u5177|\u670d\u88c5|\u670d\u9970|\u914d\u9970|\u80cc\u5305(?:\(.*\))?|\u65c5\u884c\u8170\u5305(?:\(.*\))?|\u6742\u7269(?:\u5305)?|\u6750\u6599\u5305(?:\(.*\))?|.{1,12}\u6750\u6599\u5305)$/;
  function inventoryItem(slot,row,nameCol,descCol,weightCol,quantityCol,label){
   var nameRef=l.ref(nameCol,row),raw=g.cells[nameRef];if(!raw||SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(raw))return null;
   var desc=descCol==null?refValue(g,g.span(nameRef).right+1,row):refValue(g,descCol,row),w=weightCol==null?{value:"",cellRef:""}:refValue(g,weightCol,row);
   var n=numeric(String(w.value).replace(/\s*(?:\u78c5|lbs?)$/i,""),(parsed.formulas||{})[w.cellRef],true),q=String(w.value).match(/^(\d+)\s*(\u74f6|\u4e2a|\u4ef6|\u679a|\u5305)$/),explicitQ=quantityCol==null?null:refValue(g,quantityCol,row),count=explicitQ&&String(explicitQ.value).match(/^(\d+)\s*(.*)$/);
   var item={item:String(raw).trim(),weight:n.status==="valid"?n.value:0,weightStatus:n.status==="valid"?"known":q?"quantity":"unknown",rawWeight:w.value,desc:SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(desc.value)?"":desc.value,sourceSlot:label,uid:"item-"+nameRef,provenance:{sheet:parsed.sheetName,nameRef:nameRef,descRef:desc.cellRef,weightRef:w.cellRef,quantityRef:explicitQ&&explicitQ.cellRef||"",evidence:"equipment-field-headings"}};
   if(q){item.count=Number(q[1]);item.quantityUnit=q[2];item.weight=0;}if(count){item.count=Number(count[1]);item.quantityUnit=count[2];}
   return item;
  }
  function readEquipmentGroup(group){
   var items=[];for(var row=group.start;row<group.end;row++){var item=inventoryItem(group.slot,row,group.nameCol,group.descCol,group.weightCol,group.quantityCol,group.label);if(item)items.push(item);}
   if(group.slot==="\u6750\u6599\u5305"){if(items.length)equipment[group.slot]=(equipment[group.slot]||[]).concat([{type:group.type||"",rawLabel:group.label,items:items,uid:"container-"+group.header}]);}
   else equipment[group.slot]=(equipment[group.slot]||[]).concat(items);
   group.items=items.map(function(i){return i.uid;});groups.push(group);
  }
  if(eqHead){
   var boundary=g.all.filter(function(a){var t=SNOWD_CHARACTER_IMPORT_SCHEMA.title(a.value);return a.row>eqHead.row&&t&&["features","skills","talents"].indexOf(t.type)>=0;}).reduce(function(n,a){return Math.min(n,a.row);},g.maxRow+1);
   var headers=g.all.filter(function(a){return a.row>eqHead.row&&a.row<boundary&&a.col===eqHead.col&&slotPattern.test(a.text);}).sort(function(a,b){return a.row-b.row;}),weapon=0;
   var formal=g.all.filter(function(a){return a.row>=eqHead.row&&a.row<boundary&&a.col>eqHead.col&&/^(?:\u540d\u79f0|\u7269\u54c1\u540d\u79f0|\u88c5\u5907\u540d\u79f0)$/.test(a.text)&&(g.byRow[a.row]||[]).some(function(n){return n.col>a.col&&/^(?:\u6548\u679c|\u8bf4\u660e|\u63cf\u8ff0|\u78c5\u91cd|\u91cd\u91cf|\u91cd\u91cf\(\u78c5\)|\u78c5\u91cd\/\u6570\u91cf|\u6570\u91cf)$/.test(n.text);});});
   headers.forEach(function(h,i){var clean=h.text.replace(/\([^)]*\)/g,""),slot=clean,end=i+1<headers.length?headers[i+1].row:boundary;
    if(clean==="\u6b66\u5668")slot=weapon++===0?"\u4e3b\u624b\u6b66\u5668":"\u526f\u624b\u6b66\u5668";if(clean==="\u6742\u7269")slot="\u6742\u7269\u5305";if(clean==="\u670d\u88c5")slot="\u670d\u9970";if(/\u6750\u6599\u5305$/.test(clean))slot="\u6750\u6599\u5305";
    var head=formal.filter(function(a){return a.row<=h.row;}).sort(function(a,b){return b.row-a.row;})[0]||formal.find(function(a){return a.row>=h.row&&a.row<end;});
    var nameCol=null,descCol=null,weightCol=null,quantityCol=null,start=h.row;
    if(head){nameCol=head.col;var row=g.byRow[head.row]||[];row.forEach(function(a){if(a.col<nameCol)return;if(/^(?:\u6548\u679c|\u8bf4\u660e|\u63cf\u8ff0)$/.test(a.text))descCol=a.col;if(/^(?:\u78c5\u91cd|\u91cd\u91cf|\u91cd\u91cf\(\u78c5\)|\u78c5\u91cd\/\u6570\u91cf)$/.test(a.text))weightCol=a.col;if(a.text==="\u6570\u91cf")quantityCol=a.col;});if(head.row>=h.row)start=head.row+1;}
    if(nameCol===null){var span=g.span(h.ref),first=g.all.find(function(a){return a.row>=h.row&&a.row<end&&a.col>span.right&&!SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(a.value)&&!numeric(a.value,null,true).value;});if(!first)first=(g.byRow[h.row]||[]).find(function(a){return a.col>span.right&&!SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(a.value);});if(first)nameCol=first.col;}
    if(nameCol===null){issues.push({kind:"equipment-unrecognized",cellRef:h.ref,note:"\u7269\u54c1\u533a\u57df\u540d\u79f0\u5217\u672a\u5b9a\u4f4d\uff0c\u8bf7\u6620\u5c04\u539f\u59cb\u5217\u3002"});return;}
    if(descCol===null){var sample=g.all.find(function(a){return a.row>=start&&a.row<end&&a.col===nameCol&&!SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(a.value);});if(sample){var next=(g.byRow[sample.row]||[]).find(function(a){return a.col>g.span(sample.ref).right&&(weightCol==null||a.col<weightCol)&&!numeric(a.value,null,true).value&&!SNOWD_CHARACTER_IMPORT_SCHEMA.isLabel(a.value);});if(next)descCol=next.col;}}
    if(!mappedEquipment.some(function(m){var b=SNOWD_CHARACTER_STRUCTURE.bounds(m.range);return b&&b.top<end&&b.bottom>=start;}))readEquipmentGroup({slot:slot,type:slot==="\u6750\u6599\u5305"&&clean!=="\u6750\u6599\u5305"?clean:"",label:h.value,header:h.ref,start:start,end:end,nameCol:nameCol,descCol:descCol,weightCol:weightCol,quantityCol:quantityCol});
   });
  }
  mappedEquipment.forEach(function(m){if(m.sheet&&m.sheet!==parsed.sheetName)return;var b=SNOWD_CHARACTER_STRUCTURE.bounds(m.range);if(!b)return;var cols={};["nameCol","descCol","weightCol","quantityCol"].forEach(function(k){var p=m[k]&&l.point(String(m[k]).toUpperCase()+"1");cols[k]=p?p.col:null;});if(cols.nameCol!==null)readEquipmentGroup(Object.assign({slot:m.slot||"\u6742\u7269\u5305",label:m.slot||"\u6742\u7269\u5305",header:l.ref(b.left,b.top),start:b.top,end:b.bottom+1,type:m.type||""},cols));});
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
  Object.keys(sources).forEach(function(k){var v=sources[k];if(["invalid","uncached","ambiguous"].indexOf(v.status)>=0)issues.push({kind:v.status==="ambiguous"?"field-ambiguous":"field-invalid",field:k,note:"字段存在歧义或无法解析，请绑定原始单元格："+(v.label||k),source:v});});
  return {values:values,stats:stats,sources:sources,attrs:attrs,attrSources:attrSources,profs:profs,profSources:profSources,carry:carry,carrySources:carrySources,equipment:eqHead||mappedEquipment.length?equipment:null,equipmentGroups:groups,context:{pending:context.pending,entities:context.entities,signature:context.signature},racial_traits:racial,class_features:classFeatures,special_feats:supp.feats,currency:supp.values.currency||{},issues:issues.concat(supp.issues),notes:notes};
 }
 function apply(s,parsed){
  var r=read(parsed),v=r.values;
  Object.keys(v).forEach(function(k){s[k]=v[k];});Object.keys(r.sources).forEach(function(k){var source=r.sources[k];if(source.status!=="valid"&&["hp","fp","ac","atk","spell","init","speed","hpRecover","fpRecover","xp","sp_points","keyAttr"].indexOf(k)<0)s[k]=["languages","professionals"].indexOf(k)>=0?[]:"";});
  s.attrs=r.attrs;s.profs=r.profs;s.importEntityInfo=r.context;s.importFieldBindings=parsed.fieldBindings||[];s.importEntityScope=parsed.entityScope||"";s.importEntityId=parsed.entityId||"";s.importEquipmentMappings=parsed.equipmentMappings||[];
  Object.keys(r.carry).forEach(function(k){s.carry_capacity[k]=r.carry[k];});Object.keys(r.currency).forEach(function(k){s.currency[k]=r.currency[k];});
  if(r.equipment!==null){s.equipment=Object.assign({"主手武器":[],"副手武器":[],"防具":[],"配饰":[],"背包":[],"杂物包":[],"旅行腰包":[],"材料包":[]},r.equipment);s.equipmentLayoutGroups=r.equipmentGroups;}
  if(r.special_feats!==null)s.special_feats=r.special_feats;s.racial_traits=r.racial_traits;s.class_features=r.class_features;
  s.fieldSources={schemaVersion:1,scalar:r.sources,attrs:r.attrSources,profs:r.profSources,carry:r.carrySources};
  s.importIssues=(s.importIssues||[]).filter(function(i){return ["field-unmapped","field-invalid","field-ambiguous","entity-unconfirmed"].indexOf(i.kind)<0;}).concat(r.issues);s.unmappedFields=r.issues.filter(function(i){return i.kind==="field-unmapped";});
  s.importNotes=r.notes;SNOWD_CHARACTER_STATS.fromSheet(s,r.stats);return r;
 }
 return {numeric:numeric,read:read,apply:apply,readLabel:readLabel,statLabels:statLabels};
})();
