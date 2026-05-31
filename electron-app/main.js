const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Auto-update 配置
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: '斯诺德跑团',
    icon: path.join(__dirname, '斯诺德跑团', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '斯诺德跑团', '启动台.html'));

  // Sentry 注入 — 在 renderer 进程中初始化
  win.webContents.on('did-finish-load', () => {
    const sentryPath = path.join(__dirname, '斯诺德跑团', 'sentry-loader.js');
    const fs = require('fs');
    if (fs.existsSync(sentryPath)) {
      win.webContents.executeJavaScript(fs.readFileSync(sentryPath, 'utf8'));
    }
  });

  // 允许导航到 GitHub Pages（用户手动打开网页版）
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://doylesama114.github.io/')) {
      // 允许导航到项目网页版
      return;
    }
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://doylesama114.github.io/')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });
}

// 自动更新事件
autoUpdater.on('checking-for-update', () => console.log('[更新] 检查中...'));
autoUpdater.on('update-available', () => console.log('[更新] 发现新版本，正在下载...'));
autoUpdater.on('update-not-available', () => console.log('[更新] 已是最新版本'));
autoUpdater.on('update-downloaded', () => {
  console.log('[更新] 下载完成，重启后生效');
  // 可在此处通知用户：新版本已就绪，关闭应用即可更新
});
autoUpdater.on('error', (err) => console.error('[更新] 出错:', err.message));

app.whenReady().then(() => {
  createWindow();
  // 启动时检查更新
  autoUpdater.checkForUpdatesAndNotify();
  // 每4小时检查一次
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
