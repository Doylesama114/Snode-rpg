// 斯诺德跑团 - Bug 反馈（Electron IPC / 浏览器 XHR）
(function() {
  function sendBug() {
    var ta = document.getElementById('_snowd_bug_text');
    if (!ta || !ta.value.trim()) return;
    var desc = ta.value.trim();

    try {
      if (/顾问|advisor|AI|问句|意图[:：]|必含[:：]/.test(desc)) {
        var qm = desc.match(/问句[:：]\s*(.+)/);
        var im = desc.match(/意图[:：]\s*([a-z_]+)/i);
        var mm = desc.match(/必含[:：]\s*(.+)/);
        var payload = {
          query: qm ? qm[1].split('\n')[0].trim() : desc.slice(0, 120),
          description: desc,
          page: location.href,
          savedAt: new Date().toISOString(),
        };
        if (im) payload.expectIntent = im[1].trim();
        if (mm) {
          payload.mustInclude = mm[1].split(/[,，、|]/).map(function(s) { return s.trim(); }).filter(Boolean);
        }
        localStorage.setItem('_snowd_advisor_feedback', JSON.stringify(payload));
        var queue = [];
        try { queue = JSON.parse(localStorage.getItem('_snowd_advisor_feedback_queue') || '[]'); } catch (e2) {}
        if (!Array.isArray(queue)) queue = [];
        queue.push(payload);
        if (queue.length > 50) queue = queue.slice(-50);
        localStorage.setItem('_snowd_advisor_feedback_queue', JSON.stringify(queue));
      }
    } catch (e) {}

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
      // \u4f18\u5148\u4e0a\u62a5\u5230 FC \u2192 OSS \u6c89\u6dc0\uff1b\u5931\u8d25\u65f6\u56de\u9000 ntfy \u63a8\u9001
      function ntfyFallback() {
        fetch('https://ntfy.sh/snowd-bug-report', {
          method: 'POST',
          headers: { 'Title': 'Snowd Bug Report' },
          body: body
        }).then(function(r) { done(r.ok); }).catch(function() { done(false); });
      }
      var api = (typeof window.SNODE_ADVISOR_API === 'string' && window.SNODE_ADVISOR_API && window.SNODE_ADVISOR_API !== '__ADVISOR_API_BASE__')
        ? window.SNODE_ADVISOR_API.replace(/\/+$/, '') : '';
      if (api) {
        fetch(api + '/api/bug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: body,
            page: location.href,
            title: document.title,
            userAgent: navigator.userAgent || '',
            ts: Date.now(),
            source: 'web',
          })
        }).then(function(r) {
          if (r.ok) { done(true); return; }
          ntfyFallback();
        }).catch(function() { ntfyFallback(); });
      } else {
        ntfyFallback();
      }
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
    p.textContent = '请描述问题（发生了什么 vs 期望什么）。顾问类反馈可加：问句：… / 意图：starting_gear_lookup / 必含：Tools 层,起始装备';
    p.title = '开发者：复制 localStorage._snowd_advisor_feedback_queue 到 advisor/feedback/inbox/ 后运行 node scripts/advisor-feedback-export.mjs';
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
      btn.style.cssText = 'position:fixed;top:50%;right:0;z-index:9999;width:44px;height:44px;border-radius:50%;border:2px solid #c62828;background:#fff;color:#c62828;font-size:20px;cursor:pointer;box-shadow:0 2px 12px rgba(198,40,40,0.3);margin-top:-22px;transition:transform .25s ease;';
      var st = document.getElementById('_snowd_bug_styles');
      if (!st) {
        st = document.createElement('style');
        st.id = '_snowd_bug_styles';
        st.textContent = '#_snowd_bug_btn._snowd_bug_hide{transform:translateX(calc(100% - 16px))}#_snowd_bug_btn._snowd_bug_hide_left{transform:translateX(calc(-100% + 16px))}';
        document.head.appendChild(st);
      }
      var bugHideTimer = null;
      function bugApplyHide() {
        var r = btn.getBoundingClientRect();
        var c = window.innerWidth / 2;
        btn.classList.remove('_snowd_bug_hide', '_snowd_bug_hide_left');
        if (r.left + r.width / 2 < c) btn.classList.add('_snowd_bug_hide_left');
        else btn.classList.add('_snowd_bug_hide');
      }
      function bugShow() {
        btn.classList.remove('_snowd_bug_hide', '_snowd_bug_hide_left');
        clearTimeout(bugHideTimer);
        bugHideTimer = setTimeout(bugApplyHide, 4000);
      }
      function bugHideSoon() {
        clearTimeout(bugHideTimer);
        bugHideTimer = setTimeout(bugApplyHide, 1500);
      }
      bugShow();
      var bugDrag = null;
      btn.addEventListener('pointerdown', function(e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        bugDrag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
        try { btn.setPointerCapture(e.pointerId); } catch (err2) {}
        btn.classList.remove('_snowd_bug_hide', '_snowd_bug_hide_left');
        clearTimeout(bugHideTimer);
      });
      btn.addEventListener('pointermove', function(e) {
        if (!bugDrag) return;
        var dx = e.clientX - bugDrag.x;
        var dy = e.clientY - bugDrag.y;
        if (!bugDrag.moved && Math.abs(e.clientX - bugDrag.sx) + Math.abs(e.clientY - bugDrag.sy) > 8) bugDrag.moved = true;
        if (bugDrag.moved) {
          var r = btn.getBoundingClientRect();
          var left = Math.max(6, Math.min(window.innerWidth - r.width - 6, r.left + dx));
          var top = Math.max(6, Math.min(window.innerHeight - r.height - 6, r.top + dy));
          btn.style.left = left + 'px';
          btn.style.top = top + 'px';
          btn.style.right = 'auto';
          btn.style.marginTop = '0px';
          bugDrag.x = e.clientX;
          bugDrag.y = e.clientY;
        }
      });
      function bugDragEnd(e) {
        if (!bugDrag) return;
        try { btn.releasePointerCapture(e.pointerId); } catch (err2) {}
        var moved = bugDrag.moved;
        bugDrag = null;
        if (moved) { bugShow(); return; }
        if (btn.classList.contains('_snowd_bug_hide') || btn.classList.contains('_snowd_bug_hide_left')) { bugShow(); return; }
        e.stopPropagation();
        showBugModal();
      }
      btn.addEventListener('pointerup', bugDragEnd);
      btn.addEventListener('pointercancel', function() { bugDrag = null; bugShow(); });
      btn.addEventListener('mouseenter', function() {
        if (!bugDrag) { btn.classList.remove('_snowd_bug_hide', '_snowd_bug_hide_left'); clearTimeout(bugHideTimer); }
      });
      btn.addEventListener('mouseleave', function() {
        if (!bugDrag) bugHideSoon();
      });
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
