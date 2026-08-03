// 斯诺德跑团 — 移动端 AI 顾问悬浮球入口
// 只在移动端（窄屏或 APK 内）显示；桌面 Electron 保持原侧滑面板不动。
(function () {
  'use strict';
  if (window.__snowdAdvisorMobileEntry) return;
  window.__snowdAdvisorMobileEntry = true;

  function isElectron() {
    return !!(
      window.electronAPI ||
      (window.navigator &&
        window.navigator.userAgent &&
        /Electron\//.test(window.navigator.userAgent))
    );
  }

  function isNarrow() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
  }

  function init() {
    if (isElectron()) return;
    if (!(window.mobileBridge || isNarrow())) return;

    var path = location.pathname || '';
    var file = path.split('/').pop() || '';
    if (file === '\u987e\u95ee.html') return;

    var dirs = path.split('/');
    dirs.pop();
    var baseDir = dirs[dirs.length - 1] || '';
    var href;
    if (window.mobileBridge) {
      // APK 内直接用绝对 appassets 地址，避免相对路径解析异常
      href = 'https://appassets.androidplatform.net/\u65af\u8bfa\u5fb7\u8dd1\u56e2/\u987e\u95ee.html';
    } else if (baseDir === '\u65af\u8bfa\u5fb7\u8dd1\u56e2') {
      href = '\u987e\u95ee.html';
    } else if (baseDir === '\u804c\u4e1a\u9875') {
      href = '../\u65af\u8bfa\u5fb7\u8dd1\u56e2/\u987e\u95ee.html';
    } else {
      href = '\u65af\u8bfa\u5fb7\u8dd1\u56e2/\u987e\u95ee.html';
    }

    var style = document.createElement('style');
    style.textContent =
      '#_snowd_adv_mobile_ball{position:fixed;right:14px;bottom:calc(22px + env(safe-area-inset-bottom));' +
      'z-index:2147483000;width:54px;height:54px;border-radius:50%;' +
      'border:2px solid #a46d1f;background:#fffdf8;color:#a46d1f;font-size:26px;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 4px 16px rgba(164,109,31,0.38);user-select:none;-webkit-tap-highlight-color:transparent}' +
      '#_snowd_adv_mobile_ball:active{transform:scale(0.92)}' +
      'html.dark #_snowd_adv_mobile_ball{background:#24272b;border-color:#d4a54a;color:#d4a54a}';
    document.head.appendChild(style);

    var ball = document.createElement('div');
    ball.id = '_snowd_adv_mobile_ball';
    ball.setAttribute('aria-label', '\u6253\u5f00 AI \u987e\u95ee');
    ball.title = 'AI \u987e\u95ee';
    ball.textContent = '\u2728';
    ball.addEventListener('click', function () {
      location.href = href;
    });
    document.body.appendChild(ball);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
