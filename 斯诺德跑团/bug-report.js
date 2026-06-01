// 斯诺德跑团 - Bug 反馈按钮 → ntfy.sh 即时推送
(function() {
  function initBugReport() {
    try {
      var ERROR_KEY = '_snowd_error_log';
      if (!window._snowd_bug_error_set) {
        window._snowd_bug_error_set = true;
        window.onerror = function(msg, src, line) {
          try {
            var log = JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');
            log.push({time:new Date().toISOString(),msg:String(msg).substring(0,500),src:String(src||'').substring(0,200),line:line});
            if(log.length>20)log=log.slice(-20);
            localStorage.setItem(ERROR_KEY,JSON.stringify(log));
          }catch(e){}
        };
      }

      if (document.getElementById('_snowd_bug_btn')) return;
      var btn = document.createElement('button');
      btn.id = '_snowd_bug_btn';
      btn.textContent = '🐛'; btn.title = '反馈 Bug';
      btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;width:44px;height:44px;border-radius:50%;border:2px solid #c62828;background:#fff;color:#c62828;font-size:20px;cursor:pointer;box-shadow:0 2px 12px rgba(198,40,40,0.3);';

      btn.onclick = function(e) {
        e.stopPropagation();
        var desc = window.prompt('请描述问题（发生了什么 vs 期望什么）：');
        if (!desc || !desc.trim()) return;
        var body = ['页面: '+location.href, document.title, new Date().toLocaleString('zh-CN'), '', desc];
        try { var el=JSON.parse(localStorage.getItem(ERROR_KEY)||'[]'); if(el.length) { body.push('---error---'); el.slice(-3).forEach(function(x){body.push(x.time+' '+x.msg);}); } } catch(e){}
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://ntfy.sh/snowd-bug-report', true);
        xhr.setRequestHeader('Title', 'Bug: '+(document.title||''));
        xhr.onload = function() { alert(xhr.status===200 ? '✅ 反馈已发送' : '⚠ 发送失败'); };
        xhr.onerror = function() { alert('❌ 网络错误'); };
        xhr.send(body.join('\n'));
      };
      document.body.appendChild(btn);
    } catch(e) { console.warn('Bug button init failed:', e); }
  }

  setTimeout(initBugReport, 500);
})();
