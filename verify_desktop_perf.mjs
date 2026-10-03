import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { launch, navigate, js, waitFor, root } = require('./scripts/desktop_test_helpers.cjs');
const test = await launch();
const samples = [];
try {
  const seed = Array.from({ length: 20 }, (_, i) => ({
    name: '性能测试角色' + i, classes: [{ name: '法师', level: 10 }],
    skills: Array.from({ length: 30 }, (_, j) => ({ uid: 'perf-' + i + '-' + j, n: '自定义能力' + j, resolution: 'custom', effect: '代表性较长说明。'.repeat(100) })),
    _savedAt: '2026-09-01T00:00:00.000Z'
  }));
  await js(test.app, 'var seed=' + JSON.stringify(seed) + ';seed.forEach(function(c,i){localStorage.setItem("char_perf"+i+"_slot1",JSON.stringify(c));});void 0');
  const routes = ['职业页/法师.html', '职业页/牧师.html', '斯诺德跑团/角色面板.html', '职业页/首页.html', '斯诺德跑团/启动台.html'];
  for (let i = 0; i < 50; i++) {
    assert.equal(await navigate(test.app, routes[i % routes.length], i % routes.length === 2 ? { char: 'perf0', slot: 1 } : null), true);
    try {
      await waitFor(test.app, () => test.app.evaluate(({ app }) => [...app.__snodeDesktop.lifecycle.records.values()].some(r => r.role === 'main' && r.lastGood === r.target && !r.wc.isLoading())));
    } catch (error) {
      console.error('iteration', i, await test.app.evaluate(({ app }) => [...app.__snodeDesktop.lifecycle.records.values()].map(r => ({role:r.role,target:r.target,lastGood:r.lastGood,url:r.wc.getURL(),loading:r.wc.isLoading(),error:r.showingError}))));
      console.error(fs.readFileSync(path.join(test.profile,'diagnostics','desktop.log'),'utf8').slice(-2200));
      throw error;
    }
    if (i % 5 === 4) {
      const sample = await test.app.evaluate(({ app, BrowserWindow }) => {
        const metrics = app.getAppMetrics();
        return { iteration: 0, workingSetMB: Math.round(metrics.reduce((a, m) => a + ((m.memory && m.memory.workingSetSize) || 0), 0) / 1024), windows: BrowserWindow.getAllWindows().length };
      });
      sample.iteration = i + 1; samples.push(sample);
      assert.equal(sample.windows, 1);
    }
    if ((i + 1) % 10 === 0) console.log('navigation ' + (i + 1) + '/50');
  }
  for (let i = 0; i < 20; i++) {
    await js(test.app, 'void window.open("../职业页/法师.html#perf' + i + '","_blank")');
    const childId = await waitFor(test.app, () => test.app.evaluate(({ app }) => {
      const r = [...app.__snodeDesktop.lifecycle.records.values()].find(r => r.role === 'preview' && r.lastGood);
      return r ? r.win.id : false;
    }));
    await test.app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).destroy(), childId);
    assert.equal(await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    if ((i + 1) % 5 === 0) console.log('preview open/close ' + (i + 1) + '/20');
  }
  // Preview limit excludes the main window and hidden CLI tasks, and does not close an editor.
  for (const name of ['法师', '牧师', '战士']) {
    await js(test.app, 'void window.open("../职业页/' + name + '.html","_blank")');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(await test.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 3);
  const alive = await test.app.evaluate(({ app }) => [...app.__snodeDesktop.lifecycle.records.values()].length);
  assert.equal(alive, 3);
  const runtime = await test.app.evaluate(() => ({ electron: process.versions.electron, chrome: process.versions.chrome }));
  const result = {
    runtime, machine: { platform: os.platform(), release: os.release(), totalRAMMiB: Math.round(os.totalmem() / 1048576), freeRAMMiB: Math.round(os.freemem() / 1048576) },
    sequence: '50 navigation + 20 preview open/close + preview limit', storedCharacters: 20, abilitiesPerCharacter: 30,
    characterJSONBytes: Buffer.byteLength(JSON.stringify(seed)), samples,
    note: 'Working set sum includes shared pages. No OS memory limit is simulated; SNODE_TEST_HEAP_MB optionally limits V8 heap only.'
  };
  // Fail on a strong sustained-growth signal; do not mistake ordinary cache warming for a leak.
  const warm = samples[2].workingSetMB, end = samples.at(-1).workingSetMB;
  assert.ok(end < warm + 400, 'sustained growth above 400 MiB after warmup');
  const output = path.join(root, '_scratch', 'desktop-perf-' + runtime.electron + (process.env.SNODE_TEST_HEAP_MB ? '-heap' + process.env.SNODE_TEST_HEAP_MB : '') + '.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  console.log('Desktop performance checks passed');
} finally { await test.close(); }
