(function () {
  'use strict';
  var api = window.electronAPI;
  var launcher = /启动台\.html$/.test(decodeURIComponent(location.pathname));
  var overlay, toggle;
  if (!api || !api.desktopStatus) return;
  function button(parent, text, action) {
    var b = document.createElement('button'); b.className = 'btn'; b.textContent = text;
    b.style.cssText = 'margin:6px;padding:10px;cursor:pointer';
    b.onclick = async function () {
      b.disabled = true;
      try { await action(b); } catch (_) { status.textContent = '操作失败，请检查目录权限。'; }
      finally { b.disabled = false; }
    };
    parent.appendChild(b); return b;
  }
  var section = document.createElement('section'); section.id = 'desktopTools'; section.className = 'card';
  section.style.cssText = 'margin:16px auto;padding:16px;max-width:800px;border:1px solid #8893;border-radius:8px;font:14px system-ui;position:relative;z-index:2';
  var h = document.createElement('h3'); h.id = 'desktopToolsTitle'; h.textContent = '桌面诊断与恢复'; section.appendChild(h);
  var status = document.createElement('p'); status.setAttribute('role', 'status'); section.appendChild(status);
  var nextMode;
  api.desktopStatus().then(function (r) {
    if (!r.ok) { status.textContent = r.error; return; }
    nextMode = !r.compatibilityMode; compatibilityButton.disabled = false;
    status.textContent = '当前渲染：' + (r.compatibilityMode ? '兼容模式' : '硬件加速') + (r.diagnosticsDegraded ? '；诊断目录不可写，已尝试备用记录。' : '');
  }).catch(function () { status.textContent = '诊断状态暂不可用。'; });
  button(section, '导出诊断', async function () {
    var r = await api.exportDiagnostics();
    status.textContent = r.canceled ? '已取消导出' : r.ok ? '诊断已导出；不含角色存档或恢复草稿。' : r.error;
  });
  var compatibilityButton = button(section, '切换兼容渲染模式', async function () {
    var r = await api.setCompatibilityMode(nextMode);
    status.textContent = r.ok ? '已设置为' + (nextMode ? '兼容模式' : '硬件加速') + '，关闭后重新打开生效。' : r.error;
    if (r.ok) nextMode = !nextMode;
  });
  compatibilityButton.disabled = true;
  if (launcher) {
    api.recoveryList().then(function (r) {
      if (!r.ok) { status.textContent = r.error; return; }
      if (r.drafts.length) { toggle.textContent = '恢复草稿（' + r.drafts.length + '）'; overlay.style.display = 'flex'; }
      r.drafts.forEach(function (draft) {
        var row = document.createElement('div'); section.appendChild(row);
        if (draft.damaged) { row.textContent = '存在损坏或版本不兼容的恢复草稿，原文件已保留，请导出诊断。'; return; }
        var span = document.createElement('span');
        span.textContent = draft.identity.module === 'panel' ? draft.identity.character + ' · 存档 ' + draft.identity.slot + ' 有未保存改动' : '有未完成的角色创建';
        row.appendChild(span);
        button(row, '查看恢复草稿', function () {
          location.href = draft.identity.module === 'panel'
            ? '角色面板.html?char=' + encodeURIComponent(draft.identity.character) + '&slot=' + draft.identity.slot
            : '角色创建页.html' + (draft.identity.character !== 'new' ? '?recreate=' + encodeURIComponent(draft.identity.character) : '');
        });
        button(row, '放弃', async function () {
          if (!api.jsConfirm('确定放弃这份未保存的恢复草稿？正式存档不受影响。')) return;
          var result = await api.recoveryDiscard({ identity: draft.identity, seq: draft.seq });
          if (result.ok) row.remove(); else status.textContent = result.error;
        });
      });
    }).catch(function () { status.textContent = '恢复草稿列表暂不可用。'; });
  }
  if (launcher) {
    overlay = document.createElement('div'); overlay.id = 'desktopToolsOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#0009;display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    section.style.cssText = 'padding:24px;width:720px;max-width:100%;max-height:calc(100vh - 32px);overflow:auto;background:#20262e;color:#eee;border-radius:10px;font:15px system-ui;box-sizing:border-box';
    section.setAttribute('role','dialog'); section.setAttribute('aria-modal','true'); section.setAttribute('aria-labelledby','desktopToolsTitle');
    toggle = document.createElement('button'); toggle.id = 'desktopToolsToggle'; toggle.textContent = '诊断与恢复';
    toggle.onclick = function() { overlay.style.display = 'flex'; };
    var tools = document.querySelector('.bottom-right .tools') || document.querySelector('.top-ops');
    if (tools) tools.appendChild(toggle);
    else { toggle.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1000'; document.body.appendChild(toggle); }
    button(section,'关闭',function(){ overlay.style.display='none';toggle.focus(); });
    document.addEventListener('keydown',function(event){
      if(event.key==='Escape' && overlay.style.display==='flex'){event.preventDefault();event.stopPropagation();overlay.style.display='none';toggle.focus();}
    },true);
    overlay.appendChild(section);document.body.appendChild(overlay);
  } else {
    (document.querySelector('.wrap') || document.body).appendChild(section);
  }
})();
