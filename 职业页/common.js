function _q(viewId, sel) {
  var wrapper = document.getElementById(viewId);
  if (wrapper) return wrapper.querySelectorAll(sel);
  return document.querySelectorAll(sel);
}

function _clearHighlights(viewId) {
  var highlights = _q(viewId, ".search-highlight");
  for (var i = highlights.length - 1; i >= 0; i--) {
    var span = highlights[i];
    var parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  }
}

function _applyHighlights(viewId, terms) {
  if (!terms || terms.length === 0) return;
  var skills = _q(viewId, ".skill:not(.hidden):not(.filter-hidden)");
  for (var i = 0; i < skills.length; i++) {
    for (var j = 0; j < terms.length; j++) {
      var t = terms[j];
      if (!t) continue;
      _highlightInElement(skills[i], t);
    }
  }
}

function _highlightInElement(root, term) {
  var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var regex = new RegExp(escaped, "gi");
  var walker = document.createTreeWalker(root, 4, null, false);
  var textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (var i = 0; i < textNodes.length; i++) {
    var node = textNodes[i];
    if (!node.parentNode) continue;
    var parent = node.parentNode;
    if (parent.classList && parent.classList.contains("search-highlight")) continue;
    if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") continue;
    var text = node.textContent;
    var m;
    regex.lastIndex = 0;
    var match = regex.exec(text);
    if (!match) continue;
    regex.lastIndex = 0;
    var fragment = document.createDocumentFragment();
    var lastIdx = 0;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIdx) fragment.appendChild(document.createTextNode(text.substring(lastIdx, m.index)));
      var span = document.createElement("span");
      span.className = "search-highlight";
      span.textContent = m[0];
      fragment.appendChild(span);
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < text.length) fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
    parent.replaceChild(fragment, node);
  }
}

// ===== 页面卸载主动瘦身（26.09.20）=====
// 职业页 DOM 规模达 2~2.7 万节点；整页导航后旧文档会一直留在渲染进程里，
// 反复切换职业页实测可累积到 35 万节点 / 1 GB，最终渲染进程被杀 → 白屏。
// 离开页面时显式 GC，把此前已游离的文档立刻回收（主进程已开启 --expose-gc）。
(function () {
  window.addEventListener("pagehide", function (e) {
    if (e && e.persisted) return;   // 进入往返缓存时不清理
    try { if (typeof window.gc === "function") window.gc(); } catch (err) { /* 未开启 gc 时忽略 */ }
  }, { once: true });
})();

/** Scroll to skill from URL hash (global search / deep links). */
function focusSkillFromHash() {
  var raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return;
  var id;
  try { id = decodeURIComponent(raw); } catch (e) { id = raw; }
  var el = document.getElementById(id);
  if (!el) return;
  // 懒渲染：目标卡可能尚未实例化，先补上再定位，保证用户能看到详情
  if (el.classList && el.classList.contains("skill") && window.__snowdLazySkills) {
    window.__snowdLazySkills.hydrate(el);
  }

  var node = el.parentElement;
  while (node) {
    if (node.tagName === "DETAILS") node.open = true;
    node = node.parentElement;
  }

  function headerOffset() {
    var header = document.querySelector("header");
    return header ? header.getBoundingClientRect().height + 12 : 12;
  }
  // 大页面（法师页 2.7 万节点）下跨万像素的平滑滚动、以及重复的第二次滚动
  // 会长时间占用主线程；改为一次即时定位 + 一次小幅校正。
  function scrollToTarget() {
    var top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  requestAnimationFrame(function() {
    scrollToTarget();                 // 跨文档跳转时这里是 0 → 上万像素，即时到位
    el.classList.add("skill-hash-focus");
    setTimeout(function() { el.classList.remove("skill-hash-focus"); }, 1800);
    // 展开 <details> 等布局变化后只做一次小幅校正，不再整段平滑滚动
    setTimeout(function() {
      var delta = el.getBoundingClientRect().top - headerOffset();
      if (Math.abs(delta) > 8) window.scrollBy({ top: delta, behavior: "auto" });
    }, 160);
  });
}

(function() {
  function bindHashFocus() {
    focusSkillFromHash();
    window.addEventListener("hashchange", focusSkillFromHash);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindHashFocus);
  } else {
    bindHashFocus();
  }
})();

// Dark mode init + toggle injection
(function(){
  var h=document.documentElement;
  var s=localStorage.getItem('_snowd_theme');
  if(s==='dark')h.classList.add('dark');
  else if(s==='light')h.classList.remove('dark');
  else if(window.matchMedia('(prefers-color-scheme:dark)').matches)h.classList.add('dark');

  function injectToggle(){
    if(document.getElementById('themeToggle'))return;
    var bt=document.createElement('button');
    bt.id='themeToggle';
    bt.textContent=h.classList.contains('dark')?'🌙':'☀️';
    bt.style.cssText='position:fixed;top:16px;right:16px;z-index:200;background:var(--panel,#fffdf8);border:1px solid var(--line,#d8d2c4);border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;transition:all 0.2s;line-height:1';
    bt.onclick=function(){
      var d=!h.classList.contains('dark');
      h.classList.toggle('dark',d);
      bt.textContent=d?'🌙':'☀️';
      localStorage.setItem('_snowd_theme',d?'dark':'light');
    };
    if(document.body)document.body.appendChild(bt);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectToggle);
  else injectToggle();
})();

