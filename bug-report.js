// 斯诺德跑团 - Bug 反馈 → ntfy.sh
(function() {
  function sendBug() {
    var ta = document.getElementById('_snowd_bug_text');
    if (!ta || !ta.value.trim()) return;
    var desc = ta.value.trim();
    
    var lines = ['页面: '+location.href, document.title, new Date().toLocaleString('zh-CN'), '', desc];
    try {
      var el = JSON.parse(localStorage.getItem('_snowd_error_log')||'[]');
      if (el.length) {
        lines.push('', '--- 最近错误 ---');
        el.slice(-3).forEach(function(x) { lines.push(x.time + ': ' + x.msg); });
      }
    } catch(e) {}

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://ntfy.sh/snowd-bug-report', true);
    xhr.setRequestHeader('Title', 'Bug: ' + (document.title || ''));
    xhr.onload = function() {
      var ov = document.getElementById('_snowd_bug_overlay');
      if (ov) ov.parentNode.removeChild(ov);
      alert(xhr.status === 200 ? '✅ 已发送' : '⚠ 发送失败');
    };
    xhr.onerror = function() {
      alert('❌ 网络错误，请稍后重试');
    };
    xhr.send(lines.join('\n'));
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

    var box = document.createElement('div');
    box.style.cssText = 'background:#fffdf8;border-radius:12px;padding:20px 24px;max-width:420px;width:90%;font-family:"Microsoft YaHei",sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    var h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0 0 8px;color:#1f2522;font-size:18px;';
    h3.textContent = '🐛 反馈 Bug';
    box.appendChild(h3);

    var p = document.createElement('p');
    p.style.cssText = 'font-size:13px;color:#69706b;margin:0 0 12px;line-height:1.6;';
    p.textContent = '请描述问题（发生了什么 vs 期望什么）';
    box.appendChild(p);

    var ta = document.createElement('textarea');
    ta.id = '_snowd_bug_text';
    ta.style.cssText = 'width:100%;height:100px;border:1px solid #d8d2c4;border-radius:6px;padding:8px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;';
    ta.placeholder = '请在此描述...';
    box.appendChild(ta);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #d8d2c4;border-radius:6px;background:#fff;cursor:pointer;color:#1f2522;font-size:14px;';
    cancelBtn.addEventListener('click', function(e) { e.stopPropagation(); closeBug(); });
    btnRow.appendChild(cancelBtn);

    var sendBtn = document.createElement('button');
    sendBtn.textContent = '发送';
    sendBtn.style.cssText = 'padding:6px 16px;background:#a46d1f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;';
    sendBtn.addEventListener('click', function(e) { e.stopPropagation(); sendBug(); });
    btnRow.appendChild(sendBtn);

    box.appendChild(btnRow);
    ov.appendChild(box);
    ov.addEventListener('click', function(e) { if (e.target === ov) closeBug(); });
    document.body.appendChild(ov);
    ta.focus();
  }

  function initBugReport() {
    try {
      if (document.getElementById('_snowd_bug_btn')) return;
      var ERROR_KEY = '_snowd_error_log';
      if (!window._snowd_bug_err_set) {
        window._snowd_bug_err_set = true;
        window.onerror = function(msg, src, line) {
          try {
            var log = JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');
            log.push({time:new Date().toISOString(), msg:String(msg).substring(0,500), src:String(src||'').substring(0,200), line:line});
            if (log.length>20) log=log.slice(-20);
            localStorage.setItem(ERROR_KEY, JSON.stringify(log));
          } catch(e) {}
        };
      }
      var btn = document.createElement('button');
      btn.id = '_snowd_bug_btn';
      btn.textContent = '🐛';
      btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;width:44px;height:44px;border-radius:50%;border:2px solid #c62828;background:#fff;color:#c62828;font-size:20px;cursor:pointer;box-shadow:0 2px 12px rgba(198,40,40,0.3);';
      btn.addEventListener('click', function(e) { e.stopPropagation(); showBugModal(); });
      document.body.appendChild(btn);
    } catch(e) {}
  }

  setTimeout(initBugReport, 300);
})();
