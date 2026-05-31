// Sentry 错误上报 — 由 CI 在部署时自动注入到所有 HTML 页面
(function() {
  // file:// 协议下不启用（本地开发）
  if (window.location.protocol === 'file:') return;

  var DSN = document.currentScript && document.currentScript.getAttribute('data-dsn');
  if (!DSN || DSN === '__SENTRY_DSN__') return;

  // 加载 Sentry CDN
  var script = document.createElement('script');
  script.src = 'https://js.sentry-cdn.com/' + DSN + '.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = function() {
    if (typeof Sentry !== 'undefined') {
      Sentry.init({
        dsn: 'https://' + DSN + '@o0.ingest.sentry.io/0',
        environment: window.location.hostname.includes('github.io') ? 'production' : 'development',
        release: document.querySelector('meta[name="version"]') 
          ? document.querySelector('meta[name="version"]').content 
          : 'unknown',
        beforeSend: function(event) {
          // 过滤 localStorage 相关错误（隐私模式下的已知问题）
          if (event.exception && event.exception.values) {
            var msg = event.exception.values[0].value || '';
            if (msg.indexOf('localStorage') >= 0) return null;
            if (msg.indexOf('QuotaExceeded') >= 0) return null;
          }
          return event;
        }
      });

      // 设置全局用户上下文
      Sentry.setTag('page', window.location.pathname.split('/').pop() || 'unknown');
      Sentry.setTag('lang', 'zh-CN');
    }
  };
  script.onerror = function() {
    console.warn('[Sentry] SDK 加载失败，错误上报未启用');
  };
  document.head.appendChild(script);

  // 捕获未处理的 Promise rejection
  window.addEventListener('unhandledrejection', function(event) {
    console.error('[未捕获的异步错误]', event.reason);
  });
})();
