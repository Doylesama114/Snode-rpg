/* 版本更新开屏提示（26.10.22 色彩标识重做）
 * 规则：只有右上角 ✕ 与底部「我已了解」可以关闭；不响应遮罩点击、不响应 ESC、不自动消失。
 * 每次公告只提示一次，记录在 localStorage。
 */
(function (root) {
  'use strict';
  if (root.__swdNoticeBooted) return;
  root.__swdNoticeBooted = true;

  var KEY = '_snowd_notice_';

  var NOTICES = [
    {
      id: '2026_10_22_color',
      version: '26.10.22',
      date: '2026-10-22',
      title: '【重要版本更新 26.10.22】对色彩标识功能的重做',
      lead: '近期接受部分玩家反馈，包括学习技能存在阅读门槛、色彩标识辨识度不高难以分辨、难以获得需求的色彩标识等问题，我们对色彩标识的相关机制进行了全方位调整，以确保该体系能够更顺畅的在游玩过程中运用，并减少繁杂的计算量，具体细节如下：',
      items: [
        '①取消所有天赋树中技能和天赋的色彩标识要求，即玩家仅需要支付技能点即可学习对应能力。',
        '②根据玩家角色的四项个性背景的类型（特点、理念、羁绊、缺陷）提供不同的色彩标识，这些标识的分类仍然与原先色彩标识规则相符合。',
        '③每场游玩结束后 DM 仍然会如以往一致公示团队获取的色彩标识，每名玩家角色根据自身个性背景拥有的色彩标识获取少量经验值，每个标识提供 10 点经验值（如果玩家的个性背景提供多个相同颜色的色彩标识，那么每个标识都会重复结算一次经验值）。',
        '④在游戏过程中，玩家角色的每个色彩标识允许用于在进行对应场景下进行一次重掷，玩家可以消耗一个对应次数在场景吻合的合理情况下进行描述向 DM 申请重掷，被消耗的标识次数仍然会在游玩结束时提供经验值，并且在下一次游玩时照常恢复。',
        '⑤考虑到大部分玩家不擅于使用，取消原先的色彩骰 D8 重掷机制。',
        '⑥原先关于色彩标识的部分技能和专长等各类效果将会陆续重做，包括在移除色彩标识限制情况下部分能力的前置、额外条件等相关会进行相应调整，后续会在小程序上更新。',
        '⑦玩家角色的进阶途径仍需要满足对应的三个色彩标识，暂不做修改。'
      ]
    }
  ];

  function ls(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function seen(id) { return ls(function () { return localStorage.getItem(KEY + id) === '1'; }, false); }
  function markSeen(id) { ls(function () { localStorage.setItem(KEY + id, '1'); }); }

  function pending() {
    for (var i = 0; i < NOTICES.length; i++) if (!seen(NOTICES[i].id)) return NOTICES[i];
    return null;
  }

  var CSS = [
    '#swdNoticeMask{position:fixed;inset:0;z-index:2147483400;background:rgba(20,18,14,.62);display:flex;align-items:center;display:flex;justify-content:center;padding:16px;box-sizing:border-box}',
    '#swdNoticeBox{position:relative;width:100%;max-width:620px;max-height:84vh;display:flex;flex-direction:column;background:#fffdf8;color:#1f2522;border:2px solid #d8d2c4;border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,.35);overflow:hidden;font-size:14px;line-height:1.7}',
    '#swdNoticeBox header{padding:14px 52px 12px 18px;background:#f6efe1;border-bottom:1px solid #e7dcc4;flex:0 0 auto}',
    '#swdNoticeBox h2{margin:0;font-size:16px;line-height:1.45;color:#5a3a12;font-weight:bold}',
    '#swdNoticeBox .swd-notice-date{display:block;margin-top:3px;font-size:12px;color:#8a7d68}',
    '#swdNoticeClose{position:absolute;top:8px;right:8px;width:40px;height:40px;border:none;border-radius:8px;background:transparent;color:#7a6042;font-size:24px;line-height:1;cursor:pointer;padding:0}',
    '#swdNoticeClose:hover,#swdNoticeClose:focus{background:#e9dcc6;outline:none}',
    '#swdNoticeBody{padding:14px 18px;overflow-y:auto;flex:1 1 auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
    '#swdNoticeBody p{margin:0 0 10px}',
    '#swdNoticeBody .swd-notice-item{margin:0 0 9px;padding-left:2px}',
    '#swdNoticeBox footer{padding:12px 18px;border-top:1px solid #e7dcc4;background:#faf6ee;flex:0 0 auto;text-align:right}',
    '#swdNoticeOk{padding:9px 22px;font-size:14px;font-weight:bold;color:#fff;background:#4caf50;border:none;border-radius:8px;cursor:pointer}',
    '#swdNoticeOk:focus{outline:2px solid #2f7d33;outline-offset:2px}',
    '@media (max-width:600px){#swdNoticeBox{max-height:88vh;font-size:13.5px}#swdNoticeBox h2{font-size:15px}#swdNoticeBody{padding:12px 14px}#swdNoticeBox header{padding:12px 48px 10px 14px}}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('swdNoticeCss')) return;
    var st = document.createElement('style');
    st.id = 'swdNoticeCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function show(notice) {
    if (!notice) return false;
    if (document.getElementById('swdNoticeMask')) return true;
    injectCss();

    var mask = document.createElement('div');
    mask.id = 'swdNoticeMask';

    var box = document.createElement('div');
    box.id = 'swdNoticeBox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'swdNoticeTitle');

    var head = document.createElement('header');
    var h2 = document.createElement('h2');
    h2.id = 'swdNoticeTitle';
    h2.textContent = notice.title;
    var dt = document.createElement('span');
    dt.className = 'swd-notice-date';
    dt.textContent = notice.date + '　版本 ' + notice.version;
    head.appendChild(h2);
    head.appendChild(dt);

    var close = document.createElement('button');
    close.id = 'swdNoticeClose';
    close.type = 'button';
    close.setAttribute('aria-label', '关闭');
    close.textContent = '✕';

    var body = document.createElement('div');
    body.id = 'swdNoticeBody';
    if (notice.lead) {
      var p0 = document.createElement('p');
      p0.textContent = notice.lead;
      body.appendChild(p0);
    }
    for (var i = 0; i < notice.items.length; i++) {
      var row = document.createElement('div');
      row.className = 'swd-notice-item';
      row.textContent = notice.items[i];
      body.appendChild(row);
    }

    var foot = document.createElement('footer');
    var ok = document.createElement('button');
    ok.id = 'swdNoticeOk';
    ok.type = 'button';
    ok.textContent = '我已了解';
    foot.appendChild(ok);

    box.appendChild(close);
    box.appendChild(head);
    box.appendChild(body);
    box.appendChild(foot);
    mask.appendChild(box);

    var prevFocus = document.activeElement;
    function dismiss() {
      markSeen(notice.id);
      if (mask.parentNode) mask.parentNode.removeChild(mask);
      document.removeEventListener('keydown', trap, true);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
    }
    /* 只拦截 Tab 焦点循环；ESC 明确不关闭 */
    function trap(e) {
      if (e.key !== 'Tab') return;
      var focusables = [close, ok];
      var idx = focusables.indexOf(document.activeElement);
      e.preventDefault();
      var next = e.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1)
        : (idx === focusables.length - 1 ? 0 : idx + 1);
      focusables[next].focus();
    }
    close.addEventListener('click', dismiss);
    ok.addEventListener('click', dismiss);
    /* 刻意不绑定遮罩点击；刻意不绑定 ESC */

    document.body.appendChild(mask);
    document.addEventListener('keydown', trap, true);
    close.focus();
    return true;
  }

  function reset(id) {
    if (id) { ls(function () { localStorage.removeItem(KEY + id); }); return; }
    for (var i = 0; i < NOTICES.length; i++) {
      (function (n) { ls(function () { localStorage.removeItem(KEY + n.id); }); })(NOTICES[i]);
    }
  }

  root.SnowdNotice = {
    notices: NOTICES,
    pending: pending,
    show: function (id) {
      if (!id) return show(pending());
      for (var i = 0; i < NOTICES.length; i++) if (NOTICES[i].id === id) return show(NOTICES[i]);
      return false;
    },
    reset: reset
  };

  /* 自动化环境（Playwright/Puppeteer 会置 navigator.webdriver）默认不弹，避免遮挡 E2E 点击；
     需要强制显示时设置 window.__swdForceNotice = true，或调用 SnowdNotice.show(id)。 */
  function isAutomation() {
    try {
      if (root.__swdForceNotice) return false;
      return !!navigator.webdriver;
    } catch (e) { return false; }
  }

  function boot() {
    if (isAutomation()) return;
    var n = pending();
    if (n) show(n);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
