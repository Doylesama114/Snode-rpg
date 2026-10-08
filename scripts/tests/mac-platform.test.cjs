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
  assert.equal(macReleaseUpdate({ ...release, assets: release.assets.slice(2) }, '1.0.8046', 'arm64').status, 'error');
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
