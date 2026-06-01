// 斯诺德跑团 - Bug 反馈按钮（邮件 + Formspree 双通道）
(function() {
  var EMAIL = 'your-email@example.com';
  setTimeout(initBugReport, 800);

  function initBugReport() {
  var ERROR_KEY = '_snowd_error_log';
  window.onerror = function(msg, src, line) {
    try {
      var log = JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');
      log.push({time:new Date().toISOString(),msg:String(msg).substring(0,500),src:String(src||'').substring(0,200),line:line||0,page:location.href});
      if(log.length>20)log=log.slice(-20);
      localStorage.setItem(ERROR_KEY,JSON.stringify(log));
    }catch(e){}
  };

  var btn = document.createElement('button');
  btn.textContent = '🐛'; btn.title = '反馈 Bug';
  btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;width:44px;height:44px;border-radius:50%;border:2px solid #c62828;background:#fff;color:#c62828;font-size:20px;cursor:pointer;box-shadow:0 2px 12px rgba(198,40,40,0.3);transition:all 0.2s;display:flex;align-items:center;justify-content:center;padding:0;line-height:1';

  btn.onclick = function() {
    var desc = prompt('请描述问题（期望 vs 实际发生什么）：\n\n（写完后点确定会自动打开邮件客户端发送）');
    if (!desc || !desc.trim()) return;

    var body = ['页面: '+location.href, '标题: '+document.title, '时间: '+new Date().toLocaleString('zh-CN'), '浏览器: '+navigator.userAgent, '', '--- 问题描述 ---', desc];
    try { var el=JSON.parse(localStorage.getItem(ERROR_KEY)||'[]'); if(el.length){ body.push('','--- 最近JS错误 ---'); el.slice(-3).forEach(function(e){body.push(e.time+': '+e.msg);}); } } catch(e){}

    var subject = encodeURIComponent('Bug: ' + (document.title||''));
    var text = encodeURIComponent(body.join('\n'));
    location.href = 'mailto:' + EMAIL + '?subject=' + subject + '&body=' + text;
  };

  document.body.appendChild(btn);
  var mq=window.matchMedia('(max-width:600px)'); function adj(){if(mq.matches){btn.style.bottom='90px';btn.style.right='12px';btn.style.width='38px';btn.style.height='38px';btn.style.fontSize='17px'}} adj(); mq.addEventListener('change',adj);
  }
})();
