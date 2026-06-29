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

  // 所有页面注入 Bug 反馈按钮
  mainWindow.webContents.on('did-finish-load', () => {
    const loadBugReport = (dir) => {
      const brPath = path.join(__dirname, dir, 'bug-report.js');
      const fs = require('fs');
      if (fs.existsSync(brPath)) {
        mainWindow.webContents.executeJavaScript(fs.readFileSync(brPath, 'utf8')).catch(() => {});
      }
    };
    loadBugReport('斯诺德跑团');
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
