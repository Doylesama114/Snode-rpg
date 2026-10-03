'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { RecoveryStore } = require('./electron-app/recovery-store');
const { root, launch, js, navigate, waitFor } = require('./scripts/desktop_test_helpers.cjs');
async function crash(app, id) {
  await app.evaluate(({ BrowserWindow, app }, id) => {
    const win = id ? BrowserWindow.fromId(id) : [...app.__snodeDesktop.lifecycle.records.values()].find(r => r.role === 'main').win;
    win.webContents.forcefullyCrashRenderer();
  }, id);
}
(async () => {
  const temp = fs.mkdtempSync(path.join(root, '_scratch', 'desktop-store-'));
  try {
    const store = new RecoveryStore(temp, { maxBytes: 1024 });
    const identity = { module: 'panel', character: 'same-name%角色', slot: 2 };
    const snapshot = { skills: [{ uid: 'u-1', src: '战士', id: 'zs-test', custom: true }], raw: '< & >', pending: { data: 3 } };
    assert.equal(store.write(identity, snapshot).seq, 1);
    assert.deepEqual(store.read(identity).snapshot, snapshot);
    assert.throws(() => store.write(identity, { large: 'x'.repeat(3000) }), /容量/);
    assert.deepEqual(store.read(identity).snapshot, snapshot);
    assert.throws(() => store.clear(identity, 99), /更新/);
    fs.writeFileSync(store.file(identity), '{invalid');
    assert.throws(() => store.write(identity, {}));
    assert.equal(fs.readFileSync(store.file(identity), 'utf8'), '{invalid');
    console.log('PASS atomic store, UID/raw fields, capacity, stale discard and corruption preservation');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  const test = await launch();
  try {
    const formal = { name: '恢复测试', classes: [{ name: '法师', level: 1 }], skills: [{ uid: 'u-formal', n: '自定义能力', src: '战士', id: 'custom', resolution: 'custom', effect: 'old effect', occupies: false }], talent_tree: [{ uid: 't-1', n: '同名天赋', src: '谋士', id: 'ms-test', effect: 'original' }], _savedAt: '2026-09-01T00:00:00.000Z' };
    await js(test.app, 'localStorage.setItem("char_恢复%测试_slot2",' + JSON.stringify(JSON.stringify(formal)) + ')');
    await navigate(test.app, '斯诺德跑团/角色面板.html', { char: '恢复%测试', slot: 2 });
    await waitFor(test.app, () => js(test.app, '!!window.desktopRecovery && !!window.state && CURRENT_SLOT === 2'));
    // Ensure asynchronous recovery initialization has finished.
    await new Promise(resolve => setTimeout(resolve, 500));
    const ack = await js(test.app, '(async function(){state.skills[0].effect="完整召唤物数据 & < >";state.skills[0].uid="u-preserved";state.skills[0].src="战士";state.skills[0].id="custom";state.skills[0].custom={unit:{hp:19}};state.skills[0].via="特殊专长";state.skills[0].place="兼职";state.pendingAbilityIssues=[{uid:"u-pending",resolution:"deferred"}];autoSave();return await desktopRecovery.flush();})()');
    assert.equal(ack.ok, true); assert.equal(ack.seq, 1);
    const before = await js(test.app, 'localStorage.getItem("char_恢复%测试_slot2")');
    const started = Date.now(); await crash(test.app);
    await waitFor(test.app, () => js(test.app, '!!document.getElementById("desktopRecoveryPrompt")'), 15000);
    assert.equal(await js(test.app, 'localStorage.getItem("char_恢复%测试_slot2")'), before);
    await js(test.app, 'document.getElementById("desktopRestoreDraft").click();void 0');
    const restored = await js(test.app, 'getStateSnapshot()');
    assert.equal(restored.skills[0].uid, 'u-preserved'); assert.equal(restored.skills[0].src, '战士');
    assert.equal(restored.skills[0].custom.unit.hp, 19); assert.equal(restored.skills[0].effect, '完整召唤物数据 & < >');
    assert.equal(restored.skills[0].via, '特殊专长'); assert.equal(restored.skills[0].place, '兼职');
    assert.equal(restored.talent_tree[0].uid, 't-1');
    assert.equal(restored.pendingAbilityIssues[0].uid, 'u-pending');
    assert.equal(await js(test.app, 'CURRENT_SLOT'), 2);
    console.log('PASS real main renderer crash: restore prompt in ' + (Date.now() - started) + ' ms; formal save + slot + UID/source/custom fields preserved');
    await js(test.app, 'desktopRecovery.flush()');
    assert.equal(await js(test.app, 'saveState(2)'), true);
    await waitFor(test.app, () => js(test.app, 'window.electronAPI.recoveryRead({module:"panel",character:"恢复%测试",slot:2}).then(r=>r.ok&&!r.draft)'));
    assert.equal((JSON.parse(await js(test.app, 'localStorage.getItem("char_恢复%测试_slot2")'))).skills[0].uid, 'u-preserved');
    console.log('PASS manual save clears only the matching recovery draft');

    // Before ACK: immediately crash in the debounce window.
    await js(test.app, 'state.skills[0].effect="UNACKED";autoSave();void 0');
    await crash(test.app);
    await waitFor(test.app, () => js(test.app, 'typeof window.getStateSnapshot==="function" && !document.getElementById("desktopRecoveryPrompt")'));
    assert.equal(await js(test.app, 'state.skills[0].effect'), '完整召唤物数据 & < >');
    console.log('PASS pre-ACK crash leaves the last formal save intact');
    await crash(test.app);
    await waitFor(test.app, () => js(test.app, 'location.href.includes("desktop-error.html")'));
    assert.match(await js(test.app, 'document.body.innerText'), /停止自动恢复/);
    console.log('PASS three crashes stop the reload loop');

    await navigate(test.app, '斯诺德跑团/启动台.html');
    await js(test.app, 'void window.open("../职业页/法师.html#fs-test","_blank")');
    const childId = await waitFor(test.app, () => test.app.evaluate(({ BrowserWindow, app }) => {
      const rec = [...app.__snodeDesktop.lifecycle.records.values()].find(r => r.role === 'preview');
      return rec ? rec.win.id : false;
    }));
    await waitFor(test.app, () => js(test.app, 'document.querySelectorAll("article.skill").length>0', childId));
    const childStart = Date.now(); await crash(test.app, childId);
    await waitFor(test.app, () => js(test.app, '!!document.getElementById("__snowdRecoverBanner")', childId), 15000);
    assert.equal(await js(test.app, 'location.hash', childId), '#fs-test');
    console.log('PASS real child window renderer recovery + hash (' + (Date.now() - childStart) + ' ms)');
    await test.app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).destroy(), childId);

    await navigate(test.app, '斯诺德跑团/角色创建页.html');
    await new Promise(resolve => setTimeout(resolve, 500));
    const createdAck = await js(test.app, '(async function(){CHAR.charName="建卡恢复测试";CHAR.className="战士";autosaveChargenDraft();return await desktopRecovery.flush();})()');
    assert.equal(createdAck.ok, true);
    await crash(test.app);
    await waitFor(test.app, () => js(test.app, '!!document.getElementById("desktopRecoveryPrompt")'));
    await js(test.app, 'document.getElementById("desktopRestoreDraft").click();void 0');
    assert.equal(await js(test.app, 'CHAR.charName'), '建卡恢复测试');
    console.log('PASS character creation uses existing snapshot + explicit recovery prompt');

    // Responsive cancels the native window's hang timer; close clears the same timer.
    await test.app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.emit('unresponsive'); w.emit('responsive'); });
    const hanging = await test.app.evaluate(({ BrowserWindow, app }) => {
      const w = BrowserWindow.getAllWindows()[0]; return !!app.__snodeDesktop.lifecycle.records.get(w.webContents.id).hangTimer;
    });
    assert.equal(hanging, true); // Timer object exists but has been canceled.
    await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('unresponsive'));
    console.log('PASS transient hang/close path preserves drafts (no forced reload)');
  } catch (error) {
    console.error(await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({id:w.id,url:w.webContents.getURL(),preload:w.webContents.getLastWebPreferences().preload}))));
    console.error(fs.readFileSync(path.join(test.profile,'diagnostics','desktop.log'),'utf8').slice(-3500));
    throw error;
  } finally { await test.close(); }
  console.log('Desktop recovery checks passed');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
