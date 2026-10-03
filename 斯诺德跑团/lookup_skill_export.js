// Shared skill lookup for xlsx export (upload / creation / tests)
// Prefer class (sk.src / 主职) first so homonyms like「猛击」不串到其它职业。
function lookupSkillForExport(name, preferClass, id) {
  if(!name||typeof SKILL_DATA==="undefined")return null;
  var hits=[];
  Object.keys(SKILL_DATA).forEach(function(cls){
    if(preferClass&&preferClass!==cls)return;
    (SKILL_DATA[cls]||[]).forEach(function(s){if((s.name===name||s.n===name)&&(!id||s.id===id||(s.legacy_ids||[]).indexOf(id)!==-1))hits.push(s);});
  });return hits.length===1?hits[0]:null;
}

function skillExportDescForXlsx(sk, skRef) {
  if (!sk) sk = {};
  if (sk.ds || sk.desc || sk.description) return sk.ds || sk.desc || sk.description || "";
  if (skRef && skRef.description && skRef.description[0]) return skRef.description[0];
  if (skRef && skRef.fields && skRef.fields["描述"]) return skRef.fields["描述"];
  return "";
}

function skillExportCostForXlsx(sk, skRef) {
  if (!sk) sk = {};
  if (sk.cost || sk.fp) return sk.cost || sk.fp || "";
  if (skRef && skRef.cost && skRef.cost.fp) return skRef.cost.fp;
  if (skRef && skRef.fields && skRef.fields["疲劳消耗"]) return skRef.fields["疲劳消耗"];
  return "";
}

var _skillDataLoadPromise = null;
function ensureSkillDataForExport() {
  if (typeof SKILL_DATA !== "undefined") return Promise.resolve();
  if (_skillDataLoadPromise) return _skillDataLoadPromise;
  _skillDataLoadPromise = new Promise(function (resolve) {
    var s = document.createElement("script");
    s.src = "panel_data.js";
    s.onload = function () { resolve(); };
    s.onerror = function () { resolve(); };
    document.head.appendChild(s);
  });
  return _skillDataLoadPromise;
}
