/* Spatial ownership and extraction evidence. This module never awards or writes character values. */
var SNOWD_CHARACTER_STRUCTURE=(function(){
 function schema(){return SNOWD_CHARACTER_IMPORT_SCHEMA;}
 function bounds(text){var parts=String(text||"").toUpperCase().split(":"),a=SNOWD_CHARACTER_LAYOUT.point(parts[0]),b=SNOWD_CHARACTER_LAYOUT.point(parts[1]||parts[0]);return a&&b?{left:Math.min(a.col,b.col),right:Math.max(a.col,b.col),top:Math.min(a.row,b.row),bottom:Math.max(a.row,b.row)}:null;}
 function contains(b,p){return !!b&&p.col>=b.left&&p.col<=b.right&&p.row>=b.top&&p.row<=b.bottom;}
 function analyze(parsed,g){
  g=g||SNOWD_CHARACTER_LAYOUT.grid(parsed);var s=schema(),all=g.all,titles=all.map(function(a){var t=s.title(a.value);return t?Object.assign({},a,t):null;}).filter(Boolean),entities=titles.filter(function(t){return t.kind==="entity";}),mains=[];
  entities.filter(function(e){return e.owner==="current";}).forEach(function(e){var previous=mains[mains.length-1];if(previous&&!e.explicitName&&(previous.row!==e.row||previous.col===e.col)&&!all.some(function(a){return a.row>previous.row&&a.row<e.row&&s.field(a.value)==="name";}))return;mains.push(e);});
  entities=entities.filter(function(e){return e.owner!=="current"||mains.some(function(m){return m.ref===e.ref;});});
  entities.forEach(function(e){
   var span=g.span(e.ref),end=g.maxRow;entities.forEach(function(n){if(n.row>e.row&&n.col===e.col)end=Math.min(end,n.row-1);});
   var nextHorizontal=entities.filter(function(n){return n.col>e.col&&n.row<=end&&n.row>=e.row;}).reduce(function(v,n){return Math.min(v,n.col-1);},g.maxCol),right=span.right;
   var identity=all.filter(function(a){return a.row>span.bottom&&a.row<=end&&a.col>=e.col&&a.col<=nextHorizontal&&["name","race","player"].indexOf(s.field(a.value))>=0;});
   if(e.owner==="current"||identity.length>=2)right=nextHorizontal;
   else{
    all.filter(function(a){return a.row>span.bottom&&a.row<=end&&a.col===e.col;}).forEach(function(a){var tail=g.span(a.ref).right;var row=g.byRow[a.row]||[];row.forEach(function(b){if(b.col>tail&&b.col<=tail+2){tail=Math.max(tail,g.span(b.ref).right);}});right=Math.max(right,tail);});
   }
   if(e.owner!=="current"&&identity.length<2){var first=g.byRow[span.bottom+1]||[],names=first.filter(function(a){return a.col>=e.col&&a.col<=right;});if(names.length>=2&&!names.some(function(a){return schema().isLabel(a.value);})){for(var r=span.bottom+2;r<=end;r++){var row=g.byRow[r]||[];if(!row.some(function(a){return a.col>=e.col&&a.col<=right;})){end=r-1;break;}}}}
   e.bounds={left:e.col,right:Math.min(right,nextHorizontal),top:e.row,bottom:end};e.id="entity-"+e.ref;e.name=e.explicitName||identity.filter(function(a){return s.field(a.value)==="name";}).map(function(a){var n=(g.byRow[a.row]||[]).find(function(b){return b.col>g.span(a.ref).right&&!s.isLabel(b.value);});return n&&n.value;}).filter(Boolean)[0]||e.value;
  });
  var sections=titles.filter(function(t){return t.kind==="section";}).map(function(h){
    var span=g.span(h.ref),right=span.right,end=g.maxRow;
    var localEnd=titles.filter(function(n){return n.row>h.row;}).reduce(function(r,n){return Math.min(r,n.row);},g.maxRow+1);
    if(right===h.col&&["skills","talents","blueprints"].indexOf(h.type)<0){all.filter(function(a){return a.row>h.row&&a.row<localEnd&&a.col===h.col;}).forEach(function(a){var row=g.byRow[a.row]||[],next=row.find(function(n){return n.col>g.span(a.ref).right;});right=Math.max(right,g.span(a.ref).right,next?g.span(next.ref).right:h.col);});}
    if(right===h.col){var header=all.find(function(a){return a.row>span.bottom&&a.col===h.col&&schema().abilityField(a.value)==="name";});if(header){var row=g.byRow[header.row]||[];row.forEach(function(a){if(a.col>=h.col&&schema().abilityField(a.value))right=Math.max(right,g.span(a.ref).right);});}}
    titles.forEach(function(n){if(n.row>h.row&&n.col>=h.col&&n.col<=right)end=Math.min(end,n.row-1);});
    return Object.assign({},h,{bounds:{left:h.col,right:right,top:span.bottom,bottom:end}});
  });
  function sectionAt(ref){var p=SNOWD_CHARACTER_LAYOUT.point(ref);return sections.filter(function(s){return p.row>s.bounds.top&&contains(s.bounds,p);}).sort(function(a,b){return b.row-a.row;})[0]||null;}
  var selected=parsed.entityScope&&bounds(parsed.entityScope),chosen=parsed.entityId&&entities.find(function(e){return e.id===parsed.entityId;}),active=selected||chosen&&chosen.bounds;
  function owner(ref){var p=SNOWD_CHARACTER_LAYOUT.point(ref);if(!p)return {owner:"unknown",id:""};if(active&&!contains(active,p))return {owner:"reference",id:"outside-selection"};
   var matches=entities.filter(function(e){return contains(e.bounds,p);}).sort(function(a,b){return b.row-a.row||b.col-a.col;});if(matches.length)return matches[0];
   return {owner:"current",id:chosen?chosen.id:mains.length===1?mains[0].id:"sheet-current",bounds:active||{left:0,right:g.maxCol,top:1,bottom:g.maxRow}};
  }
  function eligible(a){return owner(a.ref).owner==="current"&&(!active||contains(active,a));}
  return {grid:g,titles:titles,sections:sections,sectionAt:sectionAt,entities:entities,current:mains,selected:active,pending:!active&&mains.length>1,owner:owner,eligible:eligible,boundaryAt:function(a,left,right){var t=sections.find(function(s){return s.ref===a.ref;});if(t)return t.bounds.right>=left&&t.bounds.left<=right;var e=entities.find(function(e){return e.ref===a.ref;});if(e)return e.bounds.right>=left&&e.bounds.left<=right;var span=g.span(a.ref),edge=span.right,stop=titles.filter(function(n){return n.row>a.row;}).reduce(function(v,n){return Math.min(v,n.row);},g.maxRow+1);all.filter(function(n){return n.row>a.row&&n.row<stop&&n.col===a.col;}).forEach(function(n){var next=(g.byRow[n.row]||[]).find(function(v){return v.col>g.span(n.ref).right;});edge=Math.max(edge,g.span(n.ref).right,next?g.span(next.ref).right:edge);});return edge>=left&&a.col<=right;},signature:titles.map(function(t){return t.kind+":"+t.owner+":"+t.type+":"+s.normalize(t.value);}).join("|")};
 }
 function cell(parsed,g,col,row){var ref=SNOWD_CHARACTER_LAYOUT.ref(col,row),span=g.span(ref),anchor=SNOWD_CHARACTER_LAYOUT.ref(span.left,span.top),raw=g.cells[ref]!==undefined?g.cells[ref]:g.cells[anchor];return {cellRef:raw===undefined?ref:g.cells[ref]!==undefined?ref:anchor,value:raw===undefined?"":String(raw),span:span,formula:(parsed.formulas||{})[ref]||(parsed.formulas||{})[anchor]};}
 function afterLabel(parsed,g,a,context,valueKey){
  var span=g.span(a.ref),own=context.owner(a.ref),candidates=[],immediate=cell(parsed,g,span.right+1,a.row);
  if(immediate.value&&(!schema().isLabel(immediate.value)||valueKey==="keyAttr"&&schema().attrs.indexOf(immediate.value)>=0)&&context.owner(immediate.cellRef).owner===own.owner)return Object.assign(immediate,{evidence:"label-right",confidence:"explicit"});
  if(immediate.formula&&immediate.formula.cached===false)return Object.assign(immediate,{evidence:"label-formula",confidence:"explicit"});
  var row=g.byRow[a.row]||[];
  for(var i=0;i<row.length;i++){var c=row[i];if(c.col<=span.right)continue;if(schema().isLabel(c.value)||context.owner(c.ref).owner!==own.owner)break;candidates.push(cell(parsed,g,c.col,c.row));}
  var below=cell(parsed,g,a.col,span.bottom+1);
  if(below.value&&!schema().isLabel(below.value)&&context.owner(below.cellRef).owner===own.owner)candidates.push(Object.assign(below,{evidence:"label-below"}));
  if(candidates.length===1)return Object.assign(candidates[0],{evidence:candidates[0].evidence||"bounded-label-row",confidence:"supported"});
  if(candidates.length>1)return {value:"",cellRef:"",ambiguous:true,candidates:candidates.map(function(c){return {cellRef:c.cellRef,raw:c.value};}),evidence:"multiple-neighbours",confidence:"ambiguous"};
  return Object.assign(immediate,{value:"",confidence:"missing",evidence:"empty-labelled-field"});
 }
 function fieldCandidates(parsed,g,texts,context){
  context=context||analyze(parsed,g);var s=schema(),out=[];
  g.all.forEach(function(a){
   if(!context.eligible(a))return;var key=s.field(texts[0]),left=(g.byRow[a.row]||[]).filter(function(n){return n.col<a.col;}).slice(-1)[0];if(key.indexOf("attrs.")===0&&left&&s.field(left.value)==="keyAttr")return;var area=context.sectionAt(a.ref);if(area&&["skills","talents","blueprints","features","notes"].indexOf(area.type)>=0)return;var exact=s.match(a.value,texts),inline=null;
   if(!exact)texts.some(function(t){var parts=a.value.match(/^([^:：=]+)[:：=]\s*([\s\S]*)$/);if(parts&&s.match(parts[1],[t])){inline=parts[2];return true;}return false;});
   if(!exact&&inline===null)return;
   var candidate=inline!==null?{value:inline,cellRef:a.ref,evidence:"inline-label-value",confidence:"explicit",inline:true}:afterLabel(parsed,g,a,context,key);
   out.push(Object.assign(candidate,{labelRef:a.ref,label:a.value,sheet:parsed.sheetName||"",entity:context.owner(a.ref).id}));
  });return out;
 }
 function coverage(parsed,state){
  var g=SNOWD_CHARACTER_LAYOUT.grid(parsed),context=analyze(parsed,g),used={},categories={},source=state.fieldSources||{};
  function mark(ref,kind){if(ref){used[ref]=true;categories[ref]=kind;}}
  Object.keys(source.scalar||{}).forEach(function(k){var v=source.scalar[k];if(v&&v.status==="valid"){mark(v.cellRef,"field");mark(v.labelRef,"label");}});
  Object.keys(source.attrs||{}).forEach(function(k){mark(source.attrs[k],"attribute");});
  Object.keys(source.profs||{}).forEach(function(k){Object.keys(source.profs[k]||{}).forEach(function(n){mark(source.profs[k][n],"proficiency");});});
  (state.classes||[]).forEach(function(c){Object.keys(c.provenance&&c.provenance.fields||{}).forEach(function(k){mark(c.provenance.fields[k],"class");});});
  (state.skills||[]).concat(state.talent_tree||[],state.blueprints||[]).forEach(function(e){Object.keys(e.provenance&&e.provenance.fields||{}).forEach(function(k){mark(e.provenance.fields[k],"ability");});(e.mergedNotes||[]).forEach(function(n){mark(n.range.split(":")[0],"ability-note");});});
  (state.racial_traits||[]).concat(state.class_features||[],state.special_feats||[]).forEach(function(e){var p=e.provenance||{};mark(e.cellRef||p.nameRef,"feature");mark(p.descRef,"feature");});
  Object.keys(state.equipment||{}).forEach(function(k){(state.equipment[k]||[]).forEach(function(e){(e.items||[e]).forEach(function(n){var p=n.provenance||{};["nameRef","descRef","weightRef","quantityRef"].forEach(function(f){mark(p[f],"equipment");});});});});
  (state.importNotes||[]).forEach(function(n){if(g.cells[n.cellRef]===n.raw)mark(n.cellRef,"reference");});
  (state.importCandidates||[]).forEach(function(c){mark(c.cellRef,"candidate");(c.items||[]).forEach(function(e){Object.keys(e.provenance&&e.provenance.fields||{}).forEach(function(k){mark(e.provenance.fields[k],"candidate");});});});
  var review=[],reference=[],labels=[],records=g.all.map(function(a){var own=context.owner(a.ref),kind="";if(categories[a.ref])kind=categories[a.ref];else if(own.owner!=="current"){kind="reference";reference.push(a.ref);}else if(sLabel(a.value)){kind="label";labels.push(a.ref);}else{kind="unreviewed";review.push({uid:"raw-"+a.ref,cellRef:a.ref,raw:a.value,sheet:parsed.sheetName,entity:own.id,status:"unreviewed"});}return {cellRef:a.ref,raw:a.value,kind:kind,entity:own.id};});
  function sLabel(v){return schema().isLabel(v)||!!schema().supplemental(v)||/^[一二三四五六七八九十\d]+阶.*天赋/.test(SNOWD_CHARACTER_LAYOUT.normalize(v));}
  return {schemaVersion:1,total:records.length,recognized:Object.keys(used).length,reference:reference.length,labels:labels.length,unreviewed:review.length,records:records,review:review,entities:context.entities.map(function(e){return {id:e.id,name:e.name,owner:e.owner,bounds:e.bounds};})};
 }
 return {analyze:analyze,bounds:bounds,contains:contains,cell:cell,afterLabel:afterLabel,fieldCandidates:fieldCandidates,coverage:coverage};
})();
