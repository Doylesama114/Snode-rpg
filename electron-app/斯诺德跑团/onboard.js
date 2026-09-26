/* 新手向导引擎 · onboard.js（干净重写版） */
(function () {
  var LS = '_snowd_onboard_v2';
  var mem = {};
  function read() {
    try { var v = localStorage.getItem(LS); if (v) return v; } catch (e) {}
    try { var s = sessionStorage.getItem(LS); if (s) return s; } catch (e) {}
    return mem[LS] || null;
  }
  function write(v) {
    mem[LS] = v;
    try { localStorage.setItem(LS, v); } catch (e) {}
    try { sessionStorage.setItem(LS, v); } catch (e) {}
  }
  function state() { try { return JSON.parse(read() || '{}'); } catch (e) { return {}; } }
  function mark(k, v) { var s = state(); s[k] = v; write(JSON.stringify(s)); }
  var STEPS = {
    launcher: [
      { kw: '角色|建卡|角色系统', title: '这里是冒险者工会', text: '先从「角色系统」开始：建一个属于你的冒险者。' },
      { kw: '职业|天赋|技能树', title: '职业技能树', text: '20 个基础职业 + 19 条进阶途径；可搜索任意技能并全屏预览。' },
      { kw: '帮助|规则|手册', title: '帮助：规则手册 + 世界观', text: '12 章规则与设定集；新手建议先看「基本规则 / 检定规则 / 升级规则」。' },
      { kw: '顾问', title: 'AI 顾问', text: '可以问职业、加点、进阶；需连接 AI 服务，未连接也有三步离线引导。' },
      { kw: '设置', title: '随时可以重看', text: '设置里能重看这份向导；现在就开始吧 —— 先建一个角色！' }
    ],
    chargen: [
      { kw: '种族', title: '第一步：选种族', text: '种族决定初始属性倾向与特性；不确定就选一个看着喜欢的。' },
      { kw: '职业', title: '第二步：选职业', text: '拿不准可以先去职业页看技能；这只影响起点，不是终身绑定。' },
      { kw: '属性', title: '第三步：分配属性', text: '把关键属性推到 16 左右即可，其余按喜好分配。' },
      { kw: '下一步|导出|完成', title: '跟着向导走完即可', text: '剩余步骤都有默认值，一路「下一步」就能拿到可用角色。' }
    ],
    picker: [
      { kw: '创建|新建|建卡', title: '还没有角色？', text: '点这里，30 秒就能建出第一个角色；也可以「上传角色」导入现成 xlsx。' }
    ]
  };
  var idx = 0, key = '', list = [], els = {};
  function findTarget(step) {
    var sels = step.sels || ['a', 'button', '[data-href]', '.card', 'input'];
    for (var i = 0; i < sels.length; i++) {
      var nodes = [].slice.call(document.querySelectorAll(sels[i]));
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (!step.kw) return el;
        var txt = (el.textContent || '') + ' ' + (el.getAttribute('href') || '') + ' ' + (el.getAttribute('data-href') || '');
        try { if (new RegExp(step.kw).test(txt)) return el; } catch (e) {}
      }
    }
    return null;
  }
  function build() {
    var m = document.createElement('div');
    m.id = 'onboardMask';
    m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none';
    var b = document.createElement('div');
    b.id = 'onboardBox';
    b.style.cssText = 'position:fixed;z-index:2147483002;pointer-events:auto;max-width:330px;padding:14px 16px;border:1px solid #c9ab74;border-radius:10px;background:linear-gradient(180deg,#fdf8ec,#f3e9d4);box-shadow:0 12px 28px rgba(50,30,8,.38);font-size:13.5px;line-height:1.7;color:#3a2a13';
    document.body.appendChild(m);
    document.body.appendChild(b);
    els.m = m; els.b = b;
  }
  function cleanup() {
    [els.s, els.b, els.m].forEach(function (n) { try { if (n && n.parentNode) n.parentNode.removeChild(n); } catch (e) {} });
    els = {};
  }
  function render() {
    if (!document.body) return;
    if (!els.b) build();
    var step = list[idx] || { title: '', text: '' };
    if (els.s) { try { els.s.parentNode.removeChild(els.s); } catch (e) {} els.s = null; }
    var target = findTarget(step);
    if (target) {
      var r = target.getBoundingClientRect();
      var s = document.createElement('div');
      s.style.cssText = 'position:fixed;z-index:2147483001;pointer-events:none;border:2px solid #d4a54a;border-radius:10px;box-shadow:0 0 0 9999px rgba(20,14,6,.28);left:' + Math.max(4, r.left - 6) + 'px;top:' + Math.max(4, r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px';
      document.body.appendChild(s);
      els.s = s;
      var bx = Math.min(Math.max(12, r.left), Math.max(12, window.innerWidth - 346));
      var by = r.bottom + 14;
      if (by > window.innerHeight - 200) by = Math.max(12, r.top - 186);
      els.b.style.transform = 'none';
      els.b.style.left = bx + 'px';
      els.b.style.top = by + 'px';
    } else {
      els.b.style.transform = 'translateX(-50%)';
      els.b.style.left = '50%';
      els.b.style.top = '16%';
    }
    els.b.innerHTML = '<div style="font-weight:bold;margin-bottom:6px">' + step.title + '</div><div style="margin-bottom:10px">' + step.text + '</div>';
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:flex-end';
    var cnt = document.createElement('span');
    cnt.textContent = (idx + 1) + ' / ' + list.length;
    cnt.style.cssText = 'margin-right:auto;font-size:12px;color:#8a7a5e';
    bar.appendChild(cnt);
    function mk(label, fn, primary) {
      var b2 = document.createElement('button');
      b2.type = 'button';
      b2.textContent = label;
      b2.style.cssText = 'padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;border:1px solid ' + (primary ? '#b9903f' : '#c9ab74') + ';background:' + (primary ? '#f3e6c9' : 'transparent') + ';color:#6d5223';
      b2.onclick = function (ev) { try { if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {} fn(); };
      return b2;
    }
    if (idx > 0) bar.appendChild(mk('上一步', prev));
    bar.appendChild(mk(idx === list.length - 1 ? '开始使用 ✓' : '下一步', next, true));
    bar.appendChild(mk('跳过引导', function () { finish('skipped'); }));
    els.b.appendChild(bar);
  }
  function next() { if (idx >= list.length - 1) { finish('done'); return; } idx++; render(); }
  function prev() { if (idx > 0) { idx--; render(); } }
  function finish(v) { try { mark(key, v); } catch (e) {} cleanup(); }
  function start(k) {
    key = k; list = STEPS[k] || []; idx = 0;
    if (!list.length) return false;
    if (state()[k]) return false;
    render();
    return true;
  }
  function reset() { write('{}'); }
  function settingsButton() {
    if (document.getElementById('onboardReplayBtn')) return;
    var wrap = document.querySelector('.container, .wrap, main, body');
    var b = document.createElement('button');
    b.id = 'onboardReplayBtn';
    b.type = 'button';
    b.textContent = '🎓 重看新手向导';
    b.style.cssText = 'margin:16px 0;padding:9px 14px;border:1px solid #b9903f;border-radius:9px;background:#f3e6c9;color:#6d5223;cursor:pointer;font-size:14px';
    b.onclick = function () { reset(); start('launcher'); };
    if (wrap) wrap.appendChild(b);
  }
  function auto() {
    var f = '';
    try { f = decodeURIComponent((location.pathname || '').split('/').pop() || ''); } catch (e) { f = (location.pathname || '').split('/').pop() || ''; }
    if (f === '启动台.html') start('launcher');
    else if (f === '角色创建页.html') start('chargen');
    else if (f === '角色选择页.html') start('picker');
    else if (f === '设置.html') settingsButton();
  }
  window.Onboard = { run: start, reset: reset, steps: STEPS, auto: auto };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
  else auto();
  setTimeout(auto, 700);
})();
