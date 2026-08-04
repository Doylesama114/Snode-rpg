// 斯诺德跑团 — 移动端 AI 顾问聊天页逻辑
(function () {
  'use strict';

  var SESSION_KEY = '_snowd_adv_mobile_session_v1';
  var FEEDBACK_KEY = '_snowd_adv_mobile_feedback';
  var MAX_HISTORY = 30;
  var FETCH_TIMEOUT = 150000;

  var STARTERS = [
    '\u65b0\u624b\u5e94\u8be5\u9009\u4ec0\u4e48\u804c\u4e1a\uff1f',
    '\u6218\u58eb\u600e\u4e48\u52a0\u70b9\uff1f',
    '\u5e2e\u6211\u89c4\u5212\u4e00\u4e2a\u6cd5\u5e08\u7684\u5347\u7ea7\u8def\u7ebf',
    '\u60f3\u73a9\u4e00\u4e2a\u5e05\u4e14\u64cd\u4f5c\u611f\u5f3a\u7684\u89d2\u8272',
  ];

  var state = {
    busy: false,
    lastQuery: '',
    session: { messages: [] },
  };

  function $(id) { return document.getElementById(id); }
  function escapeHtml(t) {
    return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function resolveApi() {
    var v = String(window.SNODE_ADVISOR_API || '').trim();
    if (v && v !== '__ADVISOR_API_BASE__') return v.replace(/\/+$/, '');
    var host = location.hostname || '';
    if (!host || host === 'localhost' || host === '127.0.0.1') return 'http://127.0.0.1:9000';
    return '';
  }
  var API = resolveApi();

  // ---------- 会话持久化 ----------
  function loadSession() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s && Array.isArray(s.messages)) {
        s.messages = s.messages.slice(-MAX_HISTORY);
        return s;
      }
    } catch (e) { /* ignore */ }
    return { messages: [] };
  }
  function saveSession() {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); } catch (e) { /* ignore */ }
  }
  function historyForPayload() {
    return state.session.messages
      .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && m.content; })
      .slice(-MAX_HISTORY)
      .map(function (m) { return { role: m.role, content: String(m.content).slice(0, 4000) }; });
  }

  // ---------- 消息渲染 ----------
  function scrollBottom() {
    var msgs = $('msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function addUserMsg(text) {
    var wrap = document.createElement('div');
    wrap.className = 'msg _user';
    var b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    wrap.appendChild(b);
    $('msgs').appendChild(wrap);
    scrollBottom();
  }

  function addAiMsg() {
    var wrap = document.createElement('div');
    wrap.className = 'msg _ai';
    var b = document.createElement('div');
    b.className = 'bubble typing';
    wrap.appendChild(b);
    $('msgs').appendChild(wrap);
    scrollBottom();
    return { wrap: wrap, bubble: b };
  }

  function addErrorMsg(text) {
    var wrap = document.createElement('div');
    wrap.className = 'msg _err';
    var b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    wrap.appendChild(b);
    $('msgs').appendChild(wrap);
    scrollBottom();
  }

  // ---------- 引用与页面跳转 ----------
  function classToSkillPage(cls) {
    var map = {
      '\u6218\u58eb': '\u6218\u58eb.html',
      '\u6cd5\u5e08': '\u6cd5\u5e08.html',
      '\u6e38\u8361\u8005': '\u6e38\u8361\u8005.html',
      '\u7267\u5e08': '\u7267\u5e08.html',
      '\u5723\u9a91\u58eb': '\u5723\u9a91\u58eb.html',
      '\u5fb7\u9c81\u4f0a': '\u5fb7\u9c81\u4f0a.html',
      '\u6b66\u50e7': '\u6b66\u50e7.html',
      '\u541f\u6e38\u8bd7\u4eba': '\u541f\u6e38\u8bd7\u4eba.html',
      '\u730e\u4eba': '\u730e\u4eba.html',
      '\u672f\u58eb': '\u672f\u58eb.html',
      '\u9b54\u5951\u5e08': '\u9b54\u5951\u5e08.html',
      '\u5947\u68b0\u5e08': '\u5947\u68b0\u5e08.html',
      '\u8428\u6ee1\u795e\u53f8': '\u8428\u6ee1\u795e\u53f8.html',
      '\u86ee\u6597\u58eb': '\u86ee\u6597\u58eb.html',
      '\u901a\u7528': '\u901a\u7528\u5929\u8d4b\u6811.html',
      '\u901a\u7528\u5929\u8d4b\u6811': '\u901a\u7528\u5929\u8d4b\u6811.html',
    };
    return map[cls] || '';
  }

  function renderAnswerHtml(text) {
    var t = String(text || '');
    var body = t;
    var refLine = '';
    var m = t.match(/(?:\n?)(\u3010\u53c2\u8003\u3011[^\n]*)[ \t]*\n*$/);
    if (m) {
      refLine = m[1];
      body = t.slice(0, m.index);
    }
    var html = escapeHtml(body).replace(/\n/g, '<br>');
    if (refLine) {
      var items = refLine.replace(/^\u3010\u53c2\u8003\u3011/, '').split('\uff1b')
        .map(function (x) { return x.trim(); }).filter(Boolean);
      var links = items.map(function (it) {
        var mm = it.match(/^(.*?)\uff08(.*?)\u00b7(.*?)\uff09/);
        if (!mm) return '<span>' + escapeHtml(it) + '</span>';
        var name = mm[1].trim(), cls = mm[2].trim(), id = mm[3].trim();
        var file = classToSkillPage(cls);
        var idOk = /^[a-z][a-z0-9-]*$/.test(id);
        if (!file || !id || !idOk) return '<span>' + escapeHtml(it) + '</span>';
        return '<a class="_ref" href="../\u804c\u4e1a\u9875/' + file + '#' + encodeURIComponent(id) + '">' + escapeHtml(name) + '</a>';
      });
      html += '<div class="refs">\u3010\u53c2\u8003\u3011' + links.join('\uff1b') + '</div>';
    }
    return html;
  }

  function bindRefClicks() {
    $('msgs').addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a._ref') : null;
      if (!a) return;
      e.preventDefault();
      location.href = a.getAttribute('href');
    });
  }

  // ---------- 追问 chips ----------
  function renderChips(list, label) {
    var chips = $('chips');
    chips.innerHTML = '';
    if (!list || !list.length) return;
    if (label) {
      var lab = document.createElement('span');
      lab.style.cssText = 'flex-shrink:0;font-size:12px;color:#69706b;line-height:40px;padding-right:2px';
      lab.textContent = label;
      chips.appendChild(lab);
    }
    list.slice(0, 8).forEach(function (opt) {
      var b = document.createElement('button');
      b.textContent = opt;
      b.addEventListener('click', function () {
        // 直接发送当前快捷问题，上下文由会话历史携带，不再拼接上一个问题
        sendQuery(opt);
      });
      chips.appendChild(b);
    });
  }

  function renderStarters() {
    if (state.session.messages.length) return;
    renderChips(STARTERS, '\u8bd5\u8bd5\u8fd9\u4e9b\u95ee\u9898\uff1a');
  }

  // ---------- 反馈与复制 ----------
  function loadFeedback() {
    try {
      var raw = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }
  function recordFeedback(rating, query, answer, meta) {
    var list = loadFeedback();
    list.push({
      rating: rating,
      query: query,
      answer: String(answer || '').slice(0, 4000),
      intent: (meta && meta.intent) || '',
      mode: (meta && meta.mode) || 'advisor',
      profile: (meta && meta.promptProfile) || '',
      ts: Date.now(),
      source: 'mobile',
    });
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-200))); } catch (e) { /* ignore */ }
    // 发送到 FC 后端沉淀到 OSS（本地已保存，发送失败不打扰用户）
    try {
      if (API) {
        var item = list[list.length - 1];
        fetch(API + '/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        }).catch(function () { /* ignore */ });
      }
    } catch (e2) { /* ignore */ }
  }

  function addActions(wrap, query, answer, meta) {
    var row = document.createElement('div');
    row.className = 'actions';
    var mk = function (label, rating) {
      var b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', function () {
        recordFeedback(rating, query, answer, meta);
        var btns = row.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
        b.textContent = '\u5df2\u8bb0\u5f55';
      });
      return b;
    };
    var copy = document.createElement('button');
    copy.textContent = '\ud83d\udccc \u590d\u5236';
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = '\u5df2\u590d\u5236'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(answer || '')).then(done).catch(function () { copy.textContent = '\u590d\u5236\u5931\u8d25'; });
      } else {
        var ta = document.createElement('textarea');
        ta.value = String(answer || '');
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { copy.textContent = '\u590d\u5236\u5931\u8d25'; }
        ta.remove();
      }
    });
    row.appendChild(mk('\ud83d\udc4d \u6709\u7528', 'up'));
    row.appendChild(mk('\ud83d\udc4e \u6ca1\u7528', 'down'));
    row.appendChild(copy);
    wrap.appendChild(row);
  }

  function finalizeAiMsg(ai, finalText, result) {
    ai.bubble.classList.remove('typing');
    ai.bubble.innerHTML = renderAnswerHtml(finalText);
    addActions(ai.wrap, state.lastQuery, finalText, result);
    if (result && result.clarify && result.clarify.needs && result.clarify.needs.length) {
      renderChips(result.clarify.needs[0].options || [], result.clarify.needs[0].prompt);
    } else {
      renderStarters();
    }
    scrollBottom();
  }

  // ---------- SSE ----------
  function parseSseBlock(block, handlers) {
    var eventName = 'message';
    var data = '';
    block.split(/\r?\n/).forEach(function (line) {
      if (line.indexOf('event:') === 0) eventName = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
    });
    if (!data) return;
    var payload;
    try { payload = JSON.parse(data); } catch (e) { return; }
    if (handlers[eventName]) handlers[eventName](payload);
  }

  function streamAdvise(query) {
    return new Promise(function (resolve, reject) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
      }, FETCH_TIMEOUT);

      var donePayload = null;
      var gotDone = false;
      var gotError = false;

      fetch(API + '/api/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ query: query, conversationHistory: historyForPayload() }),
        signal: controller ? controller.signal : undefined,
      }).then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return { error: 'HTTP ' + res.status }; }).then(function (err) {
            throw new Error(err.error || 'HTTP ' + res.status);
          });
        }
        if (!res.body || typeof res.body.getReader !== 'function') {
          throw new Error('\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u6d41\u5f0f\u54cd\u5e94');
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buffer = '';

        function handleEvent(name, payload) {
          if (name === 'delta' && payload && payload.delta) {
            var ai = state._currentAi;
            if (ai) {
              ai.bubble.textContent += payload.delta;
              scrollBottom();
            }
            return;
          }
          if (name === 'done') {
            donePayload = payload;
            gotDone = true;
            return;
          }
          if (name === 'error') {
            gotError = true;
            reject(new Error((payload && payload.message) || '\u670d\u52a1\u8fd4\u56de\u9519\u8bef'));
          }
        }

        function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              if (buffer.trim()) parseSseBlock(buffer, handleEvent);
              if (gotError) return;
              if (gotDone) { resolve(donePayload); return; }
              // 流式结尾可能被网关吞掉最后一帧：自动改走非流式兜底
              clearTimeout(timer);
              fetchAdvisePlain(query).then(resolve).catch(reject);
              return;
            }
            buffer += decoder.decode(r.value, { stream: true });
            var blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            blocks.forEach(function (b) { if (b.trim()) parseSseBlock(b, handleEvent); });
            return pump();
          }).catch(function (err) {
            if (err && err.name === 'AbortError') reject(new Error('\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5'));
            else reject(err);
          });
        }

        return pump();
      }).catch(function (err) {
        if (gotError) return;
        reject(err);
      }).finally(function () {
        clearTimeout(timer);
      });
    });
  }

  // ---------- 非流式兜底 ----------
  function fetchAdvisePlain(query) {
    return fetch(API + '/api/advise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: query, conversationHistory: historyForPayload() }),
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return { error: 'HTTP ' + res.status }; }).then(function (err) {
          throw new Error(err.error || 'HTTP ' + res.status);
        });
      }
      return res.json();
    });
  }

  // ---------- 发送 ----------
  function sendQuery(text) {
    if (state.busy) return;
    text = String(text || '').trim();
    if (!text) return;
    if (!API) {
      addErrorMsg('\u987e\u95ee\u670d\u52a1\u5c1a\u672a\u914d\u7f6e\uff0c\u8bf7\u7b49\u5f85\u5f00\u53d1\u8005\u90e8\u7f72\u540e\u4f7f\u7528\u3002');
      return;
    }

    state.lastQuery = text;
    state.session.messages.push({ role: 'user', content: text, ts: Date.now() });
    saveSession();
    addUserMsg(text);
    $('input').value = '';
    autoSize();
    renderStarters();

    var ai = addAiMsg();
    state._currentAi = ai;
    setBusy(true);

    streamAdvise(text).then(function (result) {
      var finalText = (result && result.answer && String(result.answer).trim())
        ? String(result.answer)
        : ai.bubble.textContent || '\uff08\u65e0\u56de\u7b54\u5185\u5bb9\uff09';
      if (ai.bubble.textContent) ai.bubble.textContent = '';
      state.session.messages.push({ role: 'assistant', content: finalText, ts: Date.now() });
      saveSession();
      finalizeAiMsg(ai, finalText, result);
    }).catch(function (err) {
      if (ai.wrap.parentNode) ai.wrap.parentNode.removeChild(ai.wrap);
      addErrorMsg(err.message || String(err));
      renderStarters();
    }).finally(function () {
      state._currentAi = null;
      setBusy(false);
    });
  }

  function setBusy(on) {
    state.busy = on;
    $('send').disabled = on;
  }

  // ---------- 输入框 ----------
  function autoSize() {
    var input = $('input');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 132) + 'px';
  }

  // ---------- 服务状态 ----------
  function pingHealth() {
    var dot = $('statusDot'), text = $('statusText');
    if (!API) {
      dot.className = 'dot _bad';
      text.textContent = '\u670d\u52a1\u672a\u914d\u7f6e';
      return;
    }
    fetch(API + '/api/health', { method: 'GET' }).then(function (res) {
      if (res.ok) {
        dot.className = 'dot _ok';
        text.textContent = '\u5728\u7ebf';
      } else {
        dot.className = 'dot _bad';
        text.textContent = '\u670d\u52a1\u5f02\u5e38';
      }
    }).catch(function () {
      dot.className = 'dot _bad';
      text.textContent = '\u672a\u8fde\u63a5\u670d\u52a1';
    });
  }

  // ---------- 初始化 ----------
  function restoreSession() {
    var msgs = $('msgs');
    msgs.innerHTML = '';
    state.session.messages.forEach(function (m) {
      if (m.role === 'user') {
        addUserMsg(m.content);
      } else if (m.role === 'assistant') {
        var ai = addAiMsg();
        ai.bubble.classList.remove('typing');
        ai.bubble.innerHTML = renderAnswerHtml(m.content);
        addActions(ai.wrap, m.content, m.content, null);
      }
    });
    if (!state.session.messages.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.innerHTML = '<span class="big">\u2728</span>\u60a8\u597d\uff0c\u6211\u662f\u65af\u8bfa\u5fb7 AI \u987e\u95ee\u3002<br>\u53ef\u4ee5\u95ee\u6211\u804c\u4e1a\u3001\u52a0\u70b9\u3001\u6280\u80fd\u3001\u8fdb\u9636\u3001\u89d2\u8272\u57f9\u517b\u4e4b\u7c7b\u7684\u95ee\u9898\u3002';
      msgs.appendChild(empty);
    }
    renderStarters();
    scrollBottom();
  }

  function init() {
    state.session = loadSession();
    restoreSession();
    bindRefClicks();
    pingHealth();

    $('form').addEventListener('submit', function (e) {
      e.preventDefault();
      sendQuery($('input').value);
    });
    $('input').addEventListener('input', autoSize);
    $('input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuery($('input').value);
      }
    });
    $('clearBtn').addEventListener('click', function () {
      if (!state.session.messages.length) return;
      if (!window.confirm('\u786e\u5b9a\u5f00\u59cb\u65b0\u5bf9\u8bdd\uff1f\u5f53\u524d\u804a\u5929\u8bb0\u5f55\u5c06\u6e05\u7a7a\u3002')) return;
      state.session = { messages: [] };
      saveSession();
      restoreSession();
    });
    $('backBtn').addEventListener('click', function () {
      if (window.history && window.history.length > 1) window.history.back();
      else location.href = '\u542f\u52a8\u53f0.html';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
