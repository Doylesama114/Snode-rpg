// 文件归档工具 —— 按《文件整理规范》（根目录 文件整理规范.md）执行
//
// 用法：
//   node scripts/archive_files.mjs                          # 预演：扫描根目录 + 备份区顶层，打印计划
//   node scripts/archive_files.mjs --apply                  # 执行归档并写入索引
//   node scripts/archive_files.mjs --paths-file <清单> [--why <原因>] [--apply]
//                                                           # 只归档清单中列出的条目（每行一个路径，# 开头为注释）
//
// 落点：备份区/YYYY-MM/<原名>（月份取文件名日期，其次取最后修改时间）；同名冲突追加 __dupN，绝不覆盖。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = path.join(ROOT, '备份区');
const INDEX = path.join(ARCHIVE, '_归档索引.md');
const BUCKET_RE = /^\d{4}-\d{2}$/;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const pathsFileIdx = args.indexOf('--paths-file');
const PATHS_FILE = pathsFileIdx >= 0 ? args[pathsFileIdx + 1] : null;
const whyIdx = args.indexOf('--why');
const WHY = whyIdx >= 0 ? args[whyIdx + 1] : '指定条目归档';

const ymd = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
};
const bucketOfDate = (d) => ymd(d).slice(0, 7);

// ---------- 时间判定：优先文件名里的日期，其次 mtime ----------
function nameDate(name) {
  // 带分隔符：2026-07-31 / 2026_05_29 / 2026.07.31
  let m = name.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})(?!\d)/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 紧凑八位：20260529（两侧必须是非数字，避免 Av117020930606041 这类长数字串误判）
  m = name.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // 只到月份：2026-07
  m = name.match(/(20\d{2})[-_.](\d{2})(?!\d)/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return null;
}
function newestMtime(p) {
  const st = fs.statSync(p);
  let t = st.mtime;
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const c = path.join(p, e.name);
      try { const ct = newestMtime(c); if (ct > t) t = ct; } catch { /* 子项不可读：跳过 */ }
    }
  }
  return t;
}
const bucketFor = (fullPath, name, useName) => {
  if (useName) { const d = nameDate(name); if (d) return bucketOfDate(d); }
  return bucketOfDate(new Date(newestMtime(fullPath)));
};

// ---------- 根目录：允许留存的核心文件（白名单） ----------
const KEEP_ROOT_FILES = new Set([
  '.env', '.env.example', '.gitignore',
  'index.html', 'server.js', 'sentry-loader.js', 'bug-report.js',
  'bump-version.js', 'changelog.js', 'package.json', 'package-lock.json',
  'opencode.json', '更新打包.bat', 'upload-gitee-exe.sh',
  '项目文档.md', '工作规则.md', '后续更新教程.md', '职业页同步手册.md', '文件整理规范.md',
  'debug-journal.md', '卡牌效果实现进度.md', '关键词系统注意事项.md', '通用天赋树.md',
  '旧会话延续上下文.md',
]);
const isKeep = (name) =>
  KEEP_ROOT_FILES.has(name) ||
  /^verify[_.]/.test(name) ||
  /^describe_screenshot\.mjs$/.test(name) ||
  /^基础职业-.*\.docx$/.test(name) ||
  /^通用天赋树\.(docx|md)$/.test(name) ||
  /^神圣领域-.*\.docx$/.test(name) ||
  /^《基础职业进阶途径》\.docx$/.test(name) ||
  /^已公布进阶职业\.docx$/.test(name) ||
  /^特殊专长\.docx$/.test(name) ||
  /^斯诺德世界观架构\.docx$/.test(name) ||
  /^斯诺德核心文档\.rar$/.test(name) ||
  /^斯诺德(物资大全|装备大全|对决卡牌列表（已开出）)\.[a-z]+$/i.test(name) ||
  /^冒险者(基础规则|角色创建流程)\.xlsx$/.test(name) ||
  /^冒险者角色档案_空白_含图纸区(_v2)?\.xlsx$/.test(name) ||
  /^个性与背景创建规则\.xlsx$/.test(name) ||
  /^(额外规则|兼职条件|龙裔种族详情)\.png$/.test(name) ||
  /^兼职需求\(谋士版本\)\.png$/.test(name) ||
  /^(基尼泰·梅|狐人术士 拉奇|芙兰_角色档案)\.xlsx$/.test(name);

// 明确的临时/产物规则（根目录层级）
const ROOT_MOVE_RULES = [
  [/^_/, '临时脚本与产物（下划线前缀）'],
  [/^__pycache__$/, 'Python 字节码缓存'],
  [/\.exe$/i, '本地安装包产物'],
  [/^已公布进阶职业\.zip$/, '重复归档（已有 .docx 版本）'],
  [/^oh-my-openagent-.*\.tgz$/, '外部依赖包'],
  [/^(nul|\.form-textarea)$/, '空/异常占位文件'],
  [/^测试导出_.*\.xlsx$/, '测试导出产物'],
  [/^救赎骑士_slot1_.*\.xlsx$/, '测试导出产物'],
  [/^导出示例_实际数据_三张表\.xlsx$/, '导出样例产物'],
  [/^冒险者角色档案_空白_含图纸区 - 副本\.xlsx$/, '副本文件'],
  [/^冒险者角色档案fulan - 斗蛐蛐版 - 调整版\.xlsx$/, '过期派生副本'],
  [/^甘九展示\.html$/, '一次性展示页'],
  [/^角色创建页\.html$/, '游离副本（正式版在 斯诺德跑团/）'],
];

const plan = [];
const skipped = [];

