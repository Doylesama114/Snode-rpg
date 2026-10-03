/* Independent desktop recovery snapshots; browser/mobile keep their existing save behavior. */
(function () {
  'use strict';
  var api = window.electronAPI;
  if (!api || !api.recoveryWrite || new URLSearchParams(location.search).has('cli')) return;
  var panel = /角色面板\.html$/.test(decodeURIComponent(location.pathname));
  var creator = /角色创建页\.html$/.test(decodeURIComponent(location.pathname));
  if (!panel && !creator) return;
  var acknowledged = Object.create(null);
  var ready = false, stopped = false, debounce, maxWait, queue = Promise.resolve(), ack = 0, pendingDraft = null, busy = false;
  function identity() {
    var params = new URLSearchParams(location.search);
    if (panel) return { module: 'panel', character: window.CURRENT_CHAR || params.get('char') || (window.state && state.name) || 'unsaved', slot: window.CURRENT_SLOT || parseInt(params.get('slot'), 10) || 1 };
    return { module: 'chargen', character: params.get('recreate') || 'new', slot: 0 };
  }
  function snapshot() {
    if (panel) return getStateSnapshot();
    var snap = buildCreationSnapshot(); snap._step = CURRENT_STEP; return snap;
  }
  function notice(message) {
    var el = document.getElementById('desktopRecoveryStatus');
    if (!el) {
      el = document.createElement('div'); el.id = 'desktopRecoveryStatus'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483645;background:#574219;color:#fff;padding:10px;max-width:90%;font:14px system-ui;border-radius:6px';
      document.body.appendChild(el);
    }
    el.textContent = message;
  }
  function enqueue(task) {
    var next = queue.then(task);
    queue = next.catch(function () {});
    return next;
  }
  function flush() {
    clearTimeout(debounce); clearTimeout(maxWait); debounce = maxWait = null;
    if (!ready || stopped || pendingDraft) return Promise.resolve(null);
    var data;
    try { data = { identity: identity(), snapshot: snapshot(), savedAt: panel ? state._savedAt : null }; }
    catch (_) { notice('恢复快照生成失败，请手动保存。'); return Promise.resolve(null); }
    return enqueue(function () {
      return api.recoveryWrite(data).then(function (result) {
        if (!result.ok) throw new Error(result.error);
        ack = result.seq;
        acknowledged[JSON.stringify(data.identity)] = ack;
        window.__desktopRecoveryAck = ack;
        return result;
      });
    }).catch(function (error) { notice(error.message || '恢复草稿未写入，请手动保存。'); return { ok: false }; });
  }
  function mark() {
    if (!ready || stopped) return;
    if (pendingDraft) { notice('还有未处理的恢复草稿，请先恢复或明确放弃；当前改动尚未写入恢复文件。'); return; }
    try { api.setPanelDirty(true); } catch (_) {}
    clearTimeout(debounce); debounce = setTimeout(flush, 500);
    if (!maxWait) maxWait = setTimeout(flush, 2000);
  }
  function saved(targetIdentity) {
    clearTimeout(debounce); clearTimeout(maxWait); debounce = maxWait = null;
    if (!ready || pendingDraft) return;
    var id = targetIdentity || identity();
    // Serializes the clear after any already submitted writes; subsequent edits enqueue after it.
    return enqueue(function () {
      var savedSeq = acknowledged[JSON.stringify(id)];
      if (!savedSeq) return { ok: true };
      return api.recoveryClear({ identity: id, seq: savedSeq }).then(function(r) { if(r.ok) delete acknowledged[JSON.stringify(id)]; return r; });
    }).then(function (r) {
      if (!r.ok) notice(r.error);
      else { ack = 0; window.__desktopRecoveryAck = 0; }
    }).catch(function () { notice('正式存档已保存，但恢复草稿清理失败。'); });
  }
  function restore(draft) {
    var snap = JSON.parse(JSON.stringify(draft.snapshot));
    if (panel) {
      Object.keys(state).forEach(function (key) { delete state[key]; });
      Object.keys(STATE_DEFAULTS).forEach(function (key) { state[key] = JSON.parse(JSON.stringify(STATE_DEFAULTS[key])); });
      Object.keys(snap).forEach(function (key) { if (key !== '__proto__' && key !== 'constructor') state[key] = snap[key]; });
      CURRENT_CHAR = draft.identity.character; CURRENT_SLOT = draft.identity.slot;
      state._dirty = true; reportPanelDirty(true); render();
    } else {
      applyCreationSnapshotToChar(snap);
      var step = Math.max(0, Math.min(TOTAL_STEPS - 1, Number(snap._step) || 0));
      goToStep(step); updateOverview(); api.setPanelDirty(true);
    }
    notice('已恢复未保存改动；正式存档未覆盖，请检查后手动保存。');
  }
  function ask(draft) {
    pendingDraft = draft;
    var overlay = document.createElement('div'); overlay.id = 'desktopRecoveryPrompt';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    var box = document.createElement('div');
    box.style.cssText = 'background:#20262e;color:#fff;padding:24px;border-radius:10px;width:520px;max-width:100%;box-sizing:border-box;font:15px system-ui';
    var title = document.createElement('h2'); title.textContent = '检测到未保存改动';
    var desc = document.createElement('p'); desc.textContent = '恢复点：' + new Date(draft.at).toLocaleString() + '。可恢复到当前编辑状态。最后确认的恢复点之后的输入可能未保存。';
    desc.style.lineHeight = '1.6'; box.appendChild(title); box.appendChild(desc);
    function button(id, text, action) {
      var b = document.createElement('button'); b.id = id; b.textContent = text;
      b.style.cssText = 'margin:6px;padding:10px;cursor:pointer';
      b.onclick = async function () {
        if (busy) return; busy = true;
        try { await action(); } finally { busy = false; }
      }; box.appendChild(b);
    }
    button('desktopRestoreDraft', '恢复改动', function () {
      restore(draft); pendingDraft = null; ack = draft.seq; acknowledged[JSON.stringify(draft.identity)] = ack; window.__desktopRecoveryAck = ack; overlay.remove(); mark();
    });
    button('desktopViewSaved', panel ? '查看最近正式存档' : '查看当前创建状态', function () {
      overlay.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483646;max-width:calc(100% - 32px)';
      title.textContent = '恢复草稿仍保留';
      desc.textContent = '正在查看当前已保存状态。请恢复或明确放弃草稿，再继续保存改动。';
      this && this.blur && this.blur();
    });
    button('desktopDiscardDraft', '放弃这份草稿', async function () {
      var r = await api.recoveryClear({ identity: draft.identity, seq: draft.seq });
      if (!r.ok) { notice(r.error); return; }
      pendingDraft = null; ack = 0; overlay.remove(); notice('已按你的选择放弃恢复草稿。');
    });
    overlay.appendChild(box); document.body.appendChild(overlay);
  }
  async function init() {
    try {
      var r = await api.recoveryRead(identity());
      ready = true;
      if (!r.ok) { stopped = true; notice(r.error); return; }
      if (r.draft) ask(r.draft);
      else api.setPanelDirty(!!(panel && state._dirty));
    } catch (_) { ready = true; stopped = true; notice('恢复草稿不可用，请手动保存并导出诊断。'); }
  }
  async function discard() {
    clearTimeout(debounce); clearTimeout(maxWait); debounce = maxWait = null;
    var id = identity();
    return enqueue(async function() {
      var r = await api.recoveryRead(id);
      if (!r.ok) { notice(r.error); return r; }
      var result = r.draft ? await api.recoveryClear({ identity: id, seq: r.draft.seq }) : { ok: true };
      if (result.ok) { pendingDraft = null; ack = 0; delete acknowledged[JSON.stringify(id)]; }
      else notice(result.error);
      return result;
    });
  }
  window.desktopRecovery = { mark: mark, flush: flush, saved: saved, discard: discard, getAck: function () { return ack; } };
  // Wait until all existing panel load/initialization listeners have completed.
  window.addEventListener('load', function () { setTimeout(init, 0); });
  document.addEventListener('input', function () { if (creator) mark(); });
  document.addEventListener('change', function () { if (creator) mark(); });
  window.addEventListener('pagehide', function () { void flush(); });
})();
