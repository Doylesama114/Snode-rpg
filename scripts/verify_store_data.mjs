// 校验 斯诺德跑团/store_data.js 数据质量（发版检查用）
// 用法: node scripts/verify_store_data.mjs
// 说明：同一大分类下允许「同名不同小类」（原文件里 奇械齿轮/零件包 各出现于两个小类）。
import fs from 'node:fs';

const SRC = '斯诺德跑团/store_data.js';
const js = fs.readFileSync(SRC, 'utf8');
const data = new Function(js + '; return STORE_DATA;')();

const errors = [];
const warnings = [];
let total = 0;
const cover = { desc: 0, quality: 0, cap: 0, price2: 0, extra: 0 };

for (const [cat, items] of Object.entries(data)) {
  const seen = new Set();
  for (const it of items) {
    total++;
    const name = it.name || '';
    if (!name) { errors.push(`[${cat}] 空名称条目`); continue; }
    if (name === '名称') errors.push(`[${cat}] 表头泄漏条目`);
    const key = (it.cat || '') + '\u0001' + name;
    if (seen.has(key)) errors.push(`[${cat}] 重复条目（同小类同名）: ${it.cat || ''}/${name}`);
    seen.add(key);
    if (!it.price) warnings.push(`[${cat}] ${name}: 无价格`);
    const w = it.weight || '';
    if (w && /[金银铜]币/.test(w)) errors.push(`[${cat}] ${name}: 载重为货币值: ${w}`);
    if (!it.cat) warnings.push(`[${cat}] ${name}: 无小类`);
    if (it.price2 && !it.price2Label) warnings.push(`[${cat}] ${name}: 第二价格缺少标签`);
    if (it.cap && !/磅/.test(it.cap)) warnings.push(`[${cat}] ${name}: 负重非重量值: ${it.cap}`);
    for (const k of Object.keys(cover)) if (it[k]) cover[k]++;
  }
}

console.log(`大类 ${Object.keys(data).length} 个，条目 ${total} 条`);
console.log(`字段覆盖：简介/效果 ${cover.desc} ｜ 品质 ${cover.quality} ｜ 负重 ${cover.cap} ｜ 第二价格 ${cover.price2} ｜ 其他附加列 ${cover.extra}`);
if (warnings.length) {
  console.log(`警告 ${warnings.length} 条:`);
  warnings.slice(0, 20).forEach(w => console.log('  -', w));
  if (warnings.length > 20) console.log(`  ... 其余 ${warnings.length - 20} 条`);
}
if (errors.length) {
  console.log(`FAIL: 错误 ${errors.length} 条:`);
  errors.forEach(e => console.log('  -', e));
  process.exit(1);
}
console.log('OK: 数据质量校验通过');
