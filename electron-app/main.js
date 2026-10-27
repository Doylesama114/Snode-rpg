const { app, BrowserWindow, Menu, ipcMain, dialog, webContents, crashReporter, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { pathToFileURL, fileURLToPath } = require('url');
if (process.env.SNODE_CLI_TEST_USER_DATA) {
  fs.mkdirSync(process.env.SNODE_CLI_TEST_USER_DATA, { recursive: true });
  app.setPath('userData', process.env.SNODE_CLI_TEST_USER_DATA);
  app.setPath('sessionData', process.env.SNODE_CLI_TEST_USER_DATA);

}
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) {
  app.quit();
} else {
const { createDiagnostics } = require('./desktop-diagnostics');
const diagnostics = createDiagnostics(app);
let fatalExiting = false;
function fatalMain(error) {
  if (fatalExiting) return;
  fatalExiting = true;
  diagnostics.error('main-fatal', error);
  if (process.env.SNODE_CLI_TEST !== '1') {
    dialog.showErrorBox('斯诺德跑团发生启动异常', '程序将退出。重新打开后可导出诊断；已保存角色和恢复草稿会被保留。');
  }
  app.exit(1);
}
process.on('uncaughtException', fatalMain);
process.on('unhandledRejection', fatalMain);
try {
  const dumpDir = path.join(diagnostics.directory || app.getPath('userData'), 'crash-dumps');
  fs.mkdirSync(dumpDir, { recursive: true });
  app.setPath('crashDumps', dumpDir);
} catch (e) { diagnostics.error('crash-directory-unavailable', e); }
let mainWindow = null;
let pendingFocus = false;
app.on('second-instance', () => {
  diagnostics.log('second-instance');
  pendingFocus = true;
  if (app.isReady()) {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (process.env.SNODE_CLI_TEST !== '1') mainWindow.show();
    mainWindow.focus(); pendingFocus = false;
  }
});
let earlySettings = {};
try { earlySettings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'snowd-settings.json'), 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') diagnostics.error('settings-read-failed', e); }
if (earlySettings.compatibilityMode === true) app.disableHardwareAcceleration();
diagnostics.log('render-mode', { mode: earlySettings.compatibilityMode === true ? 'compatibility' : 'hardware' });
try { require('./advisor-env-bootstrap').bootstrapAdvisorEnv(diagnostics); }
catch (e) { diagnostics.error('advisor-bootstrap-disabled', e); }
let autoUpdater;
try { autoUpdater = require('electron-updater').autoUpdater; }
catch (e) {
  diagnostics.error('updater-disabled', e);
  autoUpdater = new (require('events').EventEmitter)();
  autoUpdater.setFeedURL = () => {};
  autoUpdater.checkForUpdates = autoUpdater.downloadUpdate = () => Promise.reject(new Error('更新功能不可用'));
  autoUpdater.quitAndInstall = () => {};
}
const mirrorConfig = require('./update-mirror-config');
const { applicationMenu, macReleaseUpdate } = require('./mac-platform');
const { RecoveryStore } = require('./recovery-store');
const { DesktopSettings } = require('./desktop-settings');
const desktopSettings = new DesktopSettings(path.join(app.getPath('userData'), 'snowd-settings.json'));
const { createWindowLifecycle } = require('./window-lifecycle');
const launcherUrl = pathToFileURL(path.join(__dirname, '斯诺德跑团', '启动台.html')).href;
const recoveryStore = new RecoveryStore(path.join(app.getPath('userData'), 'recovery-drafts'));
const lifecycle = createWindowLifecycle({ app, BrowserWindow, dialog, diagnostics, root: __dirname, launcher: launcherUrl, onPageReady: wc => { dirtyWindows.delete(wc.id); }, hidden: process.env.SNODE_CLI_TEST === '1', allowTestDialogs: process.env.SNODE_CLI_TEST === '1' && process.env.SNODE_TEST_DIALOGS === '1', preload: path.join(__dirname, 'preload.js') });
function trusted(event) {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame || !lifecycle.internal(frame.url)) throw new Error('桌面接口仅供内部主页面使用');
}
function recoveryIdentity(event, identity) {
  trusted(event);
  const id = recoveryStore.validateIdentity(identity);
  const url = new URL(event.senderFrame.url);
  const filename = path.basename(fileURLToPath(url));
  if (id.module === 'panel') {
    if (filename !== '角色面板.html' || (url.searchParams.get('char') && id.character !== url.searchParams.get('char')) ||
        id.slot !== (parseInt(url.searchParams.get('slot'), 10) || 1)) throw new Error('草稿与当前角色或槽位不匹配');
  } else {
    if (filename !== '角色创建页.html' || url.searchParams.has('cli') ||
        id.character !== (url.searchParams.get('recreate') || 'new') || id.slot !== 0) throw new Error('草稿与创建会话不匹配');
  }
  return id;
}
function handled(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    try { return await handler(event, payload); }
    catch (e) { diagnostics.error(channel + '-failed', e); return { ok: false, error: /^恢复|^草稿/.test(e.message || '') ? e.message : '此操作未完成，请检查目录权限或导出诊断。' }; }
  });
}
function broadcastPromptPreferences(result) {
  if (result.ok && result.preferences) for (const wc of webContents.getAllWebContents()) {
    try { if (!wc.isDestroyed() && lifecycle.internal(wc.getURL())) wc.send('prompt-preferences-changed', result.preferences); }
    catch (e) { diagnostics.error('preferences-broadcast-failed', e); }
  }
  return result;
}
handled('get-prompt-preferences', (event, payload) => {
  trusted(event);
  return { ok: true, preferences: desktopSettings.preferences(payload && payload.legacySeen) };
});
handled('set-prompt-preferences', (event, patch) => { trusted(event); return broadcastPromptPreferences(desktopSettings.switches(patch)); });
handled('mark-onboarding-seen', (event, payload) => { trusted(event); return broadcastPromptPreferences(desktopSettings.seen(payload.scene, payload.status)); });
handled('claim-advisor-tip', event => { trusted(event); return broadcastPromptPreferences(desktopSettings.claimTip()); });
handled('recovery-write', (event, payload) => {
  const id = recoveryIdentity(event, payload && payload.identity);
  const ack = recoveryStore.write(id, payload.snapshot, payload.savedAt);
  lifecycle.acknowledged(event.sender, ack.seq);
  diagnostics.log('recovery-ack', { windowId: BrowserWindow.fromWebContents(event.sender).id, seq: ack.seq });
  return ack;
});
handled('recovery-read', (event, identity) => {
  const draft = recoveryStore.read(recoveryIdentity(event, identity));
  lifecycle.acknowledged(event.sender, draft ? draft.seq : 0);
  return { ok: true, draft };
});
handled('recovery-clear', (event, payload) => {
  const result = recoveryStore.clear(recoveryIdentity(event, payload.identity), payload.seq);
  lifecycle.acknowledged(event.sender, 0);
  return result;
});
handled('recovery-list', event => { trusted(event); return { ok: true, drafts: recoveryStore.list() }; });
handled('recovery-discard', (event, payload) => {
  trusted(event);
  if (path.basename(fileURLToPath(new URL(event.senderFrame.url))) !== '启动台.html') throw new Error('仅启动台可管理草稿');
  return recoveryStore.clear(payload.identity, payload.seq);
});
handled('desktop-status', event => {
  trusted(event);
  return { ok: true, ...lifecycle.status(event.sender), compatibilityMode: earlySettings.compatibilityMode === true, diagnosticsDegraded: diagnostics.degraded };
});
handled('desktop-action', (event, action) => { trusted(event); return lifecycle.action(event.sender, action); });
handled('desktop-compatibility', (event, enabled) => {
  trusted(event);
  desktopSettings.patchRoot({ compatibilityMode: !!enabled });
  return { ok: true, nextStart: true };
});
handled('desktop-export-diagnostics', async event => {
  trusted(event);
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    title: '导出桌面诊断', defaultPath: path.join(app.getPath('downloads'), 'snode-desktop-diagnostics.jsonl'),
    filters: [{ name: '诊断日志', extensions: ['jsonl'] }]
  });
  if (result.canceled || !result.filePath) return { ok: true, canceled: true };
  diagnostics.log('diagnostics-export');
  return diagnostics.exportTo(result.filePath);
});
app.on('child-process-gone', (_event, details) => {
  diagnostics.log('child-process-gone', { type: details.type, reason: details.reason, exitCode: details.exitCode });
});
ipcMain.on('desktop-renderer-error', (event, details) => {
  try { trusted(event); diagnostics.log('renderer-error', { url: details && details.url, type: details && details.type }); }
  catch (_) {}
});
let gpuInfoRecorded = false;
app.on('gpu-info-update', () => {
  try {
    for (const [name, status] of Object.entries(app.getGPUFeatureStatus())) diagnostics.log('gpu-feature', { name, status });
    if (!gpuInfoRecorded && app.isReady()) {
      gpuInfoRecorded = true;
      app.getGPUInfo('basic').then(info => {
        const aux = info.auxAttributes || {};
        for (const device of info.gpuDevice || []) diagnostics.log('gpu-device', { vendor: device.vendorId, device: device.deviceId, driver: device.driverVersion || aux.driverVersion || device.driverVendor || '' });
      }).catch(e => diagnostics.error('gpu-info-unavailable', e));
    }
  } catch (e) { diagnostics.error('gpu-diagnostics-failed', e); }
});
// 允许渲染进程调用 window.gc()：职业页/预览会产生数万 DOM 节点，
// 显式 GC 能在 ~90ms 内把这些游离文档真正回收（否则会累积到数百 MB 直到崩溃）。
const testHeapMB = process.env.SNODE_CLI_TEST === '1' ? parseInt(process.env.SNODE_TEST_HEAP_MB, 10) : 0;
app.commandLine.appendSwitch('js-flags', '--expose-gc' + (testHeapMB >= 128 && testHeapMB <= 2048 ? ' --max-old-space-size=' + testHeapMB : ''));

