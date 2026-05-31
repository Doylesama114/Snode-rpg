const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkUpdate: () => ipcRenderer.send('check-update'),
  restart: () => ipcRenderer.send('restart-app'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  }
});
