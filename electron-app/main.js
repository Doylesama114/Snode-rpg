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
    autoUpdater.quitAndInstall(false, true);
  }, 3000);
});
autoUpdater.on('error', (err) => {
  console.error('[更新] 出错:', err.message);
  sendUpdateStatus({ status: 'error', message: err.message });
});

// IPC: 手动检查更新
ipcMain.on('check-update', () => {
  sendUpdateStatus({ status: 'checking' });
  autoUpdater.checkForUpdates();
});

// IPC: 从 Gitee 国内镜像更新
ipcMain.on('check-update-gitee', () => {
  sendUpdateStatus({ status: 'downloading', version: 'gitee' });
  // 从 Gitee 下载 latest.yml 获取最新版本信息
  const https = require('https');
  https.get('https://gitee.com/Doylesama007/Snode-rpg/releases/latest', { headers: { 'User-Agent': 'Snowd-Updater' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      // 重定向到 GitHub 下载（Gitee release 附件下载速度慢）
      const match = data.match(/\/Doylesama007\/Snode-rpg\/releases\/tag\/(v[\d.]+)/);
      if (match) {
        sendUpdateStatus({ status: 'checking' });
        autoUpdater.checkForUpdates(); // 回退到 GitHub 检查
      } else {
        autoUpdater.checkForUpdates();
      }
    });
  }).on('error', () => {
    autoUpdater.checkForUpdates();
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
    if (url.startsWith('https://doylesama114.github.io/') || url.startsWith('https://github.com/') || url.startsWith('https://gitee.com/')) return;
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://doylesama114.github.io/') || url.startsWith('https://github.com/') || url.startsWith('https://gitee.com/')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  // 所有页面注入 Bug 反馈按钮
  mainWindow.webContents.on('did-finish-load', () => {
    const brPath = path.join(__dirname, '斯诺德跑团', 'bug-report.js');
    const fs = require('fs');
    if (fs.existsSync(brPath)) {
      mainWindow.webContents.executeJavaScript(fs.readFileSync(brPath, 'utf8')).catch(() => {});
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  // 不再自动检查更新 — 用户通过启动台手动点击"检查更新"触发
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