// 发现新版本后不自动下载：由用户在启动台确认后再下载（避免开软件即后台下载 ~100 MB）
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false; // 改由本进程延迟拉起安装器（见 launchInstallerDelayed）
/* OSS 不支持 multipart/byteranges（差分下载会先报错再回退全量），直接关掉差分；同时关闭 web 安装器警告 */
autoUpdater.disableDifferentialDownload = true;
autoUpdater.disableWebInstaller = true;
autoUpdater.logger = {
  info: (m) => diagnostics.log('updater-info', { msg: String(m) }),
  warn: (m) => diagnostics.log('updater-warning', { msg: String(m) }),
  error: (e) => diagnostics.error('updater-error', e, { msg: String((e && e.message) || e) }),
  debug: () => {},
};

let CancellationToken = null;
try { CancellationToken = require('builder-util-runtime').CancellationToken; } catch (e) { CancellationToken = null; }

const UPDATE_SOURCES = {
  oss: {
    latestJson: mirrorConfig.OSS_LATEST_JSON,
    feed: (tag) => mirrorConfig.OSS_PUBLIC_BASE + '/releases/' + tag + '/',
  },
  github: {
    api: mirrorConfig.GITHUB_LATEST_API,
    feed: (tag) => 'https://github.com/Doylesama114/Snode-rpg/releases/download/' + tag + '/',
  },
};

let updateCheckInFlight = false;
/** @type {{ order: string[], tried: string[], phase: string, autoFallback: boolean, mirrorAttempted: boolean, lastSource: string|null }|null} */
let updateSession = null;

let autoUpdateEnabledCache = null;
/** 已发现但等待用户确认下载/重启的更新 @type {{version: string, ready?: boolean}|null} */
let pendingUpdate = null;

/** 启动台「自动更新」开关持久化文件（userData/snowd-settings.json） */
function settingsFilePath() {
  return path.join(app.getPath('userData'), 'snowd-settings.json');
}
function getAutoUpdateEnabled() {
  if (autoUpdateEnabledCache !== null) return autoUpdateEnabledCache;
  try {
    const file = settingsFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      autoUpdateEnabledCache = data.autoUpdate !== false;
    } else {
      autoUpdateEnabledCache = true;
    }
  } catch (e) {
    autoUpdateEnabledCache = true;
  }
  return autoUpdateEnabledCache;
}
function setAutoUpdateEnabled(value) {
  try {
    desktopSettings.patchRoot({ autoUpdate: !!value });
    autoUpdateEnabledCache = !!value;
  } catch (e) { diagnostics.error('auto-update-setting-write-failed', e); }
}

function sendUpdateStatus(data) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('update-status', data);
}

function formatUpdateError(msg) {
  if (!msg) return '更新检查失败';
  if (msg.indexOf('504') >= 0 || msg.indexOf('Gateway Time-out') >= 0 || msg.indexOf('Gateway Timeout') >= 0) {
    return 'GitHub 暂时超时（504），将自动尝试国内镜像。';
  }
  if (msg.indexOf('403') >= 0 || msg.indexOf('Forbidden') >= 0 || msg.indexOf('restricted') >= 0) {
    return 'GitHub 访问受限（403），将自动尝试国内镜像。';
  }
  if (msg.indexOf('ENOTFOUND') >= 0 || msg.indexOf('ETIMEDOUT') >= 0 || msg.indexOf('timeout') >= 0) {
    return '网络连接失败，将自动尝试国内镜像。';
  }
  if (msg.length > 120) {
    return '更新检查失败，将自动尝试国内镜像。';
  }
  return msg;
}

function resolveUpdateOrder(opts) {
  if (opts.sources && opts.sources.length) return opts.sources.slice();
  if (opts.preferMirror || opts.preferGitee) return ['oss', 'github'];
  return ['github', 'oss'];
}

function beginMirrorFallback(reason) {
  if (!updateSession || updateSession.mirrorAttempted) return Promise.resolve({ outcome: 'failed' });
  updateSession.mirrorAttempted = true;
  console.log('[更新] 自动切换国内镜像:', reason || 'primary failed');
  sendUpdateStatus({
    status: 'checking',
    message: '检查更新失败，正在自动尝试国内镜像...',
  });
  return checkForUpdatesViaGenericFeed({
    sources: ['oss', 'github'],
    autoFallback: false,
    _fromFallback: true,
    phase: 'mirror',
  });
}

/* 下载失败/太慢时切到下一个尚未尝试的源（OSS 与 GitHub 互为备份，最多各试一次） */
function tryNextUntriedSource(reason) {
  if (!updateSession) return false;
  var tried = updateSession.tried || [];
  var next = null;
  for (var i = 0; i < updateSession.order.length; i++) {
    if (tried.indexOf(updateSession.order[i]) < 0) { next = updateSession.order[i]; break; }
  }
  if (!next) return false;
  updateCheckInFlight = false;
  console.log('[更新] ' + (reason || '失败') + ' -> 切换到 ' + next + ' 重试');
  diagnostics.log('updater-source-fallback', { source: next, reason: String(reason || '').slice(0, 120), stage: 'fallback' });
  sendUpdateStatus({ status: 'checking', message: next === 'oss' ? '正在切换国内镜像重试…' : '正在切换备用源重试…' });
  checkForUpdatesViaGenericFeed({ sources: [next], autoFallback: false, _fromFallback: true, phase: next === 'oss' ? 'mirror' : 'github' });
  return true;
}

/* ===== 下载低速熔断：GitHub 慢到 15 KB/s 时不能让用户白等 ===== */
var DOWNLOAD_MIN_KBPS = 100;       /* 平均速度下限 */
var DOWNLOAD_SLOW_AFTER_MS = 60000; /* 至少观察 60 秒再判定 */
var DOWNLOAD_STALL_MS = 120000;     /* 120 秒没有任何进度视为卡死 */
var downloadWatch = null;
var downloadGeneration = 0;
var abortedGeneration = 0;
function resetDownloadWatch(version) {
  downloadGeneration += 1;
  downloadWatch = {
    generation: downloadGeneration,
    version: version,
    startedAt: Date.now(),
    lastBytes: 0,
    lastProgressAt: Date.now(),
    token: null,
  };
  return downloadWatch.generation;
}
function getDownloadToken() {
  if (!downloadWatch || !CancellationToken) return undefined;
  downloadWatch.token = new CancellationToken();
  return downloadWatch.token;
}
function noteDownloadProgress(p) {
  if (!downloadWatch) return;
  var now = Date.now();
  var transferred = (p && p.transferred) || 0;
  if (transferred > downloadWatch.lastBytes) {
    downloadWatch.lastBytes = transferred;
    downloadWatch.lastProgressAt = now;
  }
  var elapsed = now - downloadWatch.startedAt;
  var stalled = now - downloadWatch.lastProgressAt;
  var kbps = elapsed > 0 ? (transferred / 1024) / (elapsed / 1000) : 0;
  var tooSlow = elapsed >= DOWNLOAD_SLOW_AFTER_MS && kbps < DOWNLOAD_MIN_KBPS;
  var frozen = stalled >= DOWNLOAD_STALL_MS;
  if (!tooSlow && !frozen) return;
  var reason = frozen ? '下载停顿超过 2 分钟' : '下载速度过低（' + Math.round(kbps) + ' KB/s）';
  diagnostics.log('updater-download-abort', { reason: reason, ms: elapsed, percent: Math.round((p && p.percent) || 0) });
  abortedGeneration = downloadWatch.generation;
  if (downloadWatch.token) { try { downloadWatch.token.cancel(); } catch (e) {} }
  downloadWatch = null;
  updateCheckInFlight = false;
  if (tryNextUntriedSource(reason)) return;
  sendUpdateStatus({ status: 'error', message: '更新' + reason + '，已中止。可稍后重试，或到设置页手动下载安装包。' });
}

