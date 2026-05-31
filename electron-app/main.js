const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

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

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Load the 首页.html
  win.loadFile(path.join(__dirname, '斯诺德跑团', '启动台.html'));

  // Prevent navigation away from local files
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Handle new window creation (e.g. target="_blank" links)
  win.webContents.setWindowOpenHandler(({ url }) => {
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
