/**
 * sync-check.js - 构建前同步验证脚本
 * 检查根目录源文件是否已同步到 electron-app 构建目录
 * 如果不同步则退出码为 1，阻止构建
 */

const fs = require('fs');
const path = require('path');

/** 需要检查的目录对: [源目录(根级), 目标目录(electron-app下)] */
const DIR_PAIRS = [
  { src: '../斯诺德跑团', dest: './斯诺德跑团' },
  { src: '../职业页', dest: './职业页' },
];

/** 需要跳过的文件模式 */
const SKIP_PATTERNS = ['_backup_'];

/**
 * 递归获取目录下所有文件（非目录）
 * 跳过名称中包含 SKIP_PATTERNS 中任一模式的文件
 */
function walkDir(dirPath, baseDir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results; // 目录不存在时返回空
  }
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // 跳过备份文件
    if (SKIP_PATTERNS.some(p => entry.name.includes(p))) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, baseDir));
    } else {
      results.push({ relativePath, fullPath });
    }
  }
  return results;
}

let hasErrors = false;

for (const pair of DIR_PAIRS) {
  const srcDir = path.resolve(__dirname, pair.src);
  const destDir = path.resolve(__dirname, pair.dest);

  if (!fs.existsSync(srcDir)) {
    console.error(`❌ 源目录不存在: ${pair.src}`);
    hasErrors = true;
    continue;
  }

  if (!fs.existsSync(destDir)) {
    console.error(`❌ 目标目录不存在: ${pair.dest} —— 需要先同步文件`);
    hasErrors = true;
    continue;
  }

  const srcFiles = walkDir(srcDir, srcDir);

  for (const srcFile of srcFiles) {
    const destFile = path.join(destDir, srcFile.relativePath);

    // 检查目标文件是否存在
    if (!fs.existsSync(destFile)) {
      console.error(`❌ 缺少文件: ${pair.dest}/${srcFile.relativePath} —— 源文件存在但未同步到构建目录`);
      hasErrors = true;
      continue;
    }

    // 检查源文件是否比目标文件新
    const srcStat = fs.statSync(srcFile.fullPath);
    const destStat = fs.statSync(destFile);
    if (srcStat.mtimeMs > destStat.mtimeMs) {
      console.error(`❌ 文件不同步: ${pair.dest}/${srcFile.relativePath} —— 源文件已更新，需要重新同步`);
      hasErrors = true;
    }
  }

  // 反向检查：目标目录有但源目录没有的文件（可能是不需要的残留）
  const destFiles = walkDir(destDir, destDir);
  for (const destFile of destFiles) {
    const srcFile = path.join(srcDir, destFile.relativePath);
    if (!fs.existsSync(srcFile)) {
      console.warn(`⚠️ 残留文件: ${pair.dest}/${destFile.relativePath} —— 源目录中已不存在，可手动清理`);
    }
  }
}

if (hasErrors) {
  console.error('\n❌ 文件未同步，请运行同步脚本后再构建。');
  console.error('   可使用: xcopy /E /I /Y "..\\斯诺德跑团" ".\\斯诺德跑团" && xcopy /E /I /Y "..\\职业页" ".\\职业页"');
  process.exit(1);
} else {
  console.log('✅ 文件已同步');
  process.exit(0);
}
