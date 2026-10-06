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

  function normalizeApi(value) {
    try {
      var u = new URL(String(value || '').trim());
      var dev = !window.mobileBridge && (!location.hostname || /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
      var local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
      if (u.username || u.password || u.search || u.hash || (u.protocol !== 'https:' && !(dev && local && u.protocol === 'http:'))) return '';
      return u.href.replace(/\/+$/, '');
    } catch (_) { return ''; }
  }
  function apiCandidates() {
    var injected = normalizeApi(window.SNODE_ADVISOR_API);
    var configured = normalizeApi(window.SnowdAdvisorService && window.SnowdAdvisorService.baseUrl);
    var dev = !window.mobileBridge && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var values = dev && !injected ? ['http://127.0.0.1:9000', configured] : [injected, configured];
    values.push(normalizeApi(window.SnowdAdvisorService && window.SnowdAdvisorService.fallbackBaseUrl));
    return values.filter(function (v, i) { return v && values.indexOf(v) === i; });
  }
  var API = apiCandidates()[0] || '';
  if (API) window.SNODE_ADVISOR_API = API;
  var connected = false, healthPending = false, healthPromise = Promise.resolve(false);

  function timedFetch(url, options, timeout, jsonBody) {
    return new Promise(function (resolve, reject) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return; settled = true;
        if (controller) controller.abort();
        reject(new Error('连接超时，请检查网络后重试'));
      }, timeout);
      var opts = Object.assign({}, options || {});
      if (controller) opts.signal = controller.signal;
      fetch(url, opts).then(function (r) {
        return jsonBody ? r.json().then(function (data) { return { response:r, data:data }; }) : r;
      }).then(function (r) {
        if (settled) return; settled = true; clearTimeout(timer); resolve(r);
      }, function (e) {
        if (settled) return; settled = true; clearTimeout(timer);
        reject(e && e.name === 'AbortError' ? new Error('连接超时，请重试') : e);
      });
    });
  }

  // 角色面板移交的角色快照（_snowd_adv_last_snapshot）——移动端顾问据此分析当前角色
  function handoffSnapshot() {
    try {
      var raw = localStorage.getItem('_snowd_adv_last_snapshot');
      if (!raw) return null;
      var d = JSON.parse(raw);
      return d && (d.classes || d.name) ? d : null;
    } catch (e) { return null; }
  }
  function buildAdviseBody(query) {
    var body = { query: query, conversationHistory: historyForPayload() };
    var snap = handoffSnapshot();
    if (snap) body.snapshot = snap;
    return body;
  }

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
    var item = {
      rating: rating,
      query: query,
      answer: String(answer || '').slice(0, 4000),
      intent: (meta && meta.intent) || '',
      mode: (meta && meta.mode) || 'advisor',
      profile: (meta && meta.promptProfile) || '',
      ts: Date.now(),
      source: window.electronAPI ? 'desktop' : 'mobile',
    };
    list.push(item);
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-200))); } catch (e) { /* ignore */ }
    // 发送到 FC 后端沉淀到 OSS（本地已保存，发送失败不打扰用户）
    try {
      if (window.electronAPI && window.electronAPI.sendAdvisorFeedback) {
        window.electronAPI.sendAdvisorFeedback(item);
      } else if (API) {
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
  function parseSseBlock(block, handler) {
    var eventName = 'message', lines = [];
    block.split(/\r?\n/).forEach(function (line) {
      if (line.indexOf('event:') === 0) eventName = line.slice(6).trim();
      else if (line.indexOf('data:') === 0) lines.push(line.slice(5).replace(/^ /, ''));
    });
    if (!lines.length) return;
    var payload;
    try { payload = JSON.parse(lines.join('\n')); } catch (_) { return; }
    handler(eventName, payload);
  }

  function streamAdvise(query) {
    return new Promise(function (resolve, reject) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var settled = false, reader = null, ai = state._currentAi;
      var gotDelta = false, gotDone = false, donePayload = null;
      function finish(error, result) {
        if (settled) return; settled = true; clearTimeout(timer);
        if (reader) reader.cancel().catch(function () {});
        if (error) { if (controller) controller.abort(); reject(error); }
        else resolve(result);
      }
      var timer = setTimeout(function () { finish(new Error('请求超时，请稍后重试')); }, FETCH_TIMEOUT);
      function handleEvent(name, payload) {
        if (settled) return;
        if (name === 'delta' && payload && payload.delta) {
          gotDelta = true;
          if (ai && ai.wrap.parentNode) { ai.bubble.textContent += payload.delta; scrollBottom(); }
        } else if (name === 'done') {
          gotDone = true; donePayload = payload; finish(null, donePayload);
        } else if (name === 'error') {
          finish(new Error((payload && (payload.message || payload.error)) || '服务返回错误，请重试'));
        }
      }
      fetch(API + '/api/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(buildAdviseBody(query)),
        signal: controller ? controller.signal : undefined,
      }).then(function (res) {
        if (settled) return;
        if (!res.ok) return res.json().catch(function () { return { error: '服务暂时不可用（HTTP ' + res.status + '）' }; }).then(function (data) { throw new Error(data.error || '服务暂时不可用'); });
        if ((res.headers.get('Content-Type') || '').indexOf('application/json') >= 0) {
          return res.json().then(function (data) { finish(null, data); });
        }
        if (!res.body || typeof res.body.getReader !== 'function') {
          clearTimeout(timer);
          return fetchAdvisePlain(query).then(function (data) { finish(null, data); }, finish);
        }
        reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8'), buffer = '';
        function pump() {
          if (settled) return;
          return reader.read().then(function (chunk) {
            if (settled) return;
            if (chunk.done) {
              buffer += decoder.decode();
              if (buffer.trim()) parseSseBlock(buffer, handleEvent);
              if (settled) return;
              if (gotDone) { finish(null, donePayload); return; }
              if (gotDelta) { finish(new Error('回复已中断，请重试')); return; }
              clearTimeout(timer);
              return fetchAdvisePlain(query).then(function (data) { finish(null, data); }, finish);
            }
            buffer += decoder.decode(chunk.value, { stream: true });
            var blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() || '';
            blocks.forEach(function (block) { if (block.trim()) parseSseBlock(block, handleEvent); });
            return pump();
          });
        }
        return pump();
      }).catch(function (error) { finish(error && error.name === 'AbortError' ? new Error('请求超时，请重试') : error); });
    });
  }

  function fetchAdvisePlain(query) {
    return timedFetch(API + '/api/advise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(buildAdviseBody(query)),
    }, FETCH_TIMEOUT, true).then(function (pair) {
      if (!pair.response.ok) throw new Error(pair.data.error || '服务暂时不可用（HTTP ' + pair.response.status + '）');
      return pair.data;
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

    (connected ? Promise.resolve(true) : pingHealth()).then(function (ok) {
      if (!ok) throw new Error('AI 服务连接失败，请点击顶部重连后重试');
      return streamAdvise(text);
    }).then(function (result) {
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
    if (healthPending) return healthPromise;
    healthPending = true; connected = false;
    var dot = $('statusDot'), text = $('statusText'), retry = $('reconnectBtn');
    dot.className = 'dot'; text.textContent = '正在连接…'; if (retry) retry.disabled = true;
    var candidates = apiCandidates(), lastError = null;
    healthPromise = (async function () {
      for (var i = 0; i < candidates.length; i++) {
        try {
          var pair = await timedFetch(candidates[i] + '/api/health', { cache: 'no-store' }, 10000, true);
          var res = pair.response;
          if (!res.ok) throw new Error('服务暂时不可用');
          var data = pair.data;
          if (!data || data.ok !== true || data.service !== 'snode-advisor') throw new Error('服务连接异常');
          API = candidates[i]; window.SNODE_ADVISOR_API = API; connected = true;
          dot.className = 'dot _ok'; text.textContent = '在线'; return true;
        } catch (e) { lastError = e; }
      }
      dot.className = 'dot _bad';
      text.textContent = lastError && /超时/.test(lastError.message) ? '连接超时，点击重连' : '连接失败，点击重连';
      return false;
    })().finally(function () { healthPending = false; if (retry) retry.disabled = false; });
    return healthPromise;
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
    $('reconnectBtn').addEventListener('click', pingHealth);

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
      SD_confirm('确定开始新对话？当前聊天记录将清空。', function () {
        state.session = { messages: [] };
        saveSession();
        restoreSession();
      });
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
