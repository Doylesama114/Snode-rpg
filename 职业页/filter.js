(function() {
    window.__filterControllers = window.__filterControllers || {};

    function q(sel) {
        return document.querySelectorAll(sel);
    }
    function q1(sel) {
        return document.querySelector(sel);
    }

    function FilterController(viewId, prefix) {
        var self = this;
        this.viewId = viewId;
        this.prefix = prefix;
        this.fb = q1("#" + prefix + "-filter-bar");
        this.sr = q1("#" + prefix + "-search");
        this.em = q1("#" + prefix + "-empty");
        this.af = new Set();

        if (!this.fb || !this.sr) return;

        // Chip clicks
        q(".chips .chip").forEach(function(chip) {
            chip.addEventListener("click", function(e) {
                e.stopPropagation();
                var txt = this.textContent.trim();
                if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
                if (self.af.has(txt)) {
                    self.af.delete(txt);
                } else {
                    self.af.add(txt);
                }
                self.updateChips();
                self.renderFilters();
            });
        });

        // Search input
        this.sr.addEventListener("input", function() {
            self.applySearch();
        });

        // Collapse nav button
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

        this.updateChips();
        console.log("FilterController init for " + viewId + " prefix=" + prefix + " OK");
    }

    FilterController.prototype.updateChips = function() {
        var self = this;
        q(".chips .chip").forEach(function(c) {
            var txt = c.textContent.trim();
            if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
            if (self.af.has(txt)) {
                c.classList.add("filter-active");
                c.classList.remove("filter-inactive");
            } else if (self.af.size > 0) {
                c.classList.remove("filter-active");
                c.classList.add("filter-inactive");
            } else {
                c.classList.remove("filter-active", "filter-inactive");
            }
        });
    };

    FilterController.prototype.renderFilters = function() {
        var self = this;
        var fb = this.fb;
        var em = this.em;
        if (!fb) return;
        fb.innerHTML = "";
        if (this.af.size === 0) {
            q(".chip").forEach(function(c) {
                c.classList.remove("filter-active");
                c.classList.add("filter-inactive");
            });
            q(".skill, .skill-link, .nav-tier, .nav-group, .style-link, .tier-list a").forEach(function(el) {
                el.classList.remove("filter-hidden");
            });
            if (em) em.classList.add("hidden");
            return;
        }
        this.af.forEach(function(kw) {
            var tag = document.createElement("span");
            tag.className = "filter-tag";
            tag.textContent = kw;
            var rm = document.createElement("span");
            rm.className = "remove";
            rm.textContent = "\u00d7";
            rm.style.cursor = "pointer";
            rm.addEventListener("click", function() {
                tag.classList.add("removing");
                setTimeout(function() {
                    self.af.delete(kw);
                    self.updateChips();
                    self.renderFilters();
                }, 200);
            });
            tag.appendChild(rm);
            fb.appendChild(tag);
        });
        self.applyFilters();
    };

    FilterController.prototype.applyFilters = function() {
        var self = this;
        var hasFilter = this.af.size > 0;
        if (!hasFilter) { if (this.em) this.em.classList.add("hidden"); return; }

        q("article.skill").forEach(function(skill) {
            var kws = [];
            skill.querySelectorAll(".chips .chip").forEach(function(c) {
                var txt = c.textContent.trim();
                if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
                kws.push(txt);
            });
            var match = true;
            self.af.forEach(function(kw) { if (kws.indexOf(kw) === -1) match = false; });
            skill.classList.toggle("filter-hidden", !match);
        });

        q("a.skill-link").forEach(function(link) {
            var href = link.getAttribute("href");
            if (!href) return;
            var el = document.getElementById(href.replace("#", ""));
            if (!el) return;
            var kws = [];
            el.querySelectorAll(".chips .chip").forEach(function(c) {
                var txt = c.textContent.trim();
                if (txt.indexOf("\u98ce\u683c") >= 0 || txt.indexOf("\u5929\u8d4b\u6811") >= 0) return;
                kws.push(txt);
            });
            var m = kws.length > 0;
            self.af.forEach(function(k) { if (kws.indexOf(k) === -1) m = false; });
            link.classList.toggle("filter-hidden", !m);
        });

        q(".nav-tier").forEach(function(nt) {
            var vis = Array.from(nt.querySelectorAll("a.skill-link")).some(function(a) { return !a.classList.contains("filter-hidden"); });
            nt.classList.toggle("filter-hidden", !vis);
        });

        q(".nav-group").forEach(function(ng) {
            var vis = Array.from(ng.querySelectorAll(".nav-tier")).some(function(t) { return !t.classList.contains("filter-hidden"); });
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

        this.updateChips();
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
