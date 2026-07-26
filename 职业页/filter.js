(function() {
    window.__filterControllers = window.__filterControllers || {};

    function q(sel) {
        return document.querySelectorAll(sel);
    }
    function q1(sel) {
        return document.querySelector(sel);
    }

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

    function readTagsFromSkill(skill) {
        var raw = skill.getAttribute("data-tags");
        if (raw) {
            return raw.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
        }
        var kws = [];
        skill.querySelectorAll(".chips .chip").forEach(function(c) {
            var txt = c.textContent.trim();
            if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
            kws.push(txt);
        });
        return kws;
    }

    function readMarksFromSkill(skill) {
        var raw = skill.getAttribute("data-marks");
        if (raw) {
            return raw.split(",").map(canonicalizeMarkHex).filter(Boolean);
        }
        var marks = [];
        skill.querySelectorAll('.detail span[style*="color:"]').forEach(function(span) {
            if (span.textContent.indexOf("\u25cf") === -1 && span.textContent.indexOf("●") === -1) return;
            var m = span.getAttribute("style").match(/color:\s*(#[0-9A-Fa-f]{3,8})/);
            if (m) marks.push(canonicalizeMarkHex(m[1]));
        });
        return marks;
    }

    function FilterController(viewId, prefix) {
        var self = this;
        this.viewId = viewId;
        this.prefix = prefix;
        this.fb = q1("#" + prefix + "-filter-bar");
        this.sr = q1("#" + prefix + "-search");
        this.em = q1("#" + prefix + "-empty");

        if (!this.sr) return;

        q(".chips .chip").forEach(function(chip) {
            chip.addEventListener("click", function(e) {
                e.stopPropagation();
                var txt = this.textContent.trim();
                if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
                var panel = window.__filterPanel;
                if (panel) panel.toggleKeyword(txt);
            });
        });

        this.sr.addEventListener("input", function() {
            self.applySearch();
        });

        var navInner = q1(".nav-inner");
        if (navInner && !navInner.querySelector(".collapse-nav-btn")) {
            var btn = document.createElement("button");
            btn.textContent = "\u6536\u8d77\u76ee\u5f55";
            btn.className = "collapse-nav-btn";
            btn.style.cssText = "display:block;width:100%;padding:6px;margin-bottom:8px;border:1px solid var(--line);border-radius:5px;background:var(--panel);color:var(--muted);cursor:pointer;font-size:13px;font-weight:700;";
            navInner.insertBefore(btn, navInner.firstChild);
            var collapsed = false;
            btn.addEventListener("click", function() {
                collapsed = !collapsed;
                navInner.classList.toggle("nav-collapsed", collapsed);
                btn.textContent = collapsed ? "\u5c55\u5f00\u76ee\u5f55" : "\u6536\u8d77\u76ee\u5f55";
            });
        }

        var panel = window.__filterPanel || (window.initFilterPanel && window.initFilterPanel());
        if (panel) {
            panel.onChange(function() {
                self.renderFilters();
            });
        }

        this.renderFilters();
    }

    FilterController.prototype.getFilterState = function() {
        var panel = window.__filterPanel;
        if (panel) return panel.getState();
        return { keywords: new Set(), colors: new Set() };
    };

    FilterController.prototype.skillMatchesFilters = function(skill) {
        var state = this.getFilterState();
        var kws = readTagsFromSkill(skill);
        var marks = readMarksFromSkill(skill);

        if (state.keywords.size > 0) {
            if (!kws.length) return false;
            var kwOk = true;
            state.keywords.forEach(function(kw) {
                if (kws.indexOf(kw) === -1) kwOk = false;
            });
            if (!kwOk) return false;
        }

        if (state.colors.size > 0) {
            if (!marks.length) return false;
            var colorOk = false;
            state.colors.forEach(function(c) {
                if (marks.indexOf(normHex(c)) !== -1) colorOk = true;
            });
            if (!colorOk) return false;
        }

        return true;
    };

    FilterController.prototype.renderFilters = function() {
        var self = this;
        var fb = this.fb;
        var em = this.em;
        var state = this.getFilterState();
        if (fb) {
            fb.innerHTML = "";
            state.keywords.forEach(function(kw) {
                fb.appendChild(self.makeFilterTag(kw, "kw"));
            });
            state.colors.forEach(function(hex) {
                fb.appendChild(self.makeFilterTag(hex, "color"));
            });
        }
        self.applyFilters();
    };

    FilterController.prototype.makeFilterTag = function(val, kind) {
        var self = this;
        var tag = document.createElement("span");
        tag.className = "filter-tag";
        tag.textContent = kind === "color"
            ? "\u25cf " + (window.getMarkColorName ? window.getMarkColorName(val) : val.replace("#", ""))
            : val;
        var rm = document.createElement("span");
        rm.className = "remove";
        rm.textContent = "\u00d7";
        rm.style.cursor = "pointer";
        rm.addEventListener("click", function() {
            tag.classList.add("removing");
            setTimeout(function() {
                var panel = window.__filterPanel;
                if (!panel) return;
                if (kind === "kw") panel.toggleKeyword(val);
                else panel.toggleColor(val);
            }, 200);
        });
        tag.appendChild(rm);
        return tag;
    };

    FilterController.prototype.applyFilters = function() {
        var self = this;
        var state = this.getFilterState();
        var hasFilter = state.keywords.size > 0 || state.colors.size > 0;
        if (!hasFilter) {
            q(".chip").forEach(function(c) {
                c.classList.remove("filter-active", "filter-inactive");
            });
            q(".skill, .skill-link, .nav-tier, .nav-group, .style-link, .tier-list a").forEach(function(el) {
                el.classList.remove("filter-hidden");
            });
            if (this.em) this.em.classList.add("hidden");
            return;
        }

        if (window.__filterPanel) window.__filterPanel.syncChipStyles();

        q("article.skill").forEach(function(skill) {
            skill.classList.toggle("filter-hidden", !self.skillMatchesFilters(skill));
        });

        q("a.skill-link").forEach(function(link) {
            var href = link.getAttribute("href");
            if (!href) return;
            var el = document.getElementById(href.replace("#", ""));
            if (!el) return;
            link.classList.toggle("filter-hidden", !self.skillMatchesFilters(el));
        });

        q(".nav-tier").forEach(function(nt) {
            var vis = Array.from(nt.querySelectorAll("a.skill-link")).some(function(a) {
                return !a.classList.contains("filter-hidden");
            });
            nt.classList.toggle("filter-hidden", !vis);
        });

        q(".nav-group").forEach(function(ng) {
            var vis = Array.from(ng.querySelectorAll(".nav-tier")).some(function(t) {
                return !t.classList.contains("filter-hidden");
            });
            ng.classList.toggle("filter-hidden", !vis);
            if (hasFilter && vis) ng.querySelectorAll("details").forEach(function(d) { d.open = true; });
        });

        q(".choice-note").forEach(function(note) {
            var next = note.nextElementSibling;
            while (next && !next.classList.contains("skill")) next = next.nextElementSibling;
            note.classList.toggle("filter-hidden", !(next && !next.classList.contains("filter-hidden")));
        });

        var any = q("article.skill:not(.filter-hidden)").length > 0;
        if (this.em) this.em.classList.toggle("hidden", any);
    };

    FilterController.prototype.applySearch = function() {
        var self = this;
        var em = this.em;
        if (!this.sr) return;

        this.renderFilters();

        _clearHighlights(this.viewId);
        var term = this.sr.value.trim().toLowerCase();

        q(".hidden").forEach(function(el) { el.classList.remove("hidden"); });

        if (!term) {
            if (em) em.classList.add("hidden");
            q("a.skill-link, .nav-tier, .nav-group").forEach(function(el) { el.classList.remove("hidden"); });
            return;
        }

        var terms = term.split(/\s+/).filter(function(t) { return t.length > 0; });
        var any = false;

        q(".skill").forEach(function(skill) {
            var data = (skill.getAttribute("data-search") || "").toLowerCase();
            var text = (skill.textContent || "").toLowerCase();
            var matchAll = terms.every(function(t) { return data.indexOf(t) !== -1 || text.indexOf(t) !== -1; });
            skill.classList.toggle("hidden", !matchAll);
            if (matchAll) any = true;
        });

        q(".tier").forEach(function(tier) {
            var matched = Array.from(tier.querySelectorAll(".skill")).some(function(s) { return !s.classList.contains("hidden"); });
            tier.classList.toggle("hidden", !matched);
        });

        q(".style").forEach(function(style) {
            var matched = Array.from(style.querySelectorAll(".skill")).some(function(s) { return !s.classList.contains("hidden"); });
            style.classList.toggle("hidden", !matched);
        });

        q("details").forEach(function(d) { d.open = true; });

        q("a.skill-link").forEach(function(link) {
            var el = document.getElementById(link.getAttribute("href").replace("#", ""));
            if (!el) return;
            link.classList.toggle("hidden", el.classList.contains("hidden"));
        });

        q(".nav-tier").forEach(function(nt) {
            var vis = Array.from(nt.querySelectorAll("a.skill-link:not(.hidden)")).length > 0;
            nt.classList.toggle("hidden", !vis);
        });

        q(".nav-group").forEach(function(ng) {
            var vis = Array.from(ng.querySelectorAll(".nav-tier:not(.hidden)")).length > 0;
            ng.classList.toggle("hidden", !vis);
        });

        if (em) em.classList.toggle("hidden", any);
        if (any) _applyHighlights(this.viewId, terms);
    };

    window.createFilterController = function(viewId, prefix) {
        var fc = new FilterController(viewId, prefix);
        window.__filterControllers[viewId] = fc;
        return fc;
    };
})();
