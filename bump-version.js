// bump-version.js — 统一更新版本号 + 自动写更新日志
// 用法: node bump-version.js 1.0.527 "修复了xxx;新增了yyy"
const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
const changelogMsg = process.argv[3] || '';
if (!newVersion) { console.error('用法: node bump-version.js 1.0.527 "改动1;改动2;改动3"'); process.exit(1); }

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

// 自动追加更新日志
if (changelogMsg) {
  const clPath = path.join(ROOT, 'changelog.js');
  let cl = fs.readFileSync(clPath, 'utf8');
  const changes = changelogMsg.split(';').map(s => s.trim()).filter(Boolean);
  const today = new Date().toISOString().split('T')[0];
  const entry = `\n  {\n    version: '${newVersion}',\n    date: '${today}',\n    changes: [\n${changes.map(c => "      '" + c + "'").join(',\n')}\n    ]\n  },\n`;

  // 在 [ 行之后插入新条目
  const lines = cl.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '[') {
      lines.splice(i + 1, 0, entry);
      break;
    }
  }
  cl = lines.join('\n');
  fs.writeFileSync(clPath, cl, 'utf8');
  console.log('CHANGELOG: ' + changes.length + ' entries added');
}

console.log('   git add -A && git commit -m "bump: v' + newVersion + '"');
console.log('   git tag v' + newVersion + ' && git push origin master --tags');
