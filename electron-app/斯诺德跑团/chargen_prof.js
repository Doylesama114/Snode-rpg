/**
 * 角色创建：熟练项正式键解析 / 写入 / 概览专精名收集
 * 依赖（可选）：全局 BG_SKILL_MAP、SKILL_CATS；缺失时用内置表。
 */
var CHAR_GEN_SKILL_ATTR_MAP = {
  "威力": "力量", "运动": "力量", "运动-跳跃": "力量", "运动-攀爬": "力量", "运动-游泳": "力量", "运动-自定义": "力量", "承重": "力量",
  "体操": "敏捷", "骑乘": "敏捷", "隐匿": "敏捷", "巧手": "敏捷", "巧手-偷窃": "敏捷", "巧手-开锁": "敏捷", "巧手-拆除": "敏捷", "巧手-自定义": "敏捷",
  "专注": "体质", "耐力": "体质",
  "调查": "智力", "逻辑": "智力", "宗教": "智力", "估价": "智力", "伪造": "智力", "读唇": "智力",
  "奥秘": "智力", "奥秘-魔法学识": "智力", "奥秘-炼金术": "智力", "奥秘-神奇道具": "智力", "奥秘-多元宇宙": "智力",
  "知识": "智力", "知识-历史": "智力", "知识-地理": "智力", "知识-人文": "智力", "知识-政治": "智力", "知识-神秘学": "智力",
  "知识-工程学": "智力", "知识-珠宝学": "智力", "知识-草药学": "智力", "知识-医药": "智力", "知识-烹饪": "智力", "知识-自定义": "智力",
  "工程学": "智力", "医药": "智力", "历史": "智力", "地理": "智力", "人文": "智力", "政治": "智力",
  "神秘学": "智力", "草药学": "智力", "烹饪": "智力", "珠宝学": "智力",
  "洞悉": "感知", "导航": "感知", "自然": "感知", "驯兽": "感知", "感悟": "感知", "聆听": "感知", "察觉": "感知",
  "欺瞒": "魅力", "说服": "魅力", "表演": "魅力", "表演-歌唱": "魅力", "表演-舞蹈": "魅力", "表演-演奏": "魅力", "表演-自定义": "魅力", "恐吓": "魅力",
  "求生": "意志", "激励": "意志", "决策": "意志",
  "机遇": "幸运", "探索": "幸运"
};

/** 别名 → 正式键（与创建页 BG_SKILL_MAP 中非 cat 项对齐；优先用全局 BG_SKILL_MAP） */
var CHAR_GEN_PROF_ALIASES = {
  "医药": "智力.知识-医药", "炼金": "智力.奥秘-炼金术", "草药学": "智力.知识-草药学",
  "开锁": "敏捷.巧手-开锁", "烹饪": "智力.知识-烹饪", "地理": "智力.知识-地理",
  "多元宇宙": "智力.奥秘-多元宇宙", "魔法学识": "智力.奥秘-魔法学识", "神奇道具": "智力.奥秘-神奇道具",
  "历史": "智力.知识-历史", "人文": "智力.知识-人文", "政治": "智力.知识-政治",
  "神秘学": "智力.知识-神秘学", "工程学": "智力.知识-工程学", "珠宝学": "智力.知识-珠宝学",
  "歌唱": "魅力.表演-歌唱", "舞蹈": "魅力.表演-舞蹈", "演奏": "魅力.表演-演奏",
  "偷窃": "敏捷.巧手-偷窃", "拆除": "敏捷.巧手-拆除",
  "跳跃": "力量.运动-跳跃", "攀爬": "力量.运动-攀爬", "游泳": "力量.运动-游泳",
  "威力": "力量.威力", "承重": "力量.承重", "骑乘": "敏捷.骑乘", "读唇": "智力.读唇", "激励": "意志.激励",
  "体操": "敏捷.体操", "隐匿": "敏捷.隐匿", "专注": "体质.专注", "耐力": "体质.耐力",
  "宗教": "智力.宗教", "洞悉": "感知.洞悉", "欺瞒": "魅力.欺瞒", "伪造": "智力.伪造",
  "调查": "智力.调查", "逻辑": "智力.逻辑", "估价": "智力.估价",
  "察觉": "感知.察觉", "说服": "魅力.说服", "求生": "意志.求生", "恐吓": "魅力.恐吓",
  "驯兽": "感知.驯兽", "导航": "感知.导航", "自然": "感知.自然", "感悟": "感知.感悟", "聆听": "感知.聆听",
  "机遇": "幸运.机遇", "探索": "幸运.探索", "决策": "意志.决策"
};

