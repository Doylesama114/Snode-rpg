const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;

function sendUpdateStatus(data) {
  if (!mainWindow) return;
  try {
    var code = "try{document.getElementById('updateMsg').innerHTML='";
    if (data.status === 'downloading') {
      code += "<span style=\\\"color:#a46d1f\\\">正在下载更新 v" + (data.version || '') + "...</span>";
    } else if (data.status === 'downloaded') {
      code += "<span style=\\\"color:#2e7d32\\\">新版本 v" + (data.version || '') + " 已就绪，重启后生效</span>";
    } else if (data.status === 'error') {
      code += "<span style=\\\"color:#c62828\\\">更新出错：" + (data.message || '') + "</span>";
    } else if (data.status === 'uptodate') {
      code += "<span style=\\\"color:#69706b\\\">已是最新版本</span>";
    }
    code += "';}catch(e){}";
    mainWindow.webContents.executeJavaScript(code);
  } catch(e) {}
}

autoUpdater.on('checking-for-update', () => console.log('[更新] 检查中...'));
autoUpdater.on('update-available', (info) => {
  console.log('[更新] 发现 v' + info.version + '，正在下载...');
  sendUpdateStatus({ status: 'downloading', version: info.version });
});
autoUpdater.on('update-not-available', () => {
  console.log('[更新] 已是最新版本');
  sendUpdateStatus({ status: 'uptodate' });
});
autoUpdater.on('update-downloaded', (info) => {
  console.log('[更新] v' + info.version + ' 下载完成，重启后生效');
  sendUpdateStatus({ status: 'downloaded', version: info.version });
});
autoUpdater.on('error', (err) => {
  console.error('[更新] 出错:', err.message);
  sendUpdateStatus({ status: 'error', message: err.message });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: '斯诺德跑团',
    icon: path.join(__dirname, '斯诺德跑团', 'favicon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, '斯诺德跑团', '启动台.html'));

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https://doylesama114.github.io/')) return;
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://doylesama114.github.io/') || url.startsWith('https://github.com/')) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
