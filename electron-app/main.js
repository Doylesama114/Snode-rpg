const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const { bootstrapAdvisorEnv } = require('./advisor-env-bootstrap');
bootstrapAdvisorEnv();
const { autoUpdater } = require('electron-updater');
const mirrorConfig = require('./update-mirror-config');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false; // 手动重启以立即生效
autoUpdater.logger = console;

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

let mainWindow = null;
let updateCheckInFlight = false;
/** @type {{ order: string[], phase: string, autoFallback: boolean, mirrorAttempted: boolean, lastSource: string|null }|null} */
let updateSession = null;

function sendUpdateStatus(data) {
  if (!mainWindow) return;
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
  console.log('[更新] 发现 v' + info.version + '，正在下载...');
  var fromMirror = updateSession && (updateSession.phase === 'mirror' || updateSession.lastSource === 'oss');
  sendUpdateStatus({
    status: 'downloading',
    version: info.version,
    message: fromMirror ? '正在从国内镜像下载 v' + info.version + '...' : '正在下载更新 v' + info.version + '...',
  });
});
autoUpdater.on('update-not-available', () => {
  console.log('[更新] 已是最新版本');
  updateCheckInFlight = false;
  sendUpdateStatus({ status: 'uptodate' });
});
autoUpdater.on('update-downloaded', (info) => {
  console.log('[更新] v' + info.version + ' 下载完成，即将重启...');
  updateCheckInFlight = false;
  sendUpdateStatus({ status: 'downloaded', version: info.version });
  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true);
  }, 3000);
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

// IPC: 手动检查更新 — GitHub 优先，失败自动镜像
ipcMain.on('check-update', () => {
  runAutoUpdateCheck();
});

// IPC: 镜像更新 — 直接 OSS 优先全自动下载安装
ipcMain.on('check-update-gitee', () => {
  checkForUpdatesViaGenericFeed({ sources: ['oss', 'github'], autoFallback: false, phase: 'mirror' });
});

ipcMain.on('check-update-mirror', () => {
  checkForUpdatesViaGenericFeed({ sources: ['oss', 'github'], autoFallback: false, phase: 'mirror' });
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
});

const { pathToFileURL } = require('url');
const fs = require('fs');

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

function injectPageScript(relativePath) {
  const fs = require('fs');
  const full = path.join(__dirname, relativePath);
  if (!fs.existsSync(full)) return;
  mainWindow.webContents.executeJavaScript(fs.readFileSync(full, 'utf8')).catch(() => {});
}

function createWindow() {
  mainWindow = new BrowserWindow({
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
  mainWindow.loadFile(path.join(__dirname, '斯诺德跑团', '启动台.html'));

  // 中文文件名 / asar 偶发把 .html 导航误判为下载；取消下载并改为页面内打开
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const name = item.getFilename() || '';
    const url = item.getURL() || '';
    let decoded = url;
    try { decoded = decodeURIComponent(url); } catch (_) {}
    if (!/\.html?$/i.test(name) && !/\.html?(?:[?#]|$)/i.test(decoded)) return;
    event.preventDefault();
    const target = webContents && !webContents.isDestroyed() ? webContents : mainWindow.webContents;
    if (!target || target.isDestroyed()) return;
    // 帮助页统一落到 ASCII 文件，避免 file:// 中文路径再次触发下载
    if (/help\.html|\u5e2e\u52a9\.html|%E5%B8%AE%E5%8A%A9/i.test(url + name + decoded)) {
      target.loadFile(path.join(__dirname, '\u65af\u8bfa\u5fb7\u8dd1\u56e2', 'help.html')).catch(() => {});
      return;
    }
    if (decoded.startsWith('file://')) {
      let fp = decoded.replace(/^file:\/\//i, '');
      if (/^\/[A-Za-z]:/.test(fp)) fp = fp.slice(1);
      fp = decodeURIComponent(fp).replace(/\//g, path.sep);
      target.loadFile(fp).catch(() => {});
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://github.com/') || url.startsWith('https://cdn.jsdelivr.net/')) return;
    if (url.startsWith(mirrorConfig.OSS_PUBLIC_BASE)) return;
    if (url.includes('poker-game')) return; // allow poker-game internal navigation
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/') || url.startsWith('https://cdn.jsdelivr.net/')) {
      return { action: 'allow' };
    }
    if (url.startsWith(mirrorConfig.OSS_PUBLIC_BASE)) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  // 非对决页注入 Bug 反馈 + Build 顾问
  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    if (url.includes('poker-game')) return;
    injectPageScript(path.join('斯诺德跑团', 'bug-report.js'));
    injectPageScript(path.join('斯诺德跑团', 'advisor-widget.js'));
  });
}

app.whenReady().then(() => {
  createWindow();

  // 启动时自动检查更新（GitHub → 失败则自动国内镜像下载安装）
  // 每次启动后自动检查更新（已去除定时检查，避免频繁提示）
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => runAutoUpdateCheck(), 3000);
  });
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
