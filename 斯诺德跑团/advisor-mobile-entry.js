// Snode RPG - mobile AI advisor floating ball entry (draggable + edge-collapse)
(function () {
  'use strict';
  if (window.__snowdAdvisorMobileEntry) return;
  window.__snowdAdvisorMobileEntry = true;

  var POS_KEY = '_snowd_adv_mobile_pos';
  var HIDE_DELAY = 4000;

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

  function loadPos() {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    } catch (e) { return null; }
  }
  function savePos(pos) {
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) { /* ignore */ }
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
      // APK \u5185\u76f4\u63a5\u7528\u7edd\u5bf9 appassets \u5730\u5740\uff0c\u907f\u514d\u76f8\u5bf9\u8def\u5f84\u89e3\u6790\u5f02\u5e38
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
      '#_snowd_adv_mobile_ball{position:fixed;right:0;bottom:calc(84px + env(safe-area-inset-bottom));' +
      'z-index:2147483000;width:54px;height:54px;border-radius:50%;' +
      'border:2px solid #a46d1f;background:#fffdf8;color:#a46d1f;font-size:26px;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 4px 16px rgba(164,109,31,0.38);user-select:none;-webkit-tap-highlight-color:transparent;' +
      'transition:transform .25s ease}' +
      '#_snowd_adv_mobile_ball._hide{transform:translateX(calc(100% - 18px))}' +
      '#_snowd_adv_mobile_ball._hide_left{transform:translateX(calc(-100% + 18px))}' +
      '#_snowd_adv_mobile_ball:not(._hide):not(._hide_left):active{transform:scale(0.94)}' +
      'html.dark #_snowd_adv_mobile_ball{background:#24272b;border-color:#d4a54a;color:#d4a54a}' + '#_snowd_adv_mobile_tip{position:fixed;z-index:2147483001;max-width:min(240px,calc(100vw - 76px));padding:8px 10px;border-radius:12px;border:1px solid #d8d2c4;background:#fffdf8;color:#1f2522;font-size:12px;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.12);cursor:pointer;display:none;word-break:break-word;-webkit-tap-highlight-color:transparent}' + '#_snowd_adv_mobile_tip::after{content:\"\u70b9\u51fb\u6362\u4e0b\u4e00\u6761\";display:block;font-size:10px;color:#69706b;margin-top:4px;text-align:right}' + 'html.dark #_snowd_adv_mobile_tip{background:#24272b;border-color:#d4a54a;color:#e8e6e3}' + 'html.dark #_snowd_adv_mobile_tip::after{color:#9d9b98}' + '#_snowd_adv_mobile_tip._show{display:block}'
    document.head.appendChild(style);

    var ball = document.createElement('div');
    ball.id = '_snowd_adv_mobile_ball';
    ball.setAttribute('aria-label', '\u6253\u5f00 AI \u987e\u95ee');
    ball.title = 'AI \u987e\u95ee';
    ball.textContent = '\u2728';
    document.body.appendChild(ball);

    // ---------- 入口小贴士气泡：每 5 分钟轮换一条 ----------
    var TIP_INTERVAL = 5 * 60 * 1000;
    var TIP_FIRST_DELAY = 3000;
    var TIP_SHOW_MS = 5000;
    var tipPool = [];
    var tipIdx = 0;
    var tipTimer = null;
    var tipHideTimer = null;
    var tipEl = document.createElement('div');
    tipEl.id = '_snowd_adv_mobile_tip';
    tipEl.title = '点击换下一条';
    document.body.appendChild(tipEl);
    try {
      var _d = window.SNOWD_ADVISOR_TIPS || null;
      if (_d && Array.isArray(_d.tips) && Array.isArray(_d.rules)) {
        tipPool = _d.tips.concat(_d.rules);
        if (tipPool.length) tipIdx = Math.floor(Math.random() * tipPool.length);
      }
    } catch (err) { /* ignore */ }

    function positionTipBubble() {
      if (!tipEl.classList.contains('_show')) return;
      var r = ball.getBoundingClientRect();
      var tw = tipEl.offsetWidth || 260;
      var th = tipEl.offsetHeight || 70;
      var left = r.right - tw;
      if (left < 8) left = 8;
      if (left + tw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tw - 8);
      var top = r.top - th - 8;
      if (top < 8) top = r.bottom + 8;
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
      tipEl.style.right = 'auto';
      tipEl.style.bottom = 'auto';
    }
    function showTipBubble() {
      if (!tipPool.length) return;
      tipEl.textContent = tipPool[tipIdx % tipPool.length];
      tipEl.classList.add('_show');
      positionTipBubble();
      clearTimeout(tipHideTimer);
      tipHideTimer = setTimeout(hideTipBubble, TIP_SHOW_MS);
    }
    function hideTipBubble() {
      clearTimeout(tipHideTimer);
      tipEl.classList.remove('_show');
    }
    function nextTip() {
      if (!tipPool.length) return;
      if (tipPool.length > 1) {
        var n = Math.floor(Math.random() * (tipPool.length - 1));
        tipIdx = (n >= tipIdx ? n + 1 : n) % tipPool.length;
      }
      showTipBubble();
    }
    tipEl.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      nextTip();
    });
    if (tipPool.length) {
      setTimeout(showTipBubble, TIP_FIRST_DELAY);
      tipTimer = setInterval(nextTip, TIP_INTERVAL);
    }

    var pos = loadPos();
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
      ball.style.left = pos.left + 'px';
      ball.style.top = pos.top + 'px';
      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
    }

    var hideTimer = null;
    function applyHide() {
      var r = ball.getBoundingClientRect();
      var center = window.innerWidth / 2;
      ball.classList.remove('_hide', '_hide_left');
      if (r.left + r.width / 2 < center) ball.classList.add('_hide_left');
      else ball.classList.add('_hide');
      hideTipBubble();
    }
    function scheduleHide(delay) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(applyHide, delay || HIDE_DELAY);
    }
    function show() {
      ball.classList.remove('_hide', '_hide_left');
      scheduleHide();
      showTipBubble();
    }
    scheduleHide();

    var drag = null;
    ball.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
      try { ball.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      ball.classList.remove('_hide', '_hide_left');
      clearTimeout(hideTimer);
    });
    ball.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 8) drag.moved = true;
      if (drag.moved) {
        var r = ball.getBoundingClientRect();
        var left = Math.max(6, Math.min(window.innerWidth - r.width - 6, r.left + dx));
        var top = Math.max(6, Math.min(window.innerHeight - r.height - 6, r.top + dy));
        ball.style.left = left + 'px';
        ball.style.top = top + 'px';
        ball.style.right = 'auto';
        ball.style.bottom = 'auto';
        positionTipBubble();
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
    });
    ball.addEventListener('pointerup', function (e) {
      if (!drag) return;
      try { ball.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var moved = drag.moved;
      drag = null;
      if (moved) {
        var r = ball.getBoundingClientRect();
        savePos({ left: r.left, top: r.top });
        scheduleHide();
        return;
      }
      if (ball.classList.contains('_hide') || ball.classList.contains('_hide_left')) {
        show();
        return;
      }
      location.href = href;
    });
    ball.addEventListener('pointercancel', function () {
      drag = null;
      scheduleHide();
    });

    ball.addEventListener('mouseenter', function () {
      if (!drag) {
        ball.classList.remove('_hide', '_hide_left');
        clearTimeout(hideTimer);
      }
    });
    ball.addEventListener('mouseleave', function () {
      if (!drag) scheduleHide(1600);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
