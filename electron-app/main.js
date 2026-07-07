const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const { bootstrapAdvisorEnv } = require('./advisor-env-bootstrap');
bootstrapAdvisorEnv();
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false; // 手动重启以立即生效
autoUpdater.logger = console;

const UPDATE_SOURCES = {
  github: {
    api: 'https://api.github.com/repos/Doylesama114/Snode-rpg/releases/latest',
    feed: (tag) => 'https://github.com/Doylesama114/Snode-rpg/releases/download/' + tag + '/',
  },
  gitee: {
    api: 'https://gitee.com/api/v5/repos/Doylesama007/Snode-rpg/releases/latest',
    feed: (tag) => 'https://gitee.com/Doylesama007/Snode-rpg/releases/download/' + tag + '/',
  },
};

let mainWindow = null;
let updateCheckInFlight = false;

function sendUpdateStatus(data) {
  if (!mainWindow) return;
  mainWindow.webContents.send('update-status', data);
}

function formatUpdateError(msg) {
  if (!msg) return '更新检查失败';
  if (msg.indexOf('504') >= 0 || msg.indexOf('Gateway Time-out') >= 0 || msg.indexOf('Gateway Timeout') >= 0) {
    return 'GitHub 暂时超时（504），请稍后重试或点击「镜像下载」。';
  }
  if (msg.indexOf('403') >= 0 || msg.indexOf('Forbidden') >= 0 || msg.indexOf('restricted') >= 0) {
    return 'GitHub 访问受限（403），请使用「镜像下载」或稍后重试。';
  }
  if (msg.indexOf('ENOTFOUND') >= 0 || msg.indexOf('ETIMEDOUT') >= 0 || msg.indexOf('timeout') >= 0) {
    return '网络连接失败，请检查网络后重试。';
  }
  if (msg.length > 120) {
    return '更新检查失败，请稍后重试或使用「镜像下载」。';
  }
  return msg;
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
  return httpsGetJson(source.api).then(function(data) {
    var tag = data && data.tag_name;
    if (!tag) throw new Error('无法获取版本信息');
    return { tag: tag, feedUrl: source.feed(tag), source: sourceKey };
  });
}

function checkForUpdatesViaGenericFeed(opts) {
  opts = opts || {};
  if (updateCheckInFlight) return Promise.resolve();
  updateCheckInFlight = true;

  var order = opts.preferGitee
    ? ['gitee', 'github']
    : ['github', 'gitee'];

  sendUpdateStatus({ status: 'checking', message: opts.preferGitee ? '正在从镜像源检查更新...' : '正在检查更新...' });

  function trySource(index) {
    if (index >= order.length) {
      updateCheckInFlight = false;
      sendUpdateStatus({
        status: 'error',
        message: '无法获取更新信息，请稍后重试或点击「镜像下载」。',
      });
      return Promise.resolve();
    }

    var key = order[index];
    return fetchLatestTag(key).then(function(info) {
      console.log('[更新] 使用 ' + key + ' feed: ' + info.feedUrl);
      autoUpdater.setFeedURL({ provider: 'generic', url: info.feedUrl });
      return autoUpdater.checkForUpdates();
    }).catch(function(err) {
      console.warn('[更新] ' + order[index] + ' 源失败:', err.message || err);
      return trySource(index + 1);
    });
  }

  return trySource(0).finally(function() {
    updateCheckInFlight = false;
  });
}

autoUpdater.on('checking-for-update', () => {
  console.log('[更新] 检查中...');
  sendUpdateStatus({ status: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  console.log('[更新] 发现 v' + info.version + '，正在下载...');
  sendUpdateStatus({ status: 'downloading', version: info.version });
});
autoUpdater.on('update-not-available', () => {
  console.log('[更新] 已是最新版本');
  sendUpdateStatus({ status: 'uptodate' });
});
autoUpdater.on('update-downloaded', (info) => {
  console.log('[更新] v' + info.version + ' 下载完成，即将重启...');
  sendUpdateStatus({ status: 'downloaded', version: info.version });
  // 3 秒后自动重启
  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true);
  }, 3000);
});
autoUpdater.on('error', (err) => {
  console.error('[更新] 出错:', err.message);
  sendUpdateStatus({ status: 'error', message: formatUpdateError(err.message || String(err)) });
});

// IPC: 手动检查更新（GitHub API + generic latest.yml，避免 GitHub HTML 504）
ipcMain.on('check-update', () => {
  checkForUpdatesViaGenericFeed({ preferGitee: false });
});

// IPC: 镜像更新 — 优先 Gitee，失败回退 GitHub
ipcMain.on('check-update-gitee', () => {
  checkForUpdatesViaGenericFeed({ preferGitee: true });
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

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://github.com/') || url.startsWith('https://cdn.jsdelivr.net/')) return;
    if (url.includes('poker-game')) return; // allow poker-game internal navigation
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://github.com/') || url.startsWith('https://cdn.jsdelivr.net/')) {
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

  // 启动时自动检查更新（延迟避免阻塞启动；走 API+latest.yml，不抓 GitHub HTML）
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => checkForUpdatesViaGenericFeed({ preferGitee: false }), 3000);
  });

  // 定时检查更新（每4小时）
  setInterval(() => checkForUpdatesViaGenericFeed({ preferGitee: false }), 4 * 60 * 60 * 1000);
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
