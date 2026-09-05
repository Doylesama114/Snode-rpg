(function() {
    var MARK_META = [
        { hex: "#FF0000", name: "红", light: false },
        { hex: "#E54C5E", name: "玫红", light: false },
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
        { hex: "#D9D9D9", name: "无", light: true }
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
        var aliases = { "#808080": "#595959", "#F79646": "#EE822F", "#FF66CC": "#FFB7E3", "#851321": "#843F0B" };
        h = normHex(h);
        return aliases[h] || h;
    }

    var TYPE_HEADS = ["战技", "法术", "戏法", "天赋", "功法", "能力", "战术"];

    function readTags(article) {
        var tags = [];
        var raw = article.getAttribute("data-tags");
        if (raw) {
            tags = raw.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
        } else {
            article.querySelectorAll(".chips .chip").forEach(function(chip) {
                var txt = chip.textContent.trim();
                if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
                tags.push(txt);
            });
        }
        // 补充类型头（与 filter.js 一致）
        article.querySelectorAll(".chips .chip").forEach(function(chip) {
            var txt = chip.textContent.trim();
            if (TYPE_HEADS.indexOf(txt) >= 0 && tags.indexOf(txt) === -1) tags.push(txt);
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
        this.markMode = "or";
        this.listeners = [];
        this.allTags = [];
        this.allColors = [];
        this.tagCount = {};
        this.typeTags = [];
        this.regularTags = [];
        this.kwFilter = "";
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
            colors: this.colors,
            markMode: this.markMode
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

    FilterPanel.prototype.setMarkMode = function(mode) {
        if (mode !== "and" && mode !== "or") return;
        if (this.markMode === mode) return;
        this.markMode = mode;
        this.syncMarkModeStyles();
        this.notify();
    };

    FilterPanel.prototype.clear = function() {
        this.keywords.clear();
        this.colors.clear();
        this.syncChipStyles();
        this.syncColorStyles();
        this.syncMarkModeStyles();
        this.notify();
    };

    FilterPanel.prototype.hasActive = function() {
        return this.keywords.size > 0 || this.colors.size > 0;
    };

    FilterPanel.prototype.scanPage = function() {
        var self = this;
        var tagCount = {};
        var colorSet = new Set();
        document.querySelectorAll("article.skill").forEach(function(article) {
            readTags(article).forEach(function(t) {
                tagCount[t] = (tagCount[t] || 0) + 1;
            });
            readMarks(article).forEach(function(c) { colorSet.add(c); });
        });
        this.tagCount = tagCount;
        this.allTags = Object.keys(tagCount).sort(function(a, b) {
            return a.localeCompare(b, "zh-CN");
        });
        // 类型头组（固定顺序）与常规组（按频次降序）
        this.typeTags = TYPE_HEADS.filter(function(t) { return tagCount[t]; });
        this.regularTags = this.allTags.filter(function(t) { return TYPE_HEADS.indexOf(t) === -1; })
            .sort(function(a, b) {
                var d = (tagCount[b] || 0) - (tagCount[a] || 0);
                return d !== 0 ? d : a.localeCompare(b, "zh-CN");
            });
        this.presentColors = colorSet;
        this.allColors = MARK_META.map(function(m) { return canonicalizeMarkHex(m.hex); });
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

    FilterPanel.prototype.syncMarkModeStyles = function() {
        var self = this;
        if (!this.root) return;
        this.root.querySelectorAll(".fp-mark-mode-btn").forEach(function(btn) {
            var active = btn.getAttribute("data-mark-mode") === self.markMode;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
        var tag = this.root.querySelector(".fp-mark-mode-tag");
        if (tag) tag.textContent = "标识 · " + (self.markMode === "and" ? "AND" : "OR");
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
        if (self.colors.size > 0) {
            var modeTag = document.createElement("span");
            modeTag.className = "fp-active-tag fp-mark-mode-tag";
            modeTag.textContent = "标识 · " + (self.markMode === "and" ? "AND" : "OR");
            box.appendChild(modeTag);
        }
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

    FilterPanel.prototype.makeKwChip = function(kw) {
        var self = this;
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "fp-kw-chip";
        chip.setAttribute("data-kw", kw);
        var name = document.createElement("span");
        name.className = "fp-kw-name";
        name.textContent = kw;
        chip.appendChild(name);
        var cnt = document.createElement("em");
        cnt.className = "fp-kw-count";
        cnt.textContent = String(this.tagCount[kw] || 0);
        chip.appendChild(cnt);
        chip.addEventListener("click", function(e) {
            e.stopPropagation();
            self.toggleKeyword(kw);
        });
        return chip;
    };

    FilterPanel.prototype.renderKeywordList = function() {
        if (!this.root) return;
        var filter = this.kwFilter || "";
        var chips = this.root.querySelectorAll(".fp-kw-chip");
        for (var i = 0; i < chips.length; i++) {
            var kw = chips[i].getAttribute("data-kw") || "";
            chips[i].classList.toggle("fp-hidden", filter.length > 0 && kw.toLowerCase().indexOf(filter) === -1);
        }
        // 组内无可见 chip 时整组隐藏
        var groups = this.root.querySelectorAll(".fp-group");
        for (var g = 0; g < groups.length; g++) {
            var vis = Array.prototype.some.call(groups[g].querySelectorAll(".fp-kw-chip"), function(c) {
                return !c.classList.contains("fp-hidden");
            });
            groups[g].classList.toggle("fp-empty", !vis);
        }
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

            // 面板内关键词搜索框
            var kwSearch = document.createElement("input");
            kwSearch.type = "search";
            kwSearch.className = "fp-kw-search";
            kwSearch.placeholder = "\u641c\u7d22\u5173\u952e\u8bcd\u2026";
            kwSearch.addEventListener("input", function() {
                self.kwFilter = this.value.trim().toLowerCase();
                self.renderKeywordList();
            });
            kwSec.appendChild(kwSearch);

            var typeGroup = document.createElement("div");
            typeGroup.className = "fp-group";
            typeGroup.innerHTML = '<button type="button" class="fp-group-title"><span class="fp-group-arrow">\u25be</span>\u7c7b\u578b<em class="fp-kw-count">' + this.typeTags.length + '</em></button>';
            var typeWrap = document.createElement("div");
            typeWrap.className = "fp-kw-list";
            this.typeTags.forEach(function(kw) {
                typeWrap.appendChild(self.makeKwChip(kw));
            });
            typeGroup.appendChild(typeWrap);

            var regGroup = document.createElement("div");
            regGroup.className = "fp-group";
            regGroup.innerHTML = '<button type="button" class="fp-group-title"><span class="fp-group-arrow">\u25be</span>\u5176\u4ed6\u5173\u952e\u8bcd<em class="fp-kw-count">' + this.regularTags.length + '</em></button>';
            var regWrap = document.createElement("div");
            regWrap.className = "fp-kw-list";
            this.regularTags.forEach(function(kw) {
                regWrap.appendChild(self.makeKwChip(kw));
            });
            regGroup.appendChild(regWrap);

            // 组折叠
            [typeGroup, regGroup].forEach(function(g) {
                g.querySelector(".fp-group-title").addEventListener("click", function() {
                    g.classList.toggle("fp-collapsed");
                });
            });

            kwSec.appendChild(typeGroup);
            kwSec.appendChild(regGroup);
            body.appendChild(kwSec);
            this._kwGroups = [typeGroup, regGroup];
        }

        if (this.allColors.length) {
            var colSec = document.createElement("div");
            colSec.className = "fp-section";
            colSec.innerHTML = '<div class="fp-section-title">色彩标识</div>';
            var modeBar = document.createElement("div");
            modeBar.className = "fp-mark-mode";
            modeBar.setAttribute("role", "group");
            modeBar.setAttribute("aria-label", "色彩标识匹配方式");
            [["or", "OR · 任一"], ["and", "AND · 全部"]].forEach(function(item) {
                var mb = document.createElement("button");
                mb.type = "button";
                mb.className = "fp-mark-mode-btn" + (self.markMode === item[0] ? " active" : "");
                mb.setAttribute("data-mark-mode", item[0]);
                mb.setAttribute("aria-pressed", self.markMode === item[0] ? "true" : "false");
                mb.textContent = item[1];
                mb.addEventListener("click", function(e) {
                    e.stopPropagation();
                    self.setMarkMode(item[0]);
                });
                modeBar.appendChild(mb);
            });
            colSec.appendChild(modeBar);
            var colWrap = document.createElement("div");
            colWrap.className = "fp-color-list";
            var self2 = this;
            this.allColors.forEach(function(hex) {
                hex = canonicalizeMarkHex(hex);
                var meta = metaByHex[hex] || { hex: hex, name: hex.replace("#", ""), light: false };
                var missing = !self2.presentColors.has(hex);
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "fp-color-btn" + (meta.light ? " light" : "") + (missing ? " fp-color-missing" : "");
                btn.setAttribute("data-color", hex);
                btn.title = meta.name + "\u8272" + (missing ? "\uff08\u672c\u9875\u65e0\u8be5\u8272\u6807\u8bc6\uff09" : "");
                btn.innerHTML = '<span class="fp-dot" style="color:' + meta.hex + '">\u25cf</span><span class="fp-color-name">' + meta.name + "</span>";
                btn.addEventListener("click", function(e) {
                    e.stopPropagation();
                    if (self2.presentColors.has(hex)) self2.toggleColor(hex);
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
        this.syncMarkModeStyles();
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
