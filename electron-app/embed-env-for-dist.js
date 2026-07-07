#!/usr/bin/env node
/**
 * Embed local .env into Electron build (personal builds only — never commit .env).
 * Pre:  copy repo .env → electron-app/.env.bundle for extraFiles
 * Post: copy .env beside portable exe + win-unpacked
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '.env');
const BUNDLE = path.join(__dirname, '.env.bundle');
const DIST = path.join(__dirname, 'dist');
const isPost = process.argv.includes('--post');

function copyIfExists(from, to, label) {
  if (!fs.existsSync(from)) {
    console.warn(`[embed-env] skip ${label}: source missing`);
    return false;
  }
  fs.copyFileSync(from, to);
  console.log(`[embed-env] ${label}: ${path.relative(ROOT, to)}`);
  return true;
}

if (!isPost) {
  if (copyIfExists(SRC, BUNDLE, 'bundle for extraFiles')) {
    console.log('[embed-env] 打包将内置 DeepSeek 配置（勿对外分发此安装包）');
  } else {
    const example = path.join(ROOT, '.env.example');
    if (fs.existsSync(example)) {
      fs.copyFileSync(example, BUNDLE);
      console.warn('[embed-env] 无 .env，使用 .env.example 占位（API Key 为空）');
    }
  }
  process.exit(0);
}

if (!fs.existsSync(SRC)) {
  console.warn('[embed-env] post: 无 .env，跳过');
  process.exit(0);
}

const unpacked = path.join(DIST, 'win-unpacked', '.env');
copyIfExists(SRC, unpacked, 'win-unpacked');

if (fs.existsSync(DIST)) {
  for (const name of fs.readdirSync(DIST)) {
    if (name.endsWith('.exe') && name.includes('1.0.')) {
      copyIfExists(SRC, path.join(DIST, '.env'), 'dist/.env (便携版同目录)');
      break;
    }
  }
}

console.log('[embed-env] post 完成');
