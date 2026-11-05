'use strict';
/**
 * macOS 更新器（v1.0.8101）：清单解析 + 生成安装脚本。
 * 设计原则：
 *  - 只依赖 macOS 自带命令（ditto / xattr / PlistBuddy / open），不引第三方工具；
 *  - 安装过程写成一个 POSIX sh 脚本，便于在 CI 上原样执行与回归；
 *  - 每一步都校验，失败自动回滚到旧 .app。
 */
const os = require('os');
const path = require('path');

function normalizeVersion(v) {
  return String(v == null ? '' : v).trim().replace(/^v/i, '');
}

function compareVersion(a, b) {
  const pa = normalizeVersion(a).split('.').map(function (x) { return parseInt(x, 10) || 0; });
  const pb = normalizeVersion(b).split('.').map(function (x) { return parseInt(x, 10) || 0; });
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Rosetta 下 process.arch 仍是 x64，需要按 CPU 真实架构选包 */
function resolveArch(arch, translated) {
  if (arch === 'arm64') return 'arm64';
  return translated ? 'arm64' : 'x64';
}

function assetName(version, arch, ext) {
  return 'Snode-RPG-' + normalizeVersion(version) + '-mac-' + arch + '.' + ext;
}

/** manifest: { version, assets: [{ arch, kind: 'zip'|'dmg', url, sha512, size }] } */
function pickAsset(manifest, arch) {
  const assets = (manifest && Array.isArray(manifest.assets)) ? manifest.assets : [];
  const mine = assets.filter(function (a) { return a && a.arch === arch; });
  return mine.find(function (a) { return a.kind === 'zip'; })
    || mine.find(function (a) { return a.kind === 'dmg'; })
    || null;
}

function parseManifest(manifest, currentVersion, arch) {
  const version = normalizeVersion(manifest && manifest.version);
  if (!version) throw new Error('清单缺少 version');
  const cmp = compareVersion(version, currentVersion);
  const asset = pickAsset(manifest, arch);
  return {
    version: version,
    hasUpdate: cmp > 0,
    asset: asset,
    platformMissing: cmp > 0 && !asset,
  };
}

function shQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

/**
 * 生成安装脚本：解压 → 校验版本 → 备份旧 app → 覆盖 → 清 quarantine → 校验 → 重启；
 * 任何一步失败都回滚。退出码用于 CI 断言：
 *  0 成功 / 11 压缩包内没有 .app / 12 版本不符 / 13 覆盖失败 / 14 覆盖后结构不完整
 */
function buildApplyScript(opts) {
  const zipPath = opts.zipPath;
  const appPath = opts.appPath;
  const expect = normalizeVersion(opts.expectVersion);
  const lines = [
    '#!/bin/sh',
    'set -u',
    'ZIP=' + shQuote(zipPath),
    'APP=' + shQuote(appPath),
    'EXPECT=' + shQuote(expect),
    'STAGE="$(mktemp -d /tmp/snowd-update.XXXXXX)"',
    'BACKUP="${APP}.bak.$$"',
    'cleanup() { rm -rf "$STAGE"; }',
    'trap cleanup EXIT',
    'if [ ! -f "$ZIP" ]; then echo "missing zip"; exit 11; fi',
    'if ! ditto -x -k "$ZIP" "$STAGE" >/dev/null 2>&1; then echo "unzip failed"; exit 11; fi',
    'SRC="$(find "$STAGE" -maxdepth 3 -name "*.app" -type d -print -quit)"',
    'if [ -z "$SRC" ]; then echo "no .app in zip"; exit 11; fi',
    'GOT="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$SRC/Contents/Info.plist" 2>/dev/null || echo unknown)"',
    'if [ "$GOT" != "$EXPECT" ]; then echo "version mismatch: $GOT != $EXPECT"; exit 12; fi',
    'rm -rf "$BACKUP"',
    'if ! mv "$APP" "$BACKUP" 2>/dev/null; then echo "backup failed"; exit 13; fi',
    'if ! ditto --rsrc --extattr "$SRC" "$APP" >/dev/null 2>&1; then echo "copy failed"; mv "$BACKUP" "$APP"; exit 13; fi',
    'xattr -dr com.apple.quarantine "$APP" >/dev/null 2>&1 || true',
    'if [ ! -f "$APP/Contents/Info.plist" ]; then echo "broken bundle"; rm -rf "$APP"; mv "$BACKUP" "$APP"; exit 14; fi',
    'rm -rf "$BACKUP"',
  ];
  if (opts.relaunch !== false) {
    lines.push('open "$APP" >/dev/null 2>&1 || true');
  }
  lines.push('exit 0', '');
  return lines.join('\n');
}

function stagingPath() {
  return path.join(os.tmpdir(), 'snowd-update-' + process.pid + '-' + Date.now());
}

module.exports = {
  normalizeVersion: normalizeVersion,
  compareVersion: compareVersion,
  resolveArch: resolveArch,
  assetName: assetName,
  pickAsset: pickAsset,
  parseManifest: parseManifest,
  buildApplyScript: buildApplyScript,
  stagingPath: stagingPath,
};
