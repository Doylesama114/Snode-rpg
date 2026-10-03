'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '..');
process.env.electron_config_cache = process.env.electron_config_cache || path.join(os.tmpdir(), 'electron-cache');
async function launch(settings = {}, setup, options = {}) {
  const scratch = path.join(root, '_scratch'); fs.mkdirSync(scratch, { recursive: true });
  const profile = fs.mkdtempSync(path.join(scratch, 'desktop-test-'));
  fs.writeFileSync(path.join(profile, 'snowd-settings.json'), JSON.stringify({ autoUpdate: false, ...settings }));
  if (setup) await setup(profile);
  const executablePath = process.env.SNODE_PACKAGED_EXE || process.env.SNODE_DESKTOP_ELECTRON_EXE || require(path.join(root, 'electron-app/node_modules/electron'));
  const args = process.env.SNODE_PACKAGED_EXE ? ['--user-data-dir=' + profile] : [path.join(root, 'electron-app'), '--user-data-dir=' + profile];
  const env = { ...process.env, SNODE_CLI_TEST: '1', SNODE_TEST_DIALOGS: options.dialogs ? '1' : '0', SNODE_CLI_TEST_USER_DATA: profile, TEMP: os.tmpdir(), TMP: os.tmpdir() };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ executablePath, args, env, timeout: 30000 });
    await waitFor(app, async () => await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      return !!w && !w.webContents.isDestroyed() && !w.webContents.isLoading() && w.webContents.getURL().includes('.html');
    }));
  } catch (e) {
    if (app) {
      await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});
      await app.close().catch(() => {});
    }
    if (path.dirname(profile) === scratch && path.basename(profile).startsWith('desktop-test-')) fs.rmSync(profile,{recursive:true,force:true});
    throw e;
  }
  const processId = app.process().pid;
  return {
    app, profile, env, executablePath, args,
    async close() {
      const fallback = path.join(os.tmpdir(), 'snode-diagnostics-' + processId);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(w => w.destroy())).catch(() => {});
      await app.close().catch(() => {});
      if (path.dirname(fallback) !== path.resolve(os.tmpdir()) || !path.basename(fallback).startsWith('snode-diagnostics-')) throw new Error('unsafe diagnostic cleanup');
      fs.rmSync(fallback, { recursive: true, force: true });
      // Only the unique test profile is removed; user's default profile is never touched.
      if (path.dirname(profile) !== scratch || !path.basename(profile).startsWith('desktop-test-')) throw new Error('unsafe cleanup path');
      for (let n = 0; n < 20; n++) {
        try { fs.rmSync(profile, { recursive: true, force: true }); break; }
        catch (e) { if (n === 19) throw e; await new Promise(resolve => setTimeout(resolve, 100)); }
      }
    }
  };
}
async function waitFor(app, predicate, timeout = 10000) {
  const start = Date.now(); let last;
  while (Date.now() - start < timeout) {
    try { const value = await predicate(); if (value) return value; } catch (e) { last = e; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('desktop wait timed out' + (last ? ': ' + last.message : ''));
}
async function js(app, source, id) {
  return app.evaluate(async ({ BrowserWindow, app }, data) => {
    const w = data.id ? BrowserWindow.fromId(data.id) : [...app.__snodeDesktop.lifecycle.records.values()].find(r => r.role === 'main').win;
    if (!w || w.isDestroyed() || w.webContents.isDestroyed() || w.webContents.isCrashed() || w.webContents.isLoading()) return null;
    let timer;
    return Promise.race([w.webContents.executeJavaScript(data.source, true), new Promise(resolve => { timer = setTimeout(() => resolve(null), 2000); })]).finally(() => clearTimeout(timer));
  }, { source, id });
}
async function navigate(app, relative, query, hash = '') {
  const appRoot = await app.evaluate(({ app }) => app.getAppPath());
  const url = require('url').pathToFileURL(path.join(appRoot, relative));
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.hash = hash;
  return app.evaluate(async ({ BrowserWindow, app }, url) => app.__snodeDesktop.lifecycle.safeLoad([...app.__snodeDesktop.lifecycle.records.values()].find(r => r.role === 'main').win, url), url.href);
}
module.exports = { root, launch, waitFor, js, navigate };
