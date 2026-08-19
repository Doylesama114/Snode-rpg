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
  {
    path: path.join(ROOT, 'mobile', 'app', 'build.gradle.kts'),
    rules: [
      [/: \"[\d.]+\"/, ': "' + newVersion + '"'],
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

// 同步职业页 CSS 缓存版本号（common.css 每次修改后必须让客户端重新拉取）
const cssDirs = [path.join(ROOT, '职业页'), path.join(ROOT, 'electron-app', '职业页')];
for (const cssDir of cssDirs) {
  if (!fs.existsSync(cssDir)) continue;
  for (const name of fs.readdirSync(cssDir)) {
    if (!name.endsWith('.html')) continue;
    const fp = path.join(cssDir, name);
    let html = fs.readFileSync(fp, 'utf8');
    html = html.replace(/common\.css\?v=[\d.]+/g, 'common.css?v=' + newVersion);
    fs.writeFileSync(fp, html, 'utf8');
  }
  console.log('CSS-VERSION: ' + path.relative(ROOT, cssDir) + ' → v' + newVersion);
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
    if (lines[i].includes('= [')) {
      lines.splice(i + 1, 0, entry);
      break;
    }
  }
  cl = lines.join('\n');
  fs.writeFileSync(clPath, cl, 'utf8');
  console.log('CHANGELOG: ' + changes.length + ' entries added');

  // 同步 changelog.js 到斯诺德跑团/（启动台在这里读取它）
  const changelogSrc = path.join(ROOT, 'changelog.js');
  for (let d of ['斯诺德跑团', 'electron-app\\斯诺德跑团']) {
    const dest = path.join(ROOT, d, 'changelog.js');
    fs.copyFileSync(changelogSrc, dest);
    console.log('SYNC: changelog.js → ' + d + '/changelog.js');
  }
}

console.log('   git add -A && git commit -m "bump: v' + newVersion + '"');
console.log('   git tag v' + newVersion + ' && git push origin master --tags');
