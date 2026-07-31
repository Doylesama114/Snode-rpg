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

/** Scroll to skill from URL hash (global search / deep links). */
function focusSkillFromHash() {
  var raw = (location.hash || "").replace(/^#/, "");
  if (!raw) return;
  var id;
  try { id = decodeURIComponent(raw); } catch (e) { id = raw; }
  var el = document.getElementById(id);
  if (!el) return;

  var node = el.parentElement;
  while (node) {
    if (node.tagName === "DETAILS") node.open = true;
    node = node.parentElement;
  }

  function scrollOnce() {
    var header = document.querySelector("header");
    var offset = header ? header.getBoundingClientRect().height + 12 : 12;
    var top = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    el.classList.add("skill-hash-focus");
    setTimeout(function() { el.classList.remove("skill-hash-focus"); }, 2600);
  }

  requestAnimationFrame(function() {
    scrollOnce();
    setTimeout(scrollOnce, 120);
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
  function linkSkillRefs() {
    var heads = ["\u6218\u6280", "\u6cd5\u672f", "\u620f\u6cd5", "\u5929\u8d4b", "\u529f\u6cd5", "\u80fd\u529b", "\u4e13\u957f"];
    var re = new RegExp("(" + heads.join("|") + ")\\.([\\u4e00-\\u9fa5\u00b7A-Za-z0-9\uff08\uff09\u3010\u3011]+)", "g");
    var nodes = document.querySelectorAll(".cond-text");
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
  function addSpBadges() {
    var arts = document.querySelectorAll("article.skill");
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
  function addUpgradeBadges() {
    var cells = document.querySelectorAll(".upgrade-cell");
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

  onReady(function() {
    initScrollSpy();
    initBackToTop();
    linkSkillRefs();
    addSpBadges();
    addUpgradeBadges();
  });
})();
