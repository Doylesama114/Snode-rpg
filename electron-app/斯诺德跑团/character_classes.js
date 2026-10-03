/* Character identity is independent from the skill catalogue. */
var SNOWD_CHARACTER_CLASSES=(function(){
 function normalize(s){return String(s==null?"":s).trim().replace(/[（]/g,"(").replace(/[）]/g,")");}
 function data(){return typeof SNOWD_CHARACTER_CLASS_DATA!=="undefined"?SNOWD_CHARACTER_CLASS_DATA:{base:[],advancements:[]};}
 function identify(name){
  var raw=normalize(name),d=data(),advance=(d.advancements||[]).find(function(a){return a.name===raw;});
  if(advance)return {kind:"advanced",definition:advance,baseCandidates:advance.source_classes.slice()};
  if((d.base||[]).indexOf(raw)>=0)return {kind:"base",baseClass:raw,baseCandidates:[raw]};
  return {kind:raw?"unknown":"empty",baseCandidates:[]};
 }
 function ruleName(c){if(!c||c.rulesDisabled)return "";var id=identify(c.name);return id.kind==="base"?id.baseClass:(c.baseClass&&(id.kind!=="advanced"||id.baseCandidates.indexOf(c.baseClass)>=0)?c.baseClass:"");}
 function title(text){
  text=normalize(text).replace(/\s/g,"").replace(/(?:当前槽位|容量|占用数量)[:：]?\d+$/,"");
  if(/^(?:子职业|副职业)(?:技能)?(?:\(.*\))?$/.test(text))return {slot:1};
  if(/^(?:附赠职业|赠送职业)(?:技能)?(?:\(.*\))?$/.test(text))return {slot:2};
  if(/^(?:主职业)(?:技能)?(?:\(.*\))?$/.test(text))return {slot:0};
  var m=text.match(/^(.{1,24}?)(附赠职业|赠送职业|子职业|副职业|职业)(?:技能)?(?:\(.*\))?$/);
  if(m&&!/信息|特性|来源/.test(m[1]))return {slot:/附赠|赠送/.test(m[2])?2:/子|副/.test(m[2])?1:0,className:m[1]};
  return null;
 }
 function read(parsed){
  var l=SNOWD_CHARACTER_LAYOUT,g=l.grid(parsed),context=SNOWD_CHARACTER_STRUCTURE.analyze(parsed,g),schema=SNOWD_CHARACTER_IMPORT_SCHEMA,out=[{name:"",level:null,styles:["","","",""]},{name:"",level:0,styles:["","","",""]},{name:"",level:0,styles:["","","",""]}],issues=[],extra=[];
  [["主职业","主职","职业"],["子职业","副职业","副职"],["附赠职业","赠送职业"]].forEach(function(labels,slot){
   var candidates=g.all.filter(function(a){return context.eligible(a)&&schema.match(a.value,labels)&&!(context.sectionAt(a.ref)&&["skills","talents","blueprints"].indexOf(context.sectionAt(a.ref).type)>=0);}),tables=[];
   candidates.forEach(function(h){
    var span=g.span(h.ref),end=g.maxRow+1;
    g.all.forEach(function(a){if(a.row>span.bottom&&a.col===h.col&&(title(a.text)||schema.title(a.value)&&schema.title(a.value).type!=="classes"))end=Math.min(end,a.row);});
    var header=g.all.find(function(a){return a.row>span.bottom&&a.row<end&&a.col>=h.col&&/^(?:名称|职业名称|职业名)$/.test(a.text)&&(g.byRow[a.row]||[]).some(function(n){return n.col>a.col&&/^(?:等级|职业等级)$/.test(n.text);});});
    if(!header)return;var row=g.byRow[header.row]||[],levelHead=row.find(function(a){return a.col>header.col&&/^(?:等级|职业等级)$/.test(a.text);}),styleHead=row.find(function(a){return a.col>header.col&&/^(?:风格|风格名)$/.test(a.text);});
    var found=g.all.find(function(a){return a.row>header.row&&a.row<end&&a.col===header.col&&!schema.isLabel(a.value);});if(!found)return;
    tables.push({raw:found.value,levelRaw:g.value(levelHead.col,found.row),nameRef:found.ref,levelRef:l.ref(levelHead.col,found.row),header:h.ref,row:found.row,end:end,styleHead:styleHead,evidence:"class-table-headings"});
   });
   var nameBinding=(parsed.fieldBindings||[]).find(function(m){return m.field==="classes."+slot+".name"&&m.confirmed;});
   if(nameBinding)tables=[];
   var chosen=tables.length===1?tables[0]:null;
   if(tables.length>1){issues.push({kind:"class-field-ambiguous",classIndex:slot,note:"职业表存在多个合理候选，请绑定名称和等级。",candidates:tables});return;}
   if(!chosen&&typeof SNOWD_CHARACTER_FIELDS!=="undefined"){
    var scoped=Object.assign({},g,{_parsed:parsed,_context:context}),name=SNOWD_CHARACTER_FIELDS.readLabel(parsed,scoped,schema.aliases["classes."+slot+".name"],{key:"classes."+slot+".name"}),level=SNOWD_CHARACTER_FIELDS.readLabel(parsed,scoped,schema.aliases["classes."+slot+".level"],{key:"classes."+slot+".level",numeric:true,nonnegative:true});
    if(name.status==="valid")chosen={raw:name.value,levelRaw:level.raw,nameRef:name.cellRef,levelRef:level.cellRef,header:name.labelRef,inline:name.inline,levelInline:level.inline,evidence:name.evidence,styleHead:null};
    else if(name.status==="ambiguous")issues.push({kind:"class-field-ambiguous",classIndex:slot,note:"职业名称有多个候选，需确认。",candidates:name.candidates});
   }
   if(!chosen)return;var raw=String(chosen.raw).trim(),levelText=String(chosen.levelRaw||"").trim(),number=Number(levelText.replace(/级$/,"")),valid=levelText!==""&&Number.isFinite(number)&&Number.isInteger(number)&&number>=0,c=out[slot],id=identify(raw);
   Object.assign(c,{name:raw,_rawName:raw,originalName:raw,level:valid?number:null,levelStatus:valid?"valid":levelText?"invalid":"missing",rawLevel:levelText,kind:id.kind,baseClass:id.baseClass||"",baseCandidates:id.baseCandidates,advancementId:id.definition?id.definition.ids[0]:"",ownerClassIndex:slot,uid:"class-"+slot+"-"+chosen.nameRef,provenance:{sheet:parsed.sheetName,fields:{name:chosen.nameRef,level:chosen.levelRef},section:chosen.header,evidence:chosen.evidence,inlineName:chosen.inline,inlineLevel:chosen.levelInline}});
   if(chosen.styleHead)for(var j=0;j<4&&chosen.row+j<chosen.end;j++){var value=g.value(chosen.styleHead.col,chosen.row+j);if(value&&!schema.isLabel(value))c.styles[j]=value;}
   if(id.kind==="advanced"||id.kind==="unknown")issues.push({kind:"class-unconfirmed",classIndex:slot,name:raw,note:"职业原名和等级已保留，规则基础待确认。",candidates:id.baseCandidates});
  });
  if(out[0].name&&out[1].name&&out[0].name===out[1].name){out[1].levelMeaning="unconfirmed";issues.push({kind:"class-record-conflict",classIndex:1,name:out[1].name,note:"同名主副职业记录含义待确认。"});}
  return {classes:out,issues:issues,additional:extra};
 }
 function confirmBase(c,base,levelMeaning){
  var id=identify(c.name);if(id.kind==="advanced"&&id.baseCandidates.indexOf(base)<0)throw new Error("请选择该进阶允许的基础职业");
  if(base&&(data().base||[]).indexOf(base)<0)throw new Error("规则基础职业无效");
  c.baseClass=base||"";c.kind=id.kind;c.baseConfirmed=!!base||id.kind==="base";if(levelMeaning)c.levelMeaning=levelMeaning;return c;
 }
 function pending(s){return (s.classes||[]).reduce(function(out,c,i){if(!c.name)return out;if(c.level===null||c.levelStatus&&c.levelStatus!=="valid")out.push({kind:"class-level-unconfirmed",classIndex:i,name:c.name,note:"职业等级未能可靠读取，请填写等级或保存草稿"});var id=identify(c.name);if(!c.rulesDisabled&&!ruleName(c))out.push({kind:"class-unconfirmed",classIndex:i,name:c.name,note:"规则基础职业待确认"});if(c.levelMeaning==="unconfirmed")out.push({kind:"class-record-conflict",classIndex:i,name:c.name,note:"同名职业记录含义待确认"});return out;},[]);}
 return {identify:identify,ruleName:ruleName,read:read,title:title,confirm:confirmBase,pending:pending,data:data};
})();
