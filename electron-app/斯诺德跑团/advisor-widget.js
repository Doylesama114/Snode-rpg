// 斯诺德跑团 — Build Advisor 悬浮球 + 侧滑面板（阶段 8A，Electron）
(function() {
  'use strict';

  var POS_KEY = '_snowd_advisor_pos';
  var USE_CHAR_KEY = '_snowd_advisor_use_char';
  var SESSION_KEY = '_snowd_adv_chat_session_v1';
  var MAX_TURNS = 3;
  var DRAG_THRESHOLD = 8;

  function isChargenPage() {
    if (window.snowdChargen && typeof window.snowdChargen.isChargenPage === 'function') {
      return window.snowdChargen.isChargenPage();
    }
    var p = (location.pathname || '').replace(/\\/g, '/');
    return p.indexOf('角色创建页') >= 0;
  }

  function getChargenState() {
    if (window.snowdChargen && typeof window.snowdChargen.getState === 'function') {
      return window.snowdChargen.getState();
    }
    return null;
  }

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
      '#_snowd_advisor_tip{position:fixed;z-index:10001;max-width:min(280px,calc(100vw - 48px));padding:10px 12px;',
      'background:#fffdf8;border:1px solid #a46d1f;border-radius:12px;font-size:13px;line-height:1.45;cursor:pointer;',
      'box-shadow:0 4px 16px rgba(164,109,31,0.2);color:#1f2522;white-space:pre-wrap;word-break:break-word}',
      '#_snowd_advisor_tip._hidden{display:none}',
      '#_snowd_advisor_tip::after{content:"点击查看详情";display:block;font-size:11px;color:#69706b;margin-top:6px}',
      '#_snowd_advisor_tip[data-mode="tip"]::after{content:"点击换下一条"}',
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
      '._snowd_adv_hdr_btns button{border:1px solid #d8d2c4;background:#fff;border-radius:6px;min-width:32px;height:32px;',
      'padding:0 8px;cursor:pointer;font-size:13px;color:#69706b}',
      '._snowd_adv_hdr_btns button._text{width:auto;padding:0 10px;font-size:12px}',
      '._snowd_adv_ctx{padding:10px 16px;font-size:12px;color:#69706b;border-bottom:1px solid #eee;flex-shrink:0}',
      '._snowd_adv_ctx label{display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;color:#1f2522}',
      '._snowd_adv_warn{background:#fff8e1;color:#8a6d00;padding:8px 16px;font-size:12px;border-bottom:1px solid #ffe082;flex-shrink:0}',
      '._snowd_adv_msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}',
      '._snowd_adv_msg{max-width:95%;padding:10px 12px;border-radius:10px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}',
      '._snowd_adv_msg._user{align-self:flex-end;background:#f6f4ef;border:1px solid #d8d2c4}',
      '._snowd_adv_msg._ai{align-self:flex-start;background:#fff;border:1px solid #e8e4dc}',
      '._snowd_adv_msg._ai._long{max-width:100%;font-size:13px;line-height:1.65}',
      '._adv_refs{margin-top:10px;padding-top:8px;border-top:1px dashed #d8d2c4;font-size:12px;color:#69706b;line-height:1.8}',
      '._adv_refs a._adv_ref{color:#a46d1f;text-decoration:underline;margin:0 2px}',
      '._adv_refs span._adv_ref{color:#8a8a8a}',
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
      'html.dark #_snowd_advisor_tip{background:#2a2d31;border-color:#d4a54a;color:#e8e6e3}',
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

    var tip = document.createElement('div');
    tip.id = '_snowd_advisor_tip';
    tip.className = '_hidden';
    tip.setAttribute('role', 'button');
    tip.title = '点击查看详细建议';

    var panel = document.createElement('div');
    panel.id = '_snowd_advisor_panel';
    panel.innerHTML = [
      '<div class="_snowd_adv_hdr">',
      '<div class="_snowd_adv_tabs">',
      '<button type="button" id="_tab_chat" class="_active">问答</button>',
      '<button type="button" id="_tab_adv">进阶</button>',
      '</div>',
      '<div class="_snowd_adv_hdr_btns">',
      '<button type="button" id="_snowd_adv_new_chat" class="_text" title="新对话">新对话</button>',
      '<button type="button" id="_snowd_adv_export_fb" class="_text" title="导出反馈 JSON">反馈</button>',
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
      '<div class="_snowd_adv_hint">Build 顾问回答由 AI 整理，仅作参考；标识与 SP 由 DM 按模组结算。</div>',
      '</div></div>',
      '<div class="_snowd_view _hidden" id="_snowd_view_adv">',
      '<div class="_snowd_adv_search"><input type="search" id="_snowd_adv_filter" placeholder="搜索进阶名称…"></div>',
      '<div class="_snowd_adv_ctx" id="_snowd_adv_adv_meta"></div>',
      '<div class="_snowd_adv_list" id="_snowd_adv_list"></div>',
      '<div class="_snowd_adv_hint" style="padding:8px 16px">A 档已收录具体技能；其余为门槛与方向参考。剧情条件以 DM 为准。</div>',
      '</div>',
    ].join('');

    root.appendChild(ball);
    root.appendChild(tip);
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
      chargenFp: '',
      chargenStep: -1,
      chargenQuery: '',
      chargenFullAnswer: null,
      chargenBusy: false,
      chargenSyncedFp: '',
      chatSession: { id: '', turns: [], bindingKey: null },
      rotatingTip: false,
      tipPool: [],
      tipIdx: 0,
      tipTimer: null,
      tipHideTimer: null,
    };

    function randomSessionId() {
      return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function getBindingKey() {
      if (isChargenPage()) {
        var cs = getChargenState();
        var cn = cs && cs.char && cs.char.className;
        return cn ? ('chargen:' + cn) : 'chargen:anonymous';
      }
      var summary = getCharacterSummary();
      if (summary && useCharEnabled()) {
        return 'char:' + summary.name + '|' + summary.className + '|' + (summary.level || 0);
      }
      return 'anonymous';
    }

    function loadSessionFromStorage() {
      try {
        var raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    function saveSessionToStorage() {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.chatSession));
      } catch (e) { /* ignore */ }
    }

    function clearMsgsUi() {
      var box = document.getElementById('_snowd_adv_msgs');
      if (box) box.innerHTML = '';
    }

    function appendWelcomeIfEmpty() {
      var box = document.getElementById('_snowd_adv_msgs');
      if (!box || box.children.length) return;
      if (isChargenPage()) {
        appendMsg('ai', '创建页陪跑已启用：悬浮球旁会显示当前步骤的简短推荐，点击冒泡查看完整回答；也可在下方自由提问。');
      } else {
        var welcomeEl = appendMsg('ai', '你好，我是 Build 顾问助理。创建页已支持全职业陪跑；可询问车卡、技能、进阶与兼职等（法师资料最完整）。');
        var chips = ['我想玩一个很帅、有操作感的角色', '战士1级怎么规划学习路线', '防御等级和攻击命中怎么算', '混沌法术怎么结算'];
        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
        chips.forEach(function(c) {
          var b = document.createElement('button');
          b.textContent = c;
          b.style.cssText = 'padding:3px 10px;border:1px solid #a46d1f;border-radius:14px;background:transparent;color:#a46d1f;font-size:11px;cursor:pointer';
          b.addEventListener('click', function() { sendQuery({ presetQuery: c }); });
          wrap.appendChild(b);
        });
        if (welcomeEl) welcomeEl.appendChild(wrap);
      }
    }

    function restoreSessionUi() {
      clearMsgsUi();
      var turns = state.chatSession.turns || [];
      for (var i = 0; i < turns.length; i += 1) {
        if (turns[i].user) appendMsg('user', turns[i].user);
        if (turns[i].assistant) appendMsg('ai', turns[i].assistant);
      }
      appendWelcomeIfEmpty();
    }

    function newChatSession(opts) {
      opts = opts || {};
      state.chatSession = {
        id: randomSessionId(),
        turns: [],
        bindingKey: getBindingKey(),
      };
      saveSessionToStorage();
      if (!opts.silent) {
        clearMsgsUi();
        appendWelcomeIfEmpty();
      }
    }

    function ensureSessionBinding() {
      var key = getBindingKey();
      if (state.chatSession.bindingKey && state.chatSession.bindingKey !== key) {
        newChatSession({ silent: false });
        return;
      }
      if (!state.chatSession.id) {
        var saved = loadSessionFromStorage();
        if (saved && saved.bindingKey === key) {
          state.chatSession = saved;
        } else {
          newChatSession({ silent: true });
        }
      }
      state.chatSession.bindingKey = key;
    }

    function appendSessionTurn(user, assistant) {
      state.chatSession.turns.push({
        user: user,
        assistant: (assistant || '').slice(0, 800),
        ts: Date.now(),
      });
      while (state.chatSession.turns.length > MAX_TURNS) {
        state.chatSession.turns.shift();
      }
      saveSessionToStorage();
    }

    function conversationHistoryForPayload() {
      return (state.chatSession.turns || []).map(function(t) {
        return { user: t.user, assistant: t.assistant, ts: t.ts };
      });
    }

    function syncChargenBubbleToSession() {
      if (!isChargenPage() || !state.chargenFullAnswer) return;
      var userQ = (state.chargenQuery || '').trim() || '当前步骤推荐';
      if (state.chargenSyncedFp === state.chargenFp) return;
      var turns = state.chatSession.turns || [];
      var last = turns.length ? turns[turns.length - 1] : null;
      if (last && last.source === 'chargen_bubble' && last.fp === state.chargenFp) {
        last.user = userQ;
        last.assistant = state.chargenFullAnswer.slice(0, 800);
        saveSessionToStorage();
        state.chargenSyncedFp = state.chargenFp;
        return;
      }
      state.chatSession.turns.push({
        user: userQ,
        assistant: state.chargenFullAnswer.slice(0, 800),
        ts: Date.now(),
        source: 'chargen_bubble',
        fp: state.chargenFp,
      });
      while (state.chatSession.turns.length > MAX_TURNS) {
        state.chatSession.turns.shift();
      }
      saveSessionToStorage();
      state.chargenSyncedFp = state.chargenFp;
    }

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

    var PARTIAL_CLASS_NOTES = {
      '奇械师': '奇械师顾问为部分支持：技能索引已收录，标识系统与进阶目录尚未完整；深度 build 请以规则书/DM 为准。'
    };

    function chargenTierWarning(className) {
      if (!className) return '';
      if (className === '法师') return '';
      if (PARTIAL_CLASS_NOTES[className]) return PARTIAL_CLASS_NOTES[className];
      return '全职业创建陪跑已开放；' + className + ' 专属深度 build 资料尚在完善，请以创建页与规则书为准。';
    }

    function refreshContext() {
      ensureSessionBinding();
      var ctx = document.getElementById('_snowd_adv_ctx');
      var warn = document.getElementById('_snowd_adv_warn');
      if (!ctx) return;

      if (isChargenPage()) {
        var cs = getChargenState();
        var cn = cs && cs.char && cs.char.className;
        var lbl = cs ? ('步骤 ' + cs.step + '：' + cs.stepLabel) : '角色创建页';
        ctx.innerHTML = cn
          ? ('模式：创建页陪跑 · ' + cn + ' · ' + lbl)
          : ('模式：创建页陪跑 · ' + lbl);
        if (warn) {
          var tierMsg = chargenTierWarning(cn);
          if (tierMsg) {
            warn.style.display = 'block';
            warn.textContent = tierMsg;
          } else {
            warn.style.display = 'none';
          }
        }
        return;
      }

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

      if (warn && summary && summary.className && summary.className !== '法师') {
        warn.style.display = 'block';
        warn.textContent = PARTIAL_CLASS_NOTES[summary.className]
          || ('「' + summary.className + '」技能/进阶深度资料尚在完善；可问通用规则，创建页已支持全职业陪跑。');
      } else if (warn) {
        warn.style.display = 'none';
      }
    }

    function appendMsg(role, text) {
      var box = document.getElementById('_snowd_adv_msgs');
      if (!box) return null;
      var el = document.createElement('div');
      var cls = '_snowd_adv_msg ' + (role === 'user' ? '_user' : role === 'err' ? '_err' : '_ai');
      if (role === 'ai' && (text || '').length > 900) cls += ' _long';
      el.className = cls;
      el.textContent = text || '';
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
      return el;
    }

    function scrollMsgs() {
      var box = document.getElementById('_snowd_adv_msgs');
      if (box) box.scrollTop = box.scrollHeight;
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

    function truncateTip(text, max) {
      max = max || 100;
      var t = (text || '').replace(/\s+/g, ' ').trim();
      if (t.length <= max) return t;
      return t.slice(0, max) + '…';
    }

    function showBubble(text) {
      var tipEl = document.getElementById('_snowd_advisor_tip');
      if (!tipEl) return;
      tipEl.textContent = text || '';
      tipEl.removeAttribute('data-mode');
      state.rotatingTip = false;
      tipEl.classList.remove('_hidden');
      positionBubble();
    }

    // ---------- 入口小贴士：每 5 分钟轮换一条 ----------
    function initTips() {
      try {
        var _d = window.SNOWD_ADVISOR_TIPS || null;
        if (_d && Array.isArray(_d.tips) && Array.isArray(_d.rules)) {
          state.tipPool = _d.tips.concat(_d.rules);
          if (state.tipPool.length) state.tipIdx = Math.floor(Math.random() * state.tipPool.length);
        }
      } catch (err) { /* ignore */ }
      if (!state.tipPool.length) return;
      // 全局发送间隔（v1.0.7239）：时间戳存 localStorage 跨页面共享，避免每进一个新页面都弹贴士
      try {
        var _lastTipAt = parseInt(localStorage.getItem('_snowd_tip_last_at') || '0', 10);
        var _tipGap = 5 * 60 * 1000;
        if (Date.now() - _lastTipAt < _tipGap) return;
        localStorage.setItem('_snowd_tip_last_at', String(Date.now()));
      } catch (e) { /* ignore */ }
      setTimeout(maybeRotateTip, 3000);
      state.tipTimer = setInterval(maybeRotateTip, 5 * 60 * 1000);
    }
    function isChargenBubbleVisible() {
      var tipEl = document.getElementById('_snowd_advisor_tip');
      return !!(tipEl && !tipEl.classList.contains('_hidden') && !state.rotatingTip);
    }
    function maybeRotateTip() {
      if (!state.tipPool.length) return;
      if (isChargenBubbleVisible()) return;
      nextRotatingTip();
    }
    function showRotatingTip() {
      var tipEl = document.getElementById('_snowd_advisor_tip');
      if (!tipEl || !state.tipPool.length) return;
      tipEl.textContent = state.tipPool[state.tipIdx % state.tipPool.length];
      tipEl.setAttribute('data-mode', 'tip');
      state.rotatingTip = true;
      tipEl.classList.remove('_hidden');
      positionBubble();
      clearTimeout(state.tipHideTimer);
      state.tipHideTimer = setTimeout(function () {
        hideBubble();
      }, 5000);
    }
    function nextRotatingTip() {
      if (!state.tipPool.length) return;
      if (state.tipPool.length > 1) {
        var n = Math.floor(Math.random() * (state.tipPool.length - 1));
        state.tipIdx = (n >= state.tipIdx ? n + 1 : n) % state.tipPool.length;
      }
      showRotatingTip();
    }

    function hideBubble() {
      var tipEl = document.getElementById('_snowd_advisor_tip');
      if (!tipEl) return;
      tipEl.classList.add('_hidden');
    }

    function positionBubble() {
      var tipEl = document.getElementById('_snowd_advisor_tip');
      if (!tipEl || tipEl.classList.contains('_hidden')) return;
      var rect = ball.getBoundingClientRect();
      var tipW = tipEl.offsetWidth || 260;
      var left = rect.left - tipW - 8;
      if (left < 8) left = rect.right + 8;
      if (left + tipW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tipW - 8);
      var top = rect.top - (tipEl.offsetHeight || 60) - 8;
      if (top < 8) top = rect.bottom + 8;
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
      tipEl.style.right = 'auto';
      tipEl.style.bottom = 'auto';
    }

    function updateBallBusy() {
      ball.classList.toggle('_busy', state.busy || state.chargenBusy);
    }

    function openChargenDetail() {
      if (!state.chargenFullAnswer) return;
      syncChargenBubbleToSession();
      setOpen(true);
      switchTab('chat');
      restoreSessionUi();
    }

    async function refreshChargenTip() {
      if (!isChargenPage()) {
        hideBubble();
        return;
      }
      var cs = getChargenState();
      if (!cs || !cs.char || !cs.char.className) {
        hideBubble();
        return;
      }
      if (cs.fingerprint === state.chargenFp && state.chargenFullAnswer) {
        showBubble(truncateTip(state.chargenFullAnswer));
        return;
      }
      if (state.chargenBusy) return;
      if (!window.electronAPI || !window.electronAPI.advisorAdviseStream) {
        showBubble('打开 Electron 客户端可获步骤推荐');
        return;
      }

      state.chargenFp = cs.fingerprint;
      state.chargenStep = cs.step;
      state.chargenQuery = '';
      showBubble('正在思考…');
      state.chargenBusy = true;
      updateBallBusy();

      var full = '';
      try {
        ensureSessionBinding();
        var payload = {
          queryKind: 'chargen_bubble',
          mode: 'wizard',
          chargenState: cs,
          query: ' ',
          sessionId: state.chatSession.id,
          bindingKey: getBindingKey(),
          conversationHistory: conversationHistoryForPayload(),
        };
        var res = await window.electronAPI.advisorAdviseStream(payload, function(delta) {
          full += delta;
          showBubble(truncateTip(full) || '…');
        });
        if (res && res.resolvedQuery) state.chargenQuery = res.resolvedQuery;
        if (res && res.ok && String(res.answer || '').trim()) full = res.answer;
        state.chargenFullAnswer = full || '（暂无建议）';
        syncChargenBubbleToSession();
        showBubble(truncateTip(state.chargenFullAnswer));
      } catch (e) {
        showBubble('推荐暂时不可用');
        state.chargenFullAnswer = null;
      } finally {
        state.chargenBusy = false;
        updateBallBusy();
        positionBubble();
      }
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
      updateBallBusy();
      var send = document.getElementById('_snowd_adv_send');
      if (send) send.disabled = on;
    }

    function _advEscapeHtml(t) {
      return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function _advClassToSkillPage(cls) {
      var map = {
        '战士': '战士.html', '法师': '法师.html', '游荡者': '游荡者.html',
        '牧师': '牧师.html', '圣骑士': '圣骑士.html', '德鲁伊': '德鲁伊.html',
        '武僧': '武僧.html', '吟游诗人': '吟游诗人.html', '猎人': '猎人.html',
        '术士': '术士.html', '魔契师': '魔契师.html', '奇械师': '奇械师.html',
        '萨满祭司': '萨满祭司.html', '蛮斗士': '蛮斗士.html',
        '通用': '通用天赋树.html', '通用天赋树': '通用天赋树.html',
      };
      return map[cls] || '';
    }
    var FEEDBACK_KEY = '_snowd_advisor_feedback';
    function loadFeedback() {
      try {
        var raw = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
        return Array.isArray(raw) ? raw : [raw];
      } catch (e) { return []; }
    }
    function saveFeedback(list) {
      try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-200))); } catch (e) { /* ignore */ }
    }
    function recordFeedback(rating, query, answer, intent, mode) {
      var item = {
        rating: rating,
        query: query,
        answer: String(answer || '').slice(0, 4000),
        intent: intent || '',
        mode: mode || 'advisor',
        ts: Date.now(),
        source: 'widget',
      };
      var list = loadFeedback();
      list.push(item);
      saveFeedback(list);
      if (window.electronAPI && window.electronAPI.sendAdvisorFeedback) {
        try {
          var pr = window.electronAPI.sendAdvisorFeedback(item);
          if (pr && pr.catch) pr.catch(function() {});
        } catch (e2) { /* ignore */ }
      }
    }
    function appendFeedbackRow(el, query, answer, res) {
      if (!answer || answer === '（无回答内容）') return;
      var row = document.createElement('div');
      row.style.cssText = 'margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap';
      var mk = function(label, rating, icon) {
        var b = document.createElement('button');
        b.textContent = icon + ' ' + label;
        b.style.cssText = 'padding:2px 8px;border:1px solid #d8d2c4;border-radius:10px;background:transparent;color:#69706b;font-size:11px;cursor:pointer';
        b.addEventListener('click', function() {
          recordFeedback(rating, query, answer, res && res.intent, res && res.mode);
          var btns = row.querySelectorAll('button');
          for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
          b.textContent = icon + ' 已记录';
        });
        return b;
      };
      var up = mk('有用', 'up', '👍');
      var down = mk('没用', 'down', '👎');
      var copy = document.createElement('button');
      copy.textContent = '📋 复制';
      copy.style.cssText = 'padding:2px 8px;border:1px solid #d8d2c4;border-radius:10px;background:transparent;color:#69706b;font-size:11px;cursor:pointer';
      copy.addEventListener('click', function() {
        var text = String(answer || '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() { copy.textContent = '已复制'; })
            .catch(function() { copy.textContent = '复制失败'; });
        } else {
          copy.textContent = '复制失败';
        }
      });
      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(copy);
      el.appendChild(row);
    }

    function renderClarifyChips(el, clarify) {
      var need = clarify.needs && clarify.needs[0];
      if (!need) return;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px';
      var label = document.createElement('div');
      label.textContent = need.prompt || '请选择：';
      label.style.cssText = 'width:100%;color:#69706b;font-size:12px';
      wrap.appendChild(label);
      (need.options || []).slice(0, 12).forEach(function(opt) {
        var b = document.createElement('button');
        b.textContent = opt;
        b.style.cssText = 'padding:4px 10px;border:1px solid #a46d1f;border-radius:14px;background:transparent;color:#a46d1f;font-size:12px;cursor:pointer';
        b.addEventListener('click', function() {
          var base = state.lastClarifyQuery || '';
          sendQuery({ presetQuery: opt + (base ? '，' + base : '') });
        });
        wrap.appendChild(b);
      });
      el.appendChild(wrap);
      scrollMsgs();
    }

    function renderAnswerHtml(text) {
      var t = String(text || '');
      var body = t;
      var refLine = '';
      var m = t.match(/(?:\n?)(【参考】[^\n]*)[ \t]*\n*$/);
      if (m) {
        refLine = m[1];
        body = t.slice(0, m.index);
      }
      var html = _advEscapeHtml(body).replace(/\n/g, '<br>');
      if (refLine) {
        var items = refLine.replace(/^【参考】/, '').split('｜').map(function (x) { return x.trim(); }).filter(Boolean);
        var links = items.map(function (it) {
          var mm = it.match(/^(.*?)（(.*?)·(.*?)）$/);
          if (!mm) return '<span class="_adv_ref">' + _advEscapeHtml(it) + '</span>';
          var name = mm[1].trim(), cls = mm[2].trim(), id = mm[3].trim();
          var file = _advClassToSkillPage(cls);
          var idOk = /^[a-z][a-z0-9-]*$/.test(id);
          if (!file || !id || !idOk) return '<span class="_adv_ref">' + _advEscapeHtml(it) + '</span>';
          return '<a class="_adv_ref" href="../职业页/' + file + '#' + encodeURIComponent(id) + '" target="_blank">' + _advEscapeHtml(name) + '</a>';
        });
        html += '<div class="_adv_refs">【参考】' + links.join('｜') + '</div>';
      }
      return html;
    }

    async function sendQuery(opts) {
      opts = opts || {};
      var input = document.getElementById('_snowd_adv_input');
      if (!input || state.busy) return;
      var q = opts.presetQuery || input.value.trim();
      if (!q) return;
      state.lastClarifyQuery = q;

      if (!window.electronAPI || (!window.electronAPI.advisorAdviseStream && !window.electronAPI.advisorAdvise)) {
        appendMsg('err', 'Build 顾问需在 Electron 客户端中使用。浏览器版待后续支持。');
        return;
      }

      appendMsg('user', q);
      if (!opts.presetQuery) input.value = '';
      setBusy(true);

      var aiEl = appendMsg('ai', '');
      var gotChunk = false;

      try {
        ensureSessionBinding();
        var payload = { query: q, sessionId: state.chatSession.id, bindingKey: getBindingKey() };
        if (opts.mode) payload.mode = opts.mode;
        if (opts.wizardState) payload.wizardState = opts.wizardState;
        else if (opts.chargenState) {
          payload.mode = payload.mode || 'wizard';
          payload.chargenState = opts.chargenState;
        } else if (isChargenPage()) {
          var cs = getChargenState();
          if (cs) {
            payload.mode = payload.mode || 'wizard';
            payload.chargenState = cs;
          }
        }
        if (useCharEnabled() && !isChargenPage()) {
          var summary = getCharacterSummary();
          if (summary && summary.snapshot) payload.snapshot = summary.snapshot;
        }
        if (!opts.skipHistory) {
          payload.conversationHistory = conversationHistoryForPayload();
        }

        var res;
        if (window.electronAPI.advisorAdviseStream) {
          res = await window.electronAPI.advisorAdviseStream(payload, function(delta) {
            gotChunk = true;
            aiEl.textContent += delta;
            if (aiEl.textContent.length > 900) aiEl.classList.add('_long');
            scrollMsgs();
          });
        } else {
          res = await window.electronAPI.advisorAdvise(payload);
        }

        if (res && res.ok) {
          if (!gotChunk && res.answer) aiEl.textContent = res.answer;
          if (!gotChunk && res.answer && res.answer.length > 900) aiEl.classList.add('_long');
          if (!aiEl.textContent) aiEl.textContent = '（无回答内容）';
          // 以主进程返回的最终回答为准（引用兜底后的版本），流式累加仅作过程展示
          var finalText = (res.answer && String(res.answer).trim()) ? String(res.answer) : aiEl.textContent;
          aiEl.innerHTML = renderAnswerHtml(finalText);
          appendSessionTurn(q, finalText);
          if (res.clarify && res.clarify.needs && res.clarify.needs.length) renderClarifyChips(aiEl, res.clarify);
          appendFeedbackRow(aiEl, q, finalText, res);
        } else {
          if (aiEl.parentNode) aiEl.parentNode.removeChild(aiEl);
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
        positionBubble();
      }
    });

    ball.addEventListener('pointerup', function(e) {
      if (!state.drag) return;
      try { ball.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (state.moved) {
        persistBallPos();
        positionBubble();
      } else {
        setOpen(!state.open);
      }
      state.drag = null;
    });

    document.getElementById('_snowd_adv_min').addEventListener('click', function() {
      setOpen(false);
    });

    document.getElementById('_snowd_adv_new_chat').addEventListener('click', function() {
      newChatSession({ silent: false });
    });

    document.getElementById('_snowd_adv_export_fb').addEventListener('click', function() {
      var list = loadFeedback();
      var blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'advisor-feedback-' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 500);
    });

    document.getElementById('_tab_chat').addEventListener('click', function() { switchTab('chat'); });
    document.getElementById('_tab_adv').addEventListener('click', function() { switchTab('adv'); });

    tip.addEventListener('click', function(e) {
      e.stopPropagation();
      if (state.rotatingTip) {
        nextRotatingTip();
      } else {
        openChargenDetail();
      }
    });

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

    window.addEventListener('resize', function() {
      applyBallPos();
      positionBubble();
    });

    window.addEventListener('snowd-chargen-change', function() {
      var prevKey = state.chatSession.bindingKey;
      refreshContext();
      if (prevKey && prevKey !== getBindingKey()) {
        newChatSession({ silent: false });
      }
      refreshChargenTip();
    });

    window.addEventListener('snowd-panel-character-change', function() {
      if (!window.snowdPanel || !window.snowdPanel.isPanelPage || !window.snowdPanel.isPanelPage()) return;
      var prevKey = state.chatSession.bindingKey;
      state.catalog = null;
      refreshContext();
      if (prevKey && prevKey !== getBindingKey()) {
        newChatSession({ silent: false });
      }
    });

    initTips();
    applyBallPos();
    ensureSessionBinding();
    restoreSessionUi();
    if (isChargenPage()) {
      setTimeout(refreshChargenTip, 400);
    }
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
