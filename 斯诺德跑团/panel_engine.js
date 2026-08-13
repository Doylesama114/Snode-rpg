var ATTR_NAMES=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
/** alert 替代：Electron（contextIsolation）下 alert 不可见；优先 toast，无 toast 环境回退 alert（v1.0.7235） */
function SB_toast(msg, cls) {
  if (typeof window !== 'undefined' && window.toast) { window.toast(msg, cls || 'warn'); return; }
  if (typeof window !== 'undefined' && window.alert) { window.alert(msg); }
}

function canonicalSkillStyle(style) {
  if (!style) return "";
  var s = String(style).trim();
  if (s.length > 2 && s.slice(-2) === "风格" && s.indexOf("天赋树") < 0) return s.slice(0, -2);
  return s;
}

function normalizeTierName(t) {
  if (t === 0 || t === "0") return "通用";
  if (t === null || t === undefined || t === "") return "通用";
  if (typeof t === "number" && t >= 1 && t <= 9) {
    return "一二三四五六七八九".charAt(t - 1) + "阶";
  }
  t = String(t).replace(/天赋树.*$/, "").trim();
  if (/^[1-9]$/.test(t)) {
    return "一二三四五六七八九".charAt(parseInt(t, 10) - 1) + "阶";
  }
  if (t === "起始" || t === "起始特性") return "一阶";
  return t;
}

function isLearnPanelStartingSkill(clsName, skill) {
  if (!skill) return false;
  if (skill.type === "starting" || skill.type === "upgrade" || skill.type === "granted") return true;
  var st = canonicalSkillStyle(skill.style || "");
  if (st === "起始特性" || skill.style === "起始特性") return true;
  if (typeof REF_CLASSES !== "undefined" && REF_CLASSES[clsName] && REF_CLASSES[clsName].starting_features) {
    var feats = REF_CLASSES[clsName].starting_features;
    for (var i = 0; i < feats.length; i++) {
      if (feats[i] && feats[i].name === skill.name) return true;
    }
  }
  return false;
}

for(var _cn2 in SKILL_DATA){
  var _skills2=SKILL_DATA[_cn2];if(!_skills2||!_skills2.length)continue;
  for(var _si2=0;_si2<_skills2.length;_si2++){
    var _s2=_skills2[_si2];
    if(_s2.style) _s2.style=canonicalSkillStyle(_s2.style);
    if(_s2.tier) _s2.tier=normalizeTierName(_s2.tier);
    if(_s2.fields&&_s2.fields.关键词&&(!_s2.tags||!_s2.tags.length)){
      _s2.tags=_s2.fields.关键词.split(".").filter(function(t){return t;});
    }
    if((!_s2.description||!_s2.description.length)&&_s2.flavor){
      _s2.description=[_s2.flavor];
    }
  }
}





// CHOICE_B_PROF_MAP: 抉择B技能 → {profAttr: 所属属性, profKey: 熟练项键名, profName: 熟练项显示名}


// Apply 抉择B prof bonus
function applyChoiceBProfBonus(skillName, add) {
  var map = CHOICE_B_PROF_MAP[skillName];
  if (!map) return;
  var attr = map.attr;
  var key = map.profKey;
  if (!state.profs) state.profs = {};
  if (!state.profs[attr]) state.profs[attr] = {};
  var cur = state.profs[attr][key] || 0;
  state.profs[attr][key] = Math.max(0, cur + (add ? 1 : -1));
}

// Apply 抉择B level-10 attr boosts
function applyChoiceBLevel10Boosts() {
  if (!state._cb10Done) state._cb10Done = {};
  var mainLevel = 0;
  if (state.classes && state.classes[0]) mainLevel = state.classes[0].level || 0;
  var tt = state.talent_tree || [];
  for (var i = 0; i < tt.length; i++) {
    var skillName = tt[i].n;
    if (!CHOICE_B_PROF_MAP[skillName]) continue;
    if (state._cb10Done[skillName]) continue;
    if (mainLevel >= 10) {
      var attr = CHOICE_B_PROF_MAP[skillName].attr;
      if (!state.attrs) state.attrs = {};
      state.attrs[attr] = (state.attrs[attr] || 0) + 1;
      state._cb10Done[skillName] = true;
    }
  }
}





// CHOICE_L_MASTERY_MAP: 抉择L掌握技能→{attr, spColor, spCount}


function applyChoiceLMasteryBonus(skillName, add) {
  var map = CHOICE_L_MASTERY_MAP[skillName];
  if (!map) return;
  if (!state.attrs) state.attrs = {};
  state.attrs[map.attr] = Math.max(0, (state.attrs[map.attr] || 0) + (add ? 1 : -1));
}

function applyUniversalTalentBonus(skillName, add, talentEntry) {
  if (typeof UNIVERSAL_SAVE_TALENTS !== "undefined" && UNIVERSAL_SAVE_TALENTS[skillName]) {
    var sa = UNIVERSAL_SAVE_TALENTS[skillName];
    bumpProf(sa, "豁免", add ? 1 : -1);
    return true;
  }
  if (typeof UNIVERSAL_CUSTOM_PROF_TALENTS !== "undefined" && UNIVERSAL_CUSTOM_PROF_TALENTS[skillName]) {
    bumpCustomProf(UNIVERSAL_CUSTOM_PROF_TALENTS[skillName], add ? 1 : -1);
    return true;
  }
  if (typeof UNIVERSAL_PROF_TALENTS !== "undefined" && UNIVERSAL_PROF_TALENTS[skillName]) {
    var up = UNIVERSAL_PROF_TALENTS[skillName];
    bumpProf(up.attr, up.key, add ? 1 : -1);
    return true;
  }
  if (skillName === "持之以恒") {
    var attrNames = ATTR_NAMES;
    if (add) {
      var hi = attrNames[0], lo = attrNames[0];
      var hiV = state.attrs[hi] || 0, loV = state.attrs[lo] || 0;
      for (var ai = 1; ai < attrNames.length; ai++) {
        var v = state.attrs[attrNames[ai]] || 0;
        if (v > hiV) { hiV = v; hi = attrNames[ai]; }
        if (v < loV) { loV = v; lo = attrNames[ai]; }
      }
      var orig = {};
      if (hiV < 20) { orig[hi] = hiV; state.attrs[hi] = hiV + 1; }
      // recompute lowest after high bump if same attr
      loV = state.attrs[lo] || 0;
      for (var bi = 0; bi < attrNames.length; bi++) {
        var bv = state.attrs[attrNames[bi]] || 0;
        if (bv < loV) { loV = bv; lo = attrNames[bi]; }
      }
      if (loV < 20) {
        if (orig[lo] === undefined) orig[lo] = loV;
        state.attrs[lo] = loV + 1;
      }
      if (talentEntry) talentEntry._persistOrig = orig;
    } else if (talentEntry && talentEntry._persistOrig) {
      var o = talentEntry._persistOrig;
      for (var k in o) {
        if (o.hasOwnProperty(k)) state.attrs[k] = o[k];
      }
    }
    return true;
  }
  return false;
}

function applyChoiceLLevel12Boosts() {
  if (!state._cl12Done) state._cl12Done = {};
  var mainLevel = (state.classes && state.classes[0]) ? (state.classes[0].level || 0) : 0;
  var tt = state.talent_tree || [];
  for (var i = 0; i < tt.length; i++) {
    var sn = tt[i].n;
    if (!CHOICE_L_MASTERY_MAP[sn] || state._cl12Done[sn]) continue;
    if (mainLevel >= 12) {
      var map = CHOICE_L_MASTERY_MAP[sn];
      ensureSpState();
      state.sp_points = (state.sp_points || 0) + map.spCount;
      state._cl12Done[sn] = true;
    }
  }
}


// 冥想: 学习时获得SP（青色+蓝色+绿色）
var MEDITATION_SPS = {"青色":1, "蓝色":1, "绿色":1};

function applyMeditationSP(skillName, add) {
  // TODO: 冥想等特殊技能副作用（色彩标识/技能点）稍后实施
}
var state={

"profs":{
  "力量":{"豁免":0,"威力":0,"承重":0,"运动-跳跃":0,"运动-攀爬":0,"运动-游泳":0,"运动-自定义":0},
  "敏捷":{"豁免":0,"体操":0,"骑乘":0,"隐匿":0,"巧手-偷窃":0,"巧手-开锁":0,"巧手-拆除":0,"巧手-自定义":0},
  "体质":{"豁免":0,"专注":0,"耐力":0},
  "智力":{"豁免":0,"调查":0,"逻辑":0,"宗教":0,"估价":0,"伪造":0,"读唇":0,"奥秘-魔法学识":0,"奥秘-炼金术":0,"奥秘-神奇道具":0,"奥秘-多元宇宙":0,"知识-历史":0,"知识-地理":0,"知识-人文":0,"知识-政治":0,"知识-神秘学":0,"知识-工程学":0,"知识-珠宝学":0,"知识-草药学":0,"知识-医药":0,"知识-烹饪":0,"知识-自定义":0},
  "感知":{"豁免":0,"洞悉":0,"导航":0,"自然":0,"驯兽":0,"感悟":0,"聆听":0,"察觉":0},
  "魅力":{"豁免":0,"欺瞒":0,"说服":0,"表演-歌唱":0,"表演-舞蹈":0,"表演-演奏":0,"表演-自定义":0,"恐吓":0},
  "意志":{"豁免":0,"求生":0,"激励":0,"决策":0},
  "幸运":{"豁免":0,"机遇":0,"探索":0}
},
"background":"", "player":"", "name":"","race":"","gender":"","age":"","height":"","weight":"","eye":"","skin":"","hair":"","portrait":"",
"xp":0, "carry_capacity":{"常规":45,"满载":60,"极限":75,"当前":5},
"sp_points":0,
"color_marks":{"橙色":false,"白色":false,"紫色":false,"黄色":false,"无色":false,"蓝色":false,"青色":false,"黑色":false,"红色":false,"棕色":false,"粉色":false,"绿色":false,"浅色":false,"炫彩":false},
"hp":10,"fp":8,
"story":"","personality":"","traits":"","ideals":"","bonds":"","flaws":"","deity":"","deityAttr":"","patron":"","contacts":"","scamType":"","missionChannel":"","academicDomain":"","sportPreference":"","weapon_specs":[],
"attrs":{"力量":10,"敏捷":10,"体质":10,"智力":10,"感知":10,"魅力":10,"意志":10,"幸运":10},
"classes":[{"name":"","level":0,"styles":["","","",""]},{"name":"","level":0,"styles":["","","",""]},{"name":"","level":0,"styles":["","","",""]}],
"skills":[], "special_feats":[], "feats":[], "currency":{"金币":0,"银币":0,"铜币":0,"其他":""},
"equipment":{"主手武器":[],"副手武器":[],"防具":[],"配饰":[],"背包":[],"杂物包":[],"旅行腰包":[],"材料包":[]},
"racial_traits":[],"class_features":[],"languages":["通用语"],"professionals":[],"talent_tree":[],"blueprints":[],"blueprint_bonus_slots":0,
"forbidden_skills":[],"unlocked_tiers":["一阶","二阶"],
"containerItems":{"背包":"已解锁","旅行腰包":"已解锁","烹饪材料包":"","垂钓材料包":"","医用材料包":"","草药材料包":"","裁缝材料包":"","矿石材料包":"","珠宝材料包":"","炼金材料包":"","铭文材料包":""}};

// Snapshot of pristine state for clean loads (avoids same-name slot residue)
var STATE_DEFAULTS = JSON.parse(JSON.stringify(state));

// ===== Save/Load System =====
var CURRENT_CHAR = "";
var CURRENT_SLOT = 0;
var SAVE_KEY_PREFIX = "char_";

function getSaveKey(charName, slotIndex) {
  return SAVE_KEY_PREFIX + charName + "_slot" + slotIndex;
}

function charNameExists(charName) {
  if (!charName) return false;
  for (var i = 1; i <= 3; i++) {
    if (localStorage.getItem(getSaveKey(charName, i))) return true;
  }
  return false;
}

/** Unique storage id for create/upload; display name stays in state.name */
function allocateUniqueCharId(desired) {
  if (!desired) desired = "未命名角色";
  if (!charNameExists(desired)) return desired;
  var n = 2;
  while (charNameExists(desired + "_" + n)) n++;
  return desired + "_" + n;
}

/** Underscore keys that must survive save/load (game progress, not UI temps). */
function isPersistedInternalKey(key) {
  return key === "_hp_per_level_bonus"
    || key === "_feat_ac_bonus"
    || key === "_persistOrig"
    || key === "_futureLowestLeft"
    || key === "_futureMigrated"
    || key === "_orig"
    || key === "_addedLanguages"
    || key === "_panelApplied"
    || key === "_attrGained"
    || key === "_creationSnapshot"
    || key === "_chargenOrigin";
}

function getStateSnapshot() {
  // Deep clone serializable state (exclude functions, DOM refs, temp vars)
  var clone = JSON.parse(JSON.stringify(state, function(key, val) {
    // Skip internal/temp keys that should not be persisted
    if (key.indexOf("_") === 0 && !isPersistedInternalKey(key)) return undefined;
    return val;
  }));
  clone._savedAt = new Date().toISOString();
  clone._charName = CURRENT_CHAR || state.name;
  return clone;
}

function saveState(slotIndex) {
  var charName = CURRENT_CHAR || state.name;
  if (!charName) { SB_toast("没有角色可保存"); return false; }
  var si = slotIndex || CURRENT_SLOT || 1;
  var key = getSaveKey(charName, si);
  var snapshot = getStateSnapshot();
  try {
    localStorage.setItem(key, JSON.stringify(snapshot));
    state._dirty = false;
    CURRENT_CHAR = charName;
    CURRENT_SLOT = si;
    return true;
  } catch(e) {
    SB_toast("保存失败: " + e.message);
    return false;
  }
}

function loadState(charName, slotIndex) {
  var key = getSaveKey(charName, slotIndex);
  var raw = localStorage.getItem(key);
  if (!raw) return false;
  try {
    var data = JSON.parse(raw);
    // Reset to defaults first so previous character fields cannot leak
    var dk;
    for (dk in STATE_DEFAULTS) {
      if (STATE_DEFAULTS.hasOwnProperty(dk)) {
        state[dk] = JSON.parse(JSON.stringify(STATE_DEFAULTS[dk]));
      }
    }
    for (dk in state) {
      if (!state.hasOwnProperty(dk)) continue;
      if (dk.indexOf("_") === 0 && !isPersistedInternalKey(dk)) {
        delete state[dk];
      }
    }
    for (var k in data) {
      if (data.hasOwnProperty(k)) {
        state[k] = data[k];
      }
    }
    CURRENT_CHAR = charName;
    CURRENT_SLOT = slotIndex;
    state._dirty = false;
    migrateProfKeys(state.profs);
    ensureSpState();
    ensureClaimedLevels();
    migrateAllShortboardFeats();
    ensurePanelFeatBonuses();
    normalizeAllSkillSubs();
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('snowd-panel-character-change', {
        detail: { charName: charName, slot: slotIndex },
      }));
    }
    return true;
  } catch(e) {
    console.error("Load failed:", e);
    return false;
  }
}

function getSavedChars() {
  var chars = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.indexOf(SAVE_KEY_PREFIX) === 0) {
      var parts = key.replace(SAVE_KEY_PREFIX, "").split("_slot");
      var charName = parts[0];
      if (chars.indexOf(charName) < 0) chars.push(charName);
    }
  }
  return chars;
}

function getCharSlots(charName) {
  var slots = [];
  for (var i = 0; i < 3; i++) {
    var si = i + 1;
    var key = getSaveKey(charName, si);
    var raw = localStorage.getItem(key);
    if (raw) {
      try {
        var data = JSON.parse(raw);
        slots.push({
          index: si,
          savedAt: data._savedAt || "未知",
          summary: getSlotSummary(data)
        });
      } catch(e) {
        slots.push({index: si, savedAt: "损坏的存档", summary: ""});
      }
    } else {
      slots.push({index: si, savedAt: null, summary: ""});
    }
  }
  return slots;
}

function getSlotSummary(data) {
  var cls = "";
  if (data.classes) {
    for (var ci = 0; ci < data.classes.length; ci++) {
      var c = data.classes[ci];
      if (c && c.name && c.level > 0) {
        cls += (cls ? " / " : "") + c.name + c.level;
      }
    }
  }
  return cls;
}

function showSaveDialog(callback) {
  var charName = CURRENT_CHAR || state.name;
  var slots = getCharSlots(charName);
  var h = "<div style='padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0'>";
  h += "<div style='font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a'>选择存档位置</div>";
  for (var si = 0; si < slots.length; si++) {
    var s = slots[si];
    var timeStr = s.savedAt ? new Date(s.savedAt).toLocaleString() : "空";
    var summaryStr = s.summary ? " - " + s.summary : "";
    h += "<div onclick='selectSaveSlot(" + s.index + ")' style='padding:10px 14px;margin-bottom:6px;background:#3d3020;border:1px solid #5a4a30;border-radius:6px;cursor:pointer'>";
    h += "<div style='font-size:14px;font-weight:bold;color:#e0d0c0'>存档位" + s.index + "</div>";
    h += "<div style='font-size:12px;color:#b09070'>" + timeStr + summaryStr + "</div>";
    h += "</div>";
  }
  h += "<div style='margin-top:8px'><button onclick='closeReplaceModal()' style='padding:6px 16px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer'>取消</button></div>";
  h += "</div>";
  showSkillPreview("保存角色", "", "", h, function(){});
  window._saveCallback = callback;
}

function selectSaveSlot(slotIndex) {
  closeReplaceModal();
  if (window._saveCallback) {
    window._saveCallback(slotIndex);
  }
  window._saveCallback = null;
}

function autoSave() {
  state._dirty = true;
}

// Initialize from URL params
function initFromURL() {
  var params = new URLSearchParams(window.location.search);
  var charName = params.get("char");
  var slot = parseInt(params.get("slot")) || 0;
  if (charName && slot > 0) {
    if (loadState(charName, slot)) {
      render();
      return true;
    }
  }
  return false;
}

// Before unload handler
window.addEventListener("beforeunload", function(e) {
  if (state._dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Custom back navigation
function goBackToSlots() {
  if (state._dirty) {
    if (confirm("当前角色有未保存的更改，是否保存？")) {
      showSaveDialog(function(slotIndex) {
        if (saveState(slotIndex)) {
          window.location.href = "角色存档页.html?char=" + (CURRENT_CHAR || state.name);
        }
      });
      return;
    }
    // 不保存 → 直接返回
    window.location.href = "角色存档页.html?char=" + (CURRENT_CHAR || state.name);
    return;
  }
  window.location.href = "角色存档页.html?char=" + (CURRENT_CHAR || state.name);
}

var RECREATE_HANDOFF_KEY = "snowd_recreate_handoff";

function hasCreationSnapshot(st) {
  st = st || state;
  return !!(st && st._creationSnapshot && typeof st._creationSnapshot === "object");
}

function hasProgressBeyondCreation(st) {
  st = st || state;
  if (!st) return false;
  var classes = st.classes || [];
  if (classes[0] && classes[0].level > 1) return true;
  if (classes[1] && classes[1].level > 0) return true;
  if (classes[2] && classes[2].level > 0) return true;
  if ((st.xp || 0) > 0) return true;
  if ((st.sp_points || 0) > 0) return true;
  if (st.special_feats && st.special_feats.length > 0) return true;
  var skills = st.skills || [];
  var i, s;
  for (i = 0; i < skills.length; i++) {
    s = skills[i];
    if (typeof isBlueprintName === "function" && isBlueprintName(s.n || s.name)) continue;
    if (typeof isFreeSlotSkill === "function" && isFreeSlotSkill(s)) continue;
    if (s.granted === true) continue;
    return true;
  }
  return false;
}

function getRecreateUnavailableReason(st) {
  st = st || state;
  if (st && st._chargenOrigin === "upload") {
    return "上传角色无法追溯创建时的初始属性与选项，因此不可使用重新车卡。请从主页新建角色。";
  }
  return "此角色没有创建快照，无法重新车卡。上传角色或旧版创建的角色不受支持；请从主页新建角色。";
}

function startRecreateFromPanel() {
  if (!hasCreationSnapshot(state)) {
    SB_toast(getRecreateUnavailableReason(state));
    return;
  }
  if (hasProgressBeyondCreation(state)) {
    if (!confirm("重新车卡将基于创建时的选项另存为新的 1 级角色，不会保留当前等级与已学技能；该操作无法撤回。原角色存档不受影响。是否继续？")) {
      return;
    }
  }
  function proceed() {
    try {
      sessionStorage.setItem(RECREATE_HANDOFF_KEY, JSON.stringify({
        version: 1,
        snapshot: state._creationSnapshot
      }));
    } catch (e) {
      SB_toast("无法启动重新车卡：" + (e && e.message ? e.message : e));
      return;
    }
    window.location.href = "角色创建页.html?recreate=1";
  }
  if (state._dirty) {
    if (confirm("当前角色有未保存的更改，是否先保存？\n\n确定 = 保存后继续\n取消 = 不保存直接继续")) {
      showSaveDialog(function (slotIndex) {
        if (saveState(slotIndex)) proceed();
      });
      return;
    }
  }
  proceed();
}

function calcMod(s){return Math.floor((s-10)/2)}function mStr(v){return v>=0?'+'+v:v}


function calcTotalHP(mc,ml,sc,sl,con,race,bg,fb){


  if(!mc||!ml)return 0;var cm=calcMod(con);



  var hd=REF_CLASSES[mc];var f=hd&&hd.hp_formula?hd.hp_formula.first:8;


  var u=hd&&hd.hp_formula?hd.hp_formula.level_up:2;


  var rhp=0;if(race&&REF_RACES[race]){rhp=REF_RACES[race]["hp_bonus"]||0;}var bhp=0;if(bg&&REF_BACKGROUNDS&&REF_BACKGROUNDS[bg]){var _bv=REF_BACKGROUNDS[bg]["hp_bonus"];if(typeof _bv==="string"){_bv=parseInt(_bv)||0;}if(typeof _bv==="number")bhp=_bv;}var hp=f+cm+rhp+bhp+u*(ml-1)+cm*(ml-1);


  if(sc&&sl>0){


    var sd=REF_CLASSES[sc];


    var su=sd&&sd.hp_formula?sd.hp_formula.level_up:2;


    // Sub class: each level gets (level_up_hp+con_mod), no first-level bonus


    hp+=(su+cm)*(sl-1);


  }


  // Add flat bonus (feats, race, background)


  if(fb) hp+=fb;


  return hp;}


function calcTotalFP(mc,ml,sc,sl,ka,kv,race,fb){


  if(!mc||!ml)return 0;var km=calcMod(kv);


  var fd=REF_CLASSES[mc];var f=fd&&fd.fp_formula?fd.fp_formula.first:8;


  var u=fd&&fd.fp_formula?fd.fp_formula.level_up:1;


  var rfp=0;if(race&&REF_RACES[race]){rfp=REF_RACES[race]["fp_bonus"]||0;}


  var fp=f+km+rfp+u*(ml-1);if(sc&&sl>0){var sd=REF_CLASSES[sc];var su=sd&&sd.fp_formula?sd.fp_formula.level_up:1;fp+=su*(sl-1);}if(fb)fp+=fb;return fp;}



function findSkillStyleAnywhere(name) {
  for (var key in SKILL_DATA) {
    if (key === "通用") continue;
    var arr = SKILL_DATA[key];
    if (!arr) continue;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].name === name) return arr[i].style || "";
    }
  }
  return '';
}







const TIER_UNLOCK_COST = {
    "\u4e09\u9636": {cost: 50, minLevel: 3},
    "\u56db\u9636": {cost: 100, minLevel: 6},
    "\u4e94\u9636": {cost: 300, minLevel: 9},
    "\u516d\u9636": {cost: 500, minLevel: 12},
    "\u4e03\u9636": {cost: 1000, minLevel: 15},
    "\u516b\u9636": {cost: 3000, minLevel: 18},
    "\u4e5d\u9636": {cost: 5000, minLevel: 20}
};
function getMaxLevel() {
    var maxLv = 0;
    for (var mi = 0; mi < state.classes.length; mi++) {
      if (state.classes[mi].level > maxLv) maxLv = state.classes[mi].level;
    }
    return maxLv;
  }
  function getMaxSubLevel() {
    var mc = state.classes[0];
    if (!mc || !mc.name) return 0;
    // 快速兼职：主职业5级即可兼职，无等级差限制
    if (state.special_feats && state.special_feats.indexOf("快速兼职") >= 0) {
      if (mc.level < 5) return 0;
      return 15;
    }
    if (mc.level < 7) return 0;
    return Math.max(0, mc.level - 5);
  }

var PROF_DEFS = {
  "力量":["豁免","威力","承重","运动-跳跃","运动-攀爬","运动-游泳","运动-自定义"],
  "敏捷":["豁免","体操","骑乘","隐匿","巧手-偷窃","巧手-开锁","巧手-拆除","巧手-自定义"],
  "体质":["豁免","专注","耐力"],
  "智力":["豁免","宗教","调查","估价","伪造","读唇","逻辑","奥秘-魔法学识","奥秘-炼金术","奥秘-神奇道具","奥秘-多元宇宙","知识-历史","知识-地理","知识-人文","知识-政治","知识-神秘学","知识-工程学","知识-珠宝学","知识-草药学","知识-医药","知识-烹饪","知识-自定义"],
  "感知":["豁免","洞悉","导航","自然","驯兽","感悟","聆听","察觉","警惕值"],
  "魅力":["豁免","欺瞒","恐吓","说服","表演-歌唱","表演-舞蹈","表演-演奏","表演-自定义"],
  "意志":["豁免","求生","激励","决策"],
  "幸运":["豁免","机遇","探索"]
};

var PROF_NAME_ALIASES = {
  "医药":{attr:"智力",key:"知识-医药"},
  "烹饪":{attr:"智力",key:"知识-烹饪"},
  "草药学":{attr:"智力",key:"知识-草药学"},
  "珠宝学":{attr:"智力",key:"知识-珠宝学"},
  "工程学":{attr:"智力",key:"知识-工程学"},
  "神秘学":{attr:"智力",key:"知识-神秘学"},
  "历史":{attr:"智力",key:"知识-历史"},
  "地理":{attr:"智力",key:"知识-地理"},
  "人文":{attr:"智力",key:"知识-人文"},
  "政治":{attr:"智力",key:"知识-政治"},
  "炼金术":{attr:"智力",key:"奥秘-炼金术"},
  "炼金":{attr:"智力",key:"奥秘-炼金术"},
  "魔法学识":{attr:"智力",key:"奥秘-魔法学识"},
  "神奇道具":{attr:"智力",key:"奥秘-神奇道具"},
  "多元宇宙":{attr:"智力",key:"奥秘-多元宇宙"},
  "开锁":{attr:"敏捷",key:"巧手-开锁"},
  "偷窃":{attr:"敏捷",key:"巧手-偷窃"},
  "拆除":{attr:"敏捷",key:"巧手-拆除"},
  "攀爬":{attr:"力量",key:"运动-攀爬"},
  "跳跃":{attr:"力量",key:"运动-跳跃"},
  "游泳":{attr:"力量",key:"运动-游泳"},
  "探索":{attr:"幸运",key:"探索"},
  "隐匿":{attr:"敏捷",key:"隐匿"},
  "逻辑":{attr:"智力",key:"逻辑"},
  "歌唱":{attr:"魅力",key:"表演-歌唱"},
  "舞蹈":{attr:"魅力",key:"表演-舞蹈"},
  "演奏":{attr:"魅力",key:"表演-演奏"}
};

var PROF_CATEGORY_KEYS = {
  "巧手":{attr:"敏捷",keys:["巧手-偷窃","巧手-开锁","巧手-拆除","巧手-自定义"]},
  "运动":{attr:"力量",keys:["运动-跳跃","运动-攀爬","运动-游泳","运动-自定义"]},
  "奥秘":{attr:"智力",keys:["奥秘-魔法学识","奥秘-炼金术","奥秘-神奇道具","奥秘-多元宇宙"]},
  "表演":{attr:"魅力",keys:["表演-歌唱","表演-舞蹈","表演-演奏","表演-自定义"]},
  "知识":{attr:"智力",keys:["知识-历史","知识-地理","知识-人文","知识-政治","知识-神秘学","知识-工程学","知识-珠宝学","知识-草药学","知识-医药","知识-烹饪","知识-自定义"]}
};

var CUSTOM_PROF_SKILLS = {
  "垂钓":true,"栽培":true,"写作":true,"酿酒":true,"绘画":true,"制图":true,"裁缝":true,
  "雕刻":true,"制皮":true,"易容":true,"制毒":true,"锻造":true,
  "陆运载具":true,"水运载具":true,"空中载具":true
};

function findProfAttrByKey(profKey) {
  if (!profKey) return null;
  if (PROF_NAME_ALIASES[profKey]) return PROF_NAME_ALIASES[profKey].attr;
  for (var attr in PROF_DEFS) {
    if (PROF_DEFS[attr].indexOf(profKey) >= 0) return attr;
  }
  if (state.profs) {
    for (var a in state.profs) {
      if (a === "通用") continue;
      if (state.profs[a] && state.profs[a].hasOwnProperty(profKey)) return a;
    }
  }
  return null;
}

/** Resolve a proficiency display/data name to {attr,key} or {custom:name} or {category,attr,keys}. */
function resolveProfTarget(name) {
  if (!name) return null;
  if (CUSTOM_PROF_SKILLS[name] || (name.indexOf("的专业") >= 0)) {
    var cn = name.replace(/的专业熟练度.*$/, "").replace(/专业熟练度$/, "").trim();
    if (CUSTOM_PROF_SKILLS[name]) cn = name;
    return { custom: cn || name };
  }
  if (PROF_CATEGORY_KEYS[name]) {
    var cat = PROF_CATEGORY_KEYS[name];
    return { category: name, attr: cat.attr, keys: cat.keys.slice() };
  }
  if (PROF_NAME_ALIASES[name]) {
    return { attr: PROF_NAME_ALIASES[name].attr, key: PROF_NAME_ALIASES[name].key };
  }
  var attr = findProfAttrByKey(name);
  if (attr) return { attr: attr, key: name };
  return null;
}

function ensureProfKey(attr, key) {
  if (!state.profs) state.profs = {};
  if (!state.profs[attr]) state.profs[attr] = {};
  if (typeof state.profs[attr][key] !== "number") state.profs[attr][key] = 0;
}

function bumpProf(attr, key, delta) {
  ensureProfKey(attr, key);
  state.profs[attr][key] = Math.max(0, (state.profs[attr][key] || 0) + delta);
}

function bumpCustomProf(name, delta) {
  if (!state.custom_profs) state.custom_profs = {};
  state.custom_profs[name] = Math.max(0, (state.custom_profs[name] || 0) + delta);
}

function migrateProfKeys(profs) {
  if (!profs || !profs["力量"]) return;
  var p = profs["力量"];
  var legacy = ["运动-马术", "运动-冲浪"];
  var maxV = typeof p["运动-自定义"] === "number" ? p["运动-自定义"] : 0;
  for (var i = 0; i < legacy.length; i++) {
    if (typeof p[legacy[i]] === "number") {
      if (p[legacy[i]] > maxV) maxV = p[legacy[i]];
      delete p[legacy[i]];
    }
  }
  if (p["运动-自定义"] === undefined || maxV > (p["运动-自定义"] || 0)) p["运动-自定义"] = maxV;
}

function getAttrCapForLevel(level) {
  var tbl = LEVEL_TABLE["主职业"];
  var cap = 18;
  var maxLv = level != null ? level : getMaxLevel();
  for (var li = 1; li <= maxLv; li++) {
    if (tbl[li] && tbl[li].attr_cap) cap = tbl[li].attr_cap;
  }
  return cap;
}

function getProfCapForLevel(level) {
  var tbl = LEVEL_TABLE["主职业"];
  var cap = 2;
  var maxLv = level != null ? level : getMaxLevel();
  for (var li = 1; li <= maxLv; li++) {
    if (tbl[li] && tbl[li].prof_cap) cap = tbl[li].prof_cap;
  }
  return cap;
}

function getCurrentAttrCap() {
  return getAttrCapForLevel(getMaxLevel());
}

function calcSkillSlots(clsIdx) {
  var cl = state.classes[clsIdx];
  if (!cl || !cl.name) return 0;
  var tbl = LEVEL_TABLE[clsIdx === 1 ? "子职业" : "主职业"];
  var total = 0;
  for (var li = 1; li <= cl.level; li++) {
    var add = (tbl[li] && tbl[li].slot) ? tbl[li].slot : 0;
    // 法师 gets double slots per level (only the per-level increment, not the base)
    if (cl.name === "法师" && li > 1) add *= 2;
    total += add;
  }
  if (clsIdx === 0) total += (state.extra_skill_slots || 0);
  return total;
}

/** 背景/种族免费授予等：计入技能列表但不占技能栏上限 */
function isFreeSlotSkill(s) {
  if (!s) return false;
  if (s.grantedBy === "卓尔精灵·毒吻者") return false; // 毒刃免费获得但占技能栏上限
  return !!(s.freeSlot || s.grantedBy === "法师学徒");
}

/** sub 是否标记为子职业技能（兼容旧档 boolean true） */
function isSubSkillTagged(s) {
  if (!s) return false;
  var sub = s.sub;
  if (sub === true) return true;
  if (sub === false || sub == null || sub === "") return false;
  return String(sub) !== "";
}

/** 规范化 skill.sub：主职 ""，子职为非空职业名字符串 */
function normalizeSkillSubField(s) {
  if (!s) return s;
  var sub = s.sub;
  if (sub === true) {
    s.sub = s.src || s.source || (state.classes[1] && state.classes[1].name) || "子职业";
  } else if (sub === false || sub == null) {
    s.sub = "";
  } else {
    s.sub = String(sub);
  }
  return s;
}

function normalizeAllSkillSubs() {
  var list = state.skills || [];
  for (var i = 0; i < list.length; i++) normalizeSkillSubField(list[i]);
}

function isMainSkillOccupant(s) {
  if (!s) return false;
  if (isBlueprintName(s.n || s.name)) return false;
  if (isFreeSlotSkill(s)) return false;
  return !isSubSkillTagged(s);
}

function isSubSkillOccupant(s) {
  if (!s) return false;
  if (isBlueprintName(s.n || s.name)) return false;
  if (isFreeSlotSkill(s)) return false;
  return isSubSkillTagged(s);
}

/** 学习用栏位索引：通用 / 负索引一律计入主职 */
function resolveSkillSlotClsIdx(clsIdx) {
  if (clsIdx === 1) return 1;
  return 0;
}

function listOccupiedSkills(clsIdx) {
  var idx = resolveSkillSlotClsIdx(clsIdx);
  var list = state.skills || [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    if (idx === 1) {
      if (isSubSkillOccupant(list[i])) out.push(list[i]);
    } else if (isMainSkillOccupant(list[i])) {
      out.push(list[i]);
    }
  }
  return out;
}

function countOccupiedSkillSlots(clsIdx) {
  return listOccupiedSkills(clsIdx).length;
}

function getCurrentProfCap() {
  return getProfCapForLevel(getMaxLevel());
}

/** Extra talent slots granted for a tier (额外槽位 / 天赋异禀 → state.extra_slots). */
function countExtraTalentSlots(tierName) {
  tierName = normalizeTierName(tierName || "");
  var slots = state.extra_slots || [];
  var n = 0;
  for (var i = 0; i < slots.length; i++) {
    if (normalizeTierName(slots[i]) === tierName) n++;
  }
  return n;
}

/** Per-tier talent column capacity: base 5 + extra_slots for that tier. */
function getTalentTierlotCap(tierName) {
  return 5 + countExtraTalentSlots(tierName);
}

function persistLevelUpSave() {
  state._dirty = true;
  if (!CURRENT_CHAR) return;
  var si = CURRENT_SLOT || 1;
  try {
    saveState(si);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("_snowd_last_save_" + CURRENT_CHAR + "_" + si, JSON.stringify(state));
    }
  } catch (e) { /* keep dirty */ }
}




/** 按名在 SKILL_DATA 中定位首个来源职业（用于无 cls 天赋的起始判定） */
function findSkillSrcClass(name) {
  for (var _key in SKILL_DATA) {
    if (_key === "通用") continue;
    var _arr = SKILL_DATA[_key];
    if (!_arr) continue;
    for (var _i = 0; _i < _arr.length; _i++) {
      if (_arr[_i].name === name) return _key;
    }
  }
  return '';
}

/** 判断技能/天赋名是否为该职业的起始特性（type=starting 或 REF_CLASSES.starting_features 匹配） */
function isStartingSkill(name, srcCls) {
  if (!name || !srcCls || srcCls === "通用") return false;
  var _sd = SKILL_DATA[srcCls];
  if (_sd) {
    for (var _si = 0; _si < _sd.length; _si++) {
      if (_sd[_si].name === name && _sd[_si].type === "starting") return true;
    }
  }
  var _rc = REF_CLASSES[srcCls];
  if (_rc && _rc.starting_features) {
    for (var _rci = 0; _rci < _rc.starting_features.length; _rci++) {
      if (_rc.starting_features[_rci].name === name) return true;
    }
  }
  return false;
}

function autoCalcStyles(){
  // Preserve styles from upload/xlsx: skip only if styles were manually set (all 4 non-empty)
  for(var pi=0;pi<state.classes.length;pi++){
    var cs=state.classes[pi];
    if(cs.name&&cs.styles&&cs.styles.length===4&&cs.styles[0]&&cs.styles[1]&&cs.styles[2]&&cs.styles[3]&&
       cs.styles[0]!=="通用"&&cs.styles[1]!=="通用")return;
  }

  var sc={};for(var i=0;i<state.skills.length;i++){


    var s=state.skills[i];if(!s.src||s.src==="通用")continue;
    if(isStartingSkill(s.n,s.src))continue;

    var ci=(s.sub&&s.sub!='')?1:0;


    if(!sc[ci])sc[ci]={};var stName=getSkillStyle(s.n,s.src);if(!stName||stName==="通用"||stName==="起始特性")continue;if(!sc[ci][stName])sc[ci][stName]=0;sc[ci][stName]++;}


  // Count styles from talent tree
  for(var ti=0;ti<state.talent_tree.length;ti++){
    var t=state.talent_tree[ti];if(!t||!t.n)continue;
    var tCls=t.cls||"";if(tCls==="通用")continue;
    // 起始特性天赋不计入风格判断（与技能统计一致）
    if(tCls){if(isStartingSkill(t.n,tCls))continue;}
    else{var _anyStyle=findSkillStyleAnywhere(t.n);if(_anyStyle){var _anyCls=findSkillSrcClass(t.n);if(_anyCls&&isStartingSkill(t.n,_anyCls))continue;}}
    var tStyle=tCls?getSkillStyle(t.n,tCls):findSkillStyleAnywhere(t.n);
    if(!tStyle)continue;
    var tci=((t.sub&&t.sub!="")||(t.cls&&state.classes[1].name&&t.cls===state.classes[1].name))?1:0;
    if(!sc[tci])sc[tci]={};if(!sc[tci][tStyle])sc[tci][tStyle]=0;sc[tci][tStyle]++;}

  for(var ci=0;ci<state.classes.length;ci++){


    if(sc[ci]){var st=Object.keys(sc[ci]).sort(function(a,b){return sc[ci][b]-sc[ci][a]}).filter(function(s){return s&&s!=="通用"&&s!=="起始特性";});
    for(var i=0;i<4;i++)state.classes[ci].styles[i]=st[i]||'';}}}


function ensureClaimedLevels(){
  if(!state.claimed_levels)state.claimed_levels={};
  if(!state.classes)return;
  for(var ci=0;ci<state.classes.length;ci++){
    var cl=state.classes[ci];
    if(!cl||!(cl.level>0))continue;
    if(!state.claimed_levels[ci]){
      state.claimed_levels[ci]=[];
      for(var lv=1;lv<=cl.level;lv++)state.claimed_levels[ci].push(lv);
    }
  }
}

function autoCalcTalentTree(){
  // claimed_levels must init even when talent_tree early-returns (mage 预知梦 etc.)
  ensureClaimedLevels();
  // Preserve talents from upload: skip if talent_tree already has items with tiers
  var _tl=state.talent_tree||[];if(_tl.length>0&&_tl[0].tier)return;
  state.talent_tree=_tl;
}


function costHtml(c){return c||'\u2014';}








function skillDescCell(d, cn, sn) {


  if (!d) return "—";


  var sd = d.length > 25 ? d.substring(0, 25) + "..." : d;


  return sd + " <button onclick=\'showSkillDetail(\"" + cn + "\",\"" + sn + "\")\' style=\'padding:1px 6px;font-size:10px;background:#3a5a7a;color:#ddd;border:none;border-radius:3px;cursor:pointer;vertical-align:middle\'>\ud83d\udcd6</button>";


}





// Hex to color name mapping (reverse of spColors)


var _hex2name = {"#EE822F":"\u6a59\u8272","#FFFFFF":"\u767d\u8272","#B94BFF":"\u7d2b\u8272","#FFF32F":"\u9ec4\u8272","#D9D9D9":"\u65e0\u8272","#00B0F0":"\u84dd\u8272","#00FA99":"\u9752\u8272","#595959":"\u9ed1\u8272","#FF0000":"\u7ea2\u8272","#843F0B":"\u68d5\u8272","#FFB7E3":"\u7c89\u8272","#00B050":"\u7eff\u8272","#B3F9FF":"\u6d45\u8272","#808080":"\u9ed1\u8272","#F79646":"\u6a59\u8272","#FF66CC":"\u7c89\u8272","#851321":"\u68d5\u8272"};





function getSkillColorName(skillData) {


  // Get the required color for a skill from its "color" field


  var hex = skillData.color || "";


  if (!hex) return "\u65e0\u8272"; // default to colorless if no color field


  // Check if it's the rainbow gradient


  if (hex.indexOf("gradient") >= 0 || hex === "\u70ab\u5f69") return "\u70ab\u5f69";


  return _hex2name[hex] || "\u65e0\u8272";


}








function getSkillSPCost(skillName, skillSrc) {


  // Look up the skill color from SKILL_DATA


  for (var cls in SKILL_DATA) {


    var skills = SKILL_DATA[cls];


    for (var si = 0; si < skills.length; si++) {


      if (skills[si].name === skillName) {


        var hex = skills[si].color || "";


        if (!hex || hex === "\u70ab\u5f69") return "";


        // Map hex to name directly (_hex2name has hex as keys, name as values)


        return _hex2name[hex] || "";


      }


    }


  }


  return "";


}


function getFreeSPColors(){var _fc=[];for(var _fi=0;_fi<(state.special_feats||[]).length;_fi++){var _fn=typeof state.special_feats[_fi]==="string"?state.special_feats[_fi]:state.special_feats[_fi].name;if(_fn==="质朴"){_fc.push("白色");break;}}var _ml=state.classes[0].level||0;if(_ml>=10){var _colorMap={"红之精通":"红色","橙之精通":"橙色","黄之精通":"黄色","绿之精通":"绿色","青之精通":"青色","蓝之精通":"蓝色","紫之精通":"紫色","粉之精通":"粉色","棕之精通":"棕色","黑之精通":"黑色","白之精通":"白色","碧之精通":"浅色"};var _tt=state.talent_tree||[];for(var _ti=0;_ti<_tt.length;_ti++){var _cn=_colorMap[_tt[_ti].n];if(_cn&&_fc.indexOf(_cn)<0)_fc.push(_cn);}}return _fc;} function getKeyPreferenceColor(){var tt=state.talent_tree||[];for(var i=0;i<tt.length;i++){if(tt[i].n==="关键偏好"&&tt[i].pref)return tt[i].pref;}return"";}
function parseSkillCost(skillData) {


  // Parse skill cost into a flat array of {colorName, colorHex}


  // Supports: single object {color, name}, array [{color, name}, ...]


  var _hex2name_local = {"#EE822F":"\u6a59\u8272","#FFFFFF":"\u767d\u8272","#B94BFF":"\u7d2b\u8272","#FFF32F":"\u9ec4\u8272","#D9D9D9":"\u65e0\u8272","#00B0F0":"\u84dd\u8272","#00FA99":"\u9752\u8272","#595959":"\u9ed1\u8272","#FF0000":"\u7ea2\u8272","#843F0B":"\u68d5\u8272","#FFB7E3":"\u7c89\u8272","#00B050":"\u7eff\u8272","#B3F9FF":"\u6d45\u8272","#808080":"\u9ed1\u8272","#F79646":"\u6a59\u8272","#FF66CC":"\u7c89\u8272","#851321":"\u68d5\u8272"};


  if (!skillData.cost) return [];


  var raw = skillData.cost;


  var result = [];


  // Normalize to array


  var items = Array.isArray(raw) ? raw : [raw];


  for (var ci = 0; ci < items.length; ci++) {


    var item = items[ci];


    if (!item || !item.color) continue;


    var count = item.count || 1;


    var hex = item.color;


    var name = item.name || _hex2name_local[hex] || "\u65e0\u8272";


    for (var si = 0; si < count; si++) {


      result.push({colorName: name, colorHex: hex});


    }


  }


  return result;


}












var MARK_COLOR_NAMES = ["\u6a59\u8272","\u767d\u8272","\u7d2b\u8272","\u9ec4\u8272","\u65e0\u8272","\u84dd\u8272","\u9752\u8272","\u9ed1\u8272","\u7ea2\u8272","\u68d5\u8272","\u7c89\u8272","\u7eff\u8272","\u6d45\u8272","\u70ab\u5f69"];

var MARK_COLOR_HEX = {"\u6a59\u8272":"#EE822F","\u767d\u8272":"#FFFFFF","\u7d2b\u8272":"#B94BFF","\u9ec4\u8272":"#FFF32F","\u65e0\u8272":"#D9D9D9","\u84dd\u8272":"#00B0F0","\u9752\u8272":"#00FA99","\u9ed1\u8272":"#595959","\u7ea2\u8272":"#FF0000","\u68d5\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u7eff\u8272":"#00B050","\u6d45\u8272":"#B3F9FF","\u70ab\u5f69":"linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)"};

var CHROMATIC_MARK_NAMES = ["\u6a59\u8272","\u767d\u8272","\u7d2b\u8272","\u9ec4\u8272","\u84dd\u8272","\u9752\u8272","\u9ed1\u8272","\u7ea2\u8272","\u68d5\u8272","\u7c89\u8272","\u7eff\u8272","\u6d45\u8272"];

function isWildcardMarkName(colorName) {
  return colorName === "\u65e0\u8272" || colorName === "\u70ab\u5f69";
}

function defaultColorMarks() {
  var m = {}, i;
  for (i = 0; i < MARK_COLOR_NAMES.length; i++) m[MARK_COLOR_NAMES[i]] = false;
  return m;
}

function ensureSpState() {
  if (!state.color_marks) state.color_marks = defaultColorMarks();
  if (typeof state.sp_points !== "number") state.sp_points = 0;
  ensureBlueprintState();
}

function parseSpFromXlsxText(text) {
  if (text == null || text === "") return 0;
  text = String(text).trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return Math.max(0, parseInt(text, 10));
  var spMap = {"\u6a59":"\u6a59\u8272","\u767d":"\u767d\u8272","\u7d2b":"\u7d2b\u8272","\u9ec4":"\u9ec4\u8272","\u65e0":"\u65e0\u8272","\u84dd":"\u84dd\u8272","\u9752":"\u9752\u8272","\u9ed1":"\u9ed1\u8272","\u7ea2":"\u7ea2\u8272","\u68d5":"\u68d5\u8272","\u7c89":"\u7c89\u8272","\u7eff":"\u7eff\u8272","\u6d45":"\u6d45\u8272","\u70ab":"\u70ab\u5f69"};
  var total = 0, i;
  for (i = 0; i < text.length; i++) { if (spMap[text.charAt(i)]) total++; }
  return total;
}

function ensureSpStateOn(obj) {
  if (!obj.color_marks) obj.color_marks = defaultColorMarks();
  if (typeof obj.sp_points !== "number") obj.sp_points = 0;
}


var BLUEPRINT_EXPORT_SLOTS = 20;
/** 改版模板：图纸标题 O172，槽位 O173–O192（每格 O:P 合并） */
var BLUEPRINT_XLSX_TITLE = "O172";
var BLUEPRINT_XLSX_TITLE_TEXT = "\u56fe\u7eb8(\u4e13\u4e1a\u69fd\u4f4d)";
var BLUEPRINT_XLSX_CELLS = (function(){
  var a=[], i;
  for (i = 0; i < BLUEPRINT_EXPORT_SLOTS; i++) a.push("O" + (173 + i));
  return a;
})();
/** 未持有栏位：名称列空单元格 + 对角线边框（不再写「——」） */
var XLSX_UNAVAILABLE_MARK = "";

/**
 * 在 styles.xml 追加「名称栏对角线划掉」边框 + cellXf（对齐手改样例：仅改名称列样式）。
 * 克隆技能名格常用外观（楷体/填充/居中），边框改为 diagonalDown。
 */
function xlsxEnsureCancelSlotStyle(stylesText) {
  var bm = /<borders count="(\d+)">/.exec(stylesText);
  var xm = /<cellXfs count="(\d+)">/.exec(stylesText);
  if (!bm || !xm) return { text: stylesText, styleId: "" };
  var borderCount = parseInt(bm[1], 10);
  var xfCount = parseInt(xm[1], 10);
  // 与模板技能名格边框色一致；diagonalDown 表示整格划掉
  var cancelBorder = '<border diagonalDown="1">'
    + '<left style="medium"><color rgb="FFAC6520"/></left><right/>'
    + '<top style="medium"><color rgb="FFAC6520"/></top>'
    + '<bottom style="medium"><color rgb="FFAC6520"/></bottom>'
    + '<diagonal style="medium"><color rgb="FFAC6520"/></diagonal></border>';
  stylesText = stylesText.replace(/<borders count="\d+">/, '<borders count="' + (borderCount + 1) + '">');
  stylesText = stylesText.replace("</borders>", cancelBorder + "</borders>");
  var cancelXf = '<xf numFmtId="0" fontId="1" fillId="3" borderId="' + borderCount + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
    + '<alignment horizontal="center" vertical="center"/></xf>';
  stylesText = stylesText.replace(/<cellXfs count="\d+">/, '<cellXfs count="' + (xfCount + 1) + '">');
  stylesText = stylesText.replace("</cellXfs>", cancelXf + "</cellXfs>");
  return { text: stylesText, styleId: String(xfCount) };
}
/** @deprecated 兼容旧名 */
function xlsxEnsureStrikeStyle(stylesText) { return xlsxEnsureCancelSlotStyle(stylesText); }

/**
 * 风格底纹色映射（26.07.31）：从 14 个基础职业 docx + 通用天赋树 docx 的表格单元格底纹提取。
 * 法师「防护」主技能区为 FCFF99（起始特性区 FBFF81 不采用，与参考 xlsx 一致）。
 * 白色底纹（死灵/妙手/诙谐/圣洁/虔佑）严格忠于 docx。
 */
var STYLE_COLOR_MAP = {
  "德鲁伊": {"荒野":"70D4A2","兽灵":"FFF8A3","复苏":"C2FDA6","月影":"C2C3FF","日怒":"FFAD8D","星辰":"8AE3FD","精火":"FFD7F8"},
  "法师": {"塑能":"FFA387","咒法":"B3E7FF","预言":"AFFFE6","防护":"FCFF99","附魔":"D0A5FF","死灵":"FFFFFF","幻术":"FFCBFF","变化":"FFC47D"},
  "战士": {"斗争":"FFDB81","狂攻":"FF6F6F","防护":"FEFF63","射击":"70FF5D","军团":"B1BCFE","机敏":"B0FCFF"},
  "游荡者": {"奇袭":"DEEBF7","妙手":"FFFFFF","狂妄":"FF8383","魅影":"E9D5FF","魔药":"5FFF88"},
  "吟游诗人": {"激昂":"ADEFFF","灵动":"FFC3DD","舒缓":"ADFFCA","诙谐":"FFFFFF","集中":"FCFF99"},
  "猎人": {"射击":"FFF3C7","兽群":"7FD16F","猎鹰":"DEEBF7","机敏":"C3FFF8","生存":"B6FF95"},
  "圣骑士": {"惩戒":"FFFE6F","守护":"F7BDFF","热诚":"FF6565","圣洁":"FFFFFF"},
  "蛮斗士": {"斗争":"FFDB81","狂暴":"FF4F4F","生机":"70FF5D","法咒":"83BEF9"},
  "武僧": {"极斗":"FDE3B0","织雾":"C2FDA6","踏风":"B2F6FB","无尘":"FEFF63","锋岚":"B5C7EA","酒仙":"78CC96","凰火":"FB7979"},
  "牧师": {"戒律":"FFF6C3","虔佑":"FFFFFF","魂谒":"AFE3FC"},
  "术士": {"潜能":"EBB9FF"},
  "魔契师": {"魔契":"A6BAF5","邪念":"93FF63","咒能":"D2B3FF","秘术":"BDF1FA"},
  "奇械师": {"精准":"FFFDAD","构想":"D5E7FF","支援":"ADFFB7","电涌":"F9FF4F","炽擎":"FF6363","魔枢":"ADEFFF"},
  "萨满祭司": {"风暴":"B3D5FF","水源":"B3FFEE","大地":"FFD4B3","火焰":"FF6D6D","巫术":"B6FF95"},
  "通用": {"通用天赋":"D7D7D7"}
};

/** 起始特性技能在 SKILL_DATA 中缺 style 字段，从 docx 颜色反查补全（26.07.31） */
var STARTING_STYLE_OVERRIDE = {
  "德鲁伊": {"缠绕术":"荒野","野兽形态":"兽灵","回春术":"复苏","月火术":"月影","阳炎术":"日怒"},
  "法师": {"塑能箭":"塑能","闪现术":"咒法","预知梦":"预言","法术护盾":"防护","魔法武器":"附魔","死灵弹":"死灵","次级幻影":"幻术","次级变形术":"变化"},
  "游荡者": {"背刺":"奇袭","潜行":"妙手","闷棍":"妙手","疾跑":"魅影"},
  "猎人": {"瞄准射击":"射击","野兽伙伴":"兽群","逃脱":"机敏","荒野医疗":"生存"},
  "圣骑士": {"审判":"惩戒","圣光出鞘":"惩戒","盾牌格挡":"守护","圣光术":"圣洁","驱邪术":"圣洁"},
  "武僧": {"猛虎掌":"极斗","扫堂腿":"极斗","滚地翻":"踏风","活血术":"织雾"},
  "牧师": {"惩击":"戒律","治疗术":"虔佑","恢复术":"虔佑","责难":"魂谒"},
  "奇械师": {"精准射击":"精准","基础材料学":"构想","同调协手":"支援","魔法武器":"魔枢"},
  "萨满祭司": {"闪电箭":"风暴","烈焰冲击":"火焰","治疗波":"水源","大地之盾":"大地"}
};

/** 取技能所属风格的底纹色；通用天赋一律灰色；查不到返回空串（不上色） */
function getStyleColorForSkill(sk, srcCls) {
  if (!sk || !srcCls) return "";
  if (srcCls === "通用" || srcCls === "通用天赋树") return STYLE_COLOR_MAP["通用"]["通用天赋"];
  var nm = sk.n || sk.name || "";
  var styleName = sk.style || "";
  // state.skills 条目不存 style，回查 SKILL_DATA（按 src 职业 + 技能名）
  if (!styleName && typeof SKILL_DATA !== "undefined" && SKILL_DATA[srcCls]) {
    var _arr = SKILL_DATA[srcCls];
    for (var _i2 = 0; _i2 < _arr.length; _i2++) {
      if (_arr[_i2].name === nm) { styleName = _arr[_i2].style || ""; break; }
    }
  }
  // 起始特性技能在 SKILL_DATA 中缺 style 的补全
  if (!styleName && STARTING_STYLE_OVERRIDE[srcCls] && STARTING_STYLE_OVERRIDE[srcCls][nm]) styleName = STARTING_STYLE_OVERRIDE[srcCls][nm];
  if (!styleName || !STYLE_COLOR_MAP[srcCls]) return "";
  return STYLE_COLOR_MAP[srcCls][styleName] || "";
}

/** 收集去重的 (baseXf, color) 需求 */
function xlsxPushStyleNeed(need, baseXf, color) {
  if (!need || !color || baseXf == null) return;
  var k = baseXf + ":" + color.toUpperCase();
  for (var i = 0; i < need.length; i++) if (need[i].key === k) return;
  need.push({ key: k, baseXf: baseXf, color: color.toUpperCase() });
}

/**
 * 在 styles.xml 中按需注册底纹色：每个 (baseXf, color) 克隆一个 xf（仅改 fillId），
 * 同色 fill 已存在则复用。返回 { text, styleIds: {"baseXf:COLOR": xfIdx} }。
 */
function xlsxEnsureStyleColors(stylesText, need) {
  if (!stylesText || !need || !need.length) return { text: stylesText, styleIds: {} };
  var fm = /<fills count="(\d+)">([\s\S]*?)<\/fills>/.exec(stylesText);
  var xm = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(stylesText);
  if (!fm || !xm) return { text: stylesText, styleIds: {} };
  var fillCount = parseInt(fm[1], 10);
  var xfCount = parseInt(xm[1], 10);
  var fillBlocks = fm[2].split("<fill>");
  var fillColors = [];
  for (var i = 1; i < fillBlocks.length; i++) {
    var cm = /<fgColor[^>]*rgb="(?:[0-9A-Fa-f]{2})?([0-9A-Fa-f]{6})"/.exec(fillBlocks[i]);
    fillColors.push(cm ? cm[1].toUpperCase() : "");
  }
  var xfBlocks = xm[2].match(/<xf\b[\s\S]*?<\/xf>|<xf\b[^>]*\/>/g) || [];
  var styleIds = {};
  var newFills = "";
  var newXfs = "";
  var needFillId = {};
  var fillAdd = 0;
  var xfAdd = 0;
  for (var n = 0; n < need.length; n++) {
    var item = need[n];
    if (styleIds[item.key] !== undefined) continue;
    var baseXfText = xfBlocks[item.baseXf] || xfBlocks[0] || "";
    if (!baseXfText) continue;
    var fillId = -1;
    if (needFillId[item.color] !== undefined) fillId = needFillId[item.color];
    else {
      for (var fi = 0; fi < fillColors.length; fi++) {
        if (fillColors[fi] === item.color) { fillId = fi; break; }
      }
      if (fillId < 0) {
        fillId = fillCount + fillAdd;
        fillAdd++;
        newFills += '<fill><patternFill patternType="solid"><fgColor rgb="FF' + item.color + '"/><bgColor indexed="64"/></patternFill></fill>';
      }
      needFillId[item.color] = fillId;
    }
    var xfText = baseXfText;
    if (/fillId="\d+"/.test(xfText)) xfText = xfText.replace(/fillId="\d+"/, 'fillId="' + fillId + '"');
    else xfText = xfText.replace(/<xf\b/, '<xf fillId="' + fillId + '"');
    if (/applyFill="\d+"/.test(xfText)) xfText = xfText.replace(/applyFill="\d+"/, 'applyFill="1"');
    else xfText = xfText.replace(/<xf\b/, '<xf applyFill="1"');
    // 名称类单元格统一水平居中（模板 E 列风格格默认无 horizontal，与手改样例一致）
    if (/<alignment\b/.test(xfText)) {
      if (!/horizontal="/.test(xfText)) xfText = xfText.replace(/<alignment\b/, '<alignment horizontal="center"');
    } else {
      xfText = xfText.replace(/\/>$/, '><alignment horizontal="center" vertical="center"/></xf>');
    }
    newXfs += xfText;
    styleIds[item.key] = xfCount + xfAdd;
    xfAdd++;
  }
  if (!newFills && !newXfs) return { text: stylesText, styleIds: styleIds };
  stylesText = stylesText.replace(/<fills count="\d+">/, '<fills count="' + (fillCount + fillAdd) + '">');
  stylesText = stylesText.replace("</fills>", newFills + "</fills>");
  stylesText = stylesText.replace(/<cellXfs count="\d+">/, '<cellXfs count="' + (xfCount + xfAdd) + '">');
  stylesText = stylesText.replace("</cellXfs>", newXfs + "</cellXfs>");
  return { text: stylesText, styleIds: styleIds };
}


/**
 * 将超出已解锁容量的栏位「划掉」：只动名称列（技能 B、图纸/天赋 O），格子留空 + 对角线样式。
 * 已填内容超出上限时不覆盖（从 max(容量,已填数) 起划）。
 */
function markUnavailableExportSlots(set, cancelStyleId, opts) {
  if (!cancelStyleId) return;
  var r, i, tier, range, cap, strikeFrom;
  var mainCap = Math.max(0, opts.mainSkillCap | 0);
  var mainFilled = Math.max(0, opts.mainSkillFilled | 0);
  var subCap = Math.max(0, opts.subSkillCap | 0);
  var subFilled = Math.max(0, opts.subSkillFilled | 0);
  var bpCap = Math.max(0, opts.blueprintCap | 0);
  var bpFilled = Math.max(0, opts.blueprintFilled | 0);
  strikeFrom = Math.max(mainCap, mainFilled);
  for (r = 123 + strikeFrom; r <= 162; r++) set("B" + r, "", true, cancelStyleId);
  strikeFrom = Math.max(subCap, subFilled);
  for (r = 168 + strikeFrom; r <= 209; r++) set("B" + r, "", true, cancelStyleId);
  strikeFrom = Math.max(bpCap, bpFilled);
  for (i = strikeFrom; i < BLUEPRINT_XLSX_CELLS.length; i++) {
    set(BLUEPRINT_XLSX_CELLS[i], "", true, cancelStyleId);
  }
  if (opts.tierRowMap) {
    for (tier in opts.tierRowMap) {
      if (!Object.prototype.hasOwnProperty.call(opts.tierRowMap, tier)) continue;
      range = opts.tierRowMap[tier];
      if (!range) continue;
      if (opts.isTierUnlocked && !opts.isTierUnlocked(tier)) {
        for (r = range[0]; r <= range[1]; r++) set("O" + r, "", true, cancelStyleId);
      } else {
        cap = (opts.getTalentCap ? opts.getTalentCap(tier) : 5) | 0;
        for (r = range[0] + cap; r <= range[1]; r++) set("O" + r, "", true, cancelStyleId);
      }
    }
  }
}

function isBlueprintName(name) {
  return !!(name && String(name).indexOf("\uff08\u56fe\u7eb8\uff09") >= 0);
}

function sumExtraProfessionalSlotsFromFeats() {
  var bonus = 0, i, name, fd, feats = state.special_feats || [];
  for (i = 0; i < feats.length; i++) {
    name = typeof feats[i] === "string" ? feats[i] : (feats[i].name || feats[i].n || "");
    if (!name || typeof SPECIAL_FEATS === "undefined") continue;
    fd = SPECIAL_FEATS[name];
    if (fd && fd.effects && fd.effects.extra_professional_slots)
      bonus += (parseInt(fd.effects.extra_professional_slots, 10) || 0);
  }
  return bonus;
}

function calcBlueprintSlots() {
  var intel = (state.attrs && state.attrs["\u667a\u529b"]) || 10;
  var bonus = (typeof state.blueprint_bonus_slots === "number" ? state.blueprint_bonus_slots : 0);
  bonus += sumExtraProfessionalSlotsFromFeats();
  return Math.max(0, 10 + calcMod(intel) + bonus);
}

function migrateBlueprintsFromSkillsAndTalents() {
  var bps = state.blueprints || [], seen = {}, i, s, n, next;
  for (i = 0; i < bps.length; i++) {
    n = bps[i] && (bps[i].n || bps[i].name);
    if (n) seen[n] = true;
  }
  next = [];
  for (i = 0; i < (state.skills || []).length; i++) {
    s = state.skills[i];
    n = s && (s.n || s.name);
    if (n && isBlueprintName(n)) {
      if (!seen[n]) {
        bps.push({ id: s.id || "", n: n, src: s.src || s.source || "", tier: s.tier || "", note: "" });
        seen[n] = true;
      }
    } else next.push(s);
  }
  state.skills = next;
  next = [];
  for (i = 0; i < (state.talent_tree || []).length; i++) {
    s = state.talent_tree[i];
    n = s && (s.n || s.name);
    if (n && isBlueprintName(n)) {
      if (!seen[n]) {
        bps.push({ id: s.id || "", n: n, src: s.cls || s.src || "", tier: s.tier || "", note: "" });
        seen[n] = true;
      }
    } else next.push(s);
  }
  state.talent_tree = next;
  state.blueprints = bps;
}

function ensureBlueprintState() {
  if (!state.blueprints) state.blueprints = [];
  if (typeof state.blueprint_bonus_slots !== "number") state.blueprint_bonus_slots = 0;
  migrateBlueprintsFromSkillsAndTalents();
  normalizeAllSkillSubs();
}

function addBlueprintEntry(entry, opts) {
  ensureBlueprintState();
  opts = opts || {};
  var name = entry && (entry.n || entry.name);
  var i, cap, ruleCap;
  if (!name) return { ok: false, reason: "\u540d\u79f0\u4e3a\u7a7a" };
  for (i = 0; i < state.blueprints.length; i++) {
    if ((state.blueprints[i].n || state.blueprints[i].name) === name) {
      return { ok: false, reason: "\u5df2\u5b66\u4e60\u8be5\u56fe\u7eb8" };
    }
  }
  if (state.blueprints.length >= BLUEPRINT_EXPORT_SLOTS) {
    return { ok: false, reason: "\u56fe\u7eb8\u683c\u5b50\u5df2\u6ee1\uff08\u6700\u591a " + BLUEPRINT_EXPORT_SLOTS + " \u4e2a\uff09" };
  }
  ruleCap = calcBlueprintSlots();
  if (!opts.silent && state.blueprints.length >= ruleCap) {
    SB_toast("\u5f53\u524d\u56fe\u7eb8\u6570\u5df2\u8fbe\u6216\u8d85\u8fc7\u89c4\u5219\u4e0a\u9650\uff08" + ruleCap + "\uff09\uff0c\u4ecd\u53ef\u8bb0\u5f55\uff08\u7269\u7406\u683c\u5b50 " + BLUEPRINT_EXPORT_SLOTS + "\uff09");
  }
  state.blueprints.push({
    id: entry.id || "",
    n: name,
    src: entry.src || entry.cls || "",
    tier: entry.tier || "",
    note: entry.note || ""
  });
  return { ok: true };
}

function removeBlueprintAt(idx) {
  ensureBlueprintState();
  if (idx < 0 || idx >= state.blueprints.length) return;
  state.blueprints.splice(idx, 1);
}

function clearXlsxBlueprints(set) {
  var i;
  for (i = 0; i < BLUEPRINT_XLSX_CELLS.length; i++) set(BLUEPRINT_XLSX_CELLS[i], "", false);
}

function fillXlsxBlueprints(set, blueprints) {
  var list = blueprints || [], i, n, max = BLUEPRINT_XLSX_CELLS.length;
  set(BLUEPRINT_XLSX_TITLE, BLUEPRINT_XLSX_TITLE_TEXT);
  clearXlsxBlueprints(set);
  for (i = 0; i < list.length && i < max; i++) {
    n = list[i].n || list[i].name || "";
    if (n) set(BLUEPRINT_XLSX_CELLS[i], n);
  }
  if (list.length > max) {
    console.warn("blueprints truncated for xlsx export:", list.length, ">", max);
  }
}


function parseSkillRequirements(skillData) {
  var flat = parseSkillCost(skillData), fixedSeen = {}, fixed = [], wildcards = 0, dots = [], i, n;
  for (i = 0; i < flat.length; i++) {
    n = flat[i].colorName;
    dots.push(flat[i]);
    if (isWildcardMarkName(n)) wildcards++;
    else if (!fixedSeen[n]) { fixedSeen[n] = true; fixed.push(n); }
  }
  return { fixed: fixed, wildcards: wildcards, dots: dots };
}

function skillHasCost(skillData) {
  var req = parseSkillRequirements(skillData);
  return req.fixed.length > 0 || req.wildcards > 0;
}

function getSpTotal() {
  ensureSpState();
  return state.sp_points || 0;
}

function hasColorMark(colorName) {
  ensureSpState();
  if (state.all_marks_active && CHROMATIC_MARK_NAMES.indexOf(colorName) >= 0) return true;
  return !!state.color_marks[colorName];
}

function getActiveChromaticMarks() {
  var out = [], i;
  ensureSpState();
  if (state.all_marks_active) return CHROMATIC_MARK_NAMES.slice();
  for (i = 0; i < CHROMATIC_MARK_NAMES.length; i++) {
    if (state.color_marks[CHROMATIC_MARK_NAMES[i]]) out.push(CHROMATIC_MARK_NAMES[i]);
  }
  return out;
}

function canSatisfyMarkRequirements(req) {
  var active = getActiveChromaticMarks(), used = {}, spare = 0, i, c, totalNeed;
  for (i = 0; i < req.fixed.length; i++) {
    c = req.fixed[i];
    if (active.indexOf(c) < 0) return { ok: false, reason: "\u7f3a\u5c11\u8272\u5f69\u6807\u8bc6\uff1a" + c };
    used[c] = true;
  }
  for (i = 0; i < active.length; i++) { if (!used[active[i]]) spare++; }
  if (spare < req.wildcards) {
    totalNeed = req.fixed.length + req.wildcards;
    return { ok: false, reason: "\u7f3a\u5c11\u8272\u5f69\u6807\u8bc6\uff1a\u9700\u8981 " + totalNeed + " \u79cd\u4e0d\u540c\u6709\u8272\u6807\u8bc6\uff08\u5f53\u524d " + active.length + " \u79cd\uff09" };
  }
  return { ok: true };
}

function canLearnSkill(skillData) {
  if (!skillHasCost(skillData)) return { ok: true };
  var req = parseSkillRequirements(skillData);
  var markCheck = canSatisfyMarkRequirements(req);
  if (!markCheck.ok) return markCheck;
  if (getSpTotal() < 1) return { ok: false, reason: "\u6280\u80fd\u70b9\u4e0d\u8db3" };
  return { ok: true };
}

function payForSkill(skillData) {
  var check = canLearnSkill(skillData);
  if (!check.ok) { SB_toast(check.reason); return false; }
  if (skillHasCost(skillData)) { ensureSpState(); state.sp_points--; }
  return true;
}

function refundSkillPoint(skillData) {
  if (!skillData || !skillHasCost(skillData)) return;
  ensureSpState();
  state.sp_points++;
}

function addSpPointsDelta(spObj, mult) {
  var total = 0, k;
  if (!spObj) return;
  ensureSpState();
  for (k in spObj) { if (spObj.hasOwnProperty(k)) total += (spObj[k] || 0); }
  state.sp_points = Math.max(0, (state.sp_points || 0) + mult * total);
}

function buildSkillListEntry(skillData, clsName, isSub, isLocked) {
  return {
    id: skillData.id, n: skillData.name, src: clsName,
    tm: skillData.fields ? (skillData.fields["\u65bd\u5c55\u65f6\u95f4"] || "") : "",
    ds: (skillData.description || [""]).join(""),
    dr: skillData.fields ? (skillData.fields["\u75b2\u52b3\u6d88\u8017"] || "") : "",
    range: skillData.fields ? (skillData.fields["\u65bd\u5c55\u8ddd\u79bb"] || "") : "",
    dur: skillData.fields ? (skillData.fields["\u6301\u7eed\u65f6\u95f4"] || "") : "",
    cost: "", sub: isSub ? clsName : "", locked: isLocked
  };
}

function getSkillDotStates(skill) {
  var flat = parseSkillCost(skill), active = getActiveChromaticMarks(), used = {}, states = [], i, n, ci, c, found;
  for (i = 0; i < flat.length; i++) {
    n = flat[i].colorName;
    if (isWildcardMarkName(n)) {
      found = false;
      for (ci = 0; ci < active.length; ci++) {
        c = active[ci];
        if (!used[c]) { used[c] = true; found = true; break; }
      }
      states.push(found);
    } else {
      states.push(active.indexOf(n) >= 0);
      if (active.indexOf(n) >= 0) used[n] = true;
    }
  }
  return { flat: flat, states: states };
}

function renderMarkOverviewHtml() {
  var html = "", i, cn, hex, on, bg;
  ensureSpState();
  html += "<div class='sp-overview-label'>可用技能点</div>";
  html += "<div class='sp-overview-total'>" + getSpTotal() + "</div>";
  html += "<div class='sp-mark-grid'>";
  for (i = 0; i < MARK_COLOR_NAMES.length; i++) {
    cn = MARK_COLOR_NAMES[i];
    hex = MARK_COLOR_HEX[cn];
    on = hasColorMark(cn);
    bg = (cn === "\u70ab\u5f69") ? MARK_COLOR_HEX["\u70ab\u5f69"] : hex;
    html += "<div class='sp-mark-chip " + (on ? "active" : "inactive") + "' title='" + cn + "\u6807\u8bc6'>";
    html += "<span class='sp-mark-dot' style='background:" + bg + "'></span>";
    html += "<span class='sp-mark-name'>" + cn + "</span></div>";
  }
  html += "</div>";
  return html;
}

function normalizeExportTalentTier(t) {
  var tName = t.n || t.name || "";
  var tTier = (t.tier || "").replace(/\u5929\u8d4b\u6811.*$/, "").replace(/[\uff08(]\d+[\uff09)]/g, "").trim();
  var numMap = { "1": "\u4e00\u9636", "2": "\u4e8c\u9636", "3": "\u4e09\u9636", "4": "\u56db\u9636", "5": "\u4e94\u9636", "6": "\u516d\u9636", "7": "\u4e03\u9636" };
  if (/^\d+\u9636$/.test(tTier)) tTier = (numMap[tTier.charAt(0)] || tTier);
  if ((!tTier || tTier.indexOf("\u9636") < 0) && typeof SKILL_TIER !== "undefined") {
    tTier = (SKILL_TIER[tName] || "").replace(/\u5929\u8d4b\u6811.*$/, "").replace(/[\uff08(]\d+[\uff09)]/g, "").trim();
  }
  if (!tTier || tTier.indexOf("\u9636") < 0) tTier = "\u4e00\u9636";
  return tTier;
}

function defaultTalentTierRowMap() {
  return {
    "\u4e00\u9636": [122, 126], "\u4e8c\u9636": [129, 133], "\u4e09\u9636": [136, 140],
    "\u56db\u9636": [143, 147], "\u4e94\u9636": [150, 154], "\u516d\u9636": [157, 161], "\u4e03\u9636": [164, 165]
  };
}

function buildTalentTierRowMap(strings, xml) {
  var tierOrder = ["\u4e00\u9636", "\u4e8c\u9636", "\u4e09\u9636", "\u56db\u9636", "\u4e94\u9636", "\u516d\u9636", "\u4e03\u9636"];
  var headers = {}, re = /<c r="O(\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g, m;
  while ((m = re.exec(xml)) !== null) {
    var row = parseInt(m[1], 10), text = strings[parseInt(m[2], 10)] || "";
    if (text.indexOf("\u5929\u8d4b\u6811") < 0) continue;
    for (var ti = 0; ti < tierOrder.length; ti++) {
      if (text.indexOf(tierOrder[ti]) >= 0) { headers[tierOrder[ti]] = row; break; }
    }
  }
  /** 图纸区标题行；末阶天赋不得侵入 O172+ */
  var blueprintTitleRow = 172;
  var bpTitleRe = /<c r="O(\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g;
  while ((m = bpTitleRe.exec(xml)) !== null) {
    text = strings[parseInt(m[2], 10)] || "";
    if (text.indexOf("\u56fe\u7eb8") >= 0 && text.indexOf("\u4e13\u4e1a") >= 0) {
      blueprintTitleRow = parseInt(m[1], 10);
      break;
    }
  }
  var tierRowMap = {}, hdr, nextHdr, start, end, ti, tj, tier;
  for (ti = 0; ti < tierOrder.length; ti++) {
    tier = tierOrder[ti];
    hdr = headers[tier];
    if (!hdr) continue;
    nextHdr = blueprintTitleRow;
    for (tj = ti + 1; tj < tierOrder.length; tj++) {
      if (headers[tierOrder[tj]]) { nextHdr = headers[tierOrder[tj]]; break; }
    }
    start = hdr + 1;
    end = nextHdr - 2;
    if (end < start) end = start;
    if (end >= blueprintTitleRow) end = blueprintTitleRow - 1;
    tierRowMap[tier] = [start, end];
  }
  if (!tierRowMap["\u4e00\u9636"]) return defaultTalentTierRowMap();
  return tierRowMap;
}

function clearXlsxTalentSlots(set, tierRowMap) {
  var tier, range, r;
  for (tier in tierRowMap) {
    range = tierRowMap[tier];
    for (r = range[0]; r <= range[1]; r++) set("O" + r, "", false);
  }
}

/** 模板种族/职业特性槽：I/K 与 O/Q，112–117（共 6 格）；勿写到 118「探索」行 */
var XLSX_TRAIT_SLOT_START = 112;
var XLSX_TRAIT_SLOT_COUNT = 6;

/** A=1 … Z=26, AA=27 */
function xlsxColIndex(col) {
  var n = 0, i;
  for (i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
}

/**
 * 将 cellXml 按列序插入完整 <row>…</row> 字符串。
 * @returns {string} 新的 row XML
 */
function xlsxInsertCellInRow(rowXml, colLetters, cellXml) {
  var m = /^<row([^>]*)>([\s\S]*)<\/row>$/.exec(rowXml);
  if (!m) return rowXml;
  var attrs = m[1], inner = m[2], newIdx = xlsxColIndex(colLetters);
  var cellRe = /<c r="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
  var cm, out = "", inserted = false;
  while ((cm = cellRe.exec(inner)) !== null) {
    if (!inserted && xlsxColIndex(cm[1]) > newIdx) {
      out += cellXml;
      inserted = true;
    }
    out += cm[0];
  }
  if (!inserted) out += cellXml;
  return "<row" + attrs + ">" + out + "</row>";
}

function clearXlsxSkillRows(set) {
  var r, cols = ["B", "D", "E", "F", "H", "I", "J"], ci;
  for (r = 123; r <= 162; r++) {
    for (ci = 0; ci < cols.length; ci++) set(cols[ci] + r, "", false);
  }
  for (r = 168; r <= 209; r++) {
    for (ci = 0; ci < cols.length; ci++) set(cols[ci] + r, "", false);
  }
}

function clearXlsxEquipmentSlots(set) {
  var ranges = [
    { row: 46, max: 3 },
    { row: 50, max: 2 },
    { row: 52, max: 4 },
    { row: 56, max: 4 },
    { row: 61, max: 10 },
    { row: 72, max: 5 },
    { row: 78, max: 10 }
  ];
  var ri, ii;
  for (ri = 0; ri < ranges.length; ri++) {
    for (ii = 0; ii < ranges[ri].max; ii++) set("K" + (ranges[ri].row + ii), "", false);
  }
}

function clearXlsxClassAndFeatureSlots(set) {
  set("B23", "", false); set("D23", "", false);
  set("B29", "", false); set("D29", "", false);
  set("E17", "", false); set("E18", "", false);
  var ri;
  for (ri = 0; ri < XLSX_TRAIT_SLOT_COUNT; ri++) {
    set("I" + (XLSX_TRAIT_SLOT_START + ri), "", false);
    set("K" + (XLSX_TRAIT_SLOT_START + ri), "", false);
    set("O" + (XLSX_TRAIT_SLOT_START + ri), "", false);
    set("Q" + (XLSX_TRAIT_SLOT_START + ri), "", false);
  }
  var featRows = [36, 38, 40, 42];
  for (ri = 0; ri < featRows.length; ri++) set("K" + featRows[ri], "", false);
}

function buildExportFileName(exportState) {
  // Filename uses storage id; sheet cells still use state.name (display name)
  var name = "";
  if (typeof CURRENT_CHAR === "string" && CURRENT_CHAR) name = CURRENT_CHAR;
  else if (exportState && exportState._charName) name = exportState._charName;
  else if (exportState && exportState.name) name = exportState.name;
  else name = "角色";
  name = String(name).replace(/[\\/:*?"<>|]/g, "_");
  var slot = 0;
  if (typeof CURRENT_SLOT === "number" && CURRENT_SLOT > 0) slot = CURRENT_SLOT;
  else if (exportState && exportState._exportSlot) slot = exportState._exportSlot;
  var d = new Date();
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var ts = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  return name + (slot > 0 ? ("_slot" + slot) : "") + "_" + ts + "_角色档案.xlsx";
}

function fillXlsxTalents(set, talents, tierRowMap) {
  if (!tierRowMap) tierRowMap = defaultTalentTierRowMap();
  clearXlsxTalentSlots(set, tierRowMap);
  var tierSlots = {}, tierOrder = ["\u4e00\u9636", "\u4e8c\u9636", "\u4e09\u9636", "\u56db\u9636", "\u4e94\u9636", "\u516d\u9636", "\u4e03\u9636"];
  var ti, tName, tTier, range, slot;
  for (ti = 0; ti < tierOrder.length; ti++) tierSlots[tierOrder[ti]] = 0;
  for (ti = 0; ti < talents.length; ti++) {
    tName = talents[ti].n || talents[ti].name || "";
    if (!tName) continue;
    tTier = normalizeExportTalentTier(talents[ti]);
    range = tierRowMap[tTier];
    if (!range) continue;
    slot = tierSlots[tTier] || 0;
    if (slot >= range[1] - range[0] + 1) continue;
    set("O" + (range[0] + slot), tName);
    tierSlots[tTier] = slot + 1;
  }
}

function featDisplayName(f) {
  if (f == null || f === "") return "";
  if (typeof f === "string") return f;
  return f.name || f.n || "";
}

function fillXlsxSpecialFeats(set, feats) {
  var levelRows = { 4: 36, 8: 38, 12: 40 };
  var fi, name, lv, row, used = {};
  for (fi = 0; fi < feats.length; fi++) {
    name = featDisplayName(feats[fi]);
    if (!name) continue;
    lv = feats[fi].level || 0;
    row = levelRows[lv] || 0;
    if (!row) {
      var slots = [36, 38, 40, 42];
      for (var si = 0; si < slots.length; si++) {
        if (!used[slots[si]]) { row = slots[si]; break; }
      }
    }
    if (!row || used[row]) continue;
    used[row] = true;
    set("K" + row, name);
  }
}

function exportTraitsText(state) {
  var traits = (state.traits || "").trim();
  var sport = state.sportPreference || "";
  if (!sport && state.background === "\u8fd0\u52a8\u5458" && state.weapon_specs && state.weapon_specs.length) {
    sport = state.weapon_specs[0]; // 旧档兼容
  }
  if (state.background === "\u8fd0\u52a8\u5458" && sport) {
    if (traits.indexOf(sport) < 0) {
      traits = traits ? (traits + "\uff08\u504f\u597d\uff1a" + sport + "\uff09") : ("\u8fd0\u52a8\u5458\u62e5\u6709\u4e00\u9879\u504f\u597d\u7684\u8fd0\u52a8\u9879\u76ee\uff08" + sport + "\uff09\uff0c\u5728\u8fdb\u884c\u8fd9\u9879\u8fd0\u52a8\u65f6\u5177\u5907\u4e13\u5bb6\u7ea7\u7684\u719f\u7ec3\u5ea6");
    }
  }
  return traits;
}

function exportRacialTraits(state) {
  if (state.racial_traits && state.racial_traits.length) return state.racial_traits;
  var rd = typeof REF_RACES !== "undefined" && state.race ? REF_RACES[state.race] : null;
  if (rd && rd.talents) return rd.talents.map(function (t) { return { name: t.name, desc: t.desc }; });
  return [];
}

function exportClassFeatures(state) {
  if (state.class_features && state.class_features.length) return state.class_features;
  var feats = [], ci, cn, rfc, si;
  if (!state.classes) return feats;
  for (ci = 0; ci < state.classes.length; ci++) {
    cn = state.classes[ci].name;
    if (!cn) continue;
    rfc = typeof REF_CLASSES !== "undefined" ? REF_CLASSES[cn] : null;
    if (rfc && rfc.specializations) {
      for (si = 0; si < rfc.specializations.length; si++) {
        feats.push({ name: rfc.specializations[si].name, desc: rfc.specializations[si].desc + "\uff08" + cn + "\uff09" });
      }
    }
  }
  return feats;
}

function spDot(skill) {
  var info = getSkillDotStates(skill), flat = info.flat, states = info.states, html = "", ci, hex, isGrad, bg, on;
  if (!flat.length) return "";
  for (ci = 0; ci < flat.length; ci++) {
    hex = flat[ci].colorHex || "";
    if (!hex) continue;
    isGrad = (hex.indexOf("gradient") >= 0);
    bg = isGrad ? "linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)" : hex;
    on = states[ci];
    html += "<span style='display:inline-block;width:12px;height:12px;border-radius:2px;background:" + bg + ";border:1px solid rgba(0,0,0,0.5);vertical-align:middle;opacity:" + (on ? "1" : "0.35") + "'></span>";
  }
  return html;
}



var _LIGHT_DOT_COLORS = {"#FFFFFF":1,"#FFF32F":1,"#00FA99":1,"#FFB7E3":1,"#B3F9FF":1};


function escapeHtmlText(t) {


  if (!t) return "";


  return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");


}


function runsHaveColoredDots(runs) {


  if (!runs || !runs.length) return false;


  for (var i = 0; i < runs.length; i++) {


    if (runs[i].color && runs[i].text && runs[i].text.indexOf("\u25cf") >= 0) return true;


  }


  return false;


}


function runsToHtml(runs) {


  if (!runs || !runs.length) return "";


  var html = "", ri, r, text, hex, shadow, ci, ch;


  for (ri = 0; ri < runs.length; ri++) {


    r = runs[ri]; text = r.text || "";


    if (!text) continue;


    hex = r.color || "";


    if (hex && text.indexOf("\u25cf") >= 0) {


      shadow = _LIGHT_DOT_COLORS[hex] ? "text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;" : "";


      for (ci = 0; ci < text.length; ci++) {


        ch = text.charAt(ci);


        if (ch === "\u25cf") html += "<span style='font-size:1.25em;color:" + hex + ";" + shadow + "'>\u25cf</span>";


        else html += escapeHtmlText(ch);


      }


    } else {


      html += escapeHtmlText(text);


    }


  }


  return html;


}


function markDotsHtml(cost) {


  var dots = parseSkillCost({cost: cost || []}), html = "", di, hex, shadow;


  for (di = 0; di < dots.length; di++) {


    hex = dots[di].colorHex || "";


    if (!hex) continue;


    shadow = _LIGHT_DOT_COLORS[hex] ? "text-shadow:-1px -1px 0 #333,1px -1px 0 #333,-1px 1px 0 #333,1px 1px 0 #333;" : "";


    html += "<span style='font-size:1.25em;color:" + hex + ";" + shadow + "'>\u25cf</span>";


  }


  return html;


}


function sliceRunsAfterPrefix(runs, prefixLen) {


  if (!runs || prefixLen <= 0) return runs || [];


  var out = [], pos = 0, ri, r, text, start, end, cut, rest;


  for (ri = 0; ri < runs.length; ri++) {


    r = runs[ri]; text = r.text || ""; start = pos; end = pos + text.length; pos = end;


    if (end <= prefixLen) continue;


    if (start >= prefixLen) { out.push(r); continue; }


    cut = prefixLen - start; rest = text.substring(cut);


    if (rest) out.push({text: rest, color: r.color});


  }


  return out;


}


function formatSkillDetailHtml(skillData) {


  if (!skillData) return "";


  var fields = skillData.fields || {}, fieldRuns = skillData.field_runs || {}, html = "", fk, fi;


  var fieldOrder = ["\u65bd\u5c55\u65f6\u95f4","\u65bd\u5c55\u8ddd\u79bb","\u6301\u7eed\u65f6\u95f4","\u75b2\u52b3\u6d88\u8017","\u524d\u7f6e\u6761\u4ef6","\u989d\u5916\u6761\u4ef6","\u65bd\u5c55\u6761\u4ef6","\u65bd\u5c55\u9650\u5236","\u5173\u952e\u8bcd"];


  for (fi = 0; fi < fieldOrder.length; fi++) {


    fk = fieldOrder[fi];


    if (!fields[fk]) continue;


    if (fieldRuns[fk] && runsHaveColoredDots(fieldRuns[fk])) html += "<p><span style='color:#b0a090;font-weight:bold'>" + fk + "\uff1a</span>" + runsToHtml(fieldRuns[fk]) + "</p>";


    else html += "<p><span style='color:#b0a090;font-weight:bold'>" + fk + "\uff1a</span>" + escapeHtmlText(fields[fk]) + "</p>";


  }


  if (skillData.cost && skillData.cost.length) {


    html += "<p><span style='color:#b0a090;font-weight:bold'>\u6807\u8bc6\uff1a</span>" + markDotsHtml(skillData.cost) + "</p>";


  }


  var descText = fields["\u63cf\u8ff0"] || "", descRuns = fieldRuns["\u63cf\u8ff0"], hasDescField = false;


  if (descText) {


    hasDescField = true;


    if (descRuns && runsHaveColoredDots(descRuns)) html += "<p><span style='color:#b0a090;font-weight:bold'>\u63cf\u8ff0\uff1a</span>" + runsToHtml(descRuns) + "</p>";


    else html += "<p><span style='color:#b0a090;font-weight:bold'>\u63cf\u8ff0\uff1a</span>" + escapeHtmlText(descText) + "</p>";


  }


  var entryRuns = {}, descEntries = skillData.description_entries || [], di, para, runs, body;


  for (di = 0; di < descEntries.length; di++) entryRuns[descEntries[di].text] = descEntries[di].runs;


  var descParas = skillData.description || [];


  for (di = 0; di < descParas.length; di++) {


    para = descParas[di];


    if (!para || (hasDescField && para === descText)) continue;


    runs = entryRuns[para];


    body = (runs && runsHaveColoredDots(runs)) ? runsToHtml(runs) : escapeHtmlText(para);


    html += "<p>" + body + "</p>";


  }


  var upgrades = skillData.level_upgrades || [], ui, lu, label, lineRuns;


  for (ui = 0; ui < upgrades.length; ui++) {


    lu = upgrades[ui];


    label = lu.label || ("\u4f60\u7684" + (lu.class || "") + "\u7b49\u7ea7\u5230\u8fbe" + lu.level + "\u7ea7\u65f6\uff1a");


    lineRuns = lu.line_runs || [];


    if (lineRuns.length && runsHaveColoredDots(lineRuns)) {


      html += "<p><span style='color:#b0a090;font-weight:bold'>" + escapeHtmlText(label) + "</span>" + runsToHtml(sliceRunsAfterPrefix(lineRuns, label.length)) + "</p>";


    } else if (lu.text) {


      html += "<p><span style='color:#b0a090;font-weight:bold'>" + escapeHtmlText(label) + "</span>" + escapeHtmlText(lu.text) + "</p>";


    }


  }


  if (!html && skillData.flavor) html = "<p>" + escapeHtmlText(skillData.flavor) + "</p>";


  return html || "<p style='color:#888'>\u6682\u65e0\u63cf\u8ff0</p>";


}







function spCostCell(s) {


  var colorName = getSkillSPCost(s.n, s.src);


  if (!colorName) return "\u2014";


  var spColors = {"\u6a59\u8272":"#EE822F","\u767d\u8272":"#FFFFFF","\u7d2b\u8272":"#B94BFF","\u9ec4\u8272":"#FFF32F","\u65e0\u8272":"#D9D9D9","\u84dd\u8272":"#00B0F0","\u9752\u8272":"#00FA99","\u9ed1\u8272":"#595959","\u7ea2\u8272":"#FF0000","\u68d5\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u7eff\u8272":"#00B050","\u6d45\u8272":"#B3F9FF","\u70ab\u5f69":"linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)"};


  var hex = spColors[colorName] || "#888";


  var isGrad = hex.indexOf("gradient") >= 0;


  return "<span style=\'display:inline-block;width:14px;height:14px;border-radius:3px;background:" + hex + ";border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:4px\'></span><span style=\'font-size:11px;color:#b09070\'>" + colorName + "</span>";


}





// === Item Tags/Weight/Hands Cache (auto-generated) ===
(function() {
window._itemTagsCache = JSON.parse('{"羊皮纸（10张）":["杂物"],"长矛":["武器"],"主食":["杂物"],"皮甲":["防具"],"黑椒牛排":["食品","消耗品","正餐","食品酒水"],"炼金工具":["套装","工具"],"旅行腰包":["容器"],"魅惑合剂":["消耗品","药剂"],"力场防护合剂":["消耗品","药剂"],"亚历山大钻石":["材料","矿石","宝石"],"固化力场碎片":["材料","魔法材料","其他材料"],"大提琴":["乐器"],"扑克":["杂物"],"鞍座":[null,"生物"],"食人魔力量药水":["消耗品","药剂"],"厨师工具":["套装","工具"],"空白的魔法卷轴":["卷轴","铭文","材料"],"圆顶帽":["服饰","护甲","防具"],"燃火头冠":["配饰"],"黑口鱼油":["材料","生物材料","其他材料"],"樱桃酒":["食品","消耗品","酒水","食品酒水"],"银叶草":["材料","草药"],"爽身粉":["杂物"],"学徒法杖":["武器"],"炸洋葱圈":["食品","消耗品","正餐","食品酒水"],"魔术道具":["杂物"],"盐":["食品","消耗品","佐料","按重量","食品酒水"],"狩猎陷阱":["杂物"],"指南针":["杂物"],"萃变体汁液":["材料","魔法材料","其他材料"],"墓地苔":["材料","草药"],"玻璃瓶":["杂物"],"羊绒毯":["杂物"],"香水薄荷":["材料","草药"],"加速吊坠":["配饰"],"薄荷汁":["食品","消耗品","酒水","食品酒水"],"星光玫瑰":["材料","草药"],"奥术恒金":["材料","矿石","矿产"],"卷心菜":["食品","消耗品","食材","可堆叠","食品酒水"],"真银锭":["材料","矿石","矿产"],"明焰石":["材料","矿石","宝石"],"斗篷":["服饰","护甲","防具"],"水果茶":["食品","消耗品","酒水","食品酒水"],"祷告经书":["杂物"],"骰子":["杂物"],"倾慕者的信物":["杂物"],"猪排汉堡":["食品","消耗品","正餐","食品酒水"],"铭文材料包":["容器"],"青金石":["材料","矿石","宝石"],"报刊":["杂物"],"热苹果酒":["食品","消耗品","酒水","食品酒水"],"强效生命药水":["消耗品","药剂"],"旅行者的吊坠":["配饰"],"刺剑":["武器"],"二轮货车":[null,"载具"],"霜冻粒子":["材料","元素材料","其他材料"],"奥术蓝钢":["材料","矿石","矿产"],"龙井茶":["材料","草药"],"黑白合之吻":["消耗品","药剂"],"极效生命药水":["消耗品","药剂"],"蛋白石":["材料","矿石","宝石"],"羽毛笔":["杂物"],"短杖":["武器"],"史莱姆粘合剂":["材料","生物材料","其他材料"],"翡翠线轴":["材料","工艺材料","其他材料"],"蛇藤花":["材料","草药"],"法力浮龙的灵核":["材料","魔法材料","其他材料"],"蛇鳞":["材料","生物材料","其他材料"],"绷带":["医用","杂物","可堆叠"],"战斧":["武器"],"酒壶":["杂物"],"苦橙":["材料","草药"],"小型飞艇":[null,"载具"],"瑟银锭":["材料","矿石","矿产"],"月光骑士":["食品","消耗品","酒水","食品酒水"],"雪狐花":["材料","草药"],"假发":["服饰","护甲","防具"],"娱乐杂志":["杂物"],"娱乐杂志和周刊":["杂物"],"翠绿头环":["配饰"],"圣徽":["杂物"],"猫眼药水":["消耗品","药剂"],"马裤":["服饰","护甲","防具"],"火柴盒":["杂物"],"雷电抗性药水":["消耗品","药剂"],"微光粒子":["材料","元素材料","其他材料"],"炸鱼":["食品","消耗品","正餐","水产","食品酒水"],"次级活力药水":["消耗品","药剂"],"黑曜石":["材料","矿石","矿产"],"雪梨酒":["食品","消耗品","酒水","食品酒水"],"胸甲":["防具"],"香草":["食品","消耗品","佐料","按重量","食品酒水"],"四轮货车":[null,"载具"],"蒸汽卡车":[null,"载具"],"猫眼石念珠":["杂物"],"玉米":["食品","消耗品","食材","可堆叠","食品酒水"],"写作工具":["套装","工具"],"铜锭":["材料","矿石","矿产"],"牛肉汉堡":["食品","消耗品","正餐","食品酒水"],"魔皇草":["材料","草药"],"沙漏":["杂物"],"盲鱼肠":["材料","生物材料","其他材料"],"音爆防护合剂":["消耗品","药剂"],"队伍旗帜":["杂物"],"跃迁兽的皮革":["材料","生物材料","其他材料"],"史莱姆黏液":["材料","魔法材料","其他材料"],"电气粒子":["材料","元素材料","其他材料"],"小食拼盘":["食品","消耗品","正餐","食品酒水"],"苏打水":["容器","杯"],"孔雀石念珠":["杂物"],"垂钓材料包":["容器"],"蓝宝石":["材料","矿石","宝石"],"甜点":["杂物"],"哨笛":["杂物"],"启迪药水":["消耗品","药剂"],"龙血葵":["材料","草药"],"撬棍":["杂物"],"正餐":["杂物"],"强酸防护合剂":["消耗品","药剂"],"冬酒：漫漫长夜":["食品","消耗品","酒水","食品酒水"],"任意法术学派的基础书籍":["杂物"],"双人帐篷":["杂物"],"薰衣紫金粉":["材料","工艺材料","其他材料"],"水下呼吸药水":["消耗品","药剂"],"白萝卜":["食品","消耗品","食材","可堆叠","食品酒水"],"衬衣":["服饰","护甲","防具"],"抓钩":["杂物"],"蜂蜜酒":["食品","消耗品","酒水","食品酒水"],"半身板甲":["防具"],"弱化巨魔之血药水":["消耗品","药剂"],"白手套":["服饰"],"月光石":["材料","矿石","宝石"],"浑浊的虚空水晶":["材料","元素材料","其他材料"],"刮鱼刀":["杂物"],"巨魔之血药水":["消耗品","药剂"],"玻璃试管":["杂物"],"露塔莉娅水果酒":["食品","消耗品","酒水","食品酒水"],"天界钢":["材料","矿石","矿产"],"魔精":["消耗品","药剂"],"开锁工具":["套装","工具"],"黑葡萄酒":["食品","消耗品","酒水","食品酒水"],"凤凰烬羽":["材料","生物材料","其他材料"],"强力胶":["杂物"],"琥珀星光药水":["消耗品","药剂"],"铁盾合剂":["消耗品","药剂"],"巨化药剂":["消耗品","药剂"],"手风琴":["乐器"],"香辛料":["食品","消耗品","佐料","按重量","食品酒水"],"磨刀石":["杂物"],"笔记本":["杂物"],"打火石":["杂物"],"板甲":["防具"],"水晶兰":["材料","草药"],"锁":["杂物"],"闪电灵核":["材料","元素材料","其他材料"],"贝斯":["乐器"],"龙棋":["杂物"],"热气球":[null,"载具"],"口风琴":["乐器"],"橡果酒":["食品","消耗品","酒水","食品酒水"],"黄金鱼油":["材料","生物材料","其他材料"],"血石榴":["材料","矿石","宝石"],"噩梦藤":["材料","草药"],"商船":[null,"载具"],"无檐帽":["服饰","护甲","防具"],"典礼戒指":["配饰"],"乘用马":[null,"生物"],"衬裙":["服饰","护甲","防具"],"木材":["杂物"],"活力药水":["消耗品","药剂"],"面粉":["食品","消耗品","淀粉","按重量","食品酒水"],"探索工具":["套装","工具"],"其他水产":["杂物"],"竖琴":["乐器"],"闪电头巾":["配饰"],"黄金参":["材料","草药"],"七彩龙蜥的薄膜":["材料","生物材料","其他材料"],"银锭":["材料","矿石","矿产"],"灰女巫":["材料","草药"],"冰霜抗性药水":["消耗品","药剂"],"心灵防护合剂":["消耗品","药剂"],"吉他":["乐器"],"辣椒":["食品","消耗品","食材","可堆叠","食品酒水"],"钢铁合剂":["消耗品","药剂"],"水上行走药水":["消耗品","药剂"],"豹眼石":["材料","矿石","宝石"],"皇血草":["材料","草药"],"单人帐篷":["杂物"],"手铲":["杂物"],"旅行者炖菜":["食品","消耗品","正餐","食品酒水"],"曼陀罗":["材料","草药"],"剑油":["材料","工艺材料","其他材料"],"灯油":["杂物"],"精钢盾牌":["武器"],"荆棘藻":["材料","草药"],"矮人烈酒":["食品","消耗品","酒水","食品酒水"],"信号弹":[],"长弓":["武器"],"凤凰沉木":["材料","草药"],"医疗包":["医用","杂物","可堆叠"],"梦境蜘蛛的原始丝囊":["材料","生物材料","其他材料"],"生命药水":["消耗品","药剂"],"短斧":["武器"],"铃铛":["杂物"],"炭笔":["杂物"],"裁缝工具":["套装","工具"],"多香果":["材料","草药"],"背包":["容器"],"庆典粒子":["材料","魔法材料","其他材料"],"麻绳":["杂物"],"金棘草":["材料","草药"],"止血剂":["医用","杂物","可堆叠"],"硬肉干":["食品","消耗品","正餐","食品酒水"],"蟹肉":["食品","消耗品","食材","可堆叠","水产","食品酒水"],"雕艺工具":["套装","工具"],"龙息药水":["消耗品","药剂"],"水袋":["杂物"],"龙血葵酒":["食品","消耗品","酒水","食品酒水"],"轻锤":["武器"],"习武木棍":["武器"],"墨水":["杂物"],"浓缩咖啡":["食品","消耗品","酒水","食品酒水"],"感应合剂":["消耗品","药剂"],"红宝石":["材料","矿石","宝石"],"木杖":["武器"],"矿工镐":["杂物"],"水果":["杂物"],"驮用马":[null,"生物"],"猫眼石":["材料","矿石","宝石"],"魔法箭矢手镯":["配饰"],"长裙":["服饰","护甲","防具"],"龙眼果":["材料","草药"],"酒精":["医用","杂物","可堆叠"],"精金锭":["材料","矿石","矿产"],"星耀石":["材料","矿石","宝石"],"烹饪材料包":["容器"],"夜鸦药水":["消耗品","药剂"],"医用材料包":["容器"],"钢琴":["乐器"],"金属盾牌":["武器"],"蓝艳菇":["材料","草药"],"清泉水":["容器","杯"],"奶油":["食品","消耗品","佐料","按重量","食品酒水"],"抗毒剂":["医用","杂物","可堆叠"],"音爆抗性药水":["消耗品","药剂"],"体魄药水":["消耗品","药剂"],"袖剑":["武器"],"熏肉排":["食品","消耗品","正餐","食品酒水"],"柠檬":["食品","消耗品","食材","可堆叠","食品酒水"],"号角":["乐器"],"胡萝卜":["食品","消耗品","食材","可堆叠","食品酒水"],"纯银祭器":["杂物"],"矿石材料包":["容器"],"金锭":["材料","矿石","矿产"],"南岛冰茶":["食品","消耗品","酒水","食品酒水"],"灵界钢":["材料","矿石","矿产"],"威士忌":["食品","消耗品","酒水","食品酒水"],"火焰花":["材料","草药"],"虾肉":["食品","消耗品","食材","可堆叠","水产","食品酒水"],"翡翠玉":["材料","矿石","宝石"],"鳞甲":["防具"],"大师级法杖":["武器"],"剧毒抗性药水":["消耗品","药剂"],"冰心头饰":["配饰"],"丹参":["材料","草药"],"蘑菇烩泥鱼":["食品","消耗品","正餐","水产","食品酒水"],"坚韧合剂":["消耗品","药剂"],"夹克外套":["服饰","护甲","防具"],"管风琴":["乐器"],"狮鹫":[null,"生物"],"放大镜":["杂物"],"雨燕药水":["消耗品","药剂"],"肥皂":["杂物"],"腰带":["服饰","护甲","防具"],"力量合剂":["消耗品","药剂"],"光耀防护合剂":["消耗品","药剂"],"星界银":["材料","矿石","矿产"],"驴":[null,"生物"],"魔纹布料":["材料","魔法材料","其他材料"],"坚忍药水":["消耗品","药剂"],"简易野炊工具":["杂物"],"冰霜防护合剂":["消耗品","药剂"],"马车":[null,"载具"],"炼金材料包":["容器"],"烤羊排":["食品","消耗品","正餐","食品酒水"],"伪造玺戒":["杂物"],"收纳盒":["容器"],"长剑":["武器"],"石南草":["材料","草药"],"紧身裤":["服饰","护甲","防具"],"铲子":["杂物"],"炼狱铁":["材料","矿石","矿产"],"金牌烤火鸡":["食品","消耗品","正餐","食品酒水"],"演出戏服":["服饰","护甲","防具","杂物"],"白葡萄酒":["食品","消耗品","酒水","食品酒水"],"轻弩":["武器"],"幽影尘":["材料","魔法材料","其他材料"],"熏香":["杂物"],"短棒":["武器"],"标枪":["武器"],"共鸣水晶":["材料","魔法材料","其他材料"],"极效活力药水":["消耗品","药剂"],"紫水晶":["材料","矿石","宝石"],"香水":["杂物"],"幽灵菇":["材料","草药"],"三叉戟":["武器"],"大地灵核":["材料","元素材料","其他材料"],"玺戒":["杂物"],"红肉":["杂物"],"易容工具":["套装","工具"],"清蒸肥蟹":["食品","消耗品","正餐","水产","食品酒水"],"失心蛇胆":["材料","草药"],"眼镜":["服饰","护甲","防具"],"玛瑙石":["材料","矿石","宝石"],"镣铐":["杂物"],"红战士":["材料","草药"],"链甲":["防具"],"冰霜灵核":["材料","元素材料","其他材料"],"雕刻刀":["杂物"],"洋葱":["食品","消耗品","食材","可堆叠","食品酒水"],"加速药水":["消耗品","药剂"],"蘑菇":["食品","消耗品","食材","可堆叠","食品酒水"],"奇械摩托":[null,"载具"],"皮匠工具":["套装","工具"],"麻绳（10米）":["杂物"],"划艇":[null,"载具"],"黄瓜":["食品","消耗品","食材","可堆叠","食品酒水"],"纯洁的珍珠粉":["材料","工艺材料","其他材料"],"虎眼石":["材料","矿石","宝石"],"裙撑":["服饰","护甲","防具"],"丝绸布料":["杂物"],"地根草":["材料","草药"],"烟斗":["杂物"],"野钢花":["材料","草药"],"卷轴匣":["杂物"],"亮银线轴":["材料","工艺材料","其他材料"],"绿宝石":["材料","矿石","宝石"],"礼帽":["服饰","护甲","防具"],"重弩":["武器"],"苦橙鸡尾酒":["食品","消耗品","酒水","食品酒水"],"白灼秋葵浓汤":["食品","消耗品","正餐","食品酒水"],"燕尾服":["服饰","护甲","防具"],"兽皮甲":["防具"],"火焰防护合剂":["消耗品","药剂"],"便签条":["杂物"],"烟熏香肠":["食品","消耗品","正餐","食品酒水"],"火焰爵士的愤怒":["食品","消耗品","酒水","食品酒水"],"冰镇牛奶":["食品","消耗品","酒水","食品酒水"],"辣椒酱":["食品","消耗品","佐料","按重量","食品酒水"],"折扇":["服饰"],"攀爬工具":["套装","工具"],"精钢锭":["材料","矿石","矿产"],"红葡萄酒":["食品","消耗品","酒水","食品酒水"],"乐鼓":["乐器"],"檞寄生":["材料","草药"],"宁神花":["材料","草药"],"爬梯":["杂物"],"裁缝材料包":["容器"],"歌唱葵":["材料","草药"],"大型飞艇":[null,"载具"],"剧毒防护合剂":["消耗品","药剂"],"闪光尘":["材料","元素材料","其他材料"],"灵网蛛丝":["材料","生物材料","其他材料"],"火棘果":["材料","草药"],"听诊器":["杂物"],"番茄":["食品","消耗品","食材","可堆叠","食品酒水"],"土豆葱花汤":["食品","消耗品","正餐","食品酒水"],"獒犬":[null,"生物"],"蜡烛":["杂物"],"柠檬绿茶":["食品","消耗品","酒水","食品酒水"],"油":["食品","消耗品","佐料","按重量","食品酒水"],"高跟鞋":["服饰","护甲","防具"],"清凉膏":["杂物"],"孔雀石":["材料","矿石","宝石"],"画家工具":["套装","工具"],"蓝甲虫精髓":["材料","生物材料","其他材料"],"弯刀":["武器"],"珠宝材料包":["容器"],"长棍":["武器"],"暗影抗性药水":["消耗品","药剂"],"渔具":["杂物"],"调味包":["食品","消耗品","佐料","按重量","食品酒水"],"南瓜":["食品","消耗品","食材","可堆叠","食品酒水"],"源质钢":["材料","矿石","矿产"],"筷子":["杂物"],"火焰之油":["材料","元素材料","其他材料"],"柠檬汽水":["食品","消耗品","酒水","食品酒水"],"暗影防护合剂":["消耗品","药剂"],"雨燕草":["材料","草药"],"亚麻布毯":["杂物"],"银制箭矢/弹药（20发）":[],"墨镜":["服饰","护甲","防具"],"步枪":["武器"],"鱼类":["杂物"],"蜂蜜烧烤肋排":["食品","消耗品","正餐","食品酒水"],"强壮药水":["消耗品","药剂"],"投石索":["武器"],"热情药水":["消耗品","药剂"],"匕首":["武器"],"椒盐鸡腿":["食品","消耗品","正餐","食品酒水"],"木箱":["容器"],"禽类":["杂物"],"臻冰":["材料","元素材料","其他材料"],"镰刀":["武器"],"魔法灵光眼镜":["配饰"],"手杖":["武器"],"番茄浓汤":["食品","消耗品","正餐","食品酒水"],"啤酒烤猪排":["食品","消耗品","正餐","食品酒水"],"领结":["服饰","护甲","防具"],"拳刃":["武器"],"迷药":["杂物"],"甘姜":["材料","草药"],"果酱":["食品","消耗品","佐料","按重量","食品酒水"],"蛇信草":["材料","草药"],"月蔷薇":["材料","草药"],"冬用毯子":["杂物"],"时之沙":["材料","工艺材料","其他材料"],"魔法防护吊坠":["配饰"],"吹箭筒":["武器"],"强酸抗性药水":["消耗品","药剂"],"暗玉":["材料","矿石","宝石"],"短披肩":["服饰","护甲","防具"],"烟熏鲑鱼":["食品","消耗品","正餐","水产","食品酒水"],"冬刺草":["材料","草药"],"扳手":["杂物"],"袖扣":["服饰"],"海鲜浓汤":["食品","消耗品","正餐","水产","食品酒水"],"大师级魔棒":["武器"],"智慧合剂":["消耗品","药剂"],"蜂蜜":["食品","消耗品","佐料","按重量","食品酒水"],"硫磺石":["材料","矿石","矿产"],"跌打草":["材料","草药"],"初级护甲药水":["消耗品","药剂"],"捕网":["武器"],"蚌肉":["食品","消耗品","食材","可堆叠","水产","食品酒水"],"萨克斯":["乐器"],"谷物种子":["杂物"],"望远镜":["杂物"],"魔法尘":["材料","魔法材料","其他材料"],"重锤":["武器"],"生火工具":["套装","工具"],"学徒魔棒":["武器"],"草药工具":["套装","工具"],"培根海鲜炒饭":["食品","消耗品","正餐","水产","食品酒水"],"毛线团":["杂物"],"亚麻布料":["杂物"],"佐料":["杂物"],"洗漱用品":["杂物"],"草药袋":["容器"],"化妆品":["杂物"],"蝇龙的脑垂体":["材料","生物材料","其他材料"],"未经雕刻的图腾":["杂物"],"怒气药水":["消耗品","药剂"],"光耀抗性药水":["消耗品","药剂"],"果篮":["容器"],"琉璃晶铁砂":["材料","工艺材料","其他材料"],"空气魔力":["材料","元素材料","其他材料"],"国王游戏":["杂物"],"野猪火腿":["食品","消耗品","正餐","食品酒水"],"草药烘蛋":["食品","消耗品","正餐","食品酒水"],"布衣":["防具"],"制图工具":["套装","工具"],"金戈铁骨":["材料","草药"],"奶油蘑菇浓汤":["食品","消耗品","正餐","食品酒水"],"秋辉石":["材料","矿石","宝石"],"烟草":["杂物"],"血蓟草":["材料","草药"],"白屈花":["材料","草药"],"隐身药水":["消耗品","药剂"],"蔬菜":["杂物"],"领巾":["服饰","护甲","防具"],"纯铁":["材料","矿石","矿产"],"梦露花":["材料","草药"],"音乐盒":["杂物"],"次级生命药水":["消耗品","药剂"],"施法者头饰":["配饰"],"制毒工具":["套装","工具"],"黄油啤酒":["食品","消耗品","酒水","食品酒水"],"自然防护合剂":["消耗品","药剂"],"单边眼镜":["服饰","护甲","防具"],"自然抗性药水":["消耗品","药剂"],"谎言大师的根茎":["材料","生物材料","其他材料"],"大蒜":["食品","消耗品","佐料","按重量","食品酒水"],"小提琴":["乐器"],"火焰灵核":["材料","元素材料","其他材料"],"火枪":["武器"],"粉笔":["杂物"],"魔法箭矢戒指":["配饰"],"水蛭素":["材料","生物材料","其他材料"],"青铜合剂":["消耗品","药剂"],"渔船":[null,"载具"],"蚌肉杂烩":["食品","消耗品","正餐","水产","食品酒水"],"长礼服":["服饰","护甲","防具"],"黄油":["食品","消耗品","佐料","按重量","食品酒水"],"太阳花":["材料","草药"],"铁匠工具":["套装","工具"],"雷电防护合剂":["消耗品","药剂"],"火把":["杂物"],"火焰抗性药水":["消耗品","药剂"],"观察者眼魔的核心":["材料","生物材料","其他材料"],"黯淡的命运纺锤":["材料","工艺材料","其他材料"],"山铜锭":["材料","矿石","矿产"],"草药材料包":["容器"],"奥法之尘":["材料","魔法材料","其他材料"],"闪光起泡酒":["食品","消耗品","酒水","食品酒水"],"土豆":["食品","消耗品","食材","可堆叠","食品酒水"],"意志合剂":["消耗品","药剂"],"淀粉":["杂物"],"酿酒工具":["套装","工具"],"剥皮小刀":["杂物"],"丹菊":["材料","草药"],"炽心椒":["材料","草药"],"黄油大虾":["食品","消耗品","正餐","水产","食品酒水"],"棱光碎片":["材料","元素材料","其他材料"],"影钻":["材料","矿石","宝石"],"星界钢":["材料","矿石","矿产"],"电磁铁":["材料","工艺材料","其他材料"],"强效活力药水":["消耗品","药剂"],"奇械摄影机":["杂物"],"风暴灵核":["材料","元素材料","其他材料"],"通晓语言药水":["消耗品","药剂"],"海盐":["食品","消耗品","佐料","按重量","食品酒水"],"秘银锭":["材料","矿石","矿产"],"虎骨片":["材料","草药"],"珠宝工具":["套装","工具"],"宽檐帽":["服饰","护甲","防具"],"木杯":["杂物"],"打火机":["杂物"],"心灵抗性药水":["消耗品","药剂"],"玻璃珠":["杂物"],"迅捷合剂":["消耗品","药剂"],"蛇毒":["材料","生物材料","其他材料"],"缩小药剂":["消耗品","药剂"],"润滑油":["杂物"],"鹰角豆":["食品","消耗品","食材","可堆叠","食品酒水"],"弹药（20发）":[],"煤油灯":["杂物"]}');
window._itemWeightCache = JSON.parse('{"羊皮纸（10张）":1,"长矛":5,"主食":2,"皮甲":12,"黑椒牛排":1,"炼金工具":15,"旅行腰包":1,"魅惑合剂":1,"力场防护合剂":1,"亚历山大钻石":0.5,"固化力场碎片":0.2,"大提琴":10,"扑克":0.2,"鞍座":1,"食人魔力量药水":1,"厨师工具":15,"空白的魔法卷轴":0.2,"圆顶帽":1,"燃火头冠":1,"黑口鱼油":0.2,"樱桃酒":1,"银叶草":0.2,"爽身粉":0.2,"学徒法杖":5,"炸洋葱圈":0.5,"魔术道具":2,"盐":1,"狩猎陷阱":25,"指南针":0.5,"萃变体汁液":1,"墓地苔":0.2,"玻璃瓶":0.2,"羊绒毯":5,"香水薄荷":0.2,"加速吊坠":0.5,"薄荷汁":1,"星光玫瑰":0.2,"奥术恒金":10,"卷心菜":1,"真银锭":10,"明焰石":0.2,"斗篷":1,"水果茶":1,"祷告经书":1,"骰子":0.1,"倾慕者的信物":0.1,"猪排汉堡":0.5,"铭文材料包":1,"青金石":0.2,"报刊":0.2,"热苹果酒":1,"强效生命药水":1,"旅行者的吊坠":0.5,"刺剑":5,"二轮货车":1,"霜冻粒子":0.2,"奥术蓝钢":10,"龙井茶":1,"黑白合之吻":1,"极效生命药水":1,"蛋白石":0.2,"羽毛笔":0.1,"短杖":5,"史莱姆粘合剂":1,"翡翠线轴":1,"蛇藤花":0.2,"法力浮龙的灵核":1,"蛇鳞":0.1,"绷带":1,"战斧":7.5,"酒壶":1,"苦橙":0.2,"小型飞艇":1,"瑟银锭":10,"月光骑士":20,"雪狐花":0.2,"假发":1,"娱乐杂志和周刊":0.2,"翠绿头环":1,"圣徽":0.2,"猫眼药水":1,"马裤":1,"火柴盒":0.1,"雷电抗性药水":1,"微光粒子":0.2,"炸鱼":0.2,"次级活力药水":1,"黑曜石":10,"雪梨酒":1,"胸甲":25,"香草":1,"四轮货车":1,"蒸汽卡车":1,"猫眼石念珠":0.2,"玉米":1,"写作工具":5,"铜锭":10,"牛肉汉堡":0.5,"魔皇草":0.2,"沙漏":1,"盲鱼肠":1,"音爆防护合剂":1,"队伍旗帜":2,"跃迁兽的皮革":5,"史莱姆黏液":1,"电气粒子":0.2,"小食拼盘":1,"苏打水":1,"孔雀石念珠":0.2,"垂钓材料包":1,"蓝宝石":0.2,"甜点":5,"哨笛":0.2,"启迪药水":1,"龙血葵":0.2,"撬棍":5,"正餐":2,"强酸防护合剂":1,"冬酒：漫漫长夜":1,"任意法术学派的基础书籍":1,"双人帐篷":15,"薰衣紫金粉":0.2,"水下呼吸药水":1,"白萝卜":1,"衬衣":2,"抓钩":2.5,"蜂蜜酒":1,"半身板甲":45,"弱化巨魔之血药水":1,"白手套":0.1,"月光石":0.2,"浑浊的虚空水晶":1,"刮鱼刀":1,"巨魔之血药水":1,"玻璃试管":0.2,"露塔莉娅水果酒":1,"天界钢":10,"魔精":1,"开锁工具":5,"黑葡萄酒":30,"凤凰烬羽":0.1,"强力胶":0.2,"琥珀星光药水":1,"铁盾合剂":1,"巨化药剂":1,"手风琴":5,"香辛料":1,"磨刀石":0.5,"笔记本":0.2,"打火石":0.5,"板甲":80,"水晶兰":1,"锁":2,"闪电灵核":0.2,"贝斯":10,"龙棋":2,"热气球":1,"口风琴":1,"橡果酒":1,"黄金鱼油":0.2,"血石榴":0.2,"噩梦藤":0.5,"商船":1,"无檐帽":1,"典礼戒指":0.2,"乘用马":1,"衬裙":1,"木材":20,"活力药水":1,"面粉":1,"探索工具":5,"其他水产":1,"竖琴":5,"闪电头巾":1,"黄金参":0.5,"七彩龙蜥的薄膜":1,"银锭":10,"灰女巫":0.2,"冰霜抗性药水":1,"心灵防护合剂":1,"吉他":5,"辣椒":1,"钢铁合剂":1,"水上行走药水":1,"豹眼石":0.1,"皇血草":0.2,"单人帐篷":10,"手铲":2,"旅行者炖菜":1,"曼陀罗":0.2,"剑油":0.5,"灯油":1,"精钢盾牌":15,"荆棘藻":0.2,"矮人烈酒":1,"信号弹":1,"长弓":5,"凤凰沉木":1,"医疗包":2.5,"梦境蜘蛛的原始丝囊":1,"生命药水":1,"短斧":5,"铃铛":0.5,"炭笔":0.1,"裁缝工具":5,"多香果":0.2,"背包":1,"庆典粒子":0.2,"麻绳":5,"金棘草":0.2,"止血剂":1,"硬肉干":0.5,"蟹肉":1,"雕艺工具":5,"龙息药水":1,"水袋":2,"龙血葵酒":1,"轻锤":5,"习武木棍":5,"墨水":1,"浓缩咖啡":1,"感应合剂":1,"红宝石":0.2,"木杖":2,"矿工镐":5,"水果":2,"驮用马":1,"猫眼石":0.1,"魔法箭矢手镯":1,"长裙":2,"龙眼果":1,"酒精":1,"精金锭":10,"星耀石":0.2,"烹饪材料包":1,"夜鸦药水":1,"医用材料包":1,"钢琴":300,"金属盾牌":10,"蓝艳菇":0.2,"清泉水":1,"奶油":1,"抗毒剂":1,"音爆抗性药水":1,"体魄药水":1,"袖剑":1,"熏肉排":2,"柠檬":0.1,"号角":5,"胡萝卜":1,"纯银祭器":2,"矿石材料包":1,"金锭":10,"南岛冰茶":1,"灵界钢":10,"威士忌":10,"火焰花":0.2,"虾肉":1,"翡翠玉":0.2,"鳞甲":50,"大师级法杖":5,"剧毒抗性药水":1,"冰心头饰":1,"丹参":1,"蘑菇烩泥鱼":0.5,"坚韧合剂":1,"夹克外套":2.5,"管风琴":500,"狮鹫":1,"放大镜":0.5,"雨燕药水":1,"肥皂":0.2,"腰带":0.5,"力量合剂":1,"光耀防护合剂":1,"星界银":10,"驴":1,"魔纹布料":2,"坚忍药水":1,"简易野炊工具":5,"冰霜防护合剂":1,"马车":1,"炼金材料包":1,"烤羊排":2,"伪造玺戒":0.2,"收纳盒":1,"长剑":7.5,"石南草":0.2,"紧身裤":1,"铲子":5,"炼狱铁":10,"金牌烤火鸡":5,"演出戏服":3,"白葡萄酒":30,"轻弩":5,"幽影尘":0.2,"熏香":0.2,"短棒":2,"标枪":2,"共鸣水晶":1,"极效活力药水":1,"紫水晶":0.2,"香水":0.5,"幽灵菇":0.2,"三叉戟":5,"大地灵核":10,"玺戒":0.2,"红肉":2,"易容工具":5,"清蒸肥蟹":0.2,"失心蛇胆":0.2,"眼镜":0.5,"玛瑙石":0.2,"镣铐":5,"红战士":0.2,"链甲":60,"冰霜灵核":0.2,"雕刻刀":0.2,"洋葱":1,"加速药水":1,"蘑菇":1,"奇械摩托":1,"皮匠工具":5,"麻绳（10米）":25,"划艇":1,"黄瓜":1,"纯洁的珍珠粉":0.2,"虎眼石":0.2,"裙撑":2,"丝绸布料":1,"地根草":0.2,"烟斗":0.5,"野钢花":0.2,"卷轴匣":2,"亮银线轴":1,"绿宝石":0.2,"礼帽":1,"重弩":10,"苦橙鸡尾酒":1,"白灼秋葵浓汤":0.5,"燕尾服":5,"兽皮甲":12,"火焰防护合剂":1,"便签条":0.1,"烟熏香肠":0.2,"火焰爵士的愤怒":1,"冰镇牛奶":1,"辣椒酱":1,"折扇":0.5,"攀爬工具":5,"精钢锭":10,"红葡萄酒":30,"乐鼓":5,"檞寄生":0.2,"宁神花":0.2,"爬梯":25,"裁缝材料包":1,"歌唱葵":0.2,"大型飞艇":1,"剧毒防护合剂":1,"闪光尘":0.2,"灵网蛛丝":1,"火棘果":1,"听诊器":1,"番茄":1,"土豆葱花汤":0.5,"獒犬":1,"蜡烛":0.2,"柠檬绿茶":1,"油":1,"高跟鞋":1,"清凉膏":0.2,"孔雀石":0.2,"画家工具":15,"蓝甲虫精髓":1,"弯刀":5,"珠宝材料包":1,"长棍":2,"暗影抗性药水":1,"渔具":10,"调味包":1,"南瓜":1,"源质钢":10,"筷子":0.1,"火焰之油":1,"柠檬汽水":1,"暗影防护合剂":1,"雨燕草":0.2,"亚麻布毯":2,"银制箭矢/弹药（20发）":1,"墨镜":0.5,"步枪":5,"鱼类":5,"蜂蜜烧烤肋排":2,"强壮药水":1,"投石索":0.5,"热情药水":1,"匕首":1,"椒盐鸡腿":0.5,"木箱":1,"禽类":2,"臻冰":1,"镰刀":5,"魔法灵光眼镜":0.5,"手杖":2,"番茄浓汤":0.5,"啤酒烤猪排":2,"领结":0.1,"拳刃":1,"迷药":0.5,"甘姜":1,"果酱":1,"蛇信草":0.2,"月蔷薇":0.2,"冬用毯子":5,"时之沙":0.2,"魔法防护吊坠":0.5,"吹箭筒":1,"强酸抗性药水":1,"暗玉":0.2,"短披肩":1,"烟熏鲑鱼":1,"冬刺草":0.2,"扳手":2,"袖扣":0.1,"海鲜浓汤":0.5,"大师级魔棒":1.5,"智慧合剂":1,"蜂蜜":1,"硫磺石":10,"跌打草":0.2,"初级护甲药水":1,"捕网":2,"蚌肉":1,"萨克斯":10,"谷物种子":0.1,"望远镜":1,"魔法尘":0.2,"重锤":10,"生火工具":5,"学徒魔棒":1,"草药工具":5,"培根海鲜炒饭":1,"毛线团":0.2,"亚麻布料":2,"佐料":2,"洗漱用品":1,"草药袋":1,"化妆品":1,"蝇龙的脑垂体":2,"未经雕刻的图腾":1,"怒气药水":1,"光耀抗性药水":1,"果篮":1,"琉璃晶铁砂":0.2,"空气魔力":0.1,"国王游戏":0.5,"野猪火腿":2,"草药烘蛋":0.5,"布衣":2,"制图工具":5,"金戈铁骨":1,"奶油蘑菇浓汤":0.5,"秋辉石":0.2,"烟草":1,"血蓟草":0.2,"白屈花":0.2,"隐身药水":1,"蔬菜":2,"领巾":0.1,"纯铁":10,"梦露花":0.2,"音乐盒":1,"次级生命药水":1,"施法者头饰":1,"制毒工具":5,"黄油啤酒":1,"自然防护合剂":1,"单边眼镜":0.5,"自然抗性药水":1,"谎言大师的根茎":0.5,"大蒜":1,"小提琴":5,"火焰灵核":0.2,"火枪":2.5,"粉笔":0.1,"魔法箭矢戒指":0.2,"水蛭素":1,"青铜合剂":1,"渔船":1,"蚌肉杂烩":1,"长礼服":5,"黄油":1,"太阳花":0.2,"铁匠工具":30,"雷电防护合剂":1,"火把":2,"火焰抗性药水":1,"观察者眼魔的核心":2,"黯淡的命运纺锤":1,"山铜锭":10,"草药材料包":1,"奥法之尘":0.2,"闪光起泡酒":1,"土豆":1,"意志合剂":1,"淀粉":5,"酿酒工具":15,"剥皮小刀":1,"丹菊":1,"炽心椒":1,"黄油大虾":1,"棱光碎片":0.2,"影钻":0.5,"星界钢":10,"电磁铁":0.2,"强效活力药水":1,"奇械摄影机":5,"风暴灵核":0.2,"通晓语言药水":1,"海盐":1,"秘银锭":10,"虎骨片":1,"珠宝工具":5,"宽檐帽":1,"木杯":1,"打火机":0.5,"心灵抗性药水":1,"名称":1,"玻璃珠":0.1,"迅捷合剂":1,"蛇毒":0.1,"缩小药剂":1,"润滑油":0.2,"鹰角豆":1,"弹药（20发）":1,"煤油灯":5}');
window._itemHandsCache = JSON.parse('{"拳刃":"1h","习武木棍":"1h","长棍":"1h","捕网":"1h","大师级魔棒":"1h","袖剑":"1h","学徒法杖":"1h","长剑":"2h","轻弩":"1h","弯刀":"1h","重弩":"2h","标枪":"1h","火枪":"1h","镰刀":"2h","手杖":"1h","木杖":"1h","匕首":"1h","战斧":"2h","刺剑":"1h","短斧":"1h","大师级法杖":"1h","短棒":"1h","吹箭筒":"1h","短杖":"1h","长弓":"2h","重锤":"2h","步枪":"2h","三叉戟":"2h","学徒魔棒":"1h","投石索":"1h","轻锤":"1h","长矛":"2h"}');
})();

// Make aliasMap globally accessible for tag lookup


var globalAliasMap = {};


function initGlobalAlias() {


  globalAliasMap = {


    "\u9c81\u7279\u7434": "\u5c0f\u63d0\u7434",


    "\u9ad8\u6863\u670d\u88c5": "\u5e03\u8863",


    "\u6f14\u51fa\u620f\u670d": "\u62ab\u98ce",


    "\u5a31\u4e50\u6742\u5fd7\u548c\u5468\u520a": "\u5a31\u4e50\u6742\u5fd7"


  };


}


initGlobalAlias();








// === Equipment Movement System ===


var _selectedEquip = null;
var _dragFrom = null;
var _dragGhost = null;
var _dragMoved = false;
var _justDragged = false;
var _dragAnimFrame = null;


var _equipMsgTimer = null;





function itemName(x){return (x&&typeof x==='object')?x.item:x;}
// 材料包独立槽位（v1.0.7227）：每种材料包一个槽位，槽位名即材料包名
var BAG_SLOTS = ['烹饪材料包','垂钓材料包','医用材料包','草药材料包','裁缝材料包','矿石材料包','珠宝材料包','炼金材料包','铭文材料包'];
function getItemTags(_item) {
  var n=itemName(_item);

  try {

    if (window._itemTagsCache && window._itemTagsCache[n]) return window._itemTagsCache[n];

    var alias = globalAliasMap[n];


    if (alias && window._itemTagsCache && window._itemTagsCache[alias]) return window._itemTagsCache[alias];


  } catch(e) {}


  return [];


}





function canPlaceInSlot(tags, slotName, itemName, bagType) {if(isSlotLocked(slotName))return false;


  if (slotName === "\u6742\u7269\u5305") return tags.indexOf("\u6742\u7269") >= 0;


  if (slotName === "\u9632\u5177") return tags.indexOf("\u9632\u5177") >= 0;


  if (slotName === "\u914d\u9970") return tags.indexOf("\u914d\u9970") >= 0;


  if (slotName === "\u6750\u6599\u5305" || (typeof BAG_SLOTS !== 'undefined' && BAG_SLOTS.indexOf(slotName) >= 0)) {
    if (!bagType && typeof BAG_SLOTS !== 'undefined' && BAG_SLOTS.indexOf(slotName) >= 0) bagType = slotName;


    if (!bagType) return false;


    // Check bag type rules


    if (bagType === "\u70f9\u996a\u6750\u6599\u5305") return tags.indexOf("\u98df\u54c1") >= 0 && tags.indexOf("\u6c34\u4ea7") < 0;


    if (bagType === "\u5782\u9493\u6750\u6599\u5305") return tags.indexOf("\u6c34\u4ea7") >= 0;


    if (bagType === "\u533b\u7528\u6750\u6599\u5305") return tags.indexOf("\u533b\u7528") >= 0;


    if (bagType === "\u88c1\u7f1d\u6750\u6599\u5305") return tags.indexOf("\u7f1d\u7eab") >= 0;


    if (bagType === "\u8349\u836f\u6750\u6599\u5305") return tags.indexOf("\u8349\u836f") >= 0;


    if (bagType === "\u77ff\u77f3\u6750\u6599\u5305") return tags.indexOf("\u77ff\u4ea7") >= 0;


    if (bagType === "\u73e0\u5b9d\u6750\u6599\u5305") return tags.indexOf("\u5b9d\u77f3") >= 0;


    if (bagType === "\u70bc\u91d1\u6750\u6599\u5305") return tags.indexOf("\u6750\u6599") >= 0 && (tags.indexOf("\u751f\u7269\u6750\u6599") >= 0 || tags.indexOf("\u9b54\u6cd5\u6750\u6599") >= 0 || tags.indexOf("\u5de5\u827a\u6750\u6599") >= 0 || tags.indexOf("\u5143\u7d20\u6750\u6599") >= 0);


    if (bagType === "\u94ed\u6587\u6750\u6599\u5305") return itemName === "\u7a7a\u767d\u7684\u9b54\u6cd5\u5377\u8f74";


    return false;


  }


  // Off-hand: only 1h weapons or shields


  if (slotName === "\u526f\u624b\u6b66\u5668") {


    if (tags.indexOf("\u6b66\u5668") < 0) return false;


    if (isTwoHanded(itemName)) return false;


    return true;


  }


  return true;


}





function isTwoHanded(itemName) {


  try {


    return window._itemHandsCache && window._itemHandsCache[itemName] === "2h";


  } catch(e) {}


  return false;


}





function showEquipMessage(text) {


  var box = document.getElementById("equip-msg");


  if (!box) {


    box = document.createElement("div");


    box.id = "equip-msg";


    box.style.cssText = "position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#5a3a1a;color:#f0e0c8;padding:12px 28px;border-radius:8px;border:1px solid #a46d1f;font-size:16px;z-index:9999;display:none;max-width:500px;text-align:center";


    document.body.appendChild(box);


  }


  box.innerHTML = text;


  box.style.display = "block";


  if (_equipMsgTimer) clearTimeout(_equipMsgTimer);


  _equipMsgTimer = setTimeout(function(){ box.style.display = "none"; }, 2500);


}





function clearEquipSelection() {


  if (_selectedEquip) {


    var prev = document.querySelector(".equip-selected");


    if (prev) prev.classList.remove("equip-selected");


  }


  _selectedEquip = null;


}
function gd_mousedown(e) {
  if (e.button !== 0) return;
  var el = e.currentTarget;
  var item = el.getAttribute("data-item");
  if (!item) return;
  _dragFrom = {
    slot: el.getAttribute("data-slot"),
    item: item,
    count: parseInt(el.getAttribute("data-count")) || 1,
    bagType: el.getAttribute("data-bag-type") || "",
    bagIdx: el.getAttribute("data-bag-idx") !== null ? parseInt(el.getAttribute("data-bag-idx")) : undefined
  };
  _dragMoved = false;
  _justDragged = false;
}

// 顶层注册一次（原 render 内重复注册被浏览器去重，此处仅为代码整洁）
document.addEventListener("mousemove", gd_mousemove);
document.addEventListener("mouseup", gd_mouseup);

function gd_mousemove(e) {
  if (!_dragFrom) return;
  if (!_dragGhost) {
    _dragGhost = document.createElement("div");
    var cnt = _dragFrom.count || 1;
    _dragGhost.textContent = cnt > 1 ? (_dragFrom.item + " \u00d7" + cnt) : _dragFrom.item;
    _dragGhost.style.cssText = "position:fixed;pointer-events:none;z-index:9999;padding:10px 16px;background:var(--panel);border:2px solid var(--accent-hover);border-radius:10px;font-size:18px;color:var(--ink);font-weight:bold;box-shadow:0 8px 24px rgba(0,0,0,0.2);opacity:0.88;white-space:nowrap;";
    document.body.appendChild(_dragGhost);
    // Start continuous wobble animation
    function wobbleLoop() {
      if (!_dragGhost) { _dragAnimFrame = null; return; }
      var w = Math.sin(Date.now() / 200) * 2;
      var currLeft = _dragGhost.style.left;
      var currTop = _dragGhost.style.top;
      _dragGhost.style.transform = "translate(-50%, -50%) rotate(" + w + "deg) scale(1.3)";
      _dragAnimFrame = requestAnimationFrame(wobbleLoop);
    }
    if (_dragAnimFrame) cancelAnimationFrame(_dragAnimFrame);
    _dragAnimFrame = requestAnimationFrame(wobbleLoop);
  }
  // Update position on mouse move (wobble is handled by animation loop)
  _dragGhost.style.left = e.clientX + "px";
  _dragGhost.style.top = e.clientY + "px";
  _dragMoved = true;
  e.preventDefault();
  _dragGhost.style.display = "none";
  var target = document.elementFromPoint(e.clientX, e.clientY);
  _dragGhost.style.display = "";
  var all = document.querySelectorAll(".drag-over");
  for (var di = 0; di < all.length; di++) { all[di].classList.remove("drag-over"); }
  if (target) {
    var slot = target.closest(".equip-item, .equip-empty");
    if (slot) slot.classList.add("drag-over");
  }
}

function gd_mouseup(e) {
  if (!_dragFrom) return;
  var all = document.querySelectorAll(".drag-over");
  for (var di = 0; di < all.length; di++) { all[di].classList.remove("drag-over"); }
  if (_dragMoved) {
    _justDragged = true;
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && _dragGhost) {
      var slot = target.closest(".equip-item, .equip-empty");
      if (slot) {
        var toSlot = slot.getAttribute("data-slot");
        var toItem = slot.getAttribute("data-item") || null;
        var toBagIdx = slot.getAttribute("data-bag-idx") !== null ? parseInt(slot.getAttribute("data-bag-idx")) : undefined;
        var fromData = {slot:_dragFrom.slot, item:_dragFrom.item, count:_dragFrom.count, bagIdx:_dragFrom.bagIdx};
        var rect = slot.getBoundingClientRect();
        var targetX = rect.left + rect.width / 2;
        var targetY = rect.top + rect.height / 2;
        _dragGhost.style.transition = "all 280ms cubic-bezier(0.34, 1.56, 0.64, 1)";
        _dragGhost.style.left = targetX + "px";
        _dragGhost.style.top = targetY + "px";
        _dragGhost.style.transform = "translate(-50%, -50%) scale(0.4)";
        _dragGhost.style.opacity = "0";
        if (_dragAnimFrame) { cancelAnimationFrame(_dragAnimFrame); _dragAnimFrame = null; }
        _dragFrom = null;
        var ghostToRemove = _dragGhost;
        _dragGhost = null;
        setTimeout(function() {
          if (ghostToRemove) ghostToRemove.remove();
                    tryMoveItem(fromData.slot, fromData.item, fromData.count || 1, toSlot, toItem, fromData.bagIdx, toBagIdx);
        }, 300);
        return;
      }
    }
    if (_dragGhost) { _dragGhost.remove(); _dragGhost = null; }
    if (_dragAnimFrame) { cancelAnimationFrame(_dragAnimFrame); _dragAnimFrame = null; }
  }
  if (_dragAnimFrame) { cancelAnimationFrame(_dragAnimFrame); _dragAnimFrame = null; }
  _dragFrom = null;
}
function showSplitDialog(itemName, maxCount, onConfirm) {
  var overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center";
  overlay.onclick = function(ev) { if (ev.target === overlay) overlay.remove(); };
  var html = "<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:280px;width:80%;box-shadow:0 8px 32px rgba(0,0,0,0.5);text-align:center'>";
  html += "<div style='font-size:16px;color:#e8a86a;font-weight:bold;margin-bottom:10px'>\u62c6\u5206 " + itemName + "</div>";
  html += "<div style='font-size:13px;color:#aaa;margin-bottom:10px'>\u5f53\u524d\u5806\u53e0: " + maxCount + "</div>";
  html += "<input id='spAmt' type='number' min='1' max='" + (maxCount-1) + "' value='1' style='width:70px;padding:8px;text-align:center;font-size:16px;background:#1f1a16;color:#f0e0d0;border:1px solid #5a3a18;border-radius:6px;outline:none'>";
  html += "<div style='font-size:12px;color:#666;margin:10px 0'>\u8bf7\u8f93\u5165\u8981\u79fb\u52a8\u7684\u6570\u91cf (1-" + (maxCount-1) + ")</div>";
  html += "<div style='display:flex;gap:8px;justify-content:center'>";
  html += "<button onclick='event.stopPropagation();this.closest(\"#modalOverlay\").remove()' style='padding:8px 20px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer'>\u53d6\u6d88</button>";
  html += "<button id='spCfm' style='padding:8px 20px;background:#4a8;color:#fff;border:none;border-radius:6px;cursor:pointer'>\u786e\u8ba4</button></div></div>";
  overlay.innerHTML = html;
  overlay.id = "modalOverlay";
  document.body.appendChild(overlay);
  document.getElementById("spCfm").onclick = function(ev) {
    ev.stopPropagation();
    var amt = parseInt(document.getElementById("spAmt").value) || 1;
    if (amt < 1 || amt >= maxCount) { return; }
    overlay.remove();
    if (onConfirm) onConfirm(amt);
  };
  document.getElementById("spAmt").focus();
  document.getElementById("spAmt").select();
}






function gd_contextmenu(e) {
  e.preventDefault();
  var el = e.currentTarget;
  var item = el.getAttribute("data-item");
  if (!item) return;
  var cnt = parseInt(el.getAttribute("data-count")) || 1;
  var slot = el.getAttribute("data-slot");
  closeContextMenu();
  var m = document.createElement("div");
  m.id = "ctxMenu";
  m.style.cssText = "position:fixed;z-index:10001;background:#3d3530;border:1px solid #7a5a38;border-radius:8px;padding:6px 0;box-shadow:0 4px 16px rgba(0,0,0,0.5);min-width:140px;font-size:14px;color:#f0e0d0";
  m.style.left = e.clientX + "px";
  m.style.top = e.clientY + "px";
  var h = "";
  if (cnt > 1) {
    h += "<div class='ctx-item' data-action='split'><span style='font-size:16px;width:20px;text-align:center'>\u2b07</span>\u62c6\u5206</div>";
  }
  h += "<div class='ctx-item' data-action='detail'><span style='font-size:16px;width:20px;text-align:center'>\u2139</span>\u67e5\u770b\u8be6\u60c5</div>";
  m.innerHTML = h;
  document.body.appendChild(m);
  m.onclick = function(ev) {
    var t = ev.target.closest(".ctx-item");
    if (!t) return;
    var act = t.getAttribute("data-action");
    if (act === "split") {
      closeContextMenu();
      var bi = el.getAttribute("data-bag-idx") !== null ? parseInt(el.getAttribute("data-bag-idx")) : undefined;
      var arr = slot === "材料包" ? (state.equipment["材料包"][bi || 0] || {}).items || [] : state.equipment[slot];
      if (!arr) return;
      var total = 0;
      for (var si = 0; si < arr.length; si++) { if (arr[si] === item) total++; }
      if (total < 2) return;
      var amt = parseInt(prompt("拆分 " + item + " (当前堆叠: " + total + ")\n请输入要移动的数量 (1-" + (total-1) + "):", "1"));
      if (!amt || amt < 1 || amt >= total) return;
      var moved = 0;
      for (var si = arr.length - 1; si >= 0 && moved < amt; si--) {
        if (arr[si] === item) { arr.splice(si, 1); moved++; }
      }
      // Choose insertion position farthest from remaining items of same type
      var firstPos = -1, lastPos = -1;
      for (var si = 0; si < arr.length; si++) {
        if (arr[si] === item) {
          if (firstPos === -1) firstPos = si;
          lastPos = si;
        }
      }
      var insertPos;
      if (firstPos === -1) {
        insertPos = arr.length;
      } else {
        var distToStart = firstPos;
        var distToEnd = arr.length - 1 - lastPos;
        if (distToStart >= distToEnd) {
          insertPos = 0;
        } else {
          insertPos = arr.length;
        }
      }
      for (var mi = 0; mi < moved; mi++) { arr.splice(insertPos + mi, 0, item); }
      render();
    } else if (act === "detail") {
      showEquipMessage("\u67e5\u770b\u8be6\u60c5 - \u5f85\u5b9e\u73b0");
    }
    closeContextMenu();
  };
}
function closeContextMenu() {
  var m = document.getElementById("ctxMenu");
  if (m) m.remove();
}
// Click blank area or Esc to cancel selection


document.addEventListener("click", function(e) {
  closeContextMenu();


  if (_selectedEquip) {


    var target = e.target;


    if (!target.closest(".equip-item") && !target.closest(".equip-empty")) {


      clearEquipSelection();


    }


  }


});


document.addEventListener("keydown", function(e) {


  if (e.key === "Escape" && _selectedEquip) {


    clearEquipSelection();


  }


});





function tryMoveItem(fromSlot, fromItem, moveCount, toSlot, toItem, fromBagIdx, toBagIdx) {if(isSlotLocked(toSlot)){showEquipMessage("此容器未装备，无法放入");return;}


  var tags = getItemTags(fromItem);


    var toBagType = "";


  if (toSlot === "\u6750\u6599\u5305") {


    if (toItem && typeof toItem === "string" && toItem.indexOf("\u6750\u6599\u5305") > 0) {


      toBagType = toItem;


    } else if (toBagIdx !== undefined) {


      var bags = state.equipment["\u6750\u6599\u5305"] || [];


      toBagType = (bags[toBagIdx] || {}).type || "";


    }


  }


  if (!canPlaceInSlot(tags, toSlot, fromItem, toBagType)) {


    showEquipMessage(fromItem + " \u4e0d\u80fd\u653e\u5165 " + toSlot);


    return;


  }


  var srcArr = fromSlot === "材料包" ? (state.equipment["材料包"][fromBagIdx || 0] || {}).items || [] : state.equipment[fromSlot];


  if (fromSlot === "材料包" && fromBagIdx === undefined) { fromBagIdx = 0; }


  var dstArr;


  if (toSlot === "材料包") {


    if (toBagIdx === undefined) {


      // Find which bag slot has space or matching type


      var bags = state.equipment["材料包"] || [];


      for (var bi = 0; bi < bags.length; bi++) {


        var bag = bags[bi] || {};


        if (bag.type && canPlaceInSlot(window._itemTagsCache[fromItem] || [], "材料包", fromItem, bag.type)) {


          toBagIdx = bi;


          break;


        }


      }


      if (toBagIdx === undefined) { showEquipMessage("没有合适的材料包"); return; }


    }


    dstArr = (state.equipment["材料包"][toBagIdx] || {}).items || [];


  } else {


    dstArr = state.equipment[toSlot];


  }


  if (!srcArr || !dstArr) return;


  


  // Count available items in source


  var totalAvail = 0;


  for (var si = 0; si < srcArr.length; si++) {


    if (srcArr[si] === fromItem) { totalAvail++; }


  }


  if (totalAvail === 0) { showEquipMessage("\u672a\u627e\u5230\u7269\u54c1"); return; }


  


  var actualMove = Math.min(moveCount || 1, totalAvail);


  


  // Two-handed weapon check


  if (toSlot === "\u4e3b\u624b\u6b66\u5668" && isTwoHanded(fromItem)) {


    var offHand = state.equipment["\u526f\u624b\u6b66\u5668"] || [];


    if (offHand.length > 0) {


      var backpack = state.equipment["\u80cc\u5305"] || [];


      var belt = state.equipment["\u65c5\u884c\u8170\u5305"] || [];


      var freeSpace = (10 - compactStacks(backpack).length) + (5 - compactStacks(belt).length);


      if (offHand.length <= freeSpace) {


        for (var oi = 0; oi < offHand.length; oi++) {


          if (compactStacks(backpack).length < 10) { backpack.push(offHand[oi]); }


          else { belt.push(offHand[oi]); }


        }


        state.equipment["\u526f\u624b\u6b66\u5668"] = [];


      } else {


        showEquipMessage("\u80cc\u5305\u7a7a\u95f4\u4e0d\u8db3");


        return;


      }


    }


  }


  


  // Try merge with existing stack in destination


  var limit = getStackLimit(fromItem);


  if (toItem === fromItem && limit > 1) {


    var merged = false;


    for (var mi = 0; mi < dstArr.length; mi++) {


      if (dstArr[mi] === fromItem) {


        var existingCount = 0;


        for (var mi2 = mi; mi2 < dstArr.length && dstArr[mi2] === fromItem && existingCount < limit; mi2++) {


          existingCount++;


        }


        var canAdd = limit - existingCount;


        var toMove = Math.min(actualMove, canAdd);


        for (var ai = 0; ai < toMove; ai++) {


          dstArr.splice(mi + existingCount + ai, 0, fromItem);


          srcArr.splice(srcArr.indexOf(fromItem), 1);


        }


        merged = true;


        break;


      }


    }


    if (merged) { render(); return; }


  }


  


  // Swap or move to empty slot


  var slotLimit = {"\u4e3b\u624b\u6b66\u5668":3,"\u526f\u624b\u6b66\u5668":4,"\u9632\u5177":2,"\u914d\u9970":4,"\u80cc\u5305":10,"\u6742\u7269\u5305":10,"\u65c5\u884c\u8170\u5305":5};


  var limit2 = slotLimit[toSlot] || 10;


  var dstCompacted = compactStacks(dstArr);


  var hasEmptySlot = dstCompacted.length < limit2;


  


  var dstIdx = -1;


  if (toItem) {


    for (var di = 0; di < dstArr.length; di++) {


      if (dstArr[di] === toItem) { dstIdx = di; break; }


    }


  }


  


  if (dstIdx >= 0) {


    // Swap - exchange 1 item


    var swapped = dstArr[dstIdx];


    dstArr[dstIdx] = fromItem;


    for (var si2 = 0; si2 < srcArr.length; si2++) {


      if (srcArr[si2] === fromItem) { srcArr.splice(si2, 1); break; }


    }


    srcArr.push(swapped);


  } else if (hasEmptySlot) {


    // Move all selected items to empty slot


    var moved = 0;


    for (var si3 = 0; si3 < srcArr.length && moved < actualMove; si3++) {


      if (srcArr[si3] === fromItem) {


        srcArr.splice(si3, 1);


        dstArr.push(fromItem);


        moved++;


        si3--; // adjust index after splice


      }


    }


  } else {


    showEquipMessage(toSlot + " \u5df2\u6ee1");


    return;


  }


  render();


}function getStackLimit(_item) {
  var n=itemName(_item);
  var tags = getItemTags(n);


  if (tags.indexOf("材料") >= 0 || tags.indexOf("可堆叠") >= 0) return 5;


  if (tags.indexOf("按重量") >= 0) return 1;


  if (n.indexOf("弹药") >= 0 || n.indexOf("箭矢") >= 0) return 20;


  return 1;


}


function canStack(itemName) { return getStackLimit(itemName) > 1; }


function compactStacks(arr) {


  var result = []; var i = 0;


  while (i < arr.length) {


    var item = arr[i];


    if (!item) { i++; continue; }


    var limit = getStackLimit(item);


    if (limit > 1) {


      var count = 1;


      while (i + count < arr.length && itemName(arr[i + count]) === itemName(item) && count < limit) { count++; }

      result.push({item: itemName(item), count: count, weight: (typeof item==='object'?item.weight:undefined)});
      i += count;

    } else {

      result.push({item: itemName(item), count: 1, weight: (typeof item==='object'?item.weight:undefined)});


      i++;


    }


  }


  return result;


}



function getSkillField(skillName, srcClass, field) {
  var clsData = SKILL_DATA[srcClass]; if (!clsData) return "";
  for (var i = 0; i < clsData.length; i++) {
    if (clsData[i].name === skillName) {
      if (field === "description") return (clsData[i].description || [""]).join(" ");
      if (clsData[i].fields) return clsData[i].fields[field] || "";
      return "";
    }
  }
  return "";
}







function showSpecialFeatDetail(name) {
  var fd = SPECIAL_FEATS[name];
  if (!fd) return;
  var desc = fd.effects.description || "暂无详细描述";
  var prereq = fd.prerequisite || "无";
  var typeLabel = "";
  if(fd.effects.type !== "description_only"){
    var typeMap={"attribute":"属性","multi":"复合","proficiency":"熟练度","professional":"专业","attribute_health":"属性+生命","health_growth":"生命成长","attribute_proficiency":"属性+熟练","attribute_boost":"属性强化","sp_pack":"技能点","xp_pack":"经验值","armor_ac":"防御","heavy_armor":"重甲防御","extra_slot":"额外槽位","professional_sp":"专业+技能点","panel":"面板加成","description_only":"规则"};
    typeLabel = typeMap[fd.effects.type] || fd.effects.type;
  }
  var tier = "特殊专长";
  var styleInfo = typeLabel ? "[" + typeLabel + "]" : "";
  showSkillPreview(name, styleInfo, tier, "前置条件：" + prereq + "<br><br>" + desc, null);
}

// Show multiple proficiency choice dialog for feats
function showMultipleProfChoice(featName, options, count, onConfirm) {
  var flat = [];
  if (!options || options.length === 0) {
    for (var a in PROF_DEFS) {
      var pl = PROF_DEFS[a];
      for (var i = 0; i < pl.length; i++) {
        if (pl[i] !== "豁免") flat.push(pl[i]);
      }
    }
  } else {
    for (var oi = 0; oi < options.length; oi++) {
      var opt = options[oi];
      var resolved = resolveProfTarget(opt);
      if (resolved && resolved.category && resolved.keys) {
        for (var ki = 0; ki < resolved.keys.length; ki++) flat.push(resolved.keys[ki]);
      } else if (resolved && resolved.key) {
        flat.push(resolved.key);
      } else if (PROF_DEFS[opt]) {
        var list = PROF_DEFS[opt];
        for (var j = 0; j < list.length; j++) {
          if (list[j] !== "豁免") flat.push(list[j]);
        }
      } else {
        flat.push(opt);
      }
    }
  }
  var h = "<div style='padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0'>";
  h += "<div style='font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a'>选择" + count + "项熟练项（已选0/" + count + "）</div>";
  h += "<div id='multiProfList' style='display:flex;flex-wrap:wrap;gap:6px'>";
  for (var fi = 0; fi < flat.length; fi++) {
    h += "<div data-prof='" + flat[fi] + "' onclick='toggleMultiProf(this.dataset.prof," + count + ")' style='padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0'>" + flat[fi] + "</div>";
  }
  h += "</div>";
  h += "<div style='margin-top:10px'>";
  h += "<button onclick='confirmMultiProf(" + count + ")' style='padding:8px 20px;background:#4a6a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer'>确认</button>";
  h += "</div></div>";
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._multiProfPending = {featName: featName, options: flat, count: count, selected: [], onConfirm: onConfirm};
}

function toggleMultiProf(profAttr, maxCount) {
  var pending = window._multiProfPending;
  if (!pending) return;
  var idx = pending.selected.indexOf(profAttr);
  if (idx >= 0) {
    pending.selected.splice(idx, 1);
  } else {
    if (pending.selected.length >= maxCount) return;
    pending.selected.push(profAttr);
  }
  // Update display
  var items = document.querySelectorAll("#multiProfList [data-prof]");
  for (var i = 0; i < items.length; i++) {
    var a = items[i].getAttribute("data-prof");
    if (pending.selected.indexOf(a) >= 0) {
      items[i].style.background = "#4a5a3a";
      items[i].style.border = "1px solid #6a8a4a";
    } else {
      items[i].style.background = "#3d3020";
      items[i].style.border = "1px solid #5a4a30";
    }
  }
}

function confirmMultiProf(maxCount) {
  var pending = window._multiProfPending;
  if (!pending) return;
  if (pending.selected.length !== maxCount) {
    SB_toast("请选择恰好" + maxCount + "项熟练项");
    return;
  }
  closeReplaceModal();
  if (pending.onConfirm) {
    var result = [];
    for (var i = 0; i < pending.selected.length; i++) {
      var raw = pending.selected[i];
      var resolved = resolveProfTarget(raw);
      if (resolved && resolved.attr && resolved.key) {
        result.push({attr: resolved.attr, key: resolved.key});
      } else if (resolved && resolved.custom) {
        result.push({custom: resolved.custom});
      } else {
        var attr = findProfAttrByKey(raw);
        if (attr) result.push({attr: attr, key: raw});
      }
    }
    pending.onConfirm(result);
  }
  window._multiProfPending = null;
}

// Show tier choice dialog for extra_slot feat
function showTierChoice(featName, tiers, onConfirm) {
  var h = "<div style='padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0'>";
  h += "<div style='font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a'>选择要额外增加槽位的位阶</div>";
  h += "<div style='display:flex;flex-wrap:wrap;gap:6px'>";
  for (var oi = 0; oi < tiers.length; oi++) {
    h += "<div data-tier='" + tiers[oi] + "' onclick='selectTier(this.dataset.tier)' style='padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0'>" + tiers[oi] + "</div>";
  }
  h += "</div></div>";
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._tierPending = {featName: featName, onConfirm: onConfirm};
}

function selectTier(tier) {
  var pending = window._tierPending;
  if (!pending) return;
  closeReplaceModal();
  if (pending.onConfirm) {
    pending.onConfirm(tier);
  }
  window._tierPending = null;
}

function removeSpecialFeat(name) {
  if(!confirm("确定移除特殊专长「"+name+"」吗？")) return;
  var arr = state.special_feats;
  for(var i=0;i<arr.length;i++){
    var n=typeof arr[i]==="string"?arr[i]:arr[i].name;
    if(n===name){
      // Undo effects before removing
      applyFeatEffects(name, arr[i], false);
      arr.splice(i,1);
      break;
    }
  }
  state.special_feats = arr;
  render();
}

function showSpecialFeatSelector() {
  closeReplaceModal();
  var overlay = document.createElement("div");
  overlay.id = "modalOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";
  document.body.appendChild(overlay);
  
  var html = "<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:600px;width:95%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";
  html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px'>";
  html += "<span style='font-size:18px;color:#e8a86a;font-weight:bold'>选择特殊专长</span>";
  html += "<button onclick='closeSpecialFeatSelector()' style='background:none;border:none;color:#888;font-size:20px;cursor:pointer'>&times;</button></div>";
  
  // Group feats
  var featKeys = Object.keys(SPECIAL_FEATS).sort();
  for(var fi=0;fi<featKeys.length;fi++){
    var fn = featKeys[fi];
    var fd = SPECIAL_FEATS[fn];
    var isLearned = false;
    for(var si=0;si<state.special_feats.length;si++){var sn=typeof state.special_feats[si]==="string"?state.special_feats[si]:state.special_feats[si].name;if(sn===fn){isLearned=true;break;}}
    
    html += "<div style='background:#3a322a;border-radius:8px;padding:10px 14px;margin-bottom:6px;border:1px solid "+(isLearned?"#6a5a3a":"#4a3a2a")+"'>";
    html += "<div style='display:flex;align-items:center;gap:8px'>";
    html += "<span style='font-weight:bold;color:"+(isLearned?"#b09070":"#e8d8c0")+";font-size:15px'>"+fn+"</span>";
    html += "<span style='font-size:10px;color:#907050'>["+fd.prerequisite+"]</span>";
    if(isLearned){
      html += "<span style='margin-left:auto;font-size:11px;color:#6a8a5a'>已学习</span>";
    } else {
      html += "<button data-feat=\""+fn.replace(/"/g,"&quot;")+"\" onclick='addSpecialFeat(this.dataset.feat)' style='margin-left:auto;padding:2px 10px;background:#3a5a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer;font-size:12px'>学习</button>";
    }
    html += "</div>";
    var descPreview = fd.effects.description||"";
    if(descPreview.length>120) descPreview = descPreview.substring(0,120)+"...";
    html += "<div style='font-size:12px;color:#b09070;margin-top:4px'>"+descPreview+"</div>";
    html += "</div>";
  }
  
  html += "</div>";
  overlay.innerHTML = html;
}


// Apply/undo special feat effects
function applyFeatEffects(name, featEntry, add) {
  var fd = SPECIAL_FEATS[name];
  if (!fd) return;
  var eff = fd.effects;
  if (!eff) return;
  var mult = add ? 1 : -1;
  var choices = featEntry.choices || {};
  
  switch (eff.type) {
    case "attribute": {
      // 强化属性: uses pre-stored choices
      var attrChoices = choices.attrs || [];
      for (var ai = 0; ai < attrChoices.length; ai++) {
        var ac = attrChoices[ai];
        if (!state.attrs) state.attrs = {};
        state.attrs[ac] = Math.max(0, (state.attrs[ac] || 0) + mult);
      }
      break;
    }
    case "attribute_health": {
      // 健美教练: attr + HP
      if (choices.attr) {
        if (!state.attrs) state.attrs = {};
        state.attrs[choices.attr] = Math.max(0, (state.attrs[choices.attr] || 0) + mult);
      }
      // HP bonus is already handled in calcTotalHP via name check
      break;
    }
    case "attribute_proficiency": {
      // 擒抱者: fixed attr + prof choice
      var ap = eff.attr_points;
      if (ap && ap.attr) {
        if (!state.attrs) state.attrs = {};
        state.attrs[ap.attr] = Math.max(0, (state.attrs[ap.attr] || 0) + mult);
      }
      if (choices.prof) {
        if (choices.prof.custom) bumpCustomProf(choices.prof.custom, mult);
        else {
          var profAttr = choices.prof.attr;
          var profKey = choices.prof.key;
          if (profAttr && profKey) bumpProf(profAttr, profKey, mult);
        }
      }
      break;
    }
    case "attribute_boost": {
      // 弥补短板: raise lowest attr to 12
      if (choices.attr) {
        if (!state.attrs) state.attrs = {};
        if (add) {
          var cur = state.attrs[choices.attr] || 0;
          var target = eff.raise_lowest_to || 12;
          if (cur < target) {
            state.attrs[choices.attr] = target;
            // Store original value for undo
            if (!featEntry._orig) featEntry._orig = {};
            featEntry._orig[choices.attr] = cur;
          }
          if (choices._futureLowestLeft == null && eff.future_level_bonus) {
            choices._futureLowestLeft = eff.future_level_bonus.count || 2;
          }
        } else {
          // Undo: restore original value
          var orig = featEntry._orig || {};
          if (orig[choices.attr] !== undefined) {
            state.attrs[choices.attr] = orig[choices.attr];
          }
        }
      }
      break;
    }
    case "multi": {
      // 质朴: multiple effects
      // Attribute
      if (choices.attr) {
        if (!state.attrs) state.attrs = {};
        state.attrs[choices.attr] = Math.max(0, (state.attrs[choices.attr] || 0) + mult);
      }
      // Proficiency
      if (choices.prof) {
        if (choices.prof.custom) {
          bumpCustomProf(choices.prof.custom, mult);
        } else {
          var pa = choices.prof.attr, pk = choices.prof.key;
          if (pa && pk) bumpProf(pa, pk, mult);
        }
      }
      // Skill slot
      if (eff.skill_slot) {
        state.extra_skill_slots = Math.max(0, (state.extra_skill_slots || 0) + mult * (eff.skill_slot || 1));
      }
      // XP
      if (eff.xp && add) {
        state.xp = (state.xp || 0) + eff.xp;
      } else if (eff.xp && !add) {
        state.xp = Math.max(0, (state.xp || 0) - eff.xp);
      }
      // SP
      if (eff.sp) {
        addSpPointsDelta(eff.sp, mult);
      }
      break;
    }
    case "health_growth": {
      // 健壮: +1 体质 + 每级HP成长
      if (eff.attr_points && eff.attr_points.attr) {
        var attr = eff.attr_points.attr;
        if (!state.attrs) state.attrs = {};
        state.attrs[attr] = Math.max(0, (state.attrs[attr] || 0) + mult);
      }
      // HP per level is tracked for calcTotalHP
      if (add && eff.hp_per_level) {
        state._hp_per_level_bonus = (state._hp_per_level_bonus || 0) + eff.hp_per_level;
      } else if (!add && eff.hp_per_level) {
        state._hp_per_level_bonus = Math.max(0, (state._hp_per_level_bonus || 0) - eff.hp_per_level);
      }
      break;
    }
    case "proficiency": {
      // 技巧专家等: 熟练项选择；固定熟练专长也走此分支
      if (choices.profs && Array.isArray(choices.profs)) {
        for (var pi = 0; pi < choices.profs.length; pi++) {
          var pc = choices.profs[pi];
          if (pc.custom) bumpCustomProf(pc.custom, mult);
          else if (pc.attr && pc.key) bumpProf(pc.attr, pc.key, mult);
        }
      } else if (eff.proficiency && eff.proficiency.name) {
        var fixed = resolveProfTarget(eff.proficiency.name);
        var fval = (eff.proficiency.value || 1) * mult;
        if (fixed && fixed.custom) bumpCustomProf(fixed.custom, fval);
        else if (fixed && fixed.category) {
          // Category without choice — leave for interactive path; no-op here
        } else if (fixed && fixed.attr && fixed.key) {
          bumpProf(fixed.attr, fixed.key, fval);
        } else if (eff.proficiency.type === "professional") {
          bumpCustomProf(eff.proficiency.name, fval);
        }
      }
      break;
    }
    case "professional": {
      // 独具匠心: 自定义专业熟练项
      if (choices.profName && add) {
        if (!state.custom_profs) state.custom_profs = {};
        state.custom_profs[choices.profName] = Math.max(0, (state.custom_profs[choices.profName] || 0) + 1);
      } else if (choices.profName && !add) {
        if (state.custom_profs) {
          state.custom_profs[choices.profName] = Math.max(0, (state.custom_profs[choices.profName] || 0) - 1);
        }
      }
      break;
    }
    case "professional_sp": {
      // 绿拇指: 固定专业熟练项 + 技能点
      if (eff.proficiency) {
        var pn = eff.proficiency.name;
        if (!state.custom_profs) state.custom_profs = {};
        state.custom_profs[pn] = Math.max(0, (state.custom_profs[pn] || 0) + mult * (eff.proficiency.value || 1));
      }
      if (eff.sp) {
        addSpPointsDelta(eff.sp, mult);
      }
      break;
    }
    case "armor_ac": {
      // 中甲大师: 甲胄熟练项 + AC加值
      if (eff.armor_proficiency && add) {
        if (!state.armor_profs) state.armor_profs = {};
        state.armor_profs[eff.armor_proficiency] = 1;
      } else if (eff.armor_proficiency && !add) {
        if (state.armor_profs) delete state.armor_profs[eff.armor_proficiency];
      }
      if (eff.ac_bonus) {
        state._feat_ac_bonus = Math.max(0, (state._feat_ac_bonus || 0) + mult * eff.ac_bonus);
      }
      break;
    }
    case "heavy_armor": {
      // 重甲大师: 力量 + 重甲熟练 + 抗性
      if (eff.attr_points && eff.attr_points.attr) {
        if (!state.attrs) state.attrs = {};
        state.attrs[eff.attr_points.attr] = Math.max(0, (state.attrs[eff.attr_points.attr] || 0) + mult);
      }
      if (eff.armor_proficiency && add) {
        if (!state.armor_profs) state.armor_profs = {};
        state.armor_profs[eff.armor_proficiency] = 1;
      } else if (eff.armor_proficiency && !add) {
        if (state.armor_profs) delete state.armor_profs[eff.armor_proficiency];
      }
      break;
    }
    case "sp_pack": {
      // 技能点礼包: 按等级给技能点
      var lv = (state.classes && state.classes[0] && state.classes[0].level) || 1;
      var spData = eff.sp_by_level;
      if (spData) {
        var spKey = "";
        if (lv >= 13) spKey = "13";
        else if (lv >= 8) spKey = "8";
        else spKey = "4";
        var spAmounts = spData[spKey];
        if (spAmounts && add) {
          addSpPointsDelta(spAmounts, 1);
        }
      }
      break;
    }
    case "xp_pack": {
      // 经验值礼包: 按等级给经验值
      var lv = (state.classes && state.classes[0] && state.classes[0].level) || 1;
      var xpData = eff.xp_by_level;
      if (xpData) {
        var xpKey = "";
        if (lv >= 13) xpKey = "13";
        else if (lv >= 8) xpKey = "8";
        else xpKey = "4";
        var xpAmount = xpData[xpKey];
        if (xpAmount && add) {
          state.xp = (state.xp || 0) + xpAmount;
        }
      }
      break;
    }
    case "extra_slot": {
      // 额外槽位: 额外天赋槽位
      if (choices.tier && add) {
        if (!state.extra_slots) state.extra_slots = [];
        if (state.extra_slots.indexOf(choices.tier) < 0) {
          state.extra_slots.push(choices.tier);
        }
      } else if (choices.tier && !add) {
        if (state.extra_slots) {
          var ei = state.extra_slots.indexOf(choices.tier);
          if (ei >= 0) state.extra_slots.splice(ei, 1);
        }
      }
      break;
    }
    case "panel": {
      applyPanelFeatEffects(eff, featEntry, add);
      break;
    }

  }
}

/** Collect unique languages from RACE_LANGUAGES (基础种族语言). */
function collectBasicRaceLanguages() {
  var out = [];
  if (typeof RACE_LANGUAGES === "undefined") return out;
  for (var race in RACE_LANGUAGES) {
    if (!RACE_LANGUAGES.hasOwnProperty(race)) continue;
    var langs = RACE_LANGUAGES[race] || [];
    for (var i = 0; i < langs.length; i++) {
      if (out.indexOf(langs[i]) < 0) out.push(langs[i]);
    }
  }
  return out;
}

function applyPanelFeatEffects(eff, featEntry, add) {
  var mult = add ? 1 : -1;
  var choices = featEntry.choices || {};
  // Fixed or chosen attribute +1, clamp to 20 (可突破至20)
  var attrName = eff.attr || choices.attr;
  if (attrName) {
    if (!state.attrs) state.attrs = {};
    if (add) {
      var curA = state.attrs[attrName] || 0;
      if (curA < 20) {
        state.attrs[attrName] = curA + 1;
        choices._attrGained = true;
      } else {
        choices._attrGained = false;
      }
    } else if (choices._attrGained !== false) {
      state.attrs[attrName] = Math.max(0, (state.attrs[attrName] || 0) - 1);
    }
  }
  // Skill / save proficiency
  if (eff.proficiency && eff.proficiency.name) {
    var fixed = resolveProfTarget(eff.proficiency.name);
    var fval = (eff.proficiency.value || 1) * mult;
    if (fixed && fixed.custom) bumpCustomProf(fixed.custom, fval);
    else if (fixed && fixed.attr && fixed.key) bumpProf(fixed.attr, fixed.key, fval);
    else if (eff.proficiency.type === "professional") bumpCustomProf(eff.proficiency.name, fval);
  }
  if (eff.custom_prof && eff.custom_prof.name) {
    bumpCustomProf(eff.custom_prof.name, mult * (eff.custom_prof.value || 1));
  }
  // All attribute saves +N
  if (eff.all_saves) {
    var attrs8 = ATTR_NAMES;
    for (var si = 0; si < attrs8.length; si++) {
      bumpProf(attrs8[si], "豁免", mult * (eff.all_saves || 1));
    }
  }
  // Weapon proficiency grants
  if (eff.weapon_profs && eff.weapon_profs.length) {
    if (!state.weapon_profs) state.weapon_profs = {};
    for (var wi = 0; wi < eff.weapon_profs.length; wi++) {
      var wn = eff.weapon_profs[wi];
      if (add) state.weapon_profs[wn] = (state.weapon_profs[wn] || 0) + 1;
      else {
        state.weapon_profs[wn] = Math.max(0, (state.weapon_profs[wn] || 0) - 1);
        if (!state.weapon_profs[wn]) delete state.weapon_profs[wn];
      }
    }
  }
  // Weapon proficiency numeric bonus (可破上限)
  if (eff.weapon_prof_bonus) {
    if (!state.weapon_prof_bonus) state.weapon_prof_bonus = {};
    for (var wb in eff.weapon_prof_bonus) {
      if (!eff.weapon_prof_bonus.hasOwnProperty(wb)) continue;
      var delta = mult * (eff.weapon_prof_bonus[wb] || 0);
      state.weapon_prof_bonus[wb] = Math.max(0, (state.weapon_prof_bonus[wb] || 0) + delta);
      if (!state.weapon_prof_bonus[wb]) delete state.weapon_prof_bonus[wb];
    }
  }
  // Armor / shield proficiency
  if (eff.armor_proficiency) {
    if (add) {
      if (!state.armor_profs) state.armor_profs = {};
      state.armor_profs[eff.armor_proficiency] = (state.armor_profs[eff.armor_proficiency] || 0) + 1;
    } else if (state.armor_profs) {
      state.armor_profs[eff.armor_proficiency] = Math.max(0, (state.armor_profs[eff.armor_proficiency] || 0) - 1);
      if (!state.armor_profs[eff.armor_proficiency]) delete state.armor_profs[eff.armor_proficiency];
    }
  }
  // Extra talent slot for a chosen tier
  if (eff.extra_talent_slot && choices.tier) {
    if (add) {
      if (!state.extra_slots) state.extra_slots = [];
      if (state.extra_slots.indexOf(choices.tier) < 0) state.extra_slots.push(choices.tier);
    } else if (state.extra_slots) {
      var ti = state.extra_slots.indexOf(choices.tier);
      if (ti >= 0) state.extra_slots.splice(ti, 1);
    }
  }
  // All basic race languages
  if (eff.languages_all_basic) {
    if (!state.languages) state.languages = [];
    if (add) {
      var added = [];
      var allLangs = collectBasicRaceLanguages();
      for (var li = 0; li < allLangs.length; li++) {
        if (state.languages.indexOf(allLangs[li]) < 0) {
          state.languages.push(allLangs[li]);
          added.push(allLangs[li]);
        }
      }
      if (!featEntry.choices) featEntry.choices = {};
      featEntry.choices._addedLanguages = added;
    } else {
      var rem = (featEntry.choices && featEntry.choices._addedLanguages) || [];
      for (var ri = 0; ri < rem.length; ri++) {
        var rix = state.languages.indexOf(rem[ri]);
        if (rix >= 0) state.languages.splice(rix, 1);
      }
    }
  }
  if (!featEntry.choices) featEntry.choices = choices;
  if (add) featEntry.choices._panelApplied = true;
  else featEntry.choices._panelApplied = false;
}

/**
 * Old saves learned these as description_only: re-apply panel bonuses once.
 * Skips feats that still need interactive choices (attr_choice / tier).
 */
function ensurePanelFeatBonuses() {
  var feats = state.special_feats || [];
  for (var i = 0; i < feats.length; i++) {
    var fe = feats[i];
    var fname = typeof fe === "string" ? fe : fe.name;
    var fd = typeof SPECIAL_FEATS !== "undefined" ? SPECIAL_FEATS[fname] : null;
    if (!fd || !fd.effects || fd.effects.type !== "panel") continue;
    if (typeof fe === "string") {
      feats[i] = { name: fe, level: 0, choices: {} };
      fe = feats[i];
    }
    if (!fe.choices) fe.choices = {};
    if (fe.choices._panelApplied) continue;
    var eff = fd.effects;
    if (eff.attr_choice && !fe.choices.attr) continue;
    if (eff.extra_talent_slot && !fe.choices.tier) continue;
    applyPanelFeatEffects(eff, fe, true);
  }
}

// Show attribute choice dialog for feats
function showFeatAttrChoice(featName, options, onConfirm) {
  var h = '<div style="padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0">';
  h += '<div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a">选择属性</div>';
  if (Array.isArray(options)) {
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    for (var oi = 0; oi < options.length; oi++) {
      var opt = options[oi];
      h += '<div data-fn="' + featName + '" data-opt="' + opt + '" onclick="selectFeatAttr(this.dataset.fn,this.dataset.opt)" style="padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0">' + opt + '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._featPendingChoice = {name: featName, onConfirm: onConfirm};
}

// Handle attribute selection for feats
function selectFeatAttr(featName, attr) {
  var pending = window._featPendingChoice;
  if (!pending) return;
  if (pending.onConfirm) {
    pending.onConfirm(attr);
  }
  window._featPendingChoice = null;
  closeReplaceModal();
}



// Handle proficiency choice for feats (called after attr is applied)

function selectFeatAttrOption(featName, option) {
  var pending = window._featAttrPending;
  if (!pending) return;
  var attrNames = pending.attrNames || [];
  closeReplaceModal();
  
  if (option === "A") {
    showMultiAttrChoice(featName, attrNames, 3, false, function(selected) {
      addSpecialFeat(featName, {attrs: selected});
    });
  } else {
    showFeatAttrChoice(featName, attrNames, function(attr) {
      addSpecialFeat(featName, {attrs: [attr, attr]});
    });
  }
}

function showFeatProfChoice(featName, options, onConfirm) {
  var flat = [];
  for (var oi = 0; oi < (options || []).length; oi++) {
    var opt = options[oi];
    var resolved = resolveProfTarget(opt);
    if (resolved && resolved.category && resolved.keys) {
      for (var ki = 0; ki < resolved.keys.length; ki++) flat.push(resolved.keys[ki]);
    } else if (PROF_DEFS[opt]) {
      var list = PROF_DEFS[opt];
      for (var j = 0; j < list.length; j++) {
        if (list[j] !== "豁免") flat.push(list[j]);
      }
    } else if (resolved && resolved.key) {
      flat.push(resolved.key);
    } else {
      flat.push(opt);
    }
  }
  if (flat.length === 0) {
    for (var a in PROF_DEFS) {
      var pl = PROF_DEFS[a];
      for (var i = 0; i < pl.length; i++) {
        if (pl[i] !== "豁免") flat.push(pl[i]);
      }
    }
  }
  var h = '<div style="padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0">';
  h += '<div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a">选择熟练项</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  for (var fi = 0; fi < flat.length; fi++) {
    h += '<div data-fn="' + featName + '" data-opt="' + flat[fi] + '" onclick="selectFeatProf(this.dataset.fn,this.dataset.opt)" style="padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0">' + flat[fi] + '</div>';
  }
  h += '</div></div>';
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._featPendingChoice = {name: featName, onConfirm: onConfirm};
}

function selectFeatProf(featName, profKey) {
  var pending = window._featPendingChoice;
  if (!pending) return;
  var resolved = resolveProfTarget(profKey);
  var payload = null;
  if (resolved && resolved.attr && resolved.key) {
    payload = {attr: resolved.attr, key: resolved.key};
  } else if (resolved && resolved.custom) {
    payload = {custom: resolved.custom};
  } else {
    var attr = findProfAttrByKey(profKey);
    if (attr) payload = {attr: attr, key: profKey};
  }
  if (!payload) {
    SB_toast("无法识别熟练项「" + profKey + "」");
    return;
  }
  if (pending.onConfirm) pending.onConfirm(payload);
  window._featPendingChoice = null;
  closeReplaceModal();
}



function showMultiAttrChoice(featName, options, count, allowSame, onConfirm) {
  var selected = [];
  var h = '<div style="padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0">';
  h += '<div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a">选择' + count + '项属性（已选0/' + count + '）</div>';
  h += '<div id="multiAttrList" style="display:flex;flex-wrap:wrap;gap:6px">';
  for (var oi = 0; oi < options.length; oi++) {
    h += '<div data-attr="' + options[oi] + '" onclick="toggleMultiAttr(\'' + featName + '\',\'' + options[oi] + '\',' + count + ')" style="padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0">' + options[oi] + '</div>';
  }
  h += '</div>';
  h += '<div style="margin-top:10px">';
  h += '<button onclick="confirmMultiAttr(\'' + featName + '\',' + count + ')" style="padding:8px 20px;background:#4a6a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer">确认</button>';
  h += '</div></div>';
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._multiAttrPending = {featName: featName, options: options, count: count, selected: [], onConfirm: onConfirm};
}

function toggleMultiAttr(featName, attr, maxCount) {
  var pending = window._multiAttrPending;
  if (!pending) return;
  var idx = pending.selected.indexOf(attr);
  if (idx >= 0) {
    pending.selected.splice(idx, 1);
  } else {
    if (pending.selected.length >= maxCount) return;
    pending.selected.push(attr);
  }
  // Update display
  var items = document.querySelectorAll("#multiAttrList [data-attr]");
  for (var i = 0; i < items.length; i++) {
    var a = items[i].getAttribute("data-attr");
    if (pending.selected.indexOf(a) >= 0) {
      items[i].style.background = "#4a5a3a";
      items[i].style.border = "1px solid #6a8a4a";
    } else {
      items[i].style.background = "#3d3020";
      items[i].style.border = "1px solid #5a4a30";
    }
  }
}

function confirmMultiAttr(featName, maxCount) {
  var pending = window._multiAttrPending;
  if (!pending) return;
  if (pending.selected.length !== maxCount) {
    SB_toast("请选择恰好" + maxCount + "项属性");
    return;
  }
  closeReplaceModal();
  if (pending.onConfirm) {
    pending.onConfirm(pending.selected);
  }
  window._multiAttrPending = null;
}


function addSpecialFeat(name, choices) {
  var arr = state.special_feats;
  // Check duplicate
  for(var i=0;i<arr.length;i++){var n=typeof arr[i]==="string"?arr[i]:arr[i].name;if(n===name) return;}
  var fd = SPECIAL_FEATS[name]; if (!fd) return;
  var eff = fd.effects; if (!eff) return;
  
  // For feats that need interactive choices, show dialog first
  if (!choices) {
    var needsChoice = false;
    switch (eff.type) {
      case "attribute": {
        // Show option A (3 pts, 3 different) or B (2 pts, same)
        var attrNames = ATTR_NAMES;
        var html = "<div style='padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0'>";
        html += "<div style='font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a'>强化属性</div>";
        html += "<div style='margin-bottom:10px'>";
        html += "<div onclick=\"selectFeatAttrOption('" + name + "','A')\" style='padding:10px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0;margin-bottom:6px'>选项A：获得3点属性值（分配到三项不同属性上）</div>";
        html += "<div onclick=\"selectFeatAttrOption('" + name + "','B')\" style='padding:10px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0'>选项B：获得2点属性值（分配到同一项属性上）</div>";
        html += "</div></div>";
        showSkillPreview(name, "特殊专长", "", html, function() {});
        window._featAttrPending = {name: name, attrNames: attrNames};
        needsChoice = true;
        break;
      }
      case "attribute_health":
        showFeatAttrChoice(name, eff.attr_choice || [], function(attr) {
          addSpecialFeat(name, {attr: attr});
        });
        needsChoice = true;
        break;
      case "attribute_proficiency":
        // First apply fixed attr, then ask for prof
        var profOptions = eff.proficiency_choice || [];
        showFeatProfChoice(name, profOptions, function(profChoice) {
          addSpecialFeat(name, {prof: profChoice});
        });
        return;
      case "attribute_boost": {
        // Find lowest attrs
        var attrs = state.attrs || {};
        var minVal = 999; var lowest = [];
        var attrNames = ATTR_NAMES;
        for (var ai = 0; ai < attrNames.length; ai++) {
          var v = attrs[attrNames[ai]] || 0;
          if (v < minVal) { minVal = v; lowest = [attrNames[ai]]; }
          else if (v === minVal) { lowest.push(attrNames[ai]); }
        }
        if (lowest.length === 1) {
          addSpecialFeat(name, {attr: lowest[0]});
        } else {
          showFeatAttrChoice(name, lowest, function(attr) {
            addSpecialFeat(name, {attr: attr});
          });
        }
        return;
      }
      case "multi": {
        // 质朴: need attr + prof choices
        var attrNames = ATTR_NAMES;
        showFeatAttrChoice(name, attrNames, function(attr) {
          window._featPendingProf = {name: name, attr: attr};
          // Show prof choice dialog with all attr categories
          showFeatProfChoice(name + "_prof", attrNames, function(profChoice) {
            addSpecialFeat(name, {attr: attr, prof: profChoice});
          });
        });
        return;
      }
      case "health_growth":
        // 健壮: fixed effect, no choice needed
        addSpecialFeat(name, {});
        return;
      case "proficiency": {
        // Fixed proficiency grant (隐伏者等) vs interactive multi-pick (技巧专家)
        if (eff.proficiency && eff.proficiency.name && !eff.proficiency_options) {
          var fixedT = resolveProfTarget(eff.proficiency.name);
          if (fixedT && fixedT.category) {
            showFeatProfChoice(name, [eff.proficiency.name], function(profChoice) {
              addSpecialFeat(name, {profs: [profChoice]});
            });
            return;
          }
          var entryProfs = [];
          if (fixedT && fixedT.custom) entryProfs.push({custom: fixedT.custom});
          else if (fixedT && fixedT.attr && fixedT.key) entryProfs.push({attr: fixedT.attr, key: fixedT.key});
          else if (eff.proficiency.type === "professional") entryProfs.push({custom: eff.proficiency.name});
          else {
            SB_toast("无法解析熟练项「" + eff.proficiency.name + "」");
            return;
          }
          addSpecialFeat(name, {profs: entryProfs});
          return;
        }
        var profCount = eff.proficiency_count || 1;
        var profOptions = eff.proficiency_options || [];
        showMultipleProfChoice(name, profOptions, profCount, function(profs) {
          addSpecialFeat(name, {profs: profs});
        });
        return;
      }
      case "professional": {
        // 独具匠心: ask for custom prof name
        var profName = prompt("请输入自定义专业熟练项名称：");
        if (profName && profName.trim()) {
          addSpecialFeat(name, {profName: profName.trim()});
        }
        return;
      }
      case "professional_sp":
        // 绿拇指: fixed effect, no extra choice needed
        addSpecialFeat(name, {});
        return;
      case "armor_ac":
        // 中甲大师: fixed effect
        addSpecialFeat(name, {});
        return;
      case "heavy_armor":
        // 重甲大师: fixed effect (attr + armor prof)
        addSpecialFeat(name, {});
        return;
      case "sp_pack":
        // 技能点礼包: auto-apply based on level
        addSpecialFeat(name, {});
        return;
      case "xp_pack":
        // 经验值礼包: auto-apply based on level
        addSpecialFeat(name, {});
        return;
      case "extra_slot": {
        // 额外槽位: show tier selection dialog
        var tiers = ["一阶","二阶","三阶","四阶","五阶","六阶","七阶","八阶","九阶"];
        showTierChoice(name, tiers, function(tier) {
          addSpecialFeat(name, {tier: tier});
        });
        return;
      }
      case "panel": {
        // Structured panel bonuses from former description_only feats
        if (eff.attr_choice && !(choices && choices.attr)) {
          showFeatAttrChoice(name, eff.attr_choice, function(attr) {
            var c = {};
            if (choices) {
              for (var ck in choices) if (choices.hasOwnProperty(ck)) c[ck] = choices[ck];
            }
            c.attr = attr;
            addSpecialFeat(name, c);
          });
          return;
        }
        if (eff.extra_talent_slot && !(choices && choices.tier)) {
          var tiersP = ["一阶","二阶","三阶","四阶","五阶","六阶","七阶","八阶","九阶"];
          showTierChoice(name, tiersP, function(tier) {
            var c2 = {};
            if (choices) {
              for (var ck2 in choices) if (choices.hasOwnProperty(ck2)) c2[ck2] = choices[ck2];
            }
            c2.tier = tier;
            addSpecialFeat(name, c2);
          });
          return;
        }
        addSpecialFeat(name, choices || {});
        return;
      }

    }
    if (needsChoice) return;
  }
  
  // Store as object with name, level, and choices
  var lv = window._pendingLevelUp ? window._pendingLevelUp.level : 0;
  if (!lv) lv = getMaxLevel() || 0;
  var entry = {name: name, level: lv};
  if (choices) entry.choices = choices;
  else entry.choices = {};
  if (name === "弥补短板" && entry.choices._futureLowestLeft == null) {
    entry.choices._futureLowestLeft = 2;
  }
  
  arr.push(entry);
  state.special_feats = arr;
  
  // Apply effects
  applyFeatEffects(name, entry, true);
  state._dirty = true;
  
  var pu = window._pendingLevelUp;
  closeReplaceModal();
  if (pu) { pu._done._feat=true; applyLevelUp(pu.clsIdx); }
  render();
}

function closeSpecialFeatSelector() {
  closeReplaceModal();
  if (window._pendingLevelUp) {
    SB_toast("升级未完成：属性/熟练奖励已保留，请再次点击「升级」继续选择专长或完成升级。");
  }
}


function getSkillStyle(name, src) {
  var d = SKILL_DATA[src];
  if (d) {
    for (var i = 0; i < d.length; i++) {
      if (d[i].name === name) return canonicalSkillStyle(d[i].style || "");
    }
  }
  var anywhere = findSkillStyleAnywhere(name);
  return anywhere ? canonicalSkillStyle(anywhere) : "";
}


function getKeyAttr(cls){if(!cls||!cls.name)return"魅力";if(cls.keyAttr)return cls.keyAttr;var ref=REF_CLASSES[cls.name];if(ref&&ref.key_attr){var ka=ref.key_attr;if(ka.indexOf("或")>=0)return ka.split("或")[0].trim();return ka.trim();}return"魅力";}

function isSlotLocked(slot){
  if(!state.containerItems)return false;
  if(slot==="背包")return !state.containerItems["背包"];
  if(slot==="旅行腰包")return !state.containerItems["旅行腰包"];
  if(typeof BAG_SLOTS !== 'undefined' && BAG_SLOTS.indexOf(slot) >= 0)return !state.containerItems[slot];
  return false;
}


// === HOISTED: armor weight/AC helpers ===



// Lookup partial match


function getArmorAC(armorName) {
  armorName = itemName(armorName);

  if (armorACMap[armorName]) return armorACMap[armorName];


  for (var key in armorACMap) {


    if (armorName.indexOf(key) >= 0) return armorACMap[key];


  }


  return null;


}

function getShieldBonus(state) {
  var b = 0;
  var eq = (state && state.equipment && state.equipment["防具"]) || [];
  for (var i = 0; i < eq.length; i++) {
    var nm = itemName(eq[i]) || "";
    if (nm.indexOf("\u76fe\u724c") < 0) continue;
    var d = (typeof ITEM_DATA !== "undefined" && ITEM_DATA[nm] && ITEM_DATA[nm].description) ? ITEM_DATA[nm].description : "";
    var m = d.match(/\u9632\u5fa1\u7b49\u7ea7\+(\d+)/) || d.match(/\u9632\u5fa1\u7b49\u7ea7\uff1a(\d+)/);
    if (m) b += parseInt(m[1], 10);
  }
  return b;
}

/** 中甲：鳞甲 / 胸甲 / 半身板甲（与 armorACMap 常见分级一致） */
var MEDIUM_ARMOR_NAMES = {"鳞甲":1,"胸甲":1,"半身板甲":1};

function isMediumArmorName(armorName) {
  var n = itemName(armorName) || "";
  if (MEDIUM_ARMOR_NAMES[n]) return true;
  for (var k in MEDIUM_ARMOR_NAMES) {
    if (n.indexOf(k) >= 0) return true;
  }
  return false;
}

function wearingMediumArmor() {
  var eq = (state.equipment && state.equipment["防具"]) || [];
  for (var i = 0; i < eq.length; i++) {
    if (eq[i] && isMediumArmorName(eq[i])) return true;
  }
  return false;
}

function parseWeight(wt) {


  if (typeof wt === "number") return wt;


  if (!wt) return 0;


  var m = String(wt).match(/^([\d.]+)/);


  return m ? parseFloat(m[1]) : 0;


}
function getItemWeight(itemName) {


  if (typeof ITEM_DATA !== "undefined") {


    var id = ITEM_DATA[itemName];


    if (id && id.weight) return parseWeight(id.weight);


    for (var key in ITEM_DATA) {


      if (itemName.indexOf(key) >= 0 || key.indexOf(itemName) >= 0) {


        if (ITEM_DATA[key].weight) return parseWeight(ITEM_DATA[key].weight);


      }


    }


  }


  var exact = itemWeights[itemName];


  if (exact !== undefined) return exact;


  for (var key in itemWeights) {


    if (itemName.indexOf(key) >= 0) return itemWeights[key];


  }


  return 1;


}

function resolveWeight(name) {
  if(name&&typeof name==='object'&&name.weight)return name.weight;
  var n=itemName(name);

  var alias = aliasMap[n];


  if (alias) return getItemWeight(alias);


  var ew = itemWeights[n];


  if (ew !== undefined) return ew;


  return getItemWeight(n);


}


// === HOISTED: tier unlock helpers ===

function isTierUnlocked(tierName) {
  tierName = normalizeTierName(tierName);
  if (!tierName || tierName === "\u901a\u7528") return true;
  // 一阶/二阶始终免费（默认已开）；防止后缀未归一时误锁
  if (tierName === "\u4e00\u9636" || tierName === "\u4e8c\u9636") {
    var unlockedFree = state.unlocked_tiers || ["\u4e00\u9636","\u4e8c\u9636"];
    if (unlockedFree.indexOf("\u4e00\u9636") < 0 || unlockedFree.indexOf("\u4e8c\u9636") < 0) {
      if (!state.unlocked_tiers) state.unlocked_tiers = ["\u4e00\u9636","\u4e8c\u9636"];
      if (state.unlocked_tiers.indexOf("\u4e00\u9636") < 0) state.unlocked_tiers.push("\u4e00\u9636");
      if (state.unlocked_tiers.indexOf("\u4e8c\u9636") < 0) state.unlocked_tiers.push("\u4e8c\u9636");
    }
  }
  var unlocked = state.unlocked_tiers || ["\u4e00\u9636","\u4e8c\u9636"];
  for (var ui = 0; ui < unlocked.length; ui++) {
    if (normalizeTierName(unlocked[ui]) === tierName) return true;
  }
  return false;
}
function getTierUnlockCost(tierName) {
  tierName = normalizeTierName(tierName);
  if (!TIER_UNLOCK_COST) return null;
  var info = TIER_UNLOCK_COST[tierName];
  return info ? info.cost : null;
}
function getTierMinLevel(tierName) {
  tierName = normalizeTierName(tierName);
  if (!TIER_UNLOCK_COST) return null;
  var info = TIER_UNLOCK_COST[tierName];
  return info ? info.minLevel : null;
}
function hasTierUnlockCost(tierName) {
  tierName = normalizeTierName(tierName);
  return !!(TIER_UNLOCK_COST && TIER_UNLOCK_COST[tierName]);
}
function resolveWeaponProfs(className){return CLASS_WEAPON_PROFS[className]||[];}
// 容器状态迁移（v1.0.7227）：材料包A/B 旧格式 → 9 种具名材料包槽位
function migrateContainerState() {
  if (!state) return;
  if (!state.containerItems) state.containerItems = {};
  var ci = state.containerItems;
  if (typeof BAG_SLOTS === 'undefined') return;
  for (var i = 0; i < BAG_SLOTS.length; i++) {
    if (!(BAG_SLOTS[i] in ci)) ci[BAG_SLOTS[i]] = '';
  }
  var oldA = ci['材料包A'], oldB = ci['材料包B'];
  if (oldA && !ci[oldA]) ci[oldA] = '已解锁';
  if (oldB && !ci[oldB]) ci[oldB] = '已解锁';
  delete ci['材料包A'];
  delete ci['材料包B'];
  if (state.equipment && Array.isArray(state.equipment['材料包'])) {
    var oldArr = state.equipment['材料包'];
    var newArr = [];
    for (var j = 0; j < BAG_SLOTS.length; j++) {
      var found = null;
      for (var k = 0; k < oldArr.length; k++) {
        if (oldArr[k] && oldArr[k].type === BAG_SLOTS[j]) { found = oldArr[k]; break; }
      }
      newArr.push(found ? { type: BAG_SLOTS[j], items: found.items || [] } : { type: BAG_SLOTS[j], items: [] });
    }
    state.equipment['材料包'] = newArr;
  } else if (state.equipment && !state.equipment['材料包']) {
    var fresh = [];
    for (var j2 = 0; j2 < BAG_SLOTS.length; j2++) fresh.push({ type: BAG_SLOTS[j2], items: [] });
    state.equipment['材料包'] = fresh;
  }
  if (state.equipment) { delete state.equipment['材料包A']; delete state.equipment['材料包B']; }
}
function render(){ applyChoiceLLevel12Boosts();
  ensureBlueprintState();
  migrateContainerState();
  if(state.equipment["背包"]&&state.equipment["背包"].length>0&&!state.containerItems["背包"])state.containerItems["背包"]="auto";
  if(state.equipment["旅行腰包"]&&state.equipment["旅行腰包"].length>0&&!state.containerItems["旅行腰包"])state.containerItems["旅行腰包"]="auto";
  if(state.equipment["材料包"]){
    var _m=state.equipment["材料包"];
    for(var _mi=0;_mi<_m.length;_mi++){if(_m[_mi]&&_m[_mi].type&&!state.containerItems[_m[_mi].type])state.containerItems[_m[_mi].type]="auto";}
  }
 applyChoiceBLevel10Boosts();


  autoCalcStyles();autoCalcTalentTree();






  renderProfile();
  renderClassRow();
  renderStory();
  renderXP();
  // === 4b. Skill Points ===

  ensureSpState();
  document.getElementById("sp-bar").innerHTML = renderMarkOverviewHtml();

  renderBattleStats();
  renderAttrGrid();
  renderFeats();
  renderCurrency();
  renderWeight();
  renderTalentGrid();
  renderEquipment();
  renderTraits();
  renderLangProfs();
  renderSkillTables();
  renderBlueprints();
}

function renderProfile(){
    // === 1. Portrait + Info ===

  var profileEl=document.getElementById("info-grid");profileEl.innerHTML="";
  var profileOuter=document.createElement("div");profileOuter.className="profile-outer";profileOuter.style.cssText="display:flex;gap:20px;align-items:stretch";

  // Portrait area
  var portraitDiv=document.createElement("div");portraitDiv.className="portrait-box";portraitDiv.style.cssText="flex:none;width:260px;height:260px;display:flex;align-items:center;justify-content:center;background:var(--bg);border:2px solid var(--line);border-radius:10px;cursor:pointer;overflow:hidden";
  portraitDiv.title="\u70b9\u51fb\u4e0a\u4f20\u7acb\u7ed8";
  if(state.portrait){
    portraitDiv.innerHTML="<img src=\""+state.portrait+"\" style=\"width:100%;height:100%;object-fit:contain;border-radius:8px\">";
  }else{
    portraitDiv.innerHTML="<div style=\"text-align:center;color:var(--muted);padding:12px\"><div style=\"font-size:32px;margin-bottom:6px\">+</div><div style=\"font-size:13px\">\u70b9\u51fb\u4e0a\u4f20\u7acb\u7ed8</div></div>";
  }
  portraitDiv.onclick=function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=function(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){state.portrait=ev.target.result;render();};reader.readAsDataURL(file);};inp.click();};
  profileOuter.appendChild(portraitDiv);

  // Info columns
  var infoCols=document.createElement("div");infoCols.className="info-cols";infoCols.style.cssText="flex:2;display:flex;gap:6px";
  var infoLeft=document.createElement("div");infoLeft.className="info-col";infoLeft.style.cssText="flex:1;display:flex;flex-direction:column;gap:5px";
  var infoRight=document.createElement("div");infoRight.className="info-col";infoRight.style.cssText="flex:1;display:flex;flex-direction:column;gap:5px";

  var infoData=[{f:"\u73a9\u5bb6",v:state.player},{f:"\u89d2\u8272",v:state.name},{f:"\u79cd\u65cf",v:state.race},{f:"\u6027\u522b",v:state.gender},{f:"\u5e74\u9f84",v:state.age},{f:"\u8eab\u9ad8",v:state.height},{f:"\u4f53\u91cd",v:state.weight},{f:"\u77b3\u8272",v:state.eye},{f:"\u80a4\u8272",v:state.skin},{f:"\u53d1\u8272",v:state.hair}];
  var colMap=[0,1,2,3,4];
  for(var ii=0;ii<infoData.length;ii++){
    var d=infoData[ii];
    var col=ii<5?infoLeft:infoRight;
    var item=document.createElement("div");item.className="info-item";item.style.cssText="display:flex;justify-content:space-between;align-items:center;padding:10px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--line);min-height:48px";
    item.innerHTML="<span style=\"font-size:14px;color:var(--muted);flex:none\">"+d.f+"</span><span style=\"font-size:16px;color:var(--ink);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0\">"+d.v+"</span>";
    col.appendChild(item);
  }
  infoCols.appendChild(infoLeft);infoCols.appendChild(infoRight);
  profileOuter.appendChild(infoCols);
  profileEl.appendChild(profileOuter);

}

function renderClassRow(){
// === 2. Class Row ===


  var cr=document.getElementById("class-row");var ch="";


  for(var ci=0;ci<3;ci++){var cl=state.classes[ci]||{name:"",level:0,styles:["","","",""]};


    if(!cl.name&&!cl.level){


      if(ci===2){


        ch+='<div class="class-box" style="display:flex;gap:14px;padding:14px 18px">';


        ch+='<div class="class-left" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1"><div style="font-size:18px;color:var(--muted);text-align:center"><div style="font-weight:bold;font-size:20px">附赠职业</div><div style="font-size:14px;margin-top:2px">未解锁</div></div></div>';


        ch+='<div class="class-right" style="display:flex;flex-direction:column;gap:4px;flex:1;max-width:160px;margin-left:auto">';


        for(var si=0;si<4;si++){ch+='<div class="style-item-empty" style="padding:3px 8px;background:transparent;border-radius:4px;border:1px dashed var(--line);font-size:12px;color:var(--muted);font-style:italic;text-align:center">空风格</div>';}


        ch+='</div></div>';


      }else{


        var _mc=state.classes[0];var _ml=_mc.level||0;if(_ml>=7){ch+='<div class="class-box" style="justify-content:center;align-items:center;cursor:pointer;background:var(--panel);border:2px dashed var(--accent)" onclick="showSubclassModal()"><div style="color:var(--accent);font-size:16px;font-weight:bold;padding:8px;text-align:center">📋 选择子职业</div></div>';}else{ch+='<div class="class-box" style="justify-content:center;align-items:center;background:var(--panel)"><div style="color:var(--muted);font-size:14px;padding:8px;text-align:center">🔒 未解锁<div style="font-size:12px;color:var(--muted)">（需主职业7级）</div></div></div>';}


      }


    continue;}


    ch+='<div class="class-box" style="display:flex;gap:14px;padding:14px 18px">';


    ch+='<div class="class-left" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1"><div class="class-name">'+cl.name+'</div><div class="class-level">Lv.'+cl.level+'</div></div>';


    ch+='<div class="class-right" style="display:flex;flex-direction:column;gap:4px;flex:1;max-width:160px;margin-left:auto">';


    for(var si=0;si<4;si++){


      if(cl.styles[si]){var sc=STYLE_COLORS[cl.styles[si]]||'';var sb=sc?'background:'+sc+';':'background:var(--bg);';ch+='<div class="style-item" style="padding:3px 8px;border-radius:4px;border:1px solid var(--line);font-size:14px;color:var(--ink);text-align:center;'+sb+'">'+cl.styles[si]+'</div>';}


      else{ch+='<div class="style-item-empty" style="padding:3px 8px;background:transparent;border-radius:4px;border:1px dashed var(--line);font-size:12px;color:var(--muted);font-style:italic;text-align:center">空风格</div>';}


    }


    ch+='</div></div>';}


  cr.innerHTML=ch;





}

function renderStory(){
  // === 3. Story Block ===


  var storyHtml='<div class="misc-item"><div class="m-title">背景故事</div><div>'+state.story+'</div></div><div class="misc-item"><div class="m-title">个性</div><div>'+state.personality+'</div></div><div class="misc-item"><div class="m-title">特性</div><div>'+state.traits+'</div></div><div class="misc-item"><div class="m-title">理念</div><div>'+state.ideals+'</div></div><div class="misc-item"><div class="m-title">羁绊</div><div>'+state.bonds+'</div></div><div class="misc-item"><div class="m-title">缺陷</div><div>'+state.flaws+'</div></div>';
if(state.deity)storyHtml+='<div class="misc-item"><div class="m-title">神祇</div><div>'+state.deity+(state.deityAttr?'（'+state.deityAttr+'）':'')+'</div></div>';
if(state.patron)storyHtml+='<div class="misc-item"><div class="m-title">宗主</div><div>'+state.patron+'</div></div>';
if(state.contacts)storyHtml+='<div class="misc-item"><div class="m-title">联系渠道</div><div>'+state.contacts+'</div></div>';
if(state.scamType)storyHtml+='<div class="misc-item"><div class="m-title">偏好骗局</div><div>'+state.scamType+'</div></div>';
if(state.missionChannel)storyHtml+='<div class="misc-item"><div class="m-title">任务渠道</div><div>'+state.missionChannel+'</div></div>';
if(state.academicDomain)storyHtml+='<div class="misc-item"><div class="m-title">学术领域</div><div>'+state.academicDomain+'</div></div>';
if(state.sportPreference)storyHtml+='<div class="misc-item"><div class="m-title">偏好运动</div><div>'+state.sportPreference+'</div></div>';


  document.getElementById("story-title").innerHTML="个性背景：\u0020"+(state.background||"未选择");


  document.getElementById("story-block").innerHTML=storyHtml;





}

function renderXP(){
  // === 4. XP ===


    // XP bar with level-up
  var xpEl=document.getElementById("xp-bar");
  var xpHTML='<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">';
  for(var ci=0;ci<state.classes.length;ci++){
    var cl=state.classes[ci];
    if(!cl.name||cl.level<=0)continue;
    var nextLv=cl.level+1;
    var tbl=LEVEL_TABLE[ci===1?"子职业":"主职业"];
        var needXP=tbl[nextLv]?tbl[nextLv].xp:0;
    var canUp=needXP>0&&state.xp>=needXP;
    xpHTML+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 14px;background:var(--bg);border-radius:8px;border:1px solid var(--line)">';
    xpHTML+='<div style="font-size:14px;color:var(--muted);font-weight:bold">'+cl.name+'</div>';
    xpHTML+='<div style="font-size:36px;color:var(--ink);font-weight:bold">Lv.'+cl.level+'</div>';
    xpHTML+='<div style="font-size:14px;color:var(--muted)">经验值: '+state.xp+'</div>';
      var curAttrCap=getCurrentAttrCap?getCurrentAttrCap():18;
      var curProfCap=getCurrentProfCap?getCurrentProfCap():2;
      xpHTML+='<div style="font-size:12px;color:var(--muted)">属性上限: '+curAttrCap+' | 熟练度上限: '+curProfCap+'</div>';
    if(needXP>0){
      xpHTML+='<div style="font-size:12px;color:var(--muted)">升级需要: '+needXP+' 经验</div>';
      var subCapMsg="";
      if(ci===1){
        var maxSub=getMaxSubLevel();
        var nextSub=cl.level+1;
        if(nextSub>maxSub)subCapMsg=" (主职业等级不足)";
      }
      xpHTML+='<button onclick="showLevelUpModal('+ci+')" style="padding:6px 14px;font-size:13px;background:'+((canUp&&!subCapMsg)?'#c9753e':'#6a5a4a')+';color:#fff;border:none;border-radius:5px;cursor:'+((canUp&&!subCapMsg)?'pointer':'not-allowed')+';'+((canUp&&!subCapMsg)?'':'opacity:0.6')+'">'+(canUp?(subCapMsg||'升级！'):'经验不足')+'</button>';
    }else{
      xpHTML+='<div style="font-size:12px;color:var(--muted);font-weight:bold">已达最高等级</div>';
    }
    xpHTML+='</div>';}
  xpHTML+='</div>';
  xpEl.innerHTML=xpHTML;


}

function renderBattleStats(){
    // === 5. Battle Stats ===


  var con=state.attrs["体质"]||10;var dex=state.attrs["敏捷"]||10;var wis=state.attrs["感知"]||10;


  var mc=state.classes[0].name;var ml=state.classes[0].level;var sc=state.classes[1].name;var sl=state.classes[1].level;


  // Safety cap: ensure sub-class does not exceed main class level - 5
  if(sc&&sl>0){
    // Sub-class level cap only enforced on level-up, not during render
  }


  // Calculate HP bonus from special feats
  var featHPBonus=0;
  for(var fhi=0;fhi<state.special_feats.length;fhi++){
    var fhn=state.special_feats[fhi];
    var fnName=typeof fhn==="string"?fhn:fhn.name;
    if(fnName==="健美教练") featHPBonus+=10;
    if(fnName==="健壮") featHPBonus+=2*(ml+(sc&&sl>0?sl-1:0));
  }
  state.hp=calcTotalHP(mc,ml,sc,sl,con,state.race,state.background,featHPBonus);


  var fpKeyAttr=REF_CLASSES[mc]?REF_CLASSES[mc].key_attr:"";if(fpKeyAttr==="力量或敏捷")fpKeyAttr=state.classes[0].keyAttr||"力量";var fpKeyVal=state.attrs[fpKeyAttr]||10;state.fp=calcTotalFP(mc,ml,sc,sl,fpKeyAttr,fpKeyVal,state.race,0);


  // Load speed from race data


  var raceData=REF_RACES[state.race]||{};var speed=raceData.speed||"6米";


  // AC: calculate from equipped armor (highest base)




  var armorAC = null;


  var dexMod = calcMod(dex);


  var eqArmor = (state.equipment && state.equipment["防具"]) || [];


  for (var ai = 0; ai < eqArmor.length; ai++) {


    var aInfo = getArmorAC(eqArmor[ai]);


    if (!aInfo) {


      // Try alias resolution for common items


      // treat as clothing if mapped to 布衣 or 披风


      if (eqArmor[ai] == "演出戏服" || eqArmor[ai] == "高档服装" || eqArmor[ai] == "布衣" || eqArmor[ai] == "披风") {


        aInfo = {"base": 11, "addDex": true};


      }


    }


    if (aInfo) {


      var thisAC = aInfo.addDex ? (aInfo.base + dexMod) : aInfo.base;


      if (armorAC === null || thisAC > armorAC) armorAC = thisAC;


    }


  }


  if (armorAC === null) {


    var ac = 10 + dexMod;


  } else {


    var ac = armorAC;


  }
  // 中甲大师等：仅着装中甲时计入 _feat_ac_bonus
  if (state._feat_ac_bonus && wearingMediumArmor()) {
    ac += (state._feat_ac_bonus || 0);
  }


  // Key attribute (left, 2 rows tall)


  var keyAttr=getKeyAttr(state.classes[0]);var keyMod=calcMod(state.attrs[keyAttr]||10);


  var battleHtml="<div class='battle-layout'><div class='battle-key'>";


  battleHtml+="<div class='stat-item key-attr'><span class='stat-label'>关键属性</span><span class='stat-value'>"+keyAttr+" ("+mStr(keyMod)+")</span></div>";


  battleHtml+="</div><div class='battle-grid'>";


  // Right side: 2x5 grid


  var row1=[{l:"生命值",v:state.hp},{l:"疲劳值",v:state.fp},{l:"防御等级",v:ac},{l:"先攻值",v:"D20"+mStr(calcMod(dex))},{l:"速度",v:speed}];


  var strMod=calcMod(state.attrs["力量"]||10);var dexMod=calcMod(dex);var _keyAttr=REF_CLASSES[mc]?REF_CLASSES[mc].key_attr:"魅力";if(_keyAttr==="力量或敏捷")_keyAttr=state.classes[0].keyAttr||"力量";var _keyVal=state.attrs[_keyAttr]||10;var spellMod=calcMod(_keyVal)+(state.spell_hit_bonus||0);


  var atkMod=Math.max(strMod,dexMod)+(state.atk_hit_bonus||0);


  var row2=[{l:"生命回复",v:Math.floor(state.hp/2)},{l:"疲劳回复",v:Math.floor(state.fp/2)},{l:"警惕值",v:10+calcMod(wis)},{l:"攻击命中",v:mStr(atkMod)},{l:"法术命中",v:mStr(spellMod)}];


  for(var ri=0;ri<2;ri++){


    var row=(ri===0)?row1:row2;


    for(var ci=0;ci<row.length;ci++){


      battleHtml+="<div class='stat-item'><span class='stat-label'>"+row[ci].l+"</span><span class='stat-value'>"+row[ci].v+"</span></div>";}


  }


  battleHtml+="</div></div>";


  document.getElementById("stat-row").innerHTML=battleHtml;// === 6. Attribute Grid (2 per row, 2-column profs) ===
}

function renderAttrGrid(){


  var g=document.getElementById("attr-grid");var ak=ATTR_NAMES;var ah="";
  var _profDefs=PROF_DEFS;
  for(var ai=0;ai<ak.length;ai++){var av=state.attrs[ak[ai]]||10;var am=calcMod(av);var pf=(state.profs||{})[ak[ai]]||{};var plist=_profDefs[ak[ai]]||[];var half=Math.ceil(plist.length/2);var ph="";
    for(var pi=0;pi<half;pi++){var pn1=plist[pi];var pn2=plist[pi+half];
      ph+='<div style="display:contents">';
      [pn1,pn2].forEach(function(pn){
        if(pn){
          var pv=pf[pn]||0;
          if(pn==="豁免"){ph+='<div class="save-display"><span>豁免</span><span class="save-status">'+(pv>0?pv:'✗')+'</span></div>';}
          else{ph+='<div class="prof-item"><span style="color:var(--ink)">'+pn+'</span><span class="prof-val" style="color:var(--ink)">'+(pv||'-')+'</span></div>';}
        }else{ph+='<div style="min-height:28px"></div>';}
      });
      ph+='</div>';}
    ah+='<div class="attr-box"><div class="attr-main"><div class="attr-name">'+ak[ai]+'</div><div class="attr-value">'+av+'</div><div class="attr-mod">'+mStr(am)+'</div></div><div class="prof-list">'+ph+'</div></div>';}


  g.innerHTML=ah;











}

function renderFeats(){
  // === 7. Feats ===


  var fh="";var hf=false;

  // Render special feats
  for(var sfi=0;sfi<state.special_feats.length;sfi++){
    var sfItem=state.special_feats[sfi];
    var sfName=typeof sfItem==="string"?sfItem:sfItem.name;
    var sfLevel=sfItem.level||"";
    var sfData=SPECIAL_FEATS[sfName];
    if(!sfData) continue;
    var sfDesc=sfData.effects.description||"";
    var sfType=sfData.effects.type;
    var typeLabel="";
    if(sfType!=="description_only"){
      var typeMap={"attribute":"属性","multi":"复合","proficiency":"熟练度","professional":"专业","attribute_health":"属性+生命","health_growth":"生命成长","attribute_proficiency":"属性+熟练","attribute_boost":"属性强化","sp_pack":"技能点","xp_pack":"经验值","armor_ac":"防御","heavy_armor":"重甲防御","extra_slot":"额外槽位","professional_sp":"专业+技能点","panel":"面板加成","description_only":"规则"};
      typeLabel=typeMap[sfType]||sfType;
    }
    fh+='<div class="feat-chip" style="border-left:4px solid #a46d1f;margin-bottom:4px">';
    fh+='<div style="display:flex;align-items:center;gap:6px">';
    if(sfLevel){fh+='<span class="feat-lv">'+sfLevel+'\u7ea7</span>';}
    fh+='<span style="font-weight:bold;color:var(--ink)">'+sfName+'</span>';
    if(typeLabel){fh+='<span style="font-size:11px;background:#a46d1f;color:#fff;padding:1px 6px;border-radius:3px">'+typeLabel+'</span>';}
    fh+='<button onclick="showSpecialFeatDetail(\''+sfName.replace(/'/g,"\\'")+'\')" style="margin-left:auto;padding:1px 8px;font-size:11px;background:#3a5a7a;color:#ddd;border:none;border-radius:4px;cursor:pointer">\ud83d\udcd6 \u8be6\u60c5</button>';
    fh+='<button onclick="removeSpecialFeat(\''+sfName.replace(/'/g,"\\'")+'\')" style="margin-left:4px;background:none;border:none;color:#c06040;cursor:pointer;font-size:14px" title="\u79fb\u9664">\u2715</button>';
    fh+='</div>';
    fh+='</div>';
    hf=true;
  }


  document.getElementById("feat-list").innerHTML=hf?fh:'<span style="color:var(--muted);font-size:15px">暂无</span>';

  // Add special feat toggle button
  var featSection=document.getElementById("feat-list").parentNode;






}

function renderCurrency(){
  // === 8. Currency ===


  var curh="";var ck=Object.keys(state.currency);for(var ci=0;ci<ck.length;ci++){curh+='<div class="currency-item"><span>'+ck[ci]+'</span><span style="font-weight:bold;color:#e8c890;font-size:18px">'+state.currency[ck[ci]]+'</span></div>';}


  document.getElementById("currency-row").innerHTML=curh;





}

function renderWeight(){
  // === 9. Weight (3 tiers) ===


  // 1) Calculate carry capacity from strength + 承重 prof (规则书: str×5/10/15, each 承重 prof = +1 str)


  var carryStr = (state.attrs["力量"] || 8) + ((state.profs["力量"] && state.profs["力量"]["承重"]) || 0);


  var wtReg = carryStr * 5;


  var wtFull = carryStr * 10;


  var wtMax = carryStr * 15;






  var totalWeight = 0;


  var eq = state.equipment || {};


  var slots = ["主手武器", "副手武器", "防具", "配饰", "背包", "杂物包", "旅行腰包"];


  for (var si = 0; si < slots.length; si++) {


    var slotItems = eq[slots[si]] || [];


    for (var ii = 0; ii < slotItems.length; ii++) {


      totalWeight += resolveWeight(slotItems[ii]);


    }


  }


  var matPacks = eq["材料包"] || [];


  for (var mi = 0; mi < matPacks.length; mi++) {


    var packSlot = matPacks[mi] || {};


    var packType = packSlot.type || "";


    var packItems = packSlot.items || [];


    if (packType) totalWeight += resolveWeight(packType);


    for (var mii = 0; mii < packItems.length; mii++) {


      if (packItems[mii]) totalWeight += resolveWeight(packItems[mii]);


    }


  }


  totalWeight = Math.round(totalWeight * 10) / 10;





  // 3) Update state & render


  state.carry_capacity = {"常规": wtReg, "满载": wtFull, "极限": wtMax, "当前": totalWeight};


  var wt = state.carry_capacity;


  // 超限警告（v1.0.7229）：常规/满载/极限 三级
  var _warnHtml = "";
  var _curCls = "weight-current";
  if (totalWeight > wtMax) { _warnHtml = " <span style='color:#c04030;font-weight:bold' title='负重超过极限上限'>⚠ 超极限负重</span>"; _curCls = "weight-current weight-over-max"; }
  else if (totalWeight > wtFull) { _warnHtml = " <span style='color:#d08020;font-weight:bold' title='负重超过满载上限'>⚠ 超满载负重</span>"; _curCls = "weight-current weight-over-full"; }
  else if (totalWeight > wtReg) { _warnHtml = " <span style='color:#c0a030;font-weight:bold' title='负重超过常规上限'>⚠ 超常规负重</span>"; _curCls = "weight-current weight-over-reg"; }
  document.getElementById("weight-block").innerHTML="<span>常规负重: "+wtReg+"kg</span><span>满载负重: "+wtFull+"kg</span><span>极限负重: "+wtMax+"kg</span><span class='"+_curCls+"'>当前负重: "+totalWeight+"kg</span>"+_warnHtml;








}

function renderTalentGrid(){
  // === 10. Talent Tree (6 columns x 5 rows) ===


  var tl=state.talent_tree||[];var tiers=["一阶","二阶","三阶","四阶","五阶","六阶","七阶"];var th="";


  // Build column data: for each tier, collect its talents


  var colData={};for(var ti=0;ti<tiers.length;ti++){


    var col=[];for(var si=0;si<tl.length;si++){if(tl[si].tier===tiers[ti])col.push(tl[si]);}


    colData[tiers[ti]]=col;}


  // Render header row (tier labels)


  th+="<div class='talent-header-row'>";


  for(var ti=0;ti<tiers.length;ti++){th+="<div class='talent-header-cell'>"+tiers[ti]+"</div>";}


  th+="</div>";


  // Render rows of slots (base 5 + any extra_slots / overflow)
  var maxTalentRows = 5;
  for (var tri = 0; tri < tiers.length; tri++) {
    var tCap = getTalentTierlotCap(tiers[tri]);
    var tLen = (colData[tiers[tri]] || []).length;
    if (tCap > maxTalentRows) maxTalentRows = tCap;
    if (tLen > maxTalentRows) maxTalentRows = tLen;
  }

  for(var ri=0;ri<maxTalentRows;ri++){


    th+="<div class='talent-row'>";


    for(var ci=0;ci<tiers.length;ci++){


      var col=colData[tiers[ci]];
      var colCap=getTalentTierlotCap(tiers[ci]);


      if(ri<col.length){var _bd="";if(col[ri].pref){var _ph={"\u6a59\u8272":"#EE822F","\u767d\u8272":"#FFFFFF","\u7d2b\u8272":"#B94BFF","\u9ec4\u8272":"#FFF32F","\u65e0\u8272":"#D9D9D9","\u84dd\u8272":"#00B0F0","\u9752\u8272":"#00FA99","\u9ed1\u8272":"#595959","\u7ea2\u8272":"#FF0000","\u68d5\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u7eff\u8272":"#00B050","\u6d45\u8272":"#B3F9FF"}[col[ri].pref]||"#888";var _pl=["\u767d\u8272","\u9ec4\u8272","\u6d45\u8272","\u9752\u8272","\u65e0\u8272","\u7c89\u8272"].indexOf(col[ri].pref)>=0;_bd=" <span style=font-size:10px;background:"+_ph+";color:"+(_pl?"#1f2522":"#fff")+";padding:1px 4px;border-radius:3px>"+col[ri].pref+"</span>";}th+="<div class='"+"talent-item'>"+col[ri].n+_bd+"</div>";}


      else if(ri<colCap){th+="<div class='talent-slot-empty'>空</div>";}


      else{th+="<div class='talent-slot-empty' style='opacity:0.25'></div>";}


    }


    th+="</div>";}


  if(!th)th="<span style='color:#a08050;font-size:18px'>暂无</span>";


  document.getElementById("talent-grid").innerHTML=th;


}

function renderEquipment(){
      // === 11. Equipment (with stacking) ===


  var eg=document.getElementById("equip-grid");


  var ek=["主手武器","副手武器","防具","配饰","背包","杂物包","旅行腰包","材料包"];


  var totalSlotsMap = {"主手武器":3,"副手武器":4,"防具":2,"配饰":4,"背包":10,"杂物包":10,"旅行腰包":5,"材料包":10};


  var globalSlotIdx = 0;


  var eh="";


  for(var ei=0;ei<ek.length;ei++){


    var it=state.equipment[ek[ei]]||[];


    var totalSlots = totalSlotsMap[ek[ei]] || 10;


    if(ek[ei] === "材料包"){


      var bagData = it;


      var _bagSlots = (typeof BAG_SLOTS !== 'undefined') ? BAG_SLOTS : ['烹饪材料包','垂钓材料包','医用材料包','草药材料包','裁缝材料包','矿石材料包','珠宝材料包','炼金材料包','铭文材料包'];
      for (var pi = 0; pi < _bagSlots.length; pi++) {


        var packSlot = bagData[pi] || {};


        var packType = packSlot.type || "";


        var packItems = packSlot.items || [];


        var hasPack = packType.length > 0;


        var mpLocked=!state.containerItems||!state.containerItems[_bagSlots[pi]];var title = hasPack ? (packType + " (10栏)") : (_bagSlots[pi] + " (10栏)"+(mpLocked?" [未装备]":""));


        eh+="<div class=\'equip-slot\'><div class=\'equip-title\'>" + title + "</div><div class=\'equip-items\'>";


        var compacted = compactStacks(packItems);


        for(var bi=0;bi<10;bi++){


          var stack = null;


          if (bi < compacted.length) { stack = compacted[bi]; }


          if(stack) {
            var displayName = stack.count > 1 ? (stack.item + " \u00d7" + stack.count) : stack.item;
            var wt=stack.weight?' <span class="equip-weight">'+stack.weight.toFixed(1)+'磅</span>':'';
            var extraAttr = stack.count > 1 ? " data-count=\u0022"+stack.count+"\u0022" : "";
            eh+="<div class=\"equip-item\" data-slot=\""+ek[ei]+"\" data-bag-type=\""+packType+"\" data-bag-idx=\""+pi+"\" data-item=\""+stack.item+"\""+extraAttr+">"+displayName+wt+"</div>";


          } else if (hasPack) {


            eh+="<div class=\'equip-empty\' data-slot=\'"+ek[ei]+"\' data-bag-type=\'"+packType+"\' data-bag-idx=\'"+pi+"\' data-item=\'\'>空栏位</div>";


          } else {


            eh+="<div class=\'equip-empty\' data-slot=\'"+ek[ei]+"\' data-bag-type=\'"+packType+"\' data-bag-idx=\'"+pi+"\' data-item=\'\'>未购买</div>";


          }


        }
        eh += "</div></div>";



    


}


    continue;


    }


    var compacted = compactStacks(it);


    var usedSlots = compacted.length;


    var ih= "<div class=\'equip-items\'>";


    for(var si=0;si<totalSlots;si++){


      if(si < usedSlots) {


        var stack = compacted[si];


        var displayName = stack.count > 1 ? (stack.item + " ×" + stack.count) : stack.item;


        var extraAttr = stack.count > 1 ? " data-count=\u0022"+stack.count+"\u0022" : "";


        ih+="<div class=\"equip-item\" data-slot=\""+ek[ei]+"\" data-item=\""+stack.item+"\""+extraAttr+">"+displayName+"</div>";


      } else {


        ih+="<div class=\'equip-empty\' data-slot=\'"+ek[ei]+"\' data-item=\'\'>空栏位</div>";


      }


    }


    ih+="</div>";


    eh+="<div class='equip-slot'><div class='equip-title'>"+ek[ei]+" ("+totalSlots+"栏)"+(isSlotLocked(ek[ei])?" <span style='font-size:11px;color:#c06040;font-weight:normal'>[未装备]</span>":"")+"</div>"+(isSlotLocked(ek[ei])?"<div style='padding:12px;text-align:center;color:#a08050;font-size:12px;font-style:italic'>未装备此容器</div>":ih)+"</div>";}


  eg.innerHTML=eh;





  var allEquip = eg.querySelectorAll(".equip-item, .equip-empty");


  for(var ei2=0; ei2<allEquip.length; ei2++) {


    (function(el) {


      el.onclick = function(e) {
        if (_justDragged) { _justDragged = false; return; }


        var slot = el.getAttribute("data-slot");


        var itemName = el.getAttribute("data-item") || "";


        var count = parseInt(el.getAttribute("data-count")) || 1;


        if (slot === "材料包") { if (!itemName) {


            // Empty slot with bag selected: move from selected to bag


            if (!_selectedEquip) return;


            var from = _selectedEquip;


            var bagType = el.getAttribute("data-bag-type");


            var bagIdx = parseInt(el.getAttribute("data-bag-idx")) || 0;


            clearEquipSelection();


            tryMoveItem(from.slot, from.item, from.count || 1, slot, itemName || null, from.bagIdx, bagIdx);


            return;


          }


          // Selecting from bag


          if (!_selectedEquip) {


            var bagType = el.getAttribute("data-bag-type");


            var bagIdx = parseInt(el.getAttribute("data-bag-idx")) || 0;


            _selectedEquip = {slot: slot, item: itemName, count: count, bagType: bagType, bagIdx: bagIdx};


            el.classList.add("equip-selected");


          } else {


            var from = _selectedEquip;


            var bagType = el.getAttribute("data-bag-type");


            var bagIdx = parseInt(el.getAttribute("data-bag-idx")) || 0;


            clearEquipSelection();


            tryMoveItem(from.slot, from.item, from.count || 1, slot, itemName || null, from.bagIdx, bagIdx);


          }


          return;


        }


        if (!_selectedEquip) {


          if (!itemName) return;


          _selectedEquip = {slot: slot, item: itemName, count: count};


          el.classList.add("equip-selected");


        } else {


          var from = _selectedEquip;


          clearEquipSelection();


          tryMoveItem(from.slot, from.item, from.count || 1, slot, itemName || null, from.bagIdx);


        }


      };
        el.addEventListener("mousedown", gd_mousedown);
        el.addEventListener("contextmenu", gd_contextmenu);


    })(allEquip[ei2]);


  }



}

function renderTraits(){
// === 12. Racial Traits ===
  // Auto-fill from REF_RACES if empty
  if(!state.racial_traits||!state.racial_traits.length){
    var _rd=REF_RACES[state.race];if(_rd&&_rd.talents){state.racial_traits=_rd.talents.map(function(t){return{name:t.name,desc:t.desc};});}
  }

  var rth="";for(var ri=0;ri<state.racial_traits.length;ri++){rth+='<div class="trait-item"><span class="trait-name">'+state.racial_traits[ri].name+'</span>: '+state.racial_traits[ri].desc+'</div>';}


  document.getElementById("racial-traits").innerHTML=rth;





  // === 13. Class Features ===
  // Auto-fill from REF_CLASSES if empty (specializations only, for both main and sub class)
  if(!state.class_features||!state.class_features.length){
    var _feats=[];
    for(var _ci=0;_ci<state.classes.length;_ci++){
      var _cn=state.classes[_ci].name;if(!_cn)continue;
      var _rfc=REF_CLASSES[_cn];if(_rfc&&_rfc.specializations){
        for(var _si=0;_si<_rfc.specializations.length;_si++){
          _feats.push({name:_rfc.specializations[_si].name,desc:_rfc.specializations[_si].desc+"（"+_cn+"）"});
        }
      }
    }
    if(_feats.length>0)state.class_features=_feats;
  }

  var cfh="";for(var ci=0;ci<state.class_features.length;ci++){cfh+='<div class="trait-item"><span class="trait-name">'+state.class_features[ci].name+'</span>: '+state.class_features[ci].desc+'</div>';}


  document.getElementById("class-features").innerHTML=cfh;





}

function renderLangProfs(){
  // === 14. Languages ===


  var lh="";for(var li=0;li<state.languages.length;li++){lh+='<span class="lang-tag">『'+state.languages[li]+'』</span>';}


  document.getElementById("lang-list").innerHTML=lh;





  // === 15. Professionals ===


  var ph2="";for(var pi=0;pi<state.professionals.length;pi++){ph2+='<span class="prof-tag">'+state.professionals[pi]+'</span>';}
  if(state.custom_profs){for(var cpn in state.custom_profs){if(state.custom_profs[cpn]>0)ph2+='<span class="prof-tag">'+cpn+'+'+state.custom_profs[cpn]+'</span>';}}


  document.getElementById("prof-list").innerHTML=ph2;

  // Weapon proficiency section
  var mainClass=(state.classes&&state.classes[0])?state.classes[0].name:"";
  var wp=resolveWeaponProfs(mainClass).slice();
  if(state.weapon_profs){
    for(var wpk in state.weapon_profs){
      if(state.weapon_profs[wpk]>0 && wp.indexOf(wpk)<0) wp.push(wpk);
    }
  }
  var wh="";
  for(var wi=0;wi<wp.length;wi++){
    var wbonus=(state.weapon_prof_bonus&&state.weapon_prof_bonus[wp[wi]])?state.weapon_prof_bonus[wp[wi]]:0;
    wh+='<span class="weapon-tag">'+wp[wi]+(wbonus?'+'+wbonus:'')+'</span>';
  }
  if(state.weapon_prof_bonus){
    for(var wbk in state.weapon_prof_bonus){
      if(state.weapon_prof_bonus[wbk]>0 && wp.indexOf(wbk)<0){
        wh+='<span class="weapon-tag">'+wbk+'+'+state.weapon_prof_bonus[wbk]+'</span>';
      }
    }
  }
  if(state.armor_profs){
    for(var apk in state.armor_profs){
      if(state.armor_profs[apk]>0) wh+='<span class="weapon-tag">'+apk+'</span>';
    }
  }
  if(state.weapon_specs&&state.weapon_specs.length){
    wh+='<span style="font-size:13px;color:var(--muted);margin:0 6px">|</span>';
    for(var wsi=0;wsi<state.weapon_specs.length;wsi++){
      var cat=state.weapon_specs[wsi];
      var bonus=WEAPON_SPEC_BONUSES[cat]||"";
      wh+='<span class="weapon-spec-tag">⭐'+cat+(bonus?'（'+bonus+'）':'')+'</span>';
    }
  }
  var we=document.getElementById("weapon-profs");if(we)we.innerHTML=wh;





}

function renderSkillTables(){
  // === 16. Skill Tables ===

  normalizeAllSkillSubs();

  var mainSkills=state.skills.filter(isMainSkillOccupant);
  var freeMainSkills=state.skills.filter(function(s){return !isSubSkillTagged(s)&&!isBlueprintName(s.n||s.name)&&isFreeSlotSkill(s);});


  


  var subSkills=state.skills.filter(isSubSkillOccupant);


  var skillHtml="";
  for(var fsi=0;fsi<freeMainSkills.length;fsi++){
    var fs=freeMainSkills[fsi];
    var fsStyle=getSkillStyle(fs.n,fs.src);var fsSrc=fsStyle?' <span class="skill-sub">('+fsStyle+')</span>':"";
    var fsGrant=fs.grantedBy?' <span class="skill-sub">['+fs.grantedBy+']</span>':' <span class="skill-sub">[免费]</span>';
    var fstm=getSkillField(fs.n,fs.src,"施展时间");var fsds=getSkillField(fs.n,fs.src,"description");var fsdr=getSkillField(fs.n,fs.src,"疲劳消耗");var fsrange=getSkillField(fs.n,fs.src,"施展距离");var fsdur=getSkillField(fs.n,fs.src,"持续时间");
    skillHtml+='<tr><td><span class="skill-name">'+fs.n+'</span>'+fsSrc+fsGrant+'</td><td>'+(fstm||'—')+'</td><td>'+skillDescCell(fsds,state.classes[0].name,fs.n)+'</td><td>'+(fsdr?fsdr:'—')+'</td><td>'+(fsrange||'—')+'</td><td>'+(fsdur||'—')+'</td></tr>';
  }
  var mainSlots=calcSkillSlots(0);for(var ski=0;ski<mainSlots;ski++){var s=mainSkills[ski]||null;


    if(s){var sStyle=getSkillStyle(s.n,s.src);var src=sStyle?' <span class="skill-sub">('+sStyle+')</span>':"";var stm=getSkillField(s.n,s.src,"施展时间");var sds=getSkillField(s.n,s.src,"description");var sdr=getSkillField(s.n,s.src,"疲劳消耗");var srange=getSkillField(s.n,s.src,"施展距离");var sdur=getSkillField(s.n,s.src,"持续时间");skillHtml+='<tr><td><span class="skill-name">'+s.n+'</span>'+src+'</td><td>'+(stm||'—')+'</td><td>'+skillDescCell(sds,state.classes[0].name,s.n)+'</td><td>'+(sdr?sdr:'—')+'</td><td>'+(srange||'—')+'</td><td>'+(sdur||'—')+'</td></tr>';}


    else{skillHtml+='<tr class="empty-slot"><td><span style="color:#906840;font-style:italic">空栏位</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';}}


  document.getElementById("skill-table-body").innerHTML=skillHtml;
  document.getElementById("mainSkillTitle").innerHTML="主职业技能列表 ("+calcSkillSlots(0)+"栏)"+(freeMainSkills.length?" · 另含免费 "+freeMainSkills.length:" ");


   


  var subSkillHtml="";var subSlots=calcSkillSlots(1);for(var sski=0;sski<subSlots;sski++){var ss=subSkills[sski]||null;


    if(ss){var sStyle=getSkillStyle(ss.n,ss.src);var src=sStyle?' <span class="skill-sub">('+sStyle+')</span>':"";var sstm=getSkillField(ss.n,ss.src,"施展时间");var ssds=getSkillField(ss.n,ss.src,"description");var ssdr=getSkillField(ss.n,ss.src,"疲劳消耗");var ssrange=getSkillField(ss.n,ss.src,"施展距离");var ssdur=getSkillField(ss.n,ss.src,"持续时间");subSkillHtml+='<tr><td><span class="skill-name">'+ss.n+'</span>'+src+'</td><td>'+(sstm||'—')+'</td><td>'+skillDescCell(ssds,ss.sub,ss.n)+'</td><td>'+(ssdr?ssdr:'—')+'</td><td>'+(ssrange||'—')+'</td><td>'+(ssdur||'—')+'</td></tr>';}


    else{subSkillHtml+='<tr class="empty-slot"><td><span style="color:#906840;font-style:italic">\u7a7a\u680f\u4f4d</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';}}


document.getElementById("sub-skill-table-body").innerHTML=subSkillHtml;
  document.getElementById("subSkillTitle").innerHTML="子职业技能列表 ("+calcSkillSlots(1)+"栏)";

}

function renderBlueprints(){
  // === Blueprints (professional slots) ===
  ensureBlueprintState();
  var _bpUsed = state.blueprints.length;
  var _bpCap = calcBlueprintSlots();
  var _bpOver = _bpUsed > _bpCap;
  var _bpTitle = document.getElementById("blueprintTitle");
  if (_bpTitle) {
    _bpTitle.innerHTML = "图纸（专业槽位） 占用 <span style=\"" + (_bpOver ? "color:#c0392b;font-weight:bold" : "") + "\">" + _bpUsed + "</span> · 规则上限 " + _bpCap + " · 格子 " + BLUEPRINT_EXPORT_SLOTS;
  }
  var _bpHint = document.getElementById("blueprintHint");
  if (_bpHint) {
    _bpHint.innerHTML = "不占技能/天赋槽；规则上限 = 10+智力调整" + (sumExtraProfessionalSlotsFromFeats() ? " +独具匠心" : "") + (state.blueprint_bonus_slots ? " +手动" + state.blueprint_bonus_slots : "") + "。<a href=\"javascript:void(0)\" onclick=\"editBlueprintBonusSlots()\" style=\"color:#a46d1f\">编辑手动加成</a>";
  }
  var _bpGrid = document.getElementById("blueprint-grid");
  if (_bpGrid) {
    var _bph = "", _bpi, _bpe;
    for (_bpi = 0; _bpi < BLUEPRINT_EXPORT_SLOTS; _bpi++) {
      _bpe = state.blueprints[_bpi];
      if (_bpe) {
        _bph += "<div class=\"blueprint-slot filled\" title=\"" + (_bpe.src || "") + "\"><span class=\"blueprint-name\">" + (_bpe.n || _bpe.name) + "</span><button type=\"button\" class=\"blueprint-del\" onclick=\"removeBlueprintSlot(" + _bpi + ")\" title=\"移除\">×</button></div>";
      } else {
        _bph += "<div class=\"blueprint-slot empty\" onclick=\"addBlueprintManual()\" title=\"添加图纸\">+</div>";
      }
    }
    _bpGrid.innerHTML = _bph;
  }
}

function addBlueprintManual() {
  var name = prompt("输入图纸名称（建议以（图纸）结尾）");
  if (!name) return;
  name = String(name).trim();
  if (!name) return;
  if (!isBlueprintName(name)) name = name + "（图纸）";
  var res = addBlueprintEntry({ id: "", n: name, src: "手动", tier: "", note: "" });
  if (!res.ok) { SB_toast(res.reason || "添加失败"); return; }
  render();
}

function removeBlueprintSlot(idx) {
  if (!confirm("移除该图纸？")) return;
  removeBlueprintAt(idx);
  render();
}

function editBlueprintBonusSlots() {
  ensureBlueprintState();
  var cur = state.blueprint_bonus_slots || 0;
  var v = prompt("手动专业槽位加成（如万用模组等，不含独具匠心）", String(cur));
  if (v === null) return;
  var n = parseInt(v, 10);
  if (isNaN(n)) { SB_toast("请输入数字"); return; }
  state.blueprint_bonus_slots = n;
  render();
}

function cheatAdd(){
  var old=document.getElementById('_cheatPanel');
  if(old){old.remove();return;}
  var overlay=document.createElement('div');overlay.id='_cheatPanel';
  overlay.style.cssText='position:fixed;bottom:80px;left:30px;z-index:10000;background:var(--panel,#fffdf8);border:2px solid var(--accent,#a46d1f);border-radius:12px;padding:20px 24px;max-width:380px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.25);animation:fadeInUp 0.3s ease-out;font-size:14px;color:var(--ink,#1f2522);max-height:80vh;overflow-y:auto';
  
  var h='<h3 style="margin:0 0 4px;font-size:18px">🧪 测试加点</h3>';
  h+='<p style="font-size:12px;color:var(--muted,#69706b);margin:0 0 12px">快速增加经验值与技能点</p>';
  
  // XP section
  var xp=(state.xp||0);
  h+='<div style="margin-bottom:16px;padding:12px;background:var(--bg,#f6f4ef);border-radius:8px">';
  h+='<div style="font-weight:bold;margin-bottom:8px">⭐ 经验值 ('+xp+')</div>';
  h+='<div style="display:flex;gap:8px;align-items:center">';
  h+='<button onclick="_cheatAdjXP(-100)" style="padding:6px 14px;font-size:16px;background:#c06040;color:#fff;border:none;border-radius:6px;cursor:pointer">-100</button>';
  h+='<button onclick="_cheatAdjXP(-500)" style="padding:6px 14px;font-size:16px;background:#c06040;color:#fff;border:none;border-radius:6px;cursor:pointer">-500</button>';
  h+='<input id="_cheatXP" type="number" min="0" value="'+xp+'" onchange="_cheatSetXP(this.value)" style="flex:1;width:60px;padding:6px;text-align:center;border:1px solid var(--line,#d8d2c4);border-radius:6px;font-size:14px;background:var(--panel,#fffdf8);color:var(--ink,#1f2522)">';
  h+='<button onclick="_cheatAdjXP(500)" style="padding:6px 14px;font-size:16px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer">+500</button>';
  h+='<button onclick="_cheatAdjXP(100)" style="padding:6px 14px;font-size:16px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer">+100</button>';
  h+='</div></div>';
  
  // SP + marks section
  ensureSpState();
  var spTotal=getSpTotal();
  h+='<div style="margin-bottom:12px;padding:12px;background:var(--bg,#f6f4ef);border-radius:8px">';
  h+='<div style="font-weight:bold;margin-bottom:8px">💎 技能点 ('+spTotal+')</div>';
  h+='<div style="display:flex;gap:8px;align-items:center">';
  h+='<button onclick="_cheatAdjSPPoints(-1)" style="padding:6px 14px;font-size:16px;background:#c06040;color:#fff;border:none;border-radius:6px;cursor:pointer">-1</button>';
  h+='<input id="_cheatSPPoints" type="number" min="0" value="'+spTotal+'" onchange="_cheatSetSPPoints(this.value)" style="flex:1;width:60px;padding:6px;text-align:center;border:1px solid var(--line,#d8d2c4);border-radius:6px;font-size:14px;background:var(--panel,#fffdf8);color:var(--ink,#1f2522)">';
  h+='<button onclick="_cheatAdjSPPoints(1)" style="padding:6px 14px;font-size:16px;background:#4caf50;color:#fff;border:none;border-radius:6px;cursor:pointer">+1</button>';
  h+='</div></div>';
  h+='<div style="margin-bottom:8px;font-weight:bold">🎨 色彩标识（点击切换）</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  for(var ci=0;ci<MARK_COLOR_NAMES.length;ci++){
    var c=MARK_COLOR_NAMES[ci];var on=hasColorMark(c);
    h+='<button data-mark-color="'+c+'" onclick="_cheatToggleMark(\''+c+'\')" style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--bg,#f6f4ef);border:1px solid '+(on?'var(--accent,#a46d1f)':'var(--line,#d8d2c4)')+';border-radius:6px;cursor:pointer;opacity:'+(on?'1':'0.65')+'">';
    h+='<span style="width:14px;height:14px;border-radius:50%;background:'+MARK_COLOR_HEX[c]+';border:1px solid rgba(0,0,0,0.2)"></span>';
    h+='<span style="font-size:12px;color:var(--ink)">'+c+'</span></button>';
  }
  h+='</div>';
  h+='<button onclick="document.getElementById(\'_cheatPanel\').remove();render()" style="margin-top:12px;width:100%;padding:8px;background:var(--accent,#a46d1f);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">✅ 确认并刷新面板</button>';
  
  overlay.innerHTML=h;
  document.body.appendChild(overlay);
  
  // Close on click outside
  setTimeout(function(){
    document.addEventListener('click',function _c(e){
      if(!overlay.contains(e.target)&&e.target!==document.querySelector('button[onclick*=\"cheatAdd\"]')){
        overlay.remove();document.removeEventListener('click',_c);
      }
    });
  },100);
}

function _cheatRefreshPanel(){
  var overlay=document.getElementById('_cheatPanel');
  if(!overlay)return;
  ensureSpState();
  var spTotal=getSpTotal();
  var spInp=document.getElementById('_cheatSPPoints');
  if(spInp)spInp.value=spTotal;
  var marks=overlay.querySelectorAll('[data-mark-color]');
  for(var i=0;i<marks.length;i++){
    var c=marks[i].getAttribute('data-mark-color');
    var on=hasColorMark(c);
    marks[i].style.opacity=on?'1':'0.65';
    marks[i].style.borderColor=on?'var(--accent,#a46d1f)':'var(--line,#d8d2c4)';
  }
}
function _cheatAdjXP(delta){state.xp=Math.max(0,(state.xp||0)+delta);var inp=document.getElementById('_cheatXP');if(inp)inp.value=state.xp;}
function _cheatSetXP(val){state.xp=Math.max(0,parseInt(val)||0);var inp=document.getElementById('_cheatXP');if(inp)inp.value=state.xp;}
function _cheatAdjSPPoints(delta){ensureSpState();state.sp_points=Math.max(0,(state.sp_points||0)+delta);_cheatRefreshPanel();render();}
function _cheatSetSPPoints(val){ensureSpState();state.sp_points=Math.max(0,parseInt(val)||0);_cheatRefreshPanel();render();}
function _cheatToggleMark(color){ensureSpState();state.color_marks[color]=!state.color_marks[color];_cheatRefreshPanel();}
function toggleLearnMode() {


  var panel = document.getElementById("learnPanel");


  var btn = document.getElementById("learnToggle");


  if (!panel || !btn) return;


  if (panel.classList.contains("show")) {


    panel.classList.remove("show"); panel.style.display = "none";


    btn.innerHTML = "📚 学习技能";


  } else {


    try { renderLearnPanel(); panel.style.display = ""; panel.classList.add("show"); btn.innerHTML = "✕ 关闭"; }


    catch(e) { panel.innerHTML = "<div style='padding:20px;color:#e06060'>Error: " + e.message + "</div>"; panel.style.display = "block"; }


  }


}


function onLearnSearchInput() {


  // Just store the search value and re-render the panel


  // The input itself is preserved (not recreated)


  renderLearnPanel();


}


function renderLearnPanel() {


  var panel = document.getElementById("learnPanel"); if (!panel) return;


  var searchQ = window._learnSearchQ || "";


  searchQ = searchQ.toLowerCase();


  


  // === Build toolbar (search + buttons) ONCE if not exists ===


  var toolbar = document.getElementById("learnToolbar");


  if (!toolbar) {


    toolbar = document.createElement("div");


    toolbar.id = "learnToolbar";


    panel.appendChild(toolbar);


    // Build SP overview


    var spOverview = document.createElement("div");


    spOverview.id = "learnSPOverview";


    spOverview.style.cssText = "margin-bottom:10px;padding:8px 12px;background:#2d2722;border-radius:8px";


    ensureSpState();


    spOverview.innerHTML = renderMarkOverviewHtml();


    toolbar.appendChild(spOverview);


    // Search bar + buttons


    var searchRow = document.createElement("div");


    searchRow.style.cssText = "margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap";


    var input = document.createElement("input");


    input.id = "learnSearch";


    input.type = "text";


    input.placeholder = "\u641c\u7d22\u6280\u80fd\u540d\u79f0/\u5173\u952e\u8bcd...";


    input.style.cssText = "flex:1;min-width:120px;padding:6px 10px;border-radius:5px;border:1px solid #5a3a18;background:#2d2722;color:#f0e0d0;font-size:13px";


    input.oninput = function() {


      window._learnSearchQ = this.value;


      if (_learnSearchTimer) clearTimeout(_learnSearchTimer);
      _learnSearchTimer = setTimeout(function() { renderLearnResults(); }, 150);


    };


    searchRow.appendChild(input);


    var expandBtn = document.createElement("button");


    expandBtn.textContent = "\u5c55\u5f00\u5168\u90e8";


    expandBtn.onclick = expandAllGroups;


    expandBtn.style.cssText = "padding:5px 10px;font-size:12px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer";


    searchRow.appendChild(expandBtn);


    var resetBtn = document.createElement("button");


    resetBtn.textContent = "\u91cd\u7f6e\u975e\u9501\u5b9a\u6280\u80fd";


    resetBtn.onclick = function() { if(confirm("\u786e\u5b9a\u8981\u91cd\u7f6e\u6240\u6709\u975e\u9501\u5b9a\u6280\u80fd\u5417\uff1f")) batchResetSkills(); };


    resetBtn.style.cssText = "padding:5px 10px;font-size:12px;background:#8a3a2a;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer";


    searchRow.appendChild(resetBtn);


    toolbar.appendChild(searchRow);


    // Create results container


    var results = document.createElement("div");


    results.id = "learnResults";


    toolbar.appendChild(results);


  }


  


  // === Re-render only the results part ===


  renderLearnResults();


}






function renderLearnResults() {
  var results = document.getElementById("learnResults");
  if (!results) return;
  var searchQ = window._learnSearchQ || "";
  searchQ = searchQ.toLowerCase();
  var html = "";

  // Update SP overview counts
  var spOverview = document.getElementById("learnSPOverview");
  if (spOverview) {
    ensureSpState();
    spOverview.innerHTML = renderMarkOverviewHtml();
  }

  // Initialize collapsed state
  if (!window._learnCollapsed) { window._learnCollapsed = {}; }

  // Helper: check if tier is unlocked

  // === CLASS SKILLS ===
  var tierOrder = ["\u4e00\u9636","\u4e8c\u9636","\u4e09\u9636","\u56db\u9636","\u4e94\u9636","\u516d\u9636","\u4e03\u9636","\u516b\u9636","\u4e5d\u9636"];

  for (var ci = 0; ci < state.classes.length; ci++) {
    var clsName = state.classes[ci].name;
    if (!clsName) continue;
    var clsData = SKILL_DATA[clsName]; if (!clsData) continue;
    var isSub = (ci === 1);
    var clsKey = clsName + "_" + ci;

    // Group skills by style -> tier
    var groups = {};
    for (var si = 0; si < clsData.length; si++) {
      var skill = clsData[si];
      if (isLearnPanelStartingSkill(clsName, skill)) continue;
      var learned = false; var crossLocked = false;
      if (isBlueprintName(skill.name)) {
        var bps = state.blueprints || [];
        for (var bi = 0; bi < bps.length; bi++) { if ((bps[bi].n || bps[bi].name) === skill.name) { learned = true; break; } }
      } else if (skill.tags && skill.tags.indexOf("\u5929\u8d4b") >= 0) {
        var tt = state.talent_tree || [];
        for (var ti = 0; ti < tt.length; ti++) { if (tt[ti].n === skill.name && (!tt[ti].cls || tt[ti].cls === clsName)) { learned = true; break; } if (tt[ti].n === skill.name && tt[ti].cls && tt[ti].cls !== clsName) { crossLocked = true; } }
      } else {
        var sl = state.skills;
        for (var ssi = 0; ssi < sl.length; ssi++) { if (sl[ssi].n === skill.name && sl[ssi].src === clsName) { learned = true; break; } if (sl[ssi].n === skill.name && sl[ssi].src !== clsName) { crossLocked = true; } }
      }
      var styleName = canonicalSkillStyle(skill.style || "\u901a\u7528");
      if (searchQ && skill.name.toLowerCase().indexOf(searchQ) < 0 && styleName.toLowerCase().indexOf(searchQ) < 0 && (skill.tags || []).join(" ").toLowerCase().indexOf(searchQ) < 0 && (skill.tier || "").toLowerCase().indexOf(searchQ) < 0) continue;
      if (!groups[styleName]) groups[styleName] = {};
      var tierName = normalizeTierName(skill.tier || "\u901a\u7528");
      if (!groups[styleName][tierName]) groups[styleName][tierName] = [];
      groups[styleName][tierName].push({skill: skill, learned: learned, crossLocked: crossLocked});
    }
    if (Object.keys(groups).length === 0) continue;

    html += "<div style=\"margin-bottom:14px;background:#2d2722;border-radius:8px;padding:10px 12px;border:1px solid #4a3520\">";
    html += "<div style=\"font-size:15px;color:#e8a86a;font-weight:bold;margin-bottom:8px\">" + clsName + (isSub ? " <span style=\"font-size:12px;color:#b09070;font-weight:normal\">(\u5b50\u804c\u4e1a)</span>" : "") + "</div>";

    var styleOrder = Object.keys(groups).sort();
    for (var gi = 0; gi < styleOrder.length; gi++) {
      var styleName = styleOrder[gi];
      var tierGroups = groups[styleName];
      var styleKey = clsKey + "_" + styleName;

      // Collapsed state for style
      var styleCollapsed = true;
      if (window._learnCollapsed && window._learnCollapsed[styleKey] !== undefined) {
        styleCollapsed = window._learnCollapsed[styleKey];
      } else {
        if (!window._learnCollapsed) window._learnCollapsed = {};
        window._learnCollapsed[styleKey] = true;
        styleCollapsed = true;
      }

      // Collect all skills in this style across all tiers
      var allItems = [];
      var tierNames = Object.keys(tierGroups).sort(function(a,b){
        var ai = tierOrder.indexOf(a);
        var bi = tierOrder.indexOf(b);
        return (ai>=0?ai:999) - (bi>=0?bi:999);
      });
      for (var tni = 0; tni < tierNames.length; tni++) {
        allItems = allItems.concat(tierGroups[tierNames[tni]]);
      }

      html += "<div style=\"margin:4px 0;border:1px solid #4a3520;border-radius:6px;overflow:hidden;background:#25201a\">";
      html += "<div onclick=\"toggleCollapse('" + styleKey.replace(/'/g,"\\u0027") + "')\" style=\"padding:6px 10px;background:#3d3020;font-size:13px;color:#d0b898;cursor:pointer;display:flex;justify-content:space-between;align-items:center\">";
      html += "<span><span style=\"color:#e8a86a;font-weight:bold\">" + styleName + "</span> <span style=\"color:#b09070;font-size:11px\">(" + allItems.length + "\u4e2a\u6280\u80fd)</span></span>";
      html += "<span style=\"font-size:11px;color:#b09070\">" + (styleCollapsed ? "\u25b6 \u5c55\u5f00" : "\u25bc \u6536\u8d77") + "</span></div>";

      if (!styleCollapsed) {
        // Render each tier sub-group within this style
        for (var tni = 0; tni < tierNames.length; tni++) {
          var tn = tierNames[tni];
          var items = tierGroups[tn];
          if (!items || items.length === 0) continue;

          var tierUnlocked = isTierUnlocked(tn);
          var tierLabel = tn ? normalizeTierName(tn) : "\u901a\u7528";

          // Tier header row
          html += "<div style=\"margin:4px 0;padding:4px 8px;background:#2a2218;border-left:2px solid " + (tierUnlocked ? "#6a9a4a" : "#8a4a3a") + ";border-radius:3px;display:flex;justify-content:space-between;align-items:center\">";
          html += "<span style=\"font-size:12px;color:" + (tierUnlocked ? "#b0d0a0" : "#b08060") + ";font-weight:bold\">[" + tierLabel + "]</span>";
          if (!tierUnlocked) {
            if (hasTierUnlockCost(tn)) {
              var cost = getTierUnlockCost(tn);
              var minLevel = getTierMinLevel(tn);
              html += "<button onclick=\"unlockTier('" + normalizeTierName(tn) + "')\" style=\"font-size:11px;padding:3px 10px;background:#6a4a2a;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer\">\u82b1\u8d39" + cost + "\u7ecf\u9a8c(\u9700" + minLevel + "\u7ea7)" + "\u89e3\u9501</button>";
            } else {
              html += "<span style=\"font-size:11px;color:#8a5a4a\">\u9636\u4f4d\u6570\u636e\u5f02\u5e38</span>";
            }
          }
          html += "</div>";

          if (tierUnlocked) {
            // Render skills in this tier
            for (var ii = 0; ii < items.length; ii++) {
              var skill = items[ii].skill;
              var learned = items[ii].learned;
              var crossLocked = items[ii].crossLocked;
              var isTalent = skill.tags && skill.tags.indexOf("\u5929\u8d4b") >= 0;
              var stLabel = skill.tier ? "<span style=\"font-size:11px;color:#8a7a6a;margin-right:6px\">[" + skill.tier.replace("\u5929\u8d4b\u6811","") + "]</span>" : "";
              html += "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:5px 8px;margin:2px 4px;border-radius:4px;background:" + (learned ? "#2a3a2a" : crossLocked ? "#1a1a1a" : "#2d2722") + ";border:1px solid " + (learned ? "#3a5a3a" : crossLocked ? "#2a2020" : "#3d3020") + "\">";
              html += "<span style=\"font-size:13px;color:" + (learned ? "#7ab87a" : crossLocked ? "#6a5a4a" : "#f0e0d0") + "\">" + stLabel + skill.name + " <span style=\"font-size:10px;color:#8a7a6a\">(" + clsName + ")</span>" + (typeof spDot === "function" ? spDot(skill) : "") + "</span>";
              html += "<span style=\"display:flex;gap:4px;align-items:center\">";
              if (isTalent) html += "<span style=\"font-size:11px;color:#daa520;font-weight:bold;padding:2px 6px;background:#3a3020;border-radius:3px;border:1px solid #6a5020\">\u5929\u8d4b</span>";
              html += "<button onclick=\"showSkillDetail('" + clsName + "','" + skill.name.replace(/'/g,"\\u0027") + "')\" style=\"font-size:11px;padding:2px 8px;background:#4a6a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u8be6\u60c5</button>";
              if (learned) {
                html += "<button onclick=\"confirmUnlearn('" + clsName + "','" + skill.name.replace(/'/g,"\\u0027") + "'," + ci + ")\" style=\"font-size:11px;padding:2px 8px;background:#6a3a2a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u53d6\u6d88</button>";
              } else if (crossLocked) {
                html += "<span style=\"font-size:10px;color:#8a5a4a;font-weight:bold\">[\u5df2\u88ab\u540c\u540d\u6280\u80fd\u9501\u5b9a]</span>";
              } else {
                html += "<button onclick=\"learnSkill('" + clsName + "','" + skill.name.replace(/'/g,"\\u0027") + "'," + ci + ")\" style=\"font-size:11px;padding:2px 8px;background:#3a5a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u5b66\u4e60</button>";
              }
              html += "</span></div>";
            }
          }
        }
      }
      html += "</div>";
    }
    html += "</div>";
  }

  // === UNIVERSAL SKILLS ===
  var genData = SKILL_DATA["\u901a\u7528"];

  
  if (genData) {
    var genGroups = {};
    for (var si = 0; si < genData.length; si++) {
      var skill = genData[si];
      var learned = false;
      var tt = state.talent_tree || [];
      for (var ti = 0; ti < tt.length; ti++) { if (tt[ti].n === skill.name) { learned = true; break; } }
      var groupName = skill.tier || "\u901a\u7528\u5929\u8d4b\u6811";
      if (searchQ && skill.name.toLowerCase().indexOf(searchQ) < 0 && groupName.toLowerCase().indexOf(searchQ) < 0 && (skill.tags || []).join(" ").toLowerCase().indexOf(searchQ) < 0) continue;
      if (!genGroups[groupName]) genGroups[groupName] = [];
      genGroups[groupName].push({skill: skill, learned: learned});
    }
    window._renderedChoiceGroups = {};
            window._renderedChoiceSkills = {};
              if (Object.keys(genGroups).length > 0) {
      html += "<div style=\"margin-bottom:14px;background:#2d2722;border-radius:8px;padding:10px 12px;border:1px solid #4a3520\">";
      html += "<div style=\"font-size:15px;color:#e8a86a;font-weight:bold;margin-bottom:8px\">\u901a\u7528\u5929\u8d4b\u6811</div>";
      var tierOrder2 = ["\u4e00\u9636\u5929\u8d4b\u6811","\u4e8c\u9636\u5929\u8d4b\u6811","\u4e09\u9636\u5929\u8d4b\u6811","\u56db\u9636\u5929\u8d4b\u6811","\u4e94\u9636\u5929\u8d4b\u6811","\u516d\u9636\u5929\u8d4b\u6811","\u4e03\u9636\u5929\u8d4b\u6811"];
      var styleOrder = Object.keys(genGroups).sort(function(a,b){
        var ai = tierOrder2.indexOf(a);
        var bi = tierOrder2.indexOf(b);
        return (ai>=0?ai:999) - (bi>=0?bi:999);
      });
      for (var gi = 0; gi < styleOrder.length; gi++) {
        var groupName = styleOrder[gi];
        var items = genGroups[groupName];
        var key = "\u901a\u7528_" + groupName;
        var styleCollapsed = true;
        if (window._learnCollapsed && window._learnCollapsed[key] !== undefined) {
          styleCollapsed = window._learnCollapsed[key];
        } else {
          if (!window._learnCollapsed) window._learnCollapsed = {};
          window._learnCollapsed[key] = true;
          styleCollapsed = true;
        }

        // Check tier unlock
        var tierName = normalizeTierName(groupName);
        var tierUnlocked = isTierUnlocked(tierName);

        html += "<div style=\"margin:4px 0;border:1px solid #4a3520;border-radius:6px;overflow:hidden;background:#25201a\">";
        html += "<div onclick=\"toggleCollapse('" + key.replace(/'/g,"\\u0027") + "')\" style=\"padding:6px 10px;background:#3d3020;font-size:13px;color:#d0b898;cursor:pointer;display:flex;justify-content:space-between;align-items:center\">";
        html += "<span><span style=\"color:#e8a86a;font-weight:bold\">" + tierName + "</span> <span style=\"color:#b09070;font-size:11px\">(" + items.length + "\u4e2a\u6280\u80fd)</span></span>";
        html += "<span style=\"font-size:11px;color:#b09070\">" + (styleCollapsed ? "\u25b6 \u5c55\u5f00" : "\u25bc \u6536\u8d77") + "</span></div>";

        if (!styleCollapsed) {
          if (!tierUnlocked) {
            html += "<div style=\"padding:10px;text-align:center;background:#2a2218\">";
            if (hasTierUnlockCost(tierName)) {
              var cost = getTierUnlockCost(tierName);
              var minLevel = getTierMinLevel(tierName);
              html += "<button onclick=\"unlockTier('" + tierName + "')\" style=\"font-size:13px;padding:5px 16px;background:#6a4a2a;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer\">\u82b1\u8d39" + cost + "\u7ecf\u9a8c(\u9700" + minLevel + "\u7ea7)" + "\u89e3\u9501\u8be5\u9636\u4f4d</button>";
            } else {
              html += "<span style=\"font-size:12px;color:#8a5a4a\">\u9636\u4f4d\u6570\u636e\u5f02\u5e38</span>";
            }
            html += "</div>";
          } else {
            for (var ii = 0; ii < items.length; ii++) {
              var skill = items[ii].skill;
              var skillName = skill.name;
              if (skillName.indexOf("\u6289\u62e9") >= 0) {
                var prefix = skillName.indexOf("\u00b7") >= 0 ? skillName.split("\u00b7")[0] : skillName;
                for (var cgi2 = 0; cgi2 < CHOICE_GROUPS.length; cgi2++) {
                  if (CHOICE_GROUPS[cgi2].cls && CHOICE_GROUPS[cgi2].cls !== "通用") continue;
                  var marker = CHOICE_GROUPS[cgi2].marker;
                  if (marker && (marker === prefix || marker.indexOf(prefix) === 0 || prefix.indexOf(marker) === 0)) {
                    if (!window._renderedChoiceGroups) window._renderedChoiceGroups = {};
                    if (!window._renderedChoiceGroups[marker]) {
                      window._renderedChoiceGroups[marker] = true;
                      var cg = CHOICE_GROUPS[cgi2];
                      var learnedCount = 0;
                      var tt = state.talent_tree || [];
                      for (var tti3 = 0; tti3 < tt.length; tti3++) {
                        for (var csi3 = 0; csi3 < cg.skills.length; csi3++) {
                          if (tt[tti3].n === cg.skills[csi3]) { learnedCount++; break; }
                        }
                      }
                      html += "<div style=\"margin:8px 0 4px 0;padding:5px 10px;background:#3d3020;border-left:3px solid #e8a86a;border-radius:3px\">";
                      html += "<span style=\"font-size:12px;color:#e8a86a;font-weight:bold\">" + cg.marker + "</span>";
                      html += "<span style=\"font-size:11px;color:#b09070;margin-left:6px\">" + cg.rule + "</span>";
                      html += "<span style=\"font-size:11px;color:#8a7a6a;margin-left:8px\">(\u5df2\u9009 " + learnedCount + "/" + cg.max + ")</span>";
                      html += "</div>";
                      for (var si3 = 0; si3 < items.length; si3++) {
                        var s3 = items[si3].skill;
                        var s3Name = s3.name;
                        if (cg.skills.indexOf(s3Name) >= 0) {
                          if (!window._renderedChoiceSkills) window._renderedChoiceSkills = {};
                          window._renderedChoiceSkills[s3Name] = true;
                          var s3Learned = false;
                          var tt3 = state.talent_tree || [];
                          for (var ti3 = 0; ti3 < tt3.length; ti3++) { if (tt3[ti3].n === s3Name) { s3Learned = true; break; } }
                          var s3Locked = !s3Learned && learnedCount >= cg.max;
                          var bg3 = s3Learned ? "#2a3a2a" : (s3Locked ? "#1a1a1a" : "#2d2722");
                          var bd3 = s3Learned ? "#3a5a3a" : (s3Locked ? "#2a2020" : "#3d3020");
                          var tc3 = s3Learned ? "#7ab87a" : (s3Locked ? "#6a5a4a" : "#f0e0d0");
                          html += "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:5px 8px;margin:2px 4px;border-radius:4px;background:" + bg3 + ";border:1px solid " + bd3 + "\">";
                          html += "<span style=\"font-size:13px;color:" + tc3 + "\">" + s3Name + (typeof spDot === "function" ? spDot(s3) : "") + (s3Locked ? " <span style=\"font-size:10px;color:#8a5a4a;font-weight:bold\">[\u5df2\u8fbe\u4e0a\u9650\u9501\u5b9a]</span>" : "") + "</span>";
                          html += "<span style=\"display:flex;gap:4px;align-items:center\">";
                          if (s3.tags && s3.tags.indexOf("\u5929\u8d4b") >= 0) html += "<span style=\"font-size:11px;color:#daa520;font-weight:bold;padding:2px 6px;background:#3a3020;border-radius:3px;border:1px solid #6a5020\">\u5929\u8d4b</span>";
                          html += "<button onclick=\"showSkillDetail('\u901a\u7528','" + s3.name.replace(/'/g,"\\u0027") + "')\" style=\"font-size:11px;padding:2px 8px;background:#4a6a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u8be6\u60c5</button>";
                          if (s3Learned) {
                            html += "<button onclick=\"confirmUnlearnTalent('\u901a\u7528','" + s3.name.replace(/'/g,"\\u0027") + "',-1)\" style=\"font-size:11px;padding:2px 8px;background:#6a3a2a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u53d6\u6d88</button>";
                          } else if (!s3Locked) {
                            html += "<button onclick=\"learnSkill('\u901a\u7528','" + s3.name.replace(/'/g,"\\u0027") + "',-1)\" style=\"font-size:11px;padding:2px 8px;background:#3a5a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u5b66\u4e60</button>";
                          }
                          html += "</span></div>";
                        }
                      }
                    }
                  }
                }
              }
            }
            // Check if there are standalone skills to render
            var _hasStandalone = false;
            for (var _ci = 0; _ci < items.length; _ci++) {
              var _cn = items[_ci].skill.name;
              if (_cn.indexOf("\u6289\u62e9") >= 0) continue;
              if (window._renderedChoiceSkills && window._renderedChoiceSkills[_cn]) continue;
              _hasStandalone = true;
              break;
            }
            if (_hasStandalone) {
              html += "<div style=\"margin:10px 0 4px 0;padding:4px 8px;border-top:1px solid #4a3520;font-size:12px;color:#8a7a6a\">\u5176\u4ed6\u6280\u80fd</div>";
            }
            for (var ii2 = 0; ii2 < items.length; ii2++) {
              var skill2 = items[ii2].skill;
              var learned2 = items[ii2].learned;
              var skillName2 = skill2.name;
              if (skillName2.indexOf("\u6289\u62e9") >= 0) continue;
              if (window._renderedChoiceSkills && window._renderedChoiceSkills[skillName2]) continue;
              var groupLocked = false;
              var cgParent = null;
              for (var cgi = 0; cgi < CHOICE_GROUPS.length; cgi++) {
                if (CHOICE_GROUPS[cgi].cls && CHOICE_GROUPS[cgi].cls !== clsName && CHOICE_GROUPS[cgi].cls !== "通用") continue;
                for (var csi = 0; csi < CHOICE_GROUPS[cgi].skills.length; csi++) {
                  if (CHOICE_GROUPS[cgi].skills[csi] === skillName2) { cgParent = CHOICE_GROUPS[cgi]; break; }
                }
                if (cgParent) break;
              }
              if (cgParent && !learned2) {
                var learnedCount2 = 0;
                var tt2 = state.talent_tree || [];
                for (var tti2 = 0; tti2 < tt2.length; tti2++) {
                  for (var csi2 = 0; csi2 < cgParent.skills.length; csi2++) {
                    if (tt2[tti2].n === cgParent.skills[csi2]) { learnedCount2++; break; }
                  }
                }
                if (learnedCount2 >= cgParent.max) groupLocked = true;
              }
              var bgColor2 = learned2 ? "#2a3a2a" : (groupLocked ? "#1a1a1a" : "#2d2722");
              var borderColor2 = learned2 ? "#3a5a3a" : (groupLocked ? "#2a2020" : "#3d3020");
              var textColor2 = learned2 ? "#7ab87a" : (groupLocked ? "#6a5a4a" : "#f0e0d0");
              var isTalent2 = skill2.tags && skill2.tags.indexOf("\u5929\u8d4b") >= 0;
              html += "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:5px 8px;margin:2px 4px;border-radius:4px;background:" + bgColor2 + ";border:1px solid " + borderColor2 + "\">";
              html += "<span style=\"font-size:13px;color:" + textColor2 + "\">" + skillName2 + (typeof spDot === "function" ? spDot(skill2) : "") + (groupLocked ? " <span style=\"font-size:10px;color:#8a5a4a;font-weight:bold\">[\u5df2\u8fbe\u4e0a\u9650\u9501\u5b9a]</span>" : "") + "</span>";
              html += "<span style=\"display:flex;gap:4px;align-items:center\">";
              if (isTalent2) html += "<span style=\"font-size:11px;color:#daa520;font-weight:bold;padding:2px 6px;background:#3a3020;border-radius:3px;border:1px solid #6a5020\">\u5929\u8d4b</span>";
              html += "<button onclick=\"showSkillDetail('\u901a\u7528','" + skill2.name.replace(/'/g,"\\u0027") + "')\" style=\"font-size:11px;padding:2px 8px;background:#4a6a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u8be6\u60c5</button>";
              if (learned2) {
                html += "<button onclick=\"confirmUnlearnTalent('\u901a\u7528','" + skill2.name.replace(/'/g,"\\u0027") + "',-1)\" style=\"font-size:11px;padding:2px 8px;background:#6a3a2a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u53d6\u6d88</button>";
              } else if (!groupLocked) {
                html += "<button onclick=\"learnSkill('\u901a\u7528','" + skill2.name.replace(/'/g,"\\u0027") + "',-1)\" style=\"font-size:11px;padding:2px 8px;background:#3a5a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer\">\u5b66\u4e60</button>";
              }
              html += "</span></div>";
            }
          }
        }
        html += "</div>";
      }
      html += "</div>";
    }
  }

results.innerHTML = html;

  // Mark state as dirty for auto-save
  state._dirty = true;
}

// 猎人守护联动：技能 <-> 天赋 学习其一自动获得另一个
var GUARD_LINK = {
  "灵龟守护": "灵龟守护·天赋", "灵猴守护": "灵猴守护·天赋", "灵狐守护": "灵狐守护·天赋",
  "灵龟守护·天赋": "灵龟守护", "灵猴守护·天赋": "灵猴守护", "灵狐守护·天赋": "灵狐守护"
};
// \u8054\u52a8\u8f85\u52a9\uff1a\u5b66\u4e60\u5176\u4e00\u81ea\u52a8\u83b7\u5f97\u53e6\u4e00\u4e2a\uff08\u514d\u8d39\uff09\uff0c\u9000\u5b66\u540c\u6b65\u79fb\u9664
function guardLinkSkill(skillName, clsName, isSub, isLocked, slotClsIdx) {
  var _glk = GUARD_LINK[skillName];
  if (!_glk) return;
  var _clsData = SKILL_DATA[clsName];
  if (!_clsData) return;
  var _sl = state.skills.slice();
  if (_sl.some(function(_x){ return _x.n === _glk; })) return;
  var _ms = calcSkillSlots(slotClsIdx);
  var _oc = listOccupiedSkills(slotClsIdx);
  if (_oc.length >= _ms) { SB_toast("\u6280\u80fd\u680f\u5df2\u6ee1\uff0c\u65e0\u6cd5\u8054\u52a8\u83b7\u5f97" + _glk + "\uff1b\u53ef\u5148\u5378\u8f7d\u4e00\u4e2a\u6280\u80fd"); return; }
  for (var _li = 0; _li < _clsData.length; _li++) {
    if (_clsData[_li].name === _glk) {
      _sl.push(buildSkillListEntry(_clsData[_li], clsName, isSub, isLocked));
      state.skills = _sl;
      break;
    }
  }
}
function guardLinkTalent(skillName, clsName, isSub, isLocked) {
  var _glt = GUARD_LINK[skillName];
  if (!_glt || _glt.indexOf("\u00b7\u5929\u8d4b") < 0) return;
  var _clsData = SKILL_DATA[clsName];
  if (!_clsData) return;
  var _tl2 = state.talent_tree || [];
  if (_tl2.some(function(_x){ return _x.n === _glt; })) return;
  var _tcap = getTalentTierlotCap("\u4e8c\u9636");
  var _cnt2 = 0;
  for (var _ti2 = 0; _ti2 < _tl2.length; _ti2++) { if (_tl2[_ti2].tier === "\u4e8c\u9636") _cnt2++; }
  if (_cnt2 >= _tcap) { SB_toast("\u4e8c\u9636\u5929\u8d4b\u680f\u5df2\u6ee1\uff0c\u65e0\u6cd5\u8054\u52a8\u83b7\u5f97" + _glt + "\uff1b\u53ef\u5148\u5378\u8f7d\u4e00\u4e2a\u4e8c\u9636\u5929\u8d4b"); return; }
  for (var _gi2 = 0; _gi2 < _clsData.length; _gi2++) {
    if (_clsData[_gi2].name === _glt) {
      _tl2.push({id:_clsData[_gi2].id, n:_glt, cls:clsName, tier:"\u4e8c\u9636", sub:isSub, locked:isLocked});
      state.talent_tree = _tl2;
      break;
    }
  }
}
function guardUnlinkTalent(skillName) {
  var _glu = GUARD_LINK[skillName];
  if (!_glu || _glu.indexOf("\u00b7\u5929\u8d4b") < 0) return;
  var _tt2 = state.talent_tree || [];
  for (var _ti3 = 0; _ti3 < _tt2.length; _ti3++) {
    if (_tt2[_ti3].n === _glu) {
      if (_tt2[_ti3].locked) { SB_toast(_glu + " \u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u968f\u6280\u80fd\u79fb\u9664"); return; }
      _tt2.splice(_ti3, 1); break;
    }
  }
  state.talent_tree = _tt2;
}
function guardUnlinkSkill(skillName) {
  var _gls = GUARD_LINK[skillName];
  if (!_gls || _gls.indexOf("\u00b7\u5929\u8d4b") >= 0) return;
  var _sl2 = state.skills;
  for (var _si2 = 0; _si2 < _sl2.length; _si2++) {
    if (_sl2[_si2].n === _gls) {
      if (_sl2[_si2].locked) { SB_toast(_gls + " \u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u968f\u5929\u8d4b\u79fb\u9664"); return; }
      _sl2.splice(_si2, 1); break;
    }
  }
  state.skills = _sl2;
}


function learnSkill(clsName, skillName, clsIdx) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var isSub = (clsIdx === 1);
  var slotClsIdx = resolveSkillSlotClsIdx(clsIdx);
  // 通用等负索引：按主职栏占用，写入 sub:""
  if (clsIdx !== 1) isSub = false;


  var desc = (skillData.description || []).join(" ");


  var isLocked = desc.indexOf("\u65e0\u6cd5") >= 0 && (desc.indexOf("\u4fee\u6539") >= 0 || desc.indexOf("\u8986\u76d6") >= 0 || desc.indexOf("\u66ff\u6362") >= 0);


  // Handle composite skills: grants sub-skills directly to skill list


  if (skillData.type === "composite") {


    var grants = skillData.grants || [];


    var skillList = state.skills;


    for (var gi = 0; gi < grants.length; gi++) {


      // Check if already in list


      var already = false;


      for (var sj = 0; sj < skillList.length; sj++) {


        if (skillList[sj].n === grants[gi]) { already = true; break; } }


      if (already) continue;


      // Find the skill data for this granted skill


      var gData = null;


      for (var gc in SKILL_DATA) {


        var gs = SKILL_DATA[gc];


        for (var gsi = 0; gsi < gs.length; gsi++) {


          if (gs[gsi].name === grants[gi]) { gData = gs[gsi]; break; } }


        if (gData) break; }


      if (!gData) continue;


      // Check if has enough slots (granted skills take slots too)


      var skillSlots = calcSkillSlots(slotClsIdx);
      var currentInSlot = countOccupiedSkillSlots(slotClsIdx);


      if (currentInSlot >= skillSlots) { SB_toast("\u6280\u80fd\u680f\u4f4d\u4e0d\u8db3\uff0c\u65e0\u6cd5\u83b7\u5f97" + grants[gi]); continue; }


      // Add the granted skill


      skillList.push({id: gData.id, n: gData.name, src: clsName,


        tm: gData.fields ? (gData.fields["\u65bd\u5c55\u65f6\u95f4"] || "") : "",


        ds: (gData.description || [""]).join(""), dr: gData.fields ? (gData.fields["\u7591\u52b3\u6d88\u8017"] || "") : "",


        range: gData.fields ? (gData.fields["\u65bd\u5c55\u8ddd\u79bb"] || "") : "",


        dur: gData.fields ? (gData.fields["\u6301\u7eed\u65f6\u95f4"] || "") : "",


        cost: "", sub: isSub ? clsName : "", locked: false, granted: true}); }


    state.skills = skillList;


    autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();


    return;


  }


  if (isBlueprintName(skillData.name)) {
    var _bpRes;
    if (!payForSkill(skillData)) return;
    _bpRes = addBlueprintEntry({ id: skillData.id, n: skillData.name, src: clsName, tier: skillData.tier || "", note: "" });
    if (!_bpRes.ok) {
      refundSkillPoint(skillData);
      SB_toast(_bpRes.reason || "无法学习图纸");
      return;
    }
    autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
    return;
  }

  if (skillData.name === "\u5173\u952e\u504f\u597d") {
    var _isSub2=isSub; var _clsName2=clsName; var _tier2=skillData.tier||"\u4e00\u9636";
    showKeyPreferencePicker(function(prefColor){
      if (!payForSkill(skillData)) return;
      var _tl=state.talent_tree||[]; _tl.push({id:skillData.id,n:skillData.name,cls:_clsName2,tier:_tier2.replace("\u5929\u8d4b\u6811",""),sub:_isSub2,pref:prefColor});
      state.talent_tree=_tl; applyChoiceBProfBonus(skillData.name,true); applyChoiceLMasteryBonus(skillData.name,true); applyMeditationSP(skillData.name,true);
      autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
    });
    return;
  }
  if ((skillData.tags && skillData.tags.indexOf("天赋") >= 0)||(skillData.tier&&skillData.fields&&!skillData.fields["施展时间"])) {


    var tl=state.talent_tree||[];var tier=skillData.tier||"一阶";
    var _st=tier.replace("\u5929\u8d4b\u6811","");


    var countInTier=0;for(var ti=0;ti<tl.length;ti++){if(tl[ti].tier===_st)countInTier++;}

    var _tierCap=getTalentTierlotCap(_st);
    if(countInTier>=_tierCap){SB_toast(_st+"\u5929\u8d4b\u680f\u5df2\u6ee1\uff08\u6700\u591a"+_tierCap+"\u4e2a\uff09");return;}


    // Check duplicate talent


    var dupFound = false; var crossLocked = false;


    for (var ti = 0; ti < tl.length; ti++) { if (tl[ti].n === skillData.name && (!tl[ti].cls || tl[ti].cls === clsName)) { dupFound = true; break; } if (tl[ti].n === skillData.name && tl[ti].cls && tl[ti].cls !== clsName) { crossLocked = true; } }


    if (dupFound) { SB_toast("\u8be5\u5929\u8d4b\u6280\u80fd\u5df2\u5b66\u4e60\uff0c\u65e0\u6cd5\u91cd\u590d\u5b66\u4e60"); return; } if (crossLocked) { SB_toast("\u8be5\u6280\u80fd\u5df2\u88ab\u5176\u4ed6\u804c\u4e1a\u7684\u540c\u540d\u5929\u8d4b\u9501\u5b9a"); return; }

    // 磨炼技艺: pick a proficiency before completing learn
    if (skillData.name === "磨炼技艺") {
      showFeatProfChoice("磨炼技艺", [], function(profChoice) {
        if (!payForSkill(skillData)) return;
        var entry = {id:skillData.id,n:skillData.name,cls:clsName,tier:tier.replace("天赋树",""),sub:isSub,locked:isLocked,profChoice:profChoice};
        tl.push(entry);
        state.talent_tree=tl;
        if (profChoice.custom) bumpCustomProf(profChoice.custom, 1);
        else if (profChoice.attr && profChoice.key) bumpProf(profChoice.attr, profChoice.key, 1);
        applyChoiceBProfBonus(skillName,true); applyChoiceLMasteryBonus(skillName,true); applyMeditationSP(skillName,true);
        applyUniversalTalentBonus(skillName,true,entry);
        state._dirty=true;
        autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
      });
      return;
    }

    if (!payForSkill(skillData)) return;


    var talentEntry={id:skillData.id,n:skillData.name,cls:clsName,tier:tier.replace("天赋树",""),sub:isSub,locked:isLocked};
    tl.push(talentEntry);


    state.talent_tree=tl; applyChoiceBProfBonus(skillName,true); applyChoiceLMasteryBonus(skillName,true); applyMeditationSP(skillName,true);
    applyUniversalTalentBonus(skillName,true,talentEntry);
    guardLinkSkill(skillName, clsName, isSub, isLocked, slotClsIdx);
    state._dirty=true;
    // 六阶天赋「潜在专长」：获得第 4 个特殊专长（获取方式：4级/8级/13级/潜在专长，v1.0.7237）
    if (skillData.name === "潜在专长") {
      if ((state.special_feats || []).length < 4) {
        showSpecialFeatSelector();
      } else {
        SB_toast("已获取全部 4 个特殊专长");
      }
    }


  } else {


    var maxSlots = calcSkillSlots(slotClsIdx); var skillList = state.skills.slice(); var clsSkills = listOccupiedSkills(slotClsIdx);


var crossLocked = false; for (var si = 0; si < skillList.length; si++) { if (skillList[si].n === skillName && skillList[si].src === clsName) { SB_toast("\u5df2\u5b66\u4e60\u8be5\u6280\u80fd"); return; } if (skillList[si].n === skillName && skillList[si].src !== clsName) { crossLocked = true; } } if (crossLocked) { SB_toast("\u8be5\u6280\u80fd\u5df2\u88ab\u5176\u4ed6\u804c\u4e1a\u7684\u540c\u540d\u6280\u80fd\u9501\u5b9a"); return; }


    if (clsSkills.length > maxSlots) {
      var overflow = clsSkills.length - maxSlots;
      SB_toast("技能栏超出上限 " + overflow + " 个，请先替换或卸载多余技能");
      var allLockedOv = true; for (var oi = 0; oi < clsSkills.length; oi++) { if (!clsSkills[oi].locked) { allLockedOv = false; break; } }
      if (allLockedOv) { SB_toast("\u6240\u6709\u6280\u80fd\u5747\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u66ff\u6362"); return; }
      showReplaceModal(skillData.name, clsSkills, skillList, maxSlots, {skillData: skillData, clsName: clsName, isSub: isSub, isLocked: isLocked}); return;
    }


    if (clsSkills.length >= maxSlots) {


      var allLocked = true; for (var si = 0; si < clsSkills.length; si++) { if (!clsSkills[si].locked) { allLocked = false; break; } }


      if (allLocked) { SB_toast("\u6240\u6709\u6280\u80fd\u5747\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u66ff\u6362"); return; }


      var msg = "\u6280\u80fd\u5217\u8868\u5df2\u6ee1\uff01\u8bf7\u9009\u62e9\u8981\u66ff\u6362\u7684\u6280\u80fd\u7f16\u53f7 (1-" + maxSlots + "):\\n";


      for (var si = 0; si < clsSkills.length; si++) { msg += (si+1) + ". " + clsSkills[si].n + (clsSkills[si].locked ? " [\u9501\u5b9a]" : "") + "\\n"; }


      showReplaceModal(skillData.name, clsSkills, skillList, maxSlots, {skillData: skillData, clsName: clsName, isSub: isSub, isLocked: isLocked}); return; }


    if (!payForSkill(skillData)) return;


    skillList.push(buildSkillListEntry(skillData, clsName, isSub, isLocked));


    state.skills = skillList; }
    guardLinkTalent(skillName, clsName, isSub, isLocked);


  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }


function expandAllGroups() { window._learnCollapsed = {}; renderLearnPanel(); }


function collapseAllGroups() { 


  window._learnCollapsed = {};


  // Set all groups to collapsed


  renderLearnResults(); 


  // Auto-collapse all by re-initializing


  var results = document.getElementById("learnResults");


  if (results) { window._learnCollapsed = {}; renderLearnResults(); }


}


function toggleCollapse(key) {


  window._learnCollapsed = window._learnCollapsed || {};


  window._learnCollapsed[key] = !(window._learnCollapsed[key] || false);


  renderLearnPanel(); }



function unlockTier(tierName) {
  tierName = normalizeTierName(tierName);
  var info = TIER_UNLOCK_COST[tierName];
  if (!info) { SB_toast("该阶位不需要解锁"); return; }
  var cost = info.cost;
  var minLevel = info.minLevel || 99;
  var maxLv = getMaxLevel();
  if (maxLv < minLevel) { SB_toast("当前最高职业等级为" + maxLv + "级，需要主职业达到" + minLevel + "级才能解锁" + tierName + "天赋树"); return; }
  if (cost > state.xp) { SB_toast("经验值不足，需要" + cost + "点经验值（当前拥有" + state.xp + "点）"); return; }
  if (!confirm("确定要花费" + cost + "点经验值解锁" + tierName + "天赋树吗？当前经验值：" + state.xp + "点")) return;
  state.xp -= cost;
  if (!state.unlocked_tiers) state.unlocked_tiers = ["一阶","二阶"];
  if (state.unlocked_tiers.indexOf(tierName) < 0) state.unlocked_tiers.push(tierName);
  renderLearnPanel();
  render();
  SB_toast("解锁成功！已解锁" + tierName + "天赋树");
}
function confirmUnlearn(clsName, skillName, clsIdx) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var desc = formatSkillDetailHtml(skillData);


  showSkillPreview(skillName, skillData.style || clsName, skillData.tier || "", desc, function() {
    if (isBlueprintName(skillName)) unlearnBlueprint(clsName, skillName);
    else unlearnSkill(clsName, skillName, clsIdx);
  }); }


function unlearnSkill(clsName, skillName, clsIdx) {


  var skillList = state.skills;


  var idx = -1;


  for (var i = 0; i < skillList.length; i++) { if (skillList[i].n === skillName) { idx = i; break; } }


  if (idx < 0) return;


  if (skillList[idx].locked) { SB_toast("\u8be5\u6280\u80fd\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u53d6\u6d88\u5b66\u4e60"); return; }


  // Return SP


  var clsData = SKILL_DATA[clsName]; 


  if (clsData) {


    var sd = null; for (var si = 0; si < clsData.length; si++) { if (clsData[si].name === skillName) { sd = clsData[si]; break; } }


    if (sd) {


      refundSkillPoint(sd);


    }


  }


  skillList.splice(idx, 1);
  state.skills = skillList;
  guardUnlinkTalent(skillName);


  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }






function unlearnBlueprint(clsName, skillName) {
  ensureBlueprintState();
  var idx = -1, i, sd = null, clsData;
  for (i = 0; i < state.blueprints.length; i++) {
    if ((state.blueprints[i].n || state.blueprints[i].name) === skillName) { idx = i; break; }
  }
  if (idx < 0) return;
  clsData = SKILL_DATA[clsName];
  if (clsData) {
    for (i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { sd = clsData[i]; break; } }
    if (sd) refundSkillPoint(sd);
  }
  state.blueprints.splice(idx, 1);
  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
}

function unlearnTalent(clsName, skillName, clsIdx) {


  var tt = state.talent_tree || [];


  var idx = -1;


  for (var i = 0; i < tt.length; i++) {


    if (tt[i].n === skillName && (!tt[i].cls || tt[i].cls === clsName)) { idx = i; break; } }


  if (idx < 0) return;


  if (tt[idx].locked) { SB_toast("\u8be5\u5929\u8d4b\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u53d6\u6d88\u5b66\u4e60"); return; }


  // Return SP


  var clsData = SKILL_DATA[clsName]; 


  if (clsData) {


    var sd = null; for (var si = 0; si < clsData.length; si++) { if (clsData[si].name === skillName) { sd = clsData[si]; break; } }


    if (sd) {


      refundSkillPoint(sd);


    }


  }


  var removedTalent = tt[idx];
  tt.splice(idx, 1);
  guardUnlinkSkill(skillName);


  state.talent_tree = tt; applyChoiceBProfBonus(skillName,false); applyChoiceLMasteryBonus(skillName,false); applyMeditationSP(skillName,false);
  if (removedTalent && removedTalent.profChoice) {
    var pc = removedTalent.profChoice;
    if (pc.custom) bumpCustomProf(pc.custom, -1);
    else if (pc.attr && pc.key) bumpProf(pc.attr, pc.key, -1);
  }
  applyUniversalTalentBonus(skillName,false,removedTalent);
  state._dirty=true;

  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }





function confirmUnlearnTalent(clsName, skillName, clsIdx) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var desc = formatSkillDetailHtml(skillData);


  showSkillPreview(skillName, skillData.style || clsName, skillData.tier || "", desc, function() {


    unlearnTalent(clsName, skillName, clsIdx); }); }


function batchResetSkills() {


  // Search across ALL SKILL_DATA classes to find skill cost


  function findSkillDataAcrossClasses(skillName) {


    for (var cls in SKILL_DATA) {


      var arr = SKILL_DATA[cls];


      for (var si = 0; si < arr.length; si++) {


        if (arr[si].name === skillName) return arr[si];


      }


    }


    return null;


  }


  // Return SP for all unlocked skills before removing them


  for (var i = 0; i < state.skills.length; i++) {


    if (!state.skills[i].locked) {


      var sd = findSkillDataAcrossClasses(state.skills[i].n);


      if (sd) {


        refundSkillPoint(sd);


      }


    }


  }


  var kept = [];


  for (var i = 0; i < state.skills.length; i++) { if (state.skills[i].locked) kept.push(state.skills[i]); }


  state.skills = kept;


  state.forbidden_skills = [];


  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }


function showReplaceModal(newName, clsSkills, skillList, maxSlots, pendingLearn) {


  closeReplaceModal();


  var overlay = document.createElement("div");


  overlay.id = "modalOverlay";


  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";


  document.body.appendChild(overlay);


  var html = "<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";


  html += "<div style='font-size:16px;color:#e8a86a;font-weight:bold;margin-bottom:12px'>\u9009\u62e9\u8981\u66ff\u6362\u7684\u6280\u80fd</div>";


  html += "<div style='font-size:13px;color:#b09070;margin-bottom:10px'>\u6280\u80fd\u5217\u8868\u5df2\u6ee1\uff01\u8bf7\u9009\u62e9\u8981\u66ff\u6362\u7684\u6280\u80fd (" + newName + "):</div>";


  for (var bi = 0; bi < clsSkills.length; bi++) {


    html += "<button onclick='" + (clsSkills[bi].locked ? "" : "doReplace(" + bi + ");") + "' style='display:block;width:100%;padding:8px 12px;margin:4px 0;background:" + (clsSkills[bi].locked ? "#3d3530" : "#3a5030") + ";color:#f0e0d0;border:1px solid #5a3a18;border-radius:6px;cursor:" + (clsSkills[bi].locked ? "not-allowed" : "pointer") + ";text-align:left;font-size:13px'" + (clsSkills[bi].locked ? " disabled" : "") + ">" + (bi+1) + ". " + clsSkills[bi].n + (clsSkills[bi].locked ? " [\u9501\u5b9a]" : "") + "</button>"; }


  html += "<button onclick='closeReplaceModal()' style='width:100%;padding:8px;margin-top:10px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer;font-size:13px'>\u53d6\u6d88</button></div>";


  overlay.innerHTML = html;


  overlay.style.display = "flex";


  window._replaceData = {clsSkills: clsSkills, skillList: skillList, maxSlots: maxSlots, pendingLearn: pendingLearn || null}; }


function closeReplaceModal() {


  var overlay = document.getElementById("modalOverlay");


  if (overlay) { overlay.parentNode.removeChild(overlay); } }


function doReplace(idx) {


  var data = window._replaceData;


  if (!data) return;


  var clsSkills = data.clsSkills; var skillList = data.skillList;


  if (clsSkills[idx].locked) { SB_toast("\u8be5\u6280\u80fd\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u66ff\u6362"); return; }


  var removed = clsSkills[idx];


  var removedData = findSkillDataAcrossClasses(removed.n);


  if (removedData) refundSkillPoint(removedData);


  var removedId = removed.id;


  state.forbidden_skills = state.forbidden_skills || [];


  state.forbidden_skills.push(removedId);


  for (var si = 0; si < skillList.length; si++) { if (skillList[si].id === removedId) { skillList.splice(si, 1); break; } }


  var pending = data.pendingLearn;


  if (pending) {


    if (!payForSkill(pending.skillData)) { closeReplaceModal(); render(); return; }


    skillList.push(buildSkillListEntry(pending.skillData, pending.clsName, pending.isSub, pending.isLocked));


    state.skills = skillList;


    autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();


  }


  closeReplaceModal(); }





function showSkillDetail(clsName, skillName) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var desc = formatSkillDetailHtml(skillData);showSkillPreview(skillName, skillData.style || clsName, skillData.tier || "", desc, null, clsName); }





function showSkillDetailFromAll(skillName, clsName) {


  // Search all SKILL_DATA for a skill by name (同名技能优先精确职业)

  if (clsName && SKILL_DATA[clsName]) {
    var _cArr = SKILL_DATA[clsName];
    for (var _ci = 0; _ci < _cArr.length; _ci++) {
      if (_cArr[_ci].name === skillName) {
        var _sd2 = _cArr[_ci];
        var _desc2 = formatSkillDetailHtml(_sd2);
        showSkillPreview(skillName, _sd2.style || clsName, _sd2.tier || "", _desc2, null, clsName);
        return;
      }
    }
  }

  for (var cls in SKILL_DATA) {


    var skills = SKILL_DATA[cls];


    for (var si = 0; si < skills.length; si++) {


      if (skills[si].name === skillName) {


        var sd = skills[si];


        var desc = formatSkillDetailHtml(sd);


        showSkillPreview(skillName, sd.style || cls, sd.tier || "", desc, null);


        return;


      }


    }


  }


}


function showSkillPreview(name, style, tier, desc, onConfirm, clsName) {


  closeReplaceModal();


  var overlay = document.createElement("div");


  overlay.id = "modalOverlay";


  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";


  document.body.appendChild(overlay);


  var html = "<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:450px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";


  html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px'>";


  html += "<div><span style='font-size:18px;color:#e8a86a;font-weight:bold'>" + name + "</span>";


  html += "<span style='font-size:12px;color:#b09070;margin-left:8px'>[" + style + " / " + tier + "]</span>"; if(clsName){html+="<span style='font-size:11px;color:#6a8a6a;margin-left:6px'>(" + clsName + ")</span>";} html += "</div>";


  html += "<button onclick='closeReplaceModal()' style='background:none;border:none;color:#888;font-size:20px;cursor:pointer'>&times;</button></div>";


  html += "<div style='font-size:13px;color:#ddd;line-height:1.6;padding:10px;background:#1f1a16;border-radius:6px;margin-bottom:14px;max-height:300px;overflow-y:auto'>" + desc + "</div>";


  html += "<div style='display:flex;gap:8px;justify-content:flex-end'>";


  html += "<button onclick='closeReplaceModal()' style='padding:8px 16px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer'>\u53d6\u6d88</button>";


  if (onConfirm) {


    window._previewCallback = onConfirm;


    html += "<button onclick='closeReplaceModal();window._previewCallback()' style='padding:8px 16px;background:#4a8;color:#fff;border:none;border-radius:6px;cursor:pointer'>\u786e\u8ba4\u53d6\u6d88\u5b66\u4e60</button>";


  }


  html += "</div></div>";


  overlay.innerHTML = html;


  overlay.style.display = "flex"; }



function showLevelUpModal(clsIdx){
  var cl=state.classes[clsIdx];
  if(!cl||!cl.name)return;
  var nextLv=cl.level+1;
  var tbl=LEVEL_TABLE[clsIdx===1?"子职业":"主职业"];
  var data=tbl[nextLv];
  if(!data){SB_toast("已达最高等级");return;}
  if(clsIdx===1){
    var maxSub=getMaxSubLevel();
    if(nextLv>maxSub){SB_toast("子职业等级不可超过主职业等级-5，请先提升主职业等级");return;}
  }
  if(state.xp<data.xp){SB_toast("经验值不足");return;}

  var overlay=document.createElement("div");
  overlay.id="modalOverlay";
  overlay.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";
  document.body.appendChild(overlay);

  var html="<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";
  html+='<div style="font-size:18px;color:#e8a86a;font-weight:bold;margin-bottom:12px">'+cl.name+' Lv.'+nextLv+' 升级奖励</div>';

  var rewards=[];
  if(data.prof>0)rewards.push("熟练度 +"+data.prof);
  if(data.attr>0)rewards.push("属性值 +"+data.attr);
  if(data.slot>0)rewards.push("技能槽位 +"+data.slot);
  if(data.notes)rewards.push(data.notes);
  if(data.special==="feat")rewards.push("获取一项特殊专长");

  html+='<div style="margin-bottom:14px">';
  for(var ri=0;ri<rewards.length;ri++){
    html+='<div style="padding:5px 10px;margin:4px 0;background:#1f1a16;border-radius:4px;font-size:13px;color:#ddd">'+'▸ '+rewards[ri]+'</div>';
  }
  html+='</div>';

  html+='<div style="display:flex;gap:8px;justify-content:flex-end">';
  html+='<button onclick="closeReplaceModal()" style="padding:8px 16px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer">取消</button>';
  html+='<button onclick="applyLevelUp('+clsIdx+')" style="padding:8px 16px;background:#3a7a3a;color:#fff;border:none;border-radius:6px;cursor:pointer">确认升级</button>';
  html+='</div></div>';

  overlay.innerHTML=html;
}

function applyLevelUp(clsIdx){
  var cl=state.classes[clsIdx];
  if(!cl||!cl.name)return;
  var nextLv=cl.level+1;
  if(clsIdx===1){
    var maxSub=getMaxSubLevel();
    if(nextLv>maxSub){SB_toast("子职业等级不可超过主职业等级-5，请先提升主职业等级");closeReplaceModal();return;}
  }
  var tbl=LEVEL_TABLE[clsIdx===1?"子职业":"主职业"];
  var data=tbl[nextLv];
  if(!data||state.xp<data.xp)return;
  if(!window._pendingLevelUp||window._pendingLevelUp.level!==nextLv){window._pendingLevelUp={clsIdx:clsIdx,level:nextLv,_done:{}};}
  var _done=window._pendingLevelUp._done;

  // Apply skill slot
  if(data.slot>0){
    // Slots are managed via skill list length - no explicit change needed
  }

  // Apply proficiency
  if(data.prof>0&&!_done._prof){
    showProfChoice(clsIdx,nextLv);
    return;
  }

  // Apply attribute
  if(data.attr>0&&!_done._attr){
    showAttrChoice(clsIdx,nextLv);
    return;
  }

  // Add special feat
  if(data.special==="feat"&&!_done._feat){
    showSpecialFeatSelector();
    // If user closes selector without picking a feat, allow retry by not marking _feat as done
    return;
  }

  if(data.special==="lowest_attr"){
    applyLowestAttr(clsIdx,nextLv);
    return;
  }

  // Direct apply for non-choice rewards
  finalizeLevelUp(clsIdx,nextLv);
  closeReplaceModal();
}

function finalizeLevelUp(clsIdx,level){
  var cl=state.classes[clsIdx];
  var tbl=LEVEL_TABLE[clsIdx===1?"子职业":"主职业"];
  var usedXP=tbl[level]?tbl[level].xp:0;
  if(usedXP>0)state.xp-=usedXP;
  if(state.xp<0)state.xp=0;
  cl.level=level;
  ensureClaimedLevels();
  if(!state.claimed_levels[clsIdx])state.claimed_levels[clsIdx]=[];
  if(state.claimed_levels[clsIdx].indexOf(level)<0)
    state.claimed_levels[clsIdx].push(level);
    // Main: 三阶+ need XP spend (TIER_UNLOCK_COST) — do not auto-add
    // Sub: notes「自动开启…N阶」→ free unlock
  var notes = tbl[level] ? tbl[level].notes || "" : "";
  var tierMatch = notes.match(/(一|二|三|四|五|六|七|八|九)阶/);
  if (tierMatch) {
    var tierName = normalizeTierName(tierMatch[0]);
    var shouldAuto = false;
    if (clsIdx === 1 && /自动开启/.test(notes)) {
      shouldAuto = true;
    } else if (clsIdx === 0 && !hasTierUnlockCost(tierName)) {
      shouldAuto = true; // 一阶/二阶等免费阶
    }
    if (shouldAuto) {
      if (!state.unlocked_tiers) state.unlocked_tiers = ["一阶","二阶"];
      if (state.unlocked_tiers.indexOf(tierName) < 0) {
        state.unlocked_tiers.push(tierName);
      }
    }
  }
  if (clsIdx === 0) applyShortboardFutureBonus(level);
  window._pendingLevelUp = null;
  persistLevelUpSave();
  applyChoiceLLevel12Boosts();applyChoiceBLevel10Boosts();autoCalcStyles();autoCalcTalentTree();render();renderLearnPanel();
}

/** Normalize string "弥补短板" entries to objects (no default left=2). */
function normalizeShortboardFeat(feats, index) {
  var fe = feats[index];
  if (typeof fe === "string") {
    feats[index] = { name: fe, level: 0, choices: {} };
    return feats[index];
  }
  if (!fe.choices) fe.choices = {};
  return fe;
}

/**
 * Ensure _futureLowestLeft for 弥补短板.
 * Keep existing numeric counts; if missing, infer from mainLevel - feat.level
 * (conservative: left=0 when feat.level unreliable).
 */
function ensureShortboardFutureCount(fe) {
  if (!fe || fe.name !== "弥补短板") return fe;
  if (!fe.choices) fe.choices = {};
  if (typeof fe.choices._futureLowestLeft === "number") {
    return fe;
  }
  var mainLevel = (state.classes && state.classes[0]) ? (state.classes[0].level || 0) : 0;
  var featLv = fe.level;
  var left = 0;
  if (typeof featLv === "number" && featLv > 0) {
    var used = Math.max(0, mainLevel - featLv);
    left = Math.max(0, 2 - used);
  }
  fe.choices._futureLowestLeft = left;
  fe.choices._futureMigrated = true;
  return fe;
}

function migrateAllShortboardFeats() {
  var feats = state.special_feats || [];
  for (var i = 0; i < feats.length; i++) {
    var fname = typeof feats[i] === "string" ? feats[i] : feats[i].name;
    if (fname !== "弥补短板") continue;
    ensureShortboardFutureCount(normalizeShortboardFeat(feats, i));
  }
}

function applyShortboardFutureBonus(level) {
  var feats = state.special_feats || [];
  var attrNames = ATTR_NAMES;
  var cap = Math.min(20, getCurrentAttrCap());
  for (var i = 0; i < feats.length; i++) {
    var fname = typeof feats[i] === "string" ? feats[i] : feats[i].name;
    if (fname !== "弥补短板") continue;
    var fe = ensureShortboardFutureCount(normalizeShortboardFeat(feats, i));
    if (fe.choices._futureLowestLeft <= 0) continue;
    // Skip the level on which the feat was just learned
    if (fe.level != null && level != null && fe.level >= level) continue;
    var lowest = attrNames[0];
    var minVal = state.attrs[lowest] || 0;
    for (var ai = 1; ai < attrNames.length; ai++) {
      var v = state.attrs[attrNames[ai]] || 0;
      if (v < minVal) { minVal = v; lowest = attrNames[ai]; }
    }
    if ((state.attrs[lowest] || 0) < cap) {
      state.attrs[lowest] = (state.attrs[lowest] || 0) + 1;
    }
    fe.choices._futureLowestLeft -= 1;
  }
}

function showProfChoice(clsIdx,level){
  if(!state.profs) state.profs = {};  // Guard for uninitialized state
  var overlay=document.getElementById("modalOverlay")||document.createElement("div");
  if(!overlay.parentNode){overlay.id="modalOverlay";overlay.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";document.body.appendChild(overlay);}

  // Collect all available profs from PROF_DEFS (canonical list)
  var allProfs=[];
  var attrNames=ATTR_NAMES;
  for(var ai=0;ai<attrNames.length;ai++){
    var attr=attrNames[ai];
    var list=PROF_DEFS[attr]||[];
    for(var li=0;li<list.length;li++){
      if(list[li]!=="豁免"&&allProfs.indexOf(list[li])<0)allProfs.push(list[li]);
    }
  }

  // Helper: get current value of a prof
  function getProfVal(pn){
    for(var ai=0;ai<attrNames.length;ai++){
      var po=state.profs[attrNames[ai]];
      if(po&&po.hasOwnProperty(pn))return po[pn];
    }
    return 0;
  }

  var curCap=getProfCapForLevel(level);
  var html="<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:24px;max-width:700px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";
  html+='<div style="font-size:16px;color:#e8a86a;font-weight:bold;margin-bottom:12px">选择一项熟练度 +1 <span style="color:#a08060;font-weight:normal;font-size:13px">（当前上限: '+curCap+'）</span></div>';
  html+='<div id="profList" style="max-height:500px;overflow-y:auto;margin-bottom:12px">';
  for(var pi=0;pi<allProfs.length;pi++){
    var pv=getProfVal(allProfs[pi]);
    var pvStr=(typeof pv==="number")?pv:0;
    var atCap=(pv>=curCap);
    var bgColor=atCap?"#2a1f1a":"#1f1a16";
    var txtColor=atCap?"#666":"#ddd";
    var cursorStyle=atCap?"not-allowed":"pointer";
    var capLabel=atCap?' <span style="color:#884433">(已达上限)</span>':'';
    html+='<div data-cls="'+clsIdx+'" data-lv="'+level+'" data-pn="'+allProfs[pi].replace(/"/g,"&quot;")+'" class="prof-opt" data-atcap="'+String(atCap)+'" style="display:flex;justify-content:space-between;padding:8px 12px;margin:3px 0;background:'+bgColor+';border-radius:4px;font-size:13px;color:'+txtColor+';cursor:'+cursorStyle+';border:1px solid #3a2a1a">';
    html+='<span>'+allProfs[pi]+capLabel+'</span><span style="color:#e8a86a">当前: '+pvStr+'/'+curCap+'</span></div>';
  }
  html+='</div>';
  html+='<button onclick="closeReplaceModal()" style="padding:8px 16px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer">取消</button></div>';
  overlay.innerHTML=html;

  // Attach click handlers to prof options
  var opts=document.getElementById("profList").getElementsByClassName("prof-opt");
  for(var oi=0;oi<opts.length;oi++){
    (function(el){
      el.onclick=function(){
        if(el.getAttribute("data-atcap")==="true"){return;}
        chooseProf(parseInt(el.getAttribute("data-cls")),parseInt(el.getAttribute("data-lv")),el.getAttribute("data-pn"));
      };
    })(opts[oi]);
  }
}

function chooseProf(clsIdx,level,profName){
  if(!state.profs) state.profs = {};
  var curCap=getProfCapForLevel(level);
  var attr=findProfAttrByKey(profName);
  if(!attr){
    SB_toast("无法识别熟练项「"+profName+"」，请重选");
    return;
  }
  ensureProfKey(attr, profName);
  var cur=typeof state.profs[attr][profName]==="number"?state.profs[attr][profName]:0;
  if(cur>=curCap){SB_toast("该熟练度已达当前等级上限（"+curCap+"），无法继续提升");return;}
  state.profs[attr][profName]=cur+1;
  state._dirty=true;
  if(!window._pendingLevelUp)window._pendingLevelUp={clsIdx:clsIdx,level:level,_done:{}};
  window._pendingLevelUp._done._prof=true;
  closeReplaceModal();
  applyLevelUp(clsIdx);
}

function showAttrChoice(clsIdx,level){
  var overlay=document.getElementById("modalOverlay")||document.createElement("div");
  if(!overlay.parentNode){overlay.id="modalOverlay";overlay.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";document.body.appendChild(overlay);}

  var curCap=getAttrCapForLevel(level);
  var attrNames=ATTR_NAMES;
  var html="<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";
  html+='<div style="font-size:16px;color:#e8a86a;font-weight:bold;margin-bottom:10px">选择一项属性 +1 <span style="color:#a08060;font-weight:normal;font-size:13px">（当前上限: '+curCap+'）</span></div>';
  html+='<div style="margin-bottom:12px">';
  for(var ai=0;ai<attrNames.length;ai++){
    var val=state.attrs[attrNames[ai]]||0;
    var atCap=(val>=curCap);
    var bgColor=atCap?"#2a1f1a":"#1f1a16";
    var txtColor=atCap?"#666":"#ddd";
    var cursorStyle=atCap?"not-allowed":"pointer";
    var capLabel=atCap?' <span style="color:#884433">(已达上限)</span>':'';
    html+='<div data-attr="'+attrNames[ai]+'" data-atcap="'+String(atCap)+'" style="display:flex;justify-content:space-between;padding:8px 12px;margin:4px 0;background:'+bgColor+';border-radius:4px;font-size:14px;color:'+txtColor+';cursor:'+cursorStyle+';border:1px solid #3a2a1a">';
    html+='<span>'+attrNames[ai]+capLabel+'</span><span style="color:#e8a86a">'+val+'/'+curCap+'</span>';
    html+='</div>';
  }
  html+='</div>';
  html+='<button onclick="closeReplaceModal()" style="padding:8px 16px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer">取消</button></div>';
  overlay.innerHTML=html;

  // Attach click handlers to attr options
  var opts=overlay.querySelectorAll("[data-attr]");
  for(var oi=0;oi<opts.length;oi++){
    (function(el){
      el.onclick=function(){
        if(el.getAttribute("data-atcap")==="true"){return;}
        chooseAttr(clsIdx,level,el.getAttribute("data-attr"));
      };
    })(opts[oi]);
  }
}

function chooseAttr(clsIdx,level,attrName){
  var curCap=getAttrCapForLevel(level);
  var curVal=state.attrs[attrName]||0;
  if(curVal>=curCap){SB_toast("该属性已达当前等级上限（"+curCap+"），无法继续提升");return;}
  state.attrs[attrName]=curVal+1;
  state._dirty=true;
  if(!window._pendingLevelUp)window._pendingLevelUp={clsIdx:clsIdx,level:level,_done:{}};
  window._pendingLevelUp._done._attr=true;
  closeReplaceModal();
  applyLevelUp(clsIdx);
}

function applyLowestAttr(clsIdx,level){
  var attrNames=ATTR_NAMES;
  var lowest=attrNames[0];var minVal=state.attrs[lowest]||0;
  for(var ai=1;ai<attrNames.length;ai++){
    var v=state.attrs[attrNames[ai]]||0;
    if(v<minVal){minVal=v;lowest=attrNames[ai];}
  }
  state.attrs[lowest]=(state.attrs[lowest]||0)+2;
  state._dirty=true;
  finalizeLevelUp(clsIdx,level);
  closeReplaceModal();
  render();
}

function _sumProfUnderAttr(profs, attr, excludeKeys) {
  if (!profs || !profs[attr]) return 0;
  excludeKeys = excludeKeys || {};
  var total = 0;
  for (var pk in profs[attr]) {
    if (pk === "豁免" || excludeKeys[pk]) continue;
    total += profs[attr][pk] || 0;
  }
  return total;
}

/** Exact key lookup (no category / alias expand). */
function _getProfExact(profs, key, preferAttrs) {
  if (!profs || !key) return 0;
  if (preferAttrs) {
    for (var i = 0; i < preferAttrs.length; i++) {
      var a = preferAttrs[i];
      if (profs[a] && profs[a][key]) return profs[a][key] || 0;
    }
  }
  for (var pa in profs) {
    if (profs[pa] && profs[pa][key]) return profs[pa][key] || 0;
  }
  return 0;
}

/** Keys to exclude from attr-sum when a profNames entry was already counted. */
function _excludeKeysForProfName(name) {
  var exclude = {};
  if (!name) return exclude;
  if (PROF_DEFS[name]) {
    var defs = PROF_DEFS[name];
    for (var di = 0; di < defs.length; di++) {
      if (defs[di] !== "豁免") exclude[defs[di]] = true;
    }
    return exclude;
  }
  var resolved = typeof resolveProfTarget === "function" ? resolveProfTarget(name) : null;
  if (resolved && resolved.category && resolved.keys) {
    for (var ci = 0; ci < resolved.keys.length; ci++) exclude[resolved.keys[ci]] = true;
    return exclude;
  }
  if (resolved && resolved.key) {
    exclude[resolved.key] = true;
    return exclude;
  }
  exclude[name] = true;
  return exclude;
}

/**
 * Resolve rule/display name to proficiency total.
 * - Attribute name (魅力/敏捷…) → sum under that attr
 * - Category (表演/巧手/知识/奥秘) → sum of sub-keys
 * - Alias (神秘学/草药学) → formal key via resolveProfTarget
 */
function _getProfByName(profs, name, preferAttrs) {
  if (!profs || !name) return 0;
  if (PROF_DEFS[name]) {
    return _sumProfUnderAttr(profs, name, {});
  }
  var resolved = typeof resolveProfTarget === "function" ? resolveProfTarget(name) : null;
  if (resolved && resolved.category && resolved.keys) {
    var prefer = preferAttrs;
    if ((!prefer || !prefer.length) && resolved.attr) prefer = [resolved.attr];
    var sum = 0;
    for (var i = 0; i < resolved.keys.length; i++) {
      sum += _getProfExact(profs, resolved.keys[i], prefer);
    }
    return sum;
  }
  if (resolved && resolved.key) {
    var prefer2 = preferAttrs;
    if ((!prefer2 || !prefer2.length) && resolved.attr) prefer2 = [resolved.attr];
    return _getProfExact(profs, resolved.key, prefer2);
  }
  return _getProfExact(profs, name, preferAttrs);
}

function evalSubclassAttrReq(req, attrs) {
  attrs = attrs || {};
  var keys = Object.keys(req.attrs || {});
  if (!keys.length) return { ok: true, detail: "无属性要求" };
  var parts = [];
  var ok = true;
  if (req.attrAlt) {
    var primaryKey = keys[0];
    var primaryReq = req.attrs[primaryKey];
    var primaryVal = attrs[primaryKey] || 10;
    var altVal = attrs[req.attrAlt] || 10;
    if (primaryVal < primaryReq && altVal < primaryReq) ok = false;
    parts.push(primaryKey + "/" + req.attrAlt + "≥" + primaryReq + " (当前" + primaryVal + "/" + altVal + ")");
    for (var i = 1; i < keys.length; i++) {
      var k = keys[i];
      var v = attrs[k] || 10;
      var r = req.attrs[k];
      if (v < r) ok = false;
      parts.push(k + "≥" + r + " (当前" + v + ")");
    }
  } else {
    for (var j = 0; j < keys.length; j++) {
      var kk = keys[j];
      var vv = attrs[kk] || 10;
      var rr = req.attrs[kk];
      if (vv < rr) ok = false;
      parts.push(kk + "≥" + rr + " (当前" + vv + ")");
    }
  }
  return { ok: ok, detail: parts.join("，") };
}

function evalSubclassProfReq(req, profs) {
  profs = profs || {};
  if (!req.profTotal || req.profTotal <= 0) {
    return { ok: true, value: 0, required: 0, detail: "无熟练度要求" };
  }
  var total = 0;
  var labelParts = [];
  var breakdown = [];
  var prefer = [];
  if (req.profAttr) prefer.push(req.profAttr);
  if (req.profAttrAlt) prefer.push(req.profAttrAlt);
  if (req.profNames && req.profNames.length) {
    labelParts.push(req.profNames.join("、"));
    for (var ni = 0; ni < req.profNames.length; ni++) {
      var pn = req.profNames[ni];
      var pv = _getProfByName(profs, pn, prefer.length ? prefer : null);
      total += pv;
      if (pv > 0) breakdown.push(pn + "(" + pv + ")");
    }
  }
  var attrList = [];
  if (req.profAttr) attrList.push(req.profAttr);
  if (req.profAttrAlt) attrList.push(req.profAttrAlt);
  if (attrList.length) {
    labelParts.push(attrList.join("+") + "共计");
    for (var ai = 0; ai < attrList.length; ai++) {
      var attr = attrList[ai];
      var exclude = {};
      if (req.profNames) {
        for (var ei = 0; ei < req.profNames.length; ei++) {
          var exMap = _excludeKeysForProfName(req.profNames[ei]);
          for (var ek in exMap) exclude[ek] = true;
        }
      }
      var attrSum = _sumProfUnderAttr(profs, attr, exclude);
      total += attrSum;
      if (attrSum > 0) breakdown.push(attr + "(" + attrSum + ")");
    }
  }
  var label = labelParts.join("+");
  var detail = "熟练度" + (label || "合计") + "≥" + req.profTotal;
  detail += breakdown.length ? " (" + breakdown.join("+") + "=共" + total + ")" : " (当前" + total + ")";
  return { ok: total >= req.profTotal, value: total, required: req.profTotal, detail: detail };
}

function checkSubclassReq(mainClassName, targetClass, attrs, profs) {
  var req = REF_SUBCLASS_REQS[targetClass];
  if (!req) return { ok: false, reasons: ["未知职业"], detail: "" };
  var reasons = [];
  if (req.incompatible && req.incompatible.indexOf(mainClassName) >= 0) reasons.push("不兼容");
  var attrR = evalSubclassAttrReq(req, attrs);
  if (!attrR.ok) reasons.push("属性不足");
  var profR = evalSubclassProfReq(req, profs);
  if (!profR.ok) reasons.push("熟练度不足");
  return {
    ok: reasons.length === 0,
    reasons: reasons,
    attrDetail: attrR.detail,
    profDetail: profR.detail
  };
}

// First try to load saved character, then render
// 注意：此处在 <script> 执行时运行，DOM 尚未完整；render 抛错绝不能中断后续定义
// （window.showSubclassModal / selectSubclass 等依赖本文件末尾的顶层执行）
try {
  if (!initFromURL()) {
    render();
  }
} catch (e) {
  if (window.console) console.error('initial render failed (retried on load):', e);
}

// Add save button to the page
(function() {
  var saveBtn = document.createElement("button");
  saveBtn.textContent = "保存";
  saveBtn.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;padding:10px 22px;background:#4a6a3a;color:#f0e0d0;border:1px solid #6a8a5a;border-radius:6px;cursor:pointer;font-size:15px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.4)";
  saveBtn.onclick = function() {
    showSaveDialog(function(slotIndex) {
      if (saveState(slotIndex)) {
        SB_toast("已保存到存档位" + slotIndex);
      }
    });
  };
  document.body.appendChild(saveBtn);
  
  // Add back button
  var backBtn = document.createElement("button");
  backBtn.textContent = "返回";
  backBtn.style.cssText = "position:fixed;top:10px;right:110px;z-index:9999;padding:10px 22px;background:#5a3a18;color:#f0e0d0;border:1px solid #7a5a38;border-radius:6px;cursor:pointer;font-size:15px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.4)";
  backBtn.onclick = goBackToSlots;
  document.body.appendChild(backBtn);

  var recreateBtn = document.createElement("button");
  recreateBtn.textContent = "重新车卡";
  recreateBtn.title = "基于创建快照另存为新的 1 级角色";
  recreateBtn.style.cssText = "position:fixed;top:10px;right:200px;z-index:9999;padding:10px 14px;background:#3a4a6a;color:#f0e0d0;border:1px solid #5a6a8a;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.4)";
  recreateBtn.onclick = startRecreateFromPanel;
  document.body.appendChild(recreateBtn);
window.showKeyPreferencePicker=function(callback){
  var overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center";
  var box=document.createElement("div");
  box.className='popup-box';box.style.cssText="background:var(--panel);border-radius:10px;padding:24px;max-width:420px;width:90%;border:2px solid var(--line);box-shadow:0 8px 32px rgba(0,0,0,0.3)";
  box.innerHTML="<h3 style=margin-bottom:4px;color:var(--ink)>\u9009\u62e9\u5173\u952e\u504f\u597d\u989c\u8272</h3><p style=font-size:13px;color:var(--muted);margin-bottom:16px>\u4e60\u5f97\u540e\u53ef\u5c06\u4efb\u610f\u989c\u8272\u7684\u6280\u80fd\u70b9\u89c6\u4f5c\u504f\u597d\u989c\u8272\u4f7f\u7528</p><div id=kpColorGrid style=display:grid;grid-template-columns:repeat(4,1fr);gap:8px></div><button id=kpCancelBtn style=display:block;width:100%;margin-top:14px;padding:8px;background:var(--line);color:var(--muted);border:none;border-radius:6px;cursor:pointer;font-size:14px>\u53d6\u6d88</button>";
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  function cleanup(){overlay.remove();}
  document.getElementById("kpCancelBtn").onclick=cleanup;
  var spColors=[["\u6a59\u8272","#EE822F"],["\u767d\u8272","#FFFFFF"],["\u7d2b\u8272","#B94BFF"],["\u9ec4\u8272","#FFF32F"],["\u65e0\u8272","#D9D9D9"],["\u84dd\u8272","#00B0F0"],["\u9752\u8272","#00FA99"],["\u9ed1\u8272","#595959"],["\u7ea2\u8272","#FF0000"],["\u68d5\u8272","#843F0B"],["\u7c89\u8272","#FFB7E3"],["\u7eff\u8272","#00B050"],["\u6d45\u8272","#B3F9FF"]];
  var grid=document.getElementById("kpColorGrid");
  for(var i=0;i<spColors.length;i++){
    var sc=spColors[i];
    var isLight=["#FFFFFF","#FFF32F","#B3F9FF","#00FA99","#D9D9D9","#FFB7E3"].indexOf(sc[1])>=0;
    var cell=document.createElement("div");
    cell.textContent=sc[0];
    cell.style.cssText="cursor:pointer;padding:10px 6px;border-radius:6px;text-align:center;font-size:13px;font-weight:bold;background:"+sc[1]+";color:"+(isLight?"var(--ink)":"#fff")+";border:2px solid "+(isLight?"var(--line)":sc[1]);
    cell.onmouseenter=function(){this.style.transform="scale(1.08)";this.style.boxShadow="0 4px 12px rgba(0,0,0,0.2)";};
    cell.onmouseleave=function(){this.style.transform="scale(1)";this.style.boxShadow="none";};
    (function(colorName){cell.onclick=function(){cleanup();callback(colorName);};})(sc[0]);
    grid.appendChild(cell);
  }
}
window.showSubclassModal=function(){
  var mc=state.classes[0]; var ml=mc.level;
  if(ml<7){if(window.toast)window.toast("主职业需达到 7 级才能选择子职业（当前 " + ml + " 级）","warn");return;}
  var overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center";
  var box=document.createElement("div");
  box.className='popup-box';box.style.cssText="background:var(--panel);border-radius:10px;padding:24px;max-width:600px;width:95%;max-height:90vh;overflow-y:auto;border:2px solid var(--line);box-shadow:0 8px 32px rgba(0,0,0,0.3)";
  var h="<h3 style=margin-bottom:8px;color:var(--ink)>选择子职业</h3>";
  h+="<p style=font-size:13px;color:var(--muted);margin-bottom:16px>需满足属性值、熟练度要求，且与主职业兼容</p>";
  h+="<div style=display:flex;flex-direction:column;gap:6px>";
  var allClasses=["蛮斗士","战士","法师","猎人","牧师","圣骑士","游荡者","德鲁伊","萨满祭司","术士","武僧","吟游诗人","魔契师","奇械师"];
  for(var i=0;i<allClasses.length;i++){
    var cn=allClasses[i]; var req=REF_SUBCLASS_REQS[cn]; if(!req)continue;
    // 兼职同名职业是允许的（如法师兼职法师），主职业不跳过；兼容性由 REF_SUBCLASS_REQS.incompatible 判定
    var check=checkSubclassReq(mc.name,cn,state.attrs,state.profs);
    var attrDetail=check.attrDetail+(check.profDetail?" | "+check.profDetail:"");
    var allOK=check.ok;
    var failReasons=check.reasons;
    var bg=allOK?"var(--panel)":"var(--bg)"; var border=allOK?"var(--accent)":"var(--line)";
    h+="<div style=display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:6px;background:"+bg+";border:1px solid "+border+">";
    h+="<div><span style=font-size:15px;font-weight:bold;color:"+(allOK?"var(--accent)":"var(--ink)")+">"+cn+"</span>";
    h+="<div style=font-size:11px;color:var(--muted);margin-top:2px>"+attrDetail+"</div></div>";
    if(allOK){
      h+="<button class=subclassSelectBtn data-cn=\""+cn+"\" style=padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold>选择</button>";
    }else{
      h+="<span style=font-size:12px;color:#c62828>"+failReasons.join("，")+"</span>";
    }
    h+="</div>";
  }
  h+="</div><button id=subclassCancelBtn style=display:block;width:100%;margin-top:14px;padding:8px;background:var(--line);color:var(--muted);border:none;border-radius:6px;cursor:pointer;font-size:14px>取消</button>";
  box.innerHTML=h;overlay.appendChild(box);document.body.appendChild(overlay);
  document.getElementById("subclassCancelBtn").onclick=function(){overlay.remove();};
  var _sbtns=box.querySelectorAll(".subclassSelectBtn");
  for(var _si=0;_si<_sbtns.length;_si++){
    _sbtns[_si].onclick=function(){
      overlay.remove();
      selectSubclass(this.getAttribute("data-cn"));
    };
  }
}
window.selectSubclass=function(cn){
  var mc=state.classes[0];
  if(!mc||mc.level<7){if(window.toast)window.toast("主职业需达到 7 级才能选择子职业","warn");return;}
  var check=checkSubclassReq(mc.name,cn,state.attrs,state.profs);
  if(!check.ok){if(window.toast)window.toast("不满足兼职条件："+check.reasons.join("，"),"warn");return;}
  var o=document.getElementById("subclassOverlay");if(o)o.remove();
  state.classes[1]={name:cn,level:1,keyAttr:REF_CLASSES[cn]?REF_CLASSES[cn].key_attr||"":"",styles:["","","",""]};
  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
}
})();

function exportCurrentXlsx(){
 if(!state){SB_toast("请先导入或创建角色");return;}
 exportXlsxFromState(state).catch(function(e){
   console.error("Export error:",e);
   var msg=(e&&e.message)?e.message:"未知错误";
   SB_toast("导出失败：" + msg);
 });
}
// ========== XLSX Export Engine ==========
async function inflate(data, tryRaw) {
  var useRaw = tryRaw !== false;
  if (useRaw) {
    try {
      var ds = new DecompressionStream("deflate-raw");
      var reader = ds.readable.getReader();
      var writer = ds.writable.getWriter();
      var readDone = (async function() {
        var chunks = [];
        while (true) { var r = await reader.read(); if (r.done) break; chunks.push(r.value); }
        return chunks;
      })();
      writer.write(data);
      writer.close();
      var chunks = await readDone;
      var total = 0;
      for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
      var result = new Uint8Array(total);
      var off = 0;
      for (var i = 0; i < chunks.length; i++) { result.set(chunks[i], off); off += chunks[i].length; }
      return result;
    } catch(e) {
      // deflate-raw not supported, fall through to zlib wrapper approach
    }
  }
  // Add zlib header (0x78 0x9C) to raw deflate data for "deflate" format
  var zlibHeader = new Uint8Array([0x78, 0x9C]);
  var wrapped = new Uint8Array(zlibHeader.length + data.length);
  wrapped.set(zlibHeader, 0);
  wrapped.set(data, zlibHeader.length);
  var ds2 = new DecompressionStream("deflate");
  var reader2 = ds2.readable.getReader();
  var writer2 = ds2.writable.getWriter();
  var readDone2 = (async function() {
    var chunks = [];
    while (true) { var r = await reader2.read(); if (r.done) break; chunks.push(r.value); }
    return chunks;
  })();
  writer2.write(wrapped);
  writer2.close();
  var chunks2 = await readDone2;
  var total2 = 0;
  for (var i = 0; i < chunks2.length; i++) total2 += chunks2[i].length;
  var result2 = new Uint8Array(total2);
  var off2 = 0;
  for (var i = 0; i < chunks2.length; i++) { result2.set(chunks2[i], off2); off2 += chunks2[i].length; }
  return result2;
}

async function readFileEntry(files, entry) {
  if (!files[entry]) return null;
  var f = files[entry];
  if (f.method === 0) return new TextDecoder().decode(f.compressed); // stored
  if (f.method === 8) {
    var decompressed = await inflate(f.compressed);
    return new TextDecoder().decode(decompressed);
  }
  throw new Error("不支持的压缩方式: " + f.method);
}

// ========== XLSX Parser (regex-based, no DOMParser) ==========
async function parseXLSX(buffer) {
  var zip = await readZIP(buffer);
  if(!zip["xl/sharedStrings.xml"]||!zip["xl/worksheets/sheet1.xml"])throw new Error("模板格式不正确");
  var ssXML=await readFileEntry(zip,"xl/sharedStrings.xml");
  var sheetXML=await readFileEntry(zip,"xl/worksheets/sheet1.xml");
  // Parse shared strings with regex (avoids DOMParser namespace issues)
  var strings=[];
  var siRe=/<si>([\s\S]*?)<\/si>/g;var sm;
  while((sm=siRe.exec(ssXML))!==null){strings.push(sm[1].replace(/<[^>]+>/g,""));}
  // Parse cells with regex: match <c r="XX" ...><v>N</v></c>
  var cells={},rawValues={};
  var cRe=/<c r="([A-Z]+\d+)"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<is>(?:<t[^>]*>)?([^<]*)(?:<\/t>)?<\/is>|<v>(\d+(?:\.\d+)?)<\/v>)<\/c>/g;
  var cm;
  while((cm=cRe.exec(sheetXML))!==null){
    var ref=cm[1],tAttr=cm[2]||"",inline=cm[3],vNum=cm[4];
    var rawVal=vNum||inline||"";
    var textVal=rawVal;
    if(tAttr==="s"&&vNum){
      var idx=parseInt(vNum);
      textVal=(idx<strings.length)?strings[idx]:vNum;
    }
    if(rawVal){rawValues[ref]=rawVal;}
    if(textVal){cells[ref]=textVal;if(ref=="C17"||ref=="C22")console.log("REGEX FOUND",ref,"rawVal="+rawVal,"textVal="+textVal);}
  }
  console.log("REGEX PARSER: strings="+strings.length+" cells="+Object.keys(cells).length);return{cells:cells,rawValues:rawValues,strings:strings};
}

// ========== Calculation Helpers ==========

var _XLSX_CRC_TABLE = null;
function _xlsxCrc32(data) {
  if (!_XLSX_CRC_TABLE) {
    _XLSX_CRC_TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _XLSX_CRC_TABLE[n] = c;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < data.length; i++) crc = (crc >>> 8) ^ _XLSX_CRC_TABLE[(crc ^ data[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _normalizeXlsxBuffer(buf) {
  if (!buf) return null;
  if (buf instanceof ArrayBuffer) return buf.byteLength >= 22 ? buf : null;
  if (ArrayBuffer.isView(buf)) {
    return buf.byteLength >= 22
      ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      : null;
  }
  return null;
}

async function _xlsxPackEntry(data) {
  var input = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof CompressionStream === "function") {
    try {
      var ds = new CompressionStream("deflate-raw");
      var writer = ds.writable.getWriter();
      var reader = ds.readable.getReader();
      writer.write(input);
      writer.close();
      var chunks = [];
      while (true) { var r = await reader.read(); if (r.done) break; chunks.push(r.value); }
      var total = 0;
      for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
      var result = new Uint8Array(total);
      var off = 0;
      for (var i = 0; i < chunks.length; i++) { result.set(chunks[i], off); off += chunks[i].length; }
      return { data: result, method: 8 };
    } catch (e) {
      console.warn("xlsx deflate failed, storing uncompressed:", e);
    }
  }
  return { data: input, method: 0 };
}

function _xlsxBuildZip(entries) {
  var parts = [];
  var cdEntries = [];
  for (var ei = 0; ei < entries.length; ei++) {
    var en = entries[ei];
    var nameBuf = new TextEncoder().encode(en.name);
    var data = en.data;
    // ZIP CRC-32 must cover the *uncompressed* payload (PKWARE APPNOTE)
    var crc;
    if (en.uncompData) {
      var u = en.uncompData instanceof Uint8Array ? en.uncompData : new Uint8Array(en.uncompData);
      crc = _xlsxCrc32(u);
    } else if (typeof en.crc32 === "number") {
      crc = en.crc32 >>> 0;
    } else {
      crc = _xlsxCrc32(data);
    }
    var lh = new ArrayBuffer(30 + nameBuf.length);
    var dv = new DataView(lh);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, en.method, true); dv.setUint32(10, (Date.now() / 1000) | 0, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, en.compSize, true); dv.setUint32(22, en.uncompSize, true);
    dv.setUint16(26, nameBuf.length, true); dv.setUint16(28, 0, true);
    var lhArr = new Uint8Array(lh);
    lhArr.set(nameBuf, 30);
    parts.push(lhArr, data);
    cdEntries.push({ nameBuf: nameBuf, method: en.method, crc: crc, compSize: en.compSize, uncompSize: en.uncompSize });
  }
  var totalOff = 0;
  for (var i = 0; i < parts.length; i++) totalOff += parts[i].length;
  var cdBufs = [];
  for (var i = 0; i < cdEntries.length; i++) {
    var ce = cdEntries[i];
    var fo = 0;
    for (var j = 0; j < i * 2; j++) fo += parts[j].length;
    var cdh = new ArrayBuffer(46 + ce.nameBuf.length);
    var cdv = new DataView(cdh);
    cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0x0800, true); cdv.setUint16(10, ce.method, true); cdv.setUint32(12, (Date.now() / 1000) | 0, true);
    cdv.setUint32(16, ce.crc, true); cdv.setUint32(20, ce.compSize, true); cdv.setUint32(24, ce.uncompSize, true);
    cdv.setUint16(28, ce.nameBuf.length, true); cdv.setUint16(30, 0, true); cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true); cdv.setUint16(36, 0, true); cdv.setUint32(38, 0, true); cdv.setUint32(42, fo, true);
    var cdhArr = new Uint8Array(cdh);
    cdhArr.set(ce.nameBuf, 46);
    cdBufs.push(cdhArr);
  }
  var cdSize = 0;
  for (var i = 0; i < cdBufs.length; i++) cdSize += cdBufs[i].length;
  var eocd = new ArrayBuffer(22);
  var ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, cdEntries.length, true); ev.setUint16(10, cdEntries.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, totalOff, true); ev.setUint16(20, 0, true);
  var all = parts.concat(cdBufs);
  all.push(new Uint8Array(eocd));
  var totalLen = 0;
  for (var i = 0; i < all.length; i++) totalLen += all[i].length;
  var result = new Uint8Array(totalLen);
  var off = 0;
  for (var i = 0; i < all.length; i++) { result.set(all[i], off); off += all[i].length; }
  return result;
}

async function exportXlsxFromState(state) {
  // Use the embedded enhanced template or the original uploaded ZIP
  var templateBuf = _normalizeXlsxBuffer(state._uploadedXlsxBuf);
  // Guard: ensure templateBuf is a valid non-empty ArrayBuffer
  if (!templateBuf) {
    // Fallback: use embedded blank template
    var b64 = "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";
    var bin = atob(b64);
    templateBuf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) templateBuf[i] = bin.charCodeAt(i);
    templateBuf = templateBuf.buffer;
  }
  // Read template ZIP
  var view = new DataView(new Uint8Array(templateBuf).buffer);
  var e = -1;
  for (var i = templateBuf.byteLength - 22; i >= Math.max(0, templateBuf.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { e = i; break; }
  }
  if (e < 0) { SB_toast("导出失败：模板文件损坏，请重新上传角色文件或刷新页面后重试"); return; }
  var cd = view.getUint32(e + 16, true), total = view.getUint16(e + 10, true);
  var p = cd, entries = [];
  for (var j = 0; j < total; j++) {
    var nl = view.getUint16(p + 28, true), el = view.getUint16(p + 30, true), cl = view.getUint16(p + 32, true), nm = "";
    for (var k = 0; k < nl; k++) nm += String.fromCharCode(view.getUint8(p + 46 + k));
    var off = view.getUint32(p + 42, true), cs = view.getUint32(p + 20, true), us = view.getUint32(p + 24, true), mt = view.getUint16(p + 10, true);
    var origCrc = view.getUint32(p + 16, true);
    var lnl = view.getUint16(off + 26, true), lel = view.getUint16(off + 28, true), ds = off + 30 + lnl + lel;
    var raw = new Uint8Array(view.buffer, view.byteOffset + ds, cs);
    var txt = mt === 0 ? new TextDecoder().decode(raw) : (raw[0]===60 ? new TextDecoder().decode(raw) : new TextDecoder().decode(await inflate(raw)));
    entries.push({ name: nm, method: mt, rawData: raw, text: txt, compSize: cs, uncompSize: us, crc32: origCrc });
    p += 46 + nl + el + cl;
  }
  var ss = entries.find(function (x) { return x.name === "xl/sharedStrings.xml"; });
  var sh = entries.find(function (x) { return x.name === "xl/worksheets/sheet1.xml"; });
  var stEntry = entries.find(function (x) { return x.name === "xl/styles.xml"; });
  if (!ss || !sh) {
    SB_toast("导出失败：模板缺少 sharedStrings 或 sheet1，请重新上传角色 xlsx 或刷新页面后重试");
    return;
  }

  var strikeStyleId = "";
  if (stEntry && stEntry.text) {
    var strikePack = xlsxEnsureCancelSlotStyle(stEntry.text);
    stEntry.text = strikePack.text;
    strikeStyleId = strikePack.styleId || "";
  }

  // Parse shared strings
  var strings = [], siBlocks = [];
  var siRe = /<si>[\s\S]*?<\/si>/g, m;
  while ((m = siRe.exec(ss.text)) !== null) {
    siBlocks.push(m[0]);
    var tm = m[0].match(/<t(?:[^>]*)?>([\s\S]*?)<\/t>/);
    strings.push(tm ? tm[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'") : '');
  }
  function addStr(s) { if (!s) s = ""; var i = strings.indexOf(s); if (i >= 0) return i; strings.push(s); siBlocks.push("<si><t>" + s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") + "</t></si>"); return strings.length - 1; }

  // Parse cell styles
  var cStyle = {};
  var re = /<c r="([A-Z]+\d+)"( s="(\d+)")?( t="([^"]+)")?(?:(?:\/>)|(?:><v>([^<]*)<\/v><\/c>))/g;
  while ((m = re.exec(sh.text)) !== null) cStyle[m[1]] = m[3] || "";

  var xml = sh.text;
  /** @param {boolean} [invent=true] 模板无此格时是否创建；clear 传 false 避免 invent 破坏列序
   *  @param {string} [styleId] 可选样式索引（未持有栏位删除线） */
  function set(ref, val, invent, styleId) {
    var cs = (styleId !== undefined && styleId !== null && styleId !== "") ? String(styleId) : (cStyle[ref] || "");
    var nc, mrow, col, row, rowFullRe, rm;
    if (invent === undefined) invent = true;
    if (val === "" || val === null || val === undefined) {
      // 空格：自封闭单元格（与手改「名称列划掉」一致，不写共享字符串）
      nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : "") + "/>";
    } else if (typeof val === "number") {
      nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : "") + "><v>" + val + "</v></c>";
    } else {
      var si = addStr(String(val));
      nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : '') + ' t="s"><v>' + si + "</v></c>";
    }
    var rx = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    if (rx.test(xml)) {
      xml = xml.replace(new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)', "g"), nc);
      cStyle[ref] = cs;
    } else {
      if (!invent) return;
      mrow = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!mrow) return;
      col = mrow[1];
      row = mrow[2];
      rowFullRe = new RegExp('<row[^>]*\\br="' + row + '"[^>]*>[\\s\\S]*?</row>');
      rm = rowFullRe.exec(xml);
      if (rm) xml = xml.replace(rm[0], xlsxInsertCellInRow(rm[0], col, nc));
      else xml = xml.replace("</sheetData>", '<row r="' + row + '">' + nc + "</row></sheetData>");
      cStyle[ref] = cs;
    }
  }

  // Fill all data from state into cells
  // Clear stale template cells first (avoids leftover content from uploaded/same-name sheets)
  clearXlsxSkillRows(set);
  clearXlsxEquipmentSlots(set);
  clearXlsxClassAndFeatureSlots(set);

  // ===== 风格底纹（26.07.31）：按需注册 fill + cellXf =====
  normalizeAllSkillSubs();
  var styleNeed = [];
  var _bMainXf = cStyle["B123"] || 0;
  var _bSubXf = cStyle["B168"] || _bMainXf || 0;
  var _styleRows = [17, 23, 29];
  for (var _ri = 0; _ri < _styleRows.length; _ri++) {
    var _rc = state.classes[_ri];
    if (!_rc || !_rc.name || !_rc.styles) continue;
    for (var _sj = 0; _sj < 4; _sj++) {
      var _sn = _rc.styles[_sj] || "";
      if (!_sn) continue;
      var _sColor = (STYLE_COLOR_MAP[_rc.name] || {})[_sn] || "";
      if (_sColor) xlsxPushStyleNeed(styleNeed, cStyle["E" + (_styleRows[_ri] + _sj)] || 0, _sColor);
    }
  }
  var _mainSkills = (state.skills || []).filter(isMainSkillOccupant);
  var _subSkills = (state.skills || []).filter(isSubSkillOccupant);
  for (var _mi = 0; _mi < _mainSkills.length; _mi++) {
    var _ms = _mainSkills[_mi];
    xlsxPushStyleNeed(styleNeed, _bMainXf, getStyleColorForSkill(_ms, _ms.src || _ms.source || ((state.classes[0] || {}).name || "")));
  }
  for (var _ui = 0; _ui < _subSkills.length; _ui++) {
    var _us = _subSkills[_ui];
    xlsxPushStyleNeed(styleNeed, _bSubXf, getStyleColorForSkill(_us, _us.src || _us.source || ((state.classes[1] || {}).name || "")));
  }
  var styleIdMap = {};
  if (stEntry && stEntry.text && styleNeed.length) {
    var stylePack = xlsxEnsureStyleColors(stEntry.text, styleNeed);
    stEntry.text = stylePack.text;
    styleIdMap = stylePack.styleIds;
  }

  // Basic info
  if (state.player) set("C3", state.player);
  if (state.name) set("C4", state.name);
  if (state.race) set("C5", state.race);
  if (state.gender) set("C6", state.gender);
  if (state.age) set("C7", state.age);
  if (state.height) set("C8", state.height);
  if (state.weight) set("C9", state.weight);
  if (state.eye) set("C10", state.eye);
  if (state.skin) set("C11", state.skin);
  if (state.hair) set("C12", state.hair);

  // Combat data - need to calculate
  var cl = state.classes[0];
  set("B17", cl.name || "");
  if (cl.level) set("D17", cl.level);
  if (cl.styles && cl.styles[0]) set("E17", cl.styles[0]);
  if (cl.styles && cl.styles[1]) set("E18", cl.styles[1]);
  var sc = state.classes[1];
  if (sc && sc.name) { set("B23", sc.name); if (sc.level) set("D23", sc.level); }
  var wa = state.classes[2];
  if (wa && wa.name) { set("B29", wa.name); if (wa.level) set("D29", wa.level); }

        // Combat values (mirrors panel render logic in 角色面板.html line 4415-4562)
  var _hp = state.hp||0; var _fp = state.fp||0;
  var _mhp = typeof calcMod==="function"?calcMod:function(v){return Math.floor((v-10)/2);};
  var _dex = (state.attrs||{})["敏捷"]||10;
  var _dexMod = _mhp(_dex);
  var _str = (state.attrs||{})["力量"]||10;
  var _strMod = _mhp(_str);
  var _ka = cl.keyAttr||(typeof REF_CLASSES!=="undefined"&&REF_CLASSES[cl.name]?REF_CLASSES[cl.name].key_attr:"")||"魅力";
  if(_ka==="力量或敏捷")_ka=cl.keyAttr||"力量";
  var _kaVal = (state.attrs||{})[_ka]||10;
  var _spellMod = _mhp(_kaVal);
  

// AC (mirrors line 4415-4530)
  var _ac=null;
  var _eqArmor=(state.equipment&&state.equipment["防具"])||[];
  for(var _ai=0;_ai<_eqArmor.length;_ai++){
    var _aInfo=typeof getArmorAC==="function"?getArmorAC(_eqArmor[_ai]):null;
    if(!_aInfo){
      var _an=itemName(_eqArmor[_ai])||"";
      if(_an==="演出戏服"||_an==="高档服装"||_an==="布衣"||_an==="披风"){
        _aInfo={base:11,addDex:true};
      }
    }
    if(_aInfo){
      var _ac2=_aInfo.addDex?(_aInfo.base+Math.min(_dexMod,_aInfo.dexCap!=null?_aInfo.dexCap:999)):_aInfo.base;
      if(_ac===null||_ac2>_ac)_ac=_ac2;
    }
  }
  if(_ac===null)_ac=10+_dexMod;
  if(typeof getShieldBonus==="function")_ac+=getShieldBonus(state);
  if(state._feat_ac_bonus && typeof wearingMediumArmor==="function" && wearingMediumArmor()) _ac += (state._feat_ac_bonus||0);
  // Row 1
  set("L3", String(_hp));
  set("L4", String(_fp));
  set("L7", String(_ac));
  set("L8", String(_dexMod));
  if(state.race && typeof REF_RACES==="object" && REF_RACES[state.race] && REF_RACES[state.race].speed) set("L9", REF_RACES[state.race].speed);
  if(_ka) set("L10", _ka);
  // Row 2
  set("L5", String(Math.floor(_hp/2)));
  set("L6", String(Math.floor(_fp/2)));
  set("L11", String(Math.max(_strMod,_dexMod) + ((state && state.atk_hit_bonus) || 0)));
  set("L12", String(_spellMod + ((state && state.spell_hit_bonus) || 0)));
  // Class layout
  set("B17", cl.name || "");
  if(cl.level) set("D17", cl.level);
  var _styleRows2 = [17, 23, 29];
  var _styleCls = [cl, state.classes[1], state.classes[2]];
  for (var _ri2 = 0; _ri2 < _styleCls.length; _ri2++) {
    var _rc2 = _styleCls[_ri2];
    if (!_rc2 || !_rc2.name) continue;
    for (var _sj2 = 0; _sj2 < 4; _sj2++) {
      var _sn2 = (_rc2.styles && _rc2.styles[_sj2]) || "";
      if (!_sn2) continue;
      var _sColor2 = (STYLE_COLOR_MAP[_rc2.name] || {})[_sn2] || "";
      var _sXf2 = _sColor2 ? (styleIdMap[(cStyle["E" + (_styleRows2[_ri2] + _sj2)] || 0) + ":" + _sColor2] || "") : "";
      set("E" + (_styleRows2[_ri2] + _sj2), _sn2, true, _sXf2);
    }
  }
  var sc = state.classes[1];
  if(sc && sc.name) { set("B23", sc.name); if(sc.level) set("D23", sc.level); }
  var wa = state.classes[2];
  if(wa && wa.name) { set("B29", wa.name); if(wa.level) set("D29", wa.level); }
  // Attributes
  var an = ["力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运"];
  var aRows = [36, 46, 57, 62, 87, 100, 110, 116];
  for (var ai = 0; ai < an.length; ai++) {
    var av = state.attrs[an[ai]] || 10;
    set("C" + aRows[ai], av);
    set("D" + aRows[ai], (typeof calcMod === "function" ? calcMod(av) : Math.floor((av-10)/2)));
  }
  // 警惕值
  if (state.attrs["警惕值"]) { set("C96", state.attrs["警惕值"]); set("D96", (typeof calcMod === "function" ? calcMod(state.attrs["警惕值"]) : Math.floor(((state.attrs["警惕值"]||10)-10)/2))); }

  // Background
  if (state.background) set("G15", state.background);
  if (state.story) set("H16", state.story);
  var _traitsOut = exportTraitsText(state);
  if (_traitsOut) set("H18", _traitsOut);
  if (state.personality) set("H21", state.personality);
  if (state.ideals) set("H24", state.ideals);
  if (state.bonds) set("H27", state.bonds);
  if (state.flaws) set("H30", state.flaws);
  if (state.deity) set("H33", state.deity + (state.deityAttr ? "（" + state.deityAttr + "）" : ""));
  else if (state.patron) set("H33", "宗主：" + state.patron);
  if (state.contacts) set("H34", state.contacts);
  else if (state.patron && state.deity) set("H34", "宗主：" + state.patron);
  if (state.scamType) set("H35", state.scamType);
  if (state.missionChannel) set("H36", state.missionChannel);
  if (state.academicDomain) set("H37", state.academicDomain);

  // Proficiencies (E 列标签 → G 列加值)
  if (typeof fillXlsxProficiencies === "function") fillXlsxProficiencies(set, xml, strings, state);

  // Feats
  if (state.special_feats && state.special_feats.length > 0) {
    fillXlsxSpecialFeats(set, state.special_feats);
  }

  // Currency
  if (state.currency) {
    set("O36", String(state.currency["金币"] || 0));
    set("O38", String(state.currency["银币"] || 0));
    set("O40", String(state.currency["铜币"] || 0));
  }

  // Equipment (write to I/K columns matching template layout)
  // Template has I labels: I46=武器, I50=防具, I52=武器, I56=配饰, I61=背包, I72=旅行腰包, I78=杂物
  // Item names go in K column at/below each label
  if (state.equipment) {
    var eqMap = [
      { zone: "主手武器", label: "武器", row: 46 },
      { zone: "副手武器", label: "武器", row: 52 },
      { zone: "防具", label: "防具", row: 50 },
      { zone: "配饰", label: "配饰", row: 56 },
      { zone: "背包", label: "背包", row: 61 },
      { zone: "旅行腰包", label: "旅行腰包", row: 72 },
      { zone: "杂物包", label: "杂物", row: 78 }
    ];
    function isEquipPlaceholder(nm) {
      if (!nm) return true;
      nm = String(nm).trim();
      if (nm === "自选武器" || nm.indexOf("自选") === 0) return true;
      return false;
    }
    for (var ei = 0; ei < eqMap.length; ei++) {
      var slot = eqMap[ei];
      var items = state.equipment[slot.zone] || [];
      var writeIdx = 0;
      for (var ii = 0; ii < items.length && slot.row + writeIdx <= 100; ii++) {
        var eqItemName = items[ii];
        if (typeof eqItemName === 'object') eqItemName = eqItemName.item || eqItemName.name || '';
        if (!eqItemName || isEquipPlaceholder(eqItemName)) continue;
        if (writeIdx === 0) set("I" + slot.row, slot.label);
        set("K" + (slot.row + writeIdx), String(eqItemName));
        writeIdx++;
      }
    }
  }

  // Racial traits（模板 I/K 仅 112–117）
  var _exportRacial = exportRacialTraits(state);
  if (_exportRacial.length > 0) {
    for (var ri = 0; ri < Math.min(_exportRacial.length, XLSX_TRAIT_SLOT_COUNT); ri++) {
      var rt = _exportRacial[ri];
      set("I" + (XLSX_TRAIT_SLOT_START + ri), rt.n || rt.name || rt);
      if (rt.d || rt.desc || rt.effect) set("K" + (XLSX_TRAIT_SLOT_START + ri), rt.d || rt.desc || rt.effect || "");
    }
  }

  // Class features（模板 O/Q 仅 112–117）
  var _exportClassFeats = exportClassFeatures(state);
  if (_exportClassFeats.length > 0) {
    for (var ci = 0; ci < Math.min(_exportClassFeats.length, XLSX_TRAIT_SLOT_COUNT); ci++) {
      var cf = _exportClassFeats[ci];
      set("O" + (XLSX_TRAIT_SLOT_START + ci), cf.n || cf.name || cf);
      if (cf.d || cf.desc || cf.effect) set("Q" + (XLSX_TRAIT_SLOT_START + ci), cf.d || cf.desc || cf.effect || "");
    }
  }

  // Skills (B-M columns, rows 123-162)
  normalizeAllSkillSubs();
  var mainSkills = (state.skills || []).filter(isMainSkillOccupant);
  /** 同名技能优先按 src / 主职匹配，避免「猛击」等串到其他职业 */
  function lookupSkill(name, preferClass) {
    if (!name || typeof SKILL_DATA === 'undefined') return null;
    var prefer = preferClass || "";
    var fallback = null, cn, arr, i, hit;
    if (prefer && SKILL_DATA[prefer]) {
      arr = SKILL_DATA[prefer];
      for (i = 0; i < arr.length; i++) {
        if (arr[i].name === name || arr[i].n === name) return arr[i];
      }
    }
    for (cn in SKILL_DATA) {
      if (!Object.prototype.hasOwnProperty.call(SKILL_DATA, cn)) continue;
      arr = SKILL_DATA[cn];
      if (!arr) continue;
      for (i = 0; i < arr.length; i++) {
        hit = arr[i];
        if (hit.name === name || hit.n === name) {
          if (!fallback) fallback = hit;
        }
      }
    }
    return fallback;
  }
  function skillExportDesc(sk, skRef) {
    if (sk.ds || sk.desc || sk.description) return sk.ds || sk.desc || sk.description || "";
    if (skRef && skRef.description && skRef.description[0]) return skRef.description[0];
    if (skRef && skRef.fields && skRef.fields["描述"]) return skRef.fields["描述"];
    return "";
  }
  function skillExportCost(sk, skRef) {
    if (sk.cost || sk.fp) return sk.cost || sk.fp || "";
    if (skRef && skRef.cost && skRef.cost.fp) return skRef.cost.fp;
    if (skRef && skRef.fields && skRef.fields["疲劳消耗"]) return skRef.fields["疲劳消耗"];
    return "";
  }
  for (var si = 0; si < mainSkills.length && 123 + si <= 162; si++) {
    var sk = mainSkills[si];
    var skName = sk.n || sk.name || "";
    var skPrefer = sk.src || sk.source || cl.name || "";
    var skRef = lookupSkill(skName, skPrefer);
    var _skColor = getStyleColorForSkill(sk, skPrefer);
    set("B" + (123 + si), skName, true, _skColor ? (styleIdMap[_bMainXf + ":" + _skColor] || "") : "");
    set("D" + (123 + si), sk.tm || sk.time || (skRef && skRef.fields ? skRef.fields['施展时间'] : "") || "");
    set("E" + (123 + si), sk.range || (skRef && skRef.fields ? skRef.fields['施展距离'] : "") || "");
    set("F" + (123 + si), sk.dur || sk.duration || (skRef && skRef.fields ? skRef.fields['持续时间'] : "") || "");
    set("H" + (123 + si), skillExportCost(sk, skRef));
    set("I" + (123 + si), skPrefer);
    set("J" + (123 + si), skillExportDesc(sk, skRef));
  }

  // Talents (O column) — grouped by tier; clear stale cells then fill
  var _talentTierMap = buildTalentTierRowMap(strings, sh.text);
  fillXlsxTalents(set, state.talent_tree || [], _talentTierMap);
  fillXlsxBlueprints(set, state.blueprints || []);

  // Subclass skills (rows 168-209)
  var subSkills = (state.skills || []).filter(isSubSkillOccupant);
  for (var ssi = 0; ssi < subSkills.length && 168 + ssi <= 209; ssi++) {
    var ssk = subSkills[ssi];
    var sskName = ssk.n || ssk.name || "";
    var sskPrefer = ssk.src || ssk.source || (sc ? sc.name : "") || "";
    var sskRef = lookupSkill(sskName, sskPrefer);
    var _sskColor = getStyleColorForSkill(ssk, sskPrefer);
    set("B" + (168 + ssi), sskName, true, _sskColor ? (styleIdMap[_bSubXf + ":" + _sskColor] || "") : "");
    set("D" + (168 + ssi), ssk.tm || ssk.time || (sskRef && sskRef.fields ? sskRef.fields['施展时间'] : "") || "");
    set("E" + (168 + ssi), ssk.range || (sskRef && sskRef.fields ? sskRef.fields['施展距离'] : "") || "");
    set("F" + (168 + ssi), ssk.dur || ssk.duration || (sskRef && sskRef.fields ? sskRef.fields['持续时间'] : "") || "");
    set("H" + (168 + ssi), skillExportCost(ssk, sskRef));
    set("I" + (168 + ssi), sskPrefer);
    set("J" + (168 + ssi), skillExportDesc(ssk, sskRef));
  }

  // 未持有栏位划掉：技能 / 图纸(专业) / 天赋超出容量的模板行
  markUnavailableExportSlots(set, strikeStyleId, {
    mainSkillCap: typeof calcSkillSlots === "function" ? calcSkillSlots(0) : 0,
    mainSkillFilled: mainSkills.length,
    subSkillCap: typeof calcSkillSlots === "function" ? calcSkillSlots(1) : 0,
    subSkillFilled: subSkills.length,
    blueprintCap: typeof calcBlueprintSlots === "function" ? calcBlueprintSlots() : 0,
    blueprintFilled: (state.blueprints || []).length,
    tierRowMap: _talentTierMap,
    isTierUnlocked: typeof isTierUnlocked === "function" ? isTierUnlocked : function () { return true; },
    getTalentCap: typeof getTalentTierlotCap === "function" ? getTalentTierlotCap : function () { return 5; }
  });

  // XP/SP（含 0）
  set("U46", String(state.xp != null ? state.xp : 0));
  ensureSpState();
  set("U51", String(state.sp_points != null ? state.sp_points : 0));

  // Weight/Language/Profession
  var _carryStr = ((state.attrs && state.attrs["力量"]) || 8) + ((state.profs && state.profs["力量"] && state.profs["力量"]["承重"]) || 0);
  set("Q3", String(_carryStr * 5));
  set("Q4", String(_carryStr * 10));
  set("Q5", String(_carryStr * 15));
  if (state.languages && state.languages.length > 0) set("P7", state.languages.join(", "));
  if (state.professionals && state.professionals.length > 0) set("Q8", state.professionals[0]);

  // Rebuild XMLs
  ss.text = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strings.length + '" uniqueCount="' + strings.length + '">\n' + siBlocks.join("\n") + '\n</sst>';
  sh.text = xml;

  // Recompress modified entries
  for (var ei = 0; ei < entries.length; ei++) {
    var en = entries[ei];
    if (en.name === "xl/worksheets/sheet1.xml" || en.name === "xl/sharedStrings.xml" || en.name === "xl/styles.xml") {
      var b = new TextEncoder().encode(en.text);
      var packed = await _xlsxPackEntry(b);
      en.rawData = packed.data;
      en.compSize = packed.data.length;
      en.uncompSize = b.length;
      en.method = packed.method;
      en.uncompData = b;
      delete en.crc32;
    }
  }

  
      if (typeof injectPortrait === "function") {
        var portraitOk = injectPortrait(state, entries);
        if (state.portrait && portraitOk === false && state.portrait.indexOf("data:image/") === 0) {
          console.warn("Portrait skipped during export (size or format)");
        }
      }
// Convert entries to ZIP format
  var zipEntries = [];
  for (var ei = 0; ei < entries.length; ei++) {
    var en = entries[ei];
    zipEntries.push({
      name: en.name,
      data: en.rawData,
      method: en.method,
      compSize: en.compSize,
      uncompSize: en.uncompSize,
      uncompData: en.uncompData,
      crc32: en.crc32
    });
  }

  var zipBytes = _xlsxBuildZip(zipEntries);
  var fileName = buildExportFileName(state);
  if (window.mobileBridge && typeof window.mobileBridge.saveFile === "function") {
    var u8 = zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes);
    var b64 = "";
    var chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) {
      b64 += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    window.mobileBridge.saveFile(btoa(b64), fileName);
    return;
  }
  var blob = new Blob([zipBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function exportAllSaves(){
  var saves={};
  var count=0;
  for(var i=0;i<localStorage.length;i++){
    var key=localStorage.key(i);
    if(key.indexOf("char_")===0){
      saves[key]=localStorage.getItem(key);
      count++;
    }
  }
  if(count===0){SB_toast("暂无存档可导出");return;}
  var meta={exportedAt:new Date().toISOString(),version:"1.0",charCount:count};
  var blob=new Blob([JSON.stringify({meta:meta,saves:saves},null,2)],{type:"application/json"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  var d=new Date();a.download="斯诺德存档_"+d.getFullYear()+"-"+(d.getMonth()+1).toString().padStart(2,"0")+"-"+d.getDate().toString().padStart(2,"0")+"_"+d.getHours().toString().padStart(2,"0")+d.getMinutes().toString().padStart(2,"0")+d.getSeconds().toString().padStart(2,"0")+".json";
  a.click();URL.revokeObjectURL(a.href);
  SB_toast("已导出 "+count+" 个角色存档");
}
function importSaves(){
  var input=document.createElement("input");
  input.type="file";input.accept=".json";
  input.onchange=function(e){
    var file=e.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var data=JSON.parse(ev.target.result);
        if(!data.saves){SB_toast("存档文件格式无效");return;}
        var keys=Object.keys(data.saves);var overwrites=[];
        for(var i=0;i<keys.length;i++){
          if(localStorage.getItem(keys[i])!==null)overwrites.push(keys[i]);
        }
        var confirmMsg="将导入 "+keys.length+" 个存档";
        if(overwrites.length>0)confirmMsg+="\n\n以下存档将被覆盖：\n"+overwrites.join("\n");
        if(!confirm(confirmMsg+"\n\n确认导入？"))return;
        for(var i=0;i<keys.length;i++)localStorage.setItem(keys[i],data.saves[keys[i]]);
        SB_toast("已导入 "+keys.length+" 个存档\n\n请刷新页面查看");
        location.reload();
      }catch(ex){SB_toast("文件解析失败："+ex.message);}
    };
    reader.readAsText(file);
  };
  input.click();
}

// ESC 快捷键——角色面板返回启动台，提示保存
(function(){
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var tag=e.target.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    var overlay=document.querySelector('#searchOverlay:not(.hidden), .nav-overlay.show, .nav-drawer.open, #modalOverlay');
    if(overlay)return;
    
    // Check if we're on character panel
    var urlParams=new URLSearchParams(location.search);
    if(!urlParams.get('char'))return; // Not on panel page, let global handler work
    
    e.preventDefault();
    var changed=hasUnsavedChanges();
    if(changed){
      var r=confirm('当前角色有未保存的更改，是否保存后返回？\n\n"确定" = 保存并返回\n"取消" = 不保存直接返回');
      if(r){saveCurrentSlot();}
    }
    // Always navigate regardless of save choice
    setTimeout(function(){ location.href='角色选择页.html'; }, 100);
  });
  
  // Check if current state differs from last saved
  function hasUnsavedChanges(){
    try{
      if(typeof state==='undefined')return false;
      var urlParams=new URLSearchParams(location.search);
      var cn=urlParams.get('char');var sl=parseInt(urlParams.get('slot'))||1;
      var key='_snowd_last_save_'+cn+'_'+sl;
      var prev=localStorage.getItem(key);
      var curr=JSON.stringify(state);
      localStorage.setItem(key,curr);
      return prev!==null&&prev!==curr;
    }catch(e){return false;}
  }
  
  function saveCurrentSlot(){
    try{
      var urlParams=new URLSearchParams(location.search);
      var cn=urlParams.get('char');var sl=parseInt(urlParams.get('slot'))||1;
      var key='char_'+cn+'_slot'+sl;
      localStorage.setItem(key,JSON.stringify(state));
      localStorage.setItem('_snowd_last_save_'+cn+'_'+sl,JSON.stringify(state));
    }catch(e){}
  }
})();

if (typeof window !== 'undefined') {
  window.snowdPanel = {
    getSnapshot: getStateSnapshot,
    getMainClassName: function() {
      return (state.classes && state.classes[0] && state.classes[0].name) || '';
    },
    hasCharacter: function() {
      return !!(CURRENT_CHAR || (state && state.name));
    },
    isPanelPage: function() {
      return /角色面板\.html/i.test(location.pathname || '');
    },
  };
}

