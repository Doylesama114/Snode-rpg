// 斯诺德跑团 — Build Advisor 悬浮球 + 侧滑面板（阶段 8A，Electron）
(function() {
  'use strict';

  var POS_KEY = '_snowd_advisor_pos';
  var USE_CHAR_KEY = '_snowd_advisor_use_char';
  var DRAG_THRESHOLD = 8;

  function shouldShowAdvisor() {
    var p = (location.pathname || '').replace(/\\/g, '/');
    if (p.indexOf('/poker-game/') !== -1) return false;
    if (p.indexOf('poker-game') !== -1 && p.indexOf('index.html') !== -1) return false;
    return true;
  }

  function loadPos() {
    try {
      return JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function savePos(pos) {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch (e) { /* ignore */ }
  }

  function useCharEnabled() {
    if (!window.snowdPanel || !window.snowdPanel.hasCharacter()) return false;
    var v = localStorage.getItem(USE_CHAR_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
    return window.snowdPanel.isPanelPage && window.snowdPanel.isPanelPage();
  }

  function setUseChar(on) {
    localStorage.setItem(USE_CHAR_KEY, on ? '1' : '0');
  }

  function getCharacterSummary() {
    if (!window.snowdPanel || !window.snowdPanel.hasCharacter()) return null;
    try {
      var snap = window.snowdPanel.getSnapshot();
      var cls = (snap.classes && snap.classes[0]) || {};
      return {
        name: snap.name || snap._charName || '未命名',
        className: cls.name || window.snowdPanel.getMainClassName() || '?',
        level: cls.level || 0,
        snapshot: snap,
      };
    } catch (e) {
      return null;
    }
  }

  function injectStyles() {
    if (document.getElementById('_snowd_advisor_styles')) return;
    var s = document.createElement('style');
    s.id = '_snowd_advisor_styles';
    s.textContent = [
      '#_snowd_advisor_ball{position:fixed;z-index:10000;width:48px;height:48px;border-radius:50%;',
      'border:2px solid #a46d1f;background:#fffdf8;color:#a46d1f;font-size:22px;cursor:pointer;',
      'box-shadow:0 4px 16px rgba(164,109,31,0.35);display:flex;align-items:center;justify-content:center;',
      'user-select:none;touch-action:none;transition:box-shadow 0.2s}',
      '#_snowd_advisor_ball:hover{box-shadow:0 6px 20px rgba(164,109,31,0.45)}',
      '#_snowd_advisor_ball._busy{opacity:0.85;pointer-events:none}',
      '#_snowd_advisor_ball._busy::after{content:"";position:absolute;inset:3px;border:2px solid transparent;',
      'border-top-color:#a46d1f;border-radius:50%;animation:_snowd_adv_spin 0.8s linear infinite}',
      '@keyframes _snowd_adv_spin{to{transform:rotate(360deg)}}',
      '#_snowd_advisor_panel{position:fixed;top:0;right:0;height:100%;width:400px;max-width:92vw;z-index:10002;',
      'background:#fffdf8;border-left:1px solid #d8d2c4;box-shadow:-8px 0 32px rgba(31,37,34,0.12);',
      'display:flex;flex-direction:column;font-family:"Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;',
      'transform:translateX(100%);transition:transform 0.28s ease;color:#1f2522}',
      '#_snowd_advisor_panel._open{transform:translateX(0)}',
      '._snowd_adv_hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;',
      'border-bottom:1px solid #d8d2c4;flex-shrink:0}',
      '._snowd_adv_hdr h2{margin:0;font-size:17px;font-weight:bold}',
      '._snowd_adv_hdr_btns{display:flex;gap:6px}',
      '._snowd_adv_hdr_btns button{border:1px solid #d8d2c4;background:#fff;border-radius:6px;width:32px;height:32px;',
      'cursor:pointer;font-size:16px;color:#69706b}',
      '._snowd_adv_ctx{padding:10px 16px;font-size:12px;color:#69706b;border-bottom:1px solid #eee;flex-shrink:0}',
      '._snowd_adv_ctx label{display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;color:#1f2522}',
      '._snowd_adv_warn{background:#fff8e1;color:#8a6d00;padding:8px 16px;font-size:12px;border-bottom:1px solid #ffe082;flex-shrink:0}',
      '._snowd_adv_msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}',
      '._snowd_adv_msg{max-width:95%;padding:10px 12px;border-radius:10px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}',
      '._snowd_adv_msg._user{align-self:flex-end;background:#f6f4ef;border:1px solid #d8d2c4}',
      '._snowd_adv_msg._ai{align-self:flex-start;background:#fff;border:1px solid #e8e4dc}',
      '._snowd_adv_msg._err{align-self:stretch;background:#ffebee;border:1px solid #ffcdd2;color:#c62828;font-size:13px}',
      '._snowd_adv_foot{padding:12px 16px;border-top:1px solid #d8d2c4;flex-shrink:0}',
      '._snowd_adv_foot textarea{width:100%;min-height:72px;max-height:140px;border:1px solid #d8d2c4;border-radius:8px;',
      'padding:10px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box}',
      '._snowd_adv_actions{display:flex;justify-content:flex-end;margin-top:8px;gap:8px}',
      '._snowd_adv_actions button{padding:8px 18px;border-radius:8px;font-size:14px;cursor:pointer}',
      '#_snowd_adv_send{background:#a46d1f;color:#fff;border:none}',
      '#_snowd_adv_send:disabled{opacity:0.5;cursor:not-allowed}',
      '._snowd_adv_hint{font-size:11px;color:#69706b;margin-top:6px}',
      '._snowd_adv_tabs{display:flex;gap:6px;flex:1}',
      '._snowd_adv_tabs button{padding:6px 14px;border:1px solid #d8d2c4;border-radius:6px;background:#fff;',
      'font-size:13px;cursor:pointer;color:#69706b}',
      '._snowd_adv_tabs button._active{background:#a46d1f;color:#fff;border-color:#a46d1f}',
      '._snowd_view{flex:1;display:flex;flex-direction:column;min-height:0}',
      '._snowd_view._hidden{display:none}',
      '._snowd_adv_search{padding:10px 16px;border-bottom:1px solid #eee;flex-shrink:0}',
      '._snowd_adv_search input{width:100%;padding:8px 10px;border:1px solid #d8d2c4;border-radius:6px;font-size:14px;box-sizing:border-box}',
      '._snowd_adv_list{flex:1;overflow-y:auto;padding:10px 12px}',
      '._snowd_adv_card{border:1px solid #d8d2c4;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fff;cursor:pointer}',
      '._snowd_adv_card._open{cursor:default;border-color:#a46d1f}',
      '._snowd_adv_card h3{margin:0 0 4px;font-size:15px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '._snowd_adv_badge{font-size:10px;padding:2px 6px;border-radius:4px;background:#e8f5e9;color:#2e7d32}',
      '._snowd_adv_badge._meta{background:#f6f4ef;color:#69706b}',
      '._snowd_adv_elig{font-size:12px;color:#69706b}',
      '._snowd_adv_elig._ok{color:#2e7d32}',
      '._snowd_adv_elig._no{color:#c62828}',
      '._snowd_adv_detail{margin-top:8px;font-size:13px;line-height:1.55;white-space:pre-wrap;color:#1f2522}',
      '._snowd_adv_talent{margin-top:6px;padding-top:6px;border-top:1px dashed #e0ddd4}',
      '._snowd_adv_talent strong{display:block;font-size:13px;margin-bottom:2px}',
      'html.dark ._snowd_adv_card{background:#2a2d31;border-color:#3a3d40}',
      'html.dark #_snowd_advisor_panel{background:#24272b;border-color:#3a3d40;color:#e8e6e3}',
      'html.dark #_snowd_advisor_ball{background:#24272b;border-color:#d4a54a;color:#d4a54a}',
      'html.dark ._snowd_adv_msg._user{background:#1a1d20;border-color:#3a3d40}',
      'html.dark ._snowd_adv_msg._ai{background:#2a2d31;border-color:#3a3d40}',
      'html.dark ._snowd_adv_foot textarea{background:#1a1d20;border-color:#3a3d40;color:#e8e6e3}',
    ].join('');
    document.head.appendChild(s);
  }

  function createWidget() {
    var root = document.createElement('div');
    root.id = '_snowd_advisor_root';

    var ball = document.createElement('button');
    ball.id = '_snowd_advisor_ball';
    ball.type = 'button';
    ball.title = 'Build 顾问';
    ball.setAttribute('aria-label', 'Build 顾问');
    ball.textContent = '✦';

    var panel = document.createElement('div');
    panel.id = '_snowd_advisor_panel';
    panel.innerHTML = [
      '<div class="_snowd_adv_hdr">',
      '<div class="_snowd_adv_tabs">',
      '<button type="button" id="_tab_chat" class="_active">问答</button>',
      '<button type="button" id="_tab_adv">进阶</button>',
      '</div>',
      '<div class="_snowd_adv_hdr_btns">',
      '<button type="button" id="_snowd_adv_min" title="关闭">×</button>',
      '</div></div>',
      '<div class="_snowd_view" id="_snowd_view_chat">',
      '<div class="_snowd_adv_warn" id="_snowd_adv_warn" style="display:none"></div>',
      '<div class="_snowd_adv_ctx" id="_snowd_adv_ctx"></div>',
      '<div class="_snowd_adv_msgs" id="_snowd_adv_msgs"></div>',
      '<div class="_snowd_adv_foot">',
      '<textarea id="_snowd_adv_input" placeholder="输入 build 问题，Enter 发送"></textarea>',
      '<div class="_snowd_adv_actions">',
      '<button type="button" id="_snowd_adv_send">发送</button>',
      '</div>',
      '<div class="_snowd_adv_hint">标识与 SP 由 DM 按模组结算。</div>',
      '</div></div>',
      '<div class="_snowd_view _hidden" id="_snowd_view_adv">',
      '<div class="_snowd_adv_search"><input type="search" id="_snowd_adv_filter" placeholder="搜索进阶名称…"></div>',
      '<div class="_snowd_adv_ctx" id="_snowd_adv_adv_meta"></div>',
      '<div class="_snowd_adv_list" id="_snowd_adv_list"></div>',
      '<div class="_snowd_adv_hint" style="padding:8px 16px">A 档已收录具体技能；其余为门槛与方向参考。剧情条件以 DM 为准。</div>',
      '</div>',
    ].join('');

    root.appendChild(ball);
    root.appendChild(panel);
    document.body.appendChild(root);

    var state = {
      open: false,
      busy: false,
      drag: null,
      moved: false,
      tab: 'chat',
      catalog: null,
      catalogLoading: false,
      advFilter: '',
      advOpen: null,
    };

    function applyBallPos() {
      var saved = loadPos();
      var edge = (saved && saved.edge) || 'right';
      var bottom = (saved && typeof saved.bottom === 'number') ? saved.bottom : 24;
      bottom = Math.max(12, Math.min(window.innerHeight - 60, bottom));
      ball.style.bottom = bottom + 'px';
      ball.style.top = 'auto';
      if (edge === 'left') {
        ball.style.left = '24px';
        ball.style.right = 'auto';
      } else {
        ball.style.right = '24px';
        ball.style.left = 'auto';
      }
    }

    function persistBallPos() {
      var rect = ball.getBoundingClientRect();
      var edge = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
      savePos({ edge: edge, bottom: window.innerHeight - rect.bottom });
      applyBallPos();
    }

    function refreshContext() {
      var ctx = document.getElementById('_snowd_adv_ctx');
      var warn = document.getElementById('_snowd_adv_warn');
      if (!ctx) return;

      var summary = getCharacterSummary();
      var canChar = !!(window.snowdPanel && window.snowdPanel.hasCharacter());

      if (!canChar) {
        ctx.innerHTML = '模式：纯咨询（未加载角色）';
        if (warn) warn.style.display = 'none';
        return;
      }

      var useOn = useCharEnabled();
      ctx.innerHTML = [
        useOn
          ? ('已绑定：' + summary.name + ' · ' + summary.className + ' L' + summary.level)
          : '模式：纯咨询（已关闭角色绑定）',
        '<label><input type="checkbox" id="_snowd_adv_use_char"' + (useOn ? ' checked' : '') + '> 使用当前角色</label>',
      ].join('<br>');

      var cb = document.getElementById('_snowd_adv_use_char');
      if (cb) {
        cb.onchange = function() {
          setUseChar(cb.checked);
          state.catalog = null;
          refreshContext();
          if (state.tab === 'adv') loadCatalog();
        };
      }

      if (warn && summary && summary.className !== '法师') {
        warn.style.display = 'block';
        warn.textContent = '当前仅支持法师 build 顾问，其他职业后续开放。';
      } else if (warn) {
        warn.style.display = 'none';
      }
    }

    function appendMsg(role, text) {
      var box = document.getElementById('_snowd_adv_msgs');
      if (!box) return;
      var el = document.createElement('div');
      el.className = '_snowd_adv_msg ' + (role === 'user' ? '_user' : role === 'err' ? '_err' : '_ai');
      el.textContent = text;
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
    }

    function setOpen(on) {
      state.open = on;
      panel.classList.toggle('_open', on);
      if (on) {
        refreshContext();
        if (state.tab === 'adv') loadCatalog();
      }
    }

    function switchTab(tab) {
      state.tab = tab;
      document.getElementById('_tab_chat').classList.toggle('_active', tab === 'chat');
      document.getElementById('_tab_adv').classList.toggle('_active', tab === 'adv');
      document.getElementById('_snowd_view_chat').classList.toggle('_hidden', tab !== 'chat');
      document.getElementById('_snowd_view_adv').classList.toggle('_hidden', tab !== 'adv');
      if (tab === 'adv') loadCatalog();
    }

    function formatAttrs(attrs) {
      if (!attrs || !Object.keys(attrs).length) return '无';
      return Object.keys(attrs).map(function(k) { return k + attrs[k]; }).join(' ');
    }

    function formatMarks(marks) {
      if (!marks || !marks.length) return '';
      return marks.map(function(m) { return m.name + '×' + m.amount; }).join(' ');
    }

    function renderAdvList() {
      var list = document.getElementById('_snowd_adv_list');
      if (!list || !state.catalog) return;
      var q = (state.advFilter || '').trim().toLowerCase();
      var skills = state.catalog.skillsByName || {};
      list.innerHTML = '';
      var items = state.catalog.advancements || [];
      items.forEach(function(a) {
        if (q && a.name.toLowerCase().indexOf(q) < 0 && (a.inferenceBlurb || '').toLowerCase().indexOf(q) < 0) return;
        var card = document.createElement('div');
        card.className = '_snowd_adv_card' + (state.advOpen === a.name ? ' _open' : '');
        var badges = a.documented
          ? '<span class="_snowd_adv_badge">A档</span>'
          : '<span class="_snowd_adv_badge _meta">metadata</span>';
        var eligHtml = '';
        if (a.eligibility) {
          var cls = a.eligibility.eligible ? '_ok' : '_no';
          var gap = a.eligibility.gaps && Object.keys(a.eligibility.gaps).length
            ? (' gaps ' + JSON.stringify(a.eligibility.gaps)) : '';
          eligHtml = '<div class="_snowd_adv_elig ' + cls + '">属性门槛 ' + (a.eligibility.eligible ? '✓' : '✗') + gap + '</div>';
        }
        card.innerHTML = [
          '<h3>' + a.name + badges + '</h3>',
          '<div class="_snowd_adv_elig">来源 ' + (a.sourceClasses || []).join('、') + ' · ' + a.scope + '</div>',
          '<div class="_snowd_adv_elig">属性 ' + formatAttrs(a.attrsRequired) + (a.markCost && a.markCost.length ? (' · 标识 ' + formatMarks(a.markCost)) : '') + '</div>',
          eligHtml,
        ].join('');
        if (state.advOpen === a.name) {
          var detail = document.createElement('div');
          detail.className = '_snowd_adv_detail';
          var parts = [];
          if (skills[a.name] && skills[a.name].description) parts.push(skills[a.name].description);
          else if (a.inferenceBlurb) parts.push(a.inferenceBlurb);
          if (a.conditions && a.conditions.length) {
            parts.push('特殊条件：\n' + a.conditions.map(function(c, i) { return (i + 1) + '. ' + c; }).join('\n'));
          }
          var intro = document.createElement('div');
          intro.textContent = parts.join('\n\n');
          detail.appendChild(intro);
          if (skills[a.name] && skills[a.name].talents) {
            skills[a.name].talents.forEach(function(t) {
              var tEl = document.createElement('div');
              tEl.className = '_snowd_adv_talent';
              tEl.innerHTML = '<strong>' + t.name + '</strong>' + (t.summary || '');
              detail.appendChild(tEl);
            });
          }
          card.appendChild(detail);
        }
        card.addEventListener('click', function() {
          state.advOpen = state.advOpen === a.name ? null : a.name;
          renderAdvList();
        });
        list.appendChild(card);
      });
    }

    async function loadCatalog() {
      if (state.catalogLoading || state.catalog) {
        renderAdvList();
        return;
      }
      if (!window.electronAPI || !window.electronAPI.advisorCatalog) {
        document.getElementById('_snowd_adv_adv_meta').textContent = '进阶浏览需在 Electron 客户端中使用。';
        return;
      }
      state.catalogLoading = true;
      document.getElementById('_snowd_adv_adv_meta').textContent = '加载中…';
      try {
        var payload = {};
        if (useCharEnabled()) {
          var summary = getCharacterSummary();
          if (summary && summary.snapshot) payload.snapshot = summary.snapshot;
        }
        var res = await window.electronAPI.advisorCatalog(payload);
        if (res && res.ok && res.catalog) {
          state.catalog = res.catalog;
          var m = res.catalog.meta || {};
          document.getElementById('_snowd_adv_adv_meta').textContent =
            '法师进阶 ' + (m.total || 0) + ' 条 · A档已收录 ' + (m.documentedCount || 0) + ' 条';
          renderAdvList();
        } else {
          document.getElementById('_snowd_adv_adv_meta').textContent = (res && res.error) || '加载失败';
        }
      } catch (e) {
        document.getElementById('_snowd_adv_adv_meta').textContent = e.message || String(e);
      } finally {
        state.catalogLoading = false;
      }
    }

    function setBusy(on) {
      state.busy = on;
      ball.classList.toggle('_busy', on);
      var send = document.getElementById('_snowd_adv_send');
      if (send) send.disabled = on;
    }

    async function sendQuery() {
      var input = document.getElementById('_snowd_adv_input');
      if (!input || state.busy) return;
      var q = input.value.trim();
      if (!q) return;

      if (!window.electronAPI || !window.electronAPI.advisorAdvise) {
        appendMsg('err', 'Build 顾问需在 Electron 客户端中使用。浏览器版待后续支持。');
        return;
      }

      appendMsg('user', q);
      input.value = '';
      setBusy(true);

      try {
        var payload = { query: q };
        if (useCharEnabled()) {
          var summary = getCharacterSummary();
          if (summary && summary.snapshot) payload.snapshot = summary.snapshot;
        }

        var res = await window.electronAPI.advisorAdvise(payload);
        if (res && res.ok && res.answer) {
          appendMsg('ai', res.answer);
        } else {
          appendMsg('err', (res && res.error) || '请求失败，请稍后重试。');
        }
      } catch (e) {
        appendMsg('err', e.message || String(e));
      } finally {
        setBusy(false);
      }
    }

    ball.addEventListener('pointerdown', function(e) {
      if (e.button !== 0) return;
      state.drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
      state.moved = false;
      ball.setPointerCapture(e.pointerId);
    });

    ball.addEventListener('pointermove', function(e) {
      if (!state.drag) return;
      var dx = e.clientX - state.drag.x;
      var dy = e.clientY - state.drag.y;
      if (!state.moved && Math.abs(e.clientX - state.drag.startX) + Math.abs(e.clientY - state.drag.startY) > DRAG_THRESHOLD) {
        state.moved = true;
      }
      if (state.moved) {
        var rect = ball.getBoundingClientRect();
        var left = rect.left + dx;
        var top = rect.top + dy;
        left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, left));
        top = Math.max(8, Math.min(window.innerHeight - rect.height - 8, top));
        ball.style.left = left + 'px';
        ball.style.right = 'auto';
        ball.style.top = top + 'px';
        ball.style.bottom = 'auto';
        state.drag.x = e.clientX;
        state.drag.y = e.clientY;
      }
    });

    ball.addEventListener('pointerup', function(e) {
      if (!state.drag) return;
      try { ball.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (state.moved) {
        persistBallPos();
      } else {
        setOpen(!state.open);
      }
      state.drag = null;
    });

    document.getElementById('_snowd_adv_min').addEventListener('click', function() {
      setOpen(false);
    });

    document.getElementById('_tab_chat').addEventListener('click', function() { switchTab('chat'); });
    document.getElementById('_tab_adv').addEventListener('click', function() { switchTab('adv'); });

    document.getElementById('_snowd_adv_filter').addEventListener('input', function(e) {
      state.advFilter = e.target.value;
      renderAdvList();
    });

    document.getElementById('_snowd_adv_send').addEventListener('click', sendQuery);

    var inputEl = document.getElementById('_snowd_adv_input');
    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuery();
      }
    });

    window.addEventListener('resize', applyBallPos);

    applyBallPos();
    appendMsg('ai', '你好，我是 Build 顾问助理。可询问法师车卡、技能加点、进阶与兼职等；在角色面板会自动读取当前角色。');
  }

  function init() {
    if (!shouldShowAdvisor()) return;
    if (document.getElementById('_snowd_advisor_root')) return;
    injectStyles();
    createWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
