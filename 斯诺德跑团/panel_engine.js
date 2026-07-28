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
  "力量":{"豁免":0,"威力":0,"承重":0,"运动-跳跃":0,"运动-攀爬":0,"运动-游泳":0,"运动-马术":0,"运动-冲浪":0},
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
"story":"","personality":"","traits":"","ideals":"","bonds":"","flaws":"","deity":"","contacts":"","scamType":"","missionChannel":"","academicDomain":"","weapon_specs":[],
"attrs":{"力量":10,"敏捷":10,"体质":10,"智力":10,"感知":10,"魅力":10,"意志":10,"幸运":10},
"classes":[{"name":"","level":0,"styles":["","","",""]},{"name":"","level":0,"styles":["","","",""]},{"name":"","level":0,"styles":["","","",""]}],
"skills":[], "special_feats":[], "feats":[], "currency":{"金币":0,"银币":0,"铜币":0,"其他":""},
"equipment":{"主手武器":[],"副手武器":[],"防具":[],"配饰":[],"背包":[],"杂物包":[],"旅行腰包":[],"材料包":[]},
"racial_traits":[],"class_features":[],"languages":["通用语"],"professionals":[],"talent_tree":[],"blueprints":[],"blueprint_bonus_slots":0,
"forbidden_skills":[],"unlocked_tiers":["一阶","二阶"],
"containerItems":{"背包":"已解锁","旅行腰包":"已解锁","材料包A":"","材料包B":""}};

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

function getStateSnapshot() {
  // Deep clone serializable state (exclude functions, DOM refs, temp vars)
  var clone = JSON.parse(JSON.stringify(state, function(key, val) {
    // Skip internal/temp keys that should not be persisted
    if (key.indexOf("_") === 0 && key !== "_hp_per_level_bonus" && key !== "_feat_ac_bonus") return undefined;
    return val;
  }));
  clone._savedAt = new Date().toISOString();
  clone._charName = CURRENT_CHAR || state.name;
  return clone;
}

