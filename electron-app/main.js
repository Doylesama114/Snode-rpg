const { app, BrowserWindow, Menu, ipcMain, dialog, webContents, crashReporter } = require('electron');
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
const { RecoveryStore } = require('./recovery-store');
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
  let data = {};
  const file = settingsFilePath();
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  data.compatibilityMode = !!enabled;
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(file + '.tmp', file);
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
autoUpdater.autoInstallOnAppQuit = true;  // 已下载的更新在退出时自动安装（策略 B：手动检查走立即重启）
autoUpdater.logger = { info: () => diagnostics.log('updater-info'), warn: () => diagnostics.log('updater-warning'), error: e => diagnostics.error('updater-error', e), debug: () => {} };

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
/** @type {{ order: string[], phase: string, autoFallback: boolean, mirrorAttempted: boolean, lastSource: string|null }|null} */
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
  autoUpdateEnabledCache = !!value;
  try {
    const file = settingsFilePath();
    let data = {};
    if (fs.existsSync(file)) {
      try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = {}; }
    }
    data.autoUpdate = autoUpdateEnabledCache;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[设置] 保存自动更新开关失败:', e.message);
  }
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

function normalizeHttpsUrl(url) {
  if (!url || typeof url !== 'string') return url;
  var u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://' + u.replace(/^\/+/, '');
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
  if (updateCheckInFlight && !opts._fromFallback) return Promise.resolve({ outcome: 'busy' });
  updateCheckInFlight = true;

  var order = resolveUpdateOrder(opts);
  var autoFallback = opts.autoFallback !== false && !opts._fromFallback && order.length === 1 && order[0] === 'github';
  updateSession = {
    order: order,
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

  function trySource(index) {
    if (index >= order.length) {
      return finishFailed();
    }

    var key = order[index];
    return fetchLatestTag(key).then(function(info) {
      updateSession.lastSource = key;
      console.log('[更新] 使用 ' + key + ' feed: ' + info.feedUrl);
      autoUpdater.setFeedURL({ provider: 'generic', url: info.feedUrl });
      return autoUpdater.checkForUpdates();
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
function runAutoUpdateCheck() {
  return checkForUpdatesViaGenericFeed({
    sources: ['github'],
    autoFallback: true,
    phase: 'github',
  });
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
  autoUpdater.downloadUpdate().catch(function (err) {
    console.error('[更新] 自动下载失败:', err && err.message);
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
  console.log('[更新] 立即重启安装 v' + pendingUpdate.version);
  sendUpdateStatus({ status: 'installing', version: pendingUpdate.version, message: '更新已就绪，正在重启安装…' });
  setTimeout(function () { autoUpdater.quitAndInstall(true, true); }, 400);
}
ipcMain.on('panel-dirty', (e, flag) => {
  var id = e.sender.id;
  lifecycle.setDirty(e.sender, flag);
  if (flag) { dirtyWindows.add(id); }
  else { dirtyWindows.delete(id); }
  if (!flag && installPending) setTimeout(maybeInstallNow, 300);
});
autoUpdater.on('download-progress', (p) => {
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
  if (!pendingUpdate || !pendingUpdate.ready) {
    sendUpdateStatus({ status: 'error', message: '更新尚未下载完成。' });
    return;
  }
  console.log('[更新] 用户确认重启安装 v' + pendingUpdate.version);
  autoUpdater.quitAndInstall(true, true);
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
          sender.send('advisor-stream-chunk', { delta });
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
app.on('will-quit', () => { clearInterval(memoryTimer); clearTimeout(updateTimer); gcWork.clear(); });
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

  Menu.setApplicationMenu(null);
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
  await createWindow();
  try { require('./chargen-cli-server').startChargenCliServer(() => mainWindow, { diagnostics, lifecycle }); }
  catch (e) { diagnostics.error('cli-disabled', e); }
  startMemoryWatchdog();
  if (process.env.SNODE_CLI_TEST !== '1') {
    updateTimer = setTimeout(() => { if (getAutoUpdateEnabled()) runAutoUpdateCheck(); }, 90000);
  }
}).catch(fatalMain);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
});
module.exports = { diagnostics, lifecycle, recoveryStore };
if (process.env.SNODE_CLI_TEST === '1') app.__snodeDesktop = { ...module.exports, fatalMain };
}
