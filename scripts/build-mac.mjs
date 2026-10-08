#!/usr/bin/env node
// Default: native macOS DMG installer. --zip explicitly selects the cross-built
// test archive, preserving the original runtime's POSIX modes and symlinks.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'electron-app');
const require = createRequire(path.join(APP, 'package.json'));
const args = process.argv.slice(2);
const archIndex = args.indexOf('--arch');
const arch = archIndex < 0 ? 'both' : args[archIndex + 1];
const flags = args.filter((_, i) => archIndex < 0 || (i !== archIndex && i !== archIndex + 1));
if (!['both', 'arm64', 'x64'].includes(arch) || flags.some(item => item !== '--zip')) {
  throw new Error('Usage: npm run dist:mac -- [--arch arm64|x64|both] [--zip]');
}
const arches = arch === 'both' ? ['arm64', 'x64'] : [arch];
if (!args.includes('--zip') && process.platform !== 'darwin') {
  throw new Error('DMG 安装包需要在 macOS 上构建。请运行 GitHub Actions 的 Build macOS Installers，或在 Mac 上执行此命令。测试压缩包请显式添加 --zip。');
}
const DIST = path.join(APP, 'dist', 'mac');
fs.mkdirSync(DIST, { recursive: true });

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, { cwd: APP, stdio: 'inherit', windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result;
}

run(process.execPath, [path.join(APP, 'sync-check.js')]);
if (process.platform === 'darwin' && !args.includes('--zip')) {
  fs.chmodSync(path.join(ROOT, 'scripts', 'snode'), 0o755);
  run(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'),
    '--config', 'electron-builder.mac.yml', '--mac', 'dmg', ...arches.map(item => `--${item}`), '--publish', 'never']);
  console.log(`[mac] DMG installers: ${DIST}`);
  process.exit(0);
}

const yaml = require('js-yaml');
const glob = require('glob');
const asar = require('@electron/asar');
const { downloadArtifact } = require('@electron/get');
const macConfig = yaml.load(fs.readFileSync(path.join(APP, 'electron-builder.mac.yml'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const electronVersion = require('electron/package.json').version;
const STAGE = fs.mkdtempSync(path.join(DIST, 'payload-'));
const source = path.join(STAGE, 'app');
const extras = path.join(STAGE, 'extras');
fs.mkdirSync(source, { recursive: true });
fs.mkdirSync(extras, { recursive: true });

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function selectFiles(patterns, cwd) {
  const ignore = patterns.filter(item => item.startsWith('!')).map(item => item.slice(1));
  const found = new Set();
  for (const pattern of patterns.filter(item => !item.startsWith('!'))) {
    for (const name of glob.sync(pattern, { cwd, nodir: true, dot: true, ignore })) found.add(name);
  }
  return [...found].sort();
}

for (const name of selectFiles(macConfig.files, APP)) copyFile(path.join(APP, name), path.join(source, name));
// Retain exactly the production dependency tree, including nested dependencies.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script through npm run dist:mac.');
const depList = run(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--parseable'],
  { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).stdout;
const depRoots = depList.trim().split(/\r?\n/).map(item => path.resolve(item)).filter(item => item !== APP);
for (const dep of depRoots) {
  const relative = path.relative(APP, dep);
  if (!relative.startsWith(`node_modules${path.sep}`) || relative.split(path.sep).includes('..')) {
    throw new Error(`Unexpected production dependency outside electron-app: ${dep}`);
  }
  for (const name of selectFiles(['**/*', '!node_modules/**/*'], dep)) {
    if (name.endsWith('.node')) throw new Error(`Native module requires a native macOS build: ${name}`);
    copyFile(path.join(dep, name), path.join(source, relative, name));
  }
}
const payload = path.join(STAGE, 'app.asar');
await asar.createPackage(source, payload);
// Verify that the main entry point, updater, and both content areas made it in.
for (const name of ['main.js', 'preload.js', 'mac-platform.js',
  'node_modules/electron-updater/package.json', '斯诺德跑团/启动台.html', '职业页/首页.html']) {
  asar.statFile(payload, name.split('/').join(path.sep));
}
for (const entry of macConfig.extraResources) {
  const from = path.resolve(APP, entry.from);
  const to = path.join(extras, 'Resources', entry.to);
  if (fs.statSync(from).isDirectory()) {
    for (const name of selectFiles(entry.filter || ['**/*'], from)) copyFile(path.join(from, name), path.join(to, name));
  } else copyFile(from, to);
}
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
console.log(`[mac] Application payload ready; downloading verified Electron ${electronVersion} runtimes.`);
const cacheRoot = path.join(DIST, '.electron-cache');
const tempDirectory = path.join(DIST, '.downloads');
fs.mkdirSync(tempDirectory, { recursive: true });
// Sequential downloads keep progress clear and avoid duplicate checksum fetches.
for (const targetArch of arches) {
  console.log(`[mac] Runtime: ${targetArch}`);
  const runtime = await downloadArtifact({
    version: electronVersion, artifactName: 'electron', platform: 'darwin', arch: targetArch,
    cacheRoot, tempDirectory,
    mirrorOptions: { mirror: 'https://github.com/electron/electron/releases/download/', customDir: `v${electronVersion}` },
    downloadOptions: { timeout: { request: 300000 } },
  });
  run(python, [path.join(ROOT, 'scripts', 'package-mac.py'), '--runtime', runtime,
    '--payload', payload, '--extras', extras, '--output', DIST, '--arch', targetArch,
    '--version', pkg.version, '--product', macConfig.productName, '--app-id', macConfig.appId]);
}
console.log(`[mac] Test ZIPs ready: ${DIST}. First launch requires the included signing command on a Mac.`);
