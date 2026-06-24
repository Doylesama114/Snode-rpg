for(var _cn2 in SKILL_DATA){
  var _skills2=SKILL_DATA[_cn2];if(!_skills2||!_skills2.length)continue;
  for(var _si2=0;_si2<_skills2.length;_si2++){
    var _s2=_skills2[_si2];
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
      if (!state.sp) state.sp = {};
      state.sp[map.spColor] = (state.sp[map.spColor] || 0) + map.spCount;
      state._cl12Done[sn] = true;
    }
  }
}


// 冥想: 学习时获得SP（青色+蓝色+绿色）
var MEDITATION_SPS = {"青色":1, "蓝色":1, "绿色":1};

function applyMeditationSP(skillName, add) {
  if (skillName !== "冥想") return; // 冥想
  var sps = MEDITATION_SPS;
  if (!state.sp) state.sp = {};
  for (var color in sps) {
    state.sp[color] = Math.max(0, (state.sp[color] || 0) + (add ? sps[color] : -sps[color]));
  }
}
var state={

"profs":{
  "力量":{"豁免":false,"威力":0,"承重":0,"运动-跳跃":0,"运动-攀爬":0,"运动-游泳":0,"运动-马术":0,"运动-冲浪":0},
  "敏捷":{"豁免":false,"体操":0,"骑乘":0,"隐匿":0,"巧手-偷窃":0,"巧手-开锁":0,"巧手-拆除":0,"巧手-自定义":0},
  "体质":{"豁免":false,"专注":0,"耐力":0},
  "智力":{"豁免":false,"调查":0,"逻辑":0,"宗教":0,"估价":0,"伪造":0,"读唇":0,"奥秘-魔法学识":0,"奥秘-炼金术":0,"奥秘-神奇道具":0,"奥秘-多元宇宙":0,"知识-历史":0,"知识-地理":0,"知识-人文":0,"知识-政治":0,"知识-神秘学":0,"知识-工程学":0,"知识-珠宝学":0,"知识-草药学":0,"知识-医药":0,"知识-烹饪":0,"知识-自定义":0},
  "感知":{"豁免":false,"洞悉":0,"导航":0,"自然":0,"驯兽":0,"感悟":0,"聆听":0,"察觉":0},
  "魅力":{"豁免":false,"欺瞒":0,"说服":0,"表演-歌唱":0,"表演-舞蹈":0,"表演-演奏":0,"表演-自定义":0,"恐吓":0},
  "意志":{"豁免":false,"求生":0,"激励":0,"决策":0},
  "幸运":{"豁免":false,"机遇":0,"探索":0}
},
"background":"", "player":"", "name":"","race":"","gender":"","age":"","height":"","weight":"","eye":"","skin":"","hair":"","portrait":"",
"xp":0, "carry_capacity":{"常规":45,"满载":60,"极限":75,"当前":5},
"sp":{"橙色":0,"白色":0,"紫色":0,"黄色":0,"无色":0,"蓝色":0,"青色":0,"黑色":0,"红色":0,"棕色":0,"粉色":0,"绿色":0,"浅色":0,"炫彩":0},
"hp":10,"fp":8,
"story":"","personality":"","traits":"","ideals":"","bonds":"","flaws":"","deity":"","contacts":"","scamType":"","missionChannel":"","academicDomain":"","weapon_specs":[],
"attrs":{"力量":10,"敏捷":10,"体质":10,"智力":10,"感知":10,"魅力":10,"意志":10,"幸运":10},
"classes":[{"name":"","level":0,"styles":["","","",""]},{"name":"","level":0,"styles":["","","",""]},{"name":"","level":0,"styles":["","","",""]}],
"skills":[], "special_feats":[], "feats":[], "currency":{"金币":0,"银币":0,"铜币":0,"其他":""},
"equipment":{"主手武器":[],"副手武器":[],"防具":[],"配饰":[],"背包":[],"杂物包":[],"旅行腰包":[],"材料包":[]},
"racial_traits":[],"class_features":[],"languages":["通用语"],"professionals":[],"talent_tree":[],
"forbidden_skills":[],"unlocked_tiers":["一阶","二阶"],
"containerItems":{"背包":"已解锁","旅行腰包":"已解锁","材料包A":"","材料包B":""}};

// ===== Save/Load System =====
var CURRENT_CHAR = "";
var CURRENT_SLOT = 0;
var SAVE_KEY_PREFIX = "char_";

