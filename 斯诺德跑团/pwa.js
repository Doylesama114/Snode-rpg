/* 斯诺德跑团 PWA 引导（2026-11-19）
 * 职责：注册 SW、检测独立模式、更新提示、存储持久化、自检信息。
 * 无依赖，ES5 写法，禁用内联事件。
 */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  if (standalone) root.classList.add('pwa-standalone');

  function ready(fn) {
    if (doc.readyState === 'complete' || doc.readyState === 'interactive') fn();
    else doc.addEventListener('DOMContentLoaded', fn);
  }

  function showUpdateBar(reg) {
    if (doc.getElementById('_snowd_pwa_update')) return;
    var bar = doc.createElement('div');
    bar.id = '_snowd_pwa_update';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;' +
      'gap:12px;align-items:center;justify-content:center;padding:12px 16px;' +
      'padding-bottom:calc(12px + env(safe-area-inset-bottom));' +
      'background:#1b1510;color:#f3e3b3;border-top:1px solid #a9822f;font:14px/1.5 system-ui;';
    var text = doc.createElement('span');
    text.textContent = '有新版本可用';
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = '立即刷新';
    btn.style.cssText = 'background:#d4af37;color:#1b1510;border:0;border-radius:8px;' +
      'padding:8px 14px;font-size:14px;font-weight:600;';
    btn.addEventListener('click', function () {
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
    bar.appendChild(text);
    bar.appendChild(btn);
    doc.body.appendChild(bar);
  }

  function register() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg);
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(reg);
        });
      });
    }).catch(function () { /* 注册失败不影响页面 */ });

    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  function persist() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
  }

  function safeArea() {
    var probe = doc.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden;';
    doc.body.appendChild(probe);
    var cs = window.getComputedStyle(probe);
    var top = parseFloat(cs.paddingTop) || 0;
    var bottom = parseFloat(cs.paddingBottom) || 0;
    doc.body.removeChild(probe);
    return { top: top, bottom: bottom };
  }

  function selfCheck() {
    var info = {
      standalone: standalone,
      ua: navigator.userAgent,
      ios: (function () {
        var m = navigator.userAgent.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
        if (!m) return "";
        return [m[1], m[2], m[3]].filter(Boolean).join(".");
      })(),
      serviceWorker: !('serviceWorker' in navigator) ? 'unsupported' :
        (navigator.serviceWorker.controller ? 'controlled' : 'registered-or-pending'),
      safeArea: safeArea()
    };
    var p = (!navigator.storage || !navigator.storage.estimate)
      ? Promise.resolve(null)
      : navigator.storage.estimate().catch(function () { return null; });
    return p.then(function (est) {
      info.storage = est ? {
        usageMB: +(est.usage / 1048576).toFixed(2),
        quotaMB: est.quota ? +(est.quota / 1048576).toFixed(1) : null
      } : 'unsupported';
      return info;
    });
  }

  ready(function () { register(); persist(); });

  window.SnowdPWA = {
    standalone: standalone,
    selfCheck: selfCheck,
    showUpdate: function () { /* 调试用 */ }
  };
})();
