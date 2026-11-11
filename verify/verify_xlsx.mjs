import * as XLSX from 'xlsx';
import * as fs from 'fs';

function cn(v) {
  if (v == null || v === "") return 0;
  if (typeof v === 'number') return v;
  var n = parseInt(v);
  return isNaN(n) ? 0 : n;
}

function findCellFuzzy(sheet, keywords) {
  for (var k in sheet) {
    var v = String(sheet[k]?.v ?? '');
    for (var i = 0; i < keywords.length; i++) {
      if (v.includes(keywords[i])) return k;
    }
  }
  return null;
}

function findCell(sheet, text) {
  return findCellFuzzy(sheet, [text]);
}

function readRight(sheet, ref, maxCols) {
  if (!ref) return "";
  var col = ref.charCodeAt(0);
  var row = parseInt(ref.substring(1));
  for (var o = 1; o <= (maxCols || 3); o++) {
    var cellRef = String.fromCharCode(col + o) + row;
    var v = sheet[cellRef]?.v;
    if (v != null && v !== "") return String(v);
  }
  return "";
}

function readRightNum(sheet, ref, maxCols) {
  if (!ref) return 0;
  var col = ref.charCodeAt(0);
  var row = parseInt(ref.substring(1));
  for (var o = 1; o <= (maxCols || 3); o++) {
    var cellRef = String.fromCharCode(col + o) + row;
    var v = sheet[cellRef]?.v;
    if (v != null && v !== "") {
      var n = parseInt(v);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function scanLabel(sheet, keywords, maxCols) {
  return readRight(sheet, findCellFuzzy(sheet, keywords), maxCols || 3);
}

function scanLabelNum(sheet, keywords, maxCols) {
  return readRightNum(sheet, findCellFuzzy(sheet, keywords), maxCols || 3);
}

var CLASS_NAMES = ["蛮斗士", "战士", "法师", "猎人", "牧师", "圣骑士", "游荡者", "德鲁伊", "萨满祭司", "术士", "武僧", "吟游诗人", "魔契师", "奇械师"];

function stripParens(s) {
  return s.replace(/[（(][^)）]*[)）]/g, "").trim();
}

function findClassName(s) {
  if (!s) return "";
  var clean = stripParens(s);
  for (var i = 0; i < CLASS_NAMES.length; i++) {
    if (clean.includes(CLASS_NAMES[i]) || CLASS_NAMES[i].includes(clean)) return CLASS_NAMES[i];
  }
  return clean;
}

function scanAttrsHorizontal(sheet) {
  var attrs = {};
  var names = ["力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运"];
  for (var k in sheet) {
    for (var i = 0; i < names.length; i++) {
      var v = String(sheet[k]?.v ?? '');
      if (v === names[i]) {
        var m = k.match(/^([A-Z]+)(\d+)$/);
        if (!m) continue;
        var col = m[1], row = parseInt(m[2]);
        var rightCol = String.fromCharCode(col.charCodeAt(0) + 1) + row;
        var n = cn(sheet[rightCol]?.v);
        if (n) attrs[names[i]] = n;
      }
    }
  }
  return attrs;
}

function extractData(filePath) {
  var wb = XLSX.readFile(filePath);
  var sheetName = wb.SheetNames[0];
  var sheet = wb.Sheets[sheetName];

  var s = {
    player: "", name: "", race: "", gender: "", age: "", height: "", weight: "",
    attrs: {},
    classes: [{ name: "", level: 0, styles: [] }, { name: "", level: 0, styles: [] }, { name: "", level: 0, styles: [] }],
    skills: [], talent_tree: [], languages: [],
    hp: 0, fp: 0, story: "", personality: "", traits: "",
  };

  s.player = scanLabel(sheet, ["玩家名称", "玩家名", "姓名"], 2);
  s.name = scanLabel(sheet, ["角色名称", "角色名"], 2);
  s.race = scanLabel(sheet, ["种族"], 2);
  s.race = s.race.replace(/[!！]+$/, "").trim();
  s.gender = scanLabel(sheet, ["性别"], 2);
  s.age = scanLabel(sheet, ["年龄"], 2);
  s.height = scanLabel(sheet, ["身高"], 2);
  s.weight = scanLabel(sheet, ["体重"], 2);

  s.story = scanLabel(sheet, ["故事", "背景故事", "角色故事", "人物背景"], 8);
  s.traits = scanLabel(sheet, ["特性", "个性", "个性特征"], 3);
  s.personality = scanLabel(sheet, ["特点"], 2);

  s.hp = scanLabelNum(sheet, ["生命值", "HP", "血量"], 2);
  s.fp = scanLabelNum(sheet, ["疲劳值", "FP", "疲劳"], 2);

  // Attributes
  var an = ["力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运"];
  for (var ai = 0; ai < an.length; ai++) {
    var av = scanLabelNum(sheet, [an[ai]], 3);
    if (av) s.attrs[an[ai]] = av;
    else s.attrs[an[ai]] = 10;
  }
  var ha = scanAttrsHorizontal(sheet);
  for (var hk in ha) {
    if (ha[hk] && (!s.attrs[hk] || s.attrs[hk] === 10)) s.attrs[hk] = ha[hk];
  }

  // Languages
  var _r = findCellFuzzy(sheet, ["语言", "语言列表"]);
  if (_r) {
    var ls = readRight(sheet, _r, 2);
    if (ls) s.languages = ls.split(/[,，/、]/).map(function (l) { return l.trim(); }).filter(function (l) { return l; });
  }

  // Class info
  var _usedClasses = {};
  _r = findCellFuzzy(sheet, ["主职业", "职业"]);
  if (_r) {
    var rr = parseInt(_r.substring(1));
    for (var ri = rr + 1; ri <= rr + 6; ri++) {
      var _cn = String(sheet["B" + ri]?.v ?? '');
      var cln = findClassName(_cn);
      if (cln && CLASS_NAMES.includes(cln) && !_usedClasses[cln]) {
        _usedClasses[cln] = true;
        s.classes[0].name = cln;
        break;
      }
    }
    for (var ri = rr + 1; ri <= rr + 6; ri++) {
      var lv = cn(sheet["D" + ri]?.v);
      if (lv > 0) { s.classes[0].level = lv; break; }
    }
  }

  _r = findCellFuzzy(sheet, ["子职业", "副职业"]);
  if (_r) {
    var rr2 = parseInt(_r.substring(1));
    for (var ri = rr2 + 1; ri <= rr2 + 6; ri++) {
      var _cn = String(sheet["B" + ri]?.v ?? '');
      var cln = findClassName(_cn);
      if (cln && CLASS_NAMES.includes(cln) && cln !== s.classes[0].name) {
        _usedClasses[cln] = true;
        s.classes[1].name = cln;
        break;
      }
    }
    if (s.classes[1].name === s.classes[0].name) s.classes[1].name = "";
    for (var ri = rr2 + 1; ri <= rr2 + 6; ri++) {
      var lv = cn(sheet["D" + ri]?.v);
      if (lv > 0) { s.classes[1].level = lv; break; }
    }
  }

  // Skills
  _r = findCell(sheet, "技能列表");
  if (_r) {
    var sr = parseInt(_r.substring(1));
    for (var sn = sr + 2; sn < sr + 80; sn++) {
      var sk = String(sheet["B" + sn]?.v ?? '');
      var _otier = String(sheet["O" + sn]?.v ?? '');
      var _kname = String(sheet["K" + sn]?.v ?? '');
      if (_kname && _kname !== "-" && _kname !== "—" && !_kname.includes("阶天赋树") && _kname !== "技能名称") {
        s.skills.push({ n: _kname });
      }
      if (sk && sk !== "-" && sk !== "—" && !sk.includes("天赋树") && sk !== "技能名称" && !sk.includes("子职业") && !sk.includes("施展时间") && !sk.includes("主职业") && !sk.includes("//")) {
        s.skills.push({ n: sk });
      }
      if (!sk && !_otier && !_kname) break;
    }
  }

  // Talents
  var _rt = findCellFuzzy(sheet, ["天赋列表", "天赋树", "天赋"]);
  if (_rt) {
    var tr = parseInt(_rt.substring(1));
    for (var tn = tr + 2; tn < tr + 60; tn++) {
      var tv = String(sheet["B" + tn]?.v ?? '');
      if (!tv || tv === "-" || tv.includes("技能列表")) break;
      var tt = String(sheet["O" + tn]?.v ?? '');
      if (tt && tt.includes("阶天赋树")) continue;
      if (tv && tv !== "-" && !tv.includes("技能")) s.talent_tree.push({ n: tv, tier: "" });
    }
  }

  return s;
}

// Process all 3 files
var files = [
  '基尼泰·梅.xlsx',
  '冒险者角色档案leimi.xlsx',
  '冒险者角色档案fulan.xlsx'
];

for (var fi = 0; fi < files.length; fi++) {
  var file = files[fi];
  console.log('\n========== ' + file + ' ==========');
  try {
    var data = extractData(file);
    console.log('Name:', data.name);
    console.log('Race:', data.race);
    var classes = data.classes.filter(function (c) { return c.name; });
    console.log('Classes:');
    for (var ci = 0; ci < classes.length; ci++) {
      console.log('  - ' + classes[ci].name + ' Lv.' + classes[ci].level);
    }
    console.log('HP:', data.hp);
    console.log('FP:', data.fp);
    console.log('Attrs:', JSON.stringify(data.attrs));
    console.log('Skills count:', data.skills.length);
    console.log('Talents count:', data.talent_tree.length);
    console.log('Languages:', data.languages.join(', '));
    console.log('Traits:', (data.traits || '').substring(0, 40));
    console.log('Personality:', (data.personality || '').substring(0, 40));
    console.log('Story:', (data.story || '').substring(0, 30));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}
