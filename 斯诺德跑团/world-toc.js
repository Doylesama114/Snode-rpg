/* world-toc.js v4 —— 两级目录：保 TTS 控件、标签去「朗读」、补全章节、滚动高亮 */
(function () {
  function clean(a) {
    var c = a.cloneNode(true);
    var kill = c.querySelectorAll("button,.tts,[data-tts],[class*=speak],[class*=read],[class*=voice]");
    for (var i = 0; i < kill.length; i++) if (kill[i].parentNode) kill[i].parentNode.removeChild(kill[i]);
    var s = (c.textContent || "").replace(/朗读|播放|停止|暂停/g, "").trim();
    return s.length > 22 ? s.slice(0, 22) + "…" : s;
  }
  function setLabel(a, txt) {
    var firstText = null, extras = [];
    for (var c = a.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        if (!firstText && (c.nodeValue || "").trim()) firstText = c;
        else if (firstText) extras.push(c);
      }
    }
    if (firstText) firstText.nodeValue = txt;
    else a.insertBefore(document.createTextNode(txt), a.firstChild);
    for (var i = 0; i < extras.length; i++) if (extras[i].parentNode) extras[i].parentNode.removeChild(extras[i]);
  }
  function build() {
    var pane = document.getElementById("help-pane-world");
    if (!pane) return;
    var toc = pane.querySelector(".toc-sidebar .toc") || pane.querySelector(".toc");
    if (!toc) return;
    var secs = [], all = pane.querySelectorAll(".section");
    for (var i = 0; i < all.length; i++) secs.push(all[i]);
    if (!secs.length) return;
    var existing = {}, as = toc.querySelectorAll("a[href^=\"#w-\"]");
    for (var k = 0; k < as.length; k++) existing[(as[k].getAttribute("href") || "").slice(1)] = as[k];
    for (var s = 0; s < secs.length; s++) {
      var sec = secs[s];
      if (!sec.id) continue;
      var a = existing[sec.id];
      if (!a) {
        a = document.createElement("a");
        a.setAttribute("href", "#" + sec.id);
        var h2 = sec.querySelector("h2");
        a.textContent = h2 ? (h2.textContent || "").trim() : sec.id.replace(/^w-/, "");
      } else {
        setLabel(a, clean(a));
      }
      toc.appendChild(a);
      if (a.nextElementSibling && a.nextElementSibling.className && a.nextElementSibling.className.indexOf("toc-sub") >= 0) { toc.appendChild(a.nextElementSibling); continue; }
      var hs = sec.querySelectorAll("h3");
      if (hs.length) {
        var box = document.createElement("div");
        box.className = "toc-sub";
        for (var m = 0; m < hs.length && m < 24; m++) {
          var h = hs[m];
          if (!h.id) h.id = sec.id + "-h" + (m + 1);
          var sa = document.createElement("a");
          sa.setAttribute("href", "#" + h.id);
          sa.textContent = clean(h);
          box.appendChild(sa);
        }
        toc.appendChild(box);
      }
    }
    function sync() {
      var ls = toc.querySelectorAll("a"), best = null, bestTop = -1e9;
      for (var x = 0; x < ls.length; x++) {
        var id2 = (ls[x].getAttribute("href") || "").slice(1);
        var el = id2 ? document.getElementById(id2) : null;
        if (!el) continue;
        var top = el.getBoundingClientRect().top;
        if (top < 140 && top > bestTop) { bestTop = top; best = ls[x]; }
      }
      for (var y = 0; y < ls.length; y++) ls[y].classList.remove("toc-active");
      if (best) best.classList.add("toc-active");
    }
    window.removeEventListener("scroll", sync);
    window.addEventListener("scroll", sync, { passive: true });
    setTimeout(sync, 300);
    window.__worldTocBuilt = toc.querySelectorAll("a").length;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  setTimeout(build, 900);
})();