// 斯诺德跑团 - 全局 Bug 反馈按钮
// 由 CI 在部署时自动注入所有 HTML 页面
(function() {
  // 页面加载延迟显示，避免与页面初始化冲突
  setTimeout(initBugReport, 800);

  function initBugReport() {
  var ERROR_KEY = '_snowd_error_log';
  var oldOnError = window.onerror;
  window.onerror = function(msg, src, line, col, err) {
    try {
      var log = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
      log.push({
        time: new Date().toISOString(),
        msg: String(msg).substring(0, 500),
        src: String(src || '').substring(0, 300),
        line: line || 0,
        page: window.location.href
      });
      if (log.length > 20) log = log.slice(-20);
      localStorage.setItem(ERROR_KEY, JSON.stringify(log));
    } catch(e) {}
    if (oldOnError) return oldOnError.apply(this, arguments);
  };

  // 创建悬浮按钮
  var btn = document.createElement('button');
  btn.textContent = '🐛';
  btn.title = '反馈 Bug / 建议';
  btn.style.cssText = [
    'position:fixed','bottom:30px','right:30px','z-index:9999',
    'width:44px','height:44px','border-radius:50%',
    'border:2px solid #c62828','background:#fff',
    'color:#c62828','font-size:20px','cursor:pointer',
    'box-shadow:0 2px 12px rgba(198,40,40,0.3)',
    'transition:all 0.2s','display:flex','align-items:center','justify-content:center',
    'padding:0','line-height:1'
  ].join(';');
  btn.onmouseenter = function() {
    this.style.transform = 'scale(1.15)';
    this.style.boxShadow = '0 4px 20px rgba(198,40,40,0.5)';
  };
  btn.onmouseleave = function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '0 2px 12px rgba(198,40,40,0.3)';
  };

  btn.onclick = function() {
    var ctx = [];
    ctx.push('## 环境信息');
    ctx.push('- 页面: ' + window.location.href);
    ctx.push('- 标题: ' + (document.title || '未知'));
    ctx.push('- 浏览器: ' + navigator.userAgent);
    ctx.push('- 时间: ' + new Date().toLocaleString('zh-CN'));

    try {
      var errLog = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
      if (errLog.length > 0) {
        ctx.push('');
        ctx.push('## 最近的 JS 错误');
        var recent = errLog.slice(-5);
        for (var i = 0; i < recent.length; i++) {
          ctx.push('- ' + recent[i].time + ': ' + recent[i].msg);
        }
      }
    } catch(e) {}

    ctx.push('');
    ctx.push('## 问题描述');
    ctx.push('（请在此描述你遇到的问题，以及你期望的正确行为是什么）');
    ctx.push('');
    ctx.push('发生了什么：');
    ctx.push('期望的结果：');
    ctx.push('复现步骤：');

    var title = encodeURIComponent('[Bug反馈] ' + (document.title || '未知页面'));
    var body = encodeURIComponent(ctx.join('\n'));
    window.open('https://github.com/Doylesama114/Snode-rpg/issues/new?title=' + title + '&body=' + body, '_blank');
  };

  document.body.appendChild(btn);

  // 移动端适配
  var mq = window.matchMedia('(max-width: 600px)');
  function adj() {
    if (mq.matches) { btn.style.bottom='90px'; btn.style.right='12px'; btn.style.width='38px'; btn.style.height='38px'; btn.style.fontSize='17px'; }
  }
  adj(); mq.addEventListener('change', adj);
  } // end initBugReport
})();
