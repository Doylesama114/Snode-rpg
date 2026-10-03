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
  var l=SNOWD_CHARACTER_LAYOUT,g=l.grid(parsed),out=[{name:"",level:1,styles:["","","",""]},{name:"",level:0,styles:["","","",""]},{name:"",level:0,styles:["","","",""]}],issues=[];
  [["主职业","职业"],["子职业","副职业"],["附赠职业","赠送职业"]].forEach(function(labels,slot){
   var label=l.findLabel(parsed,labels);if(!label)return;var p=l.point(label),span=g.span(label),end=Math.min(g.maxRow+1,p.row+9);
   g.all.forEach(function(a){if(a.row>p.row&&a.row<end&&a.col===p.col&&(title(a.text)||/^(?:属性信息|装备信息|技能列表|天赋列表)$/.test(a.text)))end=a.row;});
   var header=(g.byRow[span.bottom+1]||[]),nameHead=header.find(function(a){return a.col>=p.col&&/^(?:名称|职业名称|职业名)$/.test(a.text);});
   var nameCol=nameHead?nameHead.col:p.col,levelHead=header.find(function(a){return /^(?:等级|职业等级)$/.test(a.text);}),styleHead=header.find(function(a){return /^(?:风格|风格名)$/.test(a.text);});
   var row=(nameHead?nameHead.row+1:span.bottom+1),raw="",found=0;
   for(var r=row;r<end;r++){var v=g.cells[l.ref(nameCol,r)];if(v&&String(v).trim()&&!/^(?:名称|等级|风格)$/.test(l.normalize(v))){raw=String(v).trim();found=r;break;}}
   if(!raw)return;var levelRef=levelHead?l.ref(levelHead.col,found):l.ref(nameCol+2,found),rawLevel=String(g.cells[levelRef]==null?"":g.cells[levelRef]).trim(),levelMatch=rawLevel.match(/^(\d+)\s*级?$/),number=levelMatch?Number(levelMatch[1]):NaN,c=out[slot],id=identify(raw);
   c.name=raw;c._rawName=raw;c.originalName=raw;c.level=Number.isFinite(number)&&Number.isInteger(number)&&number>=0?number:null;c.levelStatus=c.level===null?(rawLevel?"invalid":"missing"):"valid";c.rawLevel=rawLevel;c.kind=id.kind;c.baseClass=id.baseClass||"";c.baseCandidates=id.baseCandidates;c.advancementId=id.definition?id.definition.ids[0]:"";c.ownerClassIndex=slot;
   c.provenance={sheet:parsed.sheetName,fields:{name:l.ref(nameCol,found),level:levelRef},section:label};c.uid="class-"+slot+"-"+l.ref(nameCol,found);
   if(styleHead)for(var j=0;j<4&&found+j<end;j++)c.styles[j]=String(g.cells[l.ref(styleHead.col,found+j)]||"");
   if(id.kind==="advanced"||id.kind==="unknown")issues.push({kind:"class-unconfirmed",classIndex:slot,name:raw,note:id.kind==="advanced"?"已识别进阶职业，请确认规则基础职业；保留原名及等级。":"职业原名已保留，规则基础待确认。",candidates:id.baseCandidates});
  });
  if(out[0].name&&out[1].name&&out[0].name===out[1].name){out[1].levelMeaning="unconfirmed";issues.push({kind:"class-record-conflict",classIndex:1,name:out[1].name,note:"主副栏填写同名职业，已保留两条记录；请确认是独立职业记录还是续写等级。"});}
  return {classes:out,issues:issues};
 }
 function confirmBase(c,base,levelMeaning){
  var id=identify(c.name);if(id.kind==="advanced"&&id.baseCandidates.indexOf(base)<0)throw new Error("请选择该进阶允许的基础职业");
  if(base&&(data().base||[]).indexOf(base)<0)throw new Error("规则基础职业无效");
  c.baseClass=base||"";c.kind=id.kind;c.baseConfirmed=!!base||id.kind==="base";if(levelMeaning)c.levelMeaning=levelMeaning;return c;
 }
 function pending(s){return (s.classes||[]).reduce(function(out,c,i){if(!c.name)return out;if(c.level===null||c.levelStatus&&c.levelStatus!=="valid")out.push({kind:"class-level-unconfirmed",classIndex:i,name:c.name,note:"职业等级未能可靠读取，请填写等级或保存草稿"});var id=identify(c.name);if(!c.rulesDisabled&&!ruleName(c))out.push({kind:"class-unconfirmed",classIndex:i,name:c.name,note:"规则基础职业待确认"});if(c.levelMeaning==="unconfirmed")out.push({kind:"class-record-conflict",classIndex:i,name:c.name,note:"同名职业记录含义待确认"});return out;},[]);}
 return {identify:identify,ruleName:ruleName,read:read,title:title,confirm:confirmBase,pending:pending,data:data};
})();
