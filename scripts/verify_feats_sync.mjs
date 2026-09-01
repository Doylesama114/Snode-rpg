// 特殊专长一致性校验：职业页/特殊专长.html（100 条权威） vs 斯诺德跑团/panel_data.js SPECIAL_FEATS
// 检查：键集一致、无残留旧键（质朴/额外槽位）、分类一致、前置条件一致、效果文本一致
// 用法：node scripts/verify_feats_sync.mjs   （exit 0 = 通过；1 = 有差异）
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML_PATH = "职业页/特殊专长.html";
const DATA_PATH = "斯诺德跑团/panel_data.js";
const LEGACY_KEYS = ["质朴", "额外槽"];
// 页面 cond-text 异常、面板侧人工校正的前置条件（页面为错数据时使用）
const PREQ_OVERRIDES = {
  "鲜明特点": "你开启了个性背景的特殊效果",
  "无信者": "你的职业构成中没有圣骑士、牧师和魔契师职业"
};

const problems = [];
function fail(msg) { problems.push(msg); }

// 1. 解析页面 article
const html = readFileSync(HTML_PATH, "utf8");
const pageFeats = {};
{
  const artRe = /<article class="skill" id="feat-\d+"[\s\S]*?<\/article>/g;
  let m;
  while ((m = artRe.exec(html)) !== null) {
    const art = m[0];
    const catM = /data-category="([^"]+)"/.exec(art);
    const nameM = /<h4>([^<]+?) <span class="chip"/.exec(art);
    const condM = /<div class="cond-row">[\s\S]*?<span class="cond-text">([\s\S]*?)<\/span>/.exec(art);
    const effRe = /<div class="effect-cell">([\s\S]*?)<\/div>/g;
    const effects = [];
    let em;
    while ((em = effRe.exec(art)) !== null) effects.push(em[1].trim());
    const noteRe = /<div class="note-cell">([\s\S]*?)<\/div>/g;
    const notes = [];
    let nm;
    while ((nm = noteRe.exec(art)) !== null) notes.push(nm[1].trim());
    if (!nameM) { fail("页面存在无法解析名称的 article: " + art.slice(0, 80)); continue; }
    const name = nameM[1].trim();
    pageFeats[name] = {
      category: catM ? catM[1] : "",
      prereq: condM ? condM[1].trim() : "",
      effects,
      notes
    };
  }
}

// 2. 加载面板数据
const code = readFileSync(DATA_PATH, "utf8");
const sandbox = { JSON, window: {}, document: { title: "" } };
sandbox.window = sandbox;
let panelFeats = {}, panelCats = {};
try {
  vm.runInNewContext(code + "\n;globalThis.__SF = SPECIAL_FEATS;globalThis.__SFC = SPECIAL_FEAT_CATEGORIES;", sandbox, { filename: DATA_PATH });
  panelFeats = sandbox.__SF || {};
  panelCats = sandbox.__SFC || {};
} catch (e) {
  fail("panel_data.js 解析失败: " + String(e.message).slice(0, 200));
}

// 3. 键集一致性
const pageKeys = Object.keys(pageFeats).sort();
const panelKeys = Object.keys(panelFeats).sort();
if (panelKeys.length === 0 && problems.length === 0) fail("SPECIAL_FEATS 为空");
for (const k of LEGACY_KEYS) if (panelFeats[k]) fail("残留旧专长键「" + k + "」应从 SPECIAL_FEATS 移除");
for (const pk of panelKeys) if (!pageFeats[pk]) fail("面板多出专长（页面不存在）: " + pk);
for (const gk of pageKeys) if (!panelFeats[gk]) fail("面板缺失专长: " + gk);

// 4. 分类一致性
if (Object.keys(panelCats).length === 0) fail("SPECIAL_FEAT_CATEGORIES 为空");
for (const pk of panelKeys) {
  if (!pageFeats[pk]) continue;
  if (panelCats[pk] !== pageFeats[pk].category) fail("分类不一致: " + pk + " 面板=" + panelCats[pk] + " 页面=" + pageFeats[pk].category);
}

// 5. 前置条件一致性（页面 cond-text 偶有"前置+描述"粘连，面板值为其前缀即视为一致）
for (const pk of panelKeys) {
  if (!pageFeats[pk]) continue;
  const expect = PREQ_OVERRIDES[pk] || pageFeats[pk].prereq;
  const actual = (panelFeats[pk].prerequisite || "").trim();
  if (expect && actual !== expect && !(actual && expect.indexOf(actual) === 0)) fail("前置条件不一致: " + pk + " 面板=" + actual.slice(0, 30) + " 页面=" + expect.slice(0, 30));
}

// 6. 效果文本一致性（仅 description_only 专长校验：页面 effect-cell 首 12 字须出现在面板描述中）
for (const pk of panelKeys) {
  if (!pageFeats[pk]) continue;
  const ftype = panelFeats[pk].effects && panelFeats[pk].effects.type;
  if (ftype !== "description_only") continue;
  const desc = (panelFeats[pk].effects && panelFeats[pk].effects.description) || "";
  const cells = pageFeats[pk].effects;
  if (cells.length === 0) continue;
  for (const cell of cells) {
    const probe = cell.replace(/\s+/g, "").slice(0, 12);
    if (probe && desc.replace(/\s+/g, "").indexOf(probe) < 0) fail("效果文本缺失: " + pk + " 面板描述缺「" + cell.slice(0, 18) + "…」");
  }
  for (const note of pageFeats[pk].notes) {
    const probe = note.replace(/\s+/g, "").slice(0, 12);
    if (probe && desc.replace(/\s+/g, "").indexOf(probe) < 0) fail("备注文本缺失: " + pk + " 面板描述缺「" + note.slice(0, 18) + "…」");
  }
}

console.log("页面专长 " + pageKeys.length + " 条 / 面板专长 " + panelKeys.length + " 条");
if (problems.length === 0) {
  console.log("✅ 特殊专长一致性通过（键集/分类/前置/效果文本）");
  process.exit(0);
} else {
  for (const p of problems) console.log("  ❌ " + p);
  console.log("共 " + problems.length + " 处差异");
  process.exit(1);
}
