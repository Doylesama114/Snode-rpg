var ATTR_NAMES=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
/** alert 替代：Electron（contextIsolation）下 alert 不可见；优先 toast，无 toast 环境回退 alert（v1.0.7235） */
function SB_toast(msg, cls) {
  if (typeof window !== 'undefined' && window.toast) { window.toast(msg, cls || 'warn'); return; }
  if (typeof window !== 'undefined' && window.SD_alert) { window.SD_alert(msg); return; }
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
"hp":10,"fp":8,"raceSize":"","_hpManual":false,"_fpManual":false,"_hpCurrent":null,"_fpCurrent":null,
"dragonType":"","dragonBreath":"","dragonResistance":"",
"raceChoices":{"extraAttrs":[],"humanFreeSkill":"","raceSaves":[],"raceSkillChoice":"","raceProfInput":"","wingfolkHasCommon":true},
"classChoices":{"weaponSpec":"","weaponSpecBonus":"","specChoices":{}},
"backgroundChoices":{"deity":"","contacts":"","scamType":"","missionChannel":"","academicDomain":"","crime":"","seclusion":"","militaryRole":"","foreignOrigin":"","companion":""},
"bgOtherPicks":[],
"story":"","personality":"","traits":"","ideals":"","bonds":"","flaws":"","deity":"","deityAttr":"","patron":"","contacts":"","scamType":"","missionChannel":"","academicDomain":"","crime":"","seclusion":"","militaryRole":"","foreignOrigin":"","companion":"","sportPreference":"","weapon_specs":[],
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
    || key === "_chargenOrigin"
    || key === "_hpManual"
    || key === "_fpManual"
    || key === "_hpCurrent"
    || key === "_fpCurrent";
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
  var target = "角色存档页.html?char=" + (CURRENT_CHAR || state.name);
  if (state._dirty) {
    SD_confirm("当前角色有未保存的更改，是否保存？", function() {
      showSaveDialog(function(slotIndex) {
        if (saveState(slotIndex)) window.location.href = target;
      });
    }, function() {
      // 不保存 → 直接返回
      window.location.href = target;
    });
    return;
  }
  window.location.href = target;
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
  function saveThenProceed() {
    if (state._dirty) {
      SD_confirm("当前角色有未保存的更改，是否先保存？\n\n确定 = 保存后继续\n取消 = 不保存直接继续", function() {
        showSaveDialog(function (slotIndex) {
          if (saveState(slotIndex)) proceed();
        });
      }, proceed);
      return;
    }
    proceed();
  }
  if (hasProgressBeyondCreation(state)) {
    SD_confirm("重新车卡将基于创建时的选项另存为新的 1 级角色，不会保留当前等级与已学技能；该操作无法撤回。原角色存档不受影响。是否继续？", saveThenProceed);
    return;
  }
  saveThenProceed();
}
function calcMod(s){return Math.floor((s-10)/2)}function mStr(v){return v>=0?'+'+v:v}