function saveState(slotIndex) {
  var charName = CURRENT_CHAR || state.name;
  if (!charName) { alert("没有角色可保存"); return false; }
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
    alert("保存失败: " + e.message);
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
      if (dk.indexOf("_") === 0 && dk !== "_hp_per_level_bonus" && dk !== "_feat_ac_bonus") {
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
    ensureSpState();
    ensureClaimedLevels();
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

function getCurrentAttrCap() {
  var maxLv = getMaxLevel();
  var tbl = LEVEL_TABLE["\u4e3b\u804c\u4e1a"];
  var cap = 18;
  for (var li = 1; li <= maxLv; li++) {
    if (tbl[li] && tbl[li].attr_cap) cap = tbl[li].attr_cap;
  }
  return cap;
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
  return total;
}
function getCurrentProfCap() {
  var maxLv = getMaxLevel();
  var tbl = LEVEL_TABLE["\u4e3b\u804c\u4e1a"];
  var cap = 2;
  for (var li = 1; li <= maxLv; li++) {
    if (tbl[li] && tbl[li].prof_cap) cap = tbl[li].prof_cap;
  }
  return cap;
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
    var _isST=!1;var _sd=SKILL_DATA[s.src];if(_sd){for(var _si=0;_si<_sd.length;_si++){if(_sd[_si].name===s.n&&_sd[_si].type==="starting"){_isST=!0;break;}}}var _rc=REF_CLASSES[s.src];if(!_isST&&_rc&&_rc.starting_features){for(var _rci=0;_rci<_rc.starting_features.length;_rci++){if(_rc.starting_features[_rci].name===s.n){_isST=!0;break;}}}if(_isST)continue;

    var ci=(s.sub&&s.sub!='')?1:0;


    if(!sc[ci])sc[ci]={};var stName=getSkillStyle(s.n,s.src);if(!sc[ci][stName])sc[ci][stName]=0;sc[ci][stName]++;}


  // Count styles from talent tree
  for(var ti=0;ti<state.talent_tree.length;ti++){
    var t=state.talent_tree[ti];if(!t||!t.n)continue;
    var tCls=t.cls||"";if(tCls==="通用")continue;var tStyle=tCls?getSkillStyle(t.n,tCls):findSkillStyleAnywhere(t.n);
    if(!tStyle)continue;
    var tci=((t.sub&&t.sub!="")||(t.cls&&state.classes[1].name&&t.cls===state.classes[1].name))?1:0;
    if(!sc[tci])sc[tci]={};if(!sc[tci][tStyle])sc[tci][tStyle]=0;sc[tci][tStyle]++;}

  for(var ci=0;ci<state.classes.length;ci++){


    if(sc[ci]){var st=Object.keys(sc[ci]).sort(function(a,b){return sc[ci][b]-sc[ci][a]}).filter(function(s){return s!=="通用";});
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
var BLUEPRINT_XLSX_CELLS = (function(){
  var a=[], i;
  for (i = 0; i < BLUEPRINT_EXPORT_SLOTS; i++) a.push("O" + (211 + i));
  return a;
})();

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
    alert("\u5f53\u524d\u56fe\u7eb8\u6570\u5df2\u8fbe\u6216\u8d85\u8fc7\u89c4\u5219\u4e0a\u9650\uff08" + ruleCap + "\uff09\uff0c\u4ecd\u53ef\u8bb0\u5f55\uff08\u7269\u7406\u683c\u5b50 " + BLUEPRINT_EXPORT_SLOTS + "\uff09");
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
  for (i = 0; i < BLUEPRINT_XLSX_CELLS.length; i++) set(BLUEPRINT_XLSX_CELLS[i], "");
}

function fillXlsxBlueprints(set, blueprints) {
  var list = blueprints || [], i, n, max = BLUEPRINT_XLSX_CELLS.length;
  set("O210", "\u56fe\u7eb8\uff08\u4e13\u4e1a\u69fd\u4f4d\uff09");
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
  if (!check.ok) { alert(check.reason); return false; }
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
    id: skillData.id, n: skillData.name, src: skillData.style || clsName,
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
  var tierRowMap = {}, hdr, nextHdr, start, end, ti, tj, tier;
  for (ti = 0; ti < tierOrder.length; ti++) {
    tier = tierOrder[ti];
    hdr = headers[tier];
    if (!hdr) continue;
    nextHdr = 9999;
    for (tj = ti + 1; tj < tierOrder.length; tj++) {
      if (headers[tierOrder[tj]]) { nextHdr = headers[tierOrder[tj]]; break; }
    }
    start = hdr + 1;
    end = nextHdr - 2;
    if (end < start) end = start;
    tierRowMap[tier] = [start, end];
  }
  if (!tierRowMap["\u4e00\u9636"]) return defaultTalentTierRowMap();
  return tierRowMap;
}

function clearXlsxTalentSlots(set, tierRowMap) {
  var tier, range, r;
  for (tier in tierRowMap) {
    range = tierRowMap[tier];
    for (r = range[0]; r <= range[1]; r++) set("O" + r, "");
  }
}

function clearXlsxSkillRows(set) {
  var r, cols = ["B", "D", "E", "F", "H", "I", "J"], ci;
  for (r = 123; r <= 162; r++) {
    for (ci = 0; ci < cols.length; ci++) set(cols[ci] + r, "");
  }
  for (r = 168; r <= 209; r++) {
    for (ci = 0; ci < cols.length; ci++) set(cols[ci] + r, "");
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
    for (ii = 0; ii < ranges[ri].max; ii++) set("K" + (ranges[ri].row + ii), "");
  }
}

function clearXlsxClassAndFeatureSlots(set) {
  set("B23", ""); set("D23", "");
  set("B29", ""); set("D29", "");
  set("E17", ""); set("E18", "");
  var ri;
  for (ri = 0; ri < 8; ri++) {
    set("I" + (112 + ri), "");
    set("K" + (112 + ri), "");
    set("O" + (112 + ri), "");
    set("Q" + (112 + ri), "");
  }
  var featRows = [36, 38, 40, 42];
  for (ri = 0; ri < featRows.length; ri++) set("K" + featRows[ri], "");
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
  if (!traits && state.background && typeof REF_BACKGROUNDS !== "undefined" && REF_BACKGROUNDS[state.background]) {
    traits = (REF_BACKGROUNDS[state.background].description || "").replace(/\\n/g, "\n");
  }
  if (state.background === "\u8fd0\u52a8\u5458" && state.weapon_specs && state.weapon_specs.length) {
    var sport = state.weapon_specs[0];
    if (sport && traits.indexOf(sport) < 0) {
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
window._itemTagsCache = JSON.parse('{"羊皮纸（10张）":["杂物"],"长矛":["武器"],"主食":["杂物"],"皮甲":["防具"],"黑椒牛排":["食品","消耗品","正餐","食品酒水"],"炼金工具":["套装","工具"],"旅行腰包":["容器"],"魅惑合剂":["消耗品","药剂"],"力场防护合剂":["消耗品","药剂"],"亚历山大钻石":["材料","矿石","宝石"],"固化力场碎片":["材料","魔法材料","其他材料"],"大提琴":["乐器"],"扑克":["杂物"],"鞍座":[null,"生物"],"食人魔力量药水":["消耗品","药剂"],"厨师工具":["套装","工具"],"空白的魔法卷轴":["卷轴","铭文","材料"],"圆顶帽":["服饰","护甲","防具"],"燃火头冠":["配饰"],"黑口鱼油":["材料","生物材料","其他材料"],"樱桃酒":["食品","消耗品","酒水","食品酒水"],"银叶草":["材料","草药"],"爽身粉":["杂物"],"学徒法杖":["武器"],"炸洋葱圈":["食品","消耗品","正餐","食品酒水"],"魔术道具":["杂物"],"盐":["食品","消耗品","佐料","按重量","食品酒水"],"狩猎陷阱":["杂物"],"指南针":["杂物"],"萃变体汁液":["材料","魔法材料","其他材料"],"墓地苔":["材料","草药"],"玻璃瓶":["杂物"],"羊绒毯":["杂物"],"香水薄荷":["材料","草药"],"加速吊坠":["配饰"],"薄荷汁":["食品","消耗品","酒水","食品酒水"],"星光玫瑰":["材料","草药"],"奥术恒金":["材料","矿石","矿产"],"卷心菜":["食品","消耗品","食材","可堆叠","食品酒水"],"真银锭":["材料","矿石","矿产"],"明焰石":["材料","矿石","宝石"],"斗篷":["服饰","护甲","防具"],"水果茶":["食品","消耗品","酒水","食品酒水"],"祷告经书":["杂物"],"骰子":["杂物"],"倾慕者的信物":["杂物"],"猪排汉堡":["食品","消耗品","正餐","食品酒水"],"铭文材料包":["容器"],"青金石":["材料","矿石","宝石"],"报刊":["杂物"],"热苹果酒":["食品","消耗品","酒水","食品酒水"],"强效生命药水":["消耗品","药剂"],"旅行者的吊坠":["配饰"],"刺剑":["武器"],"二轮货车":[null,"载具"],"霜冻粒子":["材料","元素材料","其他材料"],"奥术蓝钢":["材料","矿石","矿产"],"龙井茶":["材料","草药"],"黑白合之吻":["消耗品","药剂"],"极效生命药水":["消耗品","药剂"],"蛋白石":["材料","矿石","宝石"],"羽毛笔":["杂物"],"短杖":["武器"],"史莱姆粘合剂":["材料","生物材料","其他材料"],"翡翠线轴":["材料","工艺材料","其他材料"],"蛇藤花":["材料","草药"],"法力浮龙的灵核":["材料","魔法材料","其他材料"],"蛇鳞":["材料","生物材料","其他材料"],"绷带":["医用","杂物","可堆叠"],"战斧":["武器"],"酒壶":["杂物"],"苦橙":["材料","草药"],"小型飞艇":[null,"载具"],"瑟银锭":["材料","矿石","矿产"],"月光骑士":["食品","消耗品","酒水","食品酒水"],"雪狐花":["材料","草药"],"假发":["服饰","护甲","防具"],"娱乐杂志":["杂物"],"娱乐杂志和周刊":["杂物"],"翠绿头环":["配饰"],"圣徽":["杂物"],"猫眼药水":["消耗品","药剂"],"马裤":["服饰","护甲","防具"],"火柴盒":["杂物"],"雷电抗性药水":["消耗品","药剂"],"微光粒子":["材料","元素材料","其他材料"],"炸鱼":["食品","消耗品","正餐","水产","食品酒水"],"次级活力药水":["消耗品","药剂"],"黑曜石":["材料","矿石","矿产"],"雪梨酒":["食品","消耗品","酒水","食品酒水"],"胸甲":["防具"],"香草":["食品","消耗品","佐料","按重量","食品酒水"],"四轮货车":[null,"载具"],"蒸汽卡车":[null,"载具"],"猫眼石念珠":["杂物"],"玉米":["食品","消耗品","食材","可堆叠","食品酒水"],"写作工具":["套装","工具"],"铜锭":["材料","矿石","矿产"],"牛肉汉堡":["食品","消耗品","正餐","食品酒水"],"魔皇草":["材料","草药"],"沙漏":["杂物"],"盲鱼肠":["材料","生物材料","其他材料"],"音爆防护合剂":["消耗品","药剂"],"队伍旗帜":["杂物"],"跃迁兽的皮革":["材料","生物材料","其他材料"],"史莱姆黏液":["材料","魔法材料","其他材料"],"电气粒子":["材料","元素材料","其他材料"],"小食拼盘":["食品","消耗品","正餐","食品酒水"],"苏打水":["容器","杯"],"孔雀石念珠":["杂物"],"垂钓材料包":["容器"],"蓝宝石":["材料","矿石","宝石"],"甜点":["杂物"],"哨笛":["杂物"],"启迪药水":["消耗品","药剂"],"龙血葵":["材料","草药"],"撬棍":["杂物"],"正餐":["杂物"],"强酸防护合剂":["消耗品","药剂"],"冬酒：漫漫长夜":["食品","消耗品","酒水","食品酒水"],"任意法术学派的基础书籍":["杂物"],"双人帐篷":["杂物"],"薰衣紫金粉":["材料","工艺材料","其他材料"],"水下呼吸药水":["消耗品","药剂"],"白萝卜":["食品","消耗品","食材","可堆叠","食品酒水"],"衬衣":["服饰","护甲","防具"],"抓钩":["杂物"],"蜂蜜酒":["食品","消耗品","酒水","食品酒水"],"半身板甲":["防具"],"弱化巨魔之血药水":["消耗品","药剂"],"白手套":["服饰"],"月光石":["材料","矿石","宝石"],"浑浊的虚空水晶":["材料","元素材料","其他材料"],"刮鱼刀":["杂物"],"巨魔之血药水":["消耗品","药剂"],"玻璃试管":["杂物"],"露塔莉娅水果酒":["食品","消耗品","酒水","食品酒水"],"天界钢":["材料","矿石","矿产"],"魔精":["消耗品","药剂"],"开锁工具":["套装","工具"],"黑葡萄酒":["食品","消耗品","酒水","食品酒水"],"凤凰烬羽":["材料","生物材料","其他材料"],"强力胶":["杂物"],"琥珀星光药水":["消耗品","药剂"],"铁盾合剂":["消耗品","药剂"],"巨化药剂":["消耗品","药剂"],"手风琴":["乐器"],"香辛料":["食品","消耗品","佐料","按重量","食品酒水"],"磨刀石":["杂物"],"笔记本":["杂物"],"打火石":["杂物"],"板甲":["防具"],"水晶兰":["材料","草药"],"锁":["杂物"],"闪电灵核":["材料","元素材料","其他材料"],"贝斯":["乐器"],"龙棋":["杂物"],"热气球":[null,"载具"],"口风琴":["乐器"],"橡果酒":["食品","消耗品","酒水","食品酒水"],"黄金鱼油":["材料","生物材料","其他材料"],"血石榴":["材料","矿石","宝石"],"噩梦藤":["材料","草药"],"商船":[null,"载具"],"无檐帽":["服饰","护甲","防具"],"典礼戒指":["配饰"],"乘用马":[null,"生物"],"衬裙":["服饰","护甲","防具"],"木材":["杂物"],"活力药水":["消耗品","药剂"],"面粉":["食品","消耗品","淀粉","按重量","食品酒水"],"探索工具":["套装","工具"],"其他水产":["杂物"],"竖琴":["乐器"],"闪电头巾":["配饰"],"黄金参":["材料","草药"],"七彩龙蜥的薄膜":["材料","生物材料","其他材料"],"银锭":["材料","矿石","矿产"],"灰女巫":["材料","草药"],"冰霜抗性药水":["消耗品","药剂"],"心灵防护合剂":["消耗品","药剂"],"吉他":["乐器"],"辣椒":["食品","消耗品","食材","可堆叠","食品酒水"],"钢铁合剂":["消耗品","药剂"],"水上行走药水":["消耗品","药剂"],"豹眼石":["材料","矿石","宝石"],"皇血草":["材料","草药"],"单人帐篷":["杂物"],"手铲":["杂物"],"旅行者炖菜":["食品","消耗品","正餐","食品酒水"],"曼陀罗":["材料","草药"],"剑油":["材料","工艺材料","其他材料"],"灯油":["杂物"],"精钢盾牌":["武器"],"荆棘藻":["材料","草药"],"矮人烈酒":["食品","消耗品","酒水","食品酒水"],"信号弹":[],"长弓":["武器"],"凤凰沉木":["材料","草药"],"医疗包":["医用","杂物","可堆叠"],"梦境蜘蛛的原始丝囊":["材料","生物材料","其他材料"],"生命药水":["消耗品","药剂"],"短斧":["武器"],"铃铛":["杂物"],"炭笔":["杂物"],"裁缝工具":["套装","工具"],"多香果":["材料","草药"],"背包":["容器"],"庆典粒子":["材料","魔法材料","其他材料"],"麻绳":["杂物"],"金棘草":["材料","草药"],"止血剂":["医用","杂物","可堆叠"],"硬肉干":["食品","消耗品","正餐","食品酒水"],"蟹肉":["食品","消耗品","食材","可堆叠","水产","食品酒水"],"雕艺工具":["套装","工具"],"龙息药水":["消耗品","药剂"],"水袋":["杂物"],"龙血葵酒":["食品","消耗品","酒水","食品酒水"],"轻锤":["武器"],"习武木棍":["武器"],"墨水":["杂物"],"浓缩咖啡":["食品","消耗品","酒水","食品酒水"],"感应合剂":["消耗品","药剂"],"红宝石":["材料","矿石","宝石"],"木杖":["武器"],"矿工镐":["杂物"],"水果":["杂物"],"驮用马":[null,"生物"],"猫眼石":["材料","矿石","宝石"],"魔法箭矢手镯":["配饰"],"长裙":["服饰","护甲","防具"],"龙眼果":["材料","草药"],"酒精":["医用","杂物","可堆叠"],"精金锭":["材料","矿石","矿产"],"星耀石":["材料","矿石","宝石"],"烹饪材料包":["容器"],"夜鸦药水":["消耗品","药剂"],"医用材料包":["容器"],"钢琴":["乐器"],"金属盾牌":["武器"],"蓝艳菇":["材料","草药"],"清泉水":["容器","杯"],"奶油":["食品","消耗品","佐料","按重量","食品酒水"],"抗毒剂":["医用","杂物","可堆叠"],"音爆抗性药水":["消耗品","药剂"],"体魄药水":["消耗品","药剂"],"袖剑":["武器"],"熏肉排":["食品","消耗品","正餐","食品酒水"],"柠檬":["食品","消耗品","食材","可堆叠","食品酒水"],"号角":["乐器"],"胡萝卜":["食品","消耗品","食材","可堆叠","食品酒水"],"纯银祭器":["杂物"],"矿石材料包":["容器"],"金锭":["材料","矿石","矿产"],"南岛冰茶":["食品","消耗品","酒水","食品酒水"],"灵界钢":["材料","矿石","矿产"],"威士忌":["食品","消耗品","酒水","食品酒水"],"火焰花":["材料","草药"],"虾肉":["食品","消耗品","食材","可堆叠","水产","食品酒水"],"翡翠玉":["材料","矿石","宝石"],"鳞甲":["防具"],"大师级法杖":["武器"],"剧毒抗性药水":["消耗品","药剂"],"冰心头饰":["配饰"],"丹参":["材料","草药"],"蘑菇烩泥鱼":["食品","消耗品","正餐","水产","食品酒水"],"坚韧合剂":["消耗品","药剂"],"夹克外套":["服饰","护甲","防具"],"管风琴":["乐器"],"狮鹫":[null,"生物"],"放大镜":["杂物"],"雨燕药水":["消耗品","药剂"],"肥皂":["杂物"],"腰带":["服饰","护甲","防具"],"力量合剂":["消耗品","药剂"],"光耀防护合剂":["消耗品","药剂"],"星界银":["材料","矿石","矿产"],"驴":[null,"生物"],"魔纹布料":["材料","魔法材料","其他材料"],"坚忍药水":["消耗品","药剂"],"简易野炊工具":["杂物"],"冰霜防护合剂":["消耗品","药剂"],"马车":[null,"载具"],"炼金材料包":["容器"],"烤羊排":["食品","消耗品","正餐","食品酒水"],"伪造玺戒":["杂物"],"收纳盒":["容器"],"长剑":["武器"],"石南草":["材料","草药"],"紧身裤":["服饰","护甲","防具"],"铲子":["杂物"],"炼狱铁":["材料","矿石","矿产"],"金牌烤火鸡":["食品","消耗品","正餐","食品酒水"],"演出戏服":["服饰","护甲","防具","杂物"],"白葡萄酒":["食品","消耗品","酒水","食品酒水"],"轻弩":["武器"],"幽影尘":["材料","魔法材料","其他材料"],"熏香":["杂物"],"短棒":["武器"],"标枪":["武器"],"共鸣水晶":["材料","魔法材料","其他材料"],"极效活力药水":["消耗品","药剂"],"紫水晶":["材料","矿石","宝石"],"香水":["杂物"],"幽灵菇":["材料","草药"],"三叉戟":["武器"],"大地灵核":["材料","元素材料","其他材料"],"玺戒":["杂物"],"红肉":["杂物"],"易容工具":["套装","工具"],"清蒸肥蟹":["食品","消耗品","正餐","水产","食品酒水"],"失心蛇胆":["材料","草药"],"眼镜":["服饰","护甲","防具"],"玛瑙石":["材料","矿石","宝石"],"镣铐":["杂物"],"红战士":["材料","草药"],"链甲":["防具"],"冰霜灵核":["材料","元素材料","其他材料"],"雕刻刀":["杂物"],"洋葱":["食品","消耗品","食材","可堆叠","食品酒水"],"加速药水":["消耗品","药剂"],"蘑菇":["食品","消耗品","食材","可堆叠","食品酒水"],"奇械摩托":[null,"载具"],"皮匠工具":["套装","工具"],"麻绳（10米）":["杂物"],"划艇":[null,"载具"],"黄瓜":["食品","消耗品","食材","可堆叠","食品酒水"],"纯洁的珍珠粉":["材料","工艺材料","其他材料"],"虎眼石":["材料","矿石","宝石"],"裙撑":["服饰","护甲","防具"],"丝绸布料":["杂物"],"地根草":["材料","草药"],"烟斗":["杂物"],"野钢花":["材料","草药"],"卷轴匣":["杂物"],"亮银线轴":["材料","工艺材料","其他材料"],"绿宝石":["材料","矿石","宝石"],"礼帽":["服饰","护甲","防具"],"重弩":["武器"],"苦橙鸡尾酒":["食品","消耗品","酒水","食品酒水"],"白灼秋葵浓汤":["食品","消耗品","正餐","食品酒水"],"燕尾服":["服饰","护甲","防具"],"兽皮甲":["防具"],"火焰防护合剂":["消耗品","药剂"],"便签条":["杂物"],"烟熏香肠":["食品","消耗品","正餐","食品酒水"],"火焰爵士的愤怒":["食品","消耗品","酒水","食品酒水"],"冰镇牛奶":["食品","消耗品","酒水","食品酒水"],"辣椒酱":["食品","消耗品","佐料","按重量","食品酒水"],"折扇":["服饰"],"攀爬工具":["套装","工具"],"精钢锭":["材料","矿石","矿产"],"红葡萄酒":["食品","消耗品","酒水","食品酒水"],"乐鼓":["乐器"],"檞寄生":["材料","草药"],"宁神花":["材料","草药"],"爬梯":["杂物"],"裁缝材料包":["容器"],"歌唱葵":["材料","草药"],"大型飞艇":[null,"载具"],"剧毒防护合剂":["消耗品","药剂"],"闪光尘":["材料","元素材料","其他材料"],"灵网蛛丝":["材料","生物材料","其他材料"],"火棘果":["材料","草药"],"听诊器":["杂物"],"番茄":["食品","消耗品","食材","可堆叠","食品酒水"],"土豆葱花汤":["食品","消耗品","正餐","食品酒水"],"獒犬":[null,"生物"],"蜡烛":["杂物"],"柠檬绿茶":["食品","消耗品","酒水","食品酒水"],"油":["食品","消耗品","佐料","按重量","食品酒水"],"高跟鞋":["服饰","护甲","防具"],"清凉膏":["杂物"],"孔雀石":["材料","矿石","宝石"],"画家工具":["套装","工具"],"蓝甲虫精髓":["材料","生物材料","其他材料"],"弯刀":["武器"],"珠宝材料包":["容器"],"长棍":["武器"],"暗影抗性药水":["消耗品","药剂"],"渔具":["杂物"],"调味包":["食品","消耗品","佐料","按重量","食品酒水"],"南瓜":["食品","消耗品","食材","可堆叠","食品酒水"],"源质钢":["材料","矿石","矿产"],"筷子":["杂物"],"火焰之油":["材料","元素材料","其他材料"],"柠檬汽水":["食品","消耗品","酒水","食品酒水"],"暗影防护合剂":["消耗品","药剂"],"雨燕草":["材料","草药"],"亚麻布毯":["杂物"],"银制箭矢/弹药（20发）":[],"墨镜":["服饰","护甲","防具"],"步枪":["武器"],"鱼类":["杂物"],"蜂蜜烧烤肋排":["食品","消耗品","正餐","食品酒水"],"强壮药水":["消耗品","药剂"],"投石索":["武器"],"热情药水":["消耗品","药剂"],"匕首":["武器"],"椒盐鸡腿":["食品","消耗品","正餐","食品酒水"],"木箱":["容器"],"禽类":["杂物"],"臻冰":["材料","元素材料","其他材料"],"镰刀":["武器"],"魔法灵光眼镜":["配饰"],"手杖":["武器"],"番茄浓汤":["食品","消耗品","正餐","食品酒水"],"啤酒烤猪排":["食品","消耗品","正餐","食品酒水"],"领结":["服饰","护甲","防具"],"拳刃":["武器"],"迷药":["杂物"],"甘姜":["材料","草药"],"果酱":["食品","消耗品","佐料","按重量","食品酒水"],"蛇信草":["材料","草药"],"月蔷薇":["材料","草药"],"冬用毯子":["杂物"],"时之沙":["材料","工艺材料","其他材料"],"魔法防护吊坠":["配饰"],"吹箭筒":["武器"],"强酸抗性药水":["消耗品","药剂"],"暗玉":["材料","矿石","宝石"],"短披肩":["服饰","护甲","防具"],"烟熏鲑鱼":["食品","消耗品","正餐","水产","食品酒水"],"冬刺草":["材料","草药"],"扳手":["杂物"],"袖扣":["服饰"],"海鲜浓汤":["食品","消耗品","正餐","水产","食品酒水"],"大师级魔棒":["武器"],"智慧合剂":["消耗品","药剂"],"蜂蜜":["食品","消耗品","佐料","按重量","食品酒水"],"硫磺石":["材料","矿石","矿产"],"跌打草":["材料","草药"],"初级护甲药水":["消耗品","药剂"],"捕网":["武器"],"蚌肉":["食品","消耗品","食材","可堆叠","水产","食品酒水"],"萨克斯":["乐器"],"谷物种子":["杂物"],"望远镜":["杂物"],"魔法尘":["材料","魔法材料","其他材料"],"重锤":["武器"],"生火工具":["套装","工具"],"学徒魔棒":["武器"],"草药工具":["套装","工具"],"培根海鲜炒饭":["食品","消耗品","正餐","水产","食品酒水"],"毛线团":["杂物"],"亚麻布料":["杂物"],"佐料":["杂物"],"洗漱用品":["杂物"],"草药袋":["容器"],"化妆品":["杂物"],"蝇龙的脑垂体":["材料","生物材料","其他材料"],"未经雕刻的图腾":["杂物"],"怒气药水":["消耗品","药剂"],"光耀抗性药水":["消耗品","药剂"],"果篮":["容器"],"琉璃晶铁砂":["材料","工艺材料","其他材料"],"空气魔力":["材料","元素材料","其他材料"],"国王游戏":["杂物"],"野猪火腿":["食品","消耗品","正餐","食品酒水"],"草药烘蛋":["食品","消耗品","正餐","食品酒水"],"布衣":["防具"],"制图工具":["套装","工具"],"金戈铁骨":["材料","草药"],"奶油蘑菇浓汤":["食品","消耗品","正餐","食品酒水"],"秋辉石":["材料","矿石","宝石"],"烟草":["杂物"],"血蓟草":["材料","草药"],"白屈花":["材料","草药"],"隐身药水":["消耗品","药剂"],"蔬菜":["杂物"],"领巾":["服饰","护甲","防具"],"纯铁":["材料","矿石","矿产"],"梦露花":["材料","草药"],"音乐盒":["杂物"],"次级生命药水":["消耗品","药剂"],"施法者头饰":["配饰"],"制毒工具":["套装","工具"],"黄油啤酒":["食品","消耗品","酒水","食品酒水"],"自然防护合剂":["消耗品","药剂"],"单边眼镜":["服饰","护甲","防具"],"自然抗性药水":["消耗品","药剂"],"谎言大师的根茎":["材料","生物材料","其他材料"],"大蒜":["食品","消耗品","佐料","按重量","食品酒水"],"小提琴":["乐器"],"火焰灵核":["材料","元素材料","其他材料"],"火枪":["武器"],"粉笔":["杂物"],"魔法箭矢戒指":["配饰"],"水蛭素":["材料","生物材料","其他材料"],"青铜合剂":["消耗品","药剂"],"渔船":[null,"载具"],"蚌肉杂烩":["食品","消耗品","正餐","水产","食品酒水"],"长礼服":["服饰","护甲","防具"],"黄油":["食品","消耗品","佐料","按重量","食品酒水"],"太阳花":["材料","草药"],"铁匠工具":["套装","工具"],"雷电防护合剂":["消耗品","药剂"],"火把":["杂物"],"火焰抗性药水":["消耗品","药剂"],"观察者眼魔的核心":["材料","生物材料","其他材料"],"黯淡的命运纺锤":["材料","工艺材料","其他材料"],"山铜锭":["材料","矿石","矿产"],"草药材料包":["容器"],"奥法之尘":["材料","魔法材料","其他材料"],"闪光起泡酒":["食品","消耗品","酒水","食品酒水"],"土豆":["食品","消耗品","食材","可堆叠","食品酒水"],"意志合剂":["消耗品","药剂"],"淀粉":["杂物"],"酿酒工具":["套装","工具"],"剥皮小刀":["杂物"],"丹菊":["材料","草药"],"炽心椒":["材料","草药"],"黄油大虾":["食品","消耗品","正餐","水产","食品酒水"],"棱光碎片":["材料","元素材料","其他材料"],"影钻":["材料","矿石","宝石"],"星界钢":["材料","矿石","矿产"],"电磁铁":["材料","工艺材料","其他材料"],"强效活力药水":["消耗品","药剂"],"奇械摄影机":["杂物"],"风暴灵核":["材料","元素材料","其他材料"],"通晓语言药水":["消耗品","药剂"],"海盐":["食品","消耗品","佐料","按重量","食品酒水"],"秘银锭":["材料","矿石","矿产"],"虎骨片":["材料","草药"],"珠宝工具":["套装","工具"],"宽檐帽":["服饰","护甲","防具"],"木杯":["杂物"],"打火机":["杂物"],"心灵抗性药水":["消耗品","药剂"],"名称":[null,"杯"],"玻璃珠":["杂物"],"迅捷合剂":["消耗品","药剂"],"蛇毒":["材料","生物材料","其他材料"],"缩小药剂":["消耗品","药剂"],"润滑油":["杂物"],"鹰角豆":["食品","消耗品","食材","可堆叠","食品酒水"],"弹药（20发）":[],"煤油灯":["杂物"]}');
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


  if (slotName === "\u6750\u6599\u5305") {


    if (!bagType) return false;


    // Check bag type rules


    if (bagType === "\u70f9\u996a\u6750\u6599\u5305") return tags.indexOf("\u98df\u54c1") >= 0 && tags.indexOf("\u6c34\u4ea7") < 0;


    if (bagType === "\u5782\u9493\u6750\u6599\u5305") return tags.indexOf("\u6c34\u4ea7") >= 0;


    if (bagType === "\u533b\u7528\u6750\u6599\u5305") return tags.indexOf("\u533b\u7528") >= 0;


    if (bagType === "\u88c1\u7f1d\u6750\u6599\u5305") return false;


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
    var typeMap={"attribute":"属性","multi":"复合","proficiency":"熟练度","professional":"专业","attribute_health":"属性+生命","health_growth":"生命成长","attribute_proficiency":"属性+熟练","attribute_boost":"属性强化","sp_pack":"技能点","xp_pack":"经验值","armor_ac":"防御","heavy_armor":"重甲防御","extra_slot":"额外槽位","professional_sp":"专业+技能点"};
    typeLabel = typeMap[fd.effects.type] || fd.effects.type;
  }
  var tier = "特殊专长";
  var styleInfo = typeLabel ? "[" + typeLabel + "]" : "";
  showSkillPreview(name, styleInfo, tier, "前置条件：" + prereq + "<br><br>" + desc, null);
}

// Show multiple proficiency choice dialog for feats
function showMultipleProfChoice(featName, options, count, onConfirm) {
  var selected = [];
  var h = "<div style='padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0'>";
  h += "<div style='font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a'>选择" + count + "项熟练项（已选0/" + count + "）</div>";
  h += "<div id='multiProfList' style='display:flex;flex-wrap:wrap;gap:6px'>";
  for (var oi = 0; oi < options.length; oi++) {
    h += "<div data-prof='" + options[oi] + "' onclick='toggleMultiProf(this.dataset.prof," + count + ")' style='padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0'>" + options[oi] + "</div>";
  }
  h += "</div>";
  h += "<div style='margin-top:10px'>";
  h += "<button onclick='confirmMultiProf(" + count + ")' style='padding:8px 20px;background:#4a6a3a;color:#e0e0d0;border:none;border-radius:4px;cursor:pointer'>确认</button>";
  h += "</div></div>";
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._multiProfPending = {featName: featName, options: options, count: count, selected: [], onConfirm: onConfirm};
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
    alert("请选择恰好" + maxCount + "项熟练项");
    return;
  }
  closeReplaceModal();
  if (pending.onConfirm) {
    var result = [];
    for (var i = 0; i < pending.selected.length; i++) {
      var attr = pending.selected[i];
      var profKey = "";
      if (attr === "力量") profKey = "威力";
      else if (attr === "敏捷") profKey = "体操";
      else if (attr === "体质") profKey = "专注";
      else if (attr === "智力") profKey = "调查";
      else if (attr === "感知") profKey = "察觉";
      else if (attr === "魅力") profKey = "说服";
      else if (attr === "意志") profKey = "激励";
      else if (attr === "幸运") profKey = "机遇";
      result.push({attr: attr, key: profKey});
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
  html += "<button onclick='closeReplaceModal()' style='background:none;border:none;color:#888;font-size:20px;cursor:pointer'>&times;</button></div>";
  
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
        var profAttr = choices.prof.attr;
        var profKey = choices.prof.key;
        if (profAttr && profKey) {
          if (!state.profs) state.profs = {};
          if (!state.profs[profAttr]) state.profs[profAttr] = {};
          state.profs[profAttr][profKey] = Math.max(0, (state.profs[profAttr][profKey] || 0) + mult);
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
        var pa = choices.prof.attr, pk = choices.prof.key;
        if (pa && pk) {
          if (!state.profs) state.profs = {};
          if (!state.profs[pa]) state.profs[pa] = {};
          state.profs[pa][pk] = Math.max(0, (state.profs[pa][pk] || 0) + mult);
        }
      }
      // Skill slot
      if (eff.skill_slot) {
        // Track in state for display (currently just display-only)
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
      // 技巧专家等: 熟练项选择
      var profCount = eff.proficiency_count || 1;
      if (choices.profs && Array.isArray(choices.profs)) {
        for (var pi = 0; pi < choices.profs.length; pi++) {
          var pc = choices.profs[pi];
          if (pc.attr && pc.key) {
            if (!state.profs) state.profs = {};
            if (!state.profs[pc.attr]) state.profs[pc.attr] = {};
            state.profs[pc.attr][pc.key] = Math.max(0, (state.profs[pc.attr][pc.key] || 0) + mult);
          }
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
      var lv = state.mainClassLevel || 1;
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
      var lv = state.mainClassLevel || 1;
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
  var h = '<div style="padding:16px;background:#2d2722;border-radius:8px;color:#f0e0d0">';
  h += '<div style="font-size:16px;font-weight:bold;margin-bottom:12px;color:#e8a86a">选择熟练项</div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
  for (var oi = 0; oi < options.length; oi++) {
    var opt = options[oi];
    h += '<div data-fn="' + featName + '" data-opt="' + opt + '" onclick="selectFeatProf(this.dataset.fn,this.dataset.opt)" style="padding:8px 16px;background:#3d3020;border:1px solid #5a4a30;border-radius:4px;cursor:pointer;font-size:14px;color:#f0e0d0">' + opt + '</div>';
  }
  h += '</div></div>';
  showSkillPreview(featName, "特殊专长", "", h, function(){});
  window._featPendingChoice = {name: featName, onConfirm: onConfirm};
}

function selectFeatProf(featName, profAttr) {
  var pending = window._featPendingChoice;
  if (!pending) return;
  // Map attr to a default prof key
  var profKey = "";
  if (profAttr === "力量") profKey = "威力";
  else if (profAttr === "敏捷") profKey = "体操";
  else if (profAttr === "体质") profKey = "专注";
  else if (profAttr === "智力") profKey = "调查";
  else if (profAttr === "感知") profKey = "察觉";
  else if (profAttr === "魅力") profKey = "说服";
  else if (profAttr === "意志") profKey = "激励";
  else if (profAttr === "幸运") profKey = "机遇";
  
  if (pending.onConfirm) {
    pending.onConfirm({attr: profAttr, key: profKey});
  }
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
    alert("请选择恰好" + maxCount + "项属性");
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
        var attrNames = ["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
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
        var attrNames = ["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
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
        var attrNames = ["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
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
        // 技巧专家等: show prof choice dialog
        var profCount = eff.proficiency_count || 1;
        var profOptions = eff.proficiency_options || [];
        if (profOptions.length === 0) {
          profOptions = ["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
        }
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

    }
    if (needsChoice) return;
  }
  
  // Store as object with name, level, and choices
  var lv = window._pendingLevelUp ? window._pendingLevelUp.level : 0;
  var entry = {name: name, level: lv};
  if (choices) entry.choices = choices;
  
  arr.push(entry);
  state.special_feats = arr;
  
  // Apply effects
  applyFeatEffects(name, entry, true);
  
  var pu = window._pendingLevelUp;
  closeReplaceModal();
  if (pu) { pu._done._feat=true; applyLevelUp(pu.clsIdx); }
  render();
}


function getSkillStyle(name, src) {
  var d = SKILL_DATA[src]; if (!d) return "";
  for (var i = 0; i < d.length; i++) { if (d[i].name === name) return canonicalSkillStyle(d[i].style || ""); }
  return "";
}


function getKeyAttr(cls){if(!cls||!cls.name)return"魅力";if(cls.keyAttr)return cls.keyAttr;var ref=REF_CLASSES[cls.name];if(ref&&ref.key_attr){var ka=ref.key_attr;if(ka.indexOf("或")>=0)return ka.split("或")[0].trim();return ka.trim();}return"魅力";}

function isSlotLocked(slot){
  if(!state.containerItems)return false;
  if(slot==="背包")return !state.containerItems["背包"];
  if(slot==="旅行腰包")return !state.containerItems["旅行腰包"];
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
function render(){ applyChoiceLLevel12Boosts();
  ensureBlueprintState();
  if(!state.containerItems)state.containerItems={"背包":"","旅行腰包":"","材料包A":"","材料包B":""};
  if(state.equipment["背包"]&&state.equipment["背包"].length>0&&!state.containerItems["背包"])state.containerItems["背包"]="auto";
  if(state.equipment["旅行腰包"]&&state.equipment["旅行腰包"].length>0&&!state.containerItems["旅行腰包"])state.containerItems["旅行腰包"]="auto";
  if(state.equipment["材料包"]){
    var _m=state.equipment["材料包"];
    for(var _mi=0;_mi<_m.length;_mi++){if(_m[_mi]&&_m[_mi].type&&!state.containerItems["材料包"+(_mi===0?"A":"B")])state.containerItems["材料包"+(_mi===0?"A":"B")]=_m[_mi].type;}
  }
 applyChoiceBLevel10Boosts(); applyChoiceBLevel10Boosts();


  autoCalcStyles();autoCalcTalentTree();





    // === 1. Portrait + Info ===

  var profileEl=document.getElementById("info-grid");profileEl.innerHTML="";
  var profileOuter=document.createElement("div");profileOuter.style.cssText="display:flex;gap:20px;align-items:stretch";

  // Portrait area
  var portraitDiv=document.createElement("div");portraitDiv.style.cssText="flex:none;width:260px;height:260px;display:flex;align-items:center;justify-content:center;background:var(--bg);border:2px solid var(--line);border-radius:10px;cursor:pointer;overflow:hidden";
  portraitDiv.title="\u70b9\u51fb\u4e0a\u4f20\u7acb\u7ed8";
  if(state.portrait){
    portraitDiv.innerHTML="<img src=\""+state.portrait+"\" style=\"width:100%;height:100%;object-fit:contain;border-radius:8px\">";
  }else{
    portraitDiv.innerHTML="<div style=\"text-align:center;color:#69706b;padding:12px\"><div style=\"font-size:32px;margin-bottom:6px\">+</div><div style=\"font-size:13px\">\u70b9\u51fb\u4e0a\u4f20\u7acb\u7ed8</div></div>";
  }
  portraitDiv.onclick=function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=function(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){state.portrait=ev.target.result;render();};reader.readAsDataURL(file);};inp.click();};
  profileOuter.appendChild(portraitDiv);

  // Info columns
  var infoCols=document.createElement("div");infoCols.style.cssText="flex:2;display:flex;gap:6px";
  var infoLeft=document.createElement("div");infoLeft.style.cssText="flex:1;display:flex;flex-direction:column;gap:5px";
  var infoRight=document.createElement("div");infoRight.style.cssText="flex:1;display:flex;flex-direction:column;gap:5px";

  var infoData=[{f:"\u73a9\u5bb6",v:state.player},{f:"\u89d2\u8272",v:state.name},{f:"\u79cd\u65cf",v:state.race},{f:"\u6027\u522b",v:state.gender},{f:"\u5e74\u9f84",v:state.age},{f:"\u8eab\u9ad8",v:state.height},{f:"\u4f53\u91cd",v:state.weight},{f:"\u77b3\u8272",v:state.eye},{f:"\u80a4\u8272",v:state.skin},{f:"\u53d1\u8272",v:state.hair}];
  var colMap=[0,1,2,3,4];
  for(var ii=0;ii<infoData.length;ii++){
    var d=infoData[ii];
    var col=ii<5?infoLeft:infoRight;
    var item=document.createElement("div");item.style.cssText="display:flex;justify-content:space-between;align-items:center;padding:10px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--line);min-height:48px";
    item.innerHTML="<span style=\"font-size:14px;color:#69706b\">"+d.f+"</span><span style=\"font-size:16px;color:#1f2522;font-weight:bold\">"+d.v+"</span>";
    col.appendChild(item);
  }
  infoCols.appendChild(infoLeft);infoCols.appendChild(infoRight);
  profileOuter.appendChild(infoCols);
  profileEl.appendChild(profileOuter);

// === 2. Class Row ===


  var cr=document.getElementById("class-row");var ch="";


  for(var ci=0;ci<3;ci++){var cl=state.classes[ci]||{name:"",level:0,styles:["","","",""]};


    if(!cl.name&&!cl.level){


      if(ci===2){


        ch+='<div class="class-box" style="display:flex;gap:14px;padding:14px 18px">';


        ch+='<div class="class-left" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1"><div style="font-size:18px;color:#a08050;text-align:center"><div style="font-weight:bold;font-size:20px">附赠职业</div><div style="font-size:14px;margin-top:2px">未解锁</div></div></div>';


        ch+='<div class="class-right" style="display:flex;flex-direction:column;gap:4px;flex:1;max-width:160px;margin-left:auto">';


        for(var si=0;si<4;si++){ch+='<div class="style-item-empty" style="padding:3px 8px;background:transparent;border-radius:4px;border:1px dashed #d8d2c4;font-size:12px;color:#69706b;font-style:italic;text-align:center">空风格</div>';}


        ch+='</div></div>';


      }else{


        var _mc=state.classes[0];var _ml=_mc.level||0;if(_ml>=7){ch+='<div class="class-box" style="justify-content:center;align-items:center;cursor:pointer;background:#e8f5e9;border:2px dashed #4caf50" onclick="showSubclassModal()"><div style="color:#2e7d32;font-size:16px;font-weight:bold;padding:8px;text-align:center">📋 选择子职业</div></div>';}else{ch+='<div class="class-box" style="justify-content:center;align-items:center;background:#f5f5f0"><div style="color:#a08050;font-size:14px;padding:8px;text-align:center">🔒 未解锁<div style="font-size:12px;color:#b09070">（需主职业7级）</div></div></div>';}


      }


    continue;}


    ch+='<div class="class-box" style="display:flex;gap:14px;padding:14px 18px">';


    ch+='<div class="class-left" style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1"><div class="class-name">'+cl.name+'</div><div class="class-level">Lv.'+cl.level+'</div></div>';


    ch+='<div class="class-right" style="display:flex;flex-direction:column;gap:4px;flex:1;max-width:160px;margin-left:auto">';


    for(var si=0;si<4;si++){


      if(cl.styles[si]){var sc=STYLE_COLORS[cl.styles[si]]||'';var sb=sc?'background:'+sc+';':'background:var(--bg);';ch+='<div class="style-item" style="padding:3px 8px;border-radius:4px;border:1px solid var(--line);font-size:14px;color:var(--ink);text-align:center;'+sb+'">'+cl.styles[si]+'</div>';}


      else{ch+='<div class="style-item-empty" style="padding:3px 8px;background:transparent;border-radius:4px;border:1px dashed #d8d2c4;font-size:12px;color:#69706b;font-style:italic;text-align:center">空风格</div>';}


    }


    ch+='</div></div>';}


  cr.innerHTML=ch;





  // === 3. Story Block ===


  var storyHtml='<div class="misc-item"><div class="m-title">背景故事</div><div>'+state.story+'</div></div><div class="misc-item"><div class="m-title">个性</div><div>'+state.personality+'</div></div><div class="misc-item"><div class="m-title">特性</div><div>'+state.traits+'</div></div><div class="misc-item"><div class="m-title">理念</div><div>'+state.ideals+'</div></div><div class="misc-item"><div class="m-title">羁绊</div><div>'+state.bonds+'</div></div><div class="misc-item"><div class="m-title">缺陷</div><div>'+state.flaws+'</div></div>';
if(state.deity)storyHtml+='<div class="misc-item"><div class="m-title">神祇</div><div>'+state.deity+'</div></div>';
if(state.contacts)storyHtml+='<div class="misc-item"><div class="m-title">联系渠道</div><div>'+state.contacts+'</div></div>';
if(state.scamType)storyHtml+='<div class="misc-item"><div class="m-title">偏好骗局</div><div>'+state.scamType+'</div></div>';
if(state.missionChannel)storyHtml+='<div class="misc-item"><div class="m-title">任务渠道</div><div>'+state.missionChannel+'</div></div>';
if(state.academicDomain)storyHtml+='<div class="misc-item"><div class="m-title">学术领域</div><div>'+state.academicDomain+'</div></div>';


  document.getElementById("story-title").innerHTML="个性背景：\u0020"+(state.background||"未选择");


  document.getElementById("story-block").innerHTML=storyHtml;





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
    xpHTML+='<div style="font-size:14px;color:#69706b;font-weight:bold">'+cl.name+'</div>';
    xpHTML+='<div style="font-size:36px;color:#1f2522;font-weight:bold">Lv.'+cl.level+'</div>';
    xpHTML+='<div style="font-size:14px;color:#69706b">经验值: '+state.xp+'</div>';
      var curAttrCap=getCurrentAttrCap?getCurrentAttrCap():18;
      var curProfCap=getCurrentProfCap?getCurrentProfCap():2;
      xpHTML+='<div style="font-size:12px;color:#8a7a6a">属性上限: '+curAttrCap+' | 熟练度上限: '+curProfCap+'</div>';
    if(needXP>0){
      xpHTML+='<div style="font-size:12px;color:#8a7a6a">升级需要: '+needXP+' 经验</div>';
      var subCapMsg="";
      if(ci===1){
        var maxSub=getMaxSubLevel();
        var nextSub=cl.level+1;
        if(nextSub>maxSub)subCapMsg=" (主职业等级不足)";
      }
      xpHTML+='<button onclick="showLevelUpModal('+ci+')" style="padding:6px 14px;font-size:13px;background:'+((canUp&&!subCapMsg)?'#c9753e':'#6a5a4a')+';color:#fff;border:none;border-radius:5px;cursor:'+((canUp&&!subCapMsg)?'pointer':'not-allowed')+';'+((canUp&&!subCapMsg)?'':'opacity:0.6')+'">'+(canUp?(subCapMsg||'升级！'):'经验不足')+'</button>';
    }else{
      xpHTML+='<div style="font-size:12px;color:#8a7a6a;font-weight:bold">已达最高等级</div>';
    }
    xpHTML+='</div>';}
  xpHTML+='</div>';
  xpEl.innerHTML=xpHTML;


  // === 4b. Skill Points ===


  ensureSpState();
  document.getElementById("sp-bar").innerHTML = renderMarkOverviewHtml();





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


  // Key attribute (left, 2 rows tall)


  var keyAttr=getKeyAttr(state.classes[0]);var keyMod=calcMod(state.attrs[keyAttr]||10);


  var battleHtml="<div class='battle-layout'><div class='battle-key'>";


  battleHtml+="<div class='stat-item key-attr'><span class='stat-label'>关键属性</span><span class='stat-value'>"+keyAttr+" ("+mStr(keyMod)+")</span></div>";


  battleHtml+="</div><div class='battle-grid'>";


  // Right side: 2x5 grid


  var row1=[{l:"生命值",v:state.hp},{l:"疲劳值",v:state.fp},{l:"防御等级",v:ac},{l:"先攻值",v:"D20"+mStr(calcMod(dex))},{l:"速度",v:speed}];


  var strMod=calcMod(state.attrs["力量"]||10);var dexMod=calcMod(dex);var _keyAttr=REF_CLASSES[mc]?REF_CLASSES[mc].key_attr:"魅力";if(_keyAttr==="力量或敏捷")_keyAttr=state.classes[0].keyAttr||"力量";var _keyVal=state.attrs[_keyAttr]||10;var spellMod=calcMod(_keyVal);


  var atkMod=Math.max(strMod,dexMod);


  var row2=[{l:"生命回复",v:Math.floor(state.hp/2)},{l:"疲劳回复",v:Math.floor(state.fp/2)},{l:"警惕值",v:10+calcMod(wis)},{l:"攻击命中",v:mStr(atkMod)},{l:"法术命中",v:mStr(spellMod)}];


  for(var ri=0;ri<2;ri++){


    var row=(ri===0)?row1:row2;


    for(var ci=0;ci<row.length;ci++){


      battleHtml+="<div class='stat-item'><span class='stat-label'>"+row[ci].l+"</span><span class='stat-value'>"+row[ci].v+"</span></div>";}


  }


  battleHtml+="</div></div>";


  document.getElementById("stat-row").innerHTML=battleHtml;// === 6. Attribute Grid (2 per row, 2-column profs) ===


  var g=document.getElementById("attr-grid");var ak=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];var ah="";
  var _profDefs={力量:["豁免","威力","承重","运动-跳跃","运动-攀爬","运动-游泳","运动-自定义"],敏捷:["豁免","体操","骑乘","隐匿","巧手-偷窃","巧手-开锁","巧手-拆除","巧手-自定义"],体质:["豁免","专注","耐力"],智力:["豁免","宗教","调查","估价","伪造","读唇","逻辑","奥秘-魔法学识","奥秘-炼金术","奥秘-神奇道具","奥秘-多元宇宙","知识-历史","知识-地理","知识-人文","知识-政治","知识-神秘学","知识-工程学","知识-珠宝学","知识-草药学","知识-医药","知识-烹饪","知识-自定义"],感知:["豁免","洞悉","导航","自然","驯兽","感悟","聆听","察觉","警惕值"],魅力:["豁免","欺瞒","恐吓","说服","表演-歌唱","表演-舞蹈","表演-自定义"],意志:["豁免","求生","激励","决策"],幸运:["豁免","机遇","探索"]};
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
      var typeMap={"attribute":"属性","multi":"复合","proficiency":"熟练度","professional":"专业","attribute_health":"属性+生命","health_growth":"生命成长","attribute_proficiency":"属性+熟练","attribute_boost":"属性强化","sp_pack":"技能点","xp_pack":"经验值","armor_ac":"防御","heavy_armor":"重甲防御","extra_slot":"额外槽位","professional_sp":"专业+技能点"};
      typeLabel=typeMap[sfType]||sfType;
    }
    fh+='<div class="feat-chip" style="border-left:4px solid #a46d1f;margin-bottom:4px">';
    fh+='<div style="display:flex;align-items:center;gap:6px">';
    if(sfLevel){fh+='<span class="feat-lv">'+sfLevel+'\u7ea7</span>';}
    fh+='<span style="font-weight:bold;color:#1f2522">'+sfName+'</span>';
    if(typeLabel){fh+='<span style="font-size:11px;background:#a46d1f;color:#fff;padding:1px 6px;border-radius:3px">'+typeLabel+'</span>';}
    fh+='<button onclick="showSpecialFeatDetail(\''+sfName.replace(/'/g,"\\'")+'\')" style="margin-left:auto;padding:1px 8px;font-size:11px;background:#3a5a7a;color:#ddd;border:none;border-radius:4px;cursor:pointer">\ud83d\udcd6 \u8be6\u60c5</button>';
    fh+='<button onclick="removeSpecialFeat(\''+sfName.replace(/'/g,"\\'")+'\')" style="margin-left:4px;background:none;border:none;color:#c06040;cursor:pointer;font-size:14px" title="\u79fb\u9664">\u2715</button>';
    fh+='</div>';
    fh+='</div>';
    hf=true;
  }


  document.getElementById("feat-list").innerHTML=hf?fh:'<span style="color:#a08050;font-size:15px">暂无</span>';

  // Add special feat toggle button
  var featSection=document.getElementById("feat-list").parentNode;






  // === 8. Currency ===


  var curh="";var ck=Object.keys(state.currency);for(var ci=0;ci<ck.length;ci++){curh+='<div class="currency-item"><span>'+ck[ci]+'</span><span style="font-weight:bold;color:#e8c890;font-size:18px">'+state.currency[ck[ci]]+'</span></div>';}


  document.getElementById("currency-row").innerHTML=curh;





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


  document.getElementById("weight-block").innerHTML="<span>常规负重: "+wtReg+"kg</span><span>满载负重: "+wtFull+"kg</span><span>极限负重: "+wtMax+"kg</span><span class='weight-current'>当前负重: "+totalWeight+"kg</span>";








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


  // Render 5 rows of slots


  for(var ri=0;ri<5;ri++){


    th+="<div class='talent-row'>";


    for(var ci=0;ci<tiers.length;ci++){


      var col=colData[tiers[ci]];


      if(ri<col.length){var _bd="";if(col[ri].pref){var _ph={"\u6a59\u8272":"#EE822F","\u767d\u8272":"#FFFFFF","\u7d2b\u8272":"#B94BFF","\u9ec4\u8272":"#FFF32F","\u65e0\u8272":"#D9D9D9","\u84dd\u8272":"#00B0F0","\u9752\u8272":"#00FA99","\u9ed1\u8272":"#595959","\u7ea2\u8272":"#FF0000","\u68d5\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u7eff\u8272":"#00B050","\u6d45\u8272":"#B3F9FF"}[col[ri].pref]||"#888";var _pl=["\u767d\u8272","\u9ec4\u8272","\u6d45\u8272","\u9752\u8272","\u65e0\u8272","\u7c89\u8272"].indexOf(col[ri].pref)>=0;_bd=" <span style=font-size:10px;background:"+_ph+";color:"+(_pl?"#1f2522":"#fff")+";padding:1px 4px;border-radius:3px>"+col[ri].pref+"</span>";}th+="<div class='"+"talent-item'>"+col[ri].n+_bd+"</div>";}


      else{th+="<div class='talent-slot-empty'>空</div>";}


    }


    th+="</div>";}


  if(!th)th="<span style='color:#a08050;font-size:18px'>暂无</span>";


  document.getElementById("talent-grid").innerHTML=th;


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


      for (var pi = 0; pi < 2; pi++) {


        var packSlot = bagData[pi] || {};


        var packType = packSlot.type || "";


        var packItems = packSlot.items || [];


        var hasPack = packType.length > 0;


        var mpLocked=!state.containerItems||!state.containerItems["材料包"+(pi===0?"A":"B")];var title = hasPack ? (packType + " (10栏)") : ("材料包" + (pi===0?"A":"B") + " (10栏)"+(mpLocked?" [未装备]":""));


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


  document.addEventListener("mousemove", gd_mousemove);
  document.addEventListener("mouseup", gd_mouseup);
  ;

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





  // === 14. Languages ===


  var lh="";for(var li=0;li<state.languages.length;li++){lh+='<span class="lang-tag">『'+state.languages[li]+'』</span>';}


  document.getElementById("lang-list").innerHTML=lh;





  // === 15. Professionals ===


  var ph2="";for(var pi=0;pi<state.professionals.length;pi++){ph2+='<span class="prof-tag">'+state.professionals[pi]+'</span>';}


  document.getElementById("prof-list").innerHTML=ph2;

  // Weapon proficiency section
  var mainClass=(state.classes&&state.classes[0])?state.classes[0].name:"";
  var wp=resolveWeaponProfs(mainClass);
  var wh="";
  for(var wi=0;wi<wp.length;wi++){wh+='<span class="weapon-tag">'+wp[wi]+'</span>';}
  if(state.weapon_specs&&state.weapon_specs.length){
    wh+='<span style="font-size:13px;color:var(--muted);margin:0 6px">|</span>';
    for(var wsi=0;wsi<state.weapon_specs.length;wsi++){
      var cat=state.weapon_specs[wsi];
      var bonus=WEAPON_SPEC_BONUSES[cat]||"";
      wh+='<span class="weapon-spec-tag">⭐'+cat+(bonus?'（'+bonus+'）':'')+'</span>';
    }
  }
  var we=document.getElementById("weapon-profs");if(we)we.innerHTML=wh;





  // === 16. Skill Tables ===


  var mainSkills=state.skills.filter(function(s){return (!s.sub||s.sub==="")&&!isBlueprintName(s.n||s.name);});


  


  var subSkills=state.skills.filter(function(s){return s.sub&&s.sub!==""&&!isBlueprintName(s.n||s.name);});


  var skillHtml="";var mainSlots=calcSkillSlots(0);for(var ski=0;ski<mainSlots;ski++){var s=mainSkills[ski]||null;


    if(s){var sStyle=getSkillStyle(s.n,s.src);var src=sStyle?' <span class="skill-sub">('+sStyle+')</span>':"";var stm=getSkillField(s.n,s.src,"施展时间");var sds=getSkillField(s.n,s.src,"description");var sdr=getSkillField(s.n,s.src,"疲劳消耗");var srange=getSkillField(s.n,s.src,"施展距离");var sdur=getSkillField(s.n,s.src,"持续时间");skillHtml+='<tr><td><span class="skill-name">'+s.n+'</span>'+src+'</td><td>'+(stm||'—')+'</td><td>'+skillDescCell(sds,state.classes[0].name,s.n)+'</td><td>'+(sdr?sdr:'—')+'</td><td>'+(srange||'—')+'</td><td>'+(sdur||'—')+'</td></tr>';}


    else{skillHtml+='<tr class="empty-slot"><td><span style="color:#906840;font-style:italic">空栏位</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';}}


  document.getElementById("skill-table-body").innerHTML=skillHtml;
  document.getElementById("mainSkillTitle").innerHTML="主职业技能列表 ("+calcSkillSlots(0)+"栏)";


   


  var subSkillHtml="";var subSlots=calcSkillSlots(1);for(var sski=0;sski<subSlots;sski++){var ss=subSkills[sski]||null;


    if(ss){var sStyle=getSkillStyle(ss.n,ss.src);var src=sStyle?' <span class="skill-sub">('+sStyle+')</span>':"";var sstm=getSkillField(ss.n,ss.src,"施展时间");var ssds=getSkillField(ss.n,ss.src,"description");var ssdr=getSkillField(ss.n,ss.src,"疲劳消耗");var ssrange=getSkillField(ss.n,ss.src,"施展距离");var ssdur=getSkillField(ss.n,ss.src,"持续时间");subSkillHtml+='<tr><td><span class="skill-name">'+ss.n+'</span>'+src+'</td><td>'+(sstm||'—')+'</td><td>'+skillDescCell(ssds,ss.sub,ss.n)+'</td><td>'+(ssdr?ssdr:'—')+'</td><td>'+(ssrange||'—')+'</td><td>'+(ssdur||'—')+'</td></tr>';}


    else{subSkillHtml+='<tr class="empty-slot"><td><span style="color:#906840;font-style:italic">\u7a7a\u680f\u4f4d</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';}}


document.getElementById("sub-skill-table-body").innerHTML=subSkillHtml;
  document.getElementById("subSkillTitle").innerHTML="子职业技能列表 ("+calcSkillSlots(1)+"栏)";

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
  if (!res.ok) { alert(res.reason || "添加失败"); return; }
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
  if (isNaN(n)) { alert("请输入数字"); return; }
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

function learnSkill(clsName, skillName, clsIdx) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var isSub = (clsIdx === 1);


  var desc = (skillData.description || []).join(" ");


  var isLocked = desc.indexOf("\u65e0\u6cd5") >= 0 && (desc.indexOf("\u4fee\u6539") >= 0 || desc.indexOf("\u8986\u76d6") >= 0 || desc.indexOf("\u66ff\u6362") >= 0);


  // Handle composite skills: grants sub-skills directly to skill list


  if (skillData.type === "composite") {


    var grants = skillData.grants || [];


    var skillList = state.skills;


    var isSub = (clsIdx === 1);


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


      var skillSlots = calcSkillSlots(clsIdx);


      var currentInSlot = 0;


      for (var sj = 0; sj < skillList.length; sj++) {


        if ((isSub && skillList[sj].sub) || (!isSub && !skillList[sj].sub)) currentInSlot++; }


      if (currentInSlot >= skillSlots) { alert("\u6280\u80fd\u680f\u4f4d\u4e0d\u8db3\uff0c\u65e0\u6cd5\u83b7\u5f97" + grants[gi]); continue; }


      // Add the granted skill


      skillList.push({id: gData.id, n: gData.name, src: gData.style || clsName,


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
    _bpRes = addBlueprintEntry({ id: skillData.id, n: skillData.name, src: skillData.style || clsName, tier: skillData.tier || "", note: "" });
    if (!_bpRes.ok) {
      refundSkillPoint(skillData);
      alert(_bpRes.reason || "无法学习图纸");
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


    var countInTier=0;for(var ti=0;ti<tl.length;ti++){var _st=tier.replace("\u5929\u8d4b\u6811","");if(tl[ti].tier===_st)countInTier++;}


    if(countInTier>=5){alert(_st+"\u5929\u8d4b\u680f\u5df2\u6ee1\uff08\u6700\u591a5\u4e2a\uff09");return;}


    // Check duplicate talent


    var dupFound = false; var crossLocked = false;


    for (var ti = 0; ti < tl.length; ti++) { if (tl[ti].n === skillData.name && (!tl[ti].cls || tl[ti].cls === clsName)) { dupFound = true; break; } if (tl[ti].n === skillData.name && tl[ti].cls && tl[ti].cls !== clsName) { crossLocked = true; } }


    if (dupFound) { alert("\u8be5\u5929\u8d4b\u6280\u80fd\u5df2\u5b66\u4e60\uff0c\u65e0\u6cd5\u91cd\u590d\u5b66\u4e60"); return; } if (crossLocked) { alert("\u8be5\u6280\u80fd\u5df2\u88ab\u5176\u4ed6\u804c\u4e1a\u7684\u540c\u540d\u5929\u8d4b\u9501\u5b9a"); return; }


    if (!payForSkill(skillData)) return;


    tl.push({id:skillData.id,n:skillData.name,cls:clsName,tier:tier.replace("天赋树",""),sub:isSub,locked:isLocked});


    state.talent_tree=tl; applyChoiceBProfBonus(skillName,true); applyChoiceLMasteryBonus(skillName,true); applyMeditationSP(skillName,true);


  } else {


    var maxSlots = isSub ? 8 : 17; var skillList = state.skills.slice(); var clsSkills = [];





    for (var si = 0; si < skillList.length; si++) { if (isSub && skillList[si].sub) clsSkills.push(skillList[si]); else if (!isSub && !skillList[si].sub) clsSkills.push(skillList[si]); }


    var crossLocked = false; for (var si = 0; si < skillList.length; si++) { if (skillList[si].n === skillName && skillList[si].src === clsName) { alert("\u5df2\u5b66\u4e60\u8be5\u6280\u80fd"); return; } if (skillList[si].n === skillName && skillList[si].src !== clsName) { crossLocked = true; } } if (crossLocked) { alert("\u8be5\u6280\u80fd\u5df2\u88ab\u5176\u4ed6\u804c\u4e1a\u7684\u540c\u540d\u6280\u80fd\u9501\u5b9a"); return; }


    if (clsSkills.length >= maxSlots) {


      var allLocked = true; for (var si = 0; si < clsSkills.length; si++) { if (!clsSkills[si].locked) { allLocked = false; break; } }


      if (allLocked) { alert("\u6240\u6709\u6280\u80fd\u5747\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u66ff\u6362"); return; }


      var msg = "\u6280\u80fd\u5217\u8868\u5df2\u6ee1\uff01\u8bf7\u9009\u62e9\u8981\u66ff\u6362\u7684\u6280\u80fd\u7f16\u53f7 (1-" + maxSlots + "):\\n";


      for (var si = 0; si < clsSkills.length; si++) { msg += (si+1) + ". " + clsSkills[si].n + (clsSkills[si].locked ? " [\u9501\u5b9a]" : "") + "\\n"; }


      showReplaceModal(skillData.name, clsSkills, skillList, maxSlots, {skillData: skillData, clsName: clsName, isSub: isSub, isLocked: isLocked}); return; }


    if (!payForSkill(skillData)) return;


    skillList.push(buildSkillListEntry(skillData, clsName, isSub, isLocked));


    state.skills = skillList; }


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
  if (!info) { alert("该阶位不需要解锁"); return; }
  var cost = info.cost;
  var minLevel = info.minLevel || 99;
  var maxLv = getMaxLevel();
  if (maxLv < minLevel) { alert("当前最高职业等级为" + maxLv + "级，需要主职业达到" + minLevel + "级才能解锁" + tierName + "天赋树"); return; }
  if (cost > state.xp) { alert("经验值不足，需要" + cost + "点经验值（当前拥有" + state.xp + "点）"); return; }
  if (!confirm("确定要花费" + cost + "点经验值解锁" + tierName + "天赋树吗？当前经验值：" + state.xp + "点")) return;
  state.xp -= cost;
  if (!state.unlocked_tiers) state.unlocked_tiers = ["一阶","二阶"];
  if (state.unlocked_tiers.indexOf(tierName) < 0) state.unlocked_tiers.push(tierName);
  renderLearnPanel();
  render();
  alert("解锁成功！已解锁" + tierName + "天赋树");
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


  if (skillList[idx].locked) { alert("\u8be5\u6280\u80fd\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u53d6\u6d88\u5b66\u4e60"); return; }


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


  if (tt[idx].locked) { alert("\u8be5\u5929\u8d4b\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u53d6\u6d88\u5b66\u4e60"); return; }


  // Return SP


  var clsData = SKILL_DATA[clsName]; 


  if (clsData) {


    var sd = null; for (var si = 0; si < clsData.length; si++) { if (clsData[si].name === skillName) { sd = clsData[si]; break; } }


    if (sd) {


      refundSkillPoint(sd);


    }


  }


  tt.splice(idx, 1);


  state.talent_tree = tt; applyChoiceBProfBonus(skillName,false); applyChoiceLMasteryBonus(skillName,false); applyMeditationSP(skillName,false);


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


  if (clsSkills[idx].locked) { alert("\u8be5\u6280\u80fd\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u66ff\u6362"); return; }


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





function showSkillDetailFromAll(skillName) {


  // Search all SKILL_DATA for a skill by name


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
  if(!data){alert("已达最高等级");return;}
  if(clsIdx===1){
    var maxSub=getMaxSubLevel();
    if(nextLv>maxSub){alert("子职业等级不可超过主职业等级-5，请先提升主职业等级");return;}
  }
  if(state.xp<data.xp){alert("经验值不足");return;}

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
    if(nextLv>maxSub){alert("子职业等级不可超过主职业等级-5，请先提升主职业等级");closeReplaceModal();return;}
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
  window._pendingLevelUp = null;
  applyChoiceLLevel12Boosts();applyChoiceBLevel10Boosts();autoCalcStyles();autoCalcTalentTree();render();renderLearnPanel();
}

function showProfChoice(clsIdx,level){
  if(!state.profs) state.profs = {};  // Guard for uninitialized state
  var overlay=document.getElementById("modalOverlay")||document.createElement("div");
  if(!overlay.parentNode){overlay.id="modalOverlay";overlay.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";document.body.appendChild(overlay);}

  // Collect all available profs from state
  var allProfs=[];
  var attrNames=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
  for(var ai=0;ai<attrNames.length;ai++){
    var attr=attrNames[ai];
    var profObj=state.profs[attr];
    if(!profObj)continue;
    for(var key in profObj){
      if(key!=="豁免"&&allProfs.indexOf(key)<0)allProfs.push(key);
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

  var curCap=getCurrentProfCap();
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
  // Safety check: verify prof has not reached cap
  var curCap=getCurrentProfCap();
  // Find which attr this prof belongs to and check its value
  var attrNames=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
  for(var ai=0;ai<attrNames.length;ai++){
    var attr=attrNames[ai];
    var profObj=state.profs[attr];
    if(profObj && profObj.hasOwnProperty(profName)){
      var cur=typeof profObj[profName]==="number"?profObj[profName]:0;
      if(cur>=curCap){alert("该熟练度已达当前等级上限（"+curCap+"），无法继续提升");return;}
      profObj[profName]=cur+1;
      window._pendingLevelUp._done._prof=true;
      closeReplaceModal();
      applyLevelUp(clsIdx);
      return;
    }
  }
  // If not found in any attr, add to 通用 as a new entry
  if(!state.profs["通用"])state.profs["通用"]={};
  state.profs["通用"][profName]=1;
  window._pendingLevelUp._done._prof=true;
  closeReplaceModal();
  applyLevelUp(clsIdx);
}

function showAttrChoice(clsIdx,level){
  var overlay=document.getElementById("modalOverlay")||document.createElement("div");
  if(!overlay.parentNode){overlay.id="modalOverlay";overlay.style.cssText="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";document.body.appendChild(overlay);}

  var curCap=getCurrentAttrCap();
  var attrNames=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
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
  var curCap=getCurrentAttrCap();
  var curVal=state.attrs[attrName]||0;
  if(curVal>=curCap){alert("该属性已达当前等级上限（"+curCap+"），无法继续提升");return;}
  state.attrs[attrName]=curVal+1;
  window._pendingLevelUp._done._attr=true;
  closeReplaceModal();
  applyLevelUp(clsIdx);
}

function applyLowestAttr(clsIdx,level){
  var attrNames=["力量","敏捷","体质","智力","感知","魅力","意志","幸运"];
  var lowest=attrNames[0];var minVal=state.attrs[lowest]||0;
  for(var ai=1;ai<attrNames.length;ai++){
    var v=state.attrs[attrNames[ai]]||0;
    if(v<minVal){minVal=v;lowest=attrNames[ai];}
  }
  state.attrs[lowest]=(state.attrs[lowest]||0)+2;
  finalizeLevelUp(clsIdx,level);
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

function _getProfByName(profs, name, preferAttrs) {
  if (!profs) return 0;
  if (preferAttrs) {
    for (var i = 0; i < preferAttrs.length; i++) {
      var a = preferAttrs[i];
      if (profs[a] && profs[a][name]) return profs[a][name];
    }
  }
  for (var pa in profs) {
    if (profs[pa][name]) return profs[pa][name];
  }
  return 0;
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
          var en = req.profNames[ei];
          if (profs[attr] && profs[attr][en]) exclude[en] = true;
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
if (!initFromURL()) {
  render();
}

// Add save button to the page
(function() {
  var saveBtn = document.createElement("button");
  saveBtn.textContent = "保存";
  saveBtn.style.cssText = "position:fixed;top:10px;right:10px;z-index:9999;padding:10px 22px;background:#4a6a3a;color:#f0e0d0;border:1px solid #6a8a5a;border-radius:6px;cursor:pointer;font-size:15px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,0.4)";
  saveBtn.onclick = function() {
    showSaveDialog(function(slotIndex) {
      if (saveState(slotIndex)) {
        alert("已保存到存档位" + slotIndex);
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
window.showKeyPreferencePicker=function(callback){
  var overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center";
  var box=document.createElement("div");
  box.className='popup-box';box.style.cssText="background:var(--panel);border-radius:10px;padding:24px;max-width:420px;width:90%;border:2px solid var(--line);box-shadow:0 8px 32px rgba(0,0,0,0.3)";
  box.innerHTML="<h3 style=margin-bottom:4px;color:#1f2522>\u9009\u62e9\u5173\u952e\u504f\u597d\u989c\u8272</h3><p style=font-size:13px;color:#69706b;margin-bottom:16px>\u4e60\u5f97\u540e\u53ef\u5c06\u4efb\u610f\u989c\u8272\u7684\u6280\u80fd\u70b9\u89c6\u4f5c\u504f\u597d\u989c\u8272\u4f7f\u7528</p><div id=kpColorGrid style=display:grid;grid-template-columns:repeat(4,1fr);gap:8px></div><button id=kpCancelBtn style=display:block;width:100%;margin-top:14px;padding:8px;background:#d8d2c4;color:#69706b;border:none;border-radius:6px;cursor:pointer;font-size:14px>\u53d6\u6d88</button>";
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
    cell.style.cssText="cursor:pointer;padding:10px 6px;border-radius:6px;text-align:center;font-size:13px;font-weight:bold;background:"+sc[1]+";color:"+(isLight?"#1f2522":"#fff")+";border:2px solid "+(isLight?"#d8d2c4":sc[1]);
    cell.onmouseenter=function(){this.style.transform="scale(1.08)";this.style.boxShadow="0 4px 12px rgba(0,0,0,0.2)";};
    cell.onmouseleave=function(){this.style.transform="scale(1)";this.style.boxShadow="none";};
    (function(colorName){cell.onclick=function(){cleanup();callback(colorName);};})(sc[0]);
    grid.appendChild(cell);
  }
}
window.showSubclassModal=function(){
  var mc=state.classes[0]; var ml=mc.level;
  if(ml<7){alert("主职业需达到7级才能选择子职业");return;}
  var overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center";
  var box=document.createElement("div");
  box.className='popup-box';box.style.cssText="background:var(--panel);border-radius:10px;padding:24px;max-width:600px;width:95%;max-height:90vh;overflow-y:auto;border:2px solid var(--line);box-shadow:0 8px 32px rgba(0,0,0,0.3)";
  var h="<h3 style=margin-bottom:8px;color:#1f2522>选择子职业</h3>";
  h+="<p style=font-size:13px;color:#69706b;margin-bottom:16px>需满足属性值、熟练度要求，且与主职业兼容</p>";
  h+="<div style=display:flex;flex-direction:column;gap:6px>";
  var allClasses=["蛮斗士","战士","法师","猎人","牧师","圣骑士","游荡者","德鲁伊","萨满祭司","术士","武僧","吟游诗人","魔契师","奇械师"];
  for(var i=0;i<allClasses.length;i++){
    var cn=allClasses[i]; var req=REF_SUBCLASS_REQS[cn]; if(!req)continue;
    // Skip main class
    
    var check=checkSubclassReq(mc.name,cn,state.attrs,state.profs);
    var attrDetail=check.attrDetail+(check.profDetail?" | "+check.profDetail:"");
    var allOK=check.ok;
    var failReasons=check.reasons;
    var bg=allOK?"#e8f5e9":"#f5f5f0"; var border=allOK?"#4caf50":"#d8d2c4";
    h+="<div style=display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:6px;background:"+bg+";border:1px solid "+border+">";
    h+="<div><span style=font-size:15px;font-weight:bold;color:"+(allOK?"#2e7d32":"#1f2522")+">"+cn+"</span>";
    h+="<div style=font-size:11px;color:#69706b;margin-top:2px>"+attrDetail+"</div></div>";
    if(allOK){
      h+="<button class=subclassSelectBtn data-cn=\""+cn+"\" style=padding:6px 14px;background:#4caf50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold>选择</button>";
    }else{
      h+="<span style=font-size:12px;color:#c62828>"+failReasons.join("，")+"</span>";
    }
    h+="</div>";
  }
  h+="</div><button id=subclassCancelBtn style=display:block;width:100%;margin-top:14px;padding:8px;background:#d8d2c4;color:#69706b;border:none;border-radius:6px;cursor:pointer;font-size:14px>取消</button>";
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
  if(!mc||mc.level<7){alert("主职业需达到7级才能选择子职业");return;}
  var check=checkSubclassReq(mc.name,cn,state.attrs,state.profs);
  if(!check.ok){alert("不满足兼职条件："+check.reasons.join("，"));return;}
  var o=document.getElementById("subclassOverlay");if(o)o.remove();
  state.classes[1]={name:cn,level:1,keyAttr:REF_CLASSES[cn]?REF_CLASSES[cn].key_attr||"":"",styles:["","","",""]};
  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
}
})();

function exportCurrentXlsx(){
 if(!state){alert("请先导入或创建角色");return;}
 exportXlsxFromState(state).catch(function(e){
   console.error("Export error:",e);
   var msg=(e&&e.message)?e.message:"未知错误";
   alert("导出失败：" + msg);
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
  if (e < 0) { alert("导出失败：模板文件损坏，请重新上传角色文件或刷新页面后重试"); return; }
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
  if (!ss || !sh) {
    alert("导出失败：模板缺少 sharedStrings 或 sheet1，请重新上传角色 xlsx 或刷新页面后重试");
    return;
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
  function set(ref, val) {
    var cs = cStyle[ref] || "", nc, mrow, row, rowRe;
    if (typeof val === "number") nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : "") + "><v>" + val + "</v></c>";
    else { var si = addStr(String(val)); nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : '') + ' t="s"><v>' + si + "</v></c>"; }
    var rx = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    if (rx.test(xml)) xml = xml.replace(new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)', "g"), nc);
    else {
      mrow = /^([A-Z]+)(\d+)$/.exec(ref);
      if (!mrow) return;
      row = mrow[2];
      rowRe = new RegExp('(<row[^>]*\\br="' + row + '"[^>]*>)');
      if (rowRe.test(xml)) xml = xml.replace(rowRe, "$1" + nc);
      else xml = xml.replace("</sheetData>", '<row r="' + row + '">' + nc + "</row></sheetData>");
      cStyle[ref] = cs;
    }
  }

  // Fill all data from state into cells
  // Clear stale template cells first (avoids leftover content from uploaded/same-name sheets)
  clearXlsxSkillRows(set);
  clearXlsxEquipmentSlots(set);
  clearXlsxClassAndFeatureSlots(set);

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
      var _ac2=_aInfo.addDex?(_aInfo.base+_dexMod):_aInfo.base;
      if(_ac===null||_ac2>_ac)_ac=_ac2;
    }
  }
  if(_ac===null)_ac=10+_dexMod;
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
  set("L11", String(Math.max(_strMod,_dexMod)));
  set("L12", String(_spellMod));
  // Class layout
  set("B17", cl.name || "");
  if(cl.level) set("D17", cl.level);
  if(cl.styles && cl.styles[0]) set("E17", cl.styles[0]);
  if(cl.styles && cl.styles[1]) set("E18", cl.styles[1]);
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
  if (state.deity) set("H33", state.deity);
  if (state.contacts) set("H34", state.contacts);
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
    for (var ei = 0; ei < eqMap.length; ei++) {
      var slot = eqMap[ei];
      var items = state.equipment[slot.zone] || [];
      if (items.length > 0) {
        set("I" + slot.row, slot.label);  // Ensure I label is set
        for (var ii = 0; ii < items.length && slot.row + ii <= 100; ii++) {
          var itemName = items[ii];
          if (typeof itemName === 'object') itemName = itemName.item || itemName.name || '';
          if (itemName) set("K" + (slot.row + ii), String(itemName));
        }
      }
    }
  }

  // Racial traits
  var _exportRacial = exportRacialTraits(state);
  if (_exportRacial.length > 0) {
    for (var ri = 0; ri < Math.min(_exportRacial.length, 8); ri++) {
      var rt = _exportRacial[ri];
      set("I" + (112 + ri), rt.n || rt.name || rt);
      if (rt.d || rt.desc || rt.effect) set("K" + (112 + ri), rt.d || rt.desc || rt.effect || "");
    }
  }

  // Class features
  var _exportClassFeats = exportClassFeatures(state);
  if (_exportClassFeats.length > 0) {
    for (var ci = 0; ci < Math.min(_exportClassFeats.length, 8); ci++) {
      var cf = _exportClassFeats[ci];
      set("O" + (112 + ci), cf.n || cf.name || cf);
      if (cf.d || cf.desc || cf.effect) set("Q" + (112 + ci), cf.d || cf.desc || cf.effect || "");
    }
  }

  // Skills (B-M columns, rows 123-162)
  var mainSkills = (state.skills || []).filter(function (s) { return (!s.sub || s.sub === "") && !isBlueprintName(s.n || s.name); });
  var hasSkills = mainSkills.length > 0;
  // Helper: look up skill data from SKILL_DATA by name
  function lookupSkill(name) {
    if (!name || typeof SKILL_DATA === 'undefined') return null;
    for (var cn in SKILL_DATA) {
      var arr = SKILL_DATA[cn];
      if (!arr) continue;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].name === name || arr[i].n === name) return arr[i];
      }
    }
    return null;
  }
  for (var si = 0; si < mainSkills.length && 123 + si <= 162; si++) {
    var sk = mainSkills[si];
    var skName = sk.n || sk.name || "";
    var skRef = (!sk.tm && !sk.time && !sk.cost && !sk.fp) ? lookupSkill(skName) : null;
    set("B" + (123 + si), skName);
    set("D" + (123 + si), sk.tm || sk.time || (skRef && skRef.fields ? skRef.fields['施展时间'] : "") || "");
    set("E" + (123 + si), sk.range || (skRef && skRef.fields ? skRef.fields['施展距离'] : "") || "");
    set("F" + (123 + si), sk.dur || sk.duration || (skRef && skRef.fields ? skRef.fields['持续时间'] : "") || "");
    set("H" + (123 + si), sk.cost || sk.fp || (skRef && skRef.cost ? skRef.cost.fp : "") || "");
    set("I" + (123 + si), sk.src || sk.source || cl.name || "");
    set("J" + (123 + si), sk.ds || sk.desc || sk.description || (skRef && skRef.description ? skRef.description[0] : "") || "");
  }

  // Talents (O column) — grouped by tier; clear stale cells then fill
  var _talentTierMap = buildTalentTierRowMap(strings, sh.text);
  fillXlsxTalents(set, state.talent_tree || [], _talentTierMap);
  fillXlsxBlueprints(set, state.blueprints || []);

  // Subclass skills (rows 168-209)
  var subSkills = (state.skills || []).filter(function (s) { return s.sub && s.sub !== "" && !isBlueprintName(s.n || s.name); });
  for (var ssi = 0; ssi < subSkills.length && 168 + ssi <= 209; ssi++) {
    var ssk = subSkills[ssi];
    var sskName = ssk.n || ssk.name || "";
    var sskRef = (!ssk.tm && !ssk.time && !ssk.cost && !ssk.fp) ? lookupSkill(sskName) : null;
    set("B" + (168 + ssi), sskName);
    set("D" + (168 + ssi), ssk.tm || ssk.time || (sskRef && sskRef.fields ? sskRef.fields['施展时间'] : "") || "");
    set("E" + (168 + ssi), ssk.range || (sskRef && sskRef.fields ? sskRef.fields['施展距离'] : "") || "");
    set("F" + (168 + ssi), ssk.dur || ssk.duration || (sskRef && sskRef.fields ? sskRef.fields['持续时间'] : "") || "");
    set("H" + (168 + ssi), ssk.cost || ssk.fp || (sskRef && sskRef.cost ? sskRef.cost.fp : "") || "");
    set("I" + (168 + ssi), ssk.src || ssk.source || (sc ? sc.name : ""));
    set("J" + (168 + ssi), ssk.ds || ssk.desc || ssk.description || (sskRef && sskRef.description ? sskRef.description[0] : "") || "");
  }

  // XP/SP
  if (state.xp) set("U46", String(state.xp));
  ensureSpState();
  if (state.sp_points) set("U51", String(state.sp_points));

  // Weight/Language/Profession
  if (state.carry_capacity) {
    set("Q3", String(state.carry_capacity["常规"] || 0));
    set("Q4", String(state.carry_capacity["满载"] || 0));
    set("Q5", String(state.carry_capacity["极限"] || 0));
  }
  if (state.languages && state.languages.length > 0) set("P7", state.languages.join(", "));
  if (state.professionals && state.professionals.length > 0) set("Q8", state.professionals[0]);

  // Rebuild XMLs
  ss.text = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strings.length + '" uniqueCount="' + strings.length + '">\n' + siBlocks.join("\n") + '\n</sst>';
  sh.text = xml;

  // Recompress modified entries
  for (var ei = 0; ei < entries.length; ei++) {
    var en = entries[ei];
    if (en.name === "xl/worksheets/sheet1.xml" || en.name === "xl/sharedStrings.xml") {
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
  if(count===0){alert("暂无存档可导出");return;}
  var meta={exportedAt:new Date().toISOString(),version:"1.0",charCount:count};
  var blob=new Blob([JSON.stringify({meta:meta,saves:saves},null,2)],{type:"application/json"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  var d=new Date();a.download="斯诺德存档_"+d.getFullYear()+"-"+(d.getMonth()+1).toString().padStart(2,"0")+"-"+d.getDate().toString().padStart(2,"0")+"_"+d.getHours().toString().padStart(2,"0")+d.getMinutes().toString().padStart(2,"0")+d.getSeconds().toString().padStart(2,"0")+".json";
  a.click();URL.revokeObjectURL(a.href);
  alert("已导出 "+count+" 个角色存档");
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
        if(!data.saves){alert("存档文件格式无效");return;}
        var keys=Object.keys(data.saves);var overwrites=[];
        for(var i=0;i<keys.length;i++){
          if(localStorage.getItem(keys[i])!==null)overwrites.push(keys[i]);
        }
        var confirmMsg="将导入 "+keys.length+" 个存档";
        if(overwrites.length>0)confirmMsg+="\n\n以下存档将被覆盖：\n"+overwrites.join("\n");
        if(!confirm(confirmMsg+"\n\n确认导入？"))return;
        for(var i=0;i<keys.length;i++)localStorage.setItem(keys[i],data.saves[keys[i]]);
        alert("已导入 "+keys.length+" 个存档\n\n请刷新页面查看");
        location.reload();
      }catch(ex){alert("文件解析失败："+ex.message);}
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

