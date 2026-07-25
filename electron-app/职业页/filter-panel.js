(function() {
    var MARK_META = [
        { hex: "#FF0000", name: "红", light: false },
        { hex: "#EE822F", name: "橙", light: false },
        { hex: "#FFF32F", name: "黄", light: true },
        { hex: "#00B050", name: "绿", light: false },
        { hex: "#00FA99", name: "青", light: true },
        { hex: "#00B0F0", name: "蓝", light: false },
        { hex: "#B3F9FF", name: "浅", light: true },
        { hex: "#B94BFF", name: "紫", light: false },
        { hex: "#FFB7E3", name: "粉", light: true },
        { hex: "#843F0B", name: "棕", light: false },
        { hex: "#FFFFFF", name: "白", light: true },
        { hex: "#595959", name: "黑", light: false },
        { hex: "#D9D9D9", name: "无", light: true },
        { hex: "#851321", name: "无", light: false }
    ];
    var metaByHex = {};
    MARK_META.forEach(function(m) { metaByHex[m.hex.toUpperCase()] = m; });

    window.getMarkColorName = function(hex) {
        var m = metaByHex[canonicalizeMarkHex(hex)];
        return m ? m.name : canonicalizeMarkHex(hex).replace("#", "");
    };

    function normHex(h) {
        if (window.snowdNormHex) return window.snowdNormHex(h);
        if (!h) return "";
        h = h.trim().toUpperCase();
        if (!h.startsWith("#")) h = "#" + h;
        return h;
    }

    function canonicalizeMarkHex(h) {
        if (window.snowdCanonicalizeMarkHex) return window.snowdCanonicalizeMarkHex(h);
        var aliases = { "#808080": "#595959", "#F79646": "#EE822F", "#FF66CC": "#FFB7E3" };
        h = normHex(h);
        return aliases[h] || h;
    }

    function readTags(article) {
        var raw = article.getAttribute("data-tags");
        if (raw) {
            return raw.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
        }
        var tags = [];
        article.querySelectorAll(".chips .chip").forEach(function(chip) {
            var txt = chip.textContent.trim();
            if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
            tags.push(txt);
        });
        return tags;
    }

    function readMarks(article) {
        var raw = article.getAttribute("data-marks");
        if (raw) {
            return raw.split(",").map(canonicalizeMarkHex).filter(Boolean);
        }
        var marks = [];
        article.querySelectorAll('.detail span[style*="color:"]').forEach(function(span) {
            if (span.textContent.indexOf("\u25cf") === -1 && span.textContent.indexOf("●") === -1) return;
            var m = span.getAttribute("style").match(/color:\s*(#[0-9A-Fa-f]{3,8})/);
            if (m) marks.push(canonicalizeMarkHex(m[1]));
        });
        return marks;
    }

    function FilterPanel() {
        this.keywords = new Set();
        this.colors = new Set();
        this.listeners = [];
        this.allTags = [];
        this.allColors = [];
        this.root = null;
        this.expanded = false;
    }

    FilterPanel.prototype.onChange = function(fn) {
        this.listeners.push(fn);
    };

    FilterPanel.prototype.notify = function() {
        var self = this;
        this.listeners.forEach(function(fn) { fn(self.getState()); });
        this.renderActive();
        this.updateBadge();
    };

    FilterPanel.prototype.getState = function() {
        return {
            keywords: this.keywords,
            colors: this.colors
        };
    };

    FilterPanel.prototype.toggleKeyword = function(kw) {
        if (this.keywords.has(kw)) this.keywords.delete(kw);
        else this.keywords.add(kw);
        this.syncChipStyles();
        this.notify();
    };

    FilterPanel.prototype.toggleColor = function(hex) {
        hex = canonicalizeMarkHex(hex);
        if (this.colors.has(hex)) this.colors.delete(hex);
        else this.colors.add(hex);
        this.syncColorStyles();
        this.notify();
    };

    FilterPanel.prototype.clear = function() {
        this.keywords.clear();
        this.colors.clear();
        this.syncChipStyles();
        this.syncColorStyles();
        this.notify();
    };

    FilterPanel.prototype.hasActive = function() {
        return this.keywords.size > 0 || this.colors.size > 0;
    };

    FilterPanel.prototype.scanPage = function() {
        var tagSet = new Set();
        var colorSet = new Set();
        document.querySelectorAll("article.skill").forEach(function(article) {
            readTags(article).forEach(function(t) { tagSet.add(t); });
            readMarks(article).forEach(function(c) { colorSet.add(c); });
        });
        this.allTags = Array.from(tagSet).sort(function(a, b) {
            return a.localeCompare(b, "zh-CN");
        });
        this.allColors = Array.from(colorSet).sort();
    };

    FilterPanel.prototype.syncChipStyles = function() {
        var self = this;
        document.querySelectorAll(".chips .chip").forEach(function(chip) {
            var txt = chip.textContent.trim();
            if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
            chip.classList.toggle("filter-active", self.keywords.has(txt));
            chip.classList.toggle("filter-inactive", self.keywords.size > 0 && !self.keywords.has(txt));
        });
        if (this.root) {
            this.root.querySelectorAll(".fp-kw-chip").forEach(function(chip) {
                chip.classList.toggle("active", self.keywords.has(chip.getAttribute("data-kw")));
            });
        }
    };

    FilterPanel.prototype.syncColorStyles = function() {
        var self = this;
        if (!this.root) return;
        this.root.querySelectorAll(".fp-color-btn").forEach(function(btn) {
            btn.classList.toggle("active", self.colors.has(canonicalizeMarkHex(btn.getAttribute("data-color"))));
        });
    };

    FilterPanel.prototype.updateBadge = function() {
        if (!this.root) return;
        var badge = this.root.querySelector(".fp-badge");
        var n = this.keywords.size + this.colors.size;
        if (badge) {
            badge.textContent = n > 0 ? String(n) : "";
            badge.style.display = n > 0 ? "inline-flex" : "none";
        }
    };

    FilterPanel.prototype.renderActive = function() {
        if (!this.root) return;
        var box = this.root.querySelector(".fp-active");
        if (!box) return;
        box.innerHTML = "";
        var self = this;
        if (!this.hasActive()) {
            box.classList.add("empty");
            return;
        }
        box.classList.remove("empty");
        this.keywords.forEach(function(kw) {
            box.appendChild(self.makeActiveTag(kw, "kw"));
        });
        this.colors.forEach(function(hex) {
            var meta = metaByHex[hex] || { name: hex, hex: hex };
            box.appendChild(self.makeActiveTag(meta.name + " \u25cf", "color", hex));
        });
    };

    FilterPanel.prototype.makeActiveTag = function(label, kind, value) {
        var self = this;
        var tag = document.createElement("span");
        tag.className = "fp-active-tag";
        tag.textContent = label;
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "fp-active-rm";
        rm.textContent = "\u00d7";
        rm.setAttribute("aria-label", "\u79fb\u9664");
        rm.addEventListener("click", function(e) {
            e.stopPropagation();
            if (kind === "kw") self.toggleKeyword(label.replace(" \u25cf", ""));
            else self.toggleColor(value);
        });
        tag.appendChild(rm);
        return tag;
    };

    FilterPanel.prototype.buildUI = function() {
        var self = this;
        this.scanPage();

        var root = document.createElement("div");
        root.id = "snowd-filter-panel";
        root.className = "fp-root collapsed";

        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "fp-toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = '<span class="fp-toggle-icon">\u2699</span><span class="fp-toggle-label">\u7b5b\u9009</span><span class="fp-badge"></span>';

        var body = document.createElement("div");
        body.className = "fp-body";

        var head = document.createElement("div");
        head.className = "fp-head";
        head.innerHTML = '<span class="fp-title">\u6280\u80fd\u7b5b\u9009</span>';
        var clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "fp-clear";
        clearBtn.textContent = "\u6e05\u7a7a";
        clearBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            self.clear();
        });
        head.appendChild(clearBtn);
        body.appendChild(head);

        if (this.allTags.length) {
            var kwSec = document.createElement("div");
            kwSec.className = "fp-section";
            kwSec.innerHTML = '<div class="fp-section-title">\u5173\u952e\u8bcd</div>';
            var kwWrap = document.createElement("div");
            kwWrap.className = "fp-kw-list";
            this.allTags.forEach(function(kw) {
                var chip = document.createElement("button");
                chip.type = "button";
                chip.className = "fp-kw-chip";
                chip.setAttribute("data-kw", kw);
                chip.textContent = kw;
                chip.addEventListener("click", function(e) {
                    e.stopPropagation();
                    self.toggleKeyword(kw);
                });
                kwWrap.appendChild(chip);
            });
            kwSec.appendChild(kwWrap);
            body.appendChild(kwSec);
        }

        if (this.allColors.length) {
            var colSec = document.createElement("div");
            colSec.className = "fp-section";
            colSec.innerHTML = '<div class="fp-section-title">\u8272\u5f69\u6807\u8bc6</div><div class="fp-color-hint">\u5305\u542b\u4efb\u4e00\u9009\u4e2d\u8272</div>';
            var colWrap = document.createElement("div");
            colWrap.className = "fp-color-list";
            this.allColors.forEach(function(hex) {
                hex = canonicalizeMarkHex(hex);
                var meta = metaByHex[hex] || { hex: hex, name: hex.replace("#", ""), light: false };
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "fp-color-btn" + (meta.light ? " light" : "");
                btn.setAttribute("data-color", hex);
                btn.title = meta.name + "\u8272";
                btn.innerHTML = '<span class="fp-dot" style="color:' + meta.hex + '">\u25cf</span><span class="fp-color-name">' + meta.name + "</span>";
                btn.addEventListener("click", function(e) {
                    e.stopPropagation();
                    self.toggleColor(hex);
                });
                colWrap.appendChild(btn);
            });
            colSec.appendChild(colWrap);
            body.appendChild(colSec);
        }

        if (!this.allTags.length && !this.allColors.length) {
            body.innerHTML += '<p class="fp-empty-hint">\u672c\u9875\u6682\u65e0\u53ef\u7b5b\u9009\u9879</p>';
        }

        var active = document.createElement("div");
        active.className = "fp-active empty";
        body.appendChild(active);

        root.appendChild(toggle);
        root.appendChild(body);

        toggle.addEventListener("click", function(e) {
            e.stopPropagation();
            self.expanded = !self.expanded;
            root.classList.toggle("collapsed", !self.expanded);
            toggle.setAttribute("aria-expanded", self.expanded ? "true" : "false");
        });

        document.addEventListener("click", function(e) {
            if (!self.expanded) return;
            if (root.contains(e.target)) return;
            self.expanded = false;
            root.classList.add("collapsed");
            toggle.setAttribute("aria-expanded", "false");
        });

        document.body.appendChild(root);
        this.root = root;
        this.renderActive();
        this.updateBadge();
    };

    window.__filterPanel = null;

    window.initFilterPanel = function() {
        if (window.__filterPanel) return window.__filterPanel;
        if (!document.querySelector("article.skill")) return null;
        var panel = new FilterPanel();
        panel.buildUI();
        window.__filterPanel = panel;
        return panel;
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", window.initFilterPanel);
    } else {
        window.initFilterPanel();
    }
})();
