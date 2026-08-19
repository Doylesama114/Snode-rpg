/* 斯诺德跑团 — 统一页面内对话框（替代 Electron/WebView 中不可用的 alert/confirm/prompt） */
(function () {
  'use strict';

  var Z = 30000;
  var focusRestore = null;

  function overlayBase() {
    var old = document.getElementById('snowdUiDialog');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (document.activeElement && document.activeElement !== document.body) {
      focusRestore = document.activeElement;
    }
    var ov = document.createElement('div');
    ov.id = 'snowdUiDialog';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,14,.55);z-index:' + Z + ';display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
    document.body.appendChild(ov);
    return ov;
  }

  function boxStyle() {
    return 'background:#fffdf8;border:1px solid #d8d2c4;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);padding:20px 22px;max-width:440px;width:100%;color:#1f2522;font-size:14px;line-height:1.7;box-sizing:border-box';
  }

  function buttonStyle(primary) {
    return 'padding:9px 18px;border-radius:8px;border:1px solid ' + (primary ? '#a46d1f' : '#d8d2c4') + ';background:' + (primary ? '#a46d1f' : '#fff') + ';color:' + (primary ? '#fff' : '#1f2522') + ';cursor:pointer;font-size:14px;font-weight:700;font-family:inherit';
  }

  function closeWith(ov, fn) {
    return function () {
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      if (focusRestore && focusRestore.focus) { try { focusRestore.focus(); } catch (e) {} }
      focusRestore = null;
      if (typeof fn === 'function') fn();
    };
  }

  function bindKeys(ov, ok, cancel) {
    function onKey(e) {
      if (e.key === 'Enter' && ok) { e.preventDefault(); ok(); }
      else if (e.key === 'Escape' && cancel) { e.preventDefault(); cancel(); }
    }
    ov.addEventListener('keydown', onKey, true);
    ov._removeKeys = function () { ov.removeEventListener('keydown', onKey, true); };
  }

  window.SD_alert = function (message, onClose) {
    var ov = overlayBase();
    var box = document.createElement('div');
    box.style.cssText = boxStyle();
    var msg = document.createElement('div');
    msg.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin-bottom:16px';
    msg.textContent = String(message == null ? '' : message);
    box.appendChild(msg);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end';
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = '确定';
    ok.style.cssText = buttonStyle(true);
    var done = closeWith(ov, onClose);
    ok.addEventListener('click', done);
    row.appendChild(ok);
    box.appendChild(row);
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) done(); });
    bindKeys(ov, done, done);
    ok.focus();
  };

  window.SD_confirm = function (message, onOk, onCancel) {
    var ov = overlayBase();
    var box = document.createElement('div');
    box.style.cssText = boxStyle();
    var msg = document.createElement('div');
    msg.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin-bottom:16px';
    msg.textContent = String(message == null ? '' : message);
    box.appendChild(msg);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.style.cssText = buttonStyle(false);
    var cancelFn = closeWith(ov, onCancel);
    cancel.addEventListener('click', cancelFn);
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = '确定';
    ok.style.cssText = buttonStyle(true);
    var okFn = closeWith(ov, onOk);
    ok.addEventListener('click', okFn);
    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(row);
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) cancelFn(); });
    bindKeys(ov, okFn, cancelFn);
    cancel.focus();
  };

  window.SD_prompt = function (opts, onOk, onCancel) {
    if (typeof opts === 'string') opts = { message: opts };
    opts = opts || {};
    var ov = overlayBase();
    var box = document.createElement('div');
    box.style.cssText = boxStyle();
    if (opts.title) {
      var title = document.createElement('div');
      title.style.cssText = 'font-size:17px;font-weight:700;color:#a46d1f;margin-bottom:10px';
      title.textContent = opts.title;
      box.appendChild(title);
    }
    if (opts.message) {
      var msg = document.createElement('div');
      msg.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin-bottom:12px;color:#4a4f4b';
      msg.textContent = opts.message;
      box.appendChild(msg);
    }
    var input = document.createElement('input');
    input.type = opts.type || 'text';
    input.value = opts.defaultValue != null ? String(opts.defaultValue) : '';
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.style.cssText = 'width:100%;padding:10px 12px;border:1px solid #d8d2c4;border-radius:8px;font-size:15px;font-family:inherit;background:#fff;color:#1f2522;box-sizing:border-box;outline:none';
    box.appendChild(input);
    var hint = document.createElement('div');
    hint.style.cssText = 'min-height:18px;font-size:12px;color:#c0392b;margin-top:6px';
    box.appendChild(hint);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:12px';
    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.style.cssText = buttonStyle(false);
    var cancelFn = closeWith(ov, function () { if (onCancel) onCancel(); });
    cancel.addEventListener('click', cancelFn);
    var ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = '确定';
    ok.style.cssText = buttonStyle(true);
    function okFn() {
      var v = input.value;
      if (typeof opts.validate === 'function') {
        var err = opts.validate(v);
        if (err) { hint.textContent = err; input.focus(); return; }
      }
      closeWith(ov, function () { if (onOk) onOk(v); })();
    }
    ok.addEventListener('click', okFn);
    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(row);
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) cancelFn(); });
    bindKeys(ov, okFn, cancelFn);
    input.focus();
    input.select();
  };
})();
