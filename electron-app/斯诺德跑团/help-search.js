/** Full-text search over the rendered rule/world content, including mobile cards. */
(function () {
  "use strict";
  var hits = [], hitIndex = -1, lastQuery = "", terms = [], jumpGen = 0, stopFollowing = null;
  var inputEl, statusEl, btnGo, btnPrev, btnNext;
  var ignored = "button,input,select,textarea,script,style,.tts-controls,.tts-hint,.scroll-hint,[aria-hidden='true']";
  var blocks = "h2,h3,h4,.card,.note,.rcard,.p,p,li,table tr";

  function $(id) { return document.getElementById(id); }
  function normalizeText(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function textNodes(root) {
    var result = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (!node.parentElement.closest(ignored)) result.push(node);
    }
    return result;
  }
  function buildIndex() {
    var index = [];
    ["rules", "world"].forEach(function (pane) {
      var root = $("help-pane-" + pane);
      if (!root) return;
      var content = root.querySelector("main.help-content") || root;
      var accepted = new Set(), visibility = new Map();
      // Ignore only the pane's own display:none: both tabs must remain searchable.
      function available(el) {
        if (el === root) return true;
        if (visibility.has(el)) return visibility.get(el);
        var style = getComputedStyle(el);
        var ok = !el.hidden && el.getAttribute("aria-hidden") !== "true" &&
          style.display !== "none" && style.visibility !== "hidden" &&
          (!el.parentElement || available(el.parentElement));
        visibility.set(el, ok);
        return ok;
      }
      content.querySelectorAll(blocks).forEach(function (el) {
        if (!available(el) || el.closest(ignored)) return;
        if (el.tagName === "TR" && !el.querySelector("td")) return;
        // Cards and table rows are single results; don't count their children twice.
        for (var parent = el.parentElement; parent && parent !== content; parent = parent.parentElement) {
          if (accepted.has(parent)) return;
        }
        var text = normalizeText(textNodes(el).map(function (n) { return n.textContent; }).join(""));
        if (text.length < 2) return;
        var section = el.closest(".section[id]");
        accepted.add(el);
        index.push({ el: el, pane: pane, text: text, sectionId: section ? section.id : "" });
      });
    });
    return index;
  }
  function clearHighlights() {
    document.querySelectorAll(".search-highlight").forEach(function (span) {
      var parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
    document.querySelectorAll(".search-hit-current").forEach(function (el) {
      el.classList.remove("search-hit-current");
      el.style.removeProperty("--help-search-offset");
    });
  }
  function highlight(root) {
    var nodes = textNodes(root), text = nodes.map(function (n) { return n.textContent; }).join("");
    var escaped = terms.slice().sort(function (a, b) { return b.length - a.length; }).map(function (term) {
      return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    var regex = new RegExp(escaped.join("|"), "gi"), matches = [], match;
    while ((match = regex.exec(text))) matches.push({ start: match.index, end: regex.lastIndex });
    var offset = 0;
    // Map whole-text matches back to text nodes, preserving inline markup and controls.
    nodes.forEach(function (node) {
      var value = node.textContent, end = offset + value.length;
      var ranges = matches.filter(function (m) { return m.start < end && m.end > offset; });
      if (ranges.length) {
        var fragment = document.createDocumentFragment(), pos = 0;
        ranges.forEach(function (m) {
          var start = Math.max(0, m.start - offset), stop = Math.min(value.length, m.end - offset);
          fragment.appendChild(document.createTextNode(value.slice(pos, start)));
          var span = document.createElement("span");span.className = "search-highlight";
          span.textContent = value.slice(start, stop);fragment.appendChild(span);pos = stop;
        });
        fragment.appendChild(document.createTextNode(value.slice(pos)));
        node.parentNode.replaceChild(fragment, node);
      }
      offset = end;
    });
  }
  function updateStatus() {
    statusEl.classList.toggle("empty", !!lastQuery && !hits.length);
    statusEl.textContent = !lastQuery ? "" : !hits.length ? "无结果" : (hitIndex + 1) + " / " + hits.length;
    btnPrev.disabled = btnNext.disabled = !hits.length;
  }
  function reset() {
    if (stopFollowing) stopFollowing();
    ++jumpGen;hits = [];hitIndex = -1;lastQuery = "";terms = [];
    clearHighlights();updateStatus();
  }
  function goToHit(idx) {
    if (!hits.length) return;
    hitIndex = ((idx % hits.length) + hits.length) % hits.length;
    if (stopFollowing) stopFollowing();
    var hit = hits[hitIndex], gen = ++jumpGen;
    clearHighlights();
    if (window.HelpPager && typeof window.HelpPager.setView === "function") {
      window.HelpPager.setView(hit.pane, true);
    }
    // Dismiss the phone keyboard before positioning the result.
    inputEl.blur();updateStatus();
    setTimeout(function () {
      if (gen !== jumpGen || !hit.el.isConnected) return;
      highlight(hit.el);hit.el.classList.add("search-hit-current");
      var pane = $("help-pane-" + hit.pane), pending = null;
      function position() {
        if (gen !== jumpGen || !hit.el.isConnected || document.body.getAttribute("data-help-view") !== hit.pane) return;
        var anchor = hit.el.querySelector(".search-highlight") || hit.el;
        var toc = pane.querySelector(".toc-sidebar"), offset = 16;
        if (toc) {
          var style = getComputedStyle(toc), rect = toc.getBoundingClientRect(), target = anchor.getBoundingClientRect();
          if ((style.position === "sticky" || style.position === "fixed") &&
              rect.left < target.right && rect.right > target.left) {
            offset += rect.height + (parseFloat(style.top) || 0);
          }
        }
        hit.el.style.setProperty("--help-search-offset", offset + "px");
        anchor.style.setProperty("scroll-margin-top", offset + "px", "important");
        try { anchor.scrollIntoView({ behavior: "instant", block: "start" }); }
        catch (e) { anchor.scrollIntoView(true); }
      }
      function refresh() { clearTimeout(pending);pending = setTimeout(position, 0); }
      function imageLoaded(e) {
        // Late images above the result must not push it out of the viewport.
        if (e.target.tagName === "IMG" && (e.target.compareDocumentPosition(hit.el) & Node.DOCUMENT_POSITION_FOLLOWING)) refresh();
      }
      function stop() {
        clearTimeout(pending);pane.removeEventListener("load", imageLoaded, true);
        window.removeEventListener("resize", refresh);
        ["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (type) { document.removeEventListener(type, stop, true); });
        if (stopFollowing === stop) stopFollowing = null;
      }
      stopFollowing = stop;
      pane.addEventListener("load", imageLoaded, true);window.addEventListener("resize", refresh);
      // Once the player interacts, their own scrolling takes priority.
      ["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (type) { document.addEventListener(type, stop, {capture:true,passive:true}); });
      position();
      try {
        var u = new URL(location.href);
        if (hit.pane === "world") u.searchParams.set("view", "world");
        else u.searchParams.delete("view");
        u.hash = hit.sectionId ? "#" + hit.sectionId : "";
        history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) {}
    }, 0);
  }

  function runSearch() {
    var query = inputEl.value.trim();reset();
    lastQuery = query;terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!query) return;
    // Rebuild on submission: mobile table conversion and TTS can change the DOM after load.
    hits = buildIndex().filter(function (block) {
      return terms.every(function (term) { return block.text.indexOf(term) !== -1; });
    });
    if (hits.length) goToHit(0);
    else updateStatus();
  }
  function move(step) {
    if (inputEl.value.trim() !== lastQuery || !hits.length) runSearch();
    else goToHit(hitIndex + step);
  }
  function bind() {
    inputEl = $("help-search-input");statusEl = $("help-search-status");
    btnGo = $("help-search-go");btnPrev = $("help-search-prev");btnNext = $("help-search-next");
    if (!inputEl || !statusEl || !btnGo || !btnPrev || !btnNext) return;
    btnGo.addEventListener("click", runSearch);
    btnPrev.addEventListener("click", function () { move(-1); });
    btnNext.addEventListener("click", function () { move(1); });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();move(e.shiftKey ? -1 : 1);
    });
    inputEl.addEventListener("search", function () {
      // Some phone keyboards emit both Enter and search for the same submission.
      if (inputEl.value.trim() !== lastQuery || !hits.length) runSearch();
    });
    inputEl.addEventListener("input", reset);
    updateStatus();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
