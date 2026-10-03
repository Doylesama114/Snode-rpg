'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { launch, js, waitFor, navigate } = require('./scripts/desktop_test_helpers.cjs');
(async () => {
  const test = await launch({}, profile => {
    fs.mkdirSync(path.join(profile, 'chargen-cli-connection.json'));
    fs.mkdirSync(path.join(profile, 'bad-env'));
    process.env.SNOWD_ENV_FILE = path.join(profile, 'bad-env');
  });
  try {
    assert.equal(await js(test.app, '!!document.getElementById("desktopToolsToggle")'), true);
    await js(test.app, 'document.getElementById("desktopToolsToggle").click();void 0');
    assert.match(await js(test.app, 'document.body.innerText'), /桌面诊断与恢复/);
    await js(test.app, 'document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));void 0');
    assert.equal(await js(test.app, '!!window.electronAPI && typeof window.electronAPI.recoveryWrite === "function"'), true);
    const childExits = await Promise.all(Array.from({ length: 10 }, () => new Promise((resolve, reject) => {
      const child = spawn(test.executablePath, test.args, { env: test.env, windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); reject(new Error('duplicate instance did not exit')); }, 15000);
      child.on('error', reject); child.on('exit', code => { clearTimeout(timer); resolve(code); });
    })));
    childExits.forEach(code => assert.equal(code, 0));
    assert.equal(await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    console.log('PASS startup + 10 duplicate launches + advisor/CLI isolation');

    await navigate(test.app, '斯诺德跑团/does-not-exist.html');
    await waitFor(test.app, () => js(test.app, 'location.href.includes("desktop-error.html")'));
    assert.match(await js(test.app, 'document.body.innerText'), /重试此页/);
    await js(test.app, 'void window.electronAPI.desktopAction("launcher")');
    await waitFor(test.app, () => js(test.app, '!!document.getElementById("desktopTools")'));
    console.log('PASS missing page error view + return to launcher');

    const appRoot = await test.app.evaluate(({ app }) => app.getAppPath());
    const scratchPage = path.join(appRoot, '斯诺德跑团', '_desktop_broken_test.html');
    // Packaged resources cannot be mutated; script-preflight injection is a source-only test.
    if (!process.env.SNODE_PACKAGED_EXE) {
      fs.writeFileSync(scratchPage, '<html><body>test<script src="_missing_required.js"></script></body></html>');
      try {
        await navigate(test.app, '斯诺德跑团/_desktop_broken_test.html');
        await waitFor(test.app, () => js(test.app, 'location.href.includes("desktop-error.html")'));
      } finally { fs.unlinkSync(scratchPage); }
      console.log('PASS missing required script preflight');
    }
    await navigate(test.app, '斯诺德跑团/启动台.html');
    const setting = await js(test.app, 'window.electronAPI.setCompatibilityMode(true)');
    assert.equal(setting.ok, true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(test.profile, 'snowd-settings.json'), 'utf8')).compatibilityMode, true);
    assert.equal(await js(test.app, 'window.electronAPI.desktopStatus().then(s=>s.compatibilityMode)'), false);
    await test.app.evaluate(({ app }) => {
      app.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed', exitCode: 12 });
    });
    const exported = path.join(test.profile, 'export.jsonl');
    await test.app.evaluate(async ({ app }, file) => {
      const entry = app.__snodeDesktop;
      entry.diagnostics.log('redaction-test', { url: 'file:///test/角色面板.html?char=secret-character&token=SECRET', snapshot: 'PRIVATE_DRAFT', token: 'PRIVATE_TOKEN', code: 'TEST' });
      entry.diagnostics.exportTo(file);
    }, exported);
    const text = fs.readFileSync(exported, 'utf8');
    for (const secret of ['secret-character', 'SECRET', 'PRIVATE_DRAFT', 'PRIVATE_TOKEN']) assert.equal(text.includes(secret), false);
    assert.match(text, /cli-connection-write-failed/); assert.match(text, /advisor-config-unreadable/); assert.match(text, /"type":"GPU"/);
    console.log('PASS compatibility setting + GPU event classification + redacted export');

    // Closing a main window while a child remains, then starting again creates exactly one new main.
    await js(test.app, 'void window.open("../职业页/法师.html","_blank")');
    await waitFor(test.app, () => test.app.evaluate(({ app }) => [...app.__snodeDesktop.lifecycle.records.values()].some(r=>r.role==='preview'&&r.lastGood)));
    await test.app.evaluate(({ app }) => [...app.__snodeDesktop.lifecycle.records.values()].find(r => r.role === 'main').win.destroy());
    await new Promise((resolve, reject) => {
      const child = spawn(test.executablePath, test.args, { env: test.env, windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); reject(new Error('second instance unexpectedly remained running')); }, 10000);
      child.once('error', reject); child.once('exit', code => { clearTimeout(timer); resolve(code); });
    });
    await waitFor(test.app, () => test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 2));
    console.log('PASS main window recreation with a child still open');
  } finally { await test.close(); delete process.env.SNOWD_ENV_FILE; }

  const compatible = await launch({ compatibilityMode: true });
  try {
    assert.equal(await js(compatible.app, 'window.electronAPI.desktopStatus().then(s=>s.compatibilityMode)'), true);
    console.log('PASS compatibility rendering applies on next startup');
  } finally { await compatible.close(); }
  console.log('Desktop startup checks passed');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
