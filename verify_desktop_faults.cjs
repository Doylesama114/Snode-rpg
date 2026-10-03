'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { launch, navigate, js, waitFor } = require('./scripts/desktop_test_helpers.cjs');
async function call(profile, op) {
  const connection = JSON.parse(fs.readFileSync(path.join(profile, 'chargen-cli-connection.json'), 'utf8'));
  const response = await fetch('http://127.0.0.1:' + connection.port + '/v1/call', {
    method: 'POST', headers: { Authorization: 'Bearer ' + connection.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(op), signal: AbortSignal.timeout(30000)
  });
  return response.json();
}
(async () => {
  const blocked = await launch({}, profile => {
    fs.writeFileSync(path.join(profile, 'diagnostics'), 'blocked-directory');
    fs.writeFileSync(path.join(profile, 'recovery-drafts'), 'blocked-directory');
  });
  try {
    assert.equal(await js(blocked.app, 'electronAPI.desktopStatus().then(s=>s.diagnosticsDegraded)'), true);
    const formal = { name: '权限测试', classes: [{ name: '战士', level: 1 }], skills: [] };
    await js(blocked.app, 'localStorage.setItem("char_permission_slot1",' + JSON.stringify(JSON.stringify(formal)) + ')');
    await navigate(blocked.app, '斯诺德跑团/角色面板.html', { char: 'permission', slot: 1 });
    await new Promise(r => setTimeout(r, 300));
    const ack = await js(blocked.app, '(async function(){state.name="权限测试改动";autoSave();return desktopRecovery.flush();})()');
    assert.equal(ack.ok, false);
    assert.equal(await js(blocked.app, 'JSON.parse(localStorage.getItem("char_permission_slot1")).name'), '权限测试');
    assert.match(await js(blocked.app, 'document.getElementById("desktopRecoveryStatus").textContent'), /未完成|失败|权限/);
    console.log('PASS unwritable diagnostics fallback + recovery write failure preserves formal save');
  } finally { await blocked.close(); }
  const test = await launch({}, null, { dialogs: true });
  try {
    await js(test.app, 'localStorage.setItem("char_hang_slot1",JSON.stringify({name:"挂起测试",classes:[{name:"战士",level:1}],skills:[]}))');
    await navigate(test.app, '斯诺德跑团/角色面板.html', { char: 'hang', slot: 1 });
    await new Promise(r => setTimeout(r, 300));
    await js(test.app, 'state.name="挂起时未保存";autoSave();desktopRecovery.flush()');
    await test.app.evaluate(({ app, dialog }) => {
      app.__promptCount = 0; app.__promptResponse = 0;
      dialog.showMessageBox = async () => { app.__promptCount++; return { response: app.__promptResponse }; };
    });
    await test.app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.emit('unresponsive'); w.emit('responsive'); });
    await new Promise(r => setTimeout(r, 6200));
    assert.equal(await test.app.evaluate(({ app }) => app.__promptCount), 0);
    await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('unresponsive'));
    await waitFor(test.app, () => test.app.evaluate(({ app }) => app.__promptCount === 1), 8000);
    assert.equal(await js(test.app, 'state.name'), '挂起时未保存');
    assert.equal(await js(test.app, 'JSON.parse(localStorage.getItem("char_hang_slot1")).name'), '挂起测试');
    await test.app.evaluate(({ BrowserWindow, app }) => { app.__promptResponse = 1; BrowserWindow.getAllWindows()[0].emit('unresponsive'); });
    await waitFor(test.app, () => js(test.app, '!!document.getElementById("desktopRecoveryPrompt")'), 12000);
    console.log('PASS responsive cancellation + dirty hang waits; explicit recovery retains acknowledged draft');
    await js(test.app, 'document.getElementById("desktopDiscardDraft").click();void 0');
    await navigate(test.app, '斯诺德跑团/启动台.html');

    await waitFor(test.app, () => fs.existsSync(path.join(test.profile, 'chargen-cli-connection.json')));
    // Hold a hidden CLI renderer call forever; the real task timeout must destroy it and release the queue.
    await test.app.evaluate(({ app }) => {
      app.once('browser-window-created', (_e, w) => { w.webContents.executeJavaScript = () => new Promise(() => {}); });
    });
    const began = Date.now();
    const failed = await call(test.profile, { op: 'flow' });
    assert.equal(failed.ok, false); assert.match(failed.error, /超时/);
    assert.ok(Date.now() - began < 26000);
    const ping = await call(test.profile, { op: 'ping' });
    assert.equal(ping.ok, true);
    assert.equal(await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    console.log('PASS real CLI renderer task timeout + window disposal + queue remains usable');

    await test.app.evaluate(({ app }) => {
      setTimeout(() => app.__snodeDesktop.fatalMain(new Error('PRIVATE_FATAL_SECRET')), 20);
    });
    await new Promise(resolve => test.app.process().exitCode !== null ? resolve() : test.app.process().once('exit', resolve));
    assert.equal(test.app.process().exitCode, 1);
    const log = fs.readFileSync(path.join(test.profile, 'diagnostics', 'desktop.log'), 'utf8');
    assert.match(log, /main-fatal/); assert.equal(log.includes('PRIVATE_FATAL_SECRET'), false);
    console.log('PASS main fatal exception writes metadata and exits with code 1');
  } finally { await test.close(); }
  console.log('Desktop fault checks passed');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