function getSaveKey(charName, slotIndex) {
  return SAVE_KEY_PREFIX + charName + "_slot" + slotIndex;
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
    // Restore state properties (preserve functions etc.)
    for (var k in data) {
      if (data.hasOwnProperty(k)) {
        state[k] = data[k];
      }
    }
    CURRENT_CHAR = charName;
    CURRENT_SLOT = slotIndex;
    state._dirty = false;
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
  // Preserve styles from upload/xlsx: skip if any class has valid non-label styles
  for(var pi=0;pi<state.classes.length;pi++){
    var cs=state.classes[pi];
    if(cs.name&&cs.styles&&cs.styles[0]&&cs.styles[0]!=="通用"&&cs.styles[0]!=="风格"&&cs.styles[0]!=="风格名")return;
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


function autoCalcTalentTree(){
  // Preserve talents from upload: skip if talent_tree already has items with tiers
  var _tl=state.talent_tree||[];if(_tl.length>0&&_tl[0].tier)return;
  state.talent_tree=_tl;
  if(!state.claimed_levels){
    state.claimed_levels={};
    for(var ci=0;ci<state.classes.length;ci++){
      var cl=state.classes[ci];
      if(cl.level>0){
        state.claimed_levels[ci]=[];
        for(var lv=1;lv<=cl.level;lv++)state.claimed_levels[ci].push(lv);
      }
    }
  }
}


function costHtml(c){return c||'\u2014';}








function skillDescCell(d, cn, sn) {


  if (!d) return "—";


  var sd = d.length > 25 ? d.substring(0, 25) + "..." : d;


  return sd + " <button onclick=\'showSkillDetail(\"" + cn + "\",\"" + sn + "\")\' style=\'padding:1px 6px;font-size:10px;background:#3a5a7a;color:#ddd;border:none;border-radius:3px;cursor:pointer;vertical-align:middle\'>\ud83d\udcd6</button>";


}





// Hex to color name mapping (reverse of spColors)


var _hex2name = {"#EE822F":"\u6a59\u8272","#FFFFFF":"\u767d\u8272","#B94BFF":"\u7d2b\u8272","#FFF32F":"\u9ec4\u8272","#D9D9D9":"\u65e0\u8272","#00B0F0":"\u84dd\u8272","#00FA99":"\u9752\u8272","#595959":"\u9ed1\u8272","#FF0000":"\u7ea2\u8272","#843F0B":"\u68d5\u8272","#FFB7E3":"\u7c89\u8272","#00B050":"\u7eff\u8272","#B3F9FF":"\u6d45\u8272"};





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


  var _hex2name_local = {"#EE822F":"\u6a59\u8272","#FFFFFF":"\u767d\u8272","#B94BFF":"\u7d2b\u8272","#FFF32F":"\u9ec4\u8272","#D9D9D9":"\u65e0\u8272","#00B0F0":"\u84dd\u8272","#00FA99":"\u9752\u8272","#595959":"\u9ed1\u8272","#FF0000":"\u7ea2\u8272","#843F0B":"\u68d5\u8272","#FFB7E3":"\u7c89\u8272","#00B050":"\u7eff\u8272","#B3F9FF":"\u6d45\u8272"};


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











function spDot(skill) {


  var costs = skill.cost;


  if (!costs || costs.length === 0) return "";


  var html = "";


  for (var ci = 0; ci < costs.length; ci++) {


    var hex = costs[ci].color || "";


    if (!hex) continue;


    var isGrad = (hex.indexOf("gradient") >= 0);


    var bg = isGrad ? "linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)" : hex;


    html += "<span style='display:inline-block;width:12px;height:12px;border-radius:2px;background:" + bg + ";border:1px solid rgba(0,0,0,0.5);vertical-align:middle'></span>";


  }


  return html;


}





function deductSkillPoint(colorName) {


  // Deduct 1 SP of the given color ONLY - no auto-fallback


  if (!state.sp) state.sp = {};


  if ((state.sp[colorName] || 0) > 0) {


    state.sp[colorName]--;


    return true;


  }


  return false;


}





function showSPChoiceModal(stepIdx, totalSteps, remainingCosts, alreadyDeducted, confirmCallback, cancelCallback) {


  closeReplaceModal();


  var currentStep = remainingCosts[0];


  if (!currentStep) { confirmCallback(); return; }


  var colorName = currentStep.colorName;


  var hex = currentStep.colorHex;


  var isColorless = (currentStep.colorName === "\u65e0\u8272");


  var overlay = document.createElement("div");


  overlay.id = "modalOverlay";


  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";


  document.body.appendChild(overlay);


  


  // Store step info + callbacks on window


  window._spStepInfo = {


    remaining: remainingCosts.slice(1),


    confirmCb: confirmCallback,


    cancelCb: cancelCallback,


    stepIdx: stepIdx,


    totalSteps: totalSteps


  };


  


  var html = "<div style='background:#2d2722;border:1px solid #5a3a18;border-radius:12px;padding:20px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5)'>";


  html += "<div style='color:#f0d0a0;font-size:14px;margin-bottom:12px;font-weight:bold'>\u652f\u4ed8\u6280\u80fd\u70b9 (" + (stepIdx+1) + "/" + totalSteps + ")</div>";


  html += "<div style='color:#d0c0a0;font-size:13px;margin-bottom:10px'>\u8bf7\u9009\u62e9\u5982\u4f55\u652f\u4ed8\u8fd9\u4e00\u70b9\u6280\u80fd\u70b9\uff1a</div>";


  html += "<div style='margin:8px 0'>";


  
  if (isColorless) {
    var colorNames = ["\u7ea2\u8272","\u6a59\u8272","\u9ec4\u8272","\u7eff\u8272","\u9752\u8272","\u84dd\u8272","\u7d2b\u8272","\u7c89\u8272","\u68d5\u8272","\u6d45\u8272","\u767d\u8272","\u9ed1\u8272","\u65e0\u8272","\u70ab\u5f69"];
    var colorHexes = {"\u7ea2\u8272":"#FF0000","\u6a59\u8272":"#EE822F","\u9ec4\u8272":"#FFF32F","\u7eff\u8272":"#00B050","\u9752\u8272":"#00FA99","\u84dd\u8272":"#00B0F0","\u7d2b\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u68d5\u8272":"#B94F00","\u6d45\u8272":"#B3F9FF","\u767d\u8272":"#FFFFFF","\u9ed1\u8272":"#4D4D4D","\u65e0\u8272":"#D9D9D9","\u70ab\u5f69":"linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)"};
    for (var ci = 0; ci < colorNames.length; ci++) {
      var cn = colorNames[ci];
      var avail = (state.sp[cn] || 0) > 0;
      var btnId = "spPayBtn_" + Date.now() + "_" + ci;
      html += "<button id='" + btnId + "' style='display:block;width:100%;padding:10px 12px;margin:4px 0;background:" + (avail ? "#3a5030" : "#3a3030") + ";color:#f0e0d0;border:1px solid #5a3a18;border-radius:6px;cursor:pointer;text-align:left;font-size:14px' " + (avail ? "" : "disabled") + ">";
      html += "<span style='display:inline-block;width:16px;height:16px;border-radius:3px;background:" + (colorHexes[cn] || "#D9D9D9") + ";border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:8px'></span>";
      html += cn + " \u6280\u80fd\u70b9 (\u5269\u4f59: " + (state.sp[cn]||0) + ")";
      if (!avail) html += " [\u4e0d\u8db3]";
      html += "</button>";
    }
  } else {
    // Option 1: matching color
    var matchingAvailable = (state.sp[colorName] || 0) > 0;
    var btn1 = "spPayBtn_" + Date.now() + "_1";
    html += "<button id='" + btn1 + "' style='display:block;width:100%;padding:10px 12px;margin:4px 0;background:" + (matchingAvailable ? "#3a5030" : "#3a3030") + ";color:#f0e0d0;border:1px solid #5a3a18;border-radius:6px;cursor:pointer;text-align:left;font-size:14px' " + (matchingAvailable ? "" : "disabled") + ">";
    html += "<span style='display:inline-block;width:16px;height:16px;border-radius:3px;background:" + hex + ";border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:8px'></span>";
    html += colorName + " \u6280\u80fd\u70b9 (\u5269\u4f59: " + (state.sp[colorName]||0) + ")";
    if (!matchingAvailable) html += " [\u4e0d\u8db3]";
    html += "</button>";

    // Option 2: colorless
    var colorlessAvail = (state.sp["\u65e0\u8272"] || 0) > 0;
    var btn2 = "spPayBtn_" + Date.now() + "_2";
    html += "<button id='" + btn2 + "' style='display:block;width:100%;padding:10px 12px;margin:4px 0;background:" + (colorlessAvail ? "#3a5030" : "#3a3030") + ";color:#f0e0d0;border:1px solid #5a3a18;border-radius:6px;cursor:pointer;text-align:left;font-size:14px' " + (colorlessAvail ? "" : "disabled") + ">";
    html += "<span style='display:inline-block;width:16px;height:16px;border-radius:3px;background:#D9D9D9;border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:8px'></span>";
    html += "\u65e0\u8272 \u6280\u80fd\u70b9 (\u5269\u4f59: " + (state.sp["\u65e0\u8272"]||0) + ")";
    if (!colorlessAvail) html += " [\u4e0d\u8db3]";
    html += "</button>";

    // Option 3: rainbow
    var rainbowAvail = (state.sp["\u70ab\u5f69"] || 0) > 0;
    var btn3 = "spPayBtn_" + Date.now() + "_3";
    html += "<button id='" + btn3 + "' style='display:block;width:100%;padding:10px 12px;margin:4px 0;background:" + (rainbowAvail ? "#3a5030" : "#3a3030") + ";color:#f0e0d0;border:1px solid #5a3a18;border-radius:6px;cursor:pointer;text-align:left;font-size:14px' " + (rainbowAvail ? "" : "disabled") + ">";
    html += "<span style='display:inline-block;width:16px;height:16px;border-radius:3px;background:linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99);border:1px solid rgba(255,255,255,0.2);vertical-align:middle;margin-right:8px'></span>";
    html += "\u70ab\u5f69 \u6280\u80fd\u70b9 (\u5269\u4f59: " + (state.sp["\u70ab\u5f69"]||0) + ")";
    if (!rainbowAvail) html += " [\u4e0d\u8db3]";
    html += "</button>";
  }


  // Cancel


  html += "<button id='spCancelBtn_" + Date.now() + "' style='width:100%;padding:8px;margin-top:8px;background:#5a3a18;color:#f0e0d0;border:none;border-radius:6px;cursor:pointer;font-size:13px'>\u53d6\u6d88\u5b66\u4e60</button>";


  html += "</div></div>";


  overlay.innerHTML = html;


  overlay.style.display = "flex";


  


  // Bind clicks using direct element IDs


  setTimeout(function() {
    if (isColorless) {
      var btns = overlay.querySelectorAll("button");
      for (var bi = 0; bi < btns.length; bi++) {
        var bid = btns[bi].id;
        if (bid && bid.indexOf("spPayBtn_") === 0) {
          (function(bid) {
            btns[bi].onclick = function() {
              // Extract color name from button text
              var text = document.getElementById(bid).textContent || document.getElementById(bid).innerText;
              var colorName = text.replace("\u6280\u80fd\u70b9","").replace("\u5269\u4f59","").trim().split(" ")[0];
              window._doSPPay(colorName);
            };
          })(bid);
        } else if (bid && bid.indexOf("spCancelBtn") === 0) {
          btns[bi].onclick = function() { window._doSPCancel(); };
        }
      }
    } else {
      var payColor = colorName;
      var b1 = document.getElementById(btn1);
      if (b1 && matchingAvailable) {
        b1.onclick = function() { window._doSPPay(payColor); };
      }
      var b2 = document.getElementById(btn2);
      if (b2 && colorlessAvail) {
        b2.onclick = function() { window._doSPPay("\u65e0\u8272"); };
      }
      var b3 = document.getElementById(btn3);
      if (b3 && rainbowAvail) {
        b3.onclick = function() { window._doSPPay("\u70ab\u5f69"); };
      }
      var allBtns = overlay.querySelectorAll("button");
      for (var bi = 0; bi < allBtns.length; bi++) {
        if (allBtns[bi].id && allBtns[bi].id.indexOf("spCancelBtn") === 0) {
          allBtns[bi].onclick = function() { window._doSPCancel(); };
        }
      }
    }
  }, 0);


}





// Helper: do a single SP payment


window._doSPPay = function(chosenColor) {


  closeReplaceModal();


  state.sp[chosenColor] = (state.sp[chosenColor] || 0) - 1;


  window._spDeductionLog = window._spDeductionLog || [];


  window._spDeductionLog.push(chosenColor);


  var st = window._spStepInfo;


  if (st.remaining.length === 0) {


    window._spDeductionLog = [];


    st.confirmCb();


  } else {


    showSPChoiceModal(st.stepIdx + 1, st.totalSteps, st.remaining, {}, st.confirmCb, st.cancelCb);


  }


};





// Helper: cancel and rollback all SP payments


window._doSPCancel = function() {


  closeReplaceModal();


  var log = window._spDeductionLog || [];


  for (var li = 0; li < log.length; li++) {


    state.sp[log[li]] = (state.sp[log[li]] || 0) + 1;


  }


  window._spDeductionLog = [];


  var st = window._spStepInfo;


  if (st && st.cancelCb) st.cancelCb();


  render(); renderLearnPanel();


};








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
        if (!state.sp) state.sp = {};
        for (var sc in eff.sp) {
          state.sp[sc] = Math.max(0, (state.sp[sc] || 0) + mult * eff.sp[sc]);
        }
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
        if (!state.sp) state.sp = {};
        for (var sc in eff.sp) {
          state.sp[sc] = Math.max(0, (state.sp[sc] || 0) + mult * eff.sp[sc]);
        }
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
          if (!state.sp) state.sp = {};
          for (var sc in spAmounts) {
            state.sp[sc] = (state.sp[sc] || 0) + spAmounts[sc];
          }
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
  for (var i = 0; i < d.length; i++) { if (d[i].name === name) return d[i].style || ""; }
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
  if (!tierName || tierName === "\u901a\u7528") return true;
  var unlocked = state.unlocked_tiers || ["\u4e00\u9636","\u4e8c\u9636"];
  for (var ui = 0; ui < unlocked.length; ui++) {
    if (unlocked[ui] === tierName) return true;
  }
  return false;
}
function getTierUnlockCost(tierName) {
  if (!TIER_UNLOCK_COST) return 99999;
  var info = TIER_UNLOCK_COST[tierName];
  return info ? info.cost : 99999;
}
function getTierMinLevel(tierName) {
  if (!TIER_UNLOCK_COST) return 99;
  var info = TIER_UNLOCK_COST[tierName];
  return info ? info.minLevel : 99;
}
function resolveWeaponProfs(className){return CLASS_WEAPON_PROFS[className]||[];}
function render(){ applyChoiceLLevel12Boosts();
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


  var spColors=[["橙色","#EE822F"],["白色","#FFFFFF"],["紫色","#B94BFF"],["黄色","#FFF32F"],["无色","#D9D9D9"],["蓝色","#00B0F0"],["青色","#00FA99"],["黑色","#595959"],["红色","#FF0000"],["棕色","#843F0B"],["粉色","#FFB7E3"],["绿色","#00B050"],["浅色","#B3F9FF"],["炫彩","gradient"]];


  var spData=state.sp||{};var spHtml="";


  for(var ri=0;ri<2;ri++){


    spHtml+="<div class='sp-row'>";


    for(var ci=0;ci<7;ci++){


      var idx=ri*7+ci;if(idx>=spColors.length)break;


      var nm=spColors[idx][0];var co=spColors[idx][1];var ct=spData[nm]||0;


      if(co==="gradient"){spHtml+="<div class='sp-item'><span class='sp-dot sp-dot-premium'></span><span class='sp-count'>"+ct+"</span></div>";}


      else{spHtml+="<div class='sp-item'><span class='sp-dot' style='background:"+co+"'></span><span class='sp-count'>"+ct+"</span></div>";}


    }


    spHtml+="</div>";}


  document.getElementById("sp-bar").innerHTML=spHtml;





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
          if(pn==="豁免"){ph+='<div class="save-display"><span>豁免</span><span class="save-status">'+(pv?"✓":"✗")+'</span></div>';}
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


  var mainSkills=state.skills.filter(function(s){return !s.sub||s.sub==="";});


  


  var subSkills=state.skills.filter(function(s){return s.sub&&s.sub!=="";});


  var skillHtml="";var mainSlots=calcSkillSlots(0);for(var ski=0;ski<mainSlots;ski++){var s=mainSkills[ski]||null;


    if(s){var sStyle=getSkillStyle(s.n,s.src);var src=sStyle?' <span class="skill-sub">('+sStyle+')</span>':"";var stm=getSkillField(s.n,s.src,"施展时间");var sds=getSkillField(s.n,s.src,"description");var sdr=getSkillField(s.n,s.src,"疲劳消耗");var srange=getSkillField(s.n,s.src,"施展距离");var sdur=getSkillField(s.n,s.src,"持续时间");skillHtml+='<tr><td><span class="skill-name">'+s.n+'</span>'+src+'</td><td>'+(stm||'—')+'</td><td>'+skillDescCell(sds,state.classes[0].name,s.n)+'</td><td>'+(sdr?sdr:'—')+'</td><td>'+(srange||'—')+'</td><td>'+(sdur||'—')+'</td></tr>';}


    else{skillHtml+='<tr class="empty-slot"><td><span style="color:#906840;font-style:italic">空栏位</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';}}


  document.getElementById("skill-table-body").innerHTML=skillHtml;
  document.getElementById("mainSkillTitle").innerHTML="主职业技能列表 ("+calcSkillSlots(0)+"栏)";


   


  var subSkillHtml="";var subSlots=calcSkillSlots(1);for(var sski=0;sski<subSlots;sski++){var ss=subSkills[sski]||null;


    if(ss){var sStyle=getSkillStyle(ss.n,ss.src);var src=sStyle?' <span class="skill-sub">('+sStyle+')</span>':"";var sstm=getSkillField(ss.n,ss.src,"施展时间");var ssds=getSkillField(ss.n,ss.src,"description");var ssdr=getSkillField(ss.n,ss.src,"疲劳消耗");var ssrange=getSkillField(ss.n,ss.src,"施展距离");var ssdur=getSkillField(ss.n,ss.src,"持续时间");subSkillHtml+='<tr><td><span class="skill-name">'+ss.n+'</span>'+src+'</td><td>'+(sstm||'—')+'</td><td>'+skillDescCell(ssds,ss.sub,ss.n)+'</td><td>'+(ssdr?ssdr:'—')+'</td><td>'+(ssrange||'—')+'</td><td>'+(ssdur||'—')+'</td></tr>';}


    else{subSkillHtml+='<tr class="empty-slot"><td><span style="color:#906840;font-style:italic">\u7a7a\u680f\u4f4d</span></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';}}


document.getElementById("sub-skill-table-body").innerHTML=subSkillHtml;
  document.getElementById("subSkillTitle").innerHTML="子职业技能列表 ("+calcSkillSlots(1)+"栏)";}function cheatAdd(){if(!confirm("添加1000经验值和全部技能点各1个？"))return;state.xp+=1000;var colors=["橙色","白色","紫色","黄色","无色","蓝色","青色","黑色","红色","棕色","粉色","绿色","浅色","炫彩"];for(var i=0;i<colors.length;i++)state.sp[colors[i]]=(state.sp[colors[i]]||0)+1;alert("已添加！");render();}
function toggleLearnMode() {


  var panel = document.getElementById("learnPanel");


  var btn = document.getElementById("learnToggle");


  if (!panel || !btn) return;


  if (panel.classList.contains("show")) {


    panel.classList.remove("show"); panel.style.display = "none";


    btn.innerHTML = "📚 学习技能";


  } else {


    try { renderLearnPanel(); panel.classList.add("show"); btn.innerHTML = "✕ 关闭"; }


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


    spOverview.style.cssText = "margin-bottom:10px;padding:8px 12px;background:#2d2722;border-radius:8px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center";


    var spColors = {"\u6a59\u8272":"#EE822F","\u767d\u8272":"#FFFFFF","\u7d2b\u8272":"#B94BFF","\u9ec4\u8272":"#FFF32F","\u65e0\u8272":"#D9D9D9","\u84dd\u8272":"#00B0F0","\u9752\u8272":"#00FA99","\u9ed1\u8272":"#595959","\u7ea2\u8272":"#FF0000","\u68d5\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u7eff\u8272":"#00B050","\u6d45\u8272":"#B3F9FF","\u70ab\u5f69":"linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)"};


    var spOrder = ["\u6a59\u8272","\u767d\u8272","\u7d2b\u8272","\u9ec4\u8272","\u65e0\u8272","\u84dd\u8272","\u9752\u8272","\u9ed1\u8272","\u7ea2\u8272","\u68d5\u8272","\u7c89\u8272","\u7eff\u8272","\u6d45\u8272","\u70ab\u5f69"];


    for (var si = 0; si < spOrder.length; si++) {


      var cn = spOrder[si];


      var hex = spColors[cn];


      var bg = (hex.indexOf("gradient") >= 0) ? hex : "background:" + hex;


      var isGrad = hex.indexOf("gradient") >= 0;


      spOverview.innerHTML += "<span style='display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#c0b0a0'>" +


        "<span style='display:inline-block;width:10px;height:10px;border-radius:2px;" + (isGrad ? "background:" + hex : "background:" + hex) + ";border:1px solid rgba(255,255,255,0.15)'></span>" +


        cn + ":" + (state.sp[cn]||0) + "</span>";


    }


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
    var spColors = {"\u6a59\u8272":"#EE822F","\u767d\u8272":"#FFFFFF","\u7d2b\u8272":"#B94BFF","\u9ec4\u8272":"#FFF32F","\u65e0\u8272":"#D9D9D9","\u84dd\u8272":"#00B0F0","\u9752\u8272":"#00FA99","\u9ed1\u8272":"#595959","\u7ea2\u8272":"#FF0000","\u68d5\u8272":"#843F0B","\u7c89\u8272":"#FFB7E3","\u7eff\u8272":"#00B050","\u6d45\u8272":"#B3F9FF","\u70ab\u5f69":"linear-gradient(135deg,#FFD700,#FF6B6B,#B94BFF,#00B0F0,#00FA99)"};
    var spOrder = ["\u6a59\u8272","\u767d\u8272","\u7d2b\u8272","\u9ec4\u8272","\u65e0\u8272","\u84dd\u8272","\u9752\u8272","\u9ed1\u8272","\u7ea2\u8272","\u68d5\u8272","\u7c89\u8272","\u7eff\u8272","\u6d45\u8272","\u70ab\u5f69"];
    spOverview.innerHTML = "";
    for (var si = 0; si < spOrder.length; si++) {
      var cn = spOrder[si];
      var hex = spColors[cn];
      var isGrad = hex.indexOf("gradient") >= 0;
      spOverview.innerHTML += "<span style=\"display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#e0d0b8\">" +
        "<span style=\"display:inline-block;width:10px;height:10px;border-radius:2px;" + (isGrad ? "background:" + hex : "background:" + hex) + ";border:1px solid rgba(255,255,255,0.15)\"></span>" +
        cn + ":" + (state.sp[cn]||0) + "</span>";
    }
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
      if (skill.type === "starting" || skill.type === "upgrade" || skill.type === "granted") continue;
      var learned = false; var crossLocked = false;
      if (skill.tags && skill.tags.indexOf("\u5929\u8d4b") >= 0) {
        var tt = state.talent_tree || [];
        for (var ti = 0; ti < tt.length; ti++) { if (tt[ti].n === skill.name && (!tt[ti].cls || tt[ti].cls === clsName)) { learned = true; break; } if (tt[ti].n === skill.name && tt[ti].cls && tt[ti].cls !== clsName) { crossLocked = true; } }
      } else {
        var sl = state.skills;
        for (var ssi = 0; ssi < sl.length; ssi++) { if (sl[ssi].n === skill.name && sl[ssi].src === clsName) { learned = true; break; } if (sl[ssi].n === skill.name && sl[ssi].src !== clsName) { crossLocked = true; } }
      }
      var styleName = skill.style || "\u901a\u7528";
      if (searchQ && skill.name.toLowerCase().indexOf(searchQ) < 0 && styleName.toLowerCase().indexOf(searchQ) < 0 && (skill.tags || []).join(" ").toLowerCase().indexOf(searchQ) < 0 && (skill.tier || "").toLowerCase().indexOf(searchQ) < 0) continue;
      if (!groups[styleName]) groups[styleName] = {};
      var tierName = skill.tier || "\u901a\u7528";
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
          var tierLabel = tn ? tn.replace("\u5929\u8d4b\u6811","") : "\u901a\u7528";

          // Tier header row
          html += "<div style=\"margin:4px 0;padding:4px 8px;background:#2a2218;border-left:2px solid " + (tierUnlocked ? "#6a9a4a" : "#8a4a3a") + ";border-radius:3px;display:flex;justify-content:space-between;align-items:center\">";
          html += "<span style=\"font-size:12px;color:" + (tierUnlocked ? "#b0d0a0" : "#b08060") + ";font-weight:bold\">[" + tierLabel + "]</span>";
          if (!tierUnlocked) {
            var cost = getTierUnlockCost(tn);
            var minLevel = getTierMinLevel(tn);
            html += "<button onclick=\"unlockTier('" + tn + "')\" style=\"font-size:11px;padding:3px 10px;background:#6a4a2a;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer\">\u82b1\u8d39" + cost + "\u7ecf\u9a8c(\u9700" + minLevel + "\u7ea7)" + "\u89e3\u9501</button>";
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
        var tierName = groupName.replace("\u5929\u8d4b\u6811","");
        var tierUnlocked = isTierUnlocked(tierName);

        html += "<div style=\"margin:4px 0;border:1px solid #4a3520;border-radius:6px;overflow:hidden;background:#25201a\">";
        html += "<div onclick=\"toggleCollapse('" + key.replace(/'/g,"\\u0027") + "')\" style=\"padding:6px 10px;background:#3d3020;font-size:13px;color:#d0b898;cursor:pointer;display:flex;justify-content:space-between;align-items:center\">";
        html += "<span><span style=\"color:#e8a86a;font-weight:bold\">" + tierName + "</span> <span style=\"color:#b09070;font-size:11px\">(" + items.length + "\u4e2a\u6280\u80fd)</span></span>";
        html += "<span style=\"font-size:11px;color:#b09070\">" + (styleCollapsed ? "\u25b6 \u5c55\u5f00" : "\u25bc \u6536\u8d77") + "</span></div>";

        if (!styleCollapsed) {
          if (!tierUnlocked) {
            var cost = getTierUnlockCost(tierName);
            var minLevel = getTierMinLevel(tierName);
            html += "<div style=\"padding:10px;text-align:center;background:#2a2218\">";
            html += "<button onclick=\"unlockTier('" + tierName + "')\" style=\"font-size:13px;padding:5px 16px;background:#6a4a2a;color:#f0e0d0;border:none;border-radius:4px;cursor:pointer\">\u82b1\u8d39" + cost + "\u7ecf\u9a8c(\u9700" + minLevel + "\u7ea7)" + "\u89e3\u9501\u8be5\u9636\u4f4d</button>";
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


  if (skillData.name === "\u5173\u952e\u504f\u597d") {
    var _isSub2=isSub; var _clsName2=clsName; var _tier2=skillData.tier||"\u4e00\u9636";
    showKeyPreferencePicker(function(prefColor){
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


    var costList = parseSkillCost(skillData);


    if (costList.length > 0) {


      // Check if all rainbow


      var allRainbow = true;


      for (var ci = 0; ci < costList.length; ci++) { if (costList[ci].colorHex.indexOf("gradient") < 0) { allRainbow = false; break; } }


      if (allRainbow) {


        if ((state.sp["\u70ab\u5f69"] || 0) < costList.length) { alert("\u4e0d\u8db3\u7684\u70ab\u5f69\u6280\u80fd\u70b9\uff0c\u9700\u8981 " + costList.length + " \u70b9"); return; }


        state.sp["\u70ab\u5f69"] -= costList.length;


      } else {


        // Try to deduct matching colors first


        var deducted = {};


        var missingSteps = [];


        for (var ci = 0; ci < costList.length; ci++) {


          var c = costList[ci];


          if ((state.sp[c.colorName] || 0) > 0) {


            state.sp[c.colorName]--;


            deducted[c.colorName] = (deducted[c.colorName] || 0) + 1;


          } else if (getKeyPreferenceColor() && c.colorName === getKeyPreferenceColor()) {


            var _scl=["\u6a59\u8272","\u767d\u8272","\u7d2b\u8272","\u9ec4\u8272","\u65e0\u8272","\u84dd\u8272","\u9752\u8272","\u9ed1\u8272","\u7ea2\u8272","\u68d5\u8272","\u7c89\u8272","\u7eff\u8272","\u6d45\u8272","\u70ab\u5f69"];var _sf=false;


            for(var _si=0;_si<_scl.length;_si++){var _sc=_scl[_si];if((state.sp[_sc]||0)>0){state.sp[_sc]--;deducted[_sc]=(deducted[_sc]||0)+1;_sf=true;break;}}


            if(!_sf){missingSteps.push(c);}


          } else if (getFreeSPColors().length>0) {


            var _fc2=getFreeSPColors();var _ff2=false;


            for(var _fi2=0;_fi2<_fc2.length;_fi2++){var _fcv=_fc2[_fi2];if((state.sp[_fcv]||0)>0){state.sp[_fcv]--;deducted[_fcv]=(deducted[_fcv]||0)+1;_ff2=true;break;}}


            if(!_ff2){missingSteps.push(c);}


          } else {


            missingSteps.push(c);


          }


        }


        if (missingSteps.length > 0) {


          // Need to ask user - rollback first


          for (var c in deducted) { state.sp[c] = (state.sp[c] || 0) + deducted[c]; }


          showSPChoiceModal(0, costList.length, costList, {}, function(finalDeduction) {


            // All deducted, proceed


            tl.push({id:skillData.id,n:skillData.name,cls:clsName,tier:tier.replace("天赋树",""),sub:isSub,locked:isLocked});


            state.talent_tree=tl; applyChoiceBProfBonus(skillName,true); applyChoiceLMasteryBonus(skillName,true); applyMeditationSP(skillName,true);


            autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();


          }, function() {


            // Cancelled - do nothing


          });


          return;


        }


      }


    }


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


      showReplaceModal(newName, clsSkills, skillList, maxSlots); }


    // Deduct skill point - skip if free (no cost or empty cost)


    var costList = parseSkillCost(skillData);


    if (costList.length > 0) {


      // Check if all rainbow


      var allRainbow = true;


      for (var ci = 0; ci < costList.length; ci++) { if (costList[ci].colorHex.indexOf("gradient") < 0) { allRainbow = false; break; } }


      if (allRainbow) {


        if ((state.sp["\u70ab\u5f69"] || 0) < costList.length) { alert("\u4e0d\u8db3\u7684\u70ab\u5f69\u6280\u80fd\u70b9\uff0c\u9700\u8981 " + costList.length + " \u70b9"); return; }


        state.sp["\u70ab\u5f69"] -= costList.length;


      } else {


        // Try to deduct matching colors first


        var deducted = {};


        for (var ci = 0; ci < costList.length; ci++) {


          var c = costList[ci];


          if ((state.sp[c.colorName] || 0) > 0) {


            state.sp[c.colorName]--;


            deducted[c.colorName] = (deducted[c.colorName] || 0) + 1;


          } else {


            deducted = {}; // reset - we need all or nothing


            break;


          }


        }


        // Check if all deducted


        var totalDeducted = 0;


        for (var cn in deducted) totalDeducted += deducted[cn];


        if (totalDeducted < costList.length) {


          // Rollback partial


          for (var cn in deducted) { state.sp[cn] = (state.sp[cn] || 0) + deducted[cn]; }


          showSPChoiceModal(0, costList.length, costList, {}, function(finalDeduction) {


            // All deducted, proceed with skill addition


            var maxSlots = isSub ? 8 : 17; var skillList2 = state.skills.slice();


            var clsSkills2 = [];


            for (var si = 0; si < skillList2.length; si++) { if (isSub && skillList2[si].sub) clsSkills2.push(skillList2[si]); else if (!isSub && !skillList2[si].sub) clsSkills2.push(skillList2[si]); }


            if (clsSkills2.length >= maxSlots) {


              var msg = "\u6280\u80fd\u5217\u8868\u5df2\u6ee1\uff01\u8bf7\u9009\u62e9\u8981\u66ff\u6362\u7684\u6280\u80fd\u7f16\u53f7 (1-" + maxSlots + "):\n";


              for (var si = 0; si < clsSkills2.length; si++) { msg += (si+1) + ". " + clsSkills2[si].n + (clsSkills2[si].locked ? " [\u9501\u5b9a]" : "") + "\n"; }


              showReplaceModal(skillData.name, clsSkills2, skillList2, maxSlots);


              return;


            }


            skillList2.push({id: skillData.id, n: skillData.name, src: skillData.style || clsName,


              tm: skillData.fields ? (skillData.fields["\u65bd\u5c55\u65f6\u95f4"] || "") : "",


              ds: (skillData.description || [""]).join(""), dr: skillData.fields ? (skillData.fields["\u75b2\u52b3\u6d88\u8017"] || "") : "",


              range: skillData.fields ? (skillData.fields["\u65bd\u5c55\u8ddd\u79bb"] || "") : "",


              dur: skillData.fields ? (skillData.fields["\u6301\u7eed\u65f6\u95f4"] || "") : "",


              cost: "", sub: isSub ? clsName : "", locked: isLocked});


            state.skills = skillList2;


            autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();


          }, function() {


            // Cancelled - do nothing


          });


          return;


        }


      }


    }


    skillList.push({id: skillData.id, n: skillData.name, src: skillData.style || clsName,


      tm: skillData.fields ? (skillData.fields["\u65bd\u5c55\u65f6\u95f4"] || "") : "",


      ds: (skillData.description || [""]).join(""), dr: skillData.fields ? (skillData.fields["\u75b2\u52b3\u6d88\u8017"] || "") : "",


      range: skillData.fields ? (skillData.fields["\u65bd\u5c55\u8ddd\u79bb"] || "") : "",


      dur: skillData.fields ? (skillData.fields["\u6301\u7eed\u65f6\u95f4"] || "") : "",


      cost: "", sub: isSub ? clsName : "", locked: isLocked});


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
  var info = TIER_UNLOCK_COST[tierName];
  if (!info) { alert("该阶位不需要解锁"); return; }
  var cost = info.cost;
  var minLevel = info.minLevel || 99;
  var maxLv = getMaxLevel();
  if (maxLv < minLevel) { alert("当前最高职业等级为" + maxLv + "级，需要主职业达到" + minLevel + "级才能解锁" + tierName.replace("天赋树","") + "阶天赋树"); return; }
  if (cost > state.xp) { alert("经验值不足，需要" + cost + "点经验值（当前拥有" + state.xp + "点）"); return; }
  if (!confirm("确定要花费" + cost + "点经验值解锁" + tierName.replace("天赋树","") + "阶天赋树吗？当前经验值：" + state.xp + "点")) return;
  state.xp -= cost;
  if (!state.unlocked_tiers) state.unlocked_tiers = ["一阶","二阶"];
  if (state.unlocked_tiers.indexOf(tierName) < 0) state.unlocked_tiers.push(tierName);
  renderLearnPanel();
  render();
  alert("解锁成功！已解锁" + tierName.replace("天赋树","") + "阶天赋树");
}
function confirmUnlearn(clsName, skillName, clsIdx) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var desc = (skillData.description || [""]).join("<br>");


  showSkillPreview(skillName, skillData.style || clsName, skillData.tier || "", desc, function() { unlearnSkill(clsName, skillName, clsIdx); }); }


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


      var costArr = parseSkillCost(sd);


      for (var ci = 0; ci < costArr.length; ci++) {


        state.sp[costArr[ci].colorName] = (state.sp[costArr[ci].colorName] || 0) + 1;


      }


    }


  }


  skillList.splice(idx, 1);


  state.skills = skillList;


  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }





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


      var costArr = parseSkillCost(sd);


      for (var ci = 0; ci < costArr.length; ci++) {


        state.sp[costArr[ci].colorName] = (state.sp[costArr[ci].colorName] || 0) + 1;


      }


    }


  }


  tt.splice(idx, 1);


  state.talent_tree = tt; applyChoiceBProfBonus(skillName,false); applyChoiceLMasteryBonus(skillName,false); applyMeditationSP(skillName,false);


  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }





