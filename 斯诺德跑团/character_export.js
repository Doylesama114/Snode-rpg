/* One scalar export path for upload and panel. Source-layout writes are explicit. */
var SNOWD_CHARACTER_EXPORT=(function(){
 function readSources(parsed){return SNOWD_CHARACTER_FIELDS.read(parsed);}
 function text(s){return String(s==null?"":s);}
 function write(set,state,parsed,original){
  var l=SNOWD_CHARACTER_LAYOUT,g=l.grid(parsed),data=readSources(parsed),stats=SNOWD_CHARACTER_STATS.read(state),dest=data.sources;
  function putSource(source,value){if(!source||!source.cellRef||value===null||value===undefined)return;if(source.inline)set(source.cellRef,source.label.split(/[:：]/)[0]+"："+value);else set(source.cellRef,value);}
  if(original){
   Object.keys(dest).forEach(function(k){if(Object.prototype.hasOwnProperty.call(SNOWD_CHARACTER_STATS.labels,k))putSource(dest[k],stats[k]);else if(k==="keyAttr")putSource(dest[k],stats.keyAttr);else if(k==="languages"||k==="professionals")putSource(dest[k],(state[k]||[]).map(function(v){return v&&typeof v==="object"?v.name||v.n||v.item||"":v;}).filter(Boolean).join("、"));else if(state[k]!==undefined)putSource(dest[k],state[k]);});
   Object.keys(data.attrSources).forEach(function(k){if(state.attrs&&state.attrs[k]!==undefined)set(data.attrSources[k],state.attrs[k]);});
   Object.keys(data.profSources).forEach(function(k){Object.keys(data.profSources[k]).forEach(function(n){var v=state.profs&&state.profs[k]&&state.profs[k][n];set(data.profSources[k][n],v===undefined?"":v);});});
   Object.keys(data.carrySources).forEach(function(k){if(state.carry_capacity&&state.carry_capacity[k]!==undefined)set(data.carrySources[k],state.carry_capacity[k]);});
   ["金币","银币","铜币","其他货币"].forEach(function(label){
    var v=SNOWD_CHARACTER_FIELDS.readLabel(parsed,g,[label]);if(v.cellRef){var key=label==="其他货币"?"其他":label;putSource(v,state.currency&&state.currency[key]);}
   });
   (state.importFieldMappings||[]).forEach(function(m){if(m.sheet===parsed.sheetName&&state.currency&&state.currency[m.field]!==undefined)set(m.cellRef,state.currency[m.field]);});
   (state.racial_traits||[]).concat(state.class_features||[]).forEach(function(f){var p=f.provenance;if(p&&p.sheet===parsed.sheetName){set(p.nameRef,f.name);if(p.descRef)set(p.descRef,f.desc||"");}});
   (state.special_feats||[]).forEach(function(f){var ref=f.cellRef||f.provenance&&f.provenance.nameRef;if(ref)set(ref,f.originalName||f.name||"");});
   [["主职业"],["子职业","副职业"],["附赠职业"]].forEach(function(labels,i){
    var label=l.findLabel(parsed,labels);if(!label)return;var p=l.point(label),span=g.span(label),row=span.bottom+1,head=g.byRow[row]||[],name=head.find(function(a){return a.text==="名称"||a.text==="职业名称";}),level=head.find(function(a){return a.text==="等级";}),style=head.find(function(a){return a.text==="风格";}),r=name?row+1:row,c=state.classes&&state.classes[i];
    if(c){var nr=l.ref(name?name.col:p.col,r),lr=l.ref(level?level.col:p.col+2,r);set(nr,c.name||"");set(lr,c.name?c.level:"");if(style)for(var j=0;j<4;j++)set(l.ref(style.col,r+j),c.styles&&c.styles[j]||"");if(c.name)c.provenance={sheet:parsed.sheetName,fields:{name:nr,level:lr},section:label};}
   });
  }else{
   var cells={hp:"L3",fp:"L4",ac:"L7",atk:"L11",spell:"L12",init:"L8",speed:"L9",hpRecover:"L5",fpRecover:"L6"};Object.keys(cells).forEach(function(k){if(stats[k]!==null&&stats[k]!==undefined)set(cells[k],stats[k]);});set("L10",stats.keyAttr);
  }
   var written={};
   (data.equipmentGroups||[]).forEach(function(group){
    var list=(state.equipment&&state.equipment[group.slot]||[]).reduce(function(out,e){return e.items?(e.rawLabel===group.label||!e.rawLabel&&(!e.type||group.label.indexOf(e.type)>=0)?out.concat(e.items):out):out.concat(e);},[]);
    var available=[];for(var r=group.start;r<group.end;r++){var nameRef=l.ref(group.nameCol,r),raw=g.cells[nameRef];if(raw&&/^(?:名称|效果|说明|重量|磅重)$/.test(l.normalize(raw)))continue;if(!raw&&(parsed.formulas||{})[l.ref(group.weightCol,r)])continue;available.push(r);}
    for(var i=0;i<available.length;i++){var row=available[i],e=list[i];set(l.ref(group.nameCol,row),e?e.item||e.name:"");set(l.ref(group.descCol,row),e?e.desc||"":"");set(l.ref(group.weightCol,row),e?(e.weightStatus==="quantity"?(e.count||0)+(e.quantityUnit||""):e.weightStatus==="unknown"?e.rawWeight||"":e.weight):"");if(e){written[e.uid||group.slot+"-"+i]=true;e.provenance={sheet:parsed.sheetName,nameRef:l.ref(group.nameCol,row),descRef:l.ref(group.descCol,row),weightRef:l.ref(group.weightCol,row)};}}
   });
   var next=Math.max(240,g.maxRow+3,parsed.exportNextRow||0),extra=[],oldExtra=g.all.find(function(a){return a.text==="装备补充列表";});if(oldExtra){for(var row=oldExtra.row;row<=g.maxRow;row++){if(row>oldExtra.row&&g.cells["B"+row]&&g.cells["B"+row].indexOf("列表")>=0)break;["B","D","E","F","G"].forEach(function(col){set(col+row,"");});}next=oldExtra.row;}
   Object.keys(state.equipment||{}).forEach(function(slot){(state.equipment[slot]||[]).forEach(function(e,i){if(!e.items&&!written[e.uid||slot+"-"+i])extra.push({slot:slot,item:e});});});
   if(extra.length){set("B"+next++,"装备补充列表");[["B","名称"],["D","原分区"],["E","重量"],["F","数量"],["G","说明"]].forEach(function(p){set(p[0]+next,p[1]);});next++;extra.forEach(function(p){var e=p.item;set("B"+next,e.item||e.name);set("D"+next,p.slot);set("E"+next,e.weightStatus==="known"?e.weight:"");set("F"+next,e.count?e.count+(e.quantityUnit||""):"");set("G"+next,e.desc||"");e.provenance={sheet:parsed.sheetName,nameRef:"B"+next,descRef:"G"+next,weightRef:"E"+next};next++;});}

  var extras=(state.special_feats||[]).filter(function(f){return f&&f.imported||f&&f.level===null;});
  if(extras.length){
   var existing=g.all.find(function(a){return a.text==="额外专长列表";}),row=existing?existing.row:Math.max(240,g.maxRow+3,parsed.exportNextRow||0,next||0);
   set("B"+row++,"额外专长列表");set("B"+row,"专长名称");set("D"+row,"获得途径");set("F"+row++,"说明");
   extras.forEach(function(f){set("B"+row,f.name);set("D"+row,f.via||"");set("F"+row,f.note||"");f.provenance={sheet:parsed.sheetName,nameRef:"B"+row};row++;});
  }
  var unmapped=Object.keys(SNOWD_CHARACTER_STATS.labels).filter(function(k){return (!dest[k]||!dest[k].cellRef)&&stats.fields[k].mode==="fixed"&&stats[k]!==null;});
  if(unmapped.length){
   var row=Math.max(240,g.maxRow+3,parsed.exportNextRow||0,next||0)+(extras.length?extras.length+4:0);
   set("B"+row++,"角色补充字段");
   unmapped.forEach(function(k){set("B"+row,SNOWD_CHARACTER_STATS.labels[k]);set("D"+row,stats[k]);dest[k]={cellRef:"D"+row,labelRef:"B"+row,sheet:parsed.sheetName,status:"valid",raw:text(stats[k]),value:stats[k],label:SNOWD_CHARACTER_STATS.labels[k]};row++;});
  }
  state.fieldSources={schemaVersion:1,scalar:dest,attrs:data.attrSources,profs:data.profSources,carry:data.carrySources};
  Object.keys(dest).forEach(function(k){if(Object.prototype.hasOwnProperty.call(SNOWD_CHARACTER_STATS.labels,k)){dest[k].raw=text(stats[k]);dest[k].status=stats[k]===null?"missing":"valid";dest[k].value=stats[k];}});
 }
 function createEditor(source,addString,styles){
  var document=new DOMParser().parseFromString(source,"application/xml");if(document.getElementsByTagName("parsererror").length)throw Error("导出源工作表 XML 无效");
  var ns=document.documentElement.namespaceURI,sheetData=document.getElementsByTagNameNS("*","sheetData")[0],cells={},rows={};
  Array.prototype.forEach.call(sheetData.getElementsByTagNameNS("*","row"),function(row){rows[row.getAttribute("r")]=row;});
  Array.prototype.forEach.call(sheetData.getElementsByTagNameNS("*","c"),function(cell){cells[cell.getAttribute("r")]=cell;});
  function set(ref,value,invent,styleId){
   var old=cells[ref];if(!old&&invent===false)return;var p=SNOWD_CHARACTER_LAYOUT.point(ref);if(!p)throw Error("导出单元格无效："+ref);
   var row=rows[p.row];if(!row){row=document.createElementNS(ns,"row");row.setAttribute("r",String(p.row));var before=null;for(var node=sheetData.firstChild;node;node=node.nextSibling)if(node.nodeType===1&&Number(node.getAttribute("r"))>p.row){before=node;break;}sheetData.insertBefore(row,before);rows[p.row]=row;}
   var cell=document.createElementNS(ns,"c");cell.setAttribute("r",ref);var style=styleId!==undefined&&styleId!==null&&styleId!==""?String(styleId):old&&old.getAttribute("s")||styles&&styles[ref]||"";if(style)cell.setAttribute("s",style);
   if(value!==null&&value!==undefined&&value!==""){var v=document.createElementNS(ns,"v");if(typeof value==="number"){if(!Number.isFinite(value))throw Error("导出数值无效："+ref);v.textContent=String(value);}else{cell.setAttribute("t","s");v.textContent=String(addString(String(value)));}cell.appendChild(v);}
   if(old)old.parentNode.replaceChild(cell,old);else{var before=null;for(var node=row.firstChild;node;node=node.nextSibling)if(node.nodeType===1){var q=SNOWD_CHARACTER_LAYOUT.point(node.getAttribute("r"));if(q&&q.col>p.col){before=node;break;}}row.insertBefore(cell,before);}cells[ref]=cell;
  }
  return {set:set,serialize:function(){
    var points=Object.keys(cells).map(SNOWD_CHARACTER_LAYOUT.point),dimension=document.getElementsByTagNameNS("*","dimension")[0];
    if(points.length&&dimension){var minRow=Math.min.apply(null,points.map(function(p){return p.row;})),maxRow=Math.max.apply(null,points.map(function(p){return p.row;})),minCol=Math.min.apply(null,points.map(function(p){return p.col;})),maxCol=Math.max.apply(null,points.map(function(p){return p.col;}));dimension.setAttribute("ref",SNOWD_CHARACTER_LAYOUT.ref(minCol,minRow)+":"+SNOWD_CHARACTER_LAYOUT.ref(maxCol,maxRow));}
    return new XMLSerializer().serializeToString(document);
  }};
 }
 function normalizeMerges(xml,state){
  var resolved=[];(state.skills||[]).concat(state.talent_tree||[]).forEach(function(e){(e.mergedNotes||[]).forEach(function(n){if(n.status==="confirmed"&&n.target!=="note")resolved.push(n.range);});});
  if(!resolved.length)return xml;var d=new DOMParser().parseFromString(xml,"application/xml"),removed=0;
  Array.prototype.slice.call(d.getElementsByTagNameNS("*","mergeCell")).forEach(function(n){if(resolved.indexOf(n.getAttribute("ref"))>=0){n.parentNode.removeChild(n);removed++;}});
  Array.prototype.slice.call(d.getElementsByTagNameNS("*","mergeCells")).forEach(function(n){n.setAttribute("count",String(n.getElementsByTagNameNS("*","mergeCell").length));});
  return removed?new XMLSerializer().serializeToString(d):xml;
 }
 return {write:write,normalizeMerges:normalizeMerges,createEditor:createEditor};
})();