// ===== UX 增强（26.07.31）：Scrollspy / 回到顶部 / 前置引用链接 / SP 徽章 / 升级徽标 =====
(function() {
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  // 1) Scrollspy：当前位置风格区高亮 + 侧栏当前组展开
  function initScrollSpy() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("section.style"));
    if (!sections.length || !("IntersectionObserver" in window)) return;
    var lastActive = "";
    function setActive(id) {
      if (id === lastActive) return;
      lastActive = id;
      var groups = document.querySelectorAll("details.nav-group");
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var link = g.querySelector('summary a[href="#' + id + '"]');
        g.classList.toggle("nav-active", !!link);
        if (link && !g.open) g.open = true;
      }
    }
    var io = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) setActive(entries[i].target.id);
      }
    }, { rootMargin: "-15% 0px -75% 0px", threshold: 0 });
    for (var j = 0; j < sections.length; j++) io.observe(sections[j]);
  }

  // 2) 回到顶部按钮
  function initBackToTop() {
    var btn = document.createElement("button");
    btn.className = "back-to-top-btn";
    btn.setAttribute("aria-label", "\u56de\u5230\u9876\u90e8");
    btn.textContent = "\u2191";
    btn.addEventListener("click", function() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(btn);
    function toggle() {
      btn.classList.toggle("show", (window.scrollY || document.documentElement.scrollTop) > 600);
    }
    window.addEventListener("scroll", toggle, { passive: true });
    toggle();
  }

  // 3) 前置/额外条件中的技能引用链接化（战技.xxx / 法术.xxx ...）
  function findSkillByName(name) {
    var arts = document.querySelectorAll("article.skill");
    for (var i = 0; i < arts.length; i++) {
      var h4 = arts[i].querySelector("h4");
      if (h4 && h4.textContent.indexOf(name) !== -1) return arts[i];
    }
    return null;
  }
  function linkSkillRefs(root) {
    var heads = ["\u6218\u6280", "\u6cd5\u672f", "\u620f\u6cd5", "\u5929\u8d4b", "\u529f\u6cd5", "\u80fd\u529b", "\u4e13\u957f"];
    var re = new RegExp("(" + heads.join("|") + ")\\.([\\u4e00-\\u9fa5\u00b7A-Za-z0-9\uff08\uff09\u3010\u3011]+)", "g");
    var nodes = (root || document).querySelectorAll(".cond-text");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.querySelector("a")) continue;
      var text = node.innerHTML;
      var html = text.replace(re, function(match, head, name) {
        var el = findSkillByName(name);
        return el ? '<a class="skill-ref" href="#' + el.id + '">' + match + "</a>" : match;
      });
      if (html !== text) node.innerHTML = html;
    }
  }

  // 4) SP 徽章（卡片右上角，属性表标识保留）
  function addSpBadges(root) {
    var arts = skillsIn(root);
    for (var i = 0; i < arts.length; i++) {
      var art = arts[i];
      var marks = (art.getAttribute("data-marks") || "").split(",").filter(Boolean);
      if (!marks.length || art.querySelector(".sp-badge")) continue;
      var badge = document.createElement("span");
      badge.className = "sp-badge";
      badge.title = "\u6280\u80fd\u70b9\u6d88\u8017";
      for (var j = 0; j < marks.length; j++) {
        var d = document.createElement("span");
        d.className = "sp-dot";
        d.style.color = marks[j];
        d.textContent = "\u25cf";
        badge.appendChild(d);
      }
      if (marks.length > 1) {
        var n = document.createElement("span");
        n.className = "sp-count";
        n.textContent = "\u00d7" + marks.length;
        badge.appendChild(n);
      }
      var h4 = art.querySelector("h4");
      if (h4) h4.insertBefore(badge, h4.firstChild);
    }
  }

  // 5) 升级行 Lv 徽标（原文保留）
  function addUpgradeBadges(root) {
    var cells = (root || document).querySelectorAll(".upgrade-cell");
    for (var i = 0; i < cells.length; i++) {
      var label = cells[i].querySelector(".upgrade-label");
      if (!label || label.querySelector(".upgrade-badge")) continue;
      var m = (label.textContent || "").match(/(\d+)\u7ea7\u65f6/);
      if (!m) continue;
      var badge = document.createElement("span");
      badge.className = "upgrade-badge";
      badge.textContent = "Lv" + m[1];
      label.insertBefore(badge, label.firstChild);
    }
  }

  /** 取 root 内的技能卡；root 本身是卡片时也计入 */
  function skillsIn(root) {
    if (!root || root === document) return document.querySelectorAll("article.skill");
    var list = [];
    if (root.matches && root.matches("article.skill")) list.push(root);
    var inner = root.querySelectorAll ? root.querySelectorAll("article.skill") : [];
    for (var i = 0; i < inner.length; i++) list.push(inner[i]);
    return list;
  }

  /** 单张卡的增强（懒渲染实例化后同样要走一遍） */
  function enhanceSkill(art) {
    linkSkillRefs(art);
    addSpBadges(art);
    addUpgradeBadges(art);
  }
  window.__snowdEnhanceSkill = enhanceSkill;

  onReady(function() {
    initScrollSpy();
    initBackToTop();
    addSpBadges();
    addUpgradeBadges();
    if (window.__snowdLazySkills) window.__snowdLazySkills.init();
  });
})();

