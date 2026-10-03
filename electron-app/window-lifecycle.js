'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');

function createWindowLifecycle({ app, BrowserWindow, dialog, diagnostics, root, launcher, hidden, preload, allowTestDialogs = false, onPageReady = () => {} }) {
  const records = new Map();
  const errorUrl = pathToFileURL(path.join(root, 'desktop-error.html')).href;
  let quitting = false;
  const alive = rec => !quitting && !rec.win.isDestroyed() && !rec.wc.isDestroyed();
  function internal(url) {
    try {
      const file = path.resolve(fileURLToPath(new URL(url)));
      const rel = path.relative(root, file);
      return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    } catch (_) { return false; }
  }
  function role(url) {
    if (!internal(url)) return 'external';
    const file = fileURLToPath(new URL(url));
    if (/角色面板\.html$/.test(file)) return 'editor';
    if (/角色创建页\.html$/.test(file)) return 'creator';
    if (file.startsWith(path.join(root, '职业页') + path.sep)) return 'preview';
    return 'local';
  }
  function cleanTimers(rec) {
    clearTimeout(rec.loadTimer); clearTimeout(rec.waitTimer); clearTimeout(rec.hangTimer);
  }
  function banner(rec, text) {
    if (!alive(rec)) return;
    rec.wc.executeJavaScript('(function(){' +
      'var old=document.getElementById("__snowdRecoverBanner");if(old)old.remove();' +
      'var d=document.createElement("div");d.id="__snowdRecoverBanner";d.textContent=' + JSON.stringify(text) + ';' +
      'd.style.cssText="position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#795416;color:white;padding:12px;border-radius:6px;font:14px system-ui;max-width:90%";' +
      'document.body.appendChild(d);setTimeout(function(){d.remove();},12000);})()'
    ).catch(e => diagnostics.error('recovery-banner-failed', e, { windowId: rec.win.id }));
  }
  function show(rec) { if (alive(rec) && !hidden && rec.role !== 'cli') rec.win.show(); }
  async function fail(rec, message) {
    if (!alive(rec) || rec.role === 'cli' || rec.role === 'external') return;
    cleanTimers(rec);
    if (rec.dirty && !rec.recovering && !rec.wc.isCrashed() && !rec.showingError) {
      // A slow optional resource must never discard a live editor's unacknowledged input.
      diagnostics.log('dirty-page-load-failure', { windowId: rec.win.id, role: rec.role, url: rec.target, seq: rec.durableSeq });
      rec.wc.stop();
      banner(rec, '页面加载未完成。当前未保存改动已保留，请先保存再重试或离开。');
      show(rec);
      return;
    }
    if (rec.showingError) return;
    rec.showingError = true; rec.recovering = false; rec.message = message;
    diagnostics.log('window-error-view', { windowId: rec.win.id, role: rec.role, url: rec.target });
    try {
      await rec.wc.loadURL(errorUrl);
      show(rec);
    } catch (e) {
      diagnostics.error('error-view-failed', e);
      show(rec);
      if (!hidden) dialog.showErrorBox('斯诺德跑团无法加载', message + '\n请重新安装，已有角色和恢复草稿不会被清空。');
    }
  }
  function preflight(url) {
    if (!internal(url)) return;
    const file = fileURLToPath(new URL(url));
    const html = fs.readFileSync(file, 'utf8');
    if (!fs.statSync(preload).isFile()) throw new Error('桌面桥接文件不可读');
    for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const src = match[1];
      if (/^(https?:|data:|\/\/)/i.test(src)) continue;
      const script = fileURLToPath(new URL(src, url));
      if (!fs.statSync(script).isFile()) throw new Error('必要脚本不可读');
    }
  }
  function begin(rec, url) {
    cleanTimers(rec);
    rec.generation++; rec.unresponsive = false; const generation = rec.generation;
    if (url === errorUrl) return;
    rec.showingError = false;
    rec.target = url;
    if (rec.role !== 'cli' && rec.role !== 'main') rec.role = role(url);
    if (!internal(url)) return;
    if (rec.role === 'cli') return;
    rec.waitTimer = setTimeout(() => {
      if (!alive(rec) || rec.generation !== generation) return;
      diagnostics.log('page-still-loading', { windowId: rec.win.id, url });
      if (!hidden && !rec.waitingPrompt) {
        rec.waitingPrompt = true;
        dialog.showMessageBox(rec.win, { type: 'info', message: '页面仍在加载', detail: '可以继续等待；超过等待上限将显示恢复界面。', buttons: ['继续等待'] })
          .catch(e => diagnostics.error('waiting-prompt-failed', e))
          .finally(() => { rec.waitingPrompt = false; });
      }
    }, 10000);
    rec.loadTimer = setTimeout(() => {
      if (alive(rec) && rec.generation === generation) void fail(rec, '页面加载超时。请重试或导出诊断。');
    }, 30000);
  }
  async function safeLoad(win, url) {
    const rec = attach(win);
    if (!alive(rec)) return false;
    if (rec.target && rec.target !== url && !rec.recovering) rec.retries = [];
    rec.target = url; rec.showingError = false;
    const generation = rec.generation;
    try {
      preflight(url);
      await rec.wc.loadURL(url);
      return alive(rec) && !rec.showingError;
    } catch (e) {
      if (!alive(rec) || e.code === 'ERR_ABORTED' || e.errno === -3) return false;
      diagnostics.error('page-load-rejected', e, { windowId: win.id, url });
      if (rec.target === url && rec.generation <= generation + 1) await fail(rec, '页面或必要脚本无法读取。请重试，或重新安装软件。');
      return false;
    }
  }
  async function usable(rec, generation, url) {
    if (url === errorUrl) {
      try {
        preflight(url);
        const ready = await rec.wc.executeJavaScript('!!window.__desktopErrorReady');
        if (!ready) throw new Error('error view not ready');
        show(rec);
      } catch (e) {
        diagnostics.error('error-view-unusable', e);
        show(rec);
        if (!hidden) dialog.showErrorBox('斯诺德跑团无法加载', '恢复界面也无法运行，请重新安装。角色存档与恢复草稿仍被保留。');
      }
      return;
    }
    if (!internal(url) || rec.role === 'cli') return;
    try {
      preflight(url);
      const check = rec.wc.executeJavaScript('(function(){' +
        'if(!document.body||!document.body.textContent.trim()||!window.electronAPI)return false;' +
        'var p=decodeURIComponent(location.pathname);' +
        'if(/角色面板\\.html$/.test(p))return typeof window.render==="function"&&!!window.snowdPanel;' +
        'if(/角色创建页\\.html$/.test(p))return typeof buildCreationSnapshot==="function";' +
        'if(/启动台\\.html$/.test(p))return !!document.querySelector("#boardNotes a")&&!!document.querySelector("#counterPlanks a");return true;})()');
      let timeout;
      const valid = await Promise.race([check, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('usability timeout')), 5000); })]).finally(() => clearTimeout(timeout));
      if (!alive(rec) || generation !== rec.generation || rec.showingError) return;
      if (!valid) throw new Error('page not usable');
      cleanTimers(rec); rec.lastGood = url; rec.lastActivity = Date.now();
      if (!['editor', 'creator'].includes(role(url))) { rec.dirty = false; onPageReady(rec.wc); }
      diagnostics.log('page-ready', { windowId: rec.win.id, role: rec.role, url });
      show(rec);
      if (rec.recovering) {
        rec.recovering = false;
        banner(rec, ['editor', 'creator'].includes(role(url))
          ? '页面已恢复。请确认恢复草稿；最后确认的恢复点之后的输入可能未保存。'
          : '页面刚刚发生异常，已自动恢复。');
      }
    } catch (e) {
      if (alive(rec) && generation === rec.generation) {
        diagnostics.error('page-usability-failed', e, { url });
        await fail(rec, '页面关键内容或桌面桥接未就绪。请重试或导出诊断。');
      }
    }
  }
  function recover(rec, reason) {
    if (!alive(rec) || rec.role === 'external' || rec.role === 'cli') return;
    const now = Date.now();
    rec.retries = rec.retries.filter(t => now - t < 60000);
    if (rec.retries.length >= 2) { void fail(rec, '此页一分钟内连续异常，已停止自动恢复。恢复草稿仍被保留。'); return; }
    rec.retries.push(now); rec.recovering = true;
    diagnostics.log('window-recovery-start', { windowId: rec.win.id, role: rec.role, reason, seq: rec.durableSeq });
    void safeLoad(rec.win, rec.lastGood || rec.target || launcher);
  }
  function setupOpenHandler(rec) {
    rec.wc.setWindowOpenHandler(({ url }) => {
      if (!internal(url)) {
        if (!/^https:\/\//.test(url)) return { action: 'deny' };
        return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { preload: '', nodeIntegration: false, contextIsolation: true, sandbox: true } } };
      }
      if (role(url) === 'preview') {
        const previews = [...records.values()].filter(r => alive(r) && r.win !== rec.win && r.role === 'preview' && !r.dirty);
        if (previews.length >= 2) {
          const reuse = previews[0]; void safeLoad(reuse.win, url);
          if (reuse.win.isMinimized()) reuse.win.restore(); reuse.win.focus();
          return { action: 'deny' };
        }
      }
      return { action: 'allow', outlivesOpener: true, overrideBrowserWindowOptions: { show: false, backgroundColor: '#171b22', webPreferences: { preload, nodeIntegration: false, contextIsolation: true } } };
    });
  }
  function attach(win, forcedRole) {
    const wc = win.webContents;
    if (records.has(wc.id)) {
      const existing = records.get(wc.id); if (forcedRole) existing.role = forcedRole; return existing;
    }
    const rec = { lastActivity: Date.now(), win, wc, role: forcedRole || 'local', generation: 0, target: '', lastGood: '', retries: [], durableSeq: 0, dirty: false };
    records.set(wc.id, rec);
    setupOpenHandler(rec);
    wc.on('did-start-navigation', (_e, url, inPlace, mainFrame) => { if (mainFrame && !inPlace) begin(rec, url); });
    wc.on('did-finish-load', () => { void usable(rec, rec.generation, wc.getURL()); });
    wc.on('did-fail-load', (_e, code, _description, url, mainFrame) => {
      diagnostics.log('page-load-failed', { windowId: win.id, code, url, role: rec.role });
      if (code === -3 || !mainFrame || !alive(rec) || rec.showingError || url !== rec.target) return;
      void fail(rec, '页面加载失败（错误码 ' + code + '）。请重试或导出诊断。');
    });
    wc.on('render-process-gone', (_e, details) => {
      diagnostics.log('renderer-gone', { windowId: win.id, role: rec.role, url: rec.target, reason: details.reason, exitCode: details.exitCode });
      if (details.reason !== 'clean-exit') recover(rec, details.reason);
    });
    win.on('focus', () => { rec.lastActivity = Date.now(); });
    win.on('unresponsive', () => {
      rec.unresponsive = true;
      const hangGeneration = rec.generation;
      clearTimeout(rec.hangTimer);
      rec.hangTimer = setTimeout(async () => {
        if (!alive(rec) || !rec.unresponsive || rec.generation !== hangGeneration || (hidden && !allowTestDialogs) || rec.hangPrompt || rec.role === 'cli') return;
        rec.hangPrompt = true;
        const editing = rec.dirty || ['editor', 'creator'].includes(role(rec.target));
        try {
          const result = await dialog.showMessageBox(win, {
            type: 'warning', message: '页面暂时没有响应',
            detail: editing ? '恢复将回到最后已确认的草稿或正式存档。尚未确认的输入可能丢失，也可以继续等待。' : '可以继续等待，或重新加载此页。',
            buttons: ['继续等待', editing ? '从可靠恢复点重新加载' : '重新加载'], defaultId: 0, cancelId: 0
          });
          if (result.response === 1 && alive(rec) && rec.unresponsive && rec.generation === hangGeneration) wc.forcefullyCrashRenderer();
        } catch (e) { diagnostics.error('hang-prompt-failed', e); }
        finally { rec.hangPrompt = false; }
      }, 6000);
      diagnostics.log('window-unresponsive', { windowId: win.id, role: rec.role, seq: rec.durableSeq });
    });
    win.on('responsive', () => { rec.unresponsive = false; clearTimeout(rec.hangTimer); });
    wc.once('destroyed', () => { cleanTimers(rec); records.delete(wc.id); });
    return rec;
  }
  app.on('browser-window-created', (_event, win) => attach(win));
  app.on('before-quit', () => { quitting = true; records.forEach(cleanTimers); });
  return {
    attach, safeLoad, internal, records,
    status(wc) { const r = records.get(wc.id); return { message: r && r.message || '' }; },
    setDirty(wc, value) { const r = records.get(wc.id); if (r) r.dirty = !!value; },
    acknowledged(wc, seq) { const r = records.get(wc.id); if (r) r.durableSeq = seq; },
    async action(wc, action) {
      const r = records.get(wc.id);
      if (!r || !alive(r) || wc.getURL() !== errorUrl) throw new Error('恢复操作仅在故障页可用');
      if (action === 'retry' || action === 'launcher') {
        if (action === 'retry') r.retries = [];
        const url = action === 'launcher' ? launcher : r.target || r.lastGood || launcher;
        setImmediate(() => { if (alive(r)) void safeLoad(r.win, url); });
        return { ok: true, queued: true };
      }
      throw new Error('未知恢复操作');
    }
  };
}
module.exports = { createWindowLifecycle };
