// build_chargen_adv_paths.mjs — 从 职业页/*·进阶.html 提取各职业进阶途径名
// 生成 斯诺德跑团/chargen_adv_paths.js（window.CHARGEN_ADV_PATHS）
// 用途：角色创建页「期望进阶路线」下拉候选（仅作期望，不影响建卡）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADV_DIR = path.join(ROOT, '职业页');
const OUT = path.join(ROOT, '斯诺德跑团', 'chargen_adv_paths.js');

const CLASS_ORDER = ['蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司', '术士', '武僧', '吟游诗人', '魔契师', '奇械师'];

const result = {};
for (const cls of CLASS_ORDER) {
  const file = path.join(ADV_DIR, `${cls}·进阶.html`);
  if (!fs.existsSync(file)) { console.warn(`SKIP (missing): ${cls}·进阶.html`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const names = new Set();
  // 进阶卡片：<article data-name="..." class="adv-card" ...>（属性顺序不固定，双模式匹配）
  const re1 = /<article\b[^>]*\bclass="[^"]*\badv-card\b[^"]*"[^>]*>/g;
  const re2 = /<article\b[^>]*\bdata-name="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re1.exec(html)) !== null) {
    const dm = m[0].match(/\bdata-name="([^"]+)"/);
    if (dm) names.add(dm[1]);
  }
  while ((m = re2.exec(html)) !== null) {
    if (m[0].indexOf('adv-card') >= 0 || /class="[^"]*adv-card/.test(m[0])) names.add(m[1]);
  }
  if (names.size === 0) { console.warn(`WARN (no adv-card): ${cls}·进阶.html`); continue; }
  result[cls] = [...names];
  console.log(`${cls}: ${result[cls].length} 条（${result[cls].slice(0, 6).join('/')}${result[cls].length > 6 ? '…' : ''}）`);
}

const js = `// 自动生成 — scripts/build_chargen_adv_paths.mjs（勿手改）
// 各职业进阶途径候选（来自 职业页/*·进阶.html 的 adv-card）
window.CHARGEN_ADV_PATHS = ${JSON.stringify(result, null, 0)};
`;
fs.writeFileSync(OUT, js, 'utf8');
console.log(`\n✅ 已生成 ${path.relative(ROOT, OUT)}（${Object.keys(result).length} 职业）`);