var CHAR_GEN_PROF_CATS = {
  "运动": ["运动-跳跃", "运动-攀爬", "运动-游泳"],
  "奥秘": ["奥秘-魔法学识", "奥秘-炼金术", "奥秘-神奇道具", "奥秘-多元宇宙"],
  "知识": ["知识-历史", "知识-地理", "知识-人文", "知识-政治", "知识-神秘学", "知识-工程学", "知识-珠宝学", "知识-草药学", "知识-医药", "知识-烹饪"],
  "巧手": ["巧手-偷窃", "巧手-开锁", "巧手-拆除"],
  "表演": ["表演-歌唱", "表演-舞蹈", "表演-演奏"]
};

/**
 * @returns {{attr:string,key:string}|{category:true,name:string}|null}
 */
function resolveProfSkill(name) {
  if (!name) return null;
  // 运动为可加熟练项（背包客等规则），优先于分类表
  if (name === "运动") return { attr: "力量", key: "运动" };
  var cats = (typeof SKILL_CATS !== "undefined" && SKILL_CATS) ? SKILL_CATS : CHAR_GEN_PROF_CATS;
  if (cats[name]) return { category: true, name: name };

  var bgMap = (typeof BG_SKILL_MAP !== "undefined" && BG_SKILL_MAP) ? BG_SKILL_MAP : null;
  if (bgMap && bgMap[name] !== undefined) {
    if (bgMap[name] === "cat") return { category: true, name: name };
    var mp = String(bgMap[name]).split(".");
    if (mp.length === 2 && mp[0] && mp[1]) return { attr: mp[0], key: mp[1] };
  } else if (CHAR_GEN_PROF_ALIASES[name]) {
    var ap = CHAR_GEN_PROF_ALIASES[name].split(".");
    if (ap.length === 2) return { attr: ap[0], key: ap[1] };
  }

  var attr = CHAR_GEN_SKILL_ATTR_MAP[name];
  if (attr) {
    // 其余类别名若未进 cats（兜底）
    if (name === "奥秘" || name === "知识" || name === "巧手" || name === "表演") {
      return { category: true, name: name };
    }
    return { attr: attr, key: name };
  }
  return null;
}

/** 空熟练骨架（与创建存档一致） */
function emptyChargenProfs() {
  return {
    "力量": { "豁免": 0, "威力": 0, "承重": 0, "运动-跳跃": 0, "运动-攀爬": 0, "运动-游泳": 0, "运动-自定义": 0 },
    "敏捷": { "豁免": 0, "体操": 0, "骑乘": 0, "隐匿": 0, "巧手-偷窃": 0, "巧手-开锁": 0, "巧手-拆除": 0, "巧手-自定义": 0 },
    "体质": { "豁免": 0, "专注": 0, "耐力": 0 },
    "智力": { "豁免": 0, "调查": 0, "逻辑": 0, "宗教": 0, "估价": 0, "伪造": 0, "读唇": 0, "奥秘-魔法学识": 0, "奥秘-炼金术": 0, "奥秘-神奇道具": 0, "奥秘-多元宇宙": 0, "知识-历史": 0, "知识-地理": 0, "知识-人文": 0, "知识-政治": 0, "知识-神秘学": 0, "知识-工程学": 0, "知识-珠宝学": 0, "知识-草药学": 0, "知识-医药": 0, "知识-烹饪": 0, "知识-自定义": 0 },
    "感知": { "豁免": 0, "洞悉": 0, "导航": 0, "自然": 0, "驯兽": 0, "感悟": 0, "聆听": 0, "察觉": 0 },
    "魅力": { "豁免": 0, "欺瞒": 0, "说服": 0, "表演-歌唱": 0, "表演-舞蹈": 0, "表演-演奏": 0, "表演-自定义": 0, "恐吓": 0 },
    "意志": { "豁免": 0, "求生": 0, "激励": 0, "决策": 0 },
    "幸运": { "豁免": 0, "机遇": 0, "探索": 0 }
  };
}

/**
 * 将 name 解析后 +1 到 profs；不创建 ghost key。
 * @param {object} preferAttr 可选，运动健将等 UI 已选属性（名称能 resolve 时以 resolve 为准）
 * @returns {boolean} 是否写入成功
 */
function applyResolvedProf(profs, name, preferAttr) {
  if (!profs || !name) return false;
  var r = resolveProfSkill(name);
  if (!r || r.category || !r.key) return false;
  var attr = r.attr || preferAttr;
  if (!attr || !profs[attr]) return false;
  if (profs[attr][r.key] === undefined) profs[attr][r.key] = 0;
  profs[attr][r.key] = (profs[attr][r.key] || 0) + 1;
  return true;
}