/* ===== 本次运行内重试：首检失败后 10/30 分钟各再试一次 ===== */
var updateRetryTimers = [];
function scheduleUpdateRetries() {
  updateRetryTimers.forEach(function (t) { clearTimeout(t); });
  updateRetryTimers = [];
  [10 * 60 * 1000, 30 * 60 * 1000].forEach(function (ms) {
    updateRetryTimers.push(setTimeout(function () {
      if (!getAutoUpdateEnabled()) return;
      if (pendingUpdate && pendingUpdate.ready) return;
      if (updateCheckInFlight) return;
      diagnostics.log('updater-retry', { ms: ms, stage: 'retry', version: app.getVersion() });
      runAutoUpdateCheck();
    }, ms));
  });
}

/* ===== 安装结果校验：记录待安装版本，重启后比对是否真的装上了 ===== */
/* ===== 临时目录加固：用户级 TEMP 被改坏时 NSIS 安装器会直接失败（Error writing temporary file） ===== */
/* 已下载安装包路径与「是否已拉起安装器」标记 */
var pendingInstallerFile = null;
var installerLaunched = false;

/* 先让本进程彻底退出，再由 cmd 延迟若干秒拉起安装器：
   静默安装时 NSIS 无法弹「关闭应用」对话框，应用还在跑就会直接返回 2（Failed to uninstall old application files） */
/* 安装器在 --updated 时会先运行「旧版本的卸载器」。我们的安装目录被移动/接管过，
   那个卸载器经常直接返回 2（Failed to uninstall old application files），而静默模式
   无法提示，安装就会中止。删掉旧卸载器后，安装器会跳过这一步，直接覆盖写入。 */
function removeOldUninstaller(reason) {
  var dir = path.dirname(process.execPath);
  var removed = 0;
  try {
    var names = fs.readdirSync(dir);
    for (var i = 0; i < names.length; i++) {
      if (!/^Uninstall\s.*\.exe$/i.test(names[i])) continue;
      try {
        fs.unlinkSync(path.join(dir, names[i]));
        removed++;
      } catch (e) {
        diagnostics.error('uninstaller-remove-failed', e);
      }
    }
  } catch (e) {
    diagnostics.error('uninstaller-scan-failed', e);
  }
  diagnostics.log('uninstaller-stripped', { count: removed, reason: String(reason || '') });
  return removed;
}

