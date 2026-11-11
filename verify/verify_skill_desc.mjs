import fs from 'node:fs';
import path from 'node:path';
/** 技能描述数据块防复发校验：比对 docx 期望快照与 6 类目标文件 */
const ROOT = process.cwd();
const EXPECT = path.join(ROOT, 'scripts', 'skill_desc_expect.json');
if (!fs.existsSync(EXPECT)) { console.log('  跳过：未找到 scripts/skill_desc_expect.json'); process.exit(0); }
const blocks = JSON.parse(fs.readFileSync(EXPECT, 'utf8')).blocks || [];
const PUNCT = ' \t·▲●◆■□★☆（）()、，,。.；;：:》〉[]【】';
const flat = (s) => Array.from(s).filter((c) => PUNCT.indexOf(c) < 0).join('');
const cache = {};
function text(p) {
  const abs = path.join(ROOT, p);
  if (!(p in cache)) cache[p] = fs.existsSync(abs) ? flat(fs.readFileSync(abs, 'utf8')) : null;
  return cache[p];
}
let pass = 0, fail = 0;
const targetsFor = (cls) => ['斯诺德跑团/skill_effects_' + cls + '.json', '职业页/数据/' + cls + '.json', '职业页/' + cls + '.json', '职业页/' + cls + '.html', '职业页/search-index.js'];
const missing = [];
for (const b of blocks) {
  const key = flat(b.lines[0]).slice(0, 14);
  for (const p of targetsFor(b.cls)) {
    const t = text(p);
    if (t === null) continue;                      // 该目标不存在（如职业页/<cls>.json）→ 跳过
    if (t.indexOf(key) < 0) missing.push(b.cls + '/' + b.name + ' → ' + p);
  }
}
if (missing.length === 0) { pass++; console.log('  PASS 技能数据块在全部目标文件中完整（' + blocks.length + ' 个技能）'); }
else { fail++; console.log('  FAIL 技能数据块缺失 ' + missing.length + ' 处'); missing.slice(0, 8).forEach((m) => console.log('       ' + m)); }
console.log('');
console.log('技能描述数据块校验: ' + pass + 'P ' + fail + 'F');
process.exit(fail === 0 ? 0 : 1);
