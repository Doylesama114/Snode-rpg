const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const { macReleaseUpdate } = require('../../electron-app/mac-platform');

const APP = path.resolve(__dirname, '../../electron-app');
const appRequire = createRequire(path.join(APP, 'package.json'));
const downloadRoot = 'https://github.com/Doylesama114/Snode-rpg/releases/download/v1.0.8038/';
const release = { tag_name: 'v1.0.8038', assets: [
  { name: 'Snode-RPG-1.0.8038-mac-arm64.zip', browser_download_url: downloadRoot + 'arm64.zip' },
  { name: 'Snode-RPG-1.0.8038-mac-x64.dmg', browser_download_url: downloadRoot + 'intel.dmg' },
  { name: 'Snode-RPG-Setup-1.0.8038.exe', browser_download_url: downloadRoot + 'windows.exe' },
] };

function desktop(platform) {
  const app = new EventEmitter();
  app.name = '斯诺德跑团';
  app.commandLine = { appendSwitch() {} };
  app.getVersion = () => '1.0.8037';
  app.getPath = () => path.join(APP, 'dist', 'mac', 'unused-test-data');
  app.quitCalls = 0;
  app.quit = () => { app.quitCalls++; };
  let ready;
  app.whenReady = () => ({ then(callback) { ready = callback; } });
  const windows = [];
  const session = Object.assign(new EventEmitter(), { clearCache: () => Promise.resolve() });
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        isDestroyed: () => this.destroyed,
        send: (...message) => { this.lastMessage = message; },
        setWindowOpenHandler() {},
        session,
      });
      windows.push(this);
    }
    loadFile(file) { this.file = file; return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    close() { this.destroyed = true; this.emit('closed'); }
    static getAllWindows() { return windows.filter(window => !window.destroyed); }
  }
  const ipcMain = new EventEmitter();
  const handlers = new Map();
  ipcMain.handle = (name, handler) => {
    assert.ok(!handlers.has(name), 'IPC registered twice: ' + name);
    handlers.set(name, handler);
  };
  const updater = Object.assign(new EventEmitter(), {
    checkCalls: 0, downloadCalls: 0,
    checkForUpdates() { this.checkCalls++; return Promise.resolve(); },
    downloadUpdate() { this.downloadCalls++; return Promise.resolve(); },
  });
  const Menu = { buildFromTemplate: template => template, setApplicationMenu(menu) { this.menu = menu; } };
  let cliWindow;
  const opened = [];
  const electron = { app, BrowserWindow, Menu, ipcMain, dialog: {}, webContents: {},
    shell: { openExternal(url) { opened.push(url); return Promise.resolve(); } } };
  const fakeHttps = { get(_url, _options, callback) {
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = 200;
      callback(response);
      response.emit('data', JSON.stringify(release));
      response.emit('end');
    });
    return request;
  } };
  const context = vm.createContext({
    console, __dirname: APP, Buffer, URL, Set,
    process: { platform, arch: 'arm64', env: {}, versions: process.versions },
    setTimeout() {}, clearTimeout() {}, setInterval() {},
    require(name) {
      if (name === 'electron') return electron;
      if (name === 'https') return fakeHttps;
      if (name === 'electron-updater') return { autoUpdater: updater };
      if (name === './advisor-env-bootstrap') return { bootstrapAdvisorEnv() {} };
      if (name === './chargen-cli-server') return { startChargenCliServer(window) { cliWindow = window; } };
      return appRequire(name);
    },
  });
  vm.runInContext(fs.readFileSync(path.join(APP, 'main.js'), 'utf8'), context, { filename: 'main.js' });
  ready();
  return { app, BrowserWindow, ipcMain, updater, Menu, windows, opened, context,
    cliWindow: () => typeof cliWindow === 'function' ? cliWindow() : cliWindow };
}

test('Mac startup keeps edit shortcuts, Dock reopens the window, CLI follows it', () => {
  const runtime = desktop('darwin');
  const roles = runtime.Menu.menu.flatMap(menu => menu.submenu.map(item => item.role));
  for (const role of ['copy', 'paste', 'selectAll', 'close', 'quit']) assert.ok(roles.includes(role));
  assert.match(runtime.windows[0].file, /启动台\.html$/);
  runtime.windows[0].close();
  runtime.app.emit('window-all-closed');
  assert.equal(runtime.app.quitCalls, 0);
  assert.equal(runtime.cliWindow(), null);
  runtime.app.emit('activate');
  assert.equal(runtime.windows.length, 2);
  assert.equal(runtime.cliWindow(), runtime.windows[1]);
  assert.equal(runtime.windows[1].webContents.session.listenerCount('will-download'), 1);
});

test('Windows still uses its existing menu and quits when the last window closes', () => {
  const runtime = desktop('win32');
  assert.equal(runtime.Menu.menu, null);
  runtime.app.emit('window-all-closed');
  assert.equal(runtime.app.quitCalls, 1);
});

test('Mac checks and downloads use matching browser assets, never Squirrel or Windows', async () => {
  const runtime = desktop('darwin');
  await vm.runInContext('checkForUpdatesViaGenericFeed({sources:["oss","github"]})', runtime.context);
  assert.equal(runtime.windows[0].lastMessage[1].status, 'available');
  runtime.ipcMain.emit('download-update');
  assert.deepEqual(runtime.opened, [downloadRoot + 'arm64.zip']);
  assert.equal(runtime.updater.checkCalls, 0);
  assert.equal(runtime.updater.downloadCalls, 0);
});

test('Each Mac architecture selects its own installer', () => {
  assert.equal(macReleaseUpdate(release, '1.0.8037', 'arm64').url, downloadRoot + 'arm64.zip');
  assert.equal(macReleaseUpdate(release, '1.0.8037', 'x64').url, downloadRoot + 'intel.dmg');
});

test('A Windows-only release cannot be offered as a Mac update', () => {
  const windowsOnly = { ...release, assets: release.assets.slice(2) };
  assert.equal(macReleaseUpdate(windowsOnly, '1.0.8037', 'arm64').status, 'error');
});

test('Equal and older versions do not offer an update; version numbers compare numerically', () => {
  assert.equal(macReleaseUpdate(release, '1.0.8038', 'arm64').status, 'uptodate');
  assert.equal(macReleaseUpdate(release, '1.0.9000', 'arm64').status, 'uptodate');
  assert.equal(macReleaseUpdate(release, '1.0.99', 'arm64').status, 'available');
});

test('Invalid or external release download URLs are rejected', () => {
  const spoofed = { ...release, assets: [{ name: release.assets[0].name,
    browser_download_url: 'https://github.com.evil.example/installer.zip' }] };
  assert.throws(() => macReleaseUpdate(spoofed, '1.0.8037', 'arm64'), /下载地址无效/);
});

test('The resolved native Mac configuration excludes Windows personal-build secrets', async () => {
  const config = appRequire('app-builder-lib/out/util/config/config');
  const { DebugLogger } = appRequire('builder-util');
  const resolved = await config.getConfig(APP, 'electron-builder.mac.yml', null);
  await config.validateConfiguration(resolved, new DebugLogger());
  assert.ok(resolved.extraFiles.some(item => item.to === 'snode'));
  assert.ok(resolved.extraFiles.some(item => item.to === '.env.example'));
  assert.ok(!resolved.extraFiles.some(item => item.from === '.env.bundle' || item.to === '.env' || item.to === 'snode.cmd'));
  assert.ok(!resolved.extraFiles.some(item => (item.filter || []).includes('**/*.ps1')));
  assert.deepEqual(resolved.mac.target.map(item => item.target), ['dmg']);
});
