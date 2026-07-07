const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false; // 手动重启以立即生效

let mainWindow = null;

function sendUpdateStatus(data) {
  if (!mainWindow) return;
  mainWindow.webContents.send('update-status', data);
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
  var msg = err.message || '';
  // GitHub 403 rate-limit: give user-friendly message
  if (msg.indexOf('403') >= 0 || msg.indexOf('Forbidden') >= 0 || msg.indexOf('restricted') >= 0) {
    msg = 'GitHub 访问受限（403），可能是请求频率过高。请稍后重试，或使用启动台"镜像下载"按钮手动更新。';
  }
  sendUpdateStatus({ status: 'error', message: msg });
});

// IPC: 手动检查更新
ipcMain.on('check-update', () => {
  sendUpdateStatus({ status: 'checking' });
  autoUpdater.checkForUpdates();
});

// IPC: 镜像更新 - 用 GitHub Release 直链触发自动更新
ipcMain.on('check-update-gitee', () => {
  sendUpdateStatus({ status: 'checking', message: '正在获取最新版本...' });
  const https = require('https');
  https.get('https://api.github.com/repos/Doylesama114/Snode-rpg/releases/latest', {
    headers: { 'User-Agent': 'Snode-rpg' }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const tag = data.tag_name;
        if (!tag) { sendUpdateStatus({ status: 'error', message: '无法获取版本信息' }); return; }
        // 用 GitHub Release 直链作为 feed（走 objects.githubusercontent.com CDN）
        const feedUrl = 'https://github.com/Doylesama114/Snode-rpg/releases/download/' + tag + '/';
        autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
        autoUpdater.checkForUpdates();
      } catch(e) {
        sendUpdateStatus({ status: 'error', message: '版本信息解析失败' });
      }
    });
  }).on('error', () => {
    sendUpdateStatus({ status: 'error', message: '网络连接失败，请稍后重试' });
  });
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

ipcMain.handle('advisor-advise', async (_event, payload) => {
  try {
    if (!payload || !payload.query || !String(payload.query).trim()) {
      return { ok: false, error: '问题不能为空' };
    }
    const mod = await getAdvisorModule();
    let snapshot = payload.snapshot || null;
    if (snapshot) {
      const snapMod = await getSnapshotModule();
      snapshot = snapMod.normalizeSnapshot(snapshot);
    }
    const out = await mod.advise(String(payload.query).trim(), { snapshot: snapshot || undefined });
    return {
      ok: true,
      answer: out.answer,
      intent: out.intent,
      model: out.model,
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

  // 启动时自动检查更新（延迟避免阻塞启动）
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  });

  // 定时检查更新（每4小时）
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
