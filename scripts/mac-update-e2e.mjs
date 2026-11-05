// macOS 更新器安装流程 e2e（在真实 macOS 上运行）
// 用法：node scripts/mac-update-e2e.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const updater = require(path.resolve('electron-app/mac-updater.js'));

const results = [];
function check(name, ok, detail) { results.push({ name, ok, detail }); }
function sh(cmd, args, opts) { return spawnSync(cmd, args, { encoding: 'utf8', ...opts }); }

function makeApp(dir, version) {
  const app = path.join(dir, '斯诺德跑团.app');
  const macos = path.join(app, 'Contents', 'MacOS');
  fs.mkdirSync(macos, { recursive: true });
  fs.writeFileSync(path.join(macos, 'snowd'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(app, 'Contents', 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    '<key>CFBundleIdentifier</key><string>com.snowd.test</string>',
    '<key>CFBundleName</key><string>snowd-test</string>',
    '<key>CFBundleShortVersionString</key><string>' + version + '</string>',
    '<key>CFBundleExecutable</key><string>snowd</string>',
    '</dict></plist>',
  ].join('\n'));
  return app;
}

function appVersion(app) {
  const out = sh('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(app, 'Contents', 'Info.plist')]);
  return (out.stdout || '').trim();
}

function zipApp(app, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = sh('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, dest]);
  return r.status === 0;
}

function runScript(script) {
  const p = path.join(os.tmpdir(), 'snowd-apply-' + Date.now() + '.sh');
  fs.writeFileSync(p, script, { mode: 0o755 });
  const r = sh('/bin/sh', [p]);
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const isDarwin = process.platform === 'darwin';
if (!isDarwin) {
  console.log('SKIP: 该 e2e 只在 macOS 上运行（当前 ' + process.platform + '）');
  process.exit(0);
}

// ---------- 单测（跨平台纯函数，顺便在 mac 上再跑一遍） ----------
check('版本比较 8101>8100', updater.compareVersion('1.0.8101', '1.0.8100') === 1);
check('Rosetta 选 arm64', updater.resolveArch('x64', true) === 'arm64');
check('非 Rosetta x64 选 x64', updater.resolveArch('x64', false) === 'x64');
const manifest = { version: '1.0.8102', assets: [
  { arch: 'arm64', kind: 'dmg', url: 'https://x/a.dmg' },
  { arch: 'arm64', kind: 'zip', url: 'https://x/a.zip', sha512: 'AAA', size: 10 },
  { arch: 'x64', kind: 'dmg', url: 'https://x/b.dmg' },
] };
check('优先选 zip', (updater.parseManifest(manifest, '1.0.8101', 'arm64').asset || {}).kind === 'zip');
check('无更新时 hasUpdate=false', updater.parseManifest(manifest, '1.0.8102', 'arm64').hasUpdate === false);
check('缺该架构包时 platformMissing', updater.parseManifest(manifest, '1.0.8100', 'x64').platformMissing === true || (updater.parseManifest(manifest, '1.0.8100', 'x64').asset || {}).kind === 'dmg');

// ---------- 真实安装流程 ----------
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'snowd-e2e-'));

// 1) 成功路径
{
  const installDir = path.join(work, 'Applications');
  fs.mkdirSync(installDir, { recursive: true });
  const installed = makeApp(installDir, '1.0.8100');
  sh('xattr', ['-w', 'com.apple.quarantine', '0083;00000000;Safari;', installed]);
  const src = path.join(work, 'src');
  fs.mkdirSync(src, { recursive: true });
  const newApp = makeApp(src, '1.0.8102');
  const zip = path.join(work, 'update.zip');
  const zipped = zipApp(newApp, zip);
  check('打包测试 zip', zipped);
  const script = updater.buildApplyScript({ zipPath: zip, appPath: installed, expectVersion: '1.0.8102', relaunch: false });
  const run = runScript(script);
  check('安装脚本退出码 0', run.status === 0, run.out.trim().slice(0, 120));
  check('版本已更新为 1.0.8102', appVersion(installed) === '1.0.8102', appVersion(installed));
  const q = sh('xattr', ['-p', 'com.apple.quarantine', installed]);
  check('quarantine 已清除', !(q.stdout || '').trim(), (q.stdout || '').trim());
  const leftovers = fs.readdirSync(installDir).filter(n => n.indexOf('.bak.') !== -1);
  check('备份已清理', leftovers.length === 0, leftovers.join(','));
}

// 2) 版本不符 -> 拒绝并保持原版本
{
  const installDir = path.join(work, 'mismatch');
  fs.mkdirSync(installDir, { recursive: true });
  const installed = makeApp(installDir, '1.0.8100');
  const src = path.join(work, 'src2');
  fs.mkdirSync(src, { recursive: true });
  const newApp = makeApp(src, '1.0.8102');
  const zip = path.join(work, 'update2.zip');
  zipApp(newApp, zip);
  const script = updater.buildApplyScript({ zipPath: zip, appPath: installed, expectVersion: '1.0.9999', relaunch: false });
  const run = runScript(script);
  check('版本不符时退出码 12', run.status === 12, String(run.status));
  check('版本不符时保持旧版本', appVersion(installed) === '1.0.8100', appVersion(installed));
}

// 3) 损坏包 -> 退出码 11 且不动旧版本
{
  const installDir = path.join(work, 'broken');
  fs.mkdirSync(installDir, { recursive: true });
  const installed = makeApp(installDir, '1.0.8100');
  const zip = path.join(work, 'broken.zip');
  fs.writeFileSync(zip, 'not-a-zip');
  const script = updater.buildApplyScript({ zipPath: zip, appPath: installed, expectVersion: '1.0.8102', relaunch: false });
  const run = runScript(script);
  check('损坏包退出码 11', run.status === 11, String(run.status));
  check('损坏包不影响旧版本', appVersion(installed) === '1.0.8100', appVersion(installed));
}

// 4) 目标目录只读 -> 失败回滚（保留旧 app）
{
  const installDir = path.join(work, 'readonly');
  fs.mkdirSync(installDir, { recursive: true });
  const installed = makeApp(installDir, '1.0.8100');
  const src = path.join(work, 'src3');
  fs.mkdirSync(src, { recursive: true });
  const newApp = makeApp(src, '1.0.8102');
  const zip = path.join(work, 'update3.zip');
  zipApp(newApp, zip);
  sh('chmod', ['555', installDir]);
  const script = updater.buildApplyScript({ zipPath: zip, appPath: installed, expectVersion: '1.0.8102', relaunch: false });
  const run = runScript(script);
  sh('chmod', ['755', installDir]);
  check('只读目录时失败', run.status !== 0, String(run.status));
  check('只读目录时旧版本仍在', fs.existsSync(installed) && appVersion(installed) === '1.0.8100', appVersion(installed));
}

let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log('  PASS ' + r.name + (r.detail ? '  [' + r.detail + ']' : '')); }
  else { fail++; console.log('  FAIL ' + r.name + (r.detail ? '  ' + r.detail : '')); }
}
console.log('');
console.log('macOS 更新安装 e2e: ' + pass + 'P ' + fail + 'F');
process.exit(fail ? 1 : 0);
