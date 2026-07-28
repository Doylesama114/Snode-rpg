/**
 * help-search.js — 规则手册 + 世界观全文检索与跳转
 * 依赖：window.HelpPager.setView（help-pager-script）
 */
(function () {
  "use strict";

  var index = [];
  var hits = [];
  var hitIndex = -1;
  var lastQuery = "";
  var terms = [];
  var jumpGen = 0;

  var inputEl, statusEl, btnGo, btnPrev, btnNext;

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeText(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function parseTerms(q) {
    return String(q || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (t) {
        return t.toLowerCase();
      });
  }

  function closestSectionId(el) {
    var n = el;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains("section") && n.id) return n.id;
      n = n.parentNode;
    }
    return "";
  }

  function paneOf(el) {
    if (el.closest && el.closest("#help-pane-world")) return "world";
    if (el.closest && el.closest("#help-pane-rules")) return "rules";
    var n = el;
    while (n) {
      if (n.id === "help-pane-world") return "world";
      if (n.id === "help-pane-rules") return "rules";
      n = n.parentNode;
    }
    return "rules";
  }

  function pushBlock(el, pane) {
    if (!el || el.nodeType !== 1) return;
    var text = normalizeText(el.textContent || "");
    if (!text || text.length < 2) return;
    index.push({
      el: el,
      pane: pane,
      text: text,
      sectionId: closestSectionId(el),
    });
  }

  function buildIndex() {
    index = [];
    ["help-pane-rules", "help-pane-world"].forEach(function (paneId) {
      var root = $(paneId);
      if (!root) return;
      var pane = paneId === "help-pane-world" ? "world" : "rules";
      var content = root.querySelector("main.help-content") || root;

      var headings = content.querySelectorAll("h2, h3, h4");
      for (var i = 0; i < headings.length; i++) pushBlock(headings[i], pane);

      var cards = content.querySelectorAll(".card");
      for (var c = 0; c < cards.length; c++) pushBlock(cards[c], pane);

      var notes = content.querySelectorAll(".note");
      for (var n = 0; n < notes.length; n++) pushBlock(notes[n], pane);

      var paras = content.querySelectorAll(".p");
      for (var p = 0; p < paras.length; p++) pushBlock(paras[p], pane);

      var rows = content.querySelectorAll(".wrap table tr");
      for (var r = 0; r < rows.length; r++) {
        var tr = rows[r];
        if (tr.querySelector("th") && !tr.querySelector("td")) continue;
        pushBlock(tr, pane);
      }
    });
  }

  function clearHighlights() {
    var highlights = document.querySelectorAll(".search-highlight");
    for (var i = highlights.length - 1; i >= 0; i--) {
      var span = highlights[i];
      var parent = span.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    }
    var currents = document.querySelectorAll(".search-hit-current");
    for (var j = 0; j < currents.length; j++) {
      currents[j].classList.remove("search-hit-current");
    }
  }

  function highlightInElement(root, term) {
    if (!term) return;
    var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var regex = new RegExp(escaped, "gi");
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (var i = 0; i < textNodes.length; i++) {
      var node = textNodes[i];
      if (!node.parentNode) continue;
      var parent = node.parentNode;
      if (parent.classList && parent.classList.contains("search-highlight")) continue;
      if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE") continue;
      var text = node.textContent;
      regex.lastIndex = 0;
      if (!regex.test(text)) continue;
      regex.lastIndex = 0;
      var fragment = document.createDocumentFragment();
      var lastIdx = 0;
      var m;
      while ((m = regex.exec(text)) !== null) {
        if (m.index > lastIdx) {
          fragment.appendChild(document.createTextNode(text.substring(lastIdx, m.index)));
        }
        var span = document.createElement("span");
        span.className = "search-highlight";
        span.textContent = m[0];
        fragment.appendChild(span);
        lastIdx = regex.lastIndex;
      }
      if (lastIdx < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
      }
      parent.replaceChild(fragment, node);
    }
  }

  function updateStatus() {
    if (!statusEl) return;
    statusEl.classList.remove("empty");
    if (!lastQuery) {
      statusEl.textContent = "";
      return;
    }
    if (!hits.length) {
      statusEl.textContent = "无结果";
      statusEl.classList.add("empty");
      return;
    }
    statusEl.textContent = hitIndex + 1 + " / " + hits.length;
  }

  function updateNavButtons() {
    var has = hits.length > 0;
    if (btnPrev) btnPrev.disabled = !has;
    if (btnNext) btnNext.disabled = !has;
  }

  function updateUrlForHit(hit) {
    try {
      var u = new URL(location.href);
      if (hit.pane === "world") u.searchParams.set("view", "world");
      else u.searchParams.delete("view");
      if (hit.sectionId) u.hash = "#" + hit.sectionId;
      else u.hash = "";
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  function goToHit(idx) {
    if (!hits.length) return;
    hitIndex = ((idx % hits.length) + hits.length) % hits.length;
    var hit = hits[hitIndex];
    var gen = ++jumpGen;
    clearHighlights();

    var currentView = document.body.getAttribute("data-help-view") || "rules";
    var needSwitch = hit.pane !== currentView;

    function afterVisible() {
      if (gen !== jumpGen) return;
      for (var t = 0; t < terms.length; t++) {
        highlightInElement(hit.el, terms[t]);
      }
      hit.el.classList.add("search-hit-current");
      try {
        hit.el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        hit.el.scrollIntoView(true);
      }
      updateUrlForHit(hit);
      updateStatus();
      updateNavButtons();
    }

    if (needSwitch && window.HelpPager && typeof window.HelpPager.setView === "function") {
      window.HelpPager.setView(hit.pane, true);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          setTimeout(afterVisible, 50);
        });
      });
    } else {
      afterVisible();
    }
  }

  function runSearch(jumpFirst) {
    var q = (inputEl && inputEl.value) || "";
    var trimmed = q.trim();
    clearHighlights();
    hits = [];
    hitIndex = -1;
    terms = parseTerms(trimmed);
    lastQuery = trimmed;

    if (!trimmed) {
      updateStatus();
      updateNavButtons();
      return;
    }

    for (var i = 0; i < index.length; i++) {
      var block = index[i];
      var ok = true;
      for (var t = 0; t < terms.length; t++) {
        if (block.text.indexOf(terms[t]) === -1) {
          ok = false;
          break;
        }
      }
      if (ok) hits.push(block);
    }

    updateNavButtons();
    if (!hits.length) {
      updateStatus();
      return;
    }
    if (jumpFirst !== false) goToHit(0);
    else updateStatus();
  }

  function nextHit() {
    if (!hits.length) {
      runSearch(true);
      return;
    }
    goToHit(hitIndex + 1);
  }

  function prevHit() {
    if (!hits.length) {
      runSearch(true);
      return;
    }
    goToHit(hitIndex - 1);
  }

  function onEnterSearch() {
    var q = ((inputEl && inputEl.value) || "").trim();
    if (q !== lastQuery) {
      runSearch(true);
    } else if (hits.length) {
      nextHit();
    } else {
      runSearch(true);
    }
  }

  function bind() {
    inputEl = $("help-search-input");
    statusEl = $("help-search-status");
    btnGo = $("help-search-go");
    btnPrev = $("help-search-prev");
    btnNext = $("help-search-next");
    if (!inputEl) return;

    buildIndex();

    if (btnGo) {
      btnGo.addEventListener("click", function () {
        runSearch(true);
      });
    }
    if (btnNext) btnNext.addEventListener("click", nextHit);
    if (btnPrev) btnPrev.addEventListener("click", prevHit);

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) prevHit();
        else onEnterSearch();
      }
    });

    inputEl.addEventListener("input", function () {
      if (!String(inputEl.value || "").trim()) {
        lastQuery = "";
        hits = [];
        hitIndex = -1;
        terms = [];
        clearHighlights();
        updateStatus();
        updateNavButtons();
      }
    });

    updateNavButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
