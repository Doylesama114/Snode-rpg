// bump-version.js — 统一更新所有文件中的版本号
// 用法: node bump-version.js 1.0.514
const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) { console.error('用法: node bump-version.js 1.0.514'); process.exit(1); }

const ROOT = __dirname;

// 文件列表及替换规则
const files = [
  {
    path: path.join(ROOT, '斯诺德跑团', '启动台.html'),
    rules: [
      [/v\d+\.\d+(\.\d+)?(?="|<)/, 'v' + newVersion],           // HTML span
      [/APP_VERSION\s*=\s*'[\d.]+'/, "APP_VERSION = '" + newVersion + "'"],  // JS var
    ]
  },
  {
    path: path.join(ROOT, 'electron-app', 'package.json'),
    rules: [
      [/"version"\s*:\s*"[\d.]+"/, '"version": "' + newVersion + '"'],
    ]
  },
];

for (let f of files) {
  if (!fs.existsSync(f.path)) { console.warn('SKIP: ' + f.path); continue; }
  let content = fs.readFileSync(f.path, 'utf8');
  for (let [pattern, replacement] of f.rules) {
    content = content.replace(pattern, replacement);
  }
  fs.writeFileSync(f.path, content, 'utf8');
  console.log('OK: ' + path.relative(ROOT, f.path));
}

// 同步到 electron-app
const dirs = ['斯诺德跑团', '职业页'];
for (let d of dirs) {
  const src = path.join(ROOT, d);
  const dst = path.join(ROOT, 'electron-app', d);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dst, { recursive: true, force: true });
    console.log('SYNC: ' + d + ' → electron-app/' + d);
  }
}

console.log('\n✅ 版本已更新到 v' + newVersion);
console.log('   git add -A && git commit -m "bump: v' + newVersion + '"');
console.log('   git tag v' + newVersion + ' && git push origin master --tags');
