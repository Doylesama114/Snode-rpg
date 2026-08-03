const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkUpdate: () => ipcRenderer.send('check-update'),
  checkUpdateGitee: () => ipcRenderer.send('check-update-mirror'),
  checkUpdateMirror: () => ipcRenderer.send('check-update-mirror'),
  restart: () => ipcRenderer.send('restart-app'),
  getAutoUpdate: () => ipcRenderer.invoke('get-auto-update'),
  setAutoUpdate: (value) => ipcRenderer.send('set-auto-update', value),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  sendAdvisorFeedback: (payload) => ipcRenderer.send('advisor-feedback', payload),
  sendBug: (body) => new Promise((resolve) => {
    const channel = 'bug-response-' + Date.now();
    ipcRenderer.once(channel, (_event, result) => resolve(result));
    ipcRenderer.send('send-bug', { body, channel });
  }),
  advisorAdvise: (payload) => ipcRenderer.invoke('advisor-advise', payload),
  advisorAdviseStream: (payload, onDelta) => new Promise((resolve, reject) => {
    const handler = (_event, data) => {
      if (data && data.delta && onDelta) onDelta(data.delta);
    };
    ipcRenderer.on('advisor-stream-chunk', handler);
    ipcRenderer.invoke('advisor-advise-stream', payload)
      .then((res) => {
        ipcRenderer.removeListener('advisor-stream-chunk', handler);
        resolve(res);
      })
      .catch((err) => {
        ipcRenderer.removeListener('advisor-stream-chunk', handler);
        reject(err);
      });
  }),
  advisorConfig: () => ipcRenderer.invoke('advisor-config'),
  advisorCatalog: (payload) => ipcRenderer.invoke('advisor-catalog', payload || {}),
  advisorWizard: (payload) => ipcRenderer.invoke('advisor-wizard', payload || {}),
});
