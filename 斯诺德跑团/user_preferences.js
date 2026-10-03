/* Shared, persistent controls for automatic onboarding and advisor prompts. */
(function () {
  'use strict';
  if (window.SnowdPreferences) return;
  var KEY = '_snowd_prompt_preferences_v1', LEGACY = '_snowd_onboard_v2';
  var desktop = window.electronAPI && typeof window.electronAPI.getPromptPreferences === 'function';
  var listeners = [], channel, queue = Promise.resolve(), durable = false, error = '';
  var current = defaults();
  function defaults() { return { version: 1, revision: 0, onboardingEnabled: true, advisorAutoTipsEnabled: false, onboardingSeen: {}, lastAdvisorTipAt: 0 }; }
  function normalize(data) {
    if (!data || data.version !== 1 || typeof data.onboardingEnabled !== 'boolean' || typeof data.advisorAutoTipsEnabled !== 'boolean') throw new Error('提示设置格式不兼容');
    var out = Object.assign(defaults(), data); out.onboardingSeen = {};
    ['launcher','chargen','picker'].forEach(function (scene) {
      if (data.onboardingSeen && ['shown','done','skipped'].indexOf(data.onboardingSeen[scene]) >= 0) out.onboardingSeen[scene] = data.onboardingSeen[scene];
    });
    out.revision = Number.isSafeInteger(data.revision) && data.revision >= 0 ? data.revision : 0;
    out.lastAdvisorTipAt = Number.isFinite(data.lastAdvisorTipAt) && data.lastAdvisorTipAt >= 0 ? data.lastAdvisorTipAt : 0;
    return out;
  }
  function legacySeen() {
    try { return JSON.parse(localStorage.getItem(LEGACY) || '{}'); } catch (_) { return {}; }
  }
  function readBrowser() {
    var raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    var data = defaults(), old = legacySeen();
    ['launcher','chargen','picker'].forEach(function (scene) { if (['done','skipped'].indexOf(old[scene]) >= 0) data.onboardingSeen[scene] = old[scene]; });
    return data;
  }
  function snapshot() { return JSON.parse(JSON.stringify(current)); }
  function notify() {
    var data = { preferences: snapshot(), durable: durable, error: error };
    listeners.slice().forEach(function (fn) { try { fn(data); } catch (e) { console.warn('提示设置通知失败'); } });
  }
  function accept(data) { var next = normalize(data); if (next.revision < current.revision) return; current = next; durable = true; error = ''; notify(); }
  function fail(message) { durable = false; error = message || '无法保存提示设置，本次选择仅在当前页面生效'; notify(); }
  function enqueue(fn) {
    var next = queue.then(fn); queue = next.catch(function () {});
    return next;
  }
  function writeBrowser(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
    accept(data);
    if (channel) channel.postMessage(data);
    return { ok: true, preferences: snapshot(), claimed: true };
  }
  async function browserUpdate(change) {
    var fn = function () {
      var data = readBrowser();
      if (change(data) === false) { accept(data); return { ok: true, claimed: false, preferences: snapshot() }; }
      data.revision++; return writeBrowser(data);
    };
    if (navigator.locks && location.protocol !== 'file:') return navigator.locks.request('snowd-prompt-preferences', fn);
    return fn();
  }
  var ready = (async function () {
    try {
      if (desktop) {
        var result = await window.electronAPI.getPromptPreferences({ legacySeen: legacySeen() });
        if (!result.ok) throw new Error(result.error);
        accept(result.preferences);
      } else { accept(readBrowser()); }
    } catch (e) {
      current.onboardingEnabled = false; current.advisorAutoTipsEnabled = false;
      fail('无法读取提示设置，已暂停自动提示。' + (e.message || ''));
    }
    return snapshot();
  })();
  if (desktop && window.electronAPI.onPromptPreferences) window.electronAPI.onPromptPreferences(function (data) {
    if (data && data.revision >= current.revision) { try { accept(data); } catch (_) { fail('提示设置同步失败'); } }
  });
  if (!desktop) {
    if (typeof BroadcastChannel === 'function') {
      try {
        channel = new BroadcastChannel('snowd-prompt-preferences');
        channel.onmessage = function (event) { try { if (event.data.revision >= current.revision) accept(event.data); } catch (_) {} };
      } catch (_) {}
    }
    window.addEventListener('storage', function (event) {
      if (event.key === KEY && event.newValue) { try { accept(JSON.parse(event.newValue)); } catch (_) { fail('提示设置同步失败'); } }
    });
  }
  function setSwitches(patch) {
    return enqueue(async function () {
      await ready;
      Object.keys(patch).forEach(function (key) {
        if (['onboardingEnabled','advisorAutoTipsEnabled'].indexOf(key) < 0 || typeof patch[key] !== 'boolean') throw new Error('开关参数无效');
      });
      Object.assign(current, patch); notify(); // Turning off is immediate, even if persistence fails.
      try {
        var r = desktop ? await window.electronAPI.setPromptPreferences(patch) : await browserUpdate(function (data) { Object.assign(data, patch); });
        if (!r.ok) throw new Error(r.error); accept(r.preferences); return r;
      } catch (e) { fail('设置未保存；本次选择仅在当前页面生效。' + (e.message || '')); return { ok: false, error: error }; }
    });
  }
  function markSeen(scene, status) {
    return enqueue(async function () {
      await ready;
      try {
        var r = desktop ? await window.electronAPI.markOnboardingSeen({ scene: scene, status: status || 'shown' }) : await browserUpdate(function (data) {
          if ((status || 'shown') === 'shown' && (!data.onboardingEnabled || data.onboardingSeen[scene])) return false;
          data.onboardingSeen[scene] = status || 'shown';
        });
        if (!r.ok) throw new Error(r.error); accept(r.preferences); return r;
      } catch (e) { current.onboardingSeen[scene] = status || 'shown'; fail('引导记录未保存。' + (e.message || '')); return { ok: false, error: error }; }
    });
  }
  function claimTip() {
    return enqueue(async function () {
      await ready;
      if (!current.advisorAutoTipsEnabled || !durable) return { ok: true, claimed: false };
      try {
        var r = desktop ? await window.electronAPI.claimAdvisorTip() : await browserUpdate(function (data) {
          if (!data.advisorAutoTipsEnabled || Date.now() - data.lastAdvisorTipAt < 300000) return false;
          data.lastAdvisorTipAt = Date.now();
        });
        if (!r.ok) throw new Error(r.error); accept(r.preferences); return r;
      } catch (e) { fail('自动提示间隔无法保存，已暂停自动小贴士。'); return { ok: false, claimed: false }; }
    });
  }
  window.SnowdPreferences = { ready: ready, get: snapshot, set: setSwitches, markSeen: markSeen, claimTip: claimTip,
    status: function () { return { durable: durable, error: error }; },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; } };
  window.addEventListener('pageshow', async function (event) {
    if (!event.persisted) return;
    try {
      if (desktop) { var r = await window.electronAPI.getPromptPreferences({}); if (!r.ok) throw new Error(r.error); accept(r.preferences); }
      else accept(readBrowser());
    } catch (_) { current.onboardingEnabled = false; current.advisorAutoTipsEnabled = false; fail('提示设置重新读取失败，已暂停自动提示'); }
  });
  window.addEventListener('pagehide', function (event) { if (channel && !event.persisted) channel.close(); });
})();
