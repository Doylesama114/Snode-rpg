import fs from 'node:fs';
import path from 'node:path';
const DRY = process.argv.includes('--dry-run');
const ROOT = process.cwd();
const PAGE_DIR = path.join(ROOT, '职业页');
const DATA = path.join(PAGE_DIR, 'hp_calc_data.js');
const log = [];
const names = [];
const dataSrc = fs.readFileSync(DATA, 'utf8');
const m = dataSrc.match(/var SNOWD_HP_SRC = \{/);
if (!m) { console.log('FAIL 无法解析 hp_calc_data.js'); process.exit(1); }
const classesJson = dataSrc.match(/classes: (\{.*?\}),\n  races:/s);
if (!classesJson) { console.log('FAIL 无法提取 classes'); process.exit(1); }
const classes = JSON.parse(classesJson[1]);
Object.keys(classes).forEach(k => names.push(k));
console.log('职业数: ' + names.length + ' → ' + names.join('、'));
let ok = 0, skip = 0, fail = 0;
names.forEach(name => {
  const file = path.join(PAGE_DIR, name + '.html');
  if (!fs.existsSync(file)) { console.log('  FAIL ' + name + ' 页面不存在'); fail++; return; }
  let html = fs.readFileSync(file, 'utf8');
  const hasBom = html.charCodeAt(0) === 0xFEFF;
  const already = html.indexOf('hp_calc.js') >= 0;
  const pm = html.match(/id="([a-z0-9]+)-class-features"/);
  if (!pm) { console.log('  FAIL ' + name + ' 未找到 -class-features 锚点'); fail++; return; }
  const prefix = pm[1];
  if (already) { console.log('  SKIP ' + name + '（已是新版 · 前缀 ' + prefix + '）'); skip++; return; }
  const secStart = html.indexOf('<section class="class-features" id="' + prefix + '-class-features"');
  if (secStart < 0) { console.log('  FAIL ' + name + ' 未找到职业专长 section'); fail++; return; }
  const secEnd = html.indexOf('</section>', secStart) + '</section>'.length;
  const navAnchor = '<a class="style-link" href="#' + prefix + '-class-features">职业专长</a>';
  const navPos = html.indexOf(navAnchor);
  if (navPos < 0) { console.log('  FAIL ' + name + ' 未找到导航锚点'); fail++; return; }
  const block = '\n<section class="hpcalc" id="' + prefix + '-hpcalc" aria-label="血量与疲劳计算器">\n  <div id="' + prefix + '-hpcalc-mount"></div>\n</section>\n';
  const navAdd = navAnchor + '\n      <a class="style-link" href="#' + prefix + '-hpcalc">血量/疲劳计算器</a>';
  const scripts = '\n<link rel="stylesheet" href="hp_calc.css?v=1.0.8055"/>\n' +
    '<script src="hp_calc_data.js"></script>\n' +
    '<script src="../斯诺德跑团/character_stats.js"></script>\n' +
    '<script src="hp_calc.js"></script>\n' +
    '<script>SnowdHpCalc.mount(document.getElementById("' + prefix + '-hpcalc-mount"), "' + name + '");</script>\n';
  if (DRY) {
    console.log('  DRY  ' + name + '（前缀 ' + prefix + '）区块插入于第 ' + (html.slice(0, secEnd).split('\n').length) + ' 行后 · 导航于第 ' + (html.slice(0, navPos).split('\n').length) + ' 行 · 脚本于 </body> 前' + (hasBom ? ' ⚠ 检测到 BOM' : ''));
    ok++;
    return;
  }
  /* 依序插入：先脚本（末尾），再区块，再导航（避免位置漂移） */
  const bodyIdx = html.lastIndexOf('</body>');
  if (bodyIdx < 0) { console.log('  FAIL ' + name + ' 未找到 </body>'); fail++; return; }
  html = html.slice(0, bodyIdx) + scripts + html.slice(bodyIdx);
  const s2 = html.indexOf('<section class="class-features" id="' + prefix + '-class-features"');
  const e2 = html.indexOf('</section>', s2) + '</section>'.length;
  html = html.slice(0, e2) + block + html.slice(e2);
  html = html.replace(navAnchor, navAdd, 1);
  /* 断言 */
  const checks = [
    ['区块', html.indexOf('id="' + prefix + '-hpcalc-mount"') >= 0],
    ['导航', html.indexOf('href="#' + prefix + '-hpcalc"') >= 0],
    ['脚本4行', (html.match(/hp_calc\.js|hp_calc_data\.js|character_stats\.js|hp_calc\.css/g) || []).length >= 4],
    ['挂载名', html.indexOf('\"' + name + '\");</script>') >= 0],
    ['插入内容无BOM', scripts.indexOf('\uFEFF') < 0 && block.indexOf('\uFEFF') < 0],
  ];
  const bad = checks.filter(c => !c[1]).map(c => c[0]);
  if (bad.length) { console.log('  FAIL ' + name + ' 断言未过: ' + bad.join(',')); fail++; return; }
  if (html.indexOf('\uFEFF') >= 0 && html.charCodeAt(0) !== 0xFEFF) { /* 中间有 BOM 字面量不处理 */ }
  fs.writeFileSync(file, html, 'utf8');
  console.log('  OK   ' + name + '（前缀 ' + prefix + '）');
  ok++;
});
console.log('');
console.log((DRY ? '[干跑] ' : '[正式] ') + '成功 ' + ok + ' · 跳过 ' + skip + ' · 失败 ' + fail);
if (fail) process.exitCode = 1;
