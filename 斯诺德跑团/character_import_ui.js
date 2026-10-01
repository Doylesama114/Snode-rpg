/* Import issues are edited by UID; learning/rewards are never replayed. */
function openIssueResolver(uid, targetState) {
  var s=targetState||(typeof pendingState!=="undefined"?pendingState:null)||(typeof state!=="undefined"?state:null);
  if(!s)return;
  var list=(s.skills||[]).concat(s.talent_tree||[]),entry=list.filter(function(e){return e.uid===uid;})[0];
  if(!entry)return;
  var old=document.getElementById("characterIssueDialog");if(old)old.remove();
  var overlay=document.createElement("div");overlay.id="characterIssueDialog";
  overlay.style.cssText="position:fixed;inset:0;z-index:20000;background:#0009;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box";
  var box=document.createElement("section");box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","确认技能来源");
  box.style.cssText="background:var(--sb-panel,#fffdf8);color:var(--sb-ink,#252b26);padding:18px;border-radius:10px;width:100%;max-width:580px;max-height:85vh;overflow:auto;box-sizing:border-box";
  function node(tag,text){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
  box.appendChild(node("h3","确认技能来源："+(entry.n||entry.name||"")));
  var note=node("p","选择来源与栏位后保存。原始说明和已有选项会保留。");
  note.style.fontSize="13px";box.appendChild(note);
  var search=node("input");search.type="search";search.placeholder="搜索技能名称";search.value=entry.n||entry.name||"";search.style.cssText="width:100%;box-sizing:border-box;margin-bottom:8px";box.appendChild(search);
  var select=node("select");select.size=6;select.style.cssText="width:100%;box-sizing:border-box";select.setAttribute("aria-label","技能候选");box.appendChild(select);
  var choices=[];
  function fill(){
    var q=search.value.trim(),exact=SNOWD_CHARACTER_IO.candidates(q);
    choices=exact.length?exact:SNOWD_CHARACTER_IO.search(q);
    select.textContent="";
    var keep=node("option","保留原文，暂不确认");keep.value="";select.appendChild(keep);
    choices.forEach(function(c,i){var o=node("option",c.name+" · "+c.cls+" · "+(c.style||c.kind||"")+" · "+(c.isStarting?"起始特性":c.tier||""));o.value=String(i);select.appendChild(o);});
    var match=choices.findIndex(function(c){return c.cls===entry.src&&c.id===entry.id;});
    select.value=match>=0?String(match):"";
  }
  search.addEventListener("input",fill);fill();
  var place=node("select");place.setAttribute("aria-label","所在栏位");
  [["main","主职业技能栏"],["sub","子职业技能栏"],["talent","天赋栏"]].forEach(function(p){var o=node("option",p[1]);o.value=p[0];place.appendChild(o);});
  place.value=entry.place||(entry.sub?"sub":(s.talent_tree.indexOf(entry)>=0?"talent":"main"));
  var fields=node("div");fields.style.cssText="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0";fields.appendChild(place);
  var free=node("input");free.type="checkbox";free.checked=entry.free===undefined?!!entry.freeSlot:!!entry.free;
  var occupies=node("input");occupies.type="checkbox";occupies.checked=entry.occupies===undefined?!entry.freeSlot:entry.occupies!==false;
  [[free,"免费获得"],[occupies,"占用栏位"]].forEach(function(p){var label=node("label");label.appendChild(p[0]);label.appendChild(document.createTextNode(p[1]));fields.appendChild(label);});box.appendChild(fields);
  var via=node("input");via.value=entry.via||entry.grantedBy||"";via.placeholder="获取途径（如特殊专长名称）";via.setAttribute("aria-label","获取途径");via.style.cssText="width:100%;box-sizing:border-box";box.appendChild(via);
  var status=node("p");status.setAttribute("role","status");status.style.fontSize="13px";box.appendChild(status);
  var buttons=node("div");buttons.style.cssText="display:flex;gap:8px;justify-content:flex-end;margin-top:12px";
  var cancel=node("button","取消"),save=node("button","保存");cancel.type=save.type="button";
  var focused=document.activeElement;
  function close(){document.removeEventListener("keydown",key);overlay.remove();if(focused&&focused.focus)focused.focus();}
  function key(e){
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}
    if(e.key==="Tab"){
      var els=Array.prototype.slice.call(box.querySelectorAll("button,input,select")),i=els.indexOf(document.activeElement);
      if(e.shiftKey&&i===0){e.preventDefault();els[els.length-1].focus();}
      else if(!e.shiftKey&&i===els.length-1){e.preventDefault();els[0].focus();}
    }
  }
  document.addEventListener("keydown",key);cancel.onclick=close;overlay.onclick=function(e){if(e.target===overlay)close();};
  save.onclick=function(){
    if(place.value==="sub"&&!(s.classes[1]&&s.classes[1].name)){status.textContent="请先填写子职业，或选择主职业技能栏。";return;}
    if(select.value!==""){
      var c=choices[Number(select.value)];
      var changed=entry.n!==c.name||entry.src!==c.cls||(entry.id&&entry.id!==c.id);
      if(changed){delete entry.id;delete entry.catalogTier;delete entry.st;}
      entry.n=c.name;if(entry.name!==undefined)entry.name=c.name;entry.src=c.cls;entry.id=c.id;entry.kind=c.kind;entry.catalogTier=c.tier;entry.st=c.style;
      if(changed||!entry.tier)entry.tier=c.tier;
      s.importIssues=(s.importIssues||[]).filter(function(i){return i.uid!==entry.uid||["ambiguous","unmatched","typo-candidate","source-mismatch"].indexOf(i.kind)<0;});
    }
    var p=place.value;
    if(p==="sub"&&!(s.classes[1]&&s.classes[1].name)){status.textContent="请先填写子职业，或选择主职业技能栏。";return;}
    s.skills=s.skills.filter(function(e){return e!==entry;});s.talent_tree=s.talent_tree.filter(function(e){return e!==entry;});
    (p==="talent"?s.talent_tree:s.skills).push(entry);
    entry.place=p;entry.sub=p==="sub"?s.classes[1].name:"";if(p==="talent")entry.cls=entry.src;else delete entry.cls;
    entry.free=free.checked;entry.occupies=occupies.checked;entry.freeSlot=!occupies.checked;
    entry.via=via.value.trim();entry.grantedBy=entry.via;entry.resolutionConfirmed=select.value!=="";
    if(typeof autoCorrect==="function")autoCorrect(s);
    close();
    if(typeof renderIssuesTable==="function"){
      var host=document.getElementById("importIssuesHost");if(host)host.innerHTML=renderIssuesTable(s);
    }
    if(typeof SB_reinit==="function")SB_reinit();
    if(typeof renderSkillTables==="function")renderSkillTables();
    if(typeof saveState==="function"&&s===state)saveState();
    if(typeof renderCharacterImportIssues==="function")renderCharacterImportIssues(s);
  };
  buttons.appendChild(cancel);buttons.appendChild(save);box.appendChild(buttons);overlay.appendChild(box);document.body.appendChild(overlay);search.focus();
}
function renderCharacterImportIssues(s) {
  var host=document.getElementById("panelImportIssues");if(!host)return;
  host.textContent="";
  var issues=Array.isArray(s.importIssues)?s.importIssues:[],pending=issues.filter(function(i){return ["ambiguous","unmatched","typo-candidate","source-mismatch","catalog-changed","metadata-invalid","metadata-unsupported","metadata-ambiguous"].indexOf(i.kind)>=0;});
  if(!pending.length){host.style.display="none";return;}
  host.style.display="block";
  var title=document.createElement("summary");title.textContent="导入待确认："+pending.length+" 项";host.appendChild(title);
  pending.forEach(function(i){
    var row=document.createElement("p");row.textContent=(i.name||"工作簿")+"："+(i.note||"技能来源待确认")+" ";
    if(i.uid){var b=document.createElement("button");b.type="button";b.textContent="处理";b.onclick=function(){openIssueResolver(i.uid,s);};row.appendChild(b);}host.appendChild(row);
  });
}
if(typeof document!=="undefined")document.addEventListener("DOMContentLoaded",function(){
  if(typeof state==="undefined"||!document.getElementById("panelImportIssues"))return;
  renderCharacterImportIssues(state);
});
