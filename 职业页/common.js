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