function confirmUnlearnTalent(clsName, skillName, clsIdx) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var desc = (skillData.description || [""]).join("<br>");


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


        var costArr = parseSkillCost(sd);


        for (var ci = 0; ci < costArr.length; ci++) {


          state.sp[costArr[ci].colorName] = (state.sp[costArr[ci].colorName] || 0) + 1;


        }


      }


    }


  }


  var kept = [];


  for (var i = 0; i < state.skills.length; i++) { if (state.skills[i].locked) kept.push(state.skills[i]); }


  state.skills = kept;


  state.forbidden_skills = [];


  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel(); }


function showReplaceModal(newName, clsSkills, skillList, maxSlots) {


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


  window._replaceData = {clsSkills: clsSkills, skillList: skillList, maxSlots: maxSlots}; }


function closeReplaceModal() {


  var overlay = document.getElementById("modalOverlay");


  if (overlay) { overlay.parentNode.removeChild(overlay); } }


function doReplace(idx) {


  var data = window._replaceData;


  if (!data) return;


  var clsSkills = data.clsSkills; var skillList = data.skillList;


  if (clsSkills[idx].locked) { alert("\u8be5\u6280\u80fd\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u66ff\u6362"); return; }


  var removedId = clsSkills[idx].id;


  state.forbidden_skills = state.forbidden_skills || [];


  state.forbidden_skills.push(removedId);


  for (var si = 0; si < skillList.length; si++) { if (skillList[si].id === removedId) { skillList.splice(si, 1); break; } }


  closeReplaceModal(); }





