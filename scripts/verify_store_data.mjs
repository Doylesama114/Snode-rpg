// 校验 斯诺德跑团/store_data.js 数据质量（发版检查用）
// 用法: node scripts/verify_store_data.mjs
import fs from 'node:fs';

const SRC = '斯诺德跑团/store_data.js';
const js = fs.readFileSync(SRC, 'utf8');
const data = new Function(js + '; return STORE_DATA;')();

const errors = [];
const warnings = [];
let total = 0;

for (const [cat, items] of Object.entries(data)) {
  const seen = new Set();
  for (const it of items) {
    total++;
    const name = it.name || '';
    if (!name) { errors.push(`[${cat}] 空名称条目`); continue; }
    if (name === '名称') errors.push(`[${cat}] 表头泄漏条目`);
    if (seen.has(name)) errors.push(`[${cat}] 重复名称: ${name}`);
    seen.add(name);
    if (!it.price) warnings.push(`[${cat}] ${name}: 无价格`);
    const w = it.weight || '';
    if (w && /[金银铜]币/.test(w)) errors.push(`[${cat}] ${name}: 载重为货币值: ${w}`);
    if (!it.cat) warnings.push(`[${cat}] ${name}: 无小类`);
  }
}

console.log(`大类 ${Object.keys(data).length} 个，条目 ${total} 条`);
if (warnings.length) {
  console.log(`警告 ${warnings.length} 条:`);
  warnings.forEach(w => console.log('  -', w));
}
if (errors.length) {
  console.log(`FAIL: 错误 ${errors.length} 条:`);
  errors.forEach(e => console.log('  -', e));
  process.exit(1);
}
console.log('OK: 数据质量校验通过');