if (PATHS_FILE) {
  // 指定条目模式：只处理清单里的路径
  const raw = fs.readFileSync(path.resolve(ROOT, PATHS_FILE), 'utf8').split(/\r?\n/);
  for (const line of raw) {
    const p = line.trim();
    if (!p || p.startsWith('#')) continue;
    const full = path.resolve(ROOT, p);
    if (!fs.existsSync(full)) { console.error('MISSING ' + p); continue; }
    const name = path.basename(full);
    plan.push({ src: full, name, bucket: bucketFor(full, name, true), why: WHY });
  }
} else {
  for (const e of fs.readdirSync(ROOT, { withFileTypes: true })) {
    const name = e.name;
    if (name === '_scratch') continue;                                     // 临时工作区，保持原位
    if (e.isDirectory() && !/^_|^__pycache__$/.test(name)) continue;       // 目录仅归档 _ 前缀
    if (e.isFile() && isKeep(name)) continue;
    const full = path.join(ROOT, name);
    if (e.isFile() && fs.statSync(full).size < 10 && /\.html$/i.test(name)) {
      plan.push({ src: full, name, bucket: bucketFor(full, name, false), why: '乱码/损坏文件' });
      continue;
    }
    const hit = ROOT_MOVE_RULES.find(([re]) => re.test(name));
    if (!hit) { skipped.push(name); continue; }
    plan.push({ src: full, name, bucket: bucketFor(full, name, false), why: hit[1] });
  }
}

// ---------- 备份区：顶层条目按时间分档（仅默认模式） ----------
const archivePlan = [];
if (!PATHS_FILE) {
  for (const e of fs.readdirSync(ARCHIVE, { withFileTypes: true })) {
    const name = e.name;
    if (BUCKET_RE.test(name) || name === '_归档索引.md' || name.startsWith('README')) continue;
    const full = path.join(ARCHIVE, name);
    archivePlan.push({ src: full, name, bucket: bucketFor(full, name, true), why: '备份区顶层按时间归位' });
  }
}

const all = [...plan, ...archivePlan];

console.log('=== 归档计划（' + all.length + ' 项' + (PATHS_FILE ? '，指定条目模式' : '') + '）===');
for (const it of all.sort((a, b) => a.bucket.localeCompare(b.bucket) || a.name.localeCompare(b.name))) {
  console.log('  ' + it.bucket + '  ' + it.name + '   [' + it.why + ']');
}
if (!PATHS_FILE) {
  console.log('\n=== 根目录保留但未归类（' + skipped.length + ' 项）===');
  console.log('  ' + skipped.join('\n  '));
}
fs.mkdirSync(path.join(ROOT, '_scratch'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '_scratch', 'archive_plan.json'),
  JSON.stringify({ plan, archivePlan, skipped, generatedAt: new Date().toISOString() }, null, 2), 'utf8');
console.log('\nPLAN_JSON=_scratch/archive_plan.json  APPLY=' + APPLY);
if (!APPLY) process.exit(0);

// ---------- 执行 ----------
function uniqueTarget(dir, name) {
  let target = path.join(dir, name);
  let k = 2;
  while (fs.existsSync(target)) {
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    target = path.join(dir, stem + '__dup' + k + ext);
    k += 1;
  }
  return target;
}
const done = [];
for (const it of all.sort((a, b) => a.bucket.localeCompare(b.bucket))) {
  if (!fs.existsSync(it.src)) { console.error('MISSING ' + it.src); continue; }
  const dir = path.join(ARCHIVE, it.bucket);
  fs.mkdirSync(dir, { recursive: true });
  const target = uniqueTarget(dir, it.name);
  fs.renameSync(it.src, target);
  done.push({ ...it, target: path.relative(ROOT, target) });
  console.log('MOVED ' + it.bucket + '  ' + it.name);
}

// ---------- 归档索引（追加批次，保留既有清单） ----------
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
const batch = [];
batch.push('');
batch.push('## 归档批次 ' + stamp + (PATHS_FILE ? '（' + WHY + '）' : '（根目录扫描 + 备份区归位）'));
batch.push('');
batch.push('| 分档 | 条目 | 原位置 | 归档原因 | 现路径 |');
batch.push('| --- | --- | --- | --- | --- |');
for (const d of done) {
  const from = d.src.startsWith(ARCHIVE) ? '备份区/' : '';
  batch.push('| ' + d.bucket + ' | ' + d.name + ' | ' + from + d.name + ' | ' + d.why + ' | ' + d.target + ' |');
}
const bucketCounts = {};
for (const d of done) bucketCounts[d.bucket] = (bucketCounts[d.bucket] || 0) + 1;
batch.push('');
batch.push('本批次统计：' + Object.entries(bucketCounts).sort().map(([b, c]) => b + ' ' + c + ' 项').join('，'));
batch.push('');

if (fs.existsSync(INDEX)) {
  fs.appendFileSync(INDEX, batch.join('\n'), 'utf8');
} else {
  const header = [
    '# 备份区归档索引',
    '',
    '> 本文件由《文件整理规范》（根目录 `文件整理规范.md`）定义的分档规则生成，记录每次归档的落点。',
    '',
    '## 分档规则',
    '',
    '- 顶层只保留 `YYYY-MM/` 时间分档目录与本索引；',
    '- 归档项优先按**文件名中的日期**（`2026-07-31_xxx` / `xxx_20260529_225438`）判定月份，无日期则按**最后修改时间**；',
    '- 目录取其内部最新修改时间；',
    '- 同名冲突追加 `__dupN` 后缀，绝不覆盖；',
    '- 批次按时间倒序追加在文末。',
    '',
  ];
  fs.writeFileSync(INDEX, header.join('\n') + batch.join('\n'), 'utf8');
}
console.log('\nDONE ' + done.length + ' items. INDEX=备份区/_归档索引.md');