/** 概览用：从 specChoices 收集非空 skill 的正式显示名 */
function overviewNamesFromSpecChoices(specChoices) {
  var out = [];
  if (!specChoices) return out;
  for (var sn in specChoices) {
    if (!Object.prototype.hasOwnProperty.call(specChoices, sn)) continue;
    var ch = specChoices[sn];
    if (!ch || !ch.skill) continue;
    var r = resolveProfSkill(ch.skill);
    out.push((r && r.key) ? r.key : ch.skill);
  }
  return out;
}

/** 判断芯片「原文选项」是否已在 selectedSkills 中（含别名→正式键） */
function isChargenSkillSelected(optionName, selectedSkills) {
  if (!selectedSkills || !selectedSkills.length) return false;
  if (selectedSkills.indexOf(optionName) >= 0) return true;
  var r = resolveProfSkill(optionName);
  if (r && r.key && selectedSkills.indexOf(r.key) >= 0) return true;
  var cats = (typeof SKILL_CATS !== "undefined" && SKILL_CATS) ? SKILL_CATS : CHAR_GEN_PROF_CATS;
  if (cats[optionName]) {
    var subs = cats[optionName];
    for (var i = 0; i < subs.length; i++) {
      if (selectedSkills.indexOf(subs[i]) >= 0) return true;
    }
  }
  return false;
}

/** toggle 时写入用的正式键；类别返回 null（应弹窗） */
function canonicalSkillPickName(optionName) {
  var r = resolveProfSkill(optionName);
  if (!r || r.category) return null;
  return r.key || optionName;
}


/** 职业创建页第 5 步：职业熟练项数量（docx：从选项中选择四项各+1） */
var CHAR_GEN_CLASS_SKILL_PICK_COUNT = 4;

/** 解析「从……中选择」的职业熟练项原文（与创建页 parseSkills 同口径） */
function parseClassSkillOptions(txt) {
  if (!txt) return [];
  txt = String(txt);
  var m = txt.match(/从(.+?)中/);
  if (!m) {
    return txt.split(/[、,，]/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0 && s.indexOf("选择") < 0; });
  }
  return m[1].split(/[、,，]/).map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

/**
 * 当前职业熟练项选择信息。
 * @returns {{options:string[], validMap:Object<string,boolean>, validNames:string[]}}
 */
function getClassSkillOptionInfo(classData) {
  var txt = (classData && (classData["技巧"] || classData.skills)) || "";
  var options = parseClassSkillOptions(txt);
  var cats = (typeof SKILL_CATS !== "undefined" && SKILL_CATS) ? SKILL_CATS : CHAR_GEN_PROF_CATS;
  var validMap = {};
  var validNames = [];
  var i, j, opt, key, subs, r;
  for (i = 0; i < options.length; i++) {
    opt = options[i];
    // 父级大类自身也算合法（兼容旧草稿直接存「知识」等）
    if (validMap[opt] !== true) { validMap[opt] = true; validNames.push(opt); }
    if (cats[opt]) {
      subs = cats[opt];
      for (j = 0; j < subs.length; j++) {
        key = subs[j];
        if (validMap[key] !== true) { validMap[key] = true; validNames.push(key); }
      }
    } else {
      r = resolveProfSkill(opt);
      key = (r && r.key) ? r.key : opt;
      if (key !== opt && validMap[key] !== true) { validMap[key] = true; validNames.push(key); }
    }
  }
  return { options: options, validMap: validMap, validNames: validNames };
}

/** 判断某项是否属于当前职业的可选熟练项（含别名→正式键） */
function isClassSkillPickValid(pick, classData) {
  if (!pick) return false;
  var info = getClassSkillOptionInfo(classData);
  if (info.validMap[pick] === true) return true;
  var r = resolveProfSkill(pick);
  if (r && r.key && info.validMap[r.key] === true) return true;
  return false;
}

/** 过滤当前职业不合法项与重复项，保持原顺序 */
function filterValidClassSkillPicks(selectedSkills, classData) {
  var out = [];
  if (!selectedSkills || !selectedSkills.length) return out;
  var seen = {};
  for (var i = 0; i < selectedSkills.length; i++) {
    var pick = selectedSkills[i];
    if (!isClassSkillPickValid(pick, classData)) continue;
    if (seen[pick] === true) continue;
    seen[pick] = true;
    out.push(pick);
  }
  return out;
}

/** 职业熟练项是否已完成：无选项的职业视为完成，否则需恰好选满 4 项合法项 */
function classSkillPicksComplete(selectedSkills, classData) {
  var info = getClassSkillOptionInfo(classData);
  if (!info.options.length) return true;
  return filterValidClassSkillPicks(selectedSkills, classData).length === CHAR_GEN_CLASS_SKILL_PICK_COUNT;
}