function parseHpBonus(value, raceSize) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  if (typeof value === "string") {
    var parts = value.split("/");
    if (parts.length === 2) {
      var small = parseInt(parts[0], 10); if (isNaN(small)) small = 0;
      var large = parseInt(parts[1], 10); if (isNaN(large)) large = 0;
      return (raceSize && String(raceSize).indexOf("小") >= 0) ? small : large;
    }
    var m = value.match(/([-+])?\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  return 0;
}


function calcTotalHP(mc,ml,sc,sl,con,race,bg,fb,raceSize){


  if(!mc||!ml)return 0;var cm=calcMod(con);



  var hd=REF_CLASSES[mc];var f=hd&&hd.hp_formula?hd.hp_formula.first:8;


  var u=hd&&hd.hp_formula?hd.hp_formula.level_up:2;


  var rhp=0;if(race&&REF_RACES[race]){var rs=raceSize||(REF_RACES[race].size||"");rhp=parseHpBonus(REF_RACES[race]["hp_bonus"],rs);}var bhp=0;if(bg&&REF_BACKGROUNDS&&REF_BACKGROUNDS[bg]){bhp=parseHpBonus(REF_BACKGROUNDS[bg]["hp_bonus"],"");}var hp=f+cm+rhp+bhp+u*(ml-1)+cm*(ml-1);


  if(sc&&sl>0){


    var sd=REF_CLASSES[sc];


    var su=sd&&sd.hp_formula?sd.hp_formula.level_up:2;


    // Sub class: each level gets (level_up_hp+con_mod), no first-level bonus


    hp+=(su+cm)*(sl-1);


  }


  // Add flat bonus (feats, race, background)


  if(fb) hp+=fb;


  return Math.max(0, Number(hp) || 0);}


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
  "力量":["豁免","威力","承重","运动","运动-跳跃","运动-攀爬","运动-游泳","运动-自定义"],
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
  "守望者": {"守护":"D6EAFF","警戒":"FFF0B3","坚韧":"FFD0CC","原野":"C8F7C5"},
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
  "萨满祭司": {"闪电箭":"风暴","烈焰冲击":"火焰","治疗波":"水源","大地之盾":"大地"},
  "守望者": {"挫志打击":"守护","警戒之眼":"警戒","盾牌格挡":"守护","荒野医疗":"原野"}
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
    if (!feats[i]) continue;
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
    if (!list[i]) continue;
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
    { start: 47, max: 3 },  // 主手武器 47-49
    { start: 51, max: 1 },  // 防具 51
    { start: 53, max: 3 },  // 副手武器 53-55
    { start: 57, max: 3 },  // 配饰 57-59
    { start: 62, max: 9 },  // 背包 62-70
    { start: 73, max: 4 },  // 旅行腰包 73-76
    { start: 79, max: 9 }   // 杂物 79-87
  ];
  var ri, ii;
  for (ri = 0; ri < ranges.length; ri++) {
    for (ii = 0; ii < ranges[ri].max; ii++) set("K" + (ranges[ri].start + ii), "", false);
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
    if (!talents[ti]) continue;
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
    if (!feats[fi]) continue;
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

function _joinList(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.filter(function (x) { return x != null && x !== ""; }).join("、");
  return String(v);
}

function _raceChoiceValue(state, key) {
  var rc = state.raceChoices || {};
  return rc[key];
}

function exportRacialTraits(state) {
  var base = [], i;
  if (state.racial_traits && state.racial_traits.length) {
    base = state.racial_traits.map(function (t) { return { name: t.name || t.n || "", desc: t.desc || t.d || t.effect || "" }; });
  } else {
    var rd = typeof REF_RACES !== "undefined" && state.race ? REF_RACES[state.race] : null;
    if (rd && rd.talents) base = rd.talents.map(function (t) { return { name: t.name, desc: t.desc }; });
  }
  var race = state.race || "";
  var extraAttrs = _joinList(_raceChoiceValue(state, "extraAttrs"));
  var humanFree = _raceChoiceValue(state, "humanFreeSkill") || "";
  var raceSaves = _joinList(_raceChoiceValue(state, "raceSaves"));
  var raceSkill = _joinList(_raceChoiceValue(state, "raceSkillChoice"));
  var raceProf = _raceChoiceValue(state, "raceProfInput") || "";
  var size = state.raceSize || "";
  for (i = 0; i < base.length; i++) {
    var name = base[i].name || "", desc = base[i].desc || "";
    if (race === "龙裔") {
      if (name.indexOf("龙族血脉") >= 0 && state.dragonType) desc = "龙种：" + state.dragonType;
      else if (name.indexOf("巨龙吐息") >= 0 && state.dragonBreath) desc = "吐息：" + state.dragonBreath;
      else if (name.indexOf("传承抗性") >= 0 && state.dragonResistance) desc = "抗性：" + state.dragonResistance;
    } else if (race === "半精灵") {
      if (name.indexOf("精灵恩惠") >= 0 && extraAttrs) desc = "属性选择：" + extraAttrs;
    } else if (race === "人类") {
      if (name.indexOf("中庸") >= 0 && humanFree) desc = "自由熟练：" + humanFree;
    } else if (race === "斑猫人" || race === "豹兽人") {
      if (name.indexOf("猫之迅疾") >= 0 && raceSaves) desc = "豁免选择：" + raceSaves;
    } else if (race === "地精") {
      if (name.indexOf("化学达人") >= 0 && raceSkill) desc = "技能选择：" + raceSkill;
    } else if (race === "牛头人") {
      if (name.indexOf("威慑力") >= 0 && raceSkill) desc = "技能选择：" + raceSkill;
    } else if (race === "狐人") {
      if (name.indexOf("背包客") >= 0 && raceSkill) desc = "技能选择：" + raceSkill;
    } else if (race === "龟人") {
      if (name.indexOf("悠闲生活") >= 0 && raceProf) desc = "自定义专业：" + raceProf;
    }
    if (size && (race === "犬牙族" || race === "翼空族")) {
      if (name.indexOf("黑暗视觉") >= 0 || name.indexOf("飞行") >= 0) {
        desc = desc ? (desc + "；体型：" + size) : ("体型：" + size);
      }
    }
    base[i] = { name: name, desc: desc };
  }
  return base;
}

function exportClassFeatures(state) {
  var feats = [], ci, cn, rfc, si;
  if (state.class_features && state.class_features.length) {
    feats = state.class_features.map(function (f) { return { name: f.name || f.n || "", desc: f.desc || f.d || f.effect || "" }; });
  } else if (state.classes) {
    for (ci = 0; ci < state.classes.length; ci++) {
      cn = state.classes[ci].name;
      if (!cn) continue;
      rfc = typeof REF_CLASSES !== "undefined" ? REF_CLASSES[cn] : null;
      if (rfc && rfc.specializations) {
        for (si = 0; si < rfc.specializations.length; si++) {
          feats.push({ name: rfc.specializations[si].name, desc: rfc.specializations[si].desc + "（" + cn + "）" });
        }
      }
    }
  }
  var cc = state.classChoices || {};
  var sc = cc.specChoices || {};
  var mainCls = (state.classes && state.classes[0] && state.classes[0].name) || "";
  for (ci = 0; ci < feats.length; ci++) {
    var fname = feats[ci].name || "", fdesc = feats[ci].desc || "";
    var fcls = mainCls;
    if (fname.indexOf("[") === 0 && fname.indexOf("]") > 0) fcls = fname.slice(1, fname.indexOf("]"));
    if ((fcls === "战士" || fcls === "猎人") && fname.indexOf("武器专精") >= 0 && cc.weaponSpec) {
      fdesc = cc.weaponSpec + (cc.weaponSpecBonus ? ("：" + cc.weaponSpecBonus) : "");
    } else if ((fcls === "战士" || fcls === "蛮斗士") && fname.indexOf("运动健将") >= 0 && sc["运动健将"] && sc["运动健将"].skill) {
      fdesc = (sc["运动健将"].attr ? (sc["运动健将"].attr + "·") : "") + sc["运动健将"].skill;
    } else if (fcls === "法师" && fname.indexOf("奥法学者") >= 0 && sc["奥法学者"] && sc["奥法学者"].skill) {
      fdesc = sc["奥法学者"].skill;
    } else if (fcls === "法师" && fname.indexOf("知识传承") >= 0 && sc["知识传承"] && sc["知识传承"].skill) {
      fdesc = sc["知识传承"].skill;
    } else if (fcls === "奇械师" && fname.indexOf("万用模组") >= 0 && sc["万用模组"] && sc["万用模组"].skill) {
      fdesc = sc["万用模组"].skill;
    } else if (fcls === "牧师" && fname.indexOf("神圣领域") >= 0 && state.deity) {
      fdesc = "信奉：" + state.deity + (state.deityAttr ? ("（" + state.deityAttr + "）") : "");
    } else if (fcls === "魔契师" && fname.indexOf("宗主契约") >= 0 && state.patron) {
      fdesc = "宗主：" + state.patron;
    }
    feats[ci] = { name: fname, desc: fdesc };
  }
  return feats;
}

function exportBackgroundChoiceText(state) {
  var bc = state.backgroundChoices || {};
  var bg = state.background || "";
  if (bg === "侍僧") {
    var d = bc.deity || state.deity || "";
    if (!d) return "";
    var da = bc.deityAttr || state.deityAttr || "";
    return "神祇：" + d + (da ? ("（" + da + "）") : "");
  }
  if (bg === "侦探") {
    var c = bc.contacts || state.contacts || "";
    return c ? ("联系渠道：" + c) : "";
  }
  if (bg === "骗子") {
    var st = bc.scamType || state.scamType || "";
    if (!st) return "";
    var stGear = _bgDetail(state, "scam_details", st, "gear");
    return "偏好骗局：" + st + (stGear ? ("（装备：" + stGear + "）") : "");
  }
  if (bg === "职业杀手") {
    var mc = bc.missionChannel || state.missionChannel || "";
    return mc ? ("任务渠道：" + mc) : "";
  }
  if (bg === "教授") {
    var ad = bc.academicDomain || state.academicDomain || "";
    if (!ad) return "";
    var adProf = _bgDetail(state, "academic_details", ad, "prof");
    var adGear = _bgDetail(state, "academic_details", ad, "gear");
    var adExtra = [];
    if (adProf) adExtra.push("熟练度加成：" + adProf);
    if (adGear) adExtra.push("额外装备：" + adGear);
    return "学术领域：" + ad + (adExtra.length ? ("（" + adExtra.join("；") + "）") : "");
  }
  if (bg === "恶棍") {
    var cr = bc.crime || state.crime || "";
    if (!cr) return "";
    var crContact = _bgDetail(state, "crime_details", cr, "contact");
    return "罪名：" + cr + (crContact ? ("（接头人：" + crContact + "）") : "");
  }
  if (bg === "隐士") {
    var se = bc.seclusion || state.seclusion || "";
    return se ? ("隐居原因：" + se) : "";
  }
  if (bg === "士兵") {
    var mr = bc.militaryRole || state.militaryRole || "";
    if (!mr) return "";
    var mrProf = _bgDetail(state, "military_roles", mr, "prof");
    var mrGear = _bgDetail(state, "military_roles", mr, "gear");
    var mrExtra = [];
    if (mrProf) mrExtra.push("熟练度加成：" + mrProf);
    if (mrGear) mrExtra.push("额外装备：" + mrGear);
    return "专职：" + mr + (mrExtra.length ? ("（" + mrExtra.join("；") + "）") : "");
  }
  if (bg === "外乡人") {
    var fo = bc.foreignOrigin || state.foreignOrigin || "";
    if (!fo) return "";
    var foDesc = _bgDetail(state, "foreign_origins", fo, "desc");
    return "造访原因：" + fo + (foDesc ? ("（" + foDesc + "）") : "");
  }
  if (bg === "驯兽师") {
    var cp = bc.companion || state.companion || "";
    return cp ? ("动物伙伴：" + cp) : "";
  }
  return "";
}
/* 从背景数据里取某个选项对应的附加说明（熟练度加成 / 额外装备 / 接头人 / 加成等） */
function _bgDetail(state, field, value, key) {
  if (!value) return "";
  var all = (typeof BG_PERSONALITY !== "undefined" && BG_PERSONALITY) || null;
  if (!all) return "";
  var data = all[state.background || ""];
  if (!data || !data[field]) return "";
  var arr = data[field] || [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    if (it && (it.name === value || it.level === value)) return it[key] || "";
  }
  return "";
}

function exportBackgroundExtraText(state) {
  var picks = state.bgOtherPicks || [];
  var sport = state.sportPreference || "";
  var out = [];
  if (picks.length) {
    var label = "额外：";
    if (state.background === "乐师") label = "乐器：";
    else if (state.background === "赌徒" || state.background === "水手" || state.background === "士兵" || state.background === "雇佣兵") label = "赌具：";
    out.push(label + _joinList(picks));
  }
  if (sport) out.push("偏好运动：" + sport);
  return out.join("；");
}

function exportMaterialPackNames(state) {
  var arr = (state.equipment && state.equipment["材料包"]) || [];
  var names = [];
  for (var i = 0; i < arr.length && names.length < 2; i++) {
    var p = arr[i];
    if (!p) continue;
    var n = (typeof p === "string") ? p : (p.type || p.item || p.name || "");
    if (n && names.indexOf(n) < 0) names.push(n);
  }
  return names;
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
      showSplitDialog(item, total, function(amt) {
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
      });
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
  var cat = (typeof SPECIAL_FEAT_CATEGORIES !== "undefined" && SPECIAL_FEAT_CATEGORIES[name]) ? SPECIAL_FEAT_CATEGORIES[name] : "";
  var prereqLine = (prereq && prereq !== "无")
    ? "前置要求：" + prereq + "（仅提示，不强制）"
    : "前置条件：无";
  var typeLabel = "";
  if(fd.effects.type !== "description_only"){
    var typeMap={"attribute":"属性","multi":"复合","proficiency":"熟练度","professional":"专业","attribute_health":"属性+生命","health_growth":"生命成长","attribute_proficiency":"属性+熟练","attribute_boost":"属性强化","sp_pack":"技能点","xp_pack":"经验值","armor_ac":"防御","heavy_armor":"重甲防御","extra_slot":"额外槽","professional_sp":"专业+技能点","panel":"面板加成","description_only":"规则"};
    typeLabel = typeMap[fd.effects.type] || fd.effects.type;
  }
  var tier = cat ? ("特殊专长 · " + cat) : "特殊专长";
  var styleInfo = typeLabel ? "[" + typeLabel + "]" : "";
  showSkillPreview(name, styleInfo, tier, prereqLine + "<br><br>" + desc, null);
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

function showExtraSlotPicks(featName, total, picked) {
  var left = total - picked.length;
  var opts = ["技能槽", "一阶天赋槽", "二阶天赋槽", "三阶天赋槽", "四阶天赋槽", "五阶天赋槽", "六阶天赋槽", "七阶天赋槽", "八阶天赋槽", "九阶天赋槽"];
  var h = "<div style='padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0'>";
  h += "<div style='font-size:16px;font-weight:bold;margin-bottom:4px;color:#e8a86a'>额外槽</div>";
  h += "<div style='font-size:12px;color:#b09070;margin-bottom:12px'>还差 " + left + " 个槽位待选择（共 " + total + " 个，可重复选同类）" + (picked.length ? "；已选：" + picked.join("、") : "") + "</div>";
  h += "<div style='display:flex;flex-wrap:wrap;gap:6px'>";
  for (var i = 0; i < opts.length; i++) {
    h += "<div data-opt='" + opts[i] + "' onclick='pickExtraSlotOpt(this.dataset.opt)' style='padding:8px 14px;background:#3d3020;border:1px solid #5a4a30;border-radius:6px;cursor:pointer;font-size:13px'>" + opts[i] + "</div>";
  }
  h += "</div></div>";
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._extraSlotPending = { featName: featName, total: total, picked: picked };
}

function pickExtraSlotOpt(opt) {
  var p = window._extraSlotPending;
  if (!p) return;
  p.picked.push(opt);
  if (p.picked.length >= p.total) {
    var done = p.picked;
    window._extraSlotPending = null;
    addSpecialFeat(p.featName, { picks: done });
  } else {
    showExtraSlotPicks(p.featName, p.total, p.picked);
  }
}

function removeSpecialFeat(name) {
  SD_confirm("确定移除特殊专长「"+name+"」吗？", function() {
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
  });
}

function showSpecialFeatSelector() {
  closeReplaceModal();
  var overlay = document.createElement("div");
  overlay.id = "specialFeatOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";
  document.body.appendChild(overlay);

  var FEAT_CATS = ["全部", "战斗强化", "防御与生存", "属性与潜力", "施法与神秘", "探索与冒险", "社交与扮演", "生产与生活", "特殊彩蛋"];
  var html = "<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:16px;max-width:700px;width:95%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";
  html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px'>";
  html += "<span style='font-size:18px;color:#e8a86a;font-weight:bold'>选择特殊专长</span>";
  html += "<span id='featSelCount' style='font-size:12px;color:#8a7a60'></span>";
  html += "<button onclick='closeSpecialFeatSelector()' style='background:none;border:none;color:#888;font-size:22px;cursor:pointer'>&times;</button></div>";
  html += "<input id='featSelSearch' type='text' placeholder='搜索专长名称 / 前置条件 / 效果…' oninput='refreshSpecialFeatSelector()' style='width:100%;box-sizing:border-box;padding:9px 12px;border-radius:8px;border:1px solid #5a4a30;background:#241f1a;color:#f0e0d0;font-size:14px;font-family:inherit;margin-bottom:10px;outline:none'>";
  html += "<div id='featSelCats' style='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px'>";
  for (var ci = 0; ci < FEAT_CATS.length; ci++) {
    html += "<button data-cat='" + FEAT_CATS[ci] + "' onclick='pickFeatCategory(this)' class='featCatChip' style='padding:4px 12px;border-radius:999px;border:1px solid #5a4a30;background:#241f1a;color:#b09878;cursor:pointer;font-size:12px;font-family:inherit'>" + FEAT_CATS[ci] + "</button>";
  }
  html += "</div>";
  html += "<div id='featSelList' style='overflow-y:auto;padding-right:4px;min-height:160px'></div>";
  html += "</div>";
  overlay.innerHTML = html;
  window._featSelState = { query: "", cat: "全部" };
  refreshSpecialFeatSelector();
}

function _featSelEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _featCardHtml(item, idx, isLearned) {
  var fn = item.fn, fd = item.fd, cat = item.cat;
  var prereq = fd.prerequisite || "无";
  var hasPrereq = prereq && prereq !== "无";
  var desc = (fd.effects && fd.effects.description) || "";
  var h = "<div style='background:" + (isLearned ? "#37302a" : "#332c25") + ";border:1px solid " + (isLearned ? "#6a5a3a" : "#4a3a2a") + ";border-radius:8px;padding:10px 12px;margin-bottom:6px'>";
  h += "<div style='display:flex;align-items:center;gap:8px;flex-wrap:wrap'>";
  h += "<span style='cursor:pointer;font-weight:bold;color:" + (isLearned ? "#b09070" : "#e8d8c0") + ";font-size:15px' onclick='toggleFeatCard(" + idx + ")'>" + _featSelEsc(fn) + "</span>";
  h += "<span style='font-size:10px;padding:1px 8px;border-radius:999px;background:#3d3020;color:#c8a878;border:1px solid #5a4a30'>" + _featSelEsc(cat) + "</span>";
  if (hasPrereq) {
    h += "<span title='前置条件（仅提示，不强制）' style='font-size:10px;color:#e8b050;background:#3a3020;padding:1px 8px;border-radius:999px;border:1px dashed #8a6a30'>⚠ 前置</span>";
  }
  if (isLearned) {
    h += "<span style='margin-left:auto;font-size:11px;color:#6a8a5a'>已学习</span>";
  } else {
    h += "<span style='margin-left:auto'></span>";
    h += "<button data-feat=\"" + _featSelEsc(fn) + "\" onclick='addSpecialFeat(this.dataset.feat)' style='padding:3px 12px;background:#3a5a3a;border:none;border-radius:6px;color:#e8f0e0;cursor:pointer;font-size:13px;font-family:inherit'>学习</button>";
  }
  h += "</div>";
  if (hasPrereq) {
    h += "<div style='font-size:11px;color:#e8b050;margin-top:5px'>前置要求：" + _featSelEsc(prereq) + "（仅提示，不强制）</div>";
  }
  h += "<div id='featCardDetail-" + idx + "' style='display:none;margin-top:8px;border-top:1px dashed #4a3a2a;padding-top:8px'>";
  h += "<div style='font-size:12px;color:#c0b090;line-height:1.75;white-space:pre-wrap'>" + _featSelEsc(desc) + "</div>";
  h += "</div>";
  h += "</div>";
  return h;
}

function refreshSpecialFeatSelector() {
  var listEl = document.getElementById("featSelList");
  if (!listEl) return;
  var st = window._featSelState || { query: "", cat: "全部" };
  var q = (st.query || "").toLowerCase();
  var featKeys = Object.keys(SPECIAL_FEATS).sort();
  var learned = {}, learnedN = 0;
  for (var si = 0; si < state.special_feats.length; si++) {
    var sn = typeof state.special_feats[si] === "string" ? state.special_feats[si] : state.special_feats[si].name;
    if (SPECIAL_FEATS[sn]) { learned[sn] = true; learnedN++; }
  }
  var cats = (typeof SPECIAL_FEAT_CATEGORIES !== "undefined") ? SPECIAL_FEAT_CATEGORIES : {};
  var learnedList = [], otherList = [];
  for (var i = 0; i < featKeys.length; i++) {
    var fn = featKeys[i];
    var fd = SPECIAL_FEATS[fn];
    var cat = cats[fn] || "未分类";
    if (st.cat !== "全部" && cat !== st.cat) continue;
    var hay = (fn + " " + (fd.prerequisite || "") + " " + ((fd.effects && fd.effects.description) || "") + " " + cat).toLowerCase();
    if (q && hay.indexOf(q) < 0) continue;
    (learned[fn] ? learnedList : otherList).push({ fn: fn, fd: fd, cat: cat });
  }
  otherList.sort(function (a, b) {
    if (a.cat !== b.cat) return a.cat < b.cat ? -1 : 1;
    return a.fn < b.fn ? -1 : 1;
  });
  var total = learnedList.length + otherList.length;
  var countEl = document.getElementById("featSelCount");
  if (countEl) countEl.textContent = "共 " + featKeys.length + " 项 · 已学习 " + learnedN + " · 显示 " + total;
  var html = "";
  if (learnedList.length > 0) {
    html += "<div style='font-size:12px;color:#8a7a60;margin:2px 0 6px'>已学习（" + learnedList.length + "）</div>";
    for (var li = 0; li < learnedList.length; li++) html += _featCardHtml(learnedList[li], li, true);
  }
  if (learnedList.length > 0 && otherList.length > 0) {
    html += "<div style='font-size:12px;color:#8a7a60;margin:10px 0 6px'>可选（" + otherList.length + "）</div>";
  }
  for (var oi = 0; oi < otherList.length; oi++) html += _featCardHtml(otherList[oi], learnedList.length + oi, false);
  if (total === 0) html = "<div style='color:#8a7a60;text-align:center;padding:24px 0'>没有匹配的专长</div>";
  listEl.innerHTML = html;
  var searchEl = document.getElementById("featSelSearch");
  if (searchEl) st.query = searchEl.value || "";
}

function toggleFeatCard(idx) {
  var el = document.getElementById("featCardDetail-" + idx);
  if (el) el.style.display = (el.style.display === "none") ? "block" : "none";
}

function pickFeatCategory(btn) {
  var st = window._featSelState || { query: "", cat: "全部" };
  st.cat = btn.getAttribute("data-cat") || "全部";
  var chips = document.querySelectorAll("#featSelCats .featCatChip");
  for (var i = 0; i < chips.length; i++) {
    var active = chips[i].getAttribute("data-cat") === st.cat;
    chips[i].style.background = active ? "#4a6a3a" : "#241f1a";
    chips[i].style.color = active ? "#fff" : "#b09878";
    chips[i].style.borderColor = active ? "#6a8a4a" : "#5a4a30";
  }
  refreshSpecialFeatSelector();
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
      // 额外槽: 三选（技能槽/各阶天赋槽，可重复）
      if (choices.picks && Array.isArray(choices.picks)) {
        for (var pk = 0; pk < choices.picks.length; pk++) {
          var pick = choices.picks[pk];
          if (pick === "技能槽") {
            state.extra_skill_slots = Math.max(0, (state.extra_skill_slots || 0) + mult);
          } else {
            var tm = /^(.阶)天赋槽$/.exec(pick);
            if (tm) {
              if (add) {
                if (!state.extra_slots) state.extra_slots = [];
                state.extra_slots.push(tm[1]);
              } else if (state.extra_slots) {
                var ei = state.extra_slots.lastIndexOf(tm[1]);
                if (ei >= 0) state.extra_slots.splice(ei, 1);
              }
            }
          }
        }
      } else if (choices.tier && add) {
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
        SD_prompt({ title: "自定义专业熟练项", message: "请输入自定义专业熟练项名称：", placeholder: "例如：易容、陆运载具" }, function(profName) {
          if (profName && profName.trim()) {
            addSpecialFeat(name, {profName: profName.trim()});
          }
        });
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
        // 额外槽: 3 个槽位自由选择（技能槽/各阶天赋槽，可重复）
        var es = eff.extra_slot;
        if (es && es.skill_or_talent && !(choices && choices.picks)) {
          showExtraSlotPicks(name, es.count || 3, []);
          return;
        }
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
  closeSpecialFeatSelector(true);
  if (pu) { pu._done._feat=true; applyLevelUp(pu.clsIdx); }
  render();
}

function closeSpecialFeatSelector(silent) {
  closeReplaceModal();
  var ov = document.getElementById("specialFeatOverlay");
  if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  window._featSelState = null;
  if (!silent && window._pendingLevelUp) {
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
  armorName = itemName(armorName) || "";

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

/** 中甲：兽皮甲 / 鳞甲 / 胸甲 / 半身板甲（与 armorACMap 常见分级一致） */
var MEDIUM_ARMOR_NAMES = {"兽皮甲":1,"鳞甲":1,"胸甲":1,"半身板甲":1};

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

/** 面板展示用：docx 原文武器熟练（具体武器，不再只显示大类标签） */
function resolveWeaponProfDocx(className){
  var txt=(typeof CLASS_WEAPON_PROF_DOCX!=="undefined"&&CLASS_WEAPON_PROF_DOCX[className])||"";
  if(!txt) return resolveWeaponProfs(className);
  return txt.split(/[、，,]/).map(function(x){return x.trim();}).filter(Boolean);
}
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
if(state.crime)storyHtml+='<div class="misc-item"><div class="m-title">罪名</div><div>'+state.crime+'</div></div>';
if(state.seclusion)storyHtml+='<div class="misc-item"><div class="m-title">隐居原因</div><div>'+state.seclusion+'</div></div>';
if(state.militaryRole)storyHtml+='<div class="misc-item"><div class="m-title">专职</div><div>'+state.militaryRole+'</div></div>';
if(state.foreignOrigin)storyHtml+='<div class="misc-item"><div class="m-title">造访原因</div><div>'+state.foreignOrigin+'</div></div>';
if(state.companion)storyHtml+='<div class="misc-item"><div class="m-title">动物伙伴</div><div>'+state.companion+'</div></div>';
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
  state.hp=calcTotalHP(mc,ml,sc,sl,con,state.race,state.background,featHPBonus,state.raceSize);


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


      var _armorName = itemName(eqArmor[ai]) || "";


      if (_armorName == "演出戏服" || _armorName == "高档服装" || _armorName == "布衣" || _armorName == "披风") {


        aInfo = {"base": 11, "addDex": true, "dexCap": 2};


      }


    }


    if (aInfo) {


      var thisAC = aInfo.addDex ? (aInfo.base + Math.min(dexMod, aInfo.dexCap != null ? aInfo.dexCap : 999)) : aInfo.base;


      if (armorAC === null || thisAC > armorAC) armorAC = thisAC;


    }


  }


  if (armorAC === null) {


    var ac = 10 + dexMod;


  } else {


    var ac = armorAC;


  }
  // 盾牌防御加成
  if (typeof getShieldBonus === "function") ac += getShieldBonus(state);
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


  var row1=[{l:"生命值",v:Number(state.hp||0)},{l:"疲劳值",v:Number(state.fp||0)},{l:"防御等级",v:ac},{l:"先攻值",v:"D20"+mStr(calcMod(dex))},{l:"速度",v:speed}];


  var strMod=calcMod(state.attrs["力量"]||10);var dexMod=calcMod(dex);var _keyAttr=REF_CLASSES[mc]?REF_CLASSES[mc].key_attr:"魅力";if(_keyAttr==="力量或敏捷")_keyAttr=state.classes[0].keyAttr||"力量";var _keyVal=state.attrs[_keyAttr]||10;var spellMod=calcMod(_keyVal)+(state.spell_hit_bonus||0);


  var atkMod=Math.max(strMod,dexMod)+(state.atk_hit_bonus||0);


  var row2=[{l:"生命回复",v:Math.floor(Number(state.hp||0)/2)},{l:"疲劳回复",v:Math.floor(Number(state.fp||0)/2)},{l:"警惕值",v:10+calcMod(wis)},{l:"攻击命中",v:mStr(atkMod)},{l:"法术命中",v:mStr(spellMod)}];


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
      var typeMap={"attribute":"属性","multi":"复合","proficiency":"熟练度","professional":"专业","attribute_health":"属性+生命","health_growth":"生命成长","attribute_proficiency":"属性+熟练","attribute_boost":"属性强化","sp_pack":"技能点","xp_pack":"经验值","armor_ac":"防御","heavy_armor":"重甲防御","extra_slot":"额外槽","professional_sp":"专业+技能点","panel":"面板加成","description_only":"规则"};
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

function weaponSpecBonusForState(cat){
  var cls=(typeof state!=="undefined"&&state&&state.classes&&state.classes[0]&&state.classes[0].name)||"";
  var def=(typeof WEAPON_SPEC_BY_CLASS!=="undefined")?WEAPON_SPEC_BY_CLASS[cls]:null;
  var lookupCat=cat;
  if(cls==="猎人"){
    if(lookupCat==="长柄")lookupCat="长柄武器";
    if(lookupCat==="简易")lookupCat="简易武器";
  }
  var bonuses=(def&&def.bonuses)?def.bonuses:(WEAPON_SPEC_BONUSES||{});
  var bonus=bonuses[lookupCat]||"";
  if(!bonus&&def&&def.bonuses&&WEAPON_SPEC_BONUSES[cat])bonus=WEAPON_SPEC_BONUSES[cat]+"（旧档，请重新选择）";
  return bonus;
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
  var wp=resolveWeaponProfDocx(mainClass).slice();
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
      var bonus=weaponSpecBonusForState(cat);
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
  SD_prompt({ title: "添加图纸", message: "输入图纸名称（建议以（图纸）结尾）" }, function(val) {
    if (!val) return;
    var name = String(val).trim();
    if (!name) return;
    if (!isBlueprintName(name)) name = name + "（图纸）";
    var res = addBlueprintEntry({ id: "", n: name, src: "手动", tier: "", note: "" });
    if (!res.ok) { SB_toast(res.reason || "添加失败"); return; }
    render();
  });
}

function removeBlueprintSlot(idx) {
  SD_confirm("移除该图纸？", function() {
    removeBlueprintAt(idx);
    render();
  });
}

function editBlueprintBonusSlots() {
  ensureBlueprintState();
  var cur = state.blueprint_bonus_slots || 0;
  SD_prompt({
    title: "编辑专业槽位加成",
    message: "手动专业槽位加成（如万用模组等，不含独具匠心）",
    defaultValue: String(cur),
    type: "number",
    validate: function(v) { if (v === "" || isNaN(parseInt(v, 10))) return "请输入数字"; return null; }
  }, function(val) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return;
    state.blueprint_bonus_slots = n;
    render();
  });
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
  var fabBtn = document.querySelector('.fab .learn');
  if (panel.classList.contains("show")) {
    panel.classList.remove("show"); panel.style.display = "none";
    btn.innerHTML = "📚 学习技能";
    if (fabBtn) fabBtn.innerHTML = "📚 学习技能";
  } else {
    try { renderLearnPanel(); panel.style.display = ""; panel.classList.add("show"); btn.innerHTML = "✕ 关闭"; if (fabBtn) fabBtn.innerHTML = "✕ 关闭面板"; }
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
  if (typeof window.normSearchQ === 'function') searchQ = window.normSearchQ(searchQ);


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


    resetBtn.onclick = function() { SD_confirm("确定要重置所有非锁定技能吗？", function() { batchResetSkills(); }); };


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
  if (typeof window.normSearchQ === 'function') searchQ = window.normSearchQ(searchQ);
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
  SD_confirm("确定要花费" + cost + "点经验值解锁" + tierName + "天赋树吗？当前经验值：" + state.xp + "点", function() {
  state.xp -= cost;
  if (!state.unlocked_tiers) state.unlocked_tiers = ["一阶","二阶"];
  if (state.unlocked_tiers.indexOf(tierName) < 0) state.unlocked_tiers.push(tierName);
  renderLearnPanel();
  render();
  SB_toast("解锁成功！已解锁" + tierName + "天赋树");
});
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
  if(data.prof>0)rewards.push("🎯 熟练度 +"+data.prof+"（可选）");
  if(data.attr>0)rewards.push("⭐ 属性值 +"+data.attr+"（可选）");
  if(data.slot>0)rewards.push("🎒 技能槽位 +"+data.slot);
  if(data.attr_cap)rewards.push("📈 属性上限提升至 "+data.attr_cap);
  if(data.prof_cap)rewards.push("📈 熟练度上限提升至 "+data.prof_cap);
  if(data.notes)rewards.push("📜 "+data.notes);

  html+='<div style="margin-bottom:14px">';
  html+='<div style="padding:5px 10px;margin:4px 0;background:#1f1a16;border-radius:4px;font-size:13px;color:#ddd">💰 升级消耗：'+data.xp+' XP</div>';
  for(var ri=0;ri<rewards.length;ri++){
    html+='<div style="padding:5px 10px;margin:4px 0;background:#1f1a16;border-radius:4px;font-size:13px;color:#ddd">'+rewards[ri]+'</div>';
  }
  if(data.special==="feat"){
    html+='<div style="padding:6px 10px;margin:4px 0;background:#2a2418;border:1px solid #8a6a30;border-radius:4px;font-size:13px;color:#e8b050;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span>✨ 获取一项特殊专长</span><button onclick="startLevelUpFeatPick('+clsIdx+')" style="margin-left:auto;padding:3px 12px;background:#8a6a30;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:12px;font-family:inherit">去选择专长 →</button></div>';
  }
  html+='</div>';

  html+='<div style="display:flex;gap:8px;justify-content:flex-end">';
  html+='<button onclick="closeReplaceModal()" style="padding:8px 16px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer">取消</button>';
  html+='<button onclick="applyLevelUp('+clsIdx+')" style="padding:8px 16px;background:#3a7a3a;color:#fff;border:none;border-radius:6px;cursor:pointer">确认升级</button>';
  html+='</div></div>';

  overlay.innerHTML=html;
}

function startLevelUpFeatPick(clsIdx){
  closeReplaceModal();
  applyLevelUp(clsIdx);
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
  var allClasses=["蛮斗士","战士","法师","猎人","牧师","圣骑士","游荡者","德鲁伊","萨满祭司","术士","武僧","吟游诗人","魔契师","奇械师","守望者"];
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

function _xlsxU8ToBase64(u8) {
  return new Promise(function(resolve, reject) {
    try {
      var blob = new Blob([u8], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var fr = new FileReader();
      fr.onload = function() {
        var result = String(fr.result || "");
        var comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      fr.onerror = function() { reject(new Error("Base64 转换失败")); };
      fr.readAsDataURL(blob);
    } catch (e) { reject(e); }
  });
}

function exportCurrentXlsx(){
 if(!state){SB_toast("请先导入或创建角色");return;}
 var btn = null;
 try {
   var buttons = document.querySelectorAll("button");
   for (var bi = 0; bi < buttons.length; bi++) {
     if (buttons[bi].textContent.indexOf("导出档案") >= 0) { btn = buttons[bi]; break; }
   }
 } catch (e) {}
 var oldText = btn ? btn.textContent : "";
 if (btn) { btn.disabled = true; btn.textContent = "⏳ 导出中..."; }
 function restoreBtn() { if (btn) { btn.disabled = false; btn.textContent = oldText; } }
 exportXlsxFromState(state).then(restoreBtn, function(e){
   restoreBtn();
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
    var b64 = "UEsDBBQABgAIAAAAIQCnDOt5aAEAAA0FAAATAAgCW0NvbnRlbnRfVHlwZXNdLnhtbCCiBAIooAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACslMtuwjAQRfeV+g+Rt1Vi6KKqKgKLPpYtUukHuPaEWPglz0Dh7+sYqKoqBSHYxEo8c8/NxDejydqaYgURtXc1G1YDVoCTXmk3r9nH7KW8ZwWScEoY76BmG0A2GV9fjWabAFikboc1a4nCA+coW7ACKx/ApZ3GRyso3cY5D0IuxBz47WBwx6V3BI5K6jTYePQEjVgaKp7X6fHWSQSDrHjcFnasmokQjJaCklO+cuoPpdwRqtSZa7DVAW+SDcZ7Cd3O/4Bd31saTdQKiqmI9CpsssHXhn/5uPj0flEdFulx6ZtGS1BeLm2aQIUhglDYApA1VV4rK7Tb+z7Az8XI8zK8sJHu/bLwER+UvjfwfD3fQpY5AkTaGMBLjz2LHiO3IoJ6p5iScXEDv7UP+UjnZhp9wJSgCKdPYR+RrrsMSQgiafgJSd9h+yGm9J09dujyrUCdypZLJG/Pxm9leuA8/8zG3wAAAP//AwBQSwMEFAAGAAgAAAAhABNevmUCAQAA3wIAAAsACAJfcmVscy8ucmVscyCiBAIooAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACskk1LAzEQhu+C/yHMvTvbKiLSbC9F6E1k/QExmf1gN5mQpLr990ZBdKG2Hnqcr3eeeZn1ZrKjeKMQe3YSlkUJgpxm07tWwkv9uLgHEZNyRo3sSMKBImyq66v1M40q5aHY9T6KrOKihC4l/4AYdUdWxYI9uVxpOFiVchha9EoPqiVcleUdht8aUM00xc5ICDtzA6I++Lz5vDY3Ta9py3pvyaUjK5CmRM6QWfiQ2ULq8zWiVqGlJMGwfsrpiMr7ImMDHida/Z/o72vRUlJGJYWaA53m+ew4BbS8pEVzE3/cmUZ85zC8Mg+nWG4vyaL3MbE9Y85XzzcSzt6y+gAAAP//AwBQSwMEFAAGAAgAAAAhAKwba1MrAwAAAAgAAA8AAAB4bC93b3JrYm9vay54bWykVdFumzAUfZ+0f0B+p9gkoQkqrZIQtEhNFbVdu0mVKhecYBUwM6ZJVfV9+4y97cu239g1hKRppinrUGJj3+vjc+89NkcnyzQxHpgsuMg8RA4wMlgWiohncw99vAzMLjIKRbOIJiJjHnpkBTo5fv/uaCHk/Z0Q9wYAZIWHYqVy17KKMGYpLQ5EzjKwzIRMqYKhnFtFLhmNipgxlSaWjbFjpZRnqEZw5T4YYjbjIfNFWKYsUzWIZAlVQL+IeV40aGm4D1xK5X2Zm6FIc4C44wlXjxUoMtLQHc8zIeldAmEvScdYSvg58CcYGrvZCUw7W6U8lKIQM3UA0FZNeid+gi1CtlKw3M3BfkhtS7IHrmu4ZiWdN7Jy1ljOBozg/0YjIK1KKy4k741onTU3Gx0fzXjCrmrpGjTPz2iqK5UgI6GFGkVcschDhzAUC7aZ6CBDlvmg5AlYW9i2u8g6Xst5KmEAte8nismMKjYUmQKpraj/r6wq7GEsQMTGOftScsng7ICEIBxoaejSu2JKVWyUMvGQ7974YpElgkY3cLJEQqVJ50DH1Cfn5oUE6a7e/0GENNQ5sCDumlv9/joHQFG6jdCmShrwPvZPIdkX9AFSDwWOVidzDLklrdsslC65fer2uxj7tm/6fqtjtns2NnuHgW8ObGfY7eOhE9j2MwQjHTcUtFTxqqoa2kNtKOGOaUKXjYVgt+TRhsYTXj2m7l81je1ZB6zvryvOFsWm/npoLK95FomFh0xiQ1CP28NFZbzmkYo9ZPdwG1zquQ+Mz2NgTJy2ngSda2Ye2mLk14wCeEzdbDGyXlCqbkqgVvVGVqn754/vv759hStZ36I6yXA9S1fvIccRqYrYLAtpEk6lobuqGj2C7Z72YEt1WqiqB5VxoDfodAe41bPNdkACs0162BwMnLbZ8YNW55D4w1En0PXRN7271IizNx7grlWtZlSVoHwt+mrs6jZYza4nZ/XEKvQtObvnvg5ltfpvjhfwJUvYns7B1Z6Ow7PJ5WRP39PR5e11sK9zfzLw+/v798/P+58vR5+aLaw/JtSCmsOZbipvNR/v498AAAD//wMAUEsDBBQABgAIAAAAIQCBPpSX8wAAALoCAAAaAAgBeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHMgogQBKKAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsUk1LxDAQvQv+hzB3m3YVEdl0LyLsVesPCMm0KdsmITN+9N8bKrpdWNZLLwNvhnnvzcd29zUO4gMT9cErqIoSBHoTbO87BW/N880DCGLtrR6CRwUTEuzq66vtCw6acxO5PpLILJ4UOOb4KCUZh6OmIkT0udKGNGrOMHUyanPQHcpNWd7LtOSA+oRT7K2CtLe3IJopZuX/uUPb9gafgnkf0fMZCUk8DXkA0ejUISv4wUX2CPK8/GZNec5rwaP6DOUcq0seqjU9fIZ0IIfIRx9/KZJz5aKZu1Xv4XRC+8opv9vyLMv072bkycfV3wAAAP//AwBQSwMEFAAGAAgAAAAhABmSiPceRgAASqoBABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWy0fVtzG0fS7PuJOP9Bwfe1CPCusPyFCfAKggQGtiX7jSvTtmJ18RHpW5w4//0kprNmqjoLkuzlbOxK2kR19XRnV3dXdmPw5f/8+fbNk9/vPty/fv/u+dboi+2tJ3fvXr3/8fW7n59vffvN6b8Ot57cP9y++/H2zft3d8+3/rq73/qfr/73//ryj/cf/nP/y93dwxN4eHf/fOuXh4dfnz19ev/ql7u3t/dfvP/17h0++en9h7e3D/i/H35+ev/rh7vbH9tCb988HW9v7z99e/v63Vbx8OzD5/h4/9NPr1/dTd+/+u3t3buH4uTD3ZvbBzz//S+vf703b29ffY67t7cf/vPbr/969f7tr3Dx79dvXj/81TrdevL21bOLn9+9/3D77zdo95+j3dtXT/78gP+O8b8dq6bFpaa3r199eH///qeHL+D5aXlmbf7R06Ont686T9r+z3Iz2n364e7312sCe1fjf/ZIo73O17h3tvMPne13ztbd9eHZb69/fL71f7f5n3/h79H6j+3+D/vs/2199eWPr8HwulVPPtz99HzrePzs69PxzvbW06++bIfQd6/v/rh3/37ycPvv1d2bu1cPd6hmtPXk4f2vV3c/PUzu3rx5vvX13taT9ZD99/v3/1mXvIDNNmq5b0usa7l99fD697ti/e0Yzb//P23F63+jzqddpf7f9gCn7TBffHjy491Pt7+9eZi8f/Pi9Y8Pv+BBtr84QN3Em/d/nN+9/vmXh+db4+0vRtbe9m888qvf7h/evzULAO3wevbjX9O7+1cY73jmL0Z768d59f4N6safT96+Xgcuxuvtn+3ff5R6d74Yo9r7h7/Wo7dzbQ9FF6Uw2toWXndReOjPKr3P0vibpffaFn9W4QMWPuoKH37+c48wWZVW4x9/v+5R12m7/6jhIILV9x33N3p9ZB032t85RID8g65fl8Szlz4o/97gZT2Ay5Bph/H09uH2qy8/vP/jCSad9VD/9XY9hY+fjUDEfzk4MSrXXo/XbuESf2HY3iPUfv9q+8unv68fhCYTmuy0o3FdaEpkt0NOiJRBv7Y5I4Lu6xyPouNzmhx0bi6IHHbILHm+cXRzJc83l+e7ludbJI53ouOlOG7E8co7fgqqOr4wVobga+32+Rb+7Hp1t6KrWIyPerpYpp2UW9ZPiIw6m7OCHPU254JcCDLTp9mryJGnmcvTXMvTLAqyj11N18z9ipxigrjqLA6iRUO37brQNntFpB3JgSy4GYKstdtI1mFFVrHwZLGMI4uII6sgnixBLgSZ6dMcVWTJ08zlaa7laRYF2e8H3LIgmG/70K8mlYZuHDlElJz1AjnAzLd2G8kZVRPUpJh4dljIsUPEsVMQz44gF4LMksepJzp5nLk8zrU8zqIgB/0jLwsS6KmmvoZuHD1ElB7M8EPQs3bbrnr9GKpnumKy0y9DUyL9MnRCpF+8zgri6RHkQpBZ8jj1VCePM5fHuZbHWRQkTHWjeq7j4/RjrCHi+CGi/GDzNgQ/a7fPt1Brz081AU+Kyc5+vxIR6Vf8EyL9in9WEM+PIBeCzJLHqebaK3mcuTzOtTzOoiA+fFh534iGSN+IFZF2TgwrzTpRH2AyW7ut2Kgm90kx8WwQ6Sfuk4Ls9nPFWUE8G4JcCDLTxxlXC8AVq+rH9JxIP6avifTBu6BjvzEYV7P2ko/jooWIixYiGi3YWQ/Bz9pt5Gdcze6TYuL5IeL4KYjnpyCeH0EuBJklj1OtAFfyOHN5nGt5nAUdu70AK+8n6YZIP0mviLQTRYiWde44BB2t37i6jOvVhTZ+eSG06xIf8+QyH0KeE4UuFJplT1UvMvpUc32qa32qBSG/TbNHcNwY5MgxKGEHqfkg7Kz9VtFSLYmTtSyw3r65xcUgFy+EfMAQCuwUXw66UKsZIb/ijasV78rqc7OaQW5aM8jNa+bcBY49gmeHD+rZIZSws05NB1hqRiXlDf1QpzW0CeyUYjuenQI5dmaZ8zpLoc2u72R68p1MyHdygfxaTl9HbjE3yK3mBulyPlqnlEN0cklV+8eatDU93+qRqSAnHonz6EAJ7qgkbbs+l9ip9SMz8qGqWS6tdlwiRWjsh9pOLSKZkVORFLpUaKbQlUJzha4VulFoodBSoUahlUHt+IssrnOwIQZbye12sWntNvM79fZkraNiwt3tw2Kq0IlBfZSfGdQTdK4FLxS6VGim0JVCc4WuFbpRaKHQUqFGoVVoduRsnZcNwRkT0hAb1R5ushav10m056xAfgO9U+18Tlgs2FT7kDPahLx1p1qkz2m019d/YVA/QC4Vmil0pdBcoWuFbhRaKLRUqFFoZa1uE6TI8zrjM553sNA8kj4/KpkkYnN9nLRW1icGOYWXENgwqxNCPhCZI/fQOY0O/eRZrA77PcalWfXQTKErheYKXSt0o9BCoaVCjUIrg5Lt0DrlG4Kgkkoe9OvWZFSgQx92TFz97qdA2F4bZ2csGIOq2mOe0ygEVXG154NKoJkV7K2uFJordK3QjUILhZYKNQqtrNVJUPls/DGDqiScgbMCBc4kmT1ZH7xhQg2cidU5rUJU0b2PKoFmVrC3ulJortC1QjcKLRRaKtQotDJIo2rsE/RHZKj1+3xrrw+OiUH9Hn9KyG3oTwh5hgjhDNYC7ZzQfh+0Fwb17i8Vmil0pdBcoWuFbhRaKLRUqFFoRWhHN41jn6Q/JkMl8YybxjoPbCuPm0aFTgxyaxWhOBNWieA5jfxMaJCbCRWaKXSl0Fyha4VuFFootFSoUWhlrdaZsL3pMsDq1frFDvGj20gzcusZoY9uIzObehtJG6dKnVsxfy2gJO5+T2JWbk+i0JVCc4WuFbpRaKHQUqFGoZVByezp1YPHjE0ejrtN45iQ2zQS8ptGQj4QKUS4iwFWzk+ePLD3k6dAMyvYW10pNFfoWqEbhRYKLRVqFFoRyiZPr5s8JkFF//AbkHGB/AaEkAuOE0JheeP5u4/F3UqDOWe5MFXylN5PlQLNrKDbNCo0V+haoRuFFgotFWoUWlnfJFOlV0kekzMepLuNfnt37/lW4KxYBc4KFDgTq3Pz5ae9YhWmPYFmVtBtGhWaK3St0I1CC4WWCjUKrQxKpj2viTwmQ0XbCJtGQn7TWKCwaSxQYEiszteL5PpYws97hPy8J9DMCvp5T6zmanWt0I1CC4WWCjUKrQhl895Aasa4UzPc/bX61o0Z+e0Gyzl9w6z8WkWBI8yElY55znJhJizlfPpsVr33mUJXCs0VulboRqGFQkuFGoVWhPb7Ffobg0JHVOLgtzQ66ofzdwb1A/WFQi8V+l6hHxT6+usEO06wSYJNE+wkwU4N06N9yKCDKECt30/uoYse46VYlvv4HppSklfmZQ8t2tK5ufaLCT05BcKs/B5arK7Uaq7QtUI3Ci0UWirUKLQyqD9D+oaQW2m/JXTUZ/rfGdS38YVCLxX6XqEfFMKQLh121Pv/+jjBJgk2TbCTBDs1LFlJBxLIcOWxPezxCQQhn0BQ+vKzMq9y9JomXbnl9pxQWEjpyi+kAs2soF9IxWquVtcK3Si0UGipUKPQilBZSFuR/htt9reE3Fnzdwb1PfhCoZcKfa/QDwphdJKO3j9Gp2KTBJsm2EmCnRrWDox4BX4gcRBfL1qPTp89EfI7cUJ+J07I7/PMKiyV1YHYOY38nsEglz0pNFPoSqG5QtcK3Si0UGipUKPQylrt9gxpR9R7Bhr5PYNBbs+g0EuFvlfoB4W+/jrBjhNskmDTBDtJsFPDdM+A6wiD7Blav9UQLoJqGMK8COVOjVgwDGGxOqeVP4EwyK3/Cs0UulJortC1QjcKLRRaKtQotDLIrf+E/PpPyK//Brn1X6GXCn2v0A8KYXjKlayvjxNskmDTBDtJsFPDdP1fJ89DHGq2fuPxi0EukybkM2lCYXjKratzWvkNgEFuA6DQTKErheYKXSt0o9BCoaVCjUIrQn4DoJ3zLSG/ATDIbQAUeqnQ9wr9oBCGZ+n8I78BSLBJgk0T7CTBTg1LNgBePl0rdo90KQJ3ctt7Lf7UYrdKiyZm5G7MKXSi0KlCZwa5iyyEwvnXbnUB5tKM+nIzha4UmhvUz/w3aYXV5YCFuloq1Ci0ChXGXZzXUx+TRP0a0m59friT2FSngNPEZq+Sv0/MBhvH7obbXqU7nZqR/1Yk6+9npQtauc3nJaFDJxYpdKXQ3KB+eNyo+4UWXCrUKLQK7iOnXoF9TE4pa/rd9F59kxC3glsd1el7hPAV/O7+EqFwMrlX7UdPzah3dUYIt6fN1QWhEKp71R7/0ow8iRSPe+9XtHJS4dya0++lb9IKq/lpoRUuzXtfYaMVrkKFkVYv2z4mrXJzbLIj0JTQQb9HOyEUSawmyVMz8iQW74FEirR9N1+y4F4fnTN7rJ79K4N6qzkht1zfmK/e/ULdL9V9o+5XwX0kyEuQj0mQSIATNK6NMqfXEAoEUZb0K+letaicshxkqO6mGqFAUHGFidHNsdWEfslyLsmZEXLJ9ZVB/bPPrTk+yrIKq9VhoRUutcJGK1yFCiOJXnR7TBLlJtkE35YQEgsUSCxQiLL9agk8patAYikXSKT3Pn4uWTBQxsfyUaY6HAuGKBP3C3W/tFa7b/AZ1AfxKriP3+b3utMjEoQvqlRsTBSaEvIEEYoE1dsPM3JRRsgTRCisZfvVCntpRm4tI+SjzCAXZdYcF2VphdU6vNAKl1phoxWuQoWRRK+8PCaJopZM8E2iOsoIBRKLVSSx2kWcspyPMkKBxOLKHVRf0sqvZfZYLsoMcmsZIR9l5sutZep+qe4bdb8K7iNBXnt4TIL4/bJ+WE52BZoSCgTxG1/+ayz71a7rlOV23bExoUBQ5qpO7tTVjFCIsuLK7xitOT7Ksgrr5E4rXGqFjUF9C1ehwkiiv4H2mCTKtbHJrkBTg9z7AAjtwbh/9YuQWFzt9ed8ZywXSKSV2zGad7djJOS0qCuDfJTx1TEuUzNfPspYY19wqe4bdb8iVII4EjRQ9r3+yt7661z+RULycprEps6+Ez+SfdMmZgGy/JXKcHzfbTKtnFNdMlf79SbTjHpXM4WuFJordK3QjUILhZYKNQqttInf9lYuAqpu/05dvVDoZfAeh9VAAsBuIgAc1F8I7Y2M6imhg57qE0Lr+xy9ZlMLAGbkN028zOUEAPPuU5ODagBe0sjvc827z4526hcl6CPMs0c/qDZp172R9cKNQguFlgo1+gwrQj7AD+rjPLPpe+87hV4o9NIglXzXG9PuROIxFxSVINqqcB/PZbiEDtyBGaEwjA5k21a8h22bShDm3SVHhMKgoVDh7mPSaq9XRuaEoJ0b+9dm1U9bNwotFFoq1Jj7/tvvK0L4LrvV+K09fd9d3yn0QqGXodlxYhlI4cD3jiX3UoWDVoF/Khx+GjmQDQWN/DRSoLCh6AQH68FLVhj4L1Z7nn9Cnv8CBf5p5fkXaMEa93qrpUINoR3PPxvk+S+QE66/swb1Q+KFQi9DsyP/A4kj2LAL/yqO0CrwT3Ek8F9LkCwX4l/FEVqFtK1YhbSNkOefkOe/QIF/Wnn+BVrYQ3j+xaqhVeCfDfL8s6C7Amrue+iFQi8Nan0F/tE5g8z/rd8w2U8UmhLy/BOK83+tcJqRi39CPv4JrSe//qWT9ebTjJz2QsjPCAa5EUHIjwizciNCoYVCS4Uac+9mBGuiGxFpb9Wbz97I5sEXCr0MfRrHyEDSzp5KOwpNCYUxwu8yYjrsiD2sBVSW88oBoTBGVNqhlZ8jDHJzhEF+RBRfYUTQvR8RAi3Ml5sjFGoI+TnCGuRHRNc3RvZ31hN9tLxQ6GXor8j/QMoRerheIxSaEgr8l4JhjjisE1SW82sEIbx2pztrJBTniDrVMCM/R1Am8iOCkB8RBQojglZ+RAi0YI1+16BQQyiMiOLL7xpp5XcNCr1Q6KVB7biJI2IgGWotI62/suO0RIWmhMKIKAXjiKgyuFOWCyOilMM7fPoRQd3LZQ0s6HeNhMIaQTXJ808ZymUNVtDzz4I9tFCrpUINocA/G+RnhAIF/gV6YW3su/5laHbkf6CLQlAI25vC7jUCCk0JHfZWJ4TWc1i/Igj//Lpk3zdnLIf3AfX8y3c9L63CfgKdWYU+/une81+gEP+08vwLtDD3fkUQq4ZWgf9iFeKfBd2use+ufkcgVi/NKtk1DqNyXiCc1vxjK9JlbAY5Cdgg3/cs6Pu+QKHvaeX7XqCFufd9L1YNrULfF6vS9zFeBpLvoFB8UhXObGpVOLERVZg2H1eFzajvuzODnCps1fmN+WEldl2akV90ecHHE0/IE1+gQDytPPECLVhjWHTFqqFVIJ4SZhIoA8lreEbeyXLzXf1GVBod9KEzJXTYzwUnhD6u25qRT7hUcLMK/dJZrMLSqYIbC3rBjVBgkQU9iwItzJcPX7FqzL1Pr9ighMWBRDKcO8p2h5pV/1xTWh32NJ4QitudWiQzI8+ZimS08vcjrUK/3KlIRqvAmYpkZuU5U5FMrZYKNYRC5HmRLE65AwlbOBiWLQoh92J7WuEXaLoLkoQiZ7WwZUaeMxW2aBWWSRW2zMrPlips0SrEmQpb5stvUcVqqVaNufdx5oWtwBkOdQcRo1q/nzg8zWzqZTKxkWWSNh9fJs3ILZMGuWXSqgvLZCWFXZqRWyYJ+dzEILdMEvLEm5ULVoUWCi0Vasy9I55Qsj/aH0hhaP2C+NCD9bE5jdx7daaE/PEmoY8vk2bkwpeQ15zMu1smCfllklBgURUGWgUWVWEwXy58FVoq1Jh7z6JXGGL4DqQK7EtGPiHkzxLNyp0lEopTbhXUp2bkOWMS7Y6k9RkuCQXOmMm7KZdWfpkkFDgTCeDGCnrOxGqpVo2595x5VSByNlAmvy9Z9IRQ4IxWnrMCBc6Oam2XrrySQyjEmWbytAqcMfH1nGkmz4KBM83kaeUyiIVCS4Uac+8585l85Mxn34/423L7JX/139MmFDijleesuwvUZyNHtR5LV4EzJsw+zuQZLlkwcMZ83HOmCgALBs5UAaBV4EyslmrVmHvP2UYFYN8rAI/JWUk9A2e80+PuWbS14+vLnrNiFeOsVsxYLnCm13XMu1/PilXgTJN3FgxzoybvZuV3JZq8q9VSoYaQTyEIZbsSn7w/Jmcl0QycMZ/3nNHKc1ag9Wl+p3Ie1Ves9mnUlzsjFOZGeYZLWgXONFWnVeCsWIU401TdCvr1TKyWatUQCpxtTNXXbyAd5OfNmJf3Y3zSVhXvMxEKcVYKxjir7zOxXIgzZrburMq8+zjjjRCXqtMq7BuZcfvdv6bqVtDHmabqarVUqCEUONuYqmN1GYYz5uWeswKF9YxWPs4KFDmr5ZX2qcPL+s8I+dMkQl5eIRTijLm0X880VWfBEGeaqtMqrGeaqqtVY+79erYxVcdLBAbhrPUbX7RByHNmVo4zQuEE6KiWV8zInQAR8idAZuVOIbTgzCDHmUEuzgh5zszKxZlCC4WWCjXm3nFmDVIZc/1Vv0F+WrBcOfDrWVtVnBsJ+bmRUFzP6rs+ZuTWM0L4dQeoa2FrDK17mCaWpDc0UW4vTNva4zaLUJxKKgXi1IxcCkqoNLF9RdUFoSBmHFXZ7KUZOTmIkF8QDPIDVa8qmJUfqHpVQa2WCjWE/IJgTUwGqhcSHnHjdaBCAqEwudDKTy4FCiziZ+bjz/Ge0pdfxQnhZy6682V9iEtCfkUgFEhj9u9JK1CYXVRJMF9u56XQUqGGUCBto5Jw4JWExyRNlYS2qmp2USWBVmFFGG3XaalZ+SWBmXff0Re08ss4oUCaSgnm3pNWrAJpKiVYQU+aWC3VqiEUSNsoJeANDsPMlyoltFVVpKmUQKuKtDovNStPGlNvp5/TKpBWrAJpqiWYe09asQqkqZZgBT1pqiWoVUMokLZRS8CXKIchTbWEtqqKNFr56bFAYR0fbdeJKX35C5mEwirH1N5vvgi5KyAsGKZHWnnSVEywgn5NUzFBrZYKNYQCaVRHkjVtIDHhQMUEQmFNUzGBVtWaVmemZuW3Jky+k93XQMk3zmHaM1eXyBEKbaSVH5hJ8j3arjM5+grrNpNVv24XKGy/Rtv1l4zpyw3yGaEwVjUhp1WYYCT7vjFffoIRq6VaNebeJwobE3Ls0YeZYDQhb6uqJhhNyGlVrQqSKTDN9asCE1i/lMtDXNJ9WBU0I7eH8BNMsQqkaUZuBT1pmpGrVUMoTDAbM3JchxyEtNZvzMgJ+eAzKxd8hCrS6tzHrBxphPA7Y92mWR/ikpAnzXy5lNwgRxohT5pZuVVBoYVCS4Uac+8izRqkqwIuYg1DmqbkbVUx0gj5lJxQtSrUZ6Zm5VYFQn4pN/dOryQUSOP3ITxphDxp+t0K+nJC141CC4WWCjWEfKRZgxLSBhIZcMOrXuYIhUijlY+0AkXSRnV6Sl9+mSPk01N9iEtCgTTqAJ40vZzAgiHS9HICrbxgqdBSocbc+0jbeDkBV7GGiTTVFNqqqkhTTYFWcXoc1empWfnpkSm4W9No5TMdQoE0vZ1g7n2kqaZgVn56FJlhoVZLhRpCIdI2agr4DcBhSGMm7b5n0FaFZa6HpoQwe3eX+Ah9ijS696QxBfdrmggbl1ajO86xGn2k0b0nTTUFK+hJEwFhoVZLhRpCgbSNmgJ+/2gI0i5av2EjckkoDHJN52nljywJhZlJ03kr6DZuCi0Vasy9n5k2pvOHA6Xzrd9P3HrMbOpbj4mN3HqkzcdvPZpR351nBvmwEBXiklaBZr1NQKtAswoAZuXDQgUAtVoq1BAKYbFRAMDL3YeZy3h1ANlcdylgNKpf4trWjjWp7+gpIX/JkdDHLzmakd/8URJwF3lo5e8oG+R0HIP87MZLAX520wsGVtDTKLcJFmq1VKghFGjceMEAg3AYGks27nZ6k7aqah+hGgetqs1fLb6ZlSeN+X9LWjhFw1cFh2ljSV5DGwWatrXHUzRCVRtrrcqsfBuZLvuBWaCo44wqTeiSvryOQ8jrOAb5saqSgFn5sSr5/0Ktlgo1hMJY3SgJHA0kCbR+49d0FZoS8tkloYrH+pTerByPhPwNJnPvsktCfp0g5EkzyJFGyG8HzMqRptBCoaVCjbl32wFrkGaX+LGWQYKv9VuRVpJqn13SKpBWrCrSavGNBX12SSiQJrrEJa0CaSoJ0Mov7oQCafJuhRsr6PZwCi0Vasy9J624T64KHg0kCbR+K9L03gGtAmnFKh7JjGrxjQX9kQyhQJroEpe0CqSpJECrQJpeMzArH2l6zUCtlgo1hPz0aA1KIm0gSeCo5LN+mVNoSiiQll0zGNXiGwuGSGMG7S4Lmns/PRarQJpKAiwYSFNJwKw8aSoJqNVSoYZQIG2jJIAfCxpmemQ27iSBtqooCRDykgChOD2Oa/HNrPyaxgzavXvCavSkFatAGtN4t2lmwUCaSgJm5UlTSUCtlgo1hAJpGyUB/NziIJJA6zdKAoRCf6kkQKvQX3rCb1a+v0QlWKjVUqGGUOivjZLA0UCSQOu3zQJdrjiuf9CXVu4VyFOFThQ6VejMauzD6oKQFysJBdI0wTf3fuOmCb5ZedI0wVerpUINoUDaxgQfvxM1zMzEs3s/MzHn7zPpaVs7qO2hE4VOFToj5F5IfkEoMFRqDAwx3/bTkObu5r5/rmtC/uBGoYVCS4Uac+93aRtzd/ys1jDTEI/g3Z2Vtiq8ycRpHQb5/tJ7ALQKu1q9B2C+/K5W7wGoVWPufX9tvAdwNJAO0Pr9hDKZ2dTKZGIjyiRtPq5MmpFTJg1qF+ygjuDi5zCBXhzL9FxLec7MziWmhnkxz7CPq3mdlduZGOZflGbYJ3STzsxdQDbMJ+Ed5iZzw/zY7+zcdJ5giwRbJljT1eECoGuupgi4LzoU15J7T0plUfAzzKcJhlVbzlry68wCs0xhnSDWVeF2nYb5+d6wSKMe1ZtdpFEz886fm8QSDDRKWdDI+wCBxo3p+Wh7oPy8OI4JeoIhPvXU3rCKxlrV7MwCjTznDjRqmm5lI42aqJud3w8bFmnU4/uubKBR7ECjYKCRckCgkW3LonGgjB2XVdurFz5lTzDQWOxiNGZZ+7i+ZGhFfdpumBdbuipCNGrmbnYxGpmCh0lVk/eubJhUNX1P7ECj2IFG1hFo3JjCj7YHyuGL4zoaS1bqRU6zizQWuyoaa23aikYamfiGaKSeEGjUXN78RRqZlAcaNZ3vygYaNaFP7ECj2IFG1hFo3JjU4yLtUGtjSYxjNAqGaCxYpLFgFY21Wm1FI43MxwONrCLQWLA4qarGYHXESVVVhs4u0Kg6Q2IHGsUONLKOQONGrQF3mIeisaTKkUbBQCNP/N2NNsOifj2u9evOzH050LA4qeqlArOLNKrqYHaRRtUdOrtAoyoPiR1oFDvQyDoCjRvVh9H2QPJDcRxkUOxURZMAjZQI3HUpw6poVBpL0RiNTOOdpt1VG6JRlQmzi5OqahNmF7c4co3gpvMXtjhiBxoFA40F8xqSYclB0mh7II2iOI5aqWExBKgjOJnC7GIIFLvYd6pUdGVD36lWkdih71hHCIGNcsVoeyC9ojj+hGCRGtWKRWYkkoUZfVyz6KycaNFh7j6VYf4mToc5earDAvG8pxB2InrDoSsb5j6945DYIWjEDsSzjkD8xnsOo9FQikzrWBSZitVJqT/erjIsKDJ09wlFxqx8wkesLGpRjgI2iO48ah1Xu2nFpmYXtmG0ixP/Tn0qZkXDxM+iYf02d1j++ktuO/V7+jt3/TCcJdhVgs2TR7k2DN9mNqXtprOLj1KJdIukimWCNQm2io9SkZ0KGdijv/rt/uH92/O71z//gh7CkPhztHv76tmPf03v7l/dvQO2/QVecvHVl+3LBI5xQ1AzXsVAbiJcEKvIFf3JzMI4ToQL2rmV5NKqdasmmCxlcTHD2ACTxPqJDEwS6ycPsEahobcDRSI+gCKpAxRJHaDI11FRlIoU/4Qiig3u4GcESbZ6/SwoojrgN17EKopEWzKzQBETd58G0S5SJEk/KGJZSOSOIwN7jyDJwJ4RsCRaBViSasCSVgOatBrwFKqpiEpliL9N1MUIL/xZkxJ7R3Jp9E7BcGblOodYzwD6hliYdqQOdI3Uga6ROtAzUgc6xtdR9Uua1/+TAVySTpTsJu3d+u2rI0xK8g572TYlRrptotEntk1m5bdNhvltE7FIqmTWILVgkVRigVRigVRRA0Cq1AFSpQ6QKnWAVF9HRWqa5f8TUpnBYxvuluJK7sSWqDPrD6mIxS1RsfvUlohWYZ5iLhzmKcnLsZRIHg3SChZJIxZIIxZIkzpAmtQB0qQOkCZ1gDRfR0VamtP/E9JKEhqkGHzrr3r7PJYS5vVeiiFWLSUijJpZoIg5fKCI+XA/74MiyZFBUcEiRcQCRcQCRVIHKJI6QJHUAYqkDlDk66goGiZfxwat5LnuC2kIKsFAWcH8lTTDKspEBGXRuPtmet1SFps6HirLah3jVXoIBDelyEphZv3MPR0pdpJgpwl2lmDnCXaRYJcJNkuwqwSbd1g/im86LHZBtQ4uEnfLBGsSbBWrrZgdKoUc8+54aNZu/QPTIzMLzLJoj4FZwcCsYGBWMDArGJgVDMwKBmYFA7OCgVligdm0C6rUFcyKOzArGJgVDMz6aitm03wRqeC2/w/K/938ccz8EfvrPmZ35a6KmbnfxhgRW4euK1qljyC71FCZSQpjNWDr47xV+xEMCT5vr2RhSBTM709Hu9XChkGiVvUuFqOGD+sHev0T4hhHtPIJgGIYR7QL4yjJYGnnsmQMGrHDoJFMF4OGdWQTfZrBPsagkfxuMhpLfodZnVmbu8yYYIj9Yud0fhBNLBAt/kCrYGBR/IGzguEtxH3Sphg4k3oxq0t7EejSXnAmduBM7MBZwRDv9YsvR+vfbh/i5Z7FcUhuwZkknuCsYOVMoxWZEMKCgbOCRc6IBc6kLDgTDJyJP3BWsMiZYOBM6gVnbJtXirS94EzswJn0CzgrWMpZmmg/RpxJXgnOJK8EZwWLnAkGzgoWOSMWOJOy4EwwcCb+wFnBImeCgTOpF5xJexFn0l5wJnbgTOzAWcFSztbZ2q+376D3jJ894msuR+vdbxSRwJmkleCsYJEzwcBZwSJnxAJnUhacCQbOxB84K1jkTDBwJvWCM2kvOJP2gjOxA2diB84KlnKWptGPEWeSZ4IzyTPBGfPgsJ4JBs4KFjkjFjiTsuBMMHAm/sBZwSJngoEzX2+1qRwq50UmqjEgZ8DoT38GbGuNYOhPnjP3R5rYHxAL/Sll0Z+CoT/FH/qzYLE/BUN/Sr2IgYLFxHe3ytMRFjTrtyAIC8EQFoIhLIi1W8mKxqGOy8dyQoywkBNd0OhPdI1GwUAjT4gDjXIyjf28lAWNgoFG8QcaCxZpFAw0Sr2gUdoLzqS94EzswJnYgbOCZVPZzlAaTOu42uYZ1h+kTUfEwvKj2KnZhamMdu4ayXni7yLBLhN/M8MCZ6zDYfOubB/yN4Y5eX/RYX17l4ldk9itDEs5W6fnQ2wZdkre79owGRkWOCt2kTPBwFnBImfE/HRJO+cPnIk/cCb+wFnBImeCgTOpF5xJe8EZscCZ2IEzsQNnBUs5G0o3AVmyxBkWOCt2kTPBwFnBImfEAmdSFpwJBs7EHzgrWORMMHAm9YKzRLbQ9iLOEtlC7cDZZtkCMshAcZbIFm1lmC8DZ4lsQTvHIzhLZAvDAmeJbKH+wFkiWxCLnImUAc4S2cLa5lNgbS84S2QLtQNnm2WLnaFki9ZxvZ4lsgXtYpwlsgXtYpwlsoX6Q5wlsoX6Q5wlsoVi4MzXG/d0O+vMdZC1RlJnrDWSOmN/IOn+SYIhBkQCOOuwEAOJpKB1IAYSSYFYjIFEUrCyYX9ACQBZpZOVqzMpLD8081tzxbD8iB3CgliyNd9ZJ7OD0CjZNGiUbBo0igIAGgUDjaIKgEbJ9rHNk7IIC8FAo/hDWBQs0igYwkLqxfIj7QVn0l5MZWIHzsQOnBUs3TIMpTLsJCqDYWH5SVQG2sXlJ1EZaBe35onKoP7AWaIyEIucJSqD1gvOpL3gjFjY5okdOBM7cFawlLN1djxInJW0O27NiQXORGVAnAmGOBPlAXEmigLiTMoizgQDZ+IPcVawyJlgiDOpF5xJe8GZtBdxJnbgTOzAWcFSztbZ8SCcSXqOuVHSc8yNIimAM8HAmcgM4EzkA3AmZcGZYOBM/IGzgkXOBANnUi84k/aCM2kvOBM7cCZ24KxgGWe7Q8kWreNqm2eYjzNiYZun2OmIWNjmGea3JVr2wsq6Oi4TfzPDAmf0F2QLrffGygbZQtu7TOyaDvNfqmDZlLOhZIvdRLYwLHCWyBa0C+sZschZIltoWXCWyBbqD5wlsoVic7Mr62jcmu8OJSm0jusYYDod+jORFFg29mciKdAu7A+0LPozkRSsbC/foj8TSUEx9GciKRCrVHO5K2VmfmuuGMKCikJvt+qwZGu+O5TK0DquaZRLANMR7eJUJkoBprJEZTAsTGWJyqB1YCpLVAZicSpLVAatF1OZqAeLDvPbPLUDZ9Iv4GyzyrA7lMrQOq45S1QG2kXOEpWBdnEqS1QG9YfQS1QG9YfQS1QGxRB6Ui84Y9u8MmRY4EzswJn0CzgrWLr8DKVk7CZKhmFhukyUDNrF6TJRMmgXp8tEyVB/iLNEySAW4yxRMrRecCbtRZwRC5yJHTgTO3BG2SK5hLS7zo6H2Jq3jus4k/Qcc6NICicJhrkxkS0MC3NjIltoHeAskS2IRc4S2ULrBWeJbGFY4CyRLdQOnG2WLdYv9BqGs0S2aCurVHNicW4U6QGcJbKFYYGzRLbQOsBZIlsQi5wlsoXWC84S2ULbi615IluoHTjbLFusX4sxDGeSnk9GbWU1ZyIpIM4EA2ciM5x1WOAskS3UHzhLZAtikbNEtrCybb3V1nyduQ4yb0nqjP6U1BnzlqT76E/B0J8iAaA/JbU/T8pifyD+0J/iD/sDkQ+uEgz7g0RSIBa35vU39bD8UCkIW3PBsPwIhrAglmzN8YqDYWhsHVfLj2F+y0AsTGWKnY6IhW2eYT4stOyFlQ0qg/qbmV0IC9oFlUHrvbGyQWXQ9i4Tu6bDvMrAstk2b/1TWoOEXuu45kwuAUxHtIuciSoAzqgo+EtIhgXOpCw4S1QG9QfOEpVBsXn3LP7AStu7MLvw/QC1A2fJ5QhiKWdDKRl4Xa5cjjAsxFmiZNAubM2JxTgTReF8pGXBWaJkqD9wligZioGzRMnQ9oIzUW4QZ9Iv4EzsVoalnA0lW+xJGj8ZGRY4E5nhxOwiZ4lsQX8hnSLmyoIzqePSMDcGwJlIFFcJBs74LCHOEtlC2wvOxA6cJbIFsZSzoWSLPUnPwVkiWxCLc2MiW9AuxlkiW6g/cJbIFuoPnCWyhWLgLJEttL2IM2kvOEtkC7VDnG2WLdAHA61niWzRVlZtzYlFzkR6wHqWyBaGhfUskS20DsRZIlsQi3uQRLYI9catOWJ+oP6U1BkxkEgKxGJ/iiyA/kwkBcNCfyaSgtaB/kwkBWKxPxNJQevFno4SAP7qL7TsyfdQzcxvzRXDVEZ3XjU3LNuaD6Uy4FcEdMsglwCwzRNVAMtPojIQi1MZlYJAY6IyqD/QmKgMxCKNicpgZcPyk6gM1gdeGdJ+AWfSL5jKNqsMe0OpDK3jemsulwDAWaIyKIbQS1QGwwJnicqg/sBZojIQi5wlKoPWi9ATVQXLj7QXy4/YgTOxA2cFS7cMQykZ+DUYjbNEyaBdnC4TJYN2Mc4SJUP9YcuQKBnqD1uGRMlQDFuGRMnQ9oIzaS84k34BZ2IHzihbJKr5/lCyReu4ijPD/NacWOBMsdMRscCZYT7OtOyFlQ2yhfqbmV2IM9oF2ULrvbGyQbbQ9i4Tu6bDvGzBslmc7Q8lW7SOa84S2YJ2kbNEtqBd5Cy5HKH+wFkiW6g/cJbIForNzc6lceCMbfMniob59UztwFkiWxBLORtKtsCPLsncaFiIs0S2oF1IgYlFzhLZQsuCs0S2UH/gLJEtFANnvt64Nd8fRlLAmOBJftyqyis2zcxvVRXDMKE7v1U1LNmq7g+TdaNZyeG5YWGoJ1mo2q3MXzrUh8lC0YbkMNmw0IbkMFnt0IbNh8n7Q2V+reP6dVN71ftnJiMz8y8lUuwkscNKKdnRWYKdJxgiWMpeJhgiWOyuEgwRTDv/MhlicaWU5BcrJbF+dkY4iR1oZB3Z7maozA/bgfb9dYjuj72ByMz8G4iIfeoNRLmZvIHIasBQ/tgbiMws7JRKGxDwrqS8gYglvZW+gcge1k+a+gYis/Jvs1EMg4ZpYRg0SepJu3DCYFgYNEnqaXVkg2ao1HNfUiwEepJ6EovbK0kfEehJ6mlYIDpJPbUOBHqSehKLW+Ik9dR6MV8nqae2F4GepJ5qh0DfnHri5ZLDKHWt43pLnKSetIucJakn7eL2Kkk91R8m5yT1VH+YnJPUUzHEma83bq/w5sdh+rN1XPWnYX67Siz0p2KnI2KhPw3zMaBlL6xsSAvV38zsQgzQzmHz7lmSSx74OdOB+lNSmMmoraxS5onF/kxSNtrF/kxSNvWH/kxSNvWH/kxSNsXQn77eanwOlU4dJOmUYWF8JukU7UI6RSz2Z5JOaVn0Z5JOqT/0Z5JOKYb+lHpvDKsuzVTbjEVn5tMdusO7euzldE1it+qwJN05GOpguHVcTzNyADod0S6GhRzkYppJDoYNC9OMlAWNycGw+gONycGwYqAxORjW9oIzae+yw/z2SO3AGdPWZHt0MNTBcOu45iw5GKZd5Cw5GKZdDL3kYFj9gbPkYFj9gbPkYFgxcJYcDGt7wVlyMKx2iDOxA2ebD4YPhjoYbh3XnMm9bcSZHOSeJBjiLDkYNizEWXIwrHVcJv7AmRwCXyUYOOOz+BMwbS84k/YizhIJQu3A2WYJ4mAoCaJ1XHMmeTU4K1iMM8HAWcFinBELnElZxJlg4Ez8gbOCxS2YYOBM6sUSJzoCOJP2gjOxQ5yJHTgrWCZ9HQylN7SOa84krQVncjKMOBMMnMnJ8FmHBc6kLDgTDJyJP3BGjcSn+4qBM5YNcZak+9YHXurTfgFnSbpPLOVsqHQfPzUhyrxhYSsp6Tk4S9J9YjHOmLIHzpJ0X/2BsyTdJxbjLEn3rWzgLEn3tb2IsyTdVzvE2eZ0Hz/3NVA6JSeqSKeSdJ9YnBuTdJ92kbMk3Vd/iLMk3Vd/iLMk3VcMcSb1Ym6U9mJulPaCM7FDnIkdOCtYFmf4kYhhOGsdV3OjYT7OiAXOFDsdEQucGebjTMteWNkgKai/mdmFOKNdkBS03hsrG/Rzbe8ysWs6zJ80s2zK2VCyxWEiWxgWOBNJ4WREu5BmE4ucJbKFlgVniWyh/sBZIlsoNje7cNKs7V2YXZCv1Q6cJSfNxFLOhpJGDhNpxLDAWSKN0C5yRjnCf6mBdq7vzkdaFpwl0oiV9V/1JxbjTOQScJZII9pecMY+8HsQtQNnYrcyLOVsKB3kkBpAn+9PRoYFzkSjQJwlOgixGGeiR4CzRAdR7NLsnD/EWaKDKAbOEh1E2wvOEh1E7cCZ2IGzzTrI4VA6SOu4Xs8SHYR2cT1LdBDaRc4SHUT9Ic4SHUT9gbNEB1EMnCU6iLYXnCU6iNqBs0QHIZbG2VA6yKHk+4izRAchFjkTLQN7kEQHMSzsQRIdROtAnIk/cJboIIqBs0QH0faCs0QHUTtwJnaIs806yOE63R7i+7Gt4zrOJN+fjmgXOUt0ENrFOEt0EPWHOEt0EPUHzhIdRDFwlugg2l5wluggagfOEh2EWBpnQ+kgh6ILIM4SHYRY5CzRQWgXORM9AutZooMohjhLdBBicQ8i2gg4S3QQbS84k/Ziry/9As4SHYRYytlQOshhooMYFvYgiQ5Cu7hvFN3ibES7uG9MdBD1B84SHYRY5CzRQbRe5GeJDqLtBWeJDqJ2mBs36yCHQ+kgreN6bkx0ENrFOEt0ENrFOEt0EPWHuTHRQdQf5sZEB1EMcZboINpexFmig6gd4izRQYhlcXY0lA7SOq44M8zHGbHAmWKnI2KBM8P8HkTLXljZoIOov5nZhTijXdBBtN4bKxt0EG3vMrFrOszrICybcjaUDoLfkxeN2LDAWaKD0C7MjcQiZ4kOomXBWaKDqD9wluggis3NLugg2t6F2QUdRO3AWaKDEEs5G0oHOUp0EMMCZ4kOQrvIWaKD0C6sZ1oWnCU6iJX1OgixGGeJDqL1Is6kveAs0UHUDpwlOgixlLOgg+D//IKrqeNH+LGso0QHMSxwluggtIucUXvw2hXtImeJDqL+LkdWNnCW6CC0i3Oj10HiNamjoFE8Zn8y7/a6UltZde2MWFxrEo2CdnHeSjQK9YcYSDQK9Yd5K9EoFMO85eut+jPoB4/Zn4l+cJToB8Rifyb6Ae1if0oefz5Sf+hP8YfxmegHxOKcIpoC+tPXW/VnyO0fsz/lLH8yOkpye2KxP5PcnnaxP5PcXv2hP5PcXv1hfCa5vWLoT19v1Z8h737M/kzy7qMk7yYW+zPJu2kX+zPJu9Uf+lP8YXwmeTexOD6TvNvKJtd2j0JO/Jj9meTEbWX1/JnkxLSL61GSE9MurkdJTqz+0J9JTkws9meSE4d6q/EZ8tXH7E85n0a8J/kqsTg+k3yVdnF8Jvmq+sP4TPJV9Yd4T/JVxRDvvt7Qn+PtkEs+Xn8WxzGX7DC3XzLM92eCnRrm+7PDXC6ZlL1IsMvE38wwPz4TbB7rrfoz5HmP2Z+a5423JZ+ZGhb7U/Iy9CdzOrf/7LDQn1IW/al5XuIP/al5XoKhP31+WfVnyMEesz81BxtvS66B/tQcLMHQn5qDdVjoT/GH/tQcLPGH/pR86yrB0J98Fl2PxtvrrX53FvKY/VlyCP+TMaWyuB4ZFsen5DjoT+YkYXz6PKX9xdXzxB/6U/wh3sUf+rNgMd4FQ3/6eqvxOVB+NN7W/KjDwvwpucuJ2fn13bA4f2p+lJRFf2p+lPhDf2p+lGDoz4350Xh7oPyoOK7XI82PzC6OT82PzC72p+ZHiT/0p+ZHiT/0p+RCiHfNj7qyWbwPlB+NtzU/6rAwPiV3wfjU/Miw2J+aHyVl0Z+aHyX+0J+aHyUYxufG/Gi8PVB+VBzX41PzI7OL41PzI7OL/an5UeIP/an5UeIP/Sm5EMan5kdd2Wx8DpQfjbc1P+qwMD41PzK7OH9qfmR2Pj9KyqI/pQ6sR5ofGRbXI82PYr3VejRQfjTe1vyow0J/Su6CeNf8yLA4PjU/SsqiPzU/SvxhfGp+lGCI98350SjLj0Y7X2AW/nO0e/vq2Y9/Te/uX929g8wMlbndrXx4/8eTD1CdR1ku8Llls33v55bN9nifWzbbz3xu2Wzt/tyy2Tr1uWWzOflzy2bzz+eWzWLtM8uuX94h+/DPLftfjKvxfzGuxv/FuBr/F+NqjHG1Psb53O7BUPo75hg9f8ccA+bvmGOM/A3zHQyLzzB/ev/L3d3D9Pbh9qsv3959+Plucvfmzf2TV+9/W89DB5iGHP7kw91Pz7e+HR88+/p0fLT+qnVXhB/tbOOjkrlVH13sjp9d4qeptNANPlmkn8zwyTz9ZIlPVuknF7v7qCd7uIu97WeXeJu7PsHFHp6trB/1U+/BG15ZmJTZHz27xJsXkk92UAa/tZq0FJ8s0k9m+GSefrLEJ6v0k4udQ9STPdsNPlmkn8zwyTz9ZIlPVuknF7voN/zGX8bcNpjLPpmhzDz9ZIlPVukn32BcfZMOq28wrL5JR9USnZP19BKNKZuuilC8agqfZEWORwfPJphMtZm4cvdslX8yHuGTbFAfj3fgrd2m1k8w3kWZ/JMDfJIRejw+ejZJO+AcXbNKPznbeXaBfYM2Z4IRNUljZ4LYmeCd3kmZPXROGgeT/fGzCa45J2UOUQYHmMkno+3tZ5MRNvjZZ6P1Z6OsUwHjAUej9u0NVbfi+6bPoLElHqegYpp2+BTdOk07b4o+mqZ9NEUfTdM+mqKPpmkfTdFH07SPpuijadpH03Uf4Y+sj6Yj9BH+yPoIMB4w76PJ0f6zMxwxaa8fo73HaXuP0d7jtL3HaO9x2t5jtPc4be8x2nuctvcYz3acP9u6J47znjhe9wT+SENw3RP4LBstx8gk19Ge9QUUw/9P1xntxm2cYfRVjDxA49WuJGvR5ELCULBJyvIaBnybNkpitLUMV2jRt+85axQFrLM3QbwH/PVxOPw45HwcXu5vm3G3dblnmJ9tyN2UNevvUfOVNYt5B2fNEzo5872teH7MqHllzWLUvLJmm8nLnTXrzKTmzprFqLmzZjHa89yax7uW785Map5bsxg1z61ZjJqc7T5CyX2nKzejJhfTZtTcWLN80ZkMaxaj5saaxaiJBfqoPHWeWbMYNRneNKOm1w8eF2fNrTWL+XTamn0+XNE/nU6Nmvy8v23mDOyeqb/sn8wIWjP7p4ya2T9lx+nE8CJmxdz38nJn79z3Ys7Eue/Frkl+qDP7pwyd2T9lx9hI6CT9YM3snzJqFqM96Z/N0IkvGSHIY4QvNTN1YM0e2FzRP42/ZU36ZzNq0j+bmcTbH6N3z2uScj3bH+N22Wb0ayNmqYV+3cxUmlpO9Gv8zKhU1sTPmlETP2vGcXAUQgw3a9IHm1GTPtjMlLBtVjVNBttmJ/ounmXkNLXgWc3Qgmc1Q8tGLVUTLRu1pNfxBgBaeA2gtMCOrz88Z77ZgJbczrcU0JLMNxPQkuyatLta2ntgaGnvgR2j9891ouVKLbUdWq7UktdU3kpSS3sBDC3tBbDjK1KphdvF3g4tF2qpmrSLHsLrNXmM9JBkvjGklrxzlR1f96nzHXZ8xafO91eemzkW5M1Cz81kaPHcTMYx2qmlznfaZaeWHKPwZp9a+hoAQ0tfA2DHVw/zGJ2rpbZDy7lacmzDG9hqaU+GoSXHDG53fEU8tejJuR1a9ORk9Bc9mdeLs7/oycl8Y1ot+UxHdnzdOfvLVi3t5a/0XZaBSC36bjK06LvJXKVCLe27MLS0777Sd1neILXou8nQou8mQ4u+m4xjpO8m4+GEvssyNKUFxpJJeW/hdiy3UowVV/TdZK6Mg5ZkaNF3WV4ltei7yVjlR99N5uovamnfhR2XeCl/udR3WQYrtei7yVzZSy21nat0qaWYK3OppX33Ut9leafUou8mc8UqtbTvwtCSz7jc7rjEVLaLvssyfKlF302GFn03Ge2i7yajXfTdZPQXfZfl5VKLvpvMFfPUUtuhRd9N5op3amnfvdR3WS40tei7ydCi7yZz4VKfKVZN9l1vZQnL/Ht6azL+nt6ajL+ntyZzVU33vb31wvOWlZZLC4yl+Xu8BDuu0Jz9TL/O5+AuiOz+5b2ajP1r373Ud1lxN9tM301Gm+m7ya5ZyN1973MTxr4XYyFyz81kLCruuZmMhcQ9N5OhRS9nBfE8Dnp5MhdFV0t7OQwtxVzUXC19/+7jWz9uklo8H5KhxfMhmd8t4XzgyyLPa/rxD3X22A2GzmJ+cMPtepwFY7s+3y/0eT7LkFr0+WR+8cGa7fMX9nk+ipRtZp9PRpvZ55P5zSa19BgFdvwwU51/TEOhpc8VGFryeRY/qyVndWRo6XtD2PGDQ6Xl3H7NR9mqXWC3zfzOHFpyO78Zh5ZkficOLcmu+c6YWtrrYGhpr4MdP4RW/QV2/PjZc+b3z9TS94bnXv9yftHPj6ql7ztgaOl+zcTk8Tud2daOe75lib57FuvnNK3Z5wOMD7R1n3cCyI8k5t/TP5P53Uf/Xo9tYLRnj21gxw81Zj/zmsr3glOL19RkfgJZLe1LMLQU8xPGaulr6rnjrJwf4dg6zkqGFsdZyejzemQyP82rlr6/PdcLcobbz7arpb0AdvyWevZ5vSC3Q4tekIzzz+sK3+bOY+R1JRnt4nUlGe3i/W0yPw2ulh6D7fSlXfsS7LbZG35GS253vdnpL5kzmGTUbH+BUbPYW7d734z29Jpz3tccGO3Z4ywY7VmM9vSak4z29JqTjH3Xe3Z9zwVj3/tZF4x9b++B3Td75987NEOLvrRrX4Khpcd1MLS0L8HQ0r4EQ0s/Z9/pBbu+54KhJefV+FktPe6BoaXHSzC0tBfsvObs+p4Lhpa+5sDQ0vdcMLT0GAyGlr5W7fSlzHxwruhLyTj/9KVkHHf9Zdf+AqNmPz8zUtSM88/7uNyOv+c1J2fI2QevOcnYB685nXuS0Z59zYHRnn3N2eo9mdWZ+Bktyd7I1mZvZffN3skOzWgXfWnXvgSjXdqXDAg14zjoS7kdXqAvJbvebPWCzErRLnpBMtpFL+jElox2aS+A0S7tBcSp0NLXHBha+nmdAa1mHCPHwrkdx8ixcDLaRV/ati/B0NK+BENL+8tWf9m2v8Co2f4Co2b7C+x9M/bBa862rzkw/l5fcwzWNaM9vebkdrSn15xkaNF7MjdEP9N7ktHP9J5kaHFs0xk3GVp6bLPVl76tV/N97oKf1ZI5ARlaeiwMQ0v7EgwtJ3xJLyB4WmM+cmpoaS+AoaXHKDC09H0xDC39DGnrNWfb98UwtPRYGIaWvi+GoaXvi2Fo6TlTgo03m2/fJnp2jGC3zd7wM1pyu+vNmf5y1v4Co2b7C4ya/QwJRmqynxOZQNxkOHHiZ/9ej3dh/L0e78Lum72z5qEZ+673kOWufgZDS3sPDC3tPTC09NgGhpYe25zpS5kupF30pWQcW30p2VsZWnr+AYaWvkc3c7rJOCpa9IJkaNELkqFFL0jGMdILOv66IeWKlr7mwNDS1xwYWnosDENLj4VhaCk2iADupxM5wM2Z3pO5UfadbG0z+qA+8W3dqO/OabYjFdyM7bx28O5E9l2vHck4Rl47kvH3vHYk4xh57UhGu1zYLtWXSA4TYm82y9Zmb2X3zd7J3jdDy6VaaiyFlku1FEOLHpkMLY7dkqGFrPXJv7fz71Vf4u/ZP5Px9+yfyfh7pL6bse961rc3vr5//0CGlvIetOhnydCinyVDi+OsZGg58zhU/+Q48JpEM7TYP3M7tNg/k6HFe65kaNmqpcYaaNmqpRha9LNkaNHPkqHFeYsTNcnoLpvM6K78zDmWbGzM6PKfON9nGTWLUdPrXzLa5aXtUuMe2EZW4xDaTM9KRrvoWSe2I1f55pQW8rvTJvO77N+5+1d9l/3zmpqMNtOXMvdLzQtrlmdR02tjMmrqL5nbpualNctfqOk9XjJqeq5ktpeaZ9as84iaenIyatrnM79Lza01q89T02txMmrurNl+BqNmMWp6Te3tiAQvmQheIYckwzhwpoFRaI/O5C57/VKF1dtR6B1AMmp6JmRim5oba9ZZQk1H8sleEwB8c2LfaOJMoM6ETJckK+RwYhtOnMwjr8SRD0lmQsVL5o1XyCHJTGh4yczwCjkkGYRDp8yGzpAlyWqgNMkgKjxlMnmGLElW48VJBiHhKTPCM2RJskIOSQaxxinTkDNkSbIahUwyCLJOmWMd9KopU6UzZEmyGkVNMggST5kjniFLktXwcZLXxMDenNgf2jozfDPRvyXJCjkkGcQ2p0xtzpAlyWrU88Q2nD+Zu1yNZCYZhnQzTztDliSrIdwkg1jhlKnCGbIkWY0iJhkEA6fMBc6QJclqmDDJIAo6ZRJ0hixJVuOjSQaBuCnzcDNkSbIaoksyiLRNmXYb9MQp84gzZEmyGmJMMogUTpk2nCFLktUYYpLXBMDenNgfzpJMY80EtZYkqxGuJIOQ3ZQZuxmyJFkN5iUZxOSmTMnNkCXJarQuySAkNmV+bIYsSVbIIckgHjZlOmyGLElWyCHJIBg2ZS5scOSmTO7NkCXJCjkkGYSGpswMzZAlyWrQKMkgQjZlgmyGLElWY2dJBiGwKTNgM2RJshocSzKIeE2Z8JohS5IVckgyCH5NmfuaIUuS1bBYkkEcbMo02AxZkqxGyJIMgj1T5npmyJJkNQyUZBjJymTVDFmSrEaukgxCeFNm8GbIkmSFHHob4kZLpo1WyCHJIDJ0m4mhGbIkWSGHJIPQz5R5oBmyJFkNCiUZxMOmTIfNkCXJaqQsySBgMmW+ZIYsSVZDKUkGkaIpE0UzZEmyGkNKMggFTZkJmiFLktUgUZJBDGXKhMoMWZKskEOSQZBkyhzJDFmSrIZPknyAfEwyCCNNmUWaIUuS1QBTkg9ETj7m/nxgm4/Zbq+JQLzPBMQHyMckg78zZSJmhixJVuMwSQbhlCmzKTNkSbIaaEkyiD9NmX6aIUuSFXJIMphQnXI+dTCNPuUs+mBSe8o57UEkYcqUwyAgMGU+YBAnmTJNMgh+TJn7GMQwpkxhDEM0J/Iu5/uRT1cJaRmwjGeBZMKZFshZHSYTRs4zXDuVkE/2r5k4HD1v6LRhz/AZBMi5/uF0fs7YEy7m4WY9N+PVKF/Tjj29ZX9uc87o1mmhnNm6dZI05xBvnVbu9YYML3TOAPI+yc3VftTT2OVqf1e/s4QJR7r2kodL+7skLF/CNvXkaYHc9YotPCQf+Yx8gdwlIZnDNvVcj0iOMac4NvfmS+qR5Q09urrtcr6/q98P9PP6/eZiP6qTLxf7u/r9hn5c3Wu53N/V7zev9qOmr5dX+7v6/Z7JgNJ5zyRWxno4DtU+t2f71/X7zNGp3++Z9Mh23u5HPd5dtvu7+v3AhEX9fsOxrwO87PZ39fuBHnH8/cf/rwH285+//PH4+eHp01/vv7747fHz0+tff/qB9dOe/vPl4acfPj/ePH7+18PXf356/GxP+vLL7w/rL19///T5ny/+/vDbcQ1D7hNffP30u6uQvfyT/3h6/MLaaz+8+Mvj09PjP47/+8fDL78+sMThS9dB/O3x8el//6Dmj/9+/Pq34/pkP/8XAAD//wMAUEsDBBQABgAIAAAAIQCV+JUm3AUAANQYAAATAAAAeGwvdGhlbWUvdGhlbWUxLnhtbOxZzW8bRRS/I/E/rPbeZu36I43qVPFXA03aqHZb9Tj2jnennt1Zzcwm9Q21RyQkREFckLhxQEClVuJS/ppAERSp/wJvZtb2jj0mtEECqubk3f29N+973nu5cvVBQr1jzAVhacuvXAx8D6djFpI0avm3h/0L274nJEpDRFmKW/4MC//q7vvvXUE7MsYJ9oA+FTuo5cdSZjtbW2IMr5G4yDKcwrcJ4wmS8MijrZCjE+Cb0K1qEDS2EkRS30tRAmzvHg383TnPHgXGqRTqxZjygeKIV4DhtKI+i5noUO4dI9rygXfITob4gfQ9ioSEDy0/0H/+1u6VLbRTEFG5gbZE19d/BV1BEE6r+kwejRaH1mr1WmNvwV8DqFzH9Zq9Rq+x4KcBaDwGNY0sFs/tZq3TLrAlkPnp4N3brlb7Fr7E/9KazP1qey+oWngNMvxra/hmvd2t2XgNMvj6Gv5S0AnaNYu/Bhl8Yw3fq9c69Z6F16CYknS6hg6CaqNXL9ALyITRfSe82av097oFfImCaFiEljpiwlLpDLQE3We8D18ViiJJUk/OMjxBYwjbDqJkxIl3QKJYqjPQDkal7+bVWKy9Usd5YsxJJlv+hxmCRFhyffX8u1fPn3qvnj85ffjs9OGPp48enT78wfCyCPdRGpUJX37z6R9ffeT9/vTrl48/d+NFGf/L9x///NNnbiAk0VKiF188+fXZkxdffvLbt48d8D2ORmX4kCRYeDfwiXeLJaCbNowtOR7x16MYxohYFCgG3g7WPRlbwBszRF24NraNd4dD/XABr+X3LVkHMc8lcZx8PU4s4CFjtM240wDX1VklCw/zNHIfzvMy7hZCx66zOyi1XNvLM6iaxMWyE2NLzCOKUokinGLpqW9sirFDu3uEWHY9JGPOBJtI7x7x2og4TTIkIyuQlkT7JAG/zFwCgqst2xze8dqMurTu4mMbCQmBqEP4IaaWGa+hXKLExXKIElo2+AGSsUvIwYyPy7iekODpCFPm9UIshIvmJgd9S06/DuXD7fZDOktsJJdk6uJ5gBgrI7ts2olRkjllJmlcxn4gphCiyDti0gU/ZHaGqGfwA0o3uvsOwZa7zy4Et6FylkVaBoj6knOHL69hZufjjE4Q1lUGqrpVrxOSnlm835Xt+W22x4kzefZXivUm3P+wRHdRnh5hyIr1K+pdhX5Xof23vkJvyuV/vi4vSzFU6WW7rZvvxN17TwilAzmj+EDo9lvA7RP24aUeCvRYuBjEshh+Fm2+hYs4WtBEouAUCS9jAsZDPXXqmRWvsNL9fp7cnEzMeFlp1oNgfsD8bD1WRnpSnbOsmInzDBEVDdhhIRA0Ah60Dy2/2jT0MB0gikMlohleLT3OoVOc44VOF6p1GMX/I2qpsFhxOE3L7qepdwI7CmUh3xujrOVPYCCDn0kGdhKqWUE0gjXGWHLj1zeJl4wL2UUiNl7XoWRuh4RIzD1Kkpa/Xd4q0FSHylsl3HmSxgqwmo6vfyNvKo68eSPfQlzacYgnEzyW5cgsvdE7AA0oSg3LIWwGcXjijWjObyEI1UpQaagYDomA8b8eQDipB1hX1WtF9i8D2eNM3iUyHsQog5XDGRUL0SxGJnThiA2ZvRBJ1yAjvJYWVHWqonVd04zjCQVDwOYQVoR7ShF1IOwPQ3i4VPw8UmVWazXXt6qUXNVXzFr+haJ0Flk8gjlsVXdTCt9YYocv6s1KfeGKyuXAPLyOK8qru2LdqExV9gQYY5ECBq4t/7f9YPulCKxRpK7Cc9+PZ1+qShvYe0kTVpeVm01FFEgesnB+PW4MN+d1vOLaii7Yr3s/l6Samxh2wmWpTEzq7l7EKMSFDqqAGx1onix1CFS1+ht3vOG68YpfMdjyMEs0JfHckCXRlm9t0coxdI72Qwu9PK6xwW5/3RY4O5dF7drcuQDdatSqW3/e/umk0P9WKP8LgI3uQ5Xpwso1p1KYJesDWLZAv2Y2tpAPpi5o0t0/AQAA//8DAFBLAwQUAAYACAAAACEAQrLmkq8HAAAlagAADQAAAHhsL3N0eWxlcy54bWzsXc2O4kYQvkfKO1i+Roz/GZgFNsOApZU2UaSdSDnsxZgGrPUPss0ss1FuueWYZ4hyyzV7ydtkozxGqts2tsfTg2Fs6NbmBP6r/qq6qrq6qu0evNx6rnCHwsgJ/KGoXMiigHw7mDv+cih+f2t2eqIQxZY/t9zAR0PxHkXiy9GXXwyi+N5Fb1YIxQKQ8KOhuIrj9ZUkRfYKeVZ0EayRD1cWQehZMRyGSylah8iaR/ghz5VUWe5KnuX4YkLhyrPrEPGs8N1m3bEDb23Fzsxxnfie0BIFz756tfSD0Jq5AHWr6JYtbJVuqArbMGuEnK204zl2GETBIr4AulKwWDg2qsLtS33JsnNKQPk4SoohyWqJ9214JCVdCtGdg7tPHA38jWd6cSTYwcaPoTt3p4Tkyqs5nLyELk165SaYg5zefiW/eNuRX8gvvhal0UBKiYwGi8DPaXWBbSzQq3d+8N438aWkAXzXaBB9EO4sF84omIYduEEoxKAIQJ+c8S0PJXd8+uOXv//6ldy1ssII9Cd5UNPxOaI96Z2eA31JICVtHNrSP7/9+URLUpHoDDf9CAvhcjYUTfP6pmuoMoaS83EA9fYo03A/LvojIPfLTB/feUTcESiV47o7BdVBQfGJ0QBsOUahb8KBkP6/vV+D9vjgdhIdIPftuXsZWveKatR/IApcZ45RLG+IzqYdbo4n42sNk5mlFxx/jrYI7KdL9FQqAAabSWDtAfewrbSTiF4d0gxpDUQ5C8I5eO7M2sGAsnOjgYsWMaAPneUK/8bBGvMSxDG4t9Fg7ljLwLdcbO4JlfKT4PLBuw9FD82djQdkE4OuWIOEm0lbyZ6JV+DR6U8QRARQ7UYAfIa99jMJq/U53YN6H5/WJg5STyfxwGER72fG216dZrT/DrHFxOKZMLCyE2IKUm0wn7VGnHK4aM6NHoC65PrP4xhbQtuyq2tZM/5H/2DuIZ0iEDom5Dugp04VhR4DqfHgMhv7+AyNnz9y13AQD0XEp9E/mGG1NktpdT62M0127OB0kJjyF22r05N+6fEYrL2eeNQ57gnDmPTuLY2CR3QWU5kV5nJIxwbbh2e/zjKdOTxPcExMVmfSlLixvfb9SFRLpV43rfcMo6G23QbOY5wfFWA1TdE6L2n2GJLRNnLdNzhr/MOiVH/aLgq1J6gu4qoLLkPhv5DRT/8mSejkYDSwXGfpe8iH0hAKY8fGhSUbDlFSDdouIG1dbC9pvdiwrEEK+vCmhe3iAAw0+krOmioKRdZ29AVrvXbvcRUNZ43TIxBHfnSdySCpsuUiWQWh8wEeLAiFLiYaRMCVSV8rQjSgypeKYD/EMak/nBsyVDN5g6yAzLnDzKFqKH125dyIk2DDAhWGTbAg5pKju2xFM6jDVY2hogRPBQfdgoeohy9dIZKM0wDr0ZGiIsBvN94MhSZZ7lMY1J4Y4k6rvTRGmHPGJfHTBmo+xF9iRedak2qxUjVbJq2iloFX7YJfXlS8eq0U13LMS2VoYN3zFnwYB/MhmJjmUzaN4UidFtpwObvgIlAvh2j8QeZQmSFo4G2mzOFEuTI8PpWZYmPS2c4ErpHkGs0x85GNKDk5BUZDVu2POv7BBd4wM+wzTptBadUAOVQMhWHXTNMMeFOGOwNUOdSNlpKErZqgynBAR9Vn1rxzKX9T3wrZz3lQealoDce8VLSJ9fwNtVcYjsFpeXOVw1qVyvDEgSZnHqvyHKozy6VXmmqwXJWnug0OV2ywHB4W5FzKt/OROytBZthr0EreDEu59nIDdjKUtPCIw5k7h8GRwmEimMcFU5yspSuX6DgctTWGE1G06EhrZ7Va0yudy5X9M8pZeB9a61u0JYu/4VUFCa9or7FUu8wAw0KnjeIc1hkVPnS7XLXjsGqucFg213isjjKsz9SKLodFA+b0uday4qq3Yz/RTs0zcVg0oPLCR9Ggno5VZpn86hiPC4upOU4+FhbXKn5WZ9gcFww5XLxOLRnyoWOF95Tre+RGMpKNvUF2UGja7svGVGXgMEPKcshPdewcTrvZVF+QMJOv89Ms7Iz5/INyXNSJ3xmT+80wwHsPnNPfNdIDJ3QkjeCtzihOV+lsRuXPuFqpmR44Y9WoGQbOmOJrhIEzpoIbwX/GeKsR/KyNuuRjT/B5p8JXpkrfmNp9C0rA23MMxU8fP/77+8+FlxBmG8eNHT/5thMuuO2eAJrzbf7FKrIXQ4z3jyHfstq1AqPIHC2sjRvf7i4Oxfz/N2SjBLC79K7vnLsgJiSGYv7/Nd6NAd7oAARkQwVo3As3ZOMJzFtpA4rpzbQ3zvdSST8+1xubZj8nIGTbVZjmRL+s3H2tmbppVk6bpiEbhNNSk5eKIivTyt1qVxsrZM+L0t2aOdW6k2qTu51Syuzs9tOQChxLmRSgFPo6go0k4FfYhM5Q/HE6vuxPpqba6cnjXkfXkNHpG+NJx9BvxpOJ2ZdV+eanfCce/Rk7+pAtiKD+quhXkQv7/oRp16dd+SY/NxQLB0lnkp1GAHYRe1/tyteGIndMTVY6etfqdXpdzeiYhqJOuvp4aphGAbtx5M4/sqQoyR5CGLxxFTsech0/09xMX4tnQWXh8AkmpKwnpHx/p9F/AAAA//8DAFBLAwQUAAYACAAAACEAEZHS9SYFAABhEAAAFAAAAHhsL3NoYXJlZFN0cmluZ3MueG1sjFjLchpHFN2nKv+gYpUsZCwnTrlcEl6kKl+QrFJZUDKxVWUhRWBXshtAw0sgkHkJPUDYQuhhQBJYDDMgfmbu7e5VfiEtxqpUcXsSLenTc+695z66m8UXf66+mXsX2AitrAWXPAuPHnvmAsHltZcrwVdLnl9+/mn+mWcuFPYHX/rfrAUDS56/AiHPC9/XXy2GQuE5+W0wtOR5HQ6vP/d6Q8uvA6v+0KO19UBQIr+vbaz6w/LnxitvaH0j4H8Zeh0IhFffeJ88fvyDd9W/EvTMLa+9DYaXPE8WvvPMvQ2u/PE28KOzsvD0qce3GFrxLYZ9UDdZQ7MnDYx0F71h36L3bt3B2MUWs3ZnVzG5i+WK+gvQb2yr7MK2fQadG8hnWeuSWCrWYWcM2mgW4P26SGRnV8EweGuT7G2956lrFwPla0j3FAbQavDxmPjTymIl5+Llfg2OiUtYi4hqnmiltSB5QXgcZ5Q8vNvmpxoJeNgXtyRgsXsNtw3WTjGzRcQwL8QFyR3oSSxaChlso2Abe7Mk9rigUn9aMkKrg3lCQqv1ZA6I+3pPFDtwVUONOho9Vnxx52XCkjVhG23ClttRfdEr4UFX/QWPZGR06rLksQxWu1jSbXOLxG9YzqfEBXUVKzMhPm7jESlstUGWGiokgnZe7YbczqJDkoN8HCafZ1dFdZN/PnLhuY0wKz37xa9ON0Nch87wN2JlZIrqgAgzzbHLAJDBddKy0kRpQsq13wIjQmxcWYr2cepINSwuY1jqKwAWrzMrJhpEKkjviwTpc34VAZ10+PeKLhOJHYXbcBqRxLPBYGqiaKZnKtbCjYKVT/KQPp3ngx4fxIh+DohFjSU/zYILT5RGDtyNoGFgr+dihCfOobNnD1O0zdti94au3p0JXJlg/lGH4wQekRTAuACpLLNy4jyjmtqlHGZJ8WH7BKqnRPdSEmsHpLQ+6opsyIGHBZJ5cb5jD8ksFXt5yJBChkELU1vzEBmwc5Klu4Gt056ZxoppjcfGina+Zxxpokg65AuIW3FRPSbKO7645kvoWdEkZ7HUgPeJirJtsUdWuSZrklS6HKmQ0UkeqqZiL3QqWKqSSpOdXG/OrtqjS9si8tmjc6EdEYauBcXE7KrQLH67Q3RqNllrd160i9grQfuEd+MuW1h0JFtenjNueLMGzYSIFFRpdqzA8R7oMegkoEPCxorOGxmuXyrkY/Wm9GsetuOQIwfsPXhwyfLE9y+gbZpYJop8AbE4wWuLNIljkzVrUh8pjAsOgyY73VLgeBhlqTM31twRdA7dWXk2xbPd/7CasSTuRh4biua5C+jaELhZl3qQwu3XMEqHXXfEk8QCHuaxXFWkT9pkm2Q2irMu6OT2Kd3AaJ1UdCQOeTLboVvnLeIcb59grKQYnKKtq46mTyarvSdxR/KQL9DG6uMBGZG8cYqj4jy2M1C8Ip84IE/W+DDpBrodKriZg0mF+HYVZUUiEZte29WXKOfmo8ZwokGauA3xHmuXSacPDXkSE38OTBEhzYXbH1j/A9k7nfSQrEjRCPvxGf+8pcbs+9vo36Pk3yOSc9vQ5OkLUwI82pGbnip2OceM+pGE5TFclbByIyp94vQU44NDdjI7Ju6eqs9D6/5l+YSVb9FQYONdwOPDjLxTth0y+aSdfVrev8fwJsk1kl7bzDwgFttIPWAX7O8/hMssPoRLv7vh/J/GthF7CNf9rV6dTti/ZabxjfMww9bYHme//VdFr/yLwPcPAAAA//8DAFBLAwQUAAYACAAAACEAl4eZ6UcBAAA/AgAAEQAIAWRvY1Byb3BzL2NvcmUueG1sIKIEASigAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfJHfSsMwFMbvBd+h5L5N0rKhoe1AZVcOBCuKdyE524pNGpJotzcQvPXGR9xbmHVbnX/wMnzf+Z3vfMknK9VEL2Bd3eoC0YSgCLRoZa0XBbqrpvEZipznWvKm1VCgNTg0KU9PcmGYaC3c2NaA9TW4KJC0Y8IUaOm9YRg7sQTFXRIcOojz1iruw9MusOHiiS8Ap4SMsQLPJfccb4GxGYhoj5RiQJpn2/QAKTA0oEB7h2lC8ZfXg1Xuz4FeOXKq2q9NuGkf95gtxU4c3CtXD8au65Iu62OE/BQ/zK5v+1PjWm+7EoDKbT8Nd34WqpzXIC/W5eb9Ldp8vOb4t5RL0YdjwgL3IKOwju3CHZT77PKqmqIyJWkWk1FM04pSRkeMkMcc/5gvB6Da7/+fOI7JeUxpRcZslDKSHREPgLLP/f3Ly08AAAD//wMAUEsDBBQABgAIAAAAIQDE1wQWkwEAAP0CAAAQAAgBZG9jUHJvcHMvYXBwLnhtbCCiBAEooAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJySzU7rMBCF91fiHSLvqVNACFWOEeJHLEC3Ugt740xaC9eO7CFqeQLuO7BhgcQb3BVvw99jMElESYEVu5k5o+PPxxa785lNKgjReJexfi9lCTjtc+MmGTsbH63vsCSicrmy3kHGFhDZrlz7I4bBlxDQQEzIwsWMTRHLAedRT2GmYo9kR0rhw0whtWHCfVEYDQdeX83AId9I020OcwSXQ75eLg1Z6zio8Lemudc1XzwfL0oClmKvLK3RCumW8tTo4KMvMDmca7CCd0VBdCPQV8HgQqaCd1sx0srCPhnLQtkIgn8OxDGoOrShMiFKUeGgAo0+JNFcU2wbLLlQEWqcjFUqGOWQsOq1tmlqW0YM8vn//dPj7dvdg+Ckt7Om7K52a7Ml+80CFauLtUHLQcIq4dighfi3GKqAPwD3u8ANQ4vb4rw83L3+u/nG19yYTvrifWLcZTwrx/5AIXxEtzoUo6kKkFPay2iXA3FMqQVbm+xPlZtA/rHzXagf+rz9zbK/3Us3U3rDzkzwz38r3wEAAP//AwBQSwMEFAAGAAgAAAAhAJjIqrFGAQAAhAIAABMACAFkb2NQcm9wcy9jdXN0b20ueG1sIKIEASigAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtJJBT4MwFMfvJn4H0ntpKWPAAixSRmI8aHTuakgpG0lpCS3Txfjd7Zw4vWq8vZd/83u/vrxk+dIJZ88H3SqZAs/FwOGSqbqV2xQ8rksYAUebStaVUJKn4MA1WGaXF8ndoHo+mJZrxyKkTsHOmH6BkGY73lXatbG0SaOGrjK2HbZINU3LeKHY2HFpEMF4jtiojepg/4UDJ95ib36LrBU72unN+tBb3Sz5hB+cpjNtnYLXIqBFEeAAklVMoYe9HMZ+HEIcYUxyQsv4avUGnP74mABHVp39+s3DrcXWIzP52Ip6wweL3puF6J+1GTKCAwI94toduiSy8ASdwwRNDn+08Seba7r5Mb602rSIwpxExYyGeRSuaOgHvp8X5TyP4ieP/IvQbBKilWCjqIw9pPtR8JNcO8vwx1hbfN8BOp9P9g4AAP//AwBQSwECLQAUAAYACAAAACEApwzreWgBAAANBQAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQItABQABgAIAAAAIQATXr5lAgEAAN8CAAALAAAAAAAAAAAAAAAAAKEDAABfcmVscy8ucmVsc1BLAQItABQABgAIAAAAIQCsG2tTKwMAAAAIAAAPAAAAAAAAAAAAAAAAANQGAAB4bC93b3JrYm9vay54bWxQSwECLQAUAAYACAAAACEAgT6Ul/MAAAC6AgAAGgAAAAAAAAAAAAAAAAAsCgAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECLQAUAAYACAAAACEAGZKI9x5GAABKqgEAGAAAAAAAAAAAAAAAAABfDAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsBAi0AFAAGAAgAAAAhAJX4lSbcBQAA1BgAABMAAAAAAAAAAAAAAAAAs1IAAHhsL3RoZW1lL3RoZW1lMS54bWxQSwECLQAUAAYACAAAACEAQrLmkq8HAAAlagAADQAAAAAAAAAAAAAAAADAWAAAeGwvc3R5bGVzLnhtbFBLAQItABQABgAIAAAAIQARkdL1JgUAAGEQAAAUAAAAAAAAAAAAAAAAAJpgAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQItABQABgAIAAAAIQCXh5npRwEAAD8CAAARAAAAAAAAAAAAAAAAAPJlAABkb2NQcm9wcy9jb3JlLnhtbFBLAQItABQABgAIAAAAIQDE1wQWkwEAAP0CAAAQAAAAAAAAAAAAAAAAAHBoAABkb2NQcm9wcy9hcHAueG1sUEsBAi0AFAAGAAgAAAAhAJjIqrFGAQAAhAIAABMAAAAAAAAAAAAAAAAAOWsAAGRvY1Byb3BzL2N1c3RvbS54bWxQSwUGAAAAAAsACwDBAgAAuG0AAAAA";
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
  var _hp = Number(state.hp)||0; var _fp = Number(state.fp)||0;
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
    if(!_eqArmor[_ai])continue;
    var _aInfo=typeof getArmorAC==="function"?getArmorAC(_eqArmor[_ai]):null;
    if(!_aInfo){
      var _an=itemName(_eqArmor[_ai])||"";
      if(_an==="演出戏服"||_an==="高档服装"||_an==="布衣"||_an==="披风"){
        _aInfo={base:11,addDex:true,dexCap:2};
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
  // 背景创建选择写入两个 [其他内容] 块；H33–H39 不再使用
  set("U27", exportBackgroundChoiceText(state));
  set("U30", exportBackgroundExtraText(state));
  var _legacyRefs = ["H33", "H34", "H35", "H36", "H37", "H38", "H39"];
  for (var _lri = 0; _lri < _legacyRefs.length; _lri++) set(_legacyRefs[_lri], "", false);

  // Proficiencies (E 列标签 → G 列加值)
  if (typeof fillXlsxProficiencies === "function") fillXlsxProficiencies(set, xml, strings, state);

  // Feats
  if (state.special_feats && state.special_feats.length > 0) {
    fillXlsxSpecialFeats(set, state.special_feats);
  }

  // Currency
  if (state.currency) {
    set("Q36", String(state.currency["金币"] || 0));
    set("Q38", String(state.currency["银币"] || 0));
    set("Q40", String(state.currency["铜币"] || 0));
    set("Q42", String(state.currency["其他"] || ""));
  }

  // Equipment (write to I/K columns matching template layout)
  // Template has I labels: I46=武器, I50=防具, I52=武器, I56=配饰, I61=背包, I72=旅行腰包, I78=杂物
  // Item names go in K column at/below each label
  if (state.equipment) {
    var eqMap = [
      { zone: "主手武器", start: 47, max: 3 },
      { zone: "防具", start: 51, max: 1 },
      { zone: "副手武器", start: 53, max: 3 },
      { zone: "配饰", start: 57, max: 3 },
      { zone: "背包", start: 62, max: 9 },
      { zone: "旅行腰包", start: 73, max: 4 },
      { zone: "杂物包", start: 79, max: 9 }
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
      for (var ii = 0; ii < items.length && writeIdx < slot.max; ii++) {
        var eqItemName = items[ii];
        if (eqItemName && typeof eqItemName === 'object') eqItemName = eqItemName.item || eqItemName.name || '';
        if (!eqItemName || isEquipPlaceholder(eqItemName)) continue;
        set("K" + (slot.start + writeIdx), String(eqItemName));
        writeIdx++;
      }
    }
    var _matNames = exportMaterialPackNames(state);
    set("I89", _matNames[0] || "材料包");
    set("I100", _matNames[1] || "材料包");
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
  var freeCantrips = (state.skills || []).filter(function (s) { return s && (s.grantedBy === "法师学徒" || (s.freeSlot && s.src === "法师")); });
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

  // 法师学徒免费戏法：写入主技能列表空位；先划掉再覆盖，避免被误划
  if (freeCantrips.length) {
    var _cantripRow = 123 + mainSkills.length;
    for (var _fci = 0; _fci < freeCantrips.length && _cantripRow + _fci <= 162; _fci++) {
      var _fc = freeCantrips[_fci];
      var _fcName = _fc.n || _fc.name || "";
      if (!_fcName) continue;
      var _fcRef = lookupSkill(_fcName, "法师学徒");
      var _fcRow = _cantripRow + _fci;
      set("B" + _fcRow, _fcName, true, _bMainXf);
      set("D" + _fcRow, _fc.tm || _fc.time || (_fcRef && _fcRef.fields ? _fcRef.fields['施展时间'] : "") || "");
      set("E" + _fcRow, _fc.range || (_fcRef && _fcRef.fields ? _fcRef.fields['施展距离'] : "") || "");
      set("F" + _fcRow, _fc.dur || _fc.duration || (_fcRef && _fcRef.fields ? _fcRef.fields['持续时间'] : "") || "");
      set("H" + _fcRow, skillExportCost(_fc, _fcRef));
      set("I" + _fcRow, "法师学徒");
      set("J" + _fcRow, skillExportDesc(_fc, _fcRef));
    }
  }

  // XP/SP（含 0）
  set("U46", String(state.xp != null ? state.xp : 0));
  ensureSpState();
  set("U51", String(state.sp_points != null ? state.sp_points : 0));

  // Weight/Language/Profession
  var _carryStr = ((state.attrs && state.attrs["力量"]) || 8) + ((state.profs && state.profs["力量"] && state.profs["力量"]["承重"]) || 0);
  set("R3", String(_carryStr * 5));
  set("R4", String(_carryStr * 10));
  set("R5", String(_carryStr * 15));
  if (state.languages && state.languages.length > 0) set("Q6", state.languages.join("、"));
  else set("Q6", "");
  var _profNames = (state.professionals || []).map(function (pitem) {
    if (pitem && typeof pitem === "object") return pitem.name || pitem.n || pitem.item || "";
    return pitem;
  }).filter(function (x) { return x != null && x !== ""; });
  if (_profNames.length > 0) set("Q8", _profNames.join("、"));
  else set("Q8", "");

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
  var u8 = zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes);

  // Electron：走主进程受控保存对话框（避免 Chromium 默认下载对话框不可点击/阻塞）
  if (window.electronAPI && typeof window.electronAPI.saveExport === "function") {
    try {
      var eb64 = await _xlsxU8ToBase64(u8);
      var er = await window.electronAPI.saveExport(fileName, eb64);
      if (er && er.ok) { SB_toast("档案已导出"); }
      else if (!er || !er.canceled) { SB_toast("导出失败" + (er && er.error ? "：" + er.error : "")); }
    } catch (e) {
      SB_toast("导出失败：" + ((e && e.message) || "未知错误"));
    }
    return;
  }

  // Android APK：异步转 base64，避免大文件同步循环阻塞 WebView 主线程
  if (window.mobileBridge && typeof window.mobileBridge.saveFile === "function") {
    try {
      var mb64 = await _xlsxU8ToBase64(u8);
      var mr = window.mobileBridge.saveFile(mb64, fileName);
      if (typeof mr === "string" && mr.indexOf("error:") === 0) {
        SB_toast("导出失败：" + mr.slice(6));
      } else {
        SB_toast("档案已保存到下载目录");
      }
    } catch (e) {
      SB_toast("导出失败：" + ((e && e.message) || "未知错误"));
    }
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
        SD_confirm(confirmMsg+"\n\n确认导入？", function() {
        for(var i=0;i<keys.length;i++)localStorage.setItem(keys[i],data.saves[keys[i]]);
        SB_toast("已导入 "+keys.length+" 个存档\n\n请刷新页面查看");
        location.reload();
      });
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
      SD_confirm('当前角色有未保存的更改，是否保存后返回？\n\n"确定" = 保存并返回\n"取消" = 不保存直接返回', function() {
        saveCurrentSlot();
      });
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

