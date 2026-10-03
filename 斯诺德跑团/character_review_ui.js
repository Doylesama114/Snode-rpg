/* Import review workbench: explicit source bindings and preserved raw content. */
var SNOWD_CHARACTER_REVIEW=(function(){
 async function parsedFor(s){
  if(typeof pendingState!=="undefined"&&s===pendingState&&typeof pendingParsed!=="undefined"&&pendingParsed)return pendingParsed;
  var buffer=s._uploadedXlsxBuf;if(!buffer&&s.importWorkbookKey)buffer=await SNOWD_CHARACTER_WORKBOOK_CACHE.get(s.importWorkbookKey);
  if(buffer&&typeof parseXLSX==="function")return parseXLSX(buffer,{sheetPath:s._xlsxSheetPath});
  var records=s.importCoverage&&s.importCoverage.records;if(!records)throw new Error("请重新上传原工作簿以绑定字段。");
  var cells={};records.forEach(function(r){cells[r.cellRef]=r.raw;});return {cells:cells,merges:s.importRawLayout&&s.importRawLayout.merges||[],formulas:s.importRawLayout&&s.importRawLayout.formulas||{},sheetName:s.importRawLayout&&s.importRawLayout.sheetName||"",sheetPath:s._xlsxSheetPath,layoutMappings:s.importLayoutMappings||[],fieldBindings:s.importFieldBindings||[],entityScope:s.importEntityScope||"",equipmentMappings:s.importEquipmentMappings||[]};
 }
 function rebuild(s,parsed){
  var old={classes:s.classes,combatStats:s.combatStats,combatValues:s.combatValues,fieldSources:s.fieldSources,skills:s.skills,talent_tree:s.talent_tree,blueprints:s.blueprints,ruleRace:s.ruleRace,ruleBackground:s.ruleBackground,race:s.race,background:s.background,_hpCurrent:s._hpCurrent,_fpCurrent:s._fpCurrent,importCandidates:s.importCandidates};
  var changedEntity=(s.importEntityScope||"")!==(parsed.entityScope||"")||(s.importEntityId||"")!==(parsed.entityId||"");
  var fresh=typeof buildState==="function"?buildState(parsed):Object.assign({},s,{combatStats:s.combatStats?JSON.parse(JSON.stringify(s.combatStats)):undefined,combatValues:s.combatValues?JSON.parse(JSON.stringify(s.combatValues)):undefined,importIssues:(s.importIssues||[]).slice()});
  if(typeof buildState!=="function"){
   SNOWD_CHARACTER_FIELDS.apply(fresh,parsed);var cl=SNOWD_CHARACTER_CLASSES.read(parsed);fresh.classes=cl.classes;fresh.classIssues=cl.issues;
   var abilities=SNOWD_CHARACTER_LAYOUT.readAbilities(parsed,fresh.classes);fresh.skills=abilities.skills.map(function(e){return SNOWD_CHARACTER_IO.rawEntry(e,parsed,e.cellRef,e.region,e.place,e.tier);});fresh.talent_tree=abilities.talents.map(function(e){return SNOWD_CHARACTER_IO.rawEntry(e,parsed,e.cellRef,e.region,e.place,e.tier);});fresh.blueprints=abilities.blueprints;fresh._importLayoutIssues=abilities.issues.filter(function(i){return i.kind==="layout-unrecognized"||i.kind==="entity-unconfirmed";});fresh.importCandidates=(abilities.candidates||[]).concat(SNOWD_CHARACTER_LAYOUT.candidatesFromNotes(parsed,{skills:fresh.skills,talents:fresh.talent_tree,feats:fresh.special_feats}));fresh.importIssues=(fresh.importIssues||[]).concat(abilities.issues);
  }
  if(!changedEntity){
   (fresh.classes||[]).forEach(function(c,i){var previous=old.classes&&old.classes[i];if(previous&&c.name===previous.name&&c.level===previous.level)["uid","baseClass","baseConfirmed","rulesDisabled","ruleEnabled","confirmedTotalLevel","levelMeaning"].forEach(function(k){if(previous[k]!==undefined)c[k]=previous[k];});});
   ["skills","talent_tree","blueprints"].forEach(function(k){fresh[k]=(fresh[k]||[]).map(function(e){var previous=(old[k]||[]).find(function(p){return p.provenance&&e.provenance&&p.provenance.sheet===e.provenance.sheet&&p.provenance.fields.name===e.provenance.fields.name&&(p.n===e.n||p.original&&p.original.name===e.n);});if(!previous)return e;var merged=Object.assign({},previous,e);["uid","resolution","baseDefinition","occupies","free","via","grantedBy","activation","linkedItem","requiresEquipment","selectedOptions","choices"].forEach(function(f){if(previous[f]!==undefined)merged[f]=previous[f];});Object.keys(previous.fieldEdits||{}).forEach(function(f){merged[f]=previous[f];});merged.fieldEdits=previous.fieldEdits;return merged;});});
   Object.keys(old.combatStats&&old.combatStats.fields||{}).forEach(function(k){var before=old.fieldSources&&old.fieldSources.scalar&&old.fieldSources.scalar[k],after=fresh.fieldSources&&fresh.fieldSources.scalar&&fresh.fieldSources.scalar[k];if(before&&after&&after.status==="valid"&&before.cellRef===after.cellRef&&String(before.raw)===String(after.raw)){var p=old.combatStats.fields[k];SNOWD_CHARACTER_STATS.set(fresh,k,after.value,p.mode,p.source);}});
   fresh._hpCurrent=old._hpCurrent;fresh._fpCurrent=old._fpCurrent;if(fresh.race===old.race)fresh.ruleRace=old.ruleRace;if(fresh.background===old.background)fresh.ruleBackground=old.ruleBackground;
  }else{fresh.ruleRace="";fresh.ruleBackground="";fresh._hpCurrent=null;fresh._fpCurrent=null;}
  var keep={importWorkbookKey:s.importWorkbookKey,_uploadedXlsxBuf:s._uploadedXlsxBuf,_charName:s._charName,_chargenOrigin:s._chargenOrigin,importDraft:s.importDraft};Object.assign(s,fresh,keep);
  s.importCoverage=SNOWD_CHARACTER_STRUCTURE.coverage(parsed,s);s.importUnreviewed=s.importCoverage.review;s.importRawLayout={sheetName:parsed.sheetName,merges:parsed.merges||[],formulas:parsed.formulas||{}};s.importFieldBindings=parsed.fieldBindings||[];s.importEntityScope=parsed.entityScope||"";s.importEntityId=parsed.entityId||"";
  if(typeof pendingParsed!=="undefined")pendingParsed=parsed;characterImportRefresh(s);return s;
 }
 async function open(target){
  var s=characterImportState(target);if(!s)return;
  var d=characterImportDialog("绑定角色范围与字段"),status=d.node("p","正在读取原始单元格…");status.setAttribute("role","status");d.box.appendChild(status);
  try{
   var parsed=await parsedFor(s),g=SNOWD_CHARACTER_LAYOUT.grid(parsed),context=SNOWD_CHARACTER_STRUCTURE.analyze(parsed,g);
   d.box.appendChild(d.node("p","选择当前角色的范围，或把字段直接绑定到单元格。只有明确确认的绑定才会用于导入和写回。"));
   var entity=d.select("当前角色主体",[["","按结构识别"]].concat(context.current.map(function(e){return [e.id,e.name+" · "+e.ref];})),s.importEntityId||"");
   var scope=d.input("当前角色范围（可不填）",s.importEntityScope||"");scope.placeholder="例如 A1:T180";
   var key=d.select("要绑定的字段",Object.keys(SNOWD_CHARACTER_IMPORT_SCHEMA.aliases).map(function(k){var label=SNOWD_CHARACTER_IMPORT_SCHEMA.aliases[k][0];return [k,label];}),"hp");
   var ref=d.input("原始值单元格","");ref.placeholder="例如 L3";
   var list=d.node("div"),preview=d.node("pre");preview.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font-size:12px";d.box.appendChild(list);d.box.appendChild(preview);
   var staged=(s.importFieldBindings||[]).slice();
   function render(){list.textContent="";staged.forEach(function(m){var p=d.node("p",m.field+" ← "+m.cellRef+" ");var b=d.node("button","移除");b.type="button";b.onclick=function(){staged=staged.filter(function(n){return n!==m;});render();};p.appendChild(b);list.appendChild(p);});}
   function inspect(){var r=ref.value.trim().toUpperCase();preview.textContent=SNOWD_CHARACTER_LAYOUT.point(r)?Object.keys(g.cells).filter(function(k){var p=SNOWD_CHARACTER_LAYOUT.point(k),t=SNOWD_CHARACTER_LAYOUT.point(r);return Math.abs(p.row-t.row)<=2&&Math.abs(p.col-t.col)<=2;}).map(function(k){return k+"："+g.cells[k];}).join("\n"):"请选择字段并填写单元格。";var source=s.fieldSources&&s.fieldSources.scalar&&s.fieldSources.scalar[key.value];if(source&&source.candidates&&source.candidates.length)preview.textContent+="\n候选："+source.candidates.map(function(c){return c.cellRef+"="+c.raw;}).join("；");}
   ref.oninput=inspect;key.onchange=function(){var m=staged.find(function(m){return m.field===key.value;});ref.value=m?m.cellRef:"";inspect();};
   var add=d.node("button","加入字段绑定");add.type="button";add.onclick=function(){var cell=ref.value.trim().toUpperCase(),p=SNOWD_CHARACTER_LAYOUT.point(cell);if(!p){status.textContent="请输入有效的单元格地址。";return;}var raw=SNOWD_CHARACTER_STRUCTURE.cell(parsed,g,p.col,p.row);staged=staged.filter(function(m){return m.field!==key.value;});var left=(g.byRow[p.row]||[]).filter(function(a){return a.col<p.col;}).slice(-1)[0],area=context.sectionAt(raw.cellRef);staged.push({field:key.value,cellRef:raw.cellRef,sheet:parsed.sheetName,confirmed:true,labelRef:left?left.ref:"",label:left?left.value:"",witness:{labelRef:left?left.ref:"",labelRaw:left?left.value:"",section:area?area.type:"",owner:context.owner(raw.cellRef).owner},evidence:"player-binding"});render();status.textContent="绑定已加入预览，点击确认后生效。";};d.box.appendChild(add);
   preview.textContent=Object.keys(g.cells).filter(function(k){return String(g.cells[k]).trim();}).slice(0,70).map(function(k){return k+"："+g.cells[k];}).join("\n");render();
   var save=d.node("button","确认范围与字段");save.type="button";save.onclick=function(){try{var range=scope.value.toUpperCase().trim();if(range&&!SNOWD_CHARACTER_STRUCTURE.bounds(range))throw Error("角色范围地址无效。");var rebuilt=Object.assign({},parsed,{entityScope:range,entityId:entity.value,fieldBindings:staged});rebuild(s,rebuilt);d.close();}catch(e){status.textContent=e.message;}};d.box.appendChild(save);status.textContent="";
  }catch(e){status.textContent=e.message;}
 }
 async function openEquipment(target){
  var s=characterImportState(target),parsed=await parsedFor(s),d=characterImportDialog("映射装备表"),range=d.input("装备数据范围",""),slot=d.input("原装备分区","背包"),controls={};
  [["nameCol","物品名称列"],["descCol","物品说明列"],["weightCol","重量列"],["quantityCol","数量列"]].forEach(function(p){controls[p[0]]=d.input(p[1],"");});
  var status=d.node("p");status.setAttribute("role","status");d.box.appendChild(status);var save=d.node("button","确认装备映射");save.type="button";save.onclick=function(){try{
   var r=range.value.toUpperCase().trim(),b=SNOWD_CHARACTER_STRUCTURE.bounds(r);if(!b)throw Error("请填写有效数据范围。");var m={sheet:parsed.sheetName,range:r,slot:slot.value.trim()||"杂物包"};
   Object.keys(controls).forEach(function(k){var v=controls[k].value.toUpperCase().trim();if(v){var p=SNOWD_CHARACTER_LAYOUT.point(v+"1");if(!p||p.col<b.left||p.col>b.right)throw Error("列必须位于数据范围内。");m[k]=v;}});if(!m.nameCol)throw Error("请绑定物品名称列。");
   var rebuilt=Object.assign({},parsed,{equipmentMappings:(s.importEquipmentMappings||[]).filter(function(e){return e.range!==r;}).concat([m])});rebuild(s,rebuilt);s.importEquipmentMappings=rebuilt.equipmentMappings;d.close();
  }catch(e){status.textContent=e.message;}};d.box.appendChild(save);
 }
 function rawDialog(s){
  var d=characterImportDialog("原始内容读取清单"),records=s.importCoverage&&s.importCoverage.records||[];
  d.box.appendChild(d.node("p","这里展示每个非空单元格的去向。未分类内容原样保留；确认作为参考不会解决关键字段冲突。"));
  var pre=d.node("pre",records.map(function(r){return r.cellRef+" ["+r.kind+"] "+r.raw;}).join("\n"));pre.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;font-size:12px";d.box.appendChild(pre);
  var keep=d.node("button","将剩余原文保留为参考");keep.type="button";keep.onclick=function(){s.importNotes=s.importNotes||[];(s.importUnreviewed||[]).forEach(function(r){if(!s.importNotes.some(function(n){return n.cellRef===r.cellRef&&n.raw===r.raw;}))s.importNotes.push(Object.assign({},r,{kind:"reference",status:"reference"}));});s.importUnreviewed=[];records.forEach(function(r){if(r.kind==="unreviewed")r.kind="reference";});s.importCoverage.unreviewed=0;d.close();characterImportRefresh(s);};d.box.appendChild(keep);
 }
 function render(s){
  var host=document.getElementById("characterImportExtras");if(!host||!s)return;
  var p=document.createElement("p"),coverage=s.importCoverage;
  p.textContent=coverage?"读取清单：共 "+coverage.total+" 个非空单元格；尚未分类 "+(s.importUnreviewed||[]).length+" 项；参考区域 "+coverage.reference+" 项。":"可绑定角色范围和原始字段。";host.appendChild(p);
  [["绑定角色范围与字段",function(){open(s);}],["映射装备表",function(){openEquipment(s);} ],["查看原始内容清单",function(){rawDialog(s);}]].forEach(function(pair){var b=document.createElement("button");b.type="button";b.textContent=pair[0];b.onclick=pair[1];host.appendChild(b);});
  (s.importIssues||[]).filter(function(i){return ["field-ambiguous","entity-unconfirmed","class-field-ambiguous","capacity-conflict","confirmation-stale"].indexOf(i.kind)>=0;}).forEach(function(i){var p=document.createElement("p");p.textContent=i.note;host.appendChild(p);});
 }
 return {parsedFor:parsedFor,rebuild:rebuild,open:open,render:render,rawDialog:rawDialog,equipment:openEquipment};
})();
async function openFieldBindingResolver(target){return SNOWD_CHARACTER_REVIEW.open(target);}