// ===== 职业专长顶部 chips（26.08） =====
(function() {
  function initClassFeatureTabs() {
    var groups = document.querySelectorAll(".class-features");
    for (var i = 0; i < groups.length; i++) {
      // 每个 .class-features 区独立绑定自己的 chips/panels。
      // 修复：原先 chips/panels 用 var 在同一作用域复用，页面出现第二个
      // .class-features 区（召唤师「契约生物」）后，所有 chip 的点击都会去
      // 切换最后一个区的面板（表现为点「机缘召唤」切到「岩石系·陶土魔偶」）。
      (function(group) {
        var chips = group.querySelectorAll(".class-feature-chip");
        var panels = group.querySelectorAll(".class-feature-panel");
        if (!chips.length || !panels.length) return;
        for (var j = 0; j < chips.length; j++) {
          (function(chip, index) {
            chip.addEventListener("click", function() {
              for (var k = 0; k < chips.length; k++) {
                chips[k].classList.toggle("active", k === index);
                chips[k].setAttribute("aria-selected", k === index ? "true" : "false");
              }
              for (var p = 0; p < panels.length; p++) {
                panels[p].classList.toggle("active", p === index);
              }
            });
          })(chips[j], j);
        }
      })(groups[i]);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initClassFeatureTabs);
  } else {
    initClassFeatureTabs();
  }
})();

// ===== 技能卡懒渲染（26.09.20）=====
// 职业页单页最多 423 张卡 / 2.7 万节点：全部常驻 DOM 会让首屏布局耗时 1.6s，
// 且整页导航后旧文档迟迟不回收（实测 12 轮切换累积 35 万节点 / 1 GB → 渲染进程被杀 → 白屏）。
// 改造：每张卡的 div.detail 放进 <template class="skill-body">，接近视口时再实例化；
// article 上的 data-search / data-tags / data-marks 保留，搜索与筛选无需实例化即可命中。
(function () {
  var PRELOAD_PX = 800;        // 提前量：进入视口前 800px 就实例化
  var io = null;

  function templateOf(art) {
    for (var i = 0; i < art.children.length; i++) {
      var c = art.children[i];
      if (c.tagName === "TEMPLATE" && c.classList.contains("skill-body")) return c;
    }
    return null;
  }

  function hydrate(art) {
    if (!art || art.getAttribute("data-hydrated") === "1") return false;
    var tpl = templateOf(art);
    art.setAttribute("data-hydrated", "1");
    if (!tpl) return false;
    if (tpl.content) art.insertBefore(tpl.content.cloneNode(true), tpl);
    tpl.parentNode.removeChild(tpl);
    if (window.__snowdEnhanceSkill) window.__snowdEnhanceSkill(art);
    var terms = window.__snowdActiveTerms;
    if (terms && terms.length && window.__snowdHighlightIn) {
      for (var i = 0; i < terms.length; i++) window.__snowdHighlightIn(art, terms[i]);
    }
    return true;
  }

  function hydrateAll(root) {
    var cards = (root || document).querySelectorAll("article.skill");
    for (var i = 0; i < cards.length; i++) hydrate(cards[i]);
  }

  function init() {
    var cards = document.querySelectorAll("article.skill");
    if (!cards.length) return;
    if (!("IntersectionObserver" in window)) { hydrateAll(document); return; }
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        hydrate(entries[i].target);
        io.unobserve(entries[i].target);
      }
    }, { rootMargin: PRELOAD_PX + "px 0px " + PRELOAD_PX + "px 0px" });
    for (var i = 0; i < cards.length; i++) io.observe(cards[i]);
  }

  window.__snowdLazySkills = {
    init: init,
    hydrate: hydrate,
    hydrateAll: hydrateAll,
    /** 搜索/筛选命中后：只实例化"当前可见"的卡片，其余交给滚动按需实例化 */
    hydrateVisible: function (limit) {
      var vis = document.querySelectorAll("article.skill:not(.hidden):not(.filter-hidden)");
      var n = 0, cap = limit || 40;
      for (var i = 0; i < vis.length && n < cap; i++) {
        var r = vis[i].getBoundingClientRect();
        if (r.bottom > -PRELOAD_PX && r.top < (window.innerHeight || 900) + PRELOAD_PX) { if (hydrate(vis[i])) n++; }
      }
      return n;
    },
  };
})();
