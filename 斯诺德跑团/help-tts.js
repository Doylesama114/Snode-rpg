/**
 * Worldview TTS for help.html — Web Speech API only.
 * Full text / section / paragraph; stops when leaving worldview pane.
 */
(function () {
  "use strict";

  var CHUNK = 220;
  var synth = window.speechSynthesis || null;
  var queue = [];
  var speaking = false;
  var paused = false;
  var activeEl = null;
  var toastTimer = null;
  var voiceCache = null;
  var inited = false;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function worldPane() {
    return document.getElementById("help-pane-world");
  }

  function worldContent() {
    var pane = worldPane();
    return pane ? pane.querySelector("main.help-content") : null;
  }

  function showToast(msg) {
    var el = document.getElementById("help-tts-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "help-tts-toast";
      el.className = "help-tts-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 2200);
  }

  function pickVoice() {
    if (!synth) return null;
    var voices = synth.getVoices() || [];
    if (!voices.length) return voiceCache;
    var preferred =
      voices.find(function (v) {
        return /zh-CN/i.test(v.lang) && /Xiaoxiao|Huihui|Yaoyao|Kangkang|Chinese/i.test(v.name);
      }) ||
      voices.find(function (v) {
        return /zh-CN/i.test(v.lang);
      }) ||
      voices.find(function (v) {
        return /^zh/i.test(v.lang);
      }) ||
      null;
    voiceCache = preferred;
    return preferred;
  }

  function headingLevel(el) {
    if (!el || !el.tagName) return 99;
    var m = /^H([2-4])$/i.exec(el.tagName);
    return m ? parseInt(m[1], 10) : 99;
  }

  function nodeReadableText(el) {
    if (!el) return "";
    if (el.classList && el.classList.contains("tts-toolbar")) return "";
    if (el.classList && el.classList.contains("tts-btn")) return "";
    if (el.tagName === "IMG") return "";
    // Skip paragraphs that only contain an image
    if (el.classList && el.classList.contains("p")) {
      var clone = el.cloneNode(true);
      $$(".tts-btn", clone).forEach(function (b) {
        b.parentNode.removeChild(b);
      });
      $$("img", clone).forEach(function (img) {
        img.parentNode.removeChild(img);
      });
      return (clone.textContent || "").replace(/\s+/g, " ").trim();
    }
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    // Strip trailing "朗读" from heading if button text leaked
    t = t.replace(/\s*朗读\s*$/, "").trim();
    return t;
  }

  function chunkText(text) {
    text = (text || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    var parts = [];
    var buf = "";
    var pieces = text.split(/(?<=[。！？；.!?;\n])/);
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (!p) continue;
      if ((buf + p).length <= CHUNK) {
        buf += p;
      } else {
        if (buf) parts.push(buf);
        if (p.length <= CHUNK) {
          buf = p;
        } else {
          for (var j = 0; j < p.length; j += CHUNK) {
            parts.push(p.slice(j, j + CHUNK));
          }
          buf = "";
        }
      }
    }
    if (buf) parts.push(buf);
    return parts;
  }

  function clearHighlight() {
    if (activeEl) {
      activeEl.classList.remove("tts-speaking");
      activeEl = null;
    }
  }

  function setHighlight(el) {
    clearHighlight();
    if (el) {
      activeEl = el;
      el.classList.add("tts-speaking");
    }
  }

  function updateToolbarState() {
    var pauseBtn = document.getElementById("tts-pause-btn");
    var stopBtn = document.getElementById("tts-stop-btn");
    var playBtn = document.getElementById("tts-play-all-btn");
    if (pauseBtn) {
      pauseBtn.disabled = !speaking && !paused;
      pauseBtn.textContent = paused ? "继续" : "暂停";
    }
    if (stopBtn) stopBtn.disabled = !speaking && !paused && !queue.length;
    if (playBtn) playBtn.classList.toggle("active", speaking && !paused);
  }

  function stopAll() {
    queue = [];
    speaking = false;
    paused = false;
    clearHighlight();
    if (synth) {
      try {
        synth.cancel();
      } catch (e) {}
    }
    updateToolbarState();
  }

  function pauseOrResume() {
    if (!synth) return;
    if (paused) {
      try {
        synth.resume();
      } catch (e) {}
      paused = false;
      speaking = true;
    } else if (speaking) {
      try {
        synth.pause();
      } catch (e) {}
      paused = true;
    }
    updateToolbarState();
  }

  function pump() {
    if (!synth) return;
    if (paused) return;
    if (!queue.length) {
      speaking = false;
      clearHighlight();
      updateToolbarState();
      return;
    }
    var item = queue.shift();
    setHighlight(item.el || null);
    var u = new SpeechSynthesisUtterance(item.text);
    var voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || "zh-CN";
    u.rate = 1;
    u.pitch = 1;
    speaking = true;
    paused = false;
    updateToolbarState();
    u.onend = function () {
      pump();
    };
    u.onerror = function () {
      pump();
    };
    try {
      synth.speak(u);
    } catch (e) {
      showToast("朗读失败：" + (e && e.message ? e.message : "未知错误"));
      stopAll();
    }
  }

  function enqueue(text, el) {
    var chunks = chunkText(text);
    for (var i = 0; i < chunks.length; i++) {
      queue.push({ text: chunks[i], el: el || null });
    }
  }

  function ensureApi() {
    if (!synth) {
      showToast("当前环境不支持语音朗读");
      return false;
    }
    pickVoice();
    if (!pickVoice() && (synth.getVoices() || []).length) {
      showToast("未找到中文语音，将尝试默认音色");
    } else if (!(synth.getVoices() || []).length) {
      // Voices often load async on Chrome
      showToast("正在加载系统语音…");
    }
    return true;
  }

  function speakNow(text, el) {
    if (!ensureApi()) return;
    if (!text || !String(text).trim()) {
      showToast("没有可朗读的文字");
      return;
    }
    stopAll();
    speaking = true;
    updateToolbarState();
    // cancel is async on some engines — slight delay before speak
    setTimeout(function () {
      if (!speaking && !paused) return;
      enqueue(text, el);
      pump();
    }, 40);
  }

  function collectFullNodes() {
    var content = worldContent();
    if (!content) return [];
    var nodes = [];
    $$(".section", content).forEach(function (sec) {
      Array.prototype.forEach.call(sec.children, function (child) {
        if (/^H[2-4]$/i.test(child.tagName) || (child.classList && child.classList.contains("p"))) {
          var t = nodeReadableText(child);
          if (t) nodes.push({ el: child, text: t });
        }
      });
    });
    return nodes;
  }

  function speakFull() {
    var nodes = collectFullNodes();
    if (!nodes.length) {
      showToast("没有可朗读的正文");
      return;
    }
    if (!ensureApi()) return;
    stopAll();
    speaking = true;
    updateToolbarState();
    setTimeout(function () {
      if (!speaking && !paused) return;
      for (var i = 0; i < nodes.length; i++) {
        enqueue(nodes[i].text, nodes[i].el);
      }
      pump();
    }, 40);
  }

  function collectFromHeading(heading) {
    var level = headingLevel(heading);
    var parts = [];
    var title = nodeReadableText(heading);
    if (title) parts.push({ el: heading, text: title });

    var node = heading.nextElementSibling;
    while (node) {
      var lv = headingLevel(node);
      if (lv <= level) break;
      if (/^H[2-4]$/i.test(node.tagName) || (node.classList && node.classList.contains("p"))) {
        var t = nodeReadableText(node);
        if (t) parts.push({ el: node, text: t });
      }
      node = node.nextElementSibling;
    }

    // If heading is last child of section and content continues? Usually siblings within section.
    // Also handle case where next content is only inside same parent — already covered.
    return parts;
  }

  function speakSection(heading) {
    var parts = collectFromHeading(heading);
    if (!parts.length) {
      showToast("该节没有可朗读内容");
      return;
    }
    if (!ensureApi()) return;
    stopAll();
    speaking = true;
    updateToolbarState();
    setTimeout(function () {
      if (!speaking && !paused) return;
      for (var i = 0; i < parts.length; i++) {
        enqueue(parts[i].text, parts[i].el);
      }
      pump();
    }, 40);
  }

  function ensureToolbar(content) {
    if ($(".tts-toolbar", content)) return;
    var bar = document.createElement("div");
    bar.className = "tts-toolbar";
    bar.innerHTML =
      '<div class="tts-toolbar-row">' +
      '<button type="button" class="tts-btn tts-btn-primary" id="tts-play-all-btn">一键朗读全文</button>' +
      '<button type="button" class="tts-btn" id="tts-pause-btn" disabled>暂停</button>' +
      '<button type="button" class="tts-btn" id="tts-stop-btn" disabled>停止</button>' +
      "</div>" +
      '<p class="tts-hint">朗读世界观正文（不含目录）。也可点标题旁「朗读」或点击段落。需系统中文语音。</p>';
    content.insertBefore(bar, content.firstChild);
    $("#tts-play-all-btn", bar).addEventListener("click", function (e) {
      e.preventDefault();
      speakFull();
    });
    $("#tts-pause-btn", bar).addEventListener("click", function (e) {
      e.preventDefault();
      pauseOrResume();
    });
    $("#tts-stop-btn", bar).addEventListener("click", function (e) {
      e.preventDefault();
      stopAll();
    });
  }

  function decorateHeadings(content) {
    $$("h2, h3, h4", content).forEach(function (h) {
      if (h.querySelector(".tts-btn-section")) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tts-btn tts-btn-section";
      btn.textContent = "朗读";
      btn.title = "朗读本节";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        speakSection(h);
      });
      h.appendChild(btn);
    });
  }

  function decorateParagraphs(content) {
    if (content.getAttribute("data-tts-para") === "1") return;
    content.setAttribute("data-tts-para", "1");
    content.addEventListener("click", function (e) {
      var p = e.target.closest ? e.target.closest(".p") : null;
      if (!p || !content.contains(p)) return;
      if (e.target.closest && e.target.closest(".tts-btn")) return;
      if (p.querySelector("img") && !nodeReadableText(p)) return;
      var text = nodeReadableText(p);
      if (!text) return;
      e.preventDefault();
      speakNow(text, p);
    });
    $$(".p", content).forEach(function (p) {
      if (p.querySelector("img") && !nodeReadableText(p)) {
        p.classList.add("tts-no-speak");
        return;
      }
      p.classList.add("tts-clickable");
      p.title = "点击朗读本段";
    });
  }

  function initWorldTts() {
    var content = worldContent();
    if (!content) return;
    ensureToolbar(content);
    decorateHeadings(content);
    decorateParagraphs(content);
    updateToolbarState();
  }

  function onViewChange() {
    var view = document.body.getAttribute("data-help-view") || "rules";
    if (view !== "world") {
      stopAll();
    } else {
      initWorldTts();
    }
  }

  function hookPager() {
    // Observe body attribute set by pager script
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName === "data-help-view") {
          onViewChange();
          break;
        }
      }
    });
    obs.observe(document.body, { attributes: true });
    $$(".help-pager button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        // pager sets attribute sync; also stop immediately on leaving world
        setTimeout(onViewChange, 0);
      });
    });
  }

  function boot() {
    if (inited) return;
    inited = true;
    if (!synth) {
      // Still init UI so user sees why it fails when clicking
    } else if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = function () {
        pickVoice();
      };
    }
    pickVoice();
    hookPager();
    initWorldTts();
    onViewChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Expose for debugging / pager hooks
  window.HelpWorldTts = {
    stop: stopAll,
    speakFull: speakFull,
    init: initWorldTts,
  };
})();
