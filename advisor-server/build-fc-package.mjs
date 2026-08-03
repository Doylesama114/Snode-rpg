/**
 * 构建阿里云 FC Web 函数代码包：
 *   dist/scripts/*.mjs  顾问管线
 *   dist/advisor/        顾问知识数据
 *   dist/server.js       服务入口
 *   dist/package.json
 *
 * 用法：node advisor-server/build-fc-package.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(SRC, '..');
const DIST = path.join(SRC, 'dist');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyTree(srcDir, destDir, filter) {
  if (!fs.existsSync(srcDir)) return;
  const walk = (dir, out) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '__pycache__') continue;
        walk(full, out);
      } else if (!filter || filter(full, ent.name)) {
        const rel = path.relative(srcDir, full);
        copyFile(full, path.join(out, rel));
      }
    }
  };
  walk(srcDir, destDir);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 顾问管线脚本（只带 .mjs）
copyTree(path.join(ROOT, 'scripts'), path.join(DIST, 'scripts'), (_full, name) =>
  name.endsWith('.mjs')
);

// 顾问知识数据
copyTree(path.join(ROOT, 'advisor'), path.join(DIST, 'advisor'));

// 服务入口
copyFile(path.join(SRC, 'server.js'), path.join(DIST, 'server.js'));
copyFile(path.join(SRC, 'package.json'), path.join(DIST, 'package.json'));

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  };
  walk(dir);
  return total;
}

console.log(`FC package ready: ${DIST}`);
console.log(`  scripts: ${fs.readdirSync(path.join(DIST, 'scripts')).length} files`);
console.log(`  advisor: ${(dirSize(path.join(DIST, 'advisor')) / 1e6).toFixed(1)} MB`);
console.log(`  total:   ${(dirSize(DIST) / 1e6).toFixed(1)} MB`);
