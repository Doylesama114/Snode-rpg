const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkUpdate: () => ipcRenderer.send('check-update'),
  checkUpdateGitee: () => ipcRenderer.send('check-update-gitee'),
  restart: () => ipcRenderer.send('restart-app'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  sendBug: (body) => new Promise((resolve) => {
    const channel = 'bug-response-' + Date.now();
    ipcRenderer.once(channel, (_event, result) => resolve(result));
    ipcRenderer.send('send-bug', { body, channel });
  })
});
