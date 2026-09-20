const { app, BrowserWindow } = require('electron');
const path = require('path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 900 });
  await win.loadFile(path.join(__dirname, '..', '斯诺德跑团', 'tests.html'));
  await new Promise(r => setTimeout(r, 6000));
  const summary = await win.webContents.executeJavaScript('document.getElementById("summary").innerText');
  console.log('SUMMARY: ' + summary);
  const failCount = await win.webContents.executeJavaScript('document.querySelectorAll(".fail").length');
  console.log('FAIL_ROWS: ' + failCount);
  app.exit(failCount === 0 ? 0 : 1);
});
