// 斯诺德跑团 - Bug 反馈（Electron IPC / 浏览器 XHR）
(function() {
  function sendBug() {
    var ta = document.getElementById('_snowd_bug_text');
    if (!ta || !ta.value.trim()) return;
    var desc = ta.value.trim();

    var lines = ['页面: '+location.href, document.title, new Date().toLocaleString('zh-CN'), '', desc];
    try {
      var el = JSON.parse(localStorage.getItem('_snowd_error_log')||'[]');
      if (el.length) { lines.push('','--- 最近错误 ---'); el.slice(-3).forEach(function(x){lines.push(x.time+': '+x.msg);}); }
    } catch(e) {}
    var body = lines.join('\n');

    var sendBtn = document.getElementById('_snowd_bug_send');
    if (sendBtn) { sendBtn.textContent = '发送中...'; sendBtn.disabled = true; }

    function done(ok) {
      if (sendBtn) { sendBtn.textContent = ok ? '✅ 已发送' : '❌ 失败'; sendBtn.disabled = true; }
      setTimeout(function() { closeBug(); }, 1500);
    }

    if (window.electronAPI) {
      window.electronAPI.sendBug(body).then(function(r) { done(r && r.ok); });
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://ntfy.sh/snowd-bug-report', true);
      xhr.setRequestHeader('Title', 'Bug Report');
      xhr.onload = function() { done(xhr.status === 200); };
      xhr.onerror = function() { done(false); };
      xhr.send(body);
    }
  }

  function closeBug() {
    var ov = document.getElementById('_snowd_bug_overlay');
    if (ov) ov.parentNode.removeChild(ov);
  }

  function showBugModal() {
    if (document.getElementById('_snowd_bug_overlay')) return;
    var ov = document.createElement('div');
    ov.id = '_snowd_bug_overlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
    ov.addEventListener('click', function(e) { if (e.target === ov) closeBug(); });

    var box = document.createElement('div');
    box.style.cssText = 'background:#fffdf8;border-radius:12px;padding:20px 24px;max-width:420px;width:90%;font-family:"Microsoft YaHei",sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    var h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0 0 8px;color:#1f2522;font-size:18px;';
    h3.textContent = '🐛 反馈 Bug';
    box.appendChild(h3);

    var p = document.createElement('p');
    p.style.cssText = 'font-size:13px;color:#69706b;margin:0 0 12px;';
    p.textContent = '请描述问题（发生了什么 vs 期望什么）';
    box.appendChild(p);

    var ta = document.createElement('textarea');
    ta.id = '_snowd_bug_text';
    ta.style.cssText = 'width:100%;height:100px;border:1px solid #d8d2c4;border-radius:6px;padding:8px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;';
    ta.placeholder = '请在此描述...';
    box.appendChild(ta);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';

    var cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.style.cssText = 'padding:6px 16px;border:1px solid #d8d2c4;border-radius:6px;background:#fff;cursor:pointer;color:#1f2522;font-size:14px;';
    cancel.addEventListener('click', closeBug);
    row.appendChild(cancel);

    var send = document.createElement('button');
    send.id = '_snowd_bug_send';
    send.textContent = '发送';
    send.style.cssText = 'padding:6px 16px;background:#a46d1f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
    send.addEventListener('click', sendBug);
    row.appendChild(send);

    box.appendChild(row);
    ov.appendChild(box);
    document.body.appendChild(ov);
    ta.focus();
  }

  function initBugReport() {
    try {
      if (document.getElementById('_snowd_bug_btn')) return;
      var btn = document.createElement('button');
      btn.id = '_snowd_bug_btn';
      btn.textContent = '🐛';
      btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;width:44px;height:44px;border-radius:50%;border:2px solid #c62828;background:#fff;color:#c62828;font-size:20px;cursor:pointer;box-shadow:0 2px 12px rgba(198,40,40,0.3);';
      btn.addEventListener('click', function(e) { e.stopPropagation(); showBugModal(); });
      document.body.appendChild(btn);
    } catch(e) {}
  }

  // 等待 DOM 就绪再初始化，避免固定 300ms 延迟在重页面时 DOM 未就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBugReport);
  } else {
    initBugReport();
  }
})();
