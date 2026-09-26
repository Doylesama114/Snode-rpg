/* 新手向导引擎 · onboard.js（P0）
 * 设计：遮罩 pointer-events:none（不挡任何按钮）+ 气泡卡片（上一步/下一步/跳过）
 * 目标定位：按「文本关键词 + 选择器回退」查找，兼容启动台 JS 动态渲染的卡片
 * 状态：localStorage _snowd_onboard_v2 = { launcher: 'done'|'skipped', ... }
 */
(function () {
  var LS = '_snowd_onboard_v2';
  function load() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  function findTarget(step) {
    var sels = step.sels || ['a', 'button', '[data-href]', '.card', 'input', 'select', 'textarea'];
    for (var i = 0; i < sels.length; i++) {
      var list = [].slice.call(document.querySelectorAll(sels[i]));
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        if (el.getBoundingClientRect().width < 8 || el.offsetParent === null) continue;
        if (!step.kw) return el;
        var t = (el.textContent || '') + ' ' + (el.getAttribute('href') || '') + ' ' + (el.getAttribute('data-href') || '');
        if (new RegExp(step.kw).test(t)) return el;
      }
    }
    return null;
  }
  function waitFor(step, cb, deadline) {
    var el = findTarget(step);
    if (el) return cb(el);
    if (Date.now() > deadline) return cb(null);
    setTimeout(function () { waitFor(step, cb, deadline); }, 150);
  }
  var STEPS = {
    launcher: [
      { kw: '角色|建卡|角色系统', title: '这里是冒险者工会', text: '先从「角色系统」开始：建一个属于你的冒险者。' },
      { kw: '职业|天赋|技能树', title: '职业技能树', text: '20 个基础职业 + 19 条进阶途径，可搜索任意技能并全屏预览。' },
      { kw: '帮助|规则|手册', title: '帮助：规则手册 + 世界观', text: '12 章规则与设定集，新手建议先看「基本规则 / 检定规则 / 升级规则」。' },
      { kw: '顾问', title: 'AI 顾问', text: '可以问职业、加点、进阶；需要连接一个 AI 服务，未连接时也有三步离线引导。' },
      { kw: '设置', title: '随时可以重看', text: '设置里能重看这份向导；现在就开始吧 —— 先建一个角色！' }
    ],
    chargen: [
      { kw: '种族', title: '第一步：选种族', text: '种族决定初始属性倾向与特性；不确定就选一个看着喜欢的。' },
      { kw: '职业', title: '第二步：选职业', text: '拿不准可以先去职业页看技能；这一步只影响起点，不是终身绑定。' },
      { kw: '属性', title: '第三步：分配属性', text: '把关键属性推到 16 左右即可，其余按喜好分配。' },
      { kw: '下一步|导出|完成', title: '跟着向导走完即可', text: '剩余步骤都有默认值，一路「下一步」就能拿到可用角色。' }
    ],
    picker: [
      { kw: '创建|新建|建卡', title: '还没有角色？', text: '点这里，30 秒就能建出第一个角色；也可以直接「上传角色」导入现成的 xlsx。' }
    ]
  };
  function ui(step, el, idx, total, onNext, onPrev, onSkip) {
    var mask = document.createElement('div');
    mask.id = 'onboardMask';
    mask.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:rgba(20,14,6,.28)';
    var box = document.createElement('div');
    box.id = 'onboardBox';
    box.style.cssText = 'position:fixed;z-index:2147483001;pointer-events:auto;max-width:320px;padding:14px 16px;border:1px solid #c9ab74;border-radius:10px;background:linear-gradient(180deg,#fdf8ec,#f3e9d4);box-shadow:0 12px 28px rgba(50,30,8,.38);font-size:13.5px;line-height:1.7;color:#3a2a13';
    var spot = null;
    if (el) {
      var r = el.getBoundingClientRect();
      spot = document.createElement('div');
      spot.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;border:2px solid #d4a54a;border-radius:10px;box-shadow:0 0 0 9999px rgba(20,14,6,.28);left:' + Math.max(4, r.left - 6) + 'px;top:' + Math.max(4, r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px';
      var bx = Math.min(Math.max(12, r.left), window.innerWidth - 336);
      var by = r.bottom + 14;
      if (by > window.innerHeight - 190) by = Math.max(12, r.top - 178);
      box.style.left = bx + 'px'; box.style.top = by + 'px';
    } else {
      box.style.left = '50%'; box.style.top = '18%'; box.style.transform = 'translateX(-50%)';
    }
    box.innerHTML = '<div style="font-weight:bold;margin-bottom:6px">' + step.title + '</div><div style="margin-bottom:10px">' + step.text + '</div>';
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:flex-end';
    var mk = function (label, fn, primary) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;border:1px solid ' + (primary ? '#b9903f' : '#c9ab74') + ';background:' + (primary ? '#f3e6c9' : 'transparent') + ';color:#6d5223';
      b.onclick = fn; return b;
    };
    var cnt = document.createElement('span');
    cnt.textContent = (idx + 1) + ' / ' + total;
    cnt.style.cssText = 'margin-right:auto;font-size:12px;color:#8a7a5e';
    bar.appendChild(cnt);
    if (idx > 0) bar.appendChild(mk('上一步', onPrev));
    bar.appendChild(mk(idx === total - 1 ? '开始使用 ✓' : '下一步', onNext, true));
    bar.appendChild(mk('跳过引导', onSkip));
    box.appendChild(bar);
    document.body.appendChild(mask);
    if (spot) document.body.appendChild(spot);
    return { box: box, mask: mask, spot: spot };
  }
  function run(key, steps) {
    var st = load();
    if (st[key]) return;                     /* 已看过/已跳过 */
    if (!steps || !steps.length) return;
    var idx = 0, cur = null;
    function clear() { if (cur) { try { cur.box.remove(); cur.mask.remove(); if (cur.spot) cur.spot.remove(); } catch (e) {} cur = null; } }
    function finish(v) { var s = load(); s[key] = v; save(s); clear(); }
    function show() {
      clear();
      var step = steps[idx];
      waitFor(step, function (el) {
        cur = ui(step, el, idx, steps.length,
          function () { if (idx >= steps.length - 1) finish('done'); else { idx++; show(); } },
          function () { if (idx > 0) { idx--; show(); } },
          function () { finish('skipped'); });
      }, Date.now() + 1500);
    }
    show();
  }
  function reset() { save({}); }
  var PAGES = { '启动台.html': 'launcher', '角色创建页.html': 'chargen', '角色选择页.html': 'picker' };
  function auto() {
    var f = (function () { try { return decodeURIComponent(location.pathname.split('/').pop() || ''); } catch (e) { return location.pathname.split('/').pop() || ''; } })();
    var key = PAGES[f];
    if (key) run(key, STEPS[key]);
    if (f === '设置.html') {
      try {
        var wrap = document.querySelector('.container, .wrap, main') || document.body;
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = '🎓 重看新手向导';
        b.style.cssText = 'margin:16px 0;padding:9px 14px;border:1px solid #b9903f;border-radius:9px;background:#f3e6c9;color:#6d5223;cursor:pointer;font-size:14px';
        b.onclick = function () { window.Onboard.reset(); var f2 = PAGES[f] || 'launcher'; run(f2, STEPS[f2]); };
        wrap.appendChild(b);
      } catch (e) {}
    }
  }
  window.Onboard = { run: run, reset: reset, steps: STEPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  setTimeout(auto, 900);   /* 兜底：动态渲染完成后仍未触发则再试一次 */
})();
