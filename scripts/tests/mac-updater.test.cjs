const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

const APP = path.resolve(__dirname, '../../electron-app');
const requireApp = createRequire(path.join(APP, 'package.json'));
const updater = requireApp('./mac-updater.js');

test('版本比较', () => {
  assert.equal(updater.compareVersion('1.0.8101', '1.0.8100'), 1);
  assert.equal(updater.compareVersion('1.0.8100', '1.0.8100'), 0);
  assert.equal(updater.compareVersion('v1.0.8099', '1.0.8100'), -1);
  assert.equal(updater.compareVersion('', '1.0.0'), -1);
});

test('Rosetta 下选 arm64 包', () => {
  assert.equal(updater.resolveArch('arm64', false), 'arm64');
  assert.equal(updater.resolveArch('x64', true), 'arm64');
  assert.equal(updater.resolveArch('x64', false), 'x64');
});

test('清单解析：优先 zip、识别无更新、缺包', () => {
  const manifest = { version: 'v1.0.8102', assets: [
    { arch: 'arm64', kind: 'dmg', url: 'https://x/a.dmg' },
    { arch: 'arm64', kind: 'zip', url: 'https://x/a.zip', sha512: 'AAA', size: 10 },
    { arch: 'x64', kind: 'dmg', url: 'https://x/b.dmg' },
  ] };
  const arm = updater.parseManifest(manifest, '1.0.8101', 'arm64');
  assert.equal(arm.hasUpdate, true);
  assert.equal(arm.version, '1.0.8102');
  assert.equal(arm.asset.kind, 'zip');
  assert.equal(updater.parseManifest(manifest, '1.0.8102', 'arm64').hasUpdate, false);
  const x64 = updater.parseManifest(manifest, '1.0.8101', 'x64');
  assert.equal(x64.asset.kind, 'dmg');
  const missing = updater.parseManifest({ version: '1.0.8102', assets: [] }, '1.0.8101', 'arm64');
  assert.equal(missing.platformMissing, true);
  assert.throws(() => updater.parseManifest({}, '1.0.8100', 'arm64'));
});

test('安装脚本包含校验与回滚步骤', () => {
  const script = updater.buildApplyScript({
    zipPath: "/tmp/a b's.zip",
    appPath: '/Applications/斯诺德跑团.app',
    expectVersion: '1.0.8102',
    relaunch: false,
  });
  for (const needle of ['ditto -x -k', 'PlistBuddy', 'mv "$APP" "$BACKUP"',
    'xattr -dr com.apple.quarantine', 'mv "$BACKUP" "$APP"', 'exit 12', 'exit 13', 'exit 14']) {
    assert.ok(script.includes(needle), '缺少步骤: ' + needle);
  }
  assert.ok(!script.includes('open "$APP"'), 'relaunch=false 时不应重启');
  assert.ok(updater.buildApplyScript({ zipPath: '/a.zip', appPath: '/b.app', expectVersion: '1.0.0' }).includes('open "$APP"'));
  assert.ok(script.includes("'/tmp/a b'\\''s.zip'"), '路径里的单引号必须转义');
});

test('资产命名与临时目录', () => {
  assert.equal(updater.assetName('1.0.8102', 'arm64', 'zip'), 'Snode-RPG-1.0.8102-mac-arm64.zip');
  assert.ok(updater.stagingPath().includes('snowd-update-'));
});
test('GitHub Release 转 manifest', () => {
  const release = { tag_name: 'v1.0.8101', assets: [
    { name: 'Snode-RPG-1.0.8101-mac-arm64.zip', browser_download_url: 'https://x/a.zip', size: 10 },
    { name: 'Snode-RPG-1.0.8101-mac-x64.dmg', browser_download_url: 'https://x/b.dmg', size: 20 },
    { name: 'Snode-RPG-Setup-1.0.8101.exe', browser_download_url: 'https://x/c.exe' },
    { name: 'mac.json', browser_download_url: 'https://x/mac.json' },
  ] };
  const manifest = updater.manifestFromRelease(release);
  assert.equal(manifest.version, '1.0.8101');
  assert.equal(manifest.assets.length, 2);
  assert.deepEqual(manifest.assets.map(a => a.arch + ':' + a.kind).sort(), ['arm64:zip', 'x64:dmg']);
});

test('sha512Base64 与系统实现一致', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const nodePath = require('node:path');
  const crypto = require('node:crypto');
  const file = nodePath.join(os.tmpdir(), 'snowd-sha-' + Date.now() + '.bin');
  fs.writeFileSync(file, Buffer.alloc(2048, 7));
  const expect = crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');
  assert.equal(updater.sha512Base64(file), expect);
  fs.unlinkSync(file);
});

test('安装脚本支持启动延时', () => {
  const script = updater.buildApplyScript({ zipPath: '/a.zip', appPath: '/b.app', expectVersion: '1.0.0', delaySeconds: 3 });
  assert.ok(script.includes('sleep 3'), '应包含 sleep 3');
});
