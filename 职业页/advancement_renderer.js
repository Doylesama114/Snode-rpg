// Shared advancement detail renderer — generates article.skill cards
// Replaces inline buildHTML() + formatDetailText() in all 14 *进阶.html files

function renderSkillTableCard(tbl) {
    if (!tbl || tbl.length === 0) return "";
    if (!Array.isArray(tbl)) {
        // prose segment inserted between nested skills
        if (tbl.prose) {
            return "<div class=\"detail nested-prose\"><p>" + tbl.prose + "</p></div>";
        }
        return "";
    }
    var skillName = (tbl[0] && tbl[0][0]) ? tbl[0][0] : "";
    var h = "<article class=\"skill\">";
    h += "<h4>" + skillName + " <span class=\"chip\" style=\"background:var(--muted);color:#fff;font-size:11px\">\u8fdb\u9636\u00b7\u6280\u80fd</span></h4>";
    h += "<div class=\"detail\">";
    for (var ri = 1; ri < tbl.length; ri++) {
        var row = tbl[ri];
        for (var ci = 0; ci < row.length; ci++) {
            var cell = row[ci];
            var idx = cell.indexOf("\uff1a");
            if (idx > 0) {
                h += "<p><span class=\"field\">" + cell.substring(0, idx + 1) + "</span>" + cell.substring(idx + 1) + "</p>";
            } else {
                h += "<p>" + cell + "</p>";
            }
        }
    }
    h += "</div></article>";
    return h;
}

function renderNestedSkills(list) {
    if (!list || !list.length) return "";
    var h = "";
    for (var i = 0; i < list.length; i++) {
        h += renderSkillTableCard(list[i]);
    }
    return h;
}

function buildHTML(d) {
    var h = "";

    // Description (unchanged)
    if (d.desc_html) h += "<div class=\"detail-desc\">" + d.desc_html + "</div>";
    else if (d.description) h += "<div class=\"detail-desc\">" + d.description + "</div>";

    // Images (unchanged)
    if (d.image_markers) {
        var firstImgs = d.image_markers.filter(function(m) { return m.para_index === 825; });
        if (firstImgs.length > 0) {
            h += "<div class=\"detail-images\">";
            firstImgs.forEach(function(m, idx) {
                h += "<div class=\"img-item\">";
                h += "<img src=\"" + m.image + "\" alt=\"img\" onclick=\"this.classList.toggle('zoomed')\" />";
                h += "<div class=\"img-caption\">\u56fe\u7247" + (idx+1) + "</div></div>";
            });
            h += "</div>";
        }
    }

    // Abilities → article.skill cards (+ nested skills immediately after each)
    if (d.abilities && d.abilities.length > 0) {
        d.abilities.forEach(function(a, ai) {
            h += "<article class=\"skill\">";
            h += "<h4>" + a.name + " <span class=\"chip\" style=\"background:var(--muted);color:#fff;font-size:11px\">\u8fdb\u9636\u00b7\u5929\u8d4b</span></h4>";
            if (a.tags) {
                h += "<div class=\"chips\">";
                a.tags.split(".").forEach(function(t) {
                    if (t.trim()) h += "<span class=\"chip\" data-kw=\"" + t.trim() + "\">" + t.trim() + "</span>";
                });
                h += "</div>";
            }
            var descContent = a.desc_html || a.desc || "";
            h += "<div class=\"detail\"><p>" + descContent + "</p></div>";
            h += "</article>";

            h += renderNestedSkills(a.nested_skills);

            // Image markers within abilities (怪物 only)
            if (d.image_markers && d.name === "\u602a\u7269") {
                var sectionImgs = null;
                if (ai === 0) {
                    sectionImgs = d.image_markers.filter(function(m) { return m.para_index >= 843 && m.para_index <= 849; });
                }
                if (sectionImgs && sectionImgs.length > 0) {
                    h += "<div class=\"detail-images\">";
                    sectionImgs.forEach(function(m, idx) {
                        h += "<div class=\"img-item\">";
                        h += "<img src=\"" + m.image + "\" alt=\"img\" onclick=\"this.classList.toggle('zoomed')\" />";
                        h += "<div class=\"img-caption\">\u56fe\u7247" + (idx+1) + "</div></div>";
                    });
                    h += "</div>";
                }
            }
        });
    }

    // Residual top-level tables (e.g. preserved 怪物 2D parts) — after abilities, before insight
    if (d.tables && d.tables.length > 0) {
        d.tables.forEach(function(tbl) {
            if (tbl.length && tbl[0] && tbl[0].length > 1) {
                h += "<div class=\"detail-table-wrap\"><table class=\"detail-table\">";
                tbl.forEach(function(row, ri) {
                    h += "<tr>";
                    row.forEach(function(cell) {
                        var tag = (ri === 0) ? "th" : "td";
                        h += "<" + tag + ">" + cell + "</" + tag + ">";
                    });
                    h += "</tr>";
                });
                h += "</table></div>";
            } else {
                h += renderSkillTableCard(tbl);
            }
        });
    }

    // Insight → article.skill card (+ nested skills after)
    if (d.insight) {
        h += "<article class=\"skill\">";
        h += "<h4>" + d.insight.name + " <span class=\"chip\" style=\"background:var(--muted);color:#fff;font-size:11px\">\u8fdb\u9636\u00b7\u5fc3\u5f97</span></h4>";
        if (d.insight.tags) {
            h += "<div class=\"chips\">";
            d.insight.tags.split(".").forEach(function(t) {
                if (t.trim()) h += "<span class=\"chip\" data-kw=\"" + t.trim() + "\">" + t.trim() + "</span>";
            });
            h += "</div>";
        }
        var insContent = d.insight.desc_html || d.insight.desc || "";
        h += "<div class=\"detail\"><p>" + insContent + "</p></div>";
        h += "</article>";
        h += renderNestedSkills(d.insight.nested_skills);
    }

    return h;
}

function formatDetailText(container) {
    var raw = container.innerHTML;
    raw = raw.replace(/\n/g, "<br>");
    container.innerHTML = raw;
}