function launchInstallerDelayed(reason) {
  if (installerLaunched) return false;
  var file = pendingInstallerFile;
  if (!file || !fs.existsSync(file)) {
    diagnostics.log("updater-installer-missing", { reason: String(reason || "") });
    return false;
  }
  installerLaunched = true;
  removeOldUninstaller(reason);
  markInstallAttempt(pendingUpdate ? pendingUpdate.version : null);
  var delay = 12;
  var q = String.fromCharCode(34);
  var cmd = "ping 127.0.0.1 -n " + delay + " >nul & " + q + file + q + " --updated /S --force-run";
  try {
    var child = require("child_process").spawn("cmd.exe", ["/c", cmd], { detached: true, stdio: "ignore", windowsHide: true, windowsVerbatimArguments: true });
    child.unref();
    diagnostics.log("updater-install-launched", { reason: String(reason || ""), ms: delay * 1000, target: file });
  } catch (e) {
    installerLaunched = false;
    diagnostics.error("updater-install-spawn-failed", e);
    return false;
  }
  setTimeout(function () { app.quit(); }, 300);
  return true;
}
function resolveSafeTempDir() {
  try {
    var base = process.env.LOCALAPPDATA || "";
    if (!base) return "";
    var dir = path.join(base, "Temp");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (e) { return ""; }
}
function ensureProcessTemp() {
  var safe = resolveSafeTempDir();
  if (!safe) return;
  var cur = process.env.TEMP || "";
  var same = false;
  try { same = !!cur && path.resolve(cur) === path.resolve(safe); } catch (e) { same = false; }
  if (same) return;
  process.env.TEMP = safe;
  process.env.TMP = safe;
  diagnostics.log("temp-env-normalized", { target: safe, reason: "installer-needs-valid-temp" });
}

/* ===== 更新缓存清理：安装包会堆在 %LOCALAPPDATA%/<updaterCacheDirName>（每版 150~300MB） ===== */
var UPDATER_CACHE_KEEP_MS = 7 * 24 * 3600 * 1000;
function updaterCacheDir() {
  var base = process.env.LOCALAPPDATA || "";
  var name = "snowd-skill-tree-updater";
  try {
    var yml = fs.readFileSync(path.join(process.resourcesPath || "", "app-update.yml"), "utf8");
    var m = /updaterCacheDirName:\s*(\S+)/.exec(yml);
    if (m) name = m[1];
  } catch (e) {}
  return path.join(base, name);
}
function dirSize(dir) {
  var total = 0;
  try {
    var entries = fs.readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var p = path.join(dir, entries[i].name);
      if (entries[i].isDirectory()) total += dirSize(p);
      else { try { total += fs.statSync(p).size; } catch (e) {} }
    }
  } catch (e) {}
  return total;
}
function updaterBusy() { return !!(pendingUpdate && pendingUpdate.ready) || !!downloadWatch; }
function purgeUpdaterCache(reason) {
  var dir = updaterCacheDir();
  if (!dir || !fs.existsSync(dir)) return 0;
  if (updaterBusy()) return 0;
  var before = dirSize(dir);
  try { fs.rmSync(path.join(dir, "pending"), { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(path.join(dir, "installer.exe"), { force: true }); } catch (e) {}
  var after = dirSize(dir);
  var freed = before - after;
  if (freed > 0) diagnostics.log("updater-cache-purged", { ms: freed, reason: String(reason || "") });
  return freed;
}
function purgeStaleUpdaterCache() {
  var dir = updaterCacheDir();
  if (!dir || !fs.existsSync(dir)) return;
  if (updaterBusy()) return;
  var now = Date.now();
  var removed = 0;
  function walk(d) {
    var entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (var i = 0; i < entries.length; i++) {
      var p = path.join(d, entries[i].name);
      if (entries[i].isDirectory()) {
        walk(p);
        try { if (fs.readdirSync(p).length === 0) fs.rmdirSync(p); } catch (e) {}
        continue;
      }
      if (entries[i].name === "update-info.json") continue;
      try {
        var st = fs.statSync(p);
        if (now - st.mtimeMs > UPDATER_CACHE_KEEP_MS) { fs.rmSync(p, { force: true }); removed += st.size; }
      } catch (e) {}
    }
  }
  walk(dir);
  if (removed > 0) diagnostics.log("updater-cache-stale-purged", { ms: removed, reason: "older-than-7d" });
}
function updateStatePath() { return path.join(app.getPath('userData'), 'snowd-update-state.json'); }
function readUpdateState() {
  try { return JSON.parse(fs.readFileSync(updateStatePath(), 'utf8')) || {}; } catch (e) { return {}; }
}
function writeUpdateState(patch) {
  try {
    var state = readUpdateState();
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    fs.writeFileSync(updateStatePath(), JSON.stringify(state));
  } catch (e) { diagnostics.error('update-state-write-failed', e); }
}
function markInstallAttempt(version) {
  writeUpdateState({ pendingVersion: version || null, attemptedAt: Date.now() });
  diagnostics.log('updater-install-attempt', { version: version || '', stage: 'install' });
}
function checkInstallApplied() {
  var state = readUpdateState();
  if (!state || !state.pendingVersion) return;
  var now = Date.now();
  if (app.getVersion() === state.pendingVersion) {
    writeUpdateState({ pendingVersion: null, installedAt: now });
    diagnostics.log('updater-install-applied', { version: app.getVersion(), stage: 'install' });
    try { purgeUpdaterCache('post-install'); } catch (e) { diagnostics.error('updater-cache-purge-failed', e); }
    return;
  }
  if (state.attemptedAt && now - state.attemptedAt < 24 * 3600 * 1000) {
    diagnostics.log('updater-install-not-applied', { version: app.getVersion(), target: state.pendingVersion, stage: 'install' });
    sendUpdateStatus({ status: 'error', message: '上次更新未生效（当前仍为 v' + app.getVersion() + '）。可到设置页手动下载安装包，或导出诊断反馈。' });
  } else {
    writeUpdateState({ pendingVersion: null });
  }
}

function normalizeHttpsUrl(url) {
  if (!url || typeof url !== 'string') return url;
  var u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u.replace(/^\/+/, '');
}

function parseVersionTag(value) {
  var m = String(value || '').match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** a 新于 b 返回 1，相等 0，落后 -1，无法解析返回 null */
function compareVersion(a, b) {
  var left = parseVersionTag(a);
  var right = parseVersionTag(b);
  if (!left || !right) return null;
  for (var i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

function httpsGetJson(url, opts) {
  opts = opts || {};
  var retries = opts.retries != null ? opts.retries : 3;
  var timeout = opts.timeout != null ? opts.timeout : 20000;

  return new Promise(function(resolve, reject) {
    var attempts = 0;

    function tryOnce() {
      attempts += 1;
      var req = https.get(url, {
        headers: { 'User-Agent': 'Snode-rpg', Accept: 'application/json' },
        timeout: timeout,
      }, function(res) {
        var body = '';
        res.on('data', function(chunk) { body += chunk; });
        res.on('end', function() {
          if (res.statusCode >= 500 && attempts < retries) {
            setTimeout(tryOnce, 1500 * attempts);
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error('HTTP ' + res.statusCode + ' ' + url));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('timeout', function() {
        req.destroy();
        if (attempts < retries) {
          setTimeout(tryOnce, 1500 * attempts);
        } else {
          reject(new Error('timeout ' + url));
        }
      });
      req.on('error', function(err) {
        if (attempts < retries) {
          setTimeout(tryOnce, 1500 * attempts);
        } else {
          reject(err);
        }
      });
    }

    tryOnce();
  });
}

function fetchLatestTag(sourceKey) {
  var source = UPDATE_SOURCES[sourceKey];
  if (sourceKey === 'oss') {
    return httpsGetJson(source.latestJson).then(function(data) {
      var tag = data && data.tag;
      if (!tag) throw new Error('无法获取镜像版本信息');
      // feedUrl 来自 CI 写入的 latest.json；若 PUBLIC_BASE 未带 https:// 会导致 autoUpdater 失败
      var feedUrl = normalizeHttpsUrl(data.feedUrl) || source.feed(tag);
      return {
        tag: tag,
        feedUrl: feedUrl,
        source: sourceKey,
      };
    });
  }
  return httpsGetJson(source.api).then(function(data) {
    var tag = data && data.tag_name;
    if (!tag) throw new Error('无法获取版本信息');
    return { tag: tag, feedUrl: source.feed(tag), source: sourceKey };
  });
}

function checkForUpdatesViaGenericFeed(opts) {
  opts = opts || {};
  if (process.platform === 'darwin') return checkForMacUpdates();
  if (updateCheckInFlight && !opts._fromFallback) return Promise.resolve({ outcome: 'busy' });
  updateCheckInFlight = true;

  var order = resolveUpdateOrder(opts);
  var autoFallback = opts.autoFallback !== false && !opts._fromFallback && order.length === 1 && order[0] === 'github';
  updateSession = {
    order: order,
    tried: [],
    phase: opts.phase || (order[0] === 'oss' ? 'mirror' : order.length === 1 ? 'github' : 'full'),
    autoFallback: autoFallback,
    mirrorAttempted: !!opts._fromFallback,
    lastSource: null,
  };

  var checkingMsg = updateSession.phase === 'mirror'
    ? '正在从国内镜像检查更新...'
    : order[0] === 'oss'
      ? '正在从国内镜像检查更新...'
      : '正在检查更新...';

  sendUpdateStatus({
    status: 'checking',
    message: checkingMsg,
  });

  function finishFailed() {
    updateCheckInFlight = false;
    if (autoFallback) {
      return beginMirrorFallback('all sources failed');
    }
    sendUpdateStatus({
      status: 'error',
      message: '无法获取更新信息（已尝试 GitHub 与国内镜像），请稍后重试。',
    });
    return Promise.resolve({ outcome: 'failed' });
  }

  // 源返回的 tag 可能比当前版本还旧（例如某次发布失败、GitHub 上仍停在上一版）。
  // 若直接交给 autoUpdater，会得到"已是最新"的假结论，更新就此静默停滞。
  // 规则：比当前新 -> 立即使用；与当前同版 -> 记为兜底并继续问下一个源；比当前旧 -> 仅作兜底。
  // 全部问完仍无更新时，用兜底源走正常流程（正常显示"已是最新"，不报错）。
  var currentVersion = app.getVersion();
  var fallbackInfo = null;

  function useSource(info, reason) {
    if (updateSession && updateSession.tried.indexOf(info.source) < 0) updateSession.tried.push(info.source);
    updateSession.lastSource = info.source;
    console.log('[更新] 使用 ' + info.source + ' feed: ' + info.feedUrl + ' (' + reason + ')');
    autoUpdater.setFeedURL({ provider: 'generic', url: info.feedUrl });
    return autoUpdater.checkForUpdates();
  }

  function trySource(index) {
    if (index >= order.length) {
      if (fallbackInfo) {
        console.log('[更新] 无高于 ' + currentVersion + ' 的源，改用 ' + fallbackInfo.source + ' 兜底');
        return useSource(fallbackInfo, 'fallback');
      }
      return finishFailed();
    }

    var key = order[index];
    return fetchLatestTag(key).then(function(info) {
      var cmp = compareVersion(info.tag, currentVersion);
      if (cmp === 1) return useSource(info, 'newer');
      if (cmp === null) return useSource(info, 'unparsed');
      if (!fallbackInfo || compareVersion(info.tag, fallbackInfo.tag) === 1) fallbackInfo = info;
      console.log('[更新] ' + key + ' 的 ' + info.tag + ' 不高于当前 ' + currentVersion + '，继续尝试下一个源');
      return trySource(index + 1);
    }).catch(function(err) {
      console.warn('[更新] ' + key + ' 源失败:', err.message || err);
      return trySource(index + 1);
    });
  }

  return trySource(0).then(function(result) {
    if (result && result.outcome === 'failed') return result;
    return { outcome: 'ok' };
  }).catch(function() {
    return finishFailed();
  });
}

/** 启动 / 定时 / 手动「检查更新」：先 GitHub，失败自动走国内镜像全流程 */
async function checkForMacUpdates() {
  if (updateCheckInFlight) return { outcome: 'busy' };
  updateCheckInFlight = true;
  sendUpdateStatus({ status: 'checking', message: '正在检查 Mac 版本更新...' });
  try {
    const release = await httpsGetJson(mirrorConfig.GITHUB_LATEST_API);
    const result = macReleaseUpdate(release, app.getVersion(), process.arch);
    pendingUpdate = result.status === 'available'
      ? { version: result.version, ready: false, url: result.url } : null;
    sendUpdateStatus(result);
    return { outcome: 'ok' };
  } catch (err) {
    // macOS 安装包只托管在 GitHub，镜像无法直接下载；但镜像能判定版本，
    // 于是失败时给出可操作提示，而不是只丢一句网络错误。
    var hint = '';
    try {
      var mirror = await httpsGetJson(mirrorConfig.OSS_LATEST_JSON);
      var mirrorVersion = String((mirror && mirror.tag) || '').replace(/^v/, '');
      if (compareVersion(mirrorVersion, app.getVersion()) === 1) {
        hint = ' 镜像已发布 v' + mirrorVersion + '，可到 ' + mirrorConfig.GITHUB_RELEASE_PAGE + ' 手动下载 Mac 安装包。';
      }
    } catch (mirrorErr) {
      // 镜像也不可用时保留原始错误即可
    }
    sendUpdateStatus({ status: 'error', message: 'Mac 更新检查失败：' + err.message + hint });
    return { outcome: 'failed' };
  } finally {
    updateCheckInFlight = false;
  }
}

function runAutoUpdateCheck() {
  if (PORTABLE_MODE) return runPortableUpdateCheck();
  // 两个源都问：GitHub 尚未发布（Release 缺失或延迟）时，镜像仍能给出正确版本。
  // 链里已含 oss，所以不再依赖"单源 github 失败才回退"那条路径。
  return checkForUpdatesViaGenericFeed({
    sources: ['oss', 'github'],
    autoFallback: false,
    phase: 'mirror',
  });
}


/* ===== 便携版更新（zip 覆盖式）=====
   绕开安装器：清单 portable.json -> 下载 zip -> sha512 -> 解压 -> 应用退出后 robocopy 覆盖 -> 重启 */
var portable = require('./portable-updater.js');
var PORTABLE_MODE = process.platform === 'win32' && process.env.SNODE_UPDATE_MODE !== 'installer';
var portableDownloadToken = null;

function portableManifestUrls() {
  var cfg = require('./update-mirror-config.js');
  var base = String(cfg.OSS_PUBLIC_BASE || '').replace(/\/+$/, '');
  return { oss: base ? base + '/releases/latest/portable.json' : '', github: cfg.GITHUB_LATEST_API || '' };
}

function pickPortableAsset(release) {
  var assets = (release && release.assets) || [];
  for (var i = 0; i < assets.length; i++) {
    if (assets[i] && assets[i].name === 'portable.json') return assets[i].browser_download_url;
  }
  return '';
}

async function fetchPortableManifest(source) {
  var urls = portableManifestUrls();
  if (source === 'oss') {
    if (!urls.oss) throw new Error('OSS base 未配置');
    return portable.parsePortableManifest(await portable.fetchText(urls.oss));
  }
  var rel = JSON.parse(await portable.fetchText(urls.github));
  var assetUrl = pickPortableAsset(rel);
  if (!assetUrl) throw new Error('release 中缺少 portable.json');
  return portable.parsePortableManifest(await portable.fetchText(assetUrl));
}

async function runPortableUpdateCheck() {
  if (updateCheckInFlight) return { outcome: 'busy' };
  updateCheckInFlight = true;
  sendUpdateStatus({ status: 'checking', message: '正在检查更新...' });
  diagnostics.log('portable-check-start', { version: app.getVersion() });
  var sources = ['oss', 'github'];
  var manifest = null;
  var lastErr = null;
  for (var i = 0; i < sources.length; i++) {
    try {
      var m = await fetchPortableManifest(sources[i]);
      if (m) {
        manifest = m;
        diagnostics.log('portable-manifest', { source: sources[i], version: m.version, size: m.size });
        break;
      }
    } catch (e) {
      lastErr = e;
      diagnostics.log('portable-manifest-failed', { source: sources[i], msg: String((e && e.message) || e) });
    }
  }
  updateCheckInFlight = false;
  if (!manifest) {
    sendUpdateStatus({ status: 'error', message: '无法获取更新信息（镜像与 GitHub 均失败）' });
    return { outcome: 'failed' };
  }
  if (portable.compareVersion(manifest.version, app.getVersion()) <= 0) {
    sendUpdateStatus({ status: 'up-to-date', version: app.getVersion(), message: '已是最新版本 v' + app.getVersion() });
    return { outcome: 'up-to-date' };
  }
  pendingUpdate = { version: manifest.version, ready: false, portable: manifest };
  diagnostics.log('portable-update-available', { version: manifest.version, size: manifest.size });
  sendUpdateStatus({ status: 'available', version: manifest.version,
    message: '发现新版本 v' + manifest.version + '（当前 v' + app.getVersion() + '），开始下载' });
  return startPortableDownload();
}

async function startPortableDownload() {
  if (!pendingUpdate || !pendingUpdate.portable || pendingUpdate.ready) return { outcome: 'skip' };
  var m = pendingUpdate.portable;
  var zipFile = path.join(resolveSafeTempDir(), 'Snode-RPG-' + m.version + '-win-x64.zip');
  portableDownloadToken = { cancelled: false };
  diagnostics.log('portable-download-start', { version: m.version, size: m.size });
  sendUpdateStatus({ status: 'downloading', version: m.version, percent: 0, message: '正在下载更新 v' + m.version + '…' });
  try {
    await portable.downloadToFile(m.url, zipFile, {
      token: portableDownloadToken,
      onProgress: function (p) {
        var pct = Math.max(0, Math.min(100, Math.round(p.percent || 0)));
        sendUpdateStatus({ status: 'downloading', version: m.version, percent: pct, message: '正在下载更新 ' + pct + '%' });
      },
    });
    var got = await portable.sha512Base64(zipFile);
    if (m.sha512 && got !== m.sha512) throw new Error('sha512 校验失败');
    pendingUpdate.ready = true;
    pendingUpdate.zipFile = zipFile;
    diagnostics.log('portable-downloaded', { version: m.version, target: zipFile });
    sendUpdateStatus({ status: 'downloaded', version: m.version, message: '更新已下载完成（v' + m.version + '）' });
    if (manualCheckRequested) setTimeout(function () { maybeInstallNow(); }, 400);
    return { outcome: 'downloaded' };
  } catch (e) {
    diagnostics.error('portable-download-failed', e);
    sendUpdateStatus({ status: 'error', message: '下载更新失败：' + String((e && e.message) || e) });
    return { outcome: 'failed' };
  }
}

async function applyPortableUpdate(reason) {
  if (!pendingUpdate || !pendingUpdate.ready || !pendingUpdate.zipFile) {
    sendUpdateStatus({ status: 'error', message: '更新尚未下载完成。' });
    return false;
  }
  var m = pendingUpdate.portable;
  var zipFile = pendingUpdate.zipFile;
  var appDir = path.dirname(process.execPath);
  var stageDir = path.join(resolveSafeTempDir(), 'snode-portable-' + m.version);
  sendUpdateStatus({ status: 'installing', version: m.version, message: '正在准备更新（解压）…' });
  try {
    try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (e) {}
    var ex = portable.extractZip(zipFile, stageDir);
    if (!ex.ok) throw new Error('解压失败：' + (ex.error || ''));
    var exeName = path.basename(process.execPath);
    var root = portable.findExtractRoot(stageDir, exeName);
    if (!root) throw new Error('解压目录里找不到主程序');
    markInstallAttempt(m.version);
    var cmd = portable.buildApplyCommand({ srcDir: root, dstDir: appDir, exePath: path.join(appDir, exeName) });
    portable.spawnDetached(cmd);
    diagnostics.log('portable-apply', { version: m.version, target: appDir, reason: String(reason || '') });
    setTimeout(function () { app.exit(0); }, 300);
    return true;
  } catch (e) {
    diagnostics.error('portable-apply-failed', e);
    sendUpdateStatus({ status: 'error', message: '准备更新失败：' + String((e && e.message) || e) });
    return false;
  }
}

autoUpdater.on('checking-for-update', () => {
  console.log('[更新] 检查中...');
  sendUpdateStatus({ status: 'checking', message: updateSession && updateSession.phase === 'mirror'
    ? '正在从国内镜像检查更新...'
    : '正在检查更新...' });
});
autoUpdater.on('update-available', (info) => {
  console.log('[更新] 发现 v' + info.version + '（等待用户确认下载）');
  var fromMirror = updateSession && (updateSession.phase === 'mirror' || updateSession.lastSource === 'oss');
  pendingUpdate = { version: info.version, ready: false };
  updateCheckInFlight = false;
  sendUpdateStatus({
    status: 'available',
    version: info.version,
    fromMirror: !!fromMirror,
    message: '发现新版本 v' + info.version + '（当前 v' + app.getVersion() + '），即将自动下载',
  });
  /* 策略 B：不再等用户点「下载更新」，直接静默下载 */
  console.log('[更新] 自动开始下载 v' + info.version);
  sendUpdateStatus({ status: 'downloading', version: info.version, percent: 0, message: '正在下载更新 v' + info.version + '…' });
  var downloadGen = resetDownloadWatch(info.version);
  autoUpdater.downloadUpdate(getDownloadToken()).catch(function (err) {
    if (abortedGeneration === downloadGen) return;
    console.error('[更新] 自动下载失败:', err && err.message);
    diagnostics.error('updater-download-failed', err);
    if (tryNextUntriedSource('下载失败：' + ((err && err.message) || '未知错误'))) return;
    sendUpdateStatus({ status: 'error', message: '下载更新失败：' + ((err && err.message) || '未知错误') });
  });
});
autoUpdater.on('update-not-available', () => {
  console.log('[更新] 已是最新版本');
  updateCheckInFlight = false;
  sendUpdateStatus({ status: 'uptodate' });
});
autoUpdater.on('update-downloaded', (info) => {
  console.log('[更新] v' + info.version + ' 下载完成（等待用户确认重启）');
  updateCheckInFlight = false;
  pendingUpdate = { version: info.version, ready: true };
  pendingInstallerFile = info.downloadedFile || null;
  diagnostics.log('updater-downloaded-file', { target: String(pendingInstallerFile || ''), version: info.version });
  sendUpdateStatus({
    status: 'downloaded',
    version: info.version,
    message: '更新已就绪（v' + info.version + '）',
  });
  /* 手动检查 → 立即重启安装（策略 B）；自动检查 → 只提示，退出时由 autoInstallOnAppQuit 安装 */
  if (manualCheckRequested) maybeInstallNow();
});
autoUpdater.on('error', (err) => {
  console.error('[更新] 出错:', err.message);
  diagnostics.error('updater-error-event', err);
  if (tryNextUntriedSource(err && err.message)) return;
  if (updateSession && updateSession.autoFallback && !updateSession.mirrorAttempted) {
    beginMirrorFallback(err.message || 'autoUpdater error');
    return;
  }
  updateCheckInFlight = false;
  sendUpdateStatus({ status: 'error', message: formatUpdateError(err.message || String(err)) });
});

/* ===== 全自动更新（策略 B）=====
   手动检查：发现 → 自动下载 → 下载完「立即重启安装」；自动检查：自动下载但不重启，退出时安装。
   安全网：任一窗口（角色面板）报告有未保存改动时，先提示保存，保存后自动继续安装。 */
var manualCheckRequested = false;
var dirtyWindows = new Set();
app.on('web-contents-created', (_event, wc) => wc.once('destroyed', () => dirtyWindows.delete(wc.id)));
var installPending = false;
function anyDirty() { return dirtyWindows.size > 0; }
function maybeInstallNow() {
  if (!pendingUpdate || !pendingUpdate.ready) return;
  if (anyDirty()) {
    installPending = true;
    sendUpdateStatus({ status: 'waiting-save', version: pendingUpdate.version, message: '检测到未保存的角色改动：保存后将自动重启安装' });
    return;
  }
  installPending = false;
  if (PORTABLE_MODE) { applyPortableUpdate('manual-check'); return; }
  console.log('[更新] 立即重启安装 v' + pendingUpdate.version);
  sendUpdateStatus({ status: 'installing', version: pendingUpdate.version, message: '更新已就绪，正在重启安装…' });
  launchInstallerDelayed('manual-check');
}
ipcMain.on('panel-dirty', (e, flag) => {
  var id = e.sender.id;
  lifecycle.setDirty(e.sender, flag);
  if (flag) { dirtyWindows.add(id); }
  else { dirtyWindows.delete(id); }
  if (!flag && installPending) setTimeout(maybeInstallNow, 300);
});
autoUpdater.on('download-progress', (p) => {
  noteDownloadProgress(p);
  var pct = Math.max(0, Math.min(100, Math.round((p && p.percent) || 0)));
  sendUpdateStatus({ status: 'downloading', percent: pct, version: pendingUpdate ? pendingUpdate.version : '', message: '正在下载更新 ' + pct + '%' });
});

// IPC: 手动检查更新 — GitHub 优先，失败自动镜像
ipcMain.on('check-update', (e, opts) => {
  manualCheckRequested = !!(opts && opts.manual);   // 手动检查：下载完立即重启安装
  runAutoUpdateCheck();
});

// IPC: 用户在启动台确认下载更新（autoDownload=false）
ipcMain.on('download-update', () => {
  if (PORTABLE_MODE) { startPortableDownload(); return; }
  if (process.platform === 'darwin' && pendingUpdate && pendingUpdate.url) {
    shell.openExternal(pendingUpdate.url).catch(err => {
      sendUpdateStatus({ status: 'error', message: '打开下载链接失败：' + err.message });
    });
    sendUpdateStatus({ status: 'available', version: pendingUpdate.version,
      message: '已在浏览器打开 Mac 安装包，下载后退出应用并替换即可更新' });
    return;
  }
  if (!pendingUpdate || pendingUpdate.ready) {
    sendUpdateStatus({ status: 'error', message: '当前没有可下载的更新，请先「检查更新」。' });
    return;
  }
  console.log('[更新] 用户确认下载 v' + pendingUpdate.version);
  sendUpdateStatus({
    status: 'downloading',
    version: pendingUpdate.version,
    message: '正在下载更新 v' + pendingUpdate.version + '...',
  });
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('[更新] 下载失败:', err && err.message);
    sendUpdateStatus({ status: 'error', message: '下载更新失败：' + ((err && err.message) || '未知错误') });
  });
});

// IPC: 用户在启动台确认重启并安装
ipcMain.on('install-update', () => {
  if (PORTABLE_MODE) { applyPortableUpdate('user-confirm'); return; }
  if (!pendingUpdate || !pendingUpdate.ready) {
    sendUpdateStatus({ status: 'error', message: '更新尚未下载完成。' });
    return;
  }
  console.log('[更新] 用户确认重启安装 v' + pendingUpdate.version);
  launchInstallerDelayed('user-confirm');
});

// IPC: 自动更新开关（启动台切换；默认开启）
ipcMain.on('set-auto-update', (event, value) => {
  setAutoUpdateEnabled(!!value);
});
ipcMain.handle('get-auto-update', () => getAutoUpdateEnabled());

// IPC: 性能自检 —— 汇总各进程内存/CPU，便于用户在反馈卡顿时附带真实数据
ipcMain.handle('perf-report', () => {
  try {
    const metrics = app.getAppMetrics();
    const processes = metrics.map(function (m) {
      return {
        pid: m.pid,
        type: m.type,
        memoryMB: Math.round((((m.memory && m.memory.workingSetSize) || 0) / 1024)),
        cpuPercent: m.cpu ? Math.round(m.cpu.percentCPUUsage * 10) / 10 : 0,
      };
    });
    const totalMB = processes.reduce(function (a, p) { return a + p.memoryMB; }, 0);
    return {
      ok: true,
      totalMB: totalMB,
      processes: processes,
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// IPC: 镜像更新 — 直接 OSS 优先全自动下载安装
ipcMain.on('check-update-gitee', () => {
  checkForUpdatesViaGenericFeed({ sources: ['oss', 'github'], autoFallback: false, phase: 'mirror' });
});

ipcMain.on('check-update-mirror', () => {
  checkForUpdatesViaGenericFeed({ sources: ['oss', 'github'], autoFallback: false, phase: 'mirror' });
});

// IPC: 顾问反馈（点赞/点踩）→ ntfy 独立主题，便于沉淀 golden 用例
ipcMain.on('advisor-feedback', (_event, payload) => {
  const https = require('https');
  const data = JSON.stringify(payload || {});
  const options = {
    hostname: 'ntfy.sh',
    port: 443,
    path: '/snowd-advisor-feedback',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Title': 'Advisor Feedback',
      'Content-Length': Buffer.byteLength(data, 'utf8'),
    },
  };
  const req = https.request(options, () => {});
  req.on('error', () => {});
  req.write(data);
  req.end();

  // 同时沉淀到 FC → OSS（与移动端统一收集）
  try {
    const fcBase = String(process.env.ADVISOR_API_BASE || 'https://snode-advisor-qsjpoimdzj.cn-chengdu.fcapp.run').replace(/\/+$/, '');
    const u = new URL(fcBase + '/api/feedback');
    const fcreq = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
      },
    }, () => {});
    fcreq.on('error', () => {});
    fcreq.write(data);
    fcreq.end();
  } catch (err) { /* ignore */ }
});

// IPC: 手动重启
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// IPC: Bug 反馈（主进程发网络请求，避开 file:// 限制）
ipcMain.on('send-bug', (event, { body, channel }) => {
  const https = require('https');
  const data = body;
  const options = {
    hostname: 'ntfy.sh',
    port: 443,
    path: '/snowd-bug-report',
    method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Title': 'Bug Report',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      }
  };
  const req = https.request(options, (res) => {
    event.sender.send(channel, { ok: res.statusCode === 200 });
  });
  req.on('error', () => { event.sender.send(channel, { ok: false }); });
  req.write(data);
  req.end();

  // \u540c\u65f6\u6c89\u6dc0\u5230 FC \u2192 OSS\uff08\u4e0e\u7f51\u9875\u7edf\u4e00\u6536\u96c6\uff09
  try {
    const fcBase = String(process.env.ADVISOR_API_BASE || 'https://snode-advisor-qsjpoimdzj.cn-chengdu.fcapp.run').replace(/\/+$/, '');
    const u = new URL(fcBase + '/api/bug');
    const json = JSON.stringify({
      body: String(body || ''),
      page: 'electron',
      title: 'Bug Report',
      userAgent: 'electron/' + (process.versions.electron || ''),
      ts: Date.now(),
      source: 'desktop',
    });
    const fcreq = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json, 'utf8'),
      },
    }, () => {});
    fcreq.on('error', () => {});
    fcreq.write(json);
    fcreq.end();
  } catch (err) { /* ignore */ }
});



function getAdvisorRoot() {
  const candidates = [
    path.join(__dirname, '..'),
    process.resourcesPath,
    path.join(process.resourcesPath || '', '..'),
  ];
  for (const root of candidates) {
    if (root && fs.existsSync(path.join(root, 'scripts', 'mage-advisor.mjs'))) {
      return root;
    }
  }
  return path.join(__dirname, '..');
}

let _advisorModule = null;
let _snapshotModule = null;
let _envModule = null;
let _wizardModule = null;
let _wizardSyncModule = null;
let _chargenBridgeModule = null;

async function getChargenBridgeModule() {
  if (!_chargenBridgeModule) {
    _chargenBridgeModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-chargen-bridge.mjs')).href);
  }
  return _chargenBridgeModule;
}

let _chargenPolicyModule = null;

async function getChargenPolicyModule() {
  if (!_chargenPolicyModule) {
    _chargenPolicyModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-chargen-policy.mjs')).href);
  }
  return _chargenPolicyModule;
}

async function resolveAdviseQuery(payload) {
  if (payload?.queryKind === 'chargen_bubble' && payload?.chargenState) {
    const policy = await getChargenPolicyModule();
    return policy.buildChargenBubbleQuery(payload.chargenState);
  }
  return payload?.query ? String(payload.query).trim() : '';
}

async function resolveWizardState(payload) {
  if (payload?.wizardState) return payload.wizardState;
  if (payload?.chargenState) {
    const bridge = await getChargenBridgeModule();
    return bridge.chargenToWizardState(payload.chargenState);
  }
  return undefined;
}

async function getAdvisorModule() {
  if (!_advisorModule) {
    _advisorModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'mage-advisor.mjs')).href);
  }
  return _advisorModule;
}

