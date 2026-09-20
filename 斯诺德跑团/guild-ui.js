/* ==========================================================================
   斯诺德跑团 · 工会 UI 共享层（guild-ui.js）
   职责：① 自动注入样式与 SVG 图标  ② 启动台布局配置读写  ③ 角色探测  ④ 导航层（懒挂载）
        ⑤ 返回语义修复  ⑥ 主题/音量开关
   用法：页面 <body> 末尾加一行 <script src="guild-ui.js"></script>
   规格：设计风格规范.md（v7 定稿）
   ========================================================================== */
(function () {
  if (window.SnowdGuild) return;

  var SELF = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var BASE = (SELF && SELF.src ? SELF.src : '').replace(/[^\/]*$/, '');   // 同目录
  var APP = { launcher: BASE + '启动台.html', panel: BASE + '角色面板.html', settings: BASE + '设置.html' };

  /* ---------------- ① 样式注入 ---------------- */
  function injectCss() {
    if (document.getElementById('gui-css')) return;
    var l = document.createElement('link');
    l.id = 'gui-css'; l.rel = 'stylesheet'; l.href = BASE + 'guild-ui.css';
    document.head.appendChild(l);
  }

  /* ---------------- ② SVG 图标 ---------------- */
  function injectSprite() {
    if (document.getElementById('gui-sprite')) return;
    var box = document.createElement('div');
    box.innerHTML = SPRITE;
    var svg = box.firstChild;
    if (svg) { svg.id = 'gui-sprite'; document.body.appendChild(svg); }
  }

  /* ---------------- ③ 应用目录（可用于启动台的入口池） ---------------- */
  var CATALOG = [
    { id: 'home',      name: '角色管理',   desc: '选择已有角色、进入面板与存档', icon: 'i-character', href: '主页.html' },
    { id: 'chargen',   name: '创建新角色', desc: '八步向导 · 属性 / 装备 / 导出', icon: 'i-create',    href: '角色创建页.html' },
    { id: 'upload',    name: '上传角色',   desc: '从 xlsx 表格导入角色档案',      icon: 'i-upload',    href: '上传角色.html' },
    { id: 'select',    name: '角色选择',   desc: '角色存档列表',                  icon: 'i-character', href: '角色选择页.html' },
    { id: 'saves',     name: '角色存档',   desc: '每角色三个存档位',              icon: 'i-save',      href: '角色存档页.html' },
    { id: 'classes',   name: '全部职业',   desc: '19 个职业 · 2,588 条技能',      icon: 'i-book',      href: '../职业页/首页.html' },
    { id: 'talents',   name: '通用天赋树', desc: '一至七阶通用天赋',              icon: 'i-tree',      href: '../职业页/通用天赋树.html' },
    { id: 'feats',     name: '特殊专长',   desc: '专长列表与前置条件',            icon: 'i-target',    href: '../职业页/特殊专长.html' },
    { id: 'prestige',  name: '进阶途径',   desc: '已公布的进阶职业',              icon: 'i-compass',   href: '../职业页/通用·进阶.html' },
    { id: 'library',   name: '资料库',     desc: '背景 / 种族 / 世界观词条',      icon: 'i-library',   href: '资料库.html' },
    { id: 'rulebook',  name: '规则手册',   desc: '基础规则 + 世界观架构',         icon: 'i-book',      href: 'help.html' },
    { id: 'items',     name: '物资大全',   desc: '装备、消耗品与价格',            icon: 'i-items',     href: '物资大全.html' },
    { id: 'duel',      name: '斯诺德对决', desc: '回合制卡牌对战 · 支持联网',     icon: 'i-dice',      href: '__POKER__' },
    { id: 'advisor',   name: 'AI 顾问',    desc: '车卡推荐与规则问答',            icon: 'i-character', href: '顾问.html' },
  ];
  function catById(id) { for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i]; return null; }
  /** 斯诺德对决入口：打包/镜像包用 ../poker-game；仓库 file:// 开发用 ../electron-app/poker-game（hash 路由必须带 #/） */
  function pokerHref() {
    if (window.electronAPI) return '../poker-game/index.html#/';
    if (location.pathname.indexOf('/electron-app/') !== -1) return '../poker-game/index.html#/';
    if (location.protocol === 'file:') return '../electron-app/poker-game/index.html#/';
    return '../poker-game/index.html#/';
  }

  function catHref(entry) {
    if (entry.id === 'duel') return BASE + pokerHref();
    if (entry.type === 'url') return entry.id;
    var c = catById(entry.id); return c ? (BASE + c.href).replace(/\\/g, '/') : '#';
  }

  /* ---------------- ④ 启动台布局配置 ---------------- */
  var LAYOUT_V = 2;   // v2：柜台默认由 library 改为 rulebook（避免与告示板重复）
  var LAYOUT_KEY = 'snowd_launcher_layout';
  var DEFAULT_LAYOUT = {
    v: 1,
    counter: ['home', 'classes', 'rulebook', 'duel'],       /* 柜台：4 个主入口 */
    board: [                                                /* 告示板：≤12 条 */
      { type: 'page', id: 'chargen' }, { type: 'page', id: 'upload' },
      { type: 'page', id: 'select' },   { type: 'page', id: 'library' },
      { type: 'page', id: 'items' },   { type: 'page', id: 'talents' },
      { type: 'page', id: 'feats' },   { type: 'page', id: 'prestige' },
    ],
  };
  var BOARD_MAX = 12;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function saneEntry(e) {
    if (!e || typeof e !== 'object') return null;
    var t = e.type || 'page';
    if (t === 'char') {
      if (!e.id || String(e.id).indexOf('#') < 0) return null;
      return { type: 'char', id: String(e.id), label: String(e.label || '我的角色').slice(0, 20) };
    }
    if (t === 'url') {
      var u = String(e.id || '');
      if (!/^https?:\/\//i.test(u)) return null;
      return { type: 'url', id: u, label: String(e.label || u).slice(0, 24) };
    }
    var c = catById(e.id); if (!c) return null;
    return { type: 'page', id: c.id };
  }
  function getLayout() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (e) { raw = null; }
    if (!raw || (raw.v !== 1 && raw.v !== 2)) return clone(DEFAULT_LAYOUT);
    var out = { v: LAYOUT_V, counter: [], board: [] };
    (raw.counter || []).forEach(function (id) { if (catById(id) && out.counter.length < 4 && out.counter.indexOf(id) < 0) out.counter.push(id); });
    while (out.counter.length < 4) { var d = DEFAULT_LAYOUT.counter[out.counter.length]; if (out.counter.indexOf(d) < 0) out.counter.push(d); else break; }
    (raw.board || []).forEach(function (e) { var s = saneEntry(e); if (s && out.board.length < BOARD_MAX) out.board.push(s); });
    if (!out.board.length) out.board = clone(DEFAULT_LAYOUT.board);
    /* v1→v2 迁移：柜台与告示板同时出现「资料库」时，柜台改为「规则手册」 */
    if (raw.v === 1) {
      var boardHasLib = out.board.some(function (e) { return e.id === 'library'; });
      var ci = out.counter.indexOf('library');
      if (boardHasLib && ci >= 0) out.counter[ci] = 'rulebook';
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(out)); } catch (e) {}
    }
    return out;
  }
  function setLayout(l) {
    var out = { v: LAYOUT_V, counter: [], board: [] };
    ((l && l.counter) || []).forEach(function (id) { if (catById(id) && out.counter.length < 4 && out.counter.indexOf(id) < 0) out.counter.push(id); });
    ((l && l.board) || []).forEach(function (e) { var s = saneEntry(e); if (s && out.board.length < BOARD_MAX) out.board.push(s); });
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(out)); } catch (e) {}
    return out;
  }
  function resetLayout() { try { localStorage.removeItem(LAYOUT_KEY); } catch (e) {} return clone(DEFAULT_LAYOUT); }
  function exportLayout() { return JSON.stringify(getLayout(), null, 2); }
  function importLayout(text) {
    try { var o = JSON.parse(text); if (!o || typeof o !== 'object') return { ok: false, msg: '不是有效的配置' };
      var saved = setLayout(o); return { ok: true, msg: '已导入 ' + saved.board.length + ' 个告示条目', layout: saved };
    } catch (e) { return { ok: false, msg: 'JSON 解析失败' }; }
  }

  /* ---------------- ⑤ 角色探测（键名 char_<名字>_slot<N>） ---------------- */
  function listCharacters() {
    var map = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('char_') !== 0) continue;
        var rest = k.slice(5), at = rest.lastIndexOf('_slot');
        if (at < 0) continue;
        var name = rest.slice(0, at), slot = parseInt(rest.slice(at + 5), 10);
        if (!name || !(slot > 0)) continue;
        if (!map[name]) map[name] = { name: name, slots: [] };
        map[name].slots.push(slot);
      }
    } catch (e) {}
    var out = [];
    Object.keys(map).forEach(function (n) { map[n].slots.sort(); out.push(map[n]); });
    out.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
    return out;
  }
  var RECENT_KEY = '_snowd_recent_char';
  function recentChar() {
    try { var o = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null'); if (o && o.name && o.slot > 0) return o; } catch (e) {}
    var list = listCharacters();
    return list.length ? { name: list[0].name, slot: list[0].slots[0] } : null;
  }
  function setRecentChar(name, slot) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify({ name: name, slot: slot, at: Date.now() })); } catch (e) {}
  }
  function hasCharacters() { return listCharacters().length > 0; }
  /** 角色面板直达链接（带来源标记，便于返回） */
  function panelHref(name, slot, fromLauncher) {
    var u = APP.panel + '?char=' + encodeURIComponent(name) + '&slot=' + (slot || 1);
    if (fromLauncher) u += '&from=launcher';
    return u;
  }

  /* ---- 内部工具 ---- */
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function toast(msg) {
    var t = document.querySelector('.gui-toast');
    if (!t) { t = el('div', 'gui-toast'); document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(t._tm); t._tm = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2200);
  }
  function fromLauncher() { return /[?&]from=launcher/.test(location.search); }

  window.SnowdGuild = {
    version: '1.0', base: BASE, app: APP, catalog: CATALOG,
    getLayout: getLayout, setLayout: setLayout, resetLayout: resetLayout,
    exportLayout: exportLayout, importLayout: importLayout, defaultLayout: function () { return clone(DEFAULT_LAYOUT); },
    boardMax: BOARD_MAX,
    listCharacters: listCharacters, recentChar: recentChar, setRecentChar: setRecentChar,
    hasCharacters: hasCharacters, panelHref: panelHref,
    catById: catById, catHref: catHref, toast: toast, fromLauncher: fromLauncher,
    isDark: isDark, setTheme: setTheme, toggleTheme: toggleTheme,
    isMuted: isMuted, toggleMute: toggleMute,
    _internal: { injectCss: injectCss, injectSprite: injectSprite, el: el },
  };

  var EMBLEMS =
    '<symbol id="ce-warrior" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M7 6l14 14M25 6L11 20"/><path d="M9 21l-3 3 3 3 3-3M23 21l3 3-3 3-3-3"/></g></symbol>' +
    '<symbol id="ce-paladin" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M16 4l10 4v8c0 6-4 10.5-10 12.5C10 26.5 6 22 6 16V8z"/><path d="M16 11v9M12 15h8"/></g></symbol>' +
    '<symbol id="ce-hunter" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5c6 4 6 18 0 22"/><path d="M10 5v22"/><path d="M6 16h18"/><path d="M19.5 11.5L24 16l-4.5 4.5"/></g></symbol>' +
    '<symbol id="ce-rogue" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3.5l3.2 9.5-3.2 8-3.2-8z"/><path d="M9 14.5h14"/><path d="M16 21.5v5"/><circle cx="16" cy="28.4" r="1.7"/></g></symbol>' +
    '<symbol id="ce-monk" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="16" cy="16" r="10.5"/><path d="M10.5 17c0-3.3 2.4-5.8 5.5-5.8s5.5 2.5 5.5 5.8c0 2.6-2 4.6-4.5 5.2"/></g></symbol>' +
    '<symbol id="ce-mage" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="16" cy="19" r="6.5"/><path d="M16 3.5v4M7 8l2.8 2.8M25 8l-2.8 2.8M4 19.5h3M25 19.5h3"/></g></symbol>' +
    '<symbol id="ce-warlock" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3.5 16C7.5 9.8 11.8 6.7 16 6.7s8.5 3.1 12.5 9.3C24.5 22.2 20.2 25.3 16 25.3S7.5 22.2 3.5 16z"/><circle cx="16" cy="16" r="3.6"/></g></symbol>' +
    '<symbol id="ce-priest" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="16" cy="13" r="7"/><path d="M16 4v18M9.5 13h13"/><path d="M16 22v6"/></g></symbol>' +
    '<symbol id="ce-druid" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 28C7.5 21.5 7.5 10 16 3.5 24.5 10 24.5 21.5 16 28z"/><path d="M16 8v16"/><path d="M16 14l4-3M16 19l4-3M16 14l-4-3M16 19l-4-3"/></g></symbol>' +
    '<symbol id="ce-bard" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="10.5" cy="23" r="3.4"/><path d="M13.9 23V7.5L25 4.3V20"/><circle cx="21.6" cy="20" r="3.4"/></g></symbol>' +
    '<symbol id="ce-shaman" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M19 3.5L8.5 18.5H15L13 28.5 23.5 13H17z"/></g></symbol>' +
    '<symbol id="ce-barbarian" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7v21"/><path d="M16 7c4-2.5 9-1 10.5 3.5C23 13.5 18.5 13 16 11z"/><path d="M16 7c-4-2.5-9-1-10.5 3.5C9 13.5 13.5 13 16 11z"/></g></symbol>' +
    '<symbol id="ce-artificer" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="16" cy="16" r="5"/><path d="M16 3.5v4M16 24.5v4M3.5 16h4M24.5 16h4M7.2 7.2l2.8 2.8M22 22l2.8 2.8M24.8 7.2L22 10M10 22l-2.8 2.8" stroke-linecap="round"/></g></symbol>' +
    '<symbol id="ce-contractor" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M10 6h13v20H10z"/><path d="M13 12h7M13 17h7"/><path d="M6.5 9.5c0-2 1.2-3.5 3.5-3.5M25.5 22.5c0 2-1.2 3.5-3.5 3.5"/></g></symbol>' +
    '<symbol id="ce-warden" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M16 3.5l9.5 3.2V19c0 5-4 8.5-9.5 10-5.5-1.5-9.5-5-9.5-10V6.7z"/><path d="M12 13h8v6h-8z"/></g></symbol>' +
    '<symbol id="ce-strategist" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="16" cy="14" r="7"/><path d="M16 4V1.5M8.5 7.5L6.6 5.6M23.5 7.5l1.9-1.9M11.5 27h9"/></g></symbol>' +
    '<symbol id="ce-summoner" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M16 16a2.6 2.6 0 1 1 2.6 2.6 5.2 5.2 0 1 1-5.2-5.2 7.8 7.8 0 1 1 7.8 7.8 10.4 10.4 0 1 1-10.4-10.4"/></g></symbol>' +
    '<symbol id="ce-tree" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3.5l6.5 8.5h-3.2L25 21H7l5.7-9H9.5z"/><path d="M16 21v6.5"/><path d="M11 27.5h10"/></g></symbol>' +
    '<symbol id="ce-advance" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="11.5"/><path d="M16 22.5V10M11 15l5-5 5 5"/></g></symbol>' +
    '<symbol id="ce-feats" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M16 3.5l3.8 7.9 8.7 1.1-6.4 6 1.6 8.6L16 23.1l-7.7 4 1.6-8.6-6.4-6 8.7-1.1z"/></g></symbol>' +
    '<symbol id="gui-sort-asc" viewBox="0 0 12 12"><path d="M6 2l4 5H2z" fill="currentColor"/></symbol>' +
    '<symbol id="gui-sort-desc" viewBox="0 0 12 12"><path d="M6 10L2 5h8z" fill="currentColor"/></symbol>';

  var ICONS =
    '<symbol id="i-character" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2"/></g></symbol>' +
    '<symbol id="i-book" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 6.2C9.6 4.8 7.2 4.6 4.6 5.6v12.2c2.6-1 5-.8 7.4.6"/><path d="M12 6.2c2.4-1.4 4.8-1.6 7.4-.6v12.2c-2.6-1-5-.8-7.4.6"/></g></symbol>' +
    '<symbol id="i-dice" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3.2"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></g></symbol>' +
    '<symbol id="i-help" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M9.7 9.5c.3-1.6 1.6-2.6 3.1-2.4 1.5.2 2.5 1.4 2.3 2.9-.2 1.5-1.6 2-2.6 2.7-.5.4-.7.9-.7 1.6"/><circle cx="11.9" cy="17.2" r="1.05" fill="currentColor" stroke="none"/></g></symbol>' +
    '<symbol id="i-create" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M11 5.5v11M5.5 11h11"/><path d="M18 5.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></g></symbol>' +
    '<symbol id="i-upload" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16.5V5"/><path d="M8 9l4-4 4 4"/><path d="M5 15v3.6h14V15"/></g></symbol>' +
    '<symbol id="i-save" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="16" height="12.5" rx="2.2"/><path d="M4 11h16"/><circle cx="12" cy="14.6" r="1.4" fill="currentColor" stroke="none"/></g></symbol>' +
    '<symbol id="i-library" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="5" width="4.6" height="14" rx="1"/><rect x="9.8" y="5" width="4.6" height="14" rx="1"/><path d="M16.4 6.2l3.8 1-3 12.2-3.8-1z"/></g></symbol>' +
    '<symbol id="i-items" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.6h4"/><path d="M11 3.6v5.6L6.9 17c-.6 1.3.3 2.7 1.7 2.7h6.8c1.4 0 2.3-1.4 1.7-2.7L13 9.2V3.6"/><path d="M8.7 14.6h6.6"/></g></symbol>' +
    '<symbol id="i-tree" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 4.5v10"/><path d="M12 7.5l4.8-2.2M12 10.6l4.8-2.2M12 7.5L7.2 5.3M12 10.6L7.2 8.4"/><path d="M9 19.5h6"/></g></symbol>' +
    '<symbol id="i-target" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.7"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/></g></symbol>' +
    '<symbol id="i-compass" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/></g></symbol>' +
    '<symbol id="i-gear" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.4v2.4M12 18.2v2.4M3.4 12h2.4M18.2 12h2.4M6 6l1.7 1.7M16.3 16.3L18 18M18 6l-1.7 1.7M7.7 16.3L6 18"/></g></symbol>' +
    '<symbol id="i-sound" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3l4-3.2v11.4l-4-3.2H4z"/><path d="M15 9.2c1.4 1.6 1.4 4 0 5.6"/></g></symbol>' +
    '<symbol id="i-theme" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke-linecap="round"/></g></symbol>' +
    '<symbol id="i-update" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.2h-4.2"/></g></symbol>' +
    '<symbol id="i-perf" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7.5 15.5l3.5-4 3 2.5 4.5-6"/></g></symbol>' +
    '<symbol id="i-info" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 10.6v5.6"/><circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none"/></g></symbol>';
  ICONS += EMBLEMS;
  /* ---------------- SVG 图标库（手绘，规格见设计风格规范.md 第四节） ---------------- */
  var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="gui-crest" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#c8a25a"/><circle cx="16" cy="16" r="12.5" fill="none" stroke="#6d5223"/>' +
      '<path d="M16 7l6 3v6.5c0 4-2.7 6.9-6 8-3.3-1.1-6-4-6-8V10z" fill="#6d5223" opacity=".85"/>' +
      '<path d="M16 11.5l1.6 3.4 3.4.5-2.5 2.4.6 3.5-3.1-1.7-3.1 1.7.6-3.5-2.5-2.4 3.4-.5z" fill="#f0d79a"/></symbol>' +
    '<symbol id="gui-pin" viewBox="0 0 22 22"><circle cx="11" cy="9" r="7" fill="#a83226"/><circle cx="8.6" cy="6.6" r="2.6" fill="#d4593f" opacity=".85"/>' +
      '<circle cx="11" cy="9" r="7" fill="none" stroke="#6b1f16"/><path d="M11 16v5" stroke="#6b1f16" stroke-width="2.2" stroke-linecap="round"/></symbol>' +
    '<symbol id="gui-nail" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#8a6a30"/><circle cx="6" cy="6" r="3.4" fill="#d8b46a"/>' +
      '<circle cx="4.6" cy="4.4" r="1.2" fill="#f4e3b4"/></symbol>' +
    '<symbol id="gui-fold" viewBox="0 0 22 22"><path d="M22 0v22H0z" fill="rgba(120,86,40,.28)"/><path d="M22 0L0 22" stroke="rgba(255,255,255,.7)"/></symbol>' +
    '<symbol id="gui-go" viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="#e8cfa4" stroke="#8a6234" stroke-width="1.5"/>' +
      '<path d="M7.5 13h10M14 9.5l3.5 3.5L14 16.5" fill="none" stroke="#4a3018" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="gui-plaque" viewBox="0 0 400 100" preserveAspectRatio="none">' +
      '<path d="M16 3 H372 L397 26 V84 H28 L3 61 V28 Z" fill="#c9a468"/>' +
      '<path d="M18 6 H370 L394 28 V81 H30 L6 58 V28 Z" fill="url(#guiFace)"/>' +
      '<path d="M18 6 H370 L394 28" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2"/>' +
      '<path d="M6 58 V80 H392" fill="none" stroke="rgba(90,58,20,.35)" stroke-width="2.5"/>' +
      '<g stroke="rgba(120,86,40,.20)" stroke-width="1.2"><path d="M24 24 H360"/><path d="M22 40 H364"/><path d="M20 56 H366"/></g></symbol>' +
    '<linearGradient id="guiFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/>' +
      '<stop offset=".55" stop-color="#f5e9cd"/><stop offset="1" stop-color="#e9d8b2"/></linearGradient>' +
    ICONS +
    '</defs></svg>';

  /* ---------------- ⑥ 导航层（懒挂载：点击才建面板 DOM） ---------------- */
  /* ---------------- ⑩ 页面外壳（opt-in：window.__guiSkin） ---------------- */
  function skinBoot() {
    if (!window.__guiSkin) return;
    document.body.classList.add("gui-page");
    if (window.__guiWizard) document.documentElement.classList.add("gui-wizard-page");
    /* 木梁已显示页面名：若页内 h1 与它重复（忽略 emoji/符号），隐藏以免重复 */
    if (!window.__guiBeam) return;
    var norm = function (s) { return String(s || "").replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\s]/gu, ""); };
    var beam = norm(window.__guiBeam);
    var h1s = document.querySelectorAll("h1");
    for (var i = 0; i < h1s.length; i++) {
      if (norm(h1s[i].textContent) === beam) h1s[i].style.display = "none";
    }
  }
  /* ---------------- ⑨ 木梁注入（给没有 header 的页面统一外壳） ---------------- */
  function beamBoot() {
    if (!window.__guiBeam) return;
    if (document.querySelector('header')) return;
    /* body 为 grid/flex 时跳过：注入的 header 会被自动排版到其它网格单元（曾导致木梁跑到页面底部） */
    var bd = getComputedStyle(document.body).display;
    if (bd === "grid" || bd === "flex") return;              // 已有顶栏的页面不动
    var mk = el('header', 'gui-beam');
    mk.innerHTML = '<svg style="width:26px;height:26px" viewBox="0 0 32 32"><use href="#gui-crest"/></svg>' +
      '<span class="gui-title"></span><span class="gui-sp"></span>' +
      '<a class="gui-back" href="' + APP.launcher + '">← 返回启动台</a>';
    mk.querySelector('.gui-title').textContent = window.__guiBeam;
    document.body.insertBefore(mk, document.body.firstChild);
  }

  function navBoot() {
    var trigger = el('button', 'gui-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.title = '功能导航 · 系统跳转（ESC 收起）';
    trigger.innerHTML = '<svg class="gui-crest" viewBox="0 0 32 32"><use href="#gui-crest"/></svg><span>功能导航</span>';

    var wrap = null, scrim = null, drop = null, open = false, built = false, cur = 'character';

    var SYSTEMS = [
      { id: 'character', name: '角色', icon: 'i-character', hint: '创建 · 管理 · 存档', ids: ['home', 'chargen', 'upload', 'select', 'saves'] },
      { id: 'classes',   name: '职业', icon: 'i-book',      hint: '天赋 · 技能 · 进阶', ids: ['classes', 'talents', 'feats', 'prestige'] },
      { id: 'archive',   name: '资料', icon: 'i-library',   hint: '规则 · 世界观 · 物资', ids: ['library', 'rulebook', 'items'] },
      { id: 'duel',      name: '对决', icon: 'i-dice',      hint: '卡牌对战', ids: ['duel'] },
      { id: 'help',      name: '帮助', icon: 'i-help',      hint: '上手 · 常见问题', ids: ['rulebook', 'advisor'] },
    ];

    function notesFor(sysId) {
      var sys = null;
      for (var i = 0; i < SYSTEMS.length; i++) if (SYSTEMS[i].id === sysId) sys = SYSTEMS[i];
      if (!sys) return [];
      var out = [];
      /* 角色面板：只在有角色时可点（A1/A4 —— 无角色不产生死链） */
      if (sys.id === 'character') {
        var rc = recentChar();
        if (rc) out.push({ n: '角色面板 · ' + rc.name, d: '最近使用的角色（存档位 ' + rc.slot + '）', k: '上次', href: panelHref(rc.name, rc.slot, true), icon: 'i-character' });
        else out.push({ n: '角色面板', d: '还没有角色存档', k: '需先创建角色', off: true, icon: 'i-character', hint: '先去创建一个角色' });
      }
      sys.ids.forEach(function (id) {
        var c = catById(id); if (!c) return;
        if (out.some(function (x) { return x.n === c.name; })) return;
        out.push({ n: c.name, d: c.desc, k: '', href: catHref({ id: c.id }).replace(/\\/g, '/'), icon: c.icon });
      });
      return out;
    }

    function build() {
      if (built) return; built = true;
      wrap = el('div'); wrap.id = 'guiRoot';
      wrap.innerHTML =
        '<div class="gui-scrim" hidden></div>' +
        '<div class="gui-drop" hidden><div class="gui-panel">' +
          '<div class="gui-head"><svg class="gui-hmark" viewBox="0 0 32 32"><use href="#gui-crest"/></svg>' +
            '<span class="gui-hn">功能导航</span><span class="gui-hl">ALL SYSTEMS</span><span class="gui-sp"></span>' +
            '<span class="gui-hv">v1.0.7279</span><button class="gui-x" type="button" title="收起">✕</button></div>' +
          '<div class="gui-body"><div class="gui-chips"></div><div class="gui-notes"></div>' +
            '<div class="gui-sets"><span class="gui-lb">设置</span><span class="gui-setbtns"></span></div></div>' +
        '</div></div>';
      document.documentElement.appendChild(wrap);
      scrim = wrap.querySelector('.gui-scrim');
      drop = wrap.querySelector('.gui-drop');
      scrim.addEventListener('click', function () { setOpen(false); });
      wrap.querySelector('.gui-x').addEventListener('click', function () { setOpen(false); });
      wrap.querySelector('.gui-chips').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-sys]'); if (!b) return;
        cur = b.getAttribute('data-sys'); render();
      });
      wrap.querySelector('.gui-body').addEventListener('click', function (e) {
        var a = e.target.closest('a.gui-note'); if (!a) return;
        if (a.getAttribute('data-off') === '1') { e.preventDefault(); toast(a.getAttribute('data-hint') || '该入口暂不可用'); return; }
        var m = /[?&]char=([^&]+)/.exec(a.getAttribute('href') || '');
        if (m) { try { setRecentChar(decodeURIComponent(m[1]), parseInt((/[?&]slot=(\d+)/.exec(a.getAttribute('href')) || [])[1] || 1, 10)); } catch (err) {} }
      });
      wrap.querySelector('.gui-setbtns').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-act], a[data-act]'); if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'theme') { toggleTheme(); toast(isDark() ? '已切到夜间模式' : '已切到日间模式'); render(); }
        else if (act === 'sound') { toggleMute(); toast(isMuted() ? '已静音' : '已开启音效'); render(); }
        else if (act === 'settings') location.href = APP.settings;
        else if (act === 'changelog') location.href = (BASE + '启动台.html?action=changelog').replace(/\\/g, '/');
        else if (act === 'perf') { if (window.SnowdGuild.onPerf) window.SnowdGuild.onPerf(); else toast('性能自检需桌面端'); }
        else if (act === 'about') location.href = APP.settings + '#about';
        else if (act === 'update') { if (window.SnowdGuild.onUpdate) window.SnowdGuild.onUpdate(); else toast('检查更新需桌面端'); }
      });
    }

    function render() {
      var chips = wrap.querySelector('.gui-chips');
      chips.innerHTML = SYSTEMS.map(function (s) {
        return '<button type="button" data-sys="' + s.id + '" aria-selected="' + (s.id === cur) + '">' +
          '<svg viewBox="0 0 24 24"><use href="#' + s.icon + '"/></svg><span>' + s.name + '</span></button>';
      }).join('');
      var list = notesFor(cur);
      var host = wrap.querySelector('.gui-notes');
      host.innerHTML = list.map(function (it) {
        return '<a class="gui-note' + (it.off ? ' gui-off' : '') + '" href="' + (it.off ? '#' : it.href) + '"' +
          (it.off ? ' data-off="1" data-hint="' + (it.hint || '') + '"' : '') + '>' +
          '<svg class="gui-pin" viewBox="0 0 22 22"><use href="#gui-pin"/></svg>' +
          '<span class="gui-k">' + (it.k || '') + '</span><div class="gui-nn">' + it.n + '</div>' +
          '<div class="gui-dd">' + (it.d || '') + '</div></a>';
      }).join('') || '<div class="gui-empty">该分区暂无入口</div>';
      var sets = wrap.querySelector('.gui-setbtns');
      sets.innerHTML =
        '<button type="button" data-act="sound"><svg viewBox="0 0 24 24" style="width:13px;height:13px"><use href="#i-sound"/></svg>' + (isMuted() ? '已静音' : '音效') + '</button>' +
        '<button type="button" data-act="theme"><svg viewBox="0 0 24 24" style="width:13px;height:13px"><use href="#i-theme"/></svg>' + (isDark() ? '夜间' : '日间') + '</button>' +
        '<button type="button" data-act="update"><svg viewBox="0 0 24 24" style="width:13px;height:13px"><use href="#i-update"/></svg>检查更新</button>' +
        '<button type="button" data-act="perf"><svg viewBox="0 0 24 24" style="width:13px;height:13px"><use href="#i-perf"/></svg>性能自检</button>' +
        '<a href="' + APP.settings + '" data-act="settings"><svg viewBox="0 0 24 24" style="width:13px;height:13px"><use href="#i-gear"/></svg>设置</a>' +
        '<a href="' + APP.settings + '#about" data-act="about"><svg viewBox="0 0 24 24" style="width:13px;height:13px"><use href="#i-info"/></svg>关于·许可</a>' +
        (fromLauncher() ? '<span style="flex:1"></span><a href="' + APP.launcher + '">← 返回启动台</a>' : '');
    }

    function place() {
      var bar = trigger.closest('header') || document.querySelector('header') || document.querySelector('.topbar');
      var bottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 56;
      if (!bottom || bottom < 8) bottom = 56;
      drop.style.paddingTop = Math.max(6, bottom + 6) + 'px';
    }
    navApi.isOpen = function () { return !!open; };
    navApi.close = function () { setOpen(false); };
    function setOpen(v) {
      open = v; trigger.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (v) { build(); render(); place(); }
      if (scrim) scrim.hidden = !v;
      if (drop) drop.hidden = !v;
    }
    trigger.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!open); });
    /* ESC 由统一的 escBoot 处理（见下），此处不再单独注册 */
    document.addEventListener('click', function (e) {
      if (!open || !wrap) return;
      /* 切换系统时重建 innerHTML 会让 e.target 脱离文档，closest 会误判为点击面板外 */
      var path = (e.composedPath && e.composedPath()) || [];
      if (path.indexOf(wrap) >= 0 || path.indexOf(trigger) >= 0) return;
      if (e.target && e.target.closest && (e.target.closest('#guiRoot') || e.target.closest('.gui-trigger'))) return;
      setOpen(false);
    });
    window.addEventListener('resize', function () { if (open) place(); });

    /* 挂载：① 先看「← 返回」② 再顶栏 ③ 最后悬浮 */
    var backBtn = document.querySelector('.back-btn');
    if (backBtn && backBtn.parentNode) {
      var bcs = getComputedStyle(backBtn);
      if (bcs.position === 'fixed' || bcs.position === 'absolute') {
        var br = backBtn.getBoundingClientRect();
        trigger.classList.add('gui-compact');
        trigger.style.position = 'fixed';
        trigger.style.top = Math.round(br.bottom + 8) + 'px';
        trigger.style.left = Math.round(br.left) + 'px';
        trigger.style.zIndex = '100';
        document.body.appendChild(trigger);
        return;
      }
      backBtn.parentNode.insertBefore(trigger, backBtn.nextSibling);
      trigger.style.marginLeft = '10px'; trigger.style.verticalAlign = 'middle';
      return;
    }
    var bar = document.querySelector('header .topbar') || document.querySelector('header') || document.querySelector('.topbar');
    if (bar) {
      var d = getComputedStyle(bar).display;
      if (d === 'grid' || d === 'flex') { trigger.style.justifySelf = 'end'; trigger.style.alignSelf = 'center'; trigger.style.marginLeft = '10px'; }
      bar.appendChild(trigger);
    } else {
      var back = document.querySelector('.back-btn');
      if (back && back.parentNode) {
        var cs = getComputedStyle(back);
        if (cs.position === 'fixed' || cs.position === 'absolute') {
          var r = back.getBoundingClientRect();
          trigger.style.position = 'fixed';
          trigger.style.top = Math.round(r.bottom + 8) + 'px';
          trigger.style.left = Math.round(r.left) + 'px';
          trigger.style.zIndex = '100';
          document.body.appendChild(trigger);
        } else { back.parentNode.insertBefore(trigger, back.nextSibling); trigger.style.marginLeft = '10px'; }
      } else { trigger.classList.add('gui-floating'); document.body.appendChild(trigger); }
    }
  }

  /* ---------------- ⑦ 返回语义修复（from=launcher 时「返回」回启动台） ---------------- */
  function backFix() {
    if (!fromLauncher()) return;
    var target = APP.launcher;
    var nodes = document.querySelectorAll('.back-btn, a.back-btn, a[href$="首页.html"].back-btn');
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      if (a.getAttribute('data-gui-back')) continue;
      a.setAttribute('data-gui-back', '1');
      a.setAttribute('href', target);
      if (/返回/.test(a.textContent)) a.textContent = '← 返回启动台';
    }
  }

  /* ---------------- ⑧ 主题 / 音量（复用既有键：_snowd_theme / _snowd_mute） ---------------- */
  function isDark() { return document.documentElement.classList.contains('dark'); }
  function setTheme(t) {
    var dark = (t === 'dark');
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('_snowd_theme', dark ? 'dark' : 'light'); } catch (e) {}
    return dark;
  }
  function toggleTheme() { return setTheme(isDark() ? 'light' : 'dark'); }
  function isMuted() {
    if (window.snd && typeof window.snd.muted === 'boolean') return window.snd.muted;
    try { return localStorage.getItem('_snowd_mute') === '1'; } catch (e) { return false; }
  }
  function toggleMute() {
    if (window.snd && typeof window.snd.toggleMute === 'function') return window.snd.toggleMute();
    var m = !isMuted();
    try { localStorage.setItem('_snowd_mute', m ? '1' : '0'); } catch (e) {}
    var b = document.getElementById('muteToggle'); if (b) b.textContent = m ? '🔇' : '🔊';
    return m;
  }
  function themeBoot() {
    var t = null; try { t = localStorage.getItem('_snowd_theme'); } catch (e) {}
    if (t === 'dark' && !isDark()) document.documentElement.classList.add('dark');
    if (t === 'light' && isDark()) document.documentElement.classList.remove('dark');
  }

  /* ---------------- ⑪ 统一 ESC：关面板 → 页面自处理 → 回上一级 ---------------- */
  var navApi = { isOpen: function () { return false; }, close: function () {} };
  var PARENTS = {
    '角色创建页.html': '主页.html', '角色选择页.html': '主页.html',
    '角色存档页.html': '主页.html', '上传角色.html': '主页.html',
    '资料库.html': '启动台.html', '物资大全.html': '启动台.html', '顾问.html': '启动台.html',
    'help.html': '启动台.html', '帮助.html': '启动台.html', '主页.html': '启动台.html',
  };
  function decodePath(p) { try { return decodeURIComponent(p); } catch (e) { return String(p || ''); } }
  function lastSegment(p) { var a = decodePath(String(p || '').replace(/[?&#].*$/, '')).split('/'); return a[a.length - 1] || ''; }
  function parentTarget() {
    var seg = lastSegment(location.pathname);
    var path = decodePath(location.pathname);
    if (path.indexOf('/职业页/') >= 0) {
      if (seg === '首页.html') return '../斯诺德跑团/启动台.html';
      /* X·进阶.html → X.html（返回所属职业页），其余回职业页首页 */
      var adv = seg.match(/^(.+)·进阶.html$/);
      return adv ? adv[1] + '.html' : '首页.html';
    }
    if (PARENTS[seg]) return PARENTS[seg];
    return BASE + '启动台.html';
  }
  function visibleOverlay() {
    var sels = ['#modalOverlay', '.ui-dialog', '.ov-viewer', '.nav-drawer.open', '.nav-overlay.show',
      '#searchOverlay:not(.hidden)', '.ctx-menu:not(.hidden)', '.learn-panel.show'];
    for (var i = 0; i < sels.length; i++) {
      var e = document.querySelector(sels[i]);
      if (e && e.offsetParent !== null && e.getBoundingClientRect().width > 40) return true;
    }
    return false;
  }
  function escBoot() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.keyCode !== 27) return;
      if (navApi.isOpen()) { navApi.close(); return; }        // ① 关功能导航面板
      if (e.defaultPrevented) return;                          // ② 页面已处理
      setTimeout(function () {                                 // 让同一次派发里的其它处理器先跑完
        if (e.defaultPrevented || navApi.isOpen() || visibleOverlay()) return;
        var t = parentTarget();
        /* 优先用确定性的父级映射；仅当来源是应用内同源页面时才用 history.back()（file:// 下 referrer 为空 → 走映射） */
        var sameOriginRef = document.referrer && location.origin && location.origin !== 'null' && document.referrer.indexOf(location.origin) === 0;
        if (sameOriginRef && history.length > 1) { history.back(); } else if (t) { location.href = t; }
      }, 0);
    });
  }

  /* ---------------- ⑫ 手机系统返回键 / 浏览器返回：优先「回上一级」 ---------------- */
  window.__guiBack = function () {
    if (navApi.isOpen()) { navApi.close(); return true; }   // 面板打开时先关面板
    var t = parentTarget();
    if (!t) return false;
    try {
      var a = document.createElement("a"); a.href = t;
      if (decodePath(a.pathname) === decodePath(location.pathname)) return false;     // 自己 → 不处理（由系统退出）
      location.href = t;
      return true;
    } catch (e) { return false; }
  };

  /* ---------------- 自动执行 ---------------- */
  function boot() {
    injectCss(); injectSprite();
    themeBoot();                            // 主题与导航层无关：必须在下面的提前 return 之前
    skinBoot();                             // 皮肤与导航层无关（设置页也要）
    escBoot();                              // ESC 与导航层无关（设置页也要能 ESC 返回）
    if (window.__guiNoNav) return;          // 启动台/设置页只关闭「导航面板」
    beamBoot();
    navBoot();
    backFix();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
