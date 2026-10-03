const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:') contextBridge.exposeInMainWorld('electronAPI', {
  recoveryWrite: payload => ipcRenderer.invoke('recovery-write', payload),
  recoveryRead: identity => ipcRenderer.invoke('recovery-read', identity),
  recoveryClear: payload => ipcRenderer.invoke('recovery-clear', payload),
  recoveryList: () => ipcRenderer.invoke('recovery-list'),
  recoveryDiscard: payload => ipcRenderer.invoke('recovery-discard', payload),
  desktopStatus: () => ipcRenderer.invoke('desktop-status'),
  desktopAction: action => ipcRenderer.invoke('desktop-action', action),
  exportDiagnostics: () => ipcRenderer.invoke('desktop-export-diagnostics'),
  setCompatibilityMode: enabled => ipcRenderer.invoke('desktop-compatibility', !!enabled),
  checkUpdate: (manual) => ipcRenderer.send('check-update', { manual: !!manual }),
  checkUpdateGitee: () => ipcRenderer.send('check-update-mirror'),
  checkUpdateMirror: () => ipcRenderer.send('check-update-mirror'),
  restart: () => ipcRenderer.send('restart-app'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  setPanelDirty: (flag) => ipcRenderer.send('panel-dirty', !!flag),
  getAutoUpdate: () => ipcRenderer.invoke('get-auto-update'),
  perfReport: () => ipcRenderer.invoke('perf-report'),
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
  saveExport: (fileName, base64) => ipcRenderer.invoke('save-export', { fileName, base64 }),
  jsAlert: (message) => ipcRenderer.sendSync('js-alert', String(message == null ? '' : message)),
  jsConfirm: (message) => ipcRenderer.sendSync('js-confirm', String(message == null ? '' : message)),
});

window.addEventListener('error', event => { if (location.protocol === 'file:') ipcRenderer.send('desktop-renderer-error', { url: event.filename || location.href, type: 'script' }); });
window.addEventListener('unhandledrejection', () => { if (location.protocol === 'file:') ipcRenderer.send('desktop-renderer-error', { url: location.href, type: 'promise' }); });
