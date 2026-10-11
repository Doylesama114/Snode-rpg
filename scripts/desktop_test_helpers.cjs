'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '..');
// 模块级守卫：任何脚本 require 本模块时，先确认 executablePath 是真 Electron 且可启动；
// 不可用时给出可读原因（可用 SNODE_ALLOW_MISSING_DESKTOP=1 在无桌面环境明确跳过）。
var __electronGuardDone = false, __probeSkipPackaged = false;
function __resolveElectronExe() {
  try { return process.env.SNODE_PACKAGED_EXE || process.env.SNODE_DESKTOP_ELECTRON_EXE || require(path.join(root, "electron-app/node_modules/electron")); } catch (e) { return ""; }
}
(function __electronGuard() {
  if (__electronGuardDone) return;
  __electronGuardDone = true;
  // 打包产物（SNODE_PACKAGED_EXE）不是 Electron 二进制，不能用 --version 探测；其正确性由测试本身校验。
  if (process.env.SNODE_PACKAGED_EXE) { console.log('[desktop-test] 打包模式: 跳过 Electron 版本探测 → ' + process.env.SNODE_PACKAGED_EXE); __probeSkipPackaged = true; return; }
  var exe = __resolveElectronExe();
  if (!exe) { console.warn("[desktop-test] 未找到 Electron 可执行文件"); return; }
  var probe = probeElectron(exe);
  if (probe.looksElectron && !probe.looksNode && probe.status === 0) { console.log("[desktop-test] Electron 可用: " + probe.out); return; }
  var why = probe.looksNode ? ("以 Node 身份运行（ELECTRON_RUN_AS_NODE 生效）: " + probe.out) : ("无法启动 exit=" + probe.status + (probe.err ? " stderr: " + probe.err.slice(0, 160) : ""));
  var msg = "[desktop-test] Electron 不可用: " + why;
  if (process.env.SNODE_ALLOW_MISSING_DESKTOP === "1") { console.warn(msg + " → SNODE_ALLOW_MISSING_DESKTOP=1，跳过桌面测试并退出 0"); process.exit(0); }
  console.error(msg);
  console.error("[desktop-test] 提示：无桌面环境可设 SNODE_ALLOW_MISSING_DESKTOP=1；CI 可用仓库变量 SKIP_DESKTOP_CHECK=1 跳过本步。");
  process.exit(3);
})();

process.env.electron_config_cache = process.env.electron_config_cache || path.join(os.tmpdir(), 'electron-cache');
// 守卫：先确认 executablePath 真的是可用的 Electron（而不是 Node 退化 / 启动即崩）
function probeElectron(executablePath) {
  const { spawnSync } = require("child_process");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(executablePath, ["--version"], { encoding: "utf-8", timeout: 60000, env, windowsHide: true });
  const out = String(r.stdout || "").trim();
  const err = String(r.stderr || "").trim();
  return { status: r.status, out, err, looksElectron: /^v?\d+\.\d+\.\d+/.test(out), looksNode: /^v2[0-9]\./.test(out) };
}
function assertElectronRunnable(executablePath) {
  const p = probeElectron(executablePath);
  if (p.looksElectron && !p.looksNode && p.status === 0) return p;
  const why = p.looksNode
    ? "该可执行文件以 Node 身份运行（ELECTRON_RUN_AS_NODE 生效）：" + p.out
    : "Electron 无法启动（exit=" + p.status + "）" + (p.err ? " stderr: " + p.err.slice(0, 200) : "");
  const allow = process.env.SNODE_ALLOW_MISSING_DESKTOP === "1";
  const msg = "[desktop-test] Electron 不可用：" + why + " | executablePath=" + executablePath;
  if (allow) { console.warn(msg + " → SNODE_ALLOW_MISSING_DESKTOP=1，跳过桌面测试"); process.exit(0); }
  const e = new Error(msg + " → 可在无桌面环境用 SNODE_ALLOW_MISSING_DESKTOP=1 跳过");
  e.desktopUnavailable = true;
  throw e;
}
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