function showSkillDetail(clsName, skillName) {


  var clsData = SKILL_DATA[clsName]; if (!clsData) return;


  var skillData = null; for (var i = 0; i < clsData.length; i++) { if (clsData[i].name === skillName) { skillData = clsData[i]; break; } }


  if (!skillData) return;


  var desc = (skillData.description&&skillData.description.length?skillData.description.join("<br>"):(skillData.flavor||""));showSkillPreview(skillName, skillData.style || clsName, skillData.tier || "", desc, null, clsName); }





function showSkillDetailFromAll(skillName) {


  // Search all SKILL_DATA for a skill by name


  for (var cls in SKILL_DATA) {


    var skills = SKILL_DATA[cls];


    for (var si = 0; si < skills.length; si++) {


      if (skills[si].name === skillName) {


        var sd = skills[si];


        var desc = (sd.description&&sd.description.length?sd.description:(sd.flavor?[sd.flavor]:[""])).join("<br>");


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

  // Apply special feat
  if(data.special==="feat"&&!_done._feat){
    showSpecialFeatSelector();
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
  if(!state.claimed_levels[clsIdx])state.claimed_levels[clsIdx]=[];
  if(state.claimed_levels[clsIdx].indexOf(level)<0)
    state.claimed_levels[clsIdx].push(level);
    // Only auto-unlock free tiers (excludes 三阶+ which need XP)
  var notes = tbl[level] ? tbl[level].notes || "" : "";
  var tierMatch = notes.match(/(一|二|三|四|五|六|七|八|九)阶/);
  if (tierMatch) {
    var tierName = tierMatch[0];
    if (!TIER_UNLOCK_COST[tierName]) {
      if (!state.unlocked_tiers) state.unlocked_tiers = ["一阶","二阶"];
      if (state.unlocked_tiers.indexOf(tierName) < 0) {
        state.unlocked_tiers.push(tierName);
      }
    }
  }  applyChoiceLLevel12Boosts();applyChoiceBLevel10Boosts();autoCalcStyles();autoCalcTalentTree();render();renderLearnPanel();
}

function showProfChoice(clsIdx,level){
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
  finalizeLevelUp(clsIdx,level);
  closeReplaceModal();
  render();
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

// First try to load saved character, then render
if (!initFromURL()) {
  render();
}

// Add save button to the page
(function() {
  var saveBtn = document.createElement("button");
  saveBtn.textContent = "保存";
  var _exportBtn=document.createElement("button");_exportBtn.textContent="导出xlsx";
  _exportBtn.style.cssText="position:fixed;top:80px;left:20px;padding:8px 16px;background:#a46d1f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:bold;z-index:1000";
  _exportBtn.onclick=function(){exportCurrentXlsx();};document.body.appendChild(_exportBtn);
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
    
    // Check compatibility
    var incomp=req.incompatible;
    var compOK=incomp.indexOf(mc.name)<0;
    // Check attrs
    var attrOK=true; var attrDetail="";
    if(req.attrAlt){
      var a1=req.attrs[req.attrAlt]; var v1=state.attrs[req.attrAlt]||10;
      var a2Keys=Object.keys(req.attrs).filter(function(k){return k!==req.attrAlt;});
      if(a2Keys.length>0){var a2=a2Keys[0];var v2=state.attrs[a2]||10;
        attrOK=(v1>=a1||v2>=a1)&&(v2>=(req.attrs[a2]||0));
        attrDetail=req.attrAlt+(a1?"≥"+a1:"")+"/"+a2+"≥"+(req.attrs[a2]||0)+" ("+cn+"="+v1+"/"+v2+")";}
      else{attrOK=v1>=a1;attrDetail=req.attrAlt+"≥"+a1+" (当前"+v1+")";}
    }else{
      var ak=Object.keys(req.attrs); attrDetail="";
      for(var ai=0;ai<ak.length;ai++){var akk=ak[ai];var av=state.attrs[akk]||10;var ar=req.attrs[akk];if(av<ar)attrOK=false;attrDetail+=(attrDetail?"，":"")+akk+"≥"+ar+" (当前"+av+")";}
      if(!ak.length){attrOK=true;attrDetail="无属性要求";}
    }
    // Check profs
    var profOK=true; var profVal=0; var profLabel="";
    if(req.profTotal>0){
      if(req.profNames&&req.profNames.length>0){
        profLabel=req.profNames.join("/");
        for(var _pi=0;_pi<req.profNames.length;_pi++){
          var _pn=req.profNames[_pi]; var _pv=0;
          var _underAttr=(req.profAttr&&state.profs[req.profAttr]&&state.profs[req.profAttr][_pn])||(req.profAttrAlt&&state.profs[req.profAttrAlt]&&state.profs[req.profAttrAlt][_pn]);
          if(!_underAttr){for(var _pa in state.profs){if(state.profs[_pa][_pn]){_pv=state.profs[_pa][_pn];break;}}}
          profVal+=_pv;
        }
      }
      if(req.profAttr){
        var _attrVal=0;
        if(state.profs[req.profAttr]){for(var _pk in state.profs[req.profAttr]){_attrVal+=state.profs[req.profAttr][_pk]||0;}}
        var _attrVal2=0;
        if(req.profAttrAlt&&state.profs[req.profAttrAlt]){for(var _pk2 in state.profs[req.profAttrAlt]){_attrVal2+=state.profs[req.profAttrAlt][_pk2]||0;}}
        var _bestAttr=Math.max(_attrVal,_attrVal2);
        profVal+=_bestAttr;
        if(profLabel)profLabel+="+";
        profLabel+=req.profAttr+(req.profAttrAlt?"或"+req.profAttrAlt:"");
      }
      profOK=profVal>=req.profTotal;
      attrDetail+=" | 熟练度"+profLabel+"≥"+req.profTotal+" (当前"+profVal+")";
    }else{attrDetail+=" | 无熟练度要求";}
    var allOK=compOK&&attrOK&&profOK;
    var bg=allOK?"#e8f5e9":"#f5f5f0"; var border=allOK?"#4caf50":"#d8d2c4";
    var failReasons=[];
    if(!compOK)failReasons.push("不兼容");
    if(!attrOK)failReasons.push("属性不足");
    if(!profOK)failReasons.push("熟练度不足");
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
  var o=document.getElementById("subclassOverlay");if(o)o.remove();
  state.classes[1]={name:cn,level:1,keyAttr:REF_CLASSES[cn]?REF_CLASSES[cn].key_attr||"":"",styles:["","","",""]};
  autoCalcStyles(); autoCalcTalentTree(); render(); renderLearnPanel();
}
})();

function exportCurrentXlsx(){
 if(!state){alert("请先导入或创建角色");return;}
 try { exportXlsxFromState(state).catch(function(e){console.error("Export error:",e); alert("导出失败，请重试");}); }
 catch(e) { console.error("Export error:",e); alert("导出失败，请重试"); }
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

async function _xlsxDeflate(data) {
  var ds = new CompressionStream("deflate-raw");
  var writer = ds.writable.getWriter();
  var reader = ds.readable.getReader();
  writer.write(data);
  writer.close();
  var chunks = [];
  while (true) { var r = await reader.read(); if (r.done) break; chunks.push(r.value); }
  var total = 0;
  for (var i = 0; i < chunks.length; i++) total += chunks[i].length;
  var result = new Uint8Array(total);
  var off = 0;
  for (var i = 0; i < chunks.length; i++) { result.set(chunks[i], off); off += chunks[i].length; }
  return result;
}

function _xlsxBuildZip(entries) {
  var parts = [];
  var cdEntries = [];
  for (var ei = 0; ei < entries.length; ei++) {
    var en = entries[ei];
    var nameBuf = new TextEncoder().encode(en.name);
    var data = en.data;
    var crc = _xlsxCrc32(data);
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
  var templateBuf = state._uploadedXlsxBuf;
  // Guard: ensure templateBuf is a valid non-empty ArrayBuffer
  if (!templateBuf || !(templateBuf instanceof ArrayBuffer) || templateBuf.byteLength < 22) {
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
    var lnl = view.getUint16(off + 26, true), lel = view.getUint16(off + 28, true), ds = off + 30 + lnl + lel;
    var raw = new Uint8Array(view.buffer, view.byteOffset + ds, cs);
    var txt = mt === 0 ? new TextDecoder().decode(raw) : (raw[0]===60 ? new TextDecoder().decode(raw) : new TextDecoder().decode(await inflate(raw)));
    entries.push({ name: nm, method: mt, rawData: raw, text: txt, compSize: cs, uncompSize: us });
    p += 46 + nl + el + cl;
  }
  var ss = entries.find(function (x) { return x.name === "xl/sharedStrings.xml"; });
  var sh = entries.find(function (x) { return x.name === "xl/worksheets/sheet1.xml"; });

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
    var cs = cStyle[ref] || "", nc;
    if (typeof val === "number") nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : "") + "><v>" + val + "</v></c>";
    else { var si = addStr(String(val)); nc = '<c r="' + ref + '"' + (cs ? ' s="' + cs + '"' : "") + ' t="s"><v>' + si + "</v></c>"; }
    var rx = new RegExp('<c r="' + ref + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)', "g");
    if (rx.test(xml)) xml = xml.replace(rx, nc);
  }

  // Fill all data from state into cells
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
  var _armorMap={"布衣":[11,1],"皮甲":[11,1],"兽皮甲":[12,1],"鳞甲":[14,1],"胸甲":[14,1],"半身板甲":[15,1],"链甲":[16,0],"板甲":[18,0]};
  var _ac=null;
  var _eqArmor=(state.equipment&&state.equipment["防具"])||[];
  for(var _ai=0;_ai<_eqArmor.length;_ai++){
    var _an=_eqArmor[_ai]; var _ai2=null;
    if(_armorMap[_an])_ai2=_armorMap[_an];
    else{for(var _k in _armorMap){if(_an.indexOf(_k)>=0){_ai2=_armorMap[_k];break;}}}
    if(_ai2){var _ac2=_ai2[0]+(_ai2[1]?_dexMod:0);if(_ac===null||_ac2>_ac)_ac=_ac2;}
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
  if (state.traits) set("H18", state.traits);
  if (state.personality) set("H21", state.personality);
  if (state.ideals) set("H24", state.ideals);
  if (state.bonds) set("H27", state.bonds);
  if (state.flaws) set("H30", state.flaws);

  // Proficiencies
  if (state.profs) {
    // Build E column label -> G cell mapping from template
    var profMap = {};
    var profRe = /<c r="E(\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g;
    while ((m = profRe.exec(xml)) !== null) {
      var rowNum = parseInt(m[1]);
      var si = parseInt(m[2]);
      if (si < strings.length) profMap[strings[si]] = rowNum;
    }
    for (var pk in state.profs) {
      var pv = state.profs[pk];
      if (!pv || typeof pv !== "object") continue;
      for (var sk in pv) {
        var sv = pv[sk];
        if (sv === 0 || sv === undefined || sv === false) continue;
        var targetRow = profMap[sk];
        if (targetRow) set("G" + targetRow, sv);
      }
    }
  }

  // Feats
  if (state.special_feats && state.special_feats.length > 0) {
    var fl = state.special_feats;
    if (fl[0]) set("K36", fl[0].n || fl[0]);
    if (fl[1]) set("K38", fl[1].n || fl[1]);
    if (fl[2]) set("K40", fl[2].n || fl[2]);
    if (fl[3]) set("K42", fl[3].n || fl[3]);
  }

  // Currency
  if (state.currency) {
    set("O36", String(state.currency["金币"] || 0));
    set("O38", String(state.currency["银币"] || 0));
    set("O40", String(state.currency["铜币"] || 0));
  }

  // Equipment
  if (state.equipment) {
    var eqSlots = [
      { zone: "主手武器", row: 50, col: "B" }, { zone: "副手武器", row: 50, col: "D" },
      { zone: "防具", row: 50, col: "F" },
      { zone: "背包", row: 61, col: "F" }, { zone: "旅行腰包", row: 72, col: "F" },
      { zone: "配饰", row: 78, col: "F" }
    ];
    for (var ei = 0; ei < eqSlots.length; ei++) {
      var slot = eqSlots[ei];
      var items = state.equipment[slot.zone] || [];
      if (items.length > 0) {
        for (var ii = 0; ii < items.length && slot.row + ii <= 100; ii++) {
          var itemName = items[ii];
          if (typeof itemName === 'object') itemName = itemName.item || itemName.name || '';
          if (itemName) set(slot.col + (slot.row + ii), String(itemName));
        }
      }
    }
  }

  // Racial traits
  if (state.racial_traits && state.racial_traits.length > 0) {
    for (var ri = 0; ri < Math.min(state.racial_traits.length, 8); ri++) {
      var rt = state.racial_traits[ri];
      set("I" + (112 + ri), rt.n || rt.name || rt);
      if (rt.d || rt.desc || rt.effect) set("K" + (112 + ri), rt.d || rt.desc || rt.effect || "");
    }
  }

  // Class features
  if (state.class_features && state.class_features.length > 0) {
    for (var ci = 0; ci < Math.min(state.class_features.length, 8); ci++) {
      var cf = state.class_features[ci];
      set("O" + (112 + ci), cf.n || cf.name || cf);
      if (cf.d || cf.desc || cf.effect) set("Q" + (112 + ci), cf.d || cf.desc || cf.effect || "");
    }
  }

  // Skills (B-M columns, rows 123-162)
  var mainSkills = (state.skills || []).filter(function (s) { return !s.sub || s.sub === ""; });
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

  // Talents (O column, rows 123-147 + 150-165)
  var talents = state.talent_tree || [];

  // Group talents by tier and fill in appropriate rows
  // The template has: 一阶(123-127), 二阶(129-133), 三阶(136-140), 四阶(143-147), 五阶(150-154), 六阶(157-161), 七阶(164-165)
  var tierRowMap = {
    "一阶": [123, 127], "二阶": [129, 133], "三阶": [136, 140],
    "四阶": [143, 147], "五阶": [150, 154], "六阶": [157, 161], "七阶": [164, 165]
  };

  for (var ti = 0; ti < talents.length; ti++) {
    var t = talents[ti];
    var tName = t.n || t.name || "";
    var tTier = t.tier || "";
    tTier = tTier.replace(/天赋树.*$/, "").replace(/[（(]\d+[）)]/, "");
    if (!tTier || tTier.indexOf("阶") < 0) {
      // Try SKILL_TIER
      tTier = SKILL_TIER[tName] || "";
      tTier = tTier.replace(/天赋树.*$/, "").replace(/[（(]\d+[）)]/, "");
    }
    if (!tTier || tTier.indexOf("阶") < 0) tTier = "一阶";

    var rowRange = tierRowMap[tTier];
    if (rowRange) {
      // Find first empty O cell in this range
      for (var tr = rowRange[0]; tr <= rowRange[1]; tr++) {
        // Check if already filled
        var alreadyFilled = false;
        for (var ac = 0; ac < ti; ac++) {
          // We can't easily check without remembering what we wrote
          // Simple approach: just fill sequentially
        }
        // Just fill the first available spot - actually this is getting complex
        // Let me just use ti as an offset within its tier
      }
      // Simpler: just fill in order by tier
    }
  }

  // For now, simpler talent filling - just take all talents and fill O rows 123+ sequentially, skipping tier header rows
  var talentRows = [123, 124, 125, 126, 127, 129, 130, 131, 132, 133, 136, 137, 138, 139, 140, 143, 144, 145, 146, 147, 150, 151, 152, 153, 154, 157, 158, 159, 160, 161, 164, 165];
  for (var ti = 0; ti < Math.min(talents.length, talentRows.length); ti++) {
    set("O" + talentRows[ti], talents[ti].n || talents[ti].name || "");
  }

  // Subclass skills (rows 168-209)
  var subSkills = (state.skills || []).filter(function (s) { return s.sub && s.sub !== ""; });
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
  if (state.sp) {
    var spStr = [];
    var spc = ["橙色", "白色", "紫色", "黄色", "无色", "蓝色", "青色", "黑色", "红色", "棕色", "粉色", "绿色", "浅色", "炫彩"];
    for (var spi = 0; spi < spc.length; spi++) {
      var scnt = state.sp[spc[spi]] || 0;
      for (var sc = 0; sc < scnt; sc++) spStr.push(spc[spi].substring(0, 1));
    }
    if (spStr.length > 0) set("U51", spStr.join(""));
  }

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
      en.rawData = await _xlsxDeflate(b);
      en.compSize = en.rawData.length;
      en.uncompSize = b.length;
      en.method = 8;
    }
  }

  
      if (typeof injectPortrait === "function") injectPortrait(state, entries);
// Convert entries to ZIP format
  var zipEntries = [];
  for (var ei = 0; ei < entries.length; ei++) {
    var en = entries[ei];
    zipEntries.push({ name: en.name, data: en.rawData, method: en.method, compSize: en.compSize, uncompSize: en.uncompSize });
  }

  var zipBytes = _xlsxBuildZip(zipEntries);
  var fileName = (state.name || "角色") + "_角色档案.xlsx";
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
    location.href='角色选择页.html';
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