async function getSnapshotModule() {
  if (!_snapshotModule) {
    _snapshotModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-snapshot.mjs')).href);
  }
  return _snapshotModule;
}

async function getEnvModule() {
  if (!_envModule) {
    _envModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-env.mjs')).href);
  }
  return _envModule;
}

async function getWizardModule() {
  if (!_wizardModule) {
    _wizardModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-wizard-api.mjs')).href);
  }
  return _wizardModule;
}

async function getWizardSyncModule() {
  if (!_wizardSyncModule) {
    _wizardSyncModule = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-wizard-sync.mjs')).href);
  }
  return _wizardSyncModule;
}

ipcMain.handle('advisor-advise', async (_event, payload) => {
  try {
    const query = await resolveAdviseQuery(payload || {});
    if (!query) {
      return { ok: false, error: '问题不能为空' };
    }
    const mod = await getAdvisorModule();
    let snapshot = payload.snapshot || null;
    if (snapshot) {
      const snapMod = await getSnapshotModule();
      snapshot = snapMod.normalizeSnapshot(snapshot);
    }
    const wizardState = await resolveWizardState(payload);
    const out = await mod.advise(query, {
      snapshot: snapshot || undefined,
      mode: payload.mode || undefined,
      wizardState: wizardState || undefined,
      chargenState: payload.chargenState || undefined,
      conversationHistory: payload.conversationHistory || undefined,
      sessionId: payload.sessionId || undefined,
      bindingKey: payload.bindingKey || undefined,
      rulesOnlyPlanner: payload.rulesOnlyPlanner === true,
      skipPlanner: payload.skipPlanner === true,
    });
    return {
      ok: true,
      answer: out.answer,
      intent: out.intent,
      mode: out.mode,
      model: out.model,
      resolvedQuery: query,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('advisor-advise-stream', async (event, payload) => {
  try {
    const query = await resolveAdviseQuery(payload || {});
    if (!query) {
      return { ok: false, error: '问题不能为空' };
    }
    const mod = await getAdvisorModule();
    let snapshot = payload.snapshot || null;
    if (snapshot) {
      const snapMod = await getSnapshotModule();
      snapshot = snapMod.normalizeSnapshot(snapshot);
    }
    const wizardState = await resolveWizardState(payload);
    const sender = event.sender;
    const out = await mod.advise(query, {
      snapshot: snapshot || undefined,
      mode: payload.mode || undefined,
      wizardState: wizardState || undefined,
      chargenState: payload.chargenState || undefined,
      conversationHistory: payload.conversationHistory || undefined,
      sessionId: payload.sessionId || undefined,
      bindingKey: payload.bindingKey || undefined,
      rulesOnlyPlanner: payload.rulesOnlyPlanner === true,
      skipPlanner: payload.skipPlanner === true,
      stream: true,
      onDelta: (delta) => {
        if (!sender.isDestroyed()) {
          sender.send('advisor-stream-chunk', { delta, streamId: payload.__streamId });
        }
      },
    });
    return {
      ok: true,
      answer: out.answer,
      intent: out.intent,
      mode: out.mode,
      model: out.model,
      resolvedQuery: query,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('advisor-config', async () => {
  try {
    const envMod = await getEnvModule();
    const cfg = envMod.getAdvisorConfig();
    return { ok: true, configured: !!cfg.apiKey, model: cfg.model };
  } catch (err) {
    return { ok: false, configured: false, error: err.message || String(err) };
  }
});

ipcMain.handle('advisor-wizard', async (_event, payload) => {
  try {
    const method = payload?.method || 'get';
    if (method === 'export' || method === 'import') {
      const sync = await getWizardSyncModule();
      return sync.wizardSyncCall(method, {
        state: payload?.state,
        snapshot: payload?.snapshot,
        panelState: payload?.panelState,
        options: payload?.options,
      });
    }
    const mod = await getWizardModule();
    const result = mod.wizardApiCall(method, {
      state: payload?.state,
      savedState: payload?.savedState,
      patch: payload?.patch,
      action: payload?.action,
    });
    return result;
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.on('js-alert', (event, message) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win) dialog.showMessageBoxSync(win, { type: 'info', title: '提示', message: String(message || ''), buttons: ['确定'] });
  } catch (_) {}
  event.returnValue = true;
});

ipcMain.on('js-confirm', (event, message) => {
  let confirmed = false;
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    if (win) {
      const r = dialog.showMessageBoxSync(win, { type: 'question', title: '确认', message: String(message || ''), buttons: ['确定', '取消'], defaultId: 0, cancelId: 1 });
      confirmed = r === 0;
    }
  } catch (_) {}
  event.returnValue = confirmed;
});

ipcMain.handle('save-export', async (event, payload) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const fileName = String((payload && payload.fileName) || '角色档案.xlsx').replace(/[\/:*?"<>|]/g, '_');
    const result = await dialog.showSaveDialog(win, {
      title: '导出角色档案',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    const buf = Buffer.from(String(payload && payload.base64 || ''), 'base64');
    fs.writeFileSync(result.filePath, buf);
    return { ok: true, canceled: false, filePath: result.filePath };
  } catch (err) {
    return { ok: false, canceled: false, error: err.message || String(err) };
  }
});

ipcMain.handle('advisor-catalog', async (_event, payload) => {
  try {
    const { pathToFileURL } = require('url');
    const mod = await import(pathToFileURL(path.join(getAdvisorRoot(), 'scripts', 'advisor-catalog.mjs')).href);
    const catalog = mod.getAdvancementCatalog(payload?.snapshot || null);
    return { ok: true, catalog };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

/** 注入脚本内容缓存：这些脚本每次导航都要注入，避免重复读盘 */
const PAGE_SCRIPT_CACHE = new Map();
function readPageScript(relativePath) {
  if (PAGE_SCRIPT_CACHE.has(relativePath)) return PAGE_SCRIPT_CACHE.get(relativePath);
  let code = '';
  try {
    const full = path.join(__dirname, relativePath);
    code = fs.readFileSync(full, 'utf8');
  } catch (err) {
    diagnostics.error('optional-script-read-failed', err, { url: pathToFileURL(path.join(__dirname, relativePath)).href });
    code = '';
  }
  PAGE_SCRIPT_CACHE.set(relativePath, code);
  return code;
}
/** 合并注入：一次 executeJavaScript 代替多次；脚本之间用换行分隔，互不影响作用域 */
function injectPageScripts(relativePaths) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const code = relativePaths.map(readPageScript).filter(Boolean).join('\n;\n');
  if (!code) return;
  mainWindow.webContents.executeJavaScript(code).catch(e => diagnostics.error('optional-script-injection-failed', e));
}

/**
 * 内存看门狗：渲染进程 RSS 超阈值时让页面显式 GC（不打断用户操作）。
 * 实测职业页反复切换可在数分钟内堆到 1 GB 并导致渲染进程被杀（白屏），
 * 这里在 600 MB 就介入回收，1.2 GB 仍降不下来则记录告警。
 */
let memoryTimer = null;
const gcWork = new Map();
function startMemoryWatchdog() {
  if (memoryTimer) return;
  memoryTimer = setInterval(async () => {
    let metrics;
    try { metrics = app.getAppMetrics(); }
    catch (e) { diagnostics.error('memory-sample-failed', e); return; }
    diagnostics.log('memory-sample', { mb: Math.round(metrics.reduce((sum, m) => sum + ((m.memory && m.memory.workingSetSize) || 0), 0) / 1024), freeMB: Math.round(os.freemem() / 1048576), windows: BrowserWindow.getAllWindows().length });
    const all = webContents.getAllWebContents().filter(w => !w.isDestroyed());
    const pids = new Set(metrics.map(m => m.pid));
    for (const pid of gcWork.keys()) if (!pids.has(pid)) gcWork.delete(pid);
    for (const m of metrics) {
      if (m.type !== 'Tab' && m.type !== 'Renderer') continue;
      const mb = Math.round(((m.memory && m.memory.workingSetSize) || 0) / 1024);
      const prev = gcWork.get(m.pid);
      if (mb < 600 || (prev && (prev.inFlight || Date.now() - prev.at < 60000))) continue;
      const wc = all.find(w => { try { return !w.isDestroyed() && w.getOSProcessId() === m.pid; } catch (_) { return false; } });
      if (!wc || wc.isCrashed()) continue;
      const task = { at: Date.now(), inFlight: true }; gcWork.set(m.pid, task);
      let timer;
      try {
        await Promise.race([
          wc.executeJavaScript('if(typeof window.gc==="function")window.gc();'),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('GC_TIMEOUT')), 5000); })
        ]);
        diagnostics.log('memory-gc', { pid: m.pid, mb });
        if (mb >= 1200) {
          const idle = [...lifecycle.records.values()].find(r => !r.win.isDestroyed() && r.role === 'preview' && !r.dirty && !r.win.isFocused() && Date.now() - r.lastActivity > 300000);
          if (idle) { diagnostics.log('idle-preview-disposed', { role: idle.role, url: idle.target }); idle.win.destroy(); }
        }
      } catch (e) { diagnostics.error('memory-gc-failed', e, { pid: m.pid, mb }); }
      finally { clearTimeout(timer); task.inFlight = false; }
    }
  }, 20000);
}
let updateTimer = null;
app.on('will-quit', () => {
  if (pendingUpdate && pendingUpdate.ready && !installerLaunched) { try { launchInstallerDelayed('quit'); } catch (e) {} }
  clearInterval(memoryTimer);
  clearTimeout(updateTimer);
  (updateRetryTimers || []).forEach(function (t) { clearTimeout(t); });
  updateRetryTimers = [];
  gcWork.clear();
});
async function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    backgroundColor: '#171b22',
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: '斯诺德跑团',
    icon: path.join(__dirname, '斯诺德跑团', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(process.platform === 'darwin' ? applicationMenu(app, Menu) : null);
  const created = mainWindow;
  lifecycle.attach(created, 'main');
  created.once('closed', () => { if (mainWindow === created) mainWindow = null; });
  diagnostics.log('startup-stage', { stage: 'window-created', windowId: created.id });
  const cacheMarker = path.join(app.getPath('userData'), 'http-cache-version');
  try {
    if (!fs.existsSync(cacheMarker) || fs.readFileSync(cacheMarker, 'utf8') !== app.getVersion()) {
      let cacheTimer;
      await Promise.race([created.webContents.session.clearCache(), new Promise((_, reject) => { cacheTimer = setTimeout(() => reject(new Error('cache timeout')), 5000); })]).finally(() => clearTimeout(cacheTimer));
      fs.writeFileSync(cacheMarker, app.getVersion(), 'utf8');
    }
  } catch (e) { diagnostics.error('http-cache-clear-failed', e); }

  // 中文文件名 / asar 偶发把 .html 导航误判为下载；取消下载并改为页面内打开
  if (created.isDestroyed() || mainWindow !== created) return;
  if (!mainWindow.webContents.session.__snodeDownloadHandler) {
  mainWindow.webContents.session.__snodeDownloadHandler = true;
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const name = item.getFilename() || '';
    const url = item.getURL() || '';
    let decoded = url;
    try { decoded = decodeURIComponent(url); } catch (_) {}
    // xlsx 导出：使用绑定主窗口的原生保存对话框，避免 Chromium 默认下载对话框不可控
    if (/\.xlsx?$/i.test(name) || /\.xlsx?(?:[?#]|$)/i.test(decoded)) {
      event.preventDefault();
      dialog.showSaveDialog(mainWindow, {
        title: '导出角色档案',
        defaultPath: path.join(app.getPath('downloads'), name),
        filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }],
      }).then((result) => {
        if (result.canceled || !result.filePath) { item.cancel(); return; }
        item.setSavePath(result.filePath);
      }).catch(() => {});
      return;
    }
    if (!/\.html?$/i.test(name) && !/\.html?(?:[?#]|$)/i.test(decoded)) return;
    event.preventDefault();
    const target = webContents && !webContents.isDestroyed() ? webContents : mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
    if (!target || target.isDestroyed()) return;
    // 帮助页统一落到 ASCII 文件，避免 file:// 中文路径再次触发下载
    if (/help\.html|\u5e2e\u52a9\.html|%E5%B8%AE%E5%8A%A9/i.test(url + name + decoded)) {
      const owner = BrowserWindow.fromWebContents(target);
      if (owner) {
        const canonical = pathToFileURL(path.join(__dirname, '斯诺德跑团', 'help.html'));
        try { const original = new URL(url); canonical.search = original.search; canonical.hash = original.hash; }
        catch (e) { diagnostics.error('help-url-invalid', e); }
        void lifecycle.safeLoad(owner, canonical.href);
      }
      return;
    }
    if (url.startsWith('file://')) {
      const win = BrowserWindow.fromWebContents(target);
      if (win) void lifecycle.safeLoad(win, url);
    }
  });

  }
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://github.com/') || url.startsWith('https://cdn.jsdelivr.net/')) return;
    if (url.startsWith(mirrorConfig.OSS_PUBLIC_BASE)) return;
    if (url.includes('poker-game')) return; // allow poker-game internal navigation
    if (!url.startsWith('file://')) event.preventDefault();
  });

  // 非对决页注入 Bug 反馈 + Build 顾问
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed() || created !== mainWindow) return;
    const url = created.webContents.getURL();
    if (!lifecycle.internal(url) || url.includes('desktop-error.html')) return;
    // 主世界兜底：Electron 下 alert/confirm 不可见，改写为原生对话框 IPC
    mainWindow.webContents.executeJavaScript(
      '(function(){try{if(window.electronAPI){window.alert=function(m){window.electronAPI.jsAlert(m);};window.confirm=function(m){return !!window.electronAPI.jsConfirm(m);};}}catch(e){}})();'
    ).catch(() => {});
    if (url.includes('poker-game')) return;
    injectPageScripts([
      path.join('斯诺德跑团', 'bug-report.js'),
      path.join('斯诺德跑团', 'user_preferences.js'),
      path.join('斯诺德跑团', 'advisor-tips.js'),
      path.join('斯诺德跑团', 'advisor-widget.js'),
    ]);
  });
  await lifecycle.safeLoad(created, launcherUrl);
  if (pendingFocus && !created.isDestroyed()) { created.focus(); pendingFocus = false; }
}

app.whenReady().then(async () => {
  try {
    const dumpDir = app.getPath('crashDumps');
    fs.mkdirSync(dumpDir, { recursive: true });
    app.setPath('crashDumps', dumpDir);
    crashReporter.start({ uploadToServer: false, compress: true });
  } catch (e) { diagnostics.error('local-crash-dumps-unavailable', e); }
  diagnostics.log('startup-stage', { stage: 'app-ready' });
  try { ensureProcessTemp(); } catch (e) { diagnostics.error('temp-normalize-failed', e); }
  await createWindow();
  try { checkInstallApplied(); } catch (e) { diagnostics.error('update-install-check-failed', e); }
  try { purgeStaleUpdaterCache(); } catch (e) { diagnostics.error('updater-cache-prune-failed', e); }
  try { require('./chargen-cli-server').startChargenCliServer(() => mainWindow, { diagnostics, lifecycle }); }
  catch (e) { diagnostics.error('cli-disabled', e); }
  startMemoryWatchdog();
  if (process.env.SNODE_CLI_TEST !== '1') {
    updateTimer = setTimeout(() => { if (getAutoUpdateEnabled()) runAutoUpdateCheck(); }, 90000);
    scheduleUpdateRetries();
  }
}).catch(fatalMain);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
});
module.exports = { diagnostics, lifecycle, recoveryStore, desktopSettings };
if (process.env.SNODE_CLI_TEST === '1') app.__snodeDesktop = { ...module.exports, fatalMain };
}
