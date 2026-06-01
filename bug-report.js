// 斯诺德跑团 - Bug 反馈 → ntfy.sh 即时推送
(function() {
  var NTFY_TOPIC = 'snowd-bug-report';
  function initBugReport() {
    var ERROR_KEY = '_snowd_error_log';
    var oldErr = window.onerror;
    window.onerror = function(msg, src, line) {
      try {
        var log = JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');
        log.push({time:new Date().toISOString(),msg:String(msg).substring(0,500),src:String(src||'').substring(0,200),line:line||0,page:location.href});
        if(log.length>20)log=log.slice(-20);
        localStorage.setItem(ERROR_KEY,JSON.stringify(log));
      }catch(e){}
      if(oldErr)return oldErr.apply(this,arguments);
    };
    var btn = document.createElement('button');
    btn.textContent = '🐛'; btn.title = '反馈 Bug / 建议';
    btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;width:44px;height:44px;border-radius:50%;border:2px solid #c62828;background:#fff;color:#c62828;font-size:20px;cursor:pointer;box-shadow:0 2px 12px rgba(198,40,40,0.3);';
    btn.onmouseenter=function(){this.style.transform='scale(1.15)';};
    btn.onmouseleave=function(){this.style.transform='scale(1)';};
    btn.onclick=function(){
      var desc=prompt('请描述问题（发生了什么 vs 你期望什么）：');
      if(!desc||!desc.trim())return;
      var body=['页面: '+location.href,'标题: '+document.title,'时间: '+new Date().toLocaleString('zh-CN'),'','描述: '+desc];
      try{var el=JSON.parse(localStorage.getItem(ERROR_KEY)||'[]');if(el.length){body.push('','--- 最近错误 ---');el.slice(-3).forEach(function(e){body.push(e.time+': '+e.msg);});}}catch(e){}
      fetch('https://ntfy.sh/'+NTFY_TOPIC,{method:'POST',body:body.join('\n'),headers:{'Title':'🐛 Bug: '+(document.title||''),'Tags':'bug'}})
        .then(function(){alert('✅ 反馈已发送，感谢！');})
        .catch(function(){alert('❌ 发送失败，请检查网络');});
    };
    document.body.appendChild(btn);
    var mq=window.matchMedia('(max-width:600px)');function adj(){if(mq.matches){btn.style.bottom='90px';btn.style.right='12px';btn.style.width='38px';btn.style.height='38px';btn.style.fontSize='17px'}}adj();mq.addEventListener('change',adj);
  }
  if(document.body)initBugReport();
  else document.addEventListener('DOMContentLoaded',initBugReport);
})();
