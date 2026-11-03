const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { applicationMenu, macReleaseUpdate } = require('../../electron-app/mac-platform');

const APP = path.resolve(__dirname, '../../electron-app');
const requireApp = createRequire(path.join(APP, 'package.json'));
const prefix = 'https://github.com/Doylesama114/Snode-rpg/releases/download/v1.0.8047/';
const release = { tag_name: 'v1.0.8047', assets: [
  { name: 'Snode-RPG-1.0.8047-mac-arm64.dmg', browser_download_url: prefix + 'arm64.dmg' },
  { name: 'Snode-RPG-1.0.8047-mac-x64.dmg', browser_download_url: prefix + 'x64.dmg' },
  { name: 'Snode-RPG-Setup-1.0.8047.exe', browser_download_url: prefix + 'windows.exe' },
] };

test('Mac edit, window and quit shortcuts are available', () => {
  const menu = applicationMenu({ name: '斯诺德跑团' }, { buildFromTemplate: value => value });
  const roles = menu.flatMap(item => item.submenu.map(entry => entry.role));
  for (const role of ['copy', 'paste', 'selectAll', 'close', 'minimize', 'quit']) assert.ok(roles.includes(role));
});

test('Each architecture gets its own Mac DMG', () => {
  assert.equal(macReleaseUpdate(release, '1.0.8046', 'arm64').url, prefix + 'arm64.dmg');
  assert.equal(macReleaseUpdate(release, '1.0.8046', 'x64').url, prefix + 'x64.dmg');
});

test('Windows assets cannot be offered to a Mac user', () => {
  const result = macReleaseUpdate({ ...release, assets: release.assets.slice(2) }, '1.0.8046', 'arm64');
  assert.notEqual(result.status, 'available');
  assert.equal(result.status, 'uptodate');
  assert.equal(result.platformMissing, true);
});

test('A version without a Mac package stays neutral instead of erroring', () => {
  const windowsOnly = { tag_name: 'v1.0.8065', assets: [
    { name: 'Snode-RPG-Setup-1.0.8065.exe', browser_download_url: 'https://github.com/Doylesama114/Snode-rpg/releases/download/v1.0.8065/Snode-RPG-Setup-1.0.8065.exe' },
  ] };
  for (const arch of ['arm64', 'x64']) {
    const result = macReleaseUpdate(windowsOnly, '1.0.8064', arch);
    assert.equal(result.status, 'uptodate');
    assert.equal(result.platformMissing, true);
    assert.equal(typeof result.message, 'string');
  }
});

test('Same or newer installed versions do not get downgraded', () => {
  for (const current of ['1.0.8047', '1.0.8048']) assert.equal(macReleaseUpdate(release, current, 'arm64').status, 'uptodate');
});

test('Foreign installer links are rejected', () => {
  const foreign = { ...release, assets: [{ ...release.assets[0], browser_download_url: 'https://example.com/app.dmg' }] };
  assert.throws(() => macReleaseUpdate(foreign, '1.0.8046', 'arm64'), /下载地址无效/);
});

test('Mac bundle includes current desktop diagnostics and keeps resources outside code directories', async () => {
  const config = requireApp('app-builder-lib/out/util/config/config');
  const { DebugLogger } = requireApp('builder-util');
  const resolved = await config.getConfig(APP, 'electron-builder.mac.yml', null);
  await config.validateConfiguration(resolved, new DebugLogger());
  assert.equal((resolved.extraFiles || []).length, 0);
  for (const file of ['main.js', 'mac-platform.js', 'desktop-diagnostics.js', 'window-lifecycle.js',
    'recovery-store.js', 'desktop-settings.js', 'desktop-error.html', 'desktop-error.js']) {
    const appFiles = (resolved.files || []).flatMap(item => typeof item === 'string' ? [item] : item.filter || []);
    assert.ok(appFiles.includes(file), file);
  }
  assert.ok(resolved.extraResources.some(item => item.to === 'snode'));
  assert.ok(resolved.extraResources.some(item => item.to === '.env.example'));
  assert.ok(!resolved.extraResources.some(item => item.from === '.env.bundle' || item.to === '.env' || item.to === 'snode.cmd'));
  assert.deepEqual(resolved.mac.target.map(item => item.target), ['dmg']);
  assert.ok(fs.existsSync(path.join(APP, 'desktop-diagnostics.js')));
});
test('main.js 的每个相对 require 都在 mac 打包白名单里', () => {
  // 8083 加了 portable-updater.js 但 mac 白名单漏了它 -> 打包后的 app 一启动就崩，
  // CI 的 smoke launch 报 'Application exited during startup'。
  // 轻量解析：只取 files: 段里的 '- xxx' 行，避免依赖 js-yaml（CI 之外不一定装了）
  const ymlLines = fs.readFileSync(path.join(APP, 'electron-builder.mac.yml'), 'utf8').split(/\r?\n/);
  const patterns = [];
  let inFiles = false;
  for (const line of ymlLines) {
    if (/^files:\s*$/.test(line)) { inFiles = true; continue; }
    if (inFiles && /^[A-Za-z]/.test(line)) break;
    if (inFiles) {
      const m = line.match(/^\s*-\s+(.+?)\s*$/);
      if (m) patterns.push(m[1].replace(/^['"]|['"]$/g, ''));
    }
  }
  const source = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
  const required = [...new Set([...source.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)].map(m => m[1]))];
  assert.ok(required.length > 0);
  for (const name of required) {
    const covered = patterns.some(pattern => pattern === name || pattern === name + '.js' ||
      pattern.startsWith(name + '/') || pattern.startsWith(name + '**'));
    assert.ok(covered, name + ' 未包含在 electron-builder.mac.yml 的 files 中');
  }
});

