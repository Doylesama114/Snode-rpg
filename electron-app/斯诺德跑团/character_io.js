/* Shared character workbook I/O. DOM APIs are used only inside callable functions. */
var SNOWD_CHARACTER_IO = (function () {
  var NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  var REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  var PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
  var META = "_SNODE_META";
  function xml(text) {
    var d = new DOMParser().parseFromString(text, "application/xml");
    if (d.getElementsByTagName("parsererror").length) throw new Error("Excel XML 格式错误");
    return d;
  }
  function els(d, name) { return Array.prototype.slice.call(d.getElementsByTagNameNS("*", name)); }
  function child(n, name) {
    for (var i = 0; i < n.childNodes.length; i++) if (n.childNodes[i].localName === name) return n.childNodes[i];
    return null;
  }
  function textRuns(n) {
    if (!n) return "";
    // Phonetic annotations are not the displayed cell text.
    return els(n, "t").filter(function (t) { return !t.parentNode || t.parentNode.localName !== "rPh"; })
      .map(function (t) { return t.textContent; }).join("");
  }
  function sharedStrings(text) { return text ? els(xml(text), "si").map(textRuns) : []; }
  function colIndex(ref) {
    var m = String(ref).match(/^[A-Z]+/), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[0].length; i++) n = n * 26 + m[0].charCodeAt(i) - 64;
    return n - 1;
  }
  function colName(n) {
    var s = ""; n++;
    while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
    return s;
  }
  function sheet(text, strings) {
    var cells = {}, rawValues = {}, rows = [], formulas = {};
    var d = xml(text);
    els(d, "row").forEach(function (row, ri) {
      var values = [], rn = parseInt(row.getAttribute("r"), 10) || ri + 1;
      els(row, "c").forEach(function (c, ci) {
        var ref = c.getAttribute("r") || colName(ci) + rn;
        var v = child(c, "v"), type = c.getAttribute("t"), value = v ? v.textContent : "";
        if (type === "inlineStr") value = textRuns(child(c, "is"));
        else if (type === "s") {
          var ix = Number(value);
          if (!v || !Number.isInteger(ix) || ix < 0 || ix >= strings.length) throw new Error("共享字符串索引无效：" + ref);
          value = strings[ix];
        }
        cells[ref] = value; rawValues[ref] = value; values[colIndex(ref)] = value;
        if (child(c, "f")) formulas[ref] = { formula: child(c, "f").textContent, cached: !!v };
      });
      rows.push(values);
    });
    return { cells: cells, rawValues: rawValues, rows: rows, formulas: formulas };
  }
  function path(target, owner) {
    if (!target) return "";
    var absolute = target.charAt(0) === "/";
    var base = absolute ? "" : (owner || "xl/workbook.xml").replace(/[^/]+$/, "");
    // Some old files use xl/ in a relative target. Accept this historical form.
    if (target.indexOf("xl/") === 0) base = "";
    var parts = (base + target).split("/"), out = [];
    parts.forEach(function (p) {
      if (!p || p === ".") return;
      if (p === "..") out.pop(); else out.push(p);
    });
    return out.join("/");
  }
  function manifest(wbText, relText) {
    var w = xml(wbText), r = xml(relText), rels = els(r, "Relationship"), sheets = els(w, "sheet");
    var byId = {};
    rels.forEach(function (x) {
      var id = x.getAttribute("Id");
      if (byId[id] && byId[id].getAttribute("Target") !== x.getAttribute("Target")) throw new Error("工作表关系编号冲突：" + id);
      byId[id] = x;
    });
    return { wb: w, relDoc: r, rels: rels, sheets: sheets,
      list: sheets.map(function (s) {
        var rid = s.getAttributeNS(REL, "id") || s.getAttribute("r:id");
        var rr = byId[rid];
        return { name: s.getAttribute("name"), rid: rid, node: s, relation: rr,
          path: rr && rr.getAttribute("TargetMode") !== "External" ? path(rr.getAttribute("Target")) : "" };
      }) };
  }
  function readMeta(text, strings) {
    var parsed = sheet(text, strings || []), rows = parsed.rows, head = rows[0] || [], out = [];
    if (head.indexOf("uid") < 0 || head.indexOf("name") < 0 || head.indexOf("writtenToVisible") < 0)
      throw new Error("隐藏信息表缺少必需列");
    rows.slice(1).forEach(function (row) {
      var m = {};
      head.forEach(function (key, c) { if (key) m[key] = row[c] === undefined ? "" : row[c]; });
      if (!m.uid && !m.name) return;
      var version = m.metaVersion ? Number(m.metaVersion) : 1;
      if (version > 2) { var e = new Error("隐藏信息版本过新：" + version); e.unsupported = true; throw e; }
      if (version < 1 || !Number.isInteger(version)) throw new Error("隐藏信息版本无效");
      if (m.visibleBaseline) m._baseline = JSON.parse(m.visibleBaseline);
      if (m.entryJSON) m._entry = JSON.parse(m.entryJSON);
      if ((m._baseline && typeof m._baseline !== "object") || (m._entry && (typeof m._entry !== "object" || Array.isArray(m._entry))))
        throw new Error("隐藏信息条目格式错误");
      out.push(m);
    });
    var seen = {};
    out.forEach(function (m) {
      if (!m.uid || m.sheet === "__STATE__") return;
      if (seen[m.uid]) throw new Error("隐藏信息含重复 UID：" + m.uid);
      seen[m.uid] = true;
    });
    return out;
  }
  async function readWorkbook(buffer, readZip, readEntry) {
    var zip = await readZip(buffer);
    if (!zip["xl/workbook.xml"] || !zip["xl/_rels/workbook.xml.rels"]) throw new Error("文件不是有效的角色工作簿");
    var texts = await Promise.all(["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml"].map(function (p) {
      return zip[p] ? readEntry(zip, p) : "";
    }));
    var man = manifest(texts[0], texts[1]), strings = sharedStrings(texts[2]), candidates = [];
    for (var i = 0; i < man.list.length; i++) {
      var s = man.list[i];
      if (s.name === META || !s.path || !zip[s.path]) continue;
      var data = sheet(await readEntry(zip, s.path), strings), vals = Object.keys(data.cells).map(function (k) { return data.cells[k]; });
      var score = 0;
      ["角色名称", "种族", "主职业", "技能列表", "天赋"].forEach(function (label) {
        if (vals.some(function (v) { return String(v).indexOf(label) >= 0; })) score++;
      });
      if(data.cells.C4)score+=0.5;if(data.cells.B17)score+=0.25;
      if (score >= 4 && vals.some(function (v) { return String(v).indexOf("技能列表") >= 0; }))
        candidates.push({ item: s, data: data, score: score });
    }
    if (!candidates.length) throw new Error("未找到冒险者角色档案模板工作表");
    candidates.sort(function (a, b) { return b.score - a.score; });
    if (candidates.length > 1 && candidates[0].score === candidates[1].score) throw new Error("发现多个角色工作表，请保留一个角色模板后重试");
    var picked = candidates[0], meta = { status: "absent", rows: [], message: "" };
    var ms = man.list.filter(function (s) { return s.name === META; });
    if (ms.length) {
      try {
        if (ms.length !== 1 || !ms[0].path || !zip[ms[0].path]) throw new Error("隐藏信息表关联缺失或重复");
        meta.rows = readMeta(await readEntry(zip, ms[0].path), strings);
        meta.status = "ok";
      } catch (e) { meta.status = e.unsupported ? "unsupported" : "invalid"; meta.message = e.message; }
    }
    picked.data.strings = strings; picked.data.meta = meta;
    picked.data.sheetName = picked.item.name; picked.data.sheetPath = picked.item.path;
    return picked.data;
  }
  function tier(t) {
    var m = String(t || "").match(/([一二三四五六七1-7])阶/);
    return m ? (/^[1-7]$/.test(m[1]) ? "一二三四五六七".charAt(Number(m[1]) - 1) : m[1]) + "阶" : "";
  }
  function persistentKey(k) { return k.charAt(0)!=="_" || ["_persistOrig","_futureLowestLeft","_futureMigrated","_orig","_addedLanguages","_panelApplied","_attrGained"].indexOf(k)>=0; }
  function candidates(name) {
    var ix = typeof SNOWD_SKILL_INDEX !== "undefined" ? SNOWD_SKILL_INDEX : null;
    return ix && ix.byName[name] ? ix.byName[name].map(function (n) {
      var r = ix.rows[n];
      return { name: r[0], id: r[1], cls: r[2], kind: r[3], type: r[4], style: r[5], tier: tier(r[6]), isStarting: !!r[7] };
    }) : [];
  }
  function search(name) {
    name=String(name||"").trim();if(!name)return [];
    var ix=typeof SNOWD_SKILL_INDEX!=="undefined"?SNOWD_SKILL_INDEX:null;if(!ix)return [];
    var exact=candidates(name);if(exact.length)return exact;
    var names=Object.keys(ix.byName),hits=names.filter(function(n){return n.indexOf(name)>=0;});
    if(!hits.length){
      function distance(a,b){var prev=[],row=[],i,j;for(j=0;j<=b.length;j++)prev[j]=j;
        for(i=1;i<=a.length;i++){row=[i];for(j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));prev=row;}
        return prev[b.length];
      }
      hits=names.filter(function(n){return Math.abs(n.length-name.length)<=2&&distance(name,n)<=2;});
    }
    hits.sort(function(a,b){return a.length-b.length||a.localeCompare(b);});
    var out=[];hits.slice(0,24).forEach(function(n){out=out.concat(candidates(n));});return out.slice(0,24);
  }
  function resolve(e) {
    e = e || {};
    var all = candidates(e.n || e.name), source = e.src || e.cls || e.source || "";
    var filtered = all.filter(function (c) { return (!source || c.cls === source) && (!e.id || c.id === e.id); });
    if(!source&&e.rawCategory){
      var styled=filtered.filter(function(c){return c.style===e.rawCategory;});
      if(styled.length)filtered=styled;
    }
    // Stale ids never silently select another ability.
    return { all: all, candidates: filtered.length ? filtered : all,
      pick: filtered.length === 1 ? filtered[0] : null, exact: !!all.length,
      ambiguous: filtered.length > 1 || (!!all.length && !filtered.length), mismatch: !!all.length && !filtered.length };
  }
  function rawEntry(e, parsed, ref, region, place, visibleTier) {
    var c = parsed.cells, row = String(ref).replace(/^[A-Z]+/, ""), skill = region !== "talent";
    var ix=typeof SNOWD_SKILL_INDEX!=="undefined"?SNOWD_SKILL_INDEX:null;
    var rawSource=e.src||"";
    if(skill&&rawSource&&ix&&!ix.meta.perClass[rawSource]&&
      (ix.rows.some(function(r){return r[5]===rawSource;})||["法术","战技","法咒","神术","戏法","幻象","专注","回合限一"].indexOf(rawSource)>=0)){
      e.rawCategory=rawSource;e.src="";
    }
    e.cellRef = ref; e.region = region; e.place = place;
    e._visible = { name: e.n, src: skill ? c["I" + row] || "" : "", tier: skill ? "" : tier(visibleTier),
      tm: skill ? e.tm || "" : "", range: skill ? e.range || "" : "", dur: skill ? e.dur || "" : "",
      dr: skill ? e.dr || "" : "", ds: skill ? e.ds || "" : "", sheet: parsed.sheetName || "", cellRef: ref, region: region, place: place };
    return e;
  }
  function issue(state, e, kind, note, choices) {
    var obj = { uid: e && e.uid || "", name: e && (e.n || e.name) || "", kind: kind, note: note };
    if (choices) obj.candidates = choices;
    state.importIssues.push(obj);
  }
  function applyMeta(state, context) {
    var stats = { applied: 0, restored: 0, edited: 0 };
    var meta = context || state._xlsxMeta || { status: "absent", rows: [] };
    state.importIssues = Array.isArray(state.importIssues) ? state.importIssues : [];
    if (meta.status !== "ok") {
      if (meta.status !== "absent") issue(state, null, "metadata-" + meta.status, meta.message || "隐藏信息未能读取；已保留可见数据");
      return stats;
    }
    var entries = (state.skills || []).concat(state.talent_tree || []), used = [], rows = meta.rows || [], usedUID = {};
    rows.forEach(function (m) {
      if (m.sheet !== "__STATE__") return;
      try {
        if (m.name === "unlocked_tiers" || m.name === "extra_slots") {
          var a = JSON.parse(m.src || "[]");
          if (!Array.isArray(a) || a.some(function (v) { return !tier(v); })) throw new Error("阶位列表无效");
          state[m.name] = a;
        }
      } catch (e) { issue(state, null, "metadata-invalid", m.name + "：" + e.message); }
    });
    function compatible(e, m) {
      var v = e._visible || {}, base = m._baseline;
      if ((e.n || e.name) !== m.name) return false;
      if (v.src && v.src !== (base ? base.src || "" : m.src || "")) return false;
      return true;
    }
    function merge(e, m, overflow) {
      var visible = e._visible || {}, moved = !overflow && m.cellRef && m.cellRef !== e.cellRef;
      var payload = m._entry || {}, visibleFields = ["n", "name", "src", "source", "cls", "tier", "sub", "place", "region", "cellRef", "tm", "range", "dur", "dr", "ds", "uid", "writtenToVisible"];
      Object.keys(payload).forEach(function (k) {
        if (persistentKey(k) && (overflow || visibleFields.indexOf(k) < 0) && k !== "__proto__" && k !== "constructor" && k !== "prototype")
          e[k] = JSON.parse(JSON.stringify(payload[k]));
      });
      e.uid = m.uid || e.uid;
      if (e.uid) usedUID[e.uid] = true;
      e.id = m.skillId || payload.id || e.id || "";
      e.src = m.src || payload.src || payload.cls || e.src || "";
      if(!overflow&&m._baseline&&m._baseline.src&&!visible.src){e.src="";e.id="";}
      if (e.place === "talent") e.cls = e.src;
      e.kind = m.kind || payload.kind || e.kind || "";
      e.free = m.free === "1"; e.occupies = m.occupies !== "0";
      e.freeSlot = payload.freeSlot !== undefined ? !!payload.freeSlot : !e.occupies;
      e.via = m.via || payload.via || ""; e.grantedBy = payload.grantedBy || e.via;
      e.growthBy = m.growthBy || payload.growthBy || "";
      if (!e.tier) e.tier = m.tier || payload.tier || "";
      e.issueFlags = Array.isArray(payload.issueFlags) ? payload.issueFlags : (m.issueFlags || "").split("|").filter(Boolean);
      e.writtenToVisible = !overflow;
      if (m._baseline && !overflow) {
        var changes = ["src", "tm", "range", "dur", "dr", "ds", "tier"].filter(function (k) {
          return String(visible[k] || "") !== String(m._baseline[k] || "");
        });
        // Column placement / edited text does not change the identity of the same ability.
        if(changes.indexOf("dr")>=0){e.cost=visible.dr;delete e.fp;}
        if (changes.length || moved || (m._baseline.place && m._baseline.place !== e.place)) {
          stats.edited++;
          issue(state, e, "visible-edited", "保留表格中的栏位或内容修改：" + changes.join("、"));
        }
      }
    }
    var pending = [];
    rows.filter(function (m) { return m.sheet !== "__STATE__" && m.writtenToVisible !== "0"; }).forEach(function (m) {
      var exact = entries.filter(function (e) {
        return used.indexOf(e) < 0 && compatible(e,m) && m.cellRef && e.cellRef === m.cellRef &&
          (!m._baseline || !m._baseline.sheet || m._baseline.sheet === (e._visible || {}).sheet);
      });
      if (exact.length === 1) { used.push(exact[0]); merge(exact[0],m,false); stats.applied++; }
      else pending.push(m);
    });
    pending.forEach(function (m) {
      var hits = entries.filter(function (e) { return used.indexOf(e) < 0 && compatible(e,m); });
      var local = hits.filter(function (e) { return e.place === m.place; });
      if (local.length) hits = local;
      if (hits.length === 1) { used.push(hits[0]); merge(hits[0],m,false); stats.applied++; }
      else if (hits.length > 1) issue(state,null,"metadata-ambiguous",m.name+"有多个相同条目，身份待确认");
    });
    rows.filter(function (m) { return m.sheet !== "__STATE__" && m.writtenToVisible === "0"; }).forEach(function (m) {
      if (m.uid && usedUID[m.uid]) return;
      var e = { n: m.name, src: m.src || "", tier: m.tier || "", place: m.place || "main", region: m.region || "", sub: "" };
      if (e.place === "sub") e.sub = ((state.classes || [])[1] || {}).name || "子职业";
      merge(e, m, true); e.restored = true;
      (e.place === "talent" ? state.talent_tree : state.skills).push(e); stats.restored++;
    });
    return stats;
  }
  function recordWrite(e, ref, region, place) {
    e.cellRef = ref; e.region = region; e.place = place; e.writtenToVisible = true;
  }
  function prepareExport(state) {
    [state.skills || [], state.talent_tree || []].forEach(function (list, li) {
      list.forEach(function (e, i) {
        if (!e.uid) e.uid = "sk-" + Date.now().toString(36) + "-" + li + "-" + i + "-" + Math.random().toString(36).slice(2, 8);
        normalizeLegacy(e);
        e.writtenToVisible = false; e.cellRef = "";
      });
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""); }
  function metaXML(state, sheetName, cells) {
    var cols = ["uid", "skillId", "skillKey", "name", "src", "tier", "kind", "place", "free", "occupies", "via", "growthBy", "sheet", "region", "cellRef", "writtenToVisible", "issueFlags", "metaVersion", "visibleBaseline", "entryJSON"];
    var rows = [cols];
    [state.skills || [], state.talent_tree || []].forEach(function (list, li) {
      list.forEach(function (e) {
        var src = e.src || e.cls || e.source || "", place = e.place || (li ? "talent" : (e.sub ? "sub" : "main"));
        var ref = e.cellRef || "", rn = ref.replace(/^[A-Z]+/, ""), baseline = null, entry = {};
        Object.keys(e).forEach(function (k) { if (persistentKey(k) && k !== "restored") entry[k] = e[k]; });
        if (e.writtenToVisible && cells) baseline = { name: cells[ref] || "", src: li ? "" : cells["I" + rn] || "", tier: li ? tier(e.tier) : "",
          tm: li ? "" : cells["D" + rn] || "", range: li ? "" : cells["E" + rn] || "", dur: li ? "" : cells["F" + rn] || "",
          dr: li ? "" : cells["H" + rn] || "", ds: li ? "" : cells["J" + rn] || "",
          sheet: sheetName, cellRef: ref, region: e.region || (li ? "talent" : place), place: place };
        rows.push([e.uid || "", e.id || e.skillId || "", src + "\t" + (e.id || ""), e.n || e.name || "", src, e.tier || "", e.kind || "", place,
          (e.free === undefined ? !!e.freeSlot : !!e.free) ? "1" : "0", (e.occupies === undefined ? !e.freeSlot : e.occupies !== false) ? "1" : "0",
          e.via || e.grantedBy || "", e.growthBy || "", sheetName || (li ? "天赋栏" : "技能栏"), e.region || (li ? "talent" : place), ref,
          e.writtenToVisible ? "1" : "0", (e.issueFlags || []).join("|"), "2", baseline ? JSON.stringify(baseline) : "", JSON.stringify(entry)]);
      });
    });
    ["unlocked_tiers", "extra_slots"].forEach(function (key) {
      var r = cols.map(function () { return ""; });
      r[3] = key; r[4] = JSON.stringify(state[key] || []); r[12] = "__STATE__"; r[17] = "2"; rows.push(r);
    });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="' + NS + '"><sheetData>' +
      rows.map(function (r, ri) { return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
        return '<c r="' + colName(ci) + (ri + 1) + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join("") + "</row>"; }).join("") + "</sheetData></worksheet>";
  }
  function attachMeta(entries, state) {
    function find(name) { return entries.filter(function (e) { return e.name === name; })[0]; }
    var wb = find("xl/workbook.xml"), rr = find("xl/_rels/workbook.xml.rels"), ct = find("[Content_Types].xml");
    if (!wb || !rr || !ct) throw new Error("导出缺少工作簿关联文件");
    var man = manifest(wb.text, rr.text), metas = man.list.filter(function (s) { return s.name === META; });
    if (metas.length > 1) throw new Error("存在重复的隐藏信息工作表");
    var meta = metas[0], usedPaths = {}, usedIds = {}, maxSheet = 0;
    entries.forEach(function (e) { usedPaths[e.name] = true; });
    man.rels.forEach(function (r) { usedIds[r.getAttribute("Id")] = true; usedPaths[path(r.getAttribute("Target"))] = true; });
    man.sheets.forEach(function (s) { maxSheet = Math.max(maxSheet, Number(s.getAttribute("sheetId")) || 0); });
    var target = meta && meta.path, rid = meta && meta.rid, n = 1;
    if (!target) { while (usedPaths["xl/worksheets/sheet" + n + ".xml"]) n++; target = "xl/worksheets/sheet" + n + ".xml"; }
    if (!rid) { n = 1; while (usedIds["rId" + n]) n++; rid = "rId" + n; }
    if (!meta) {
      var sn = man.wb.createElementNS(NS, "sheet");
      sn.setAttribute("name", META); sn.setAttribute("sheetId", String(maxSheet + 1)); sn.setAttributeNS(REL, "r:id", rid);
      els(man.wb, "sheets")[0].appendChild(sn); meta = { node: sn };
    }
    meta.node.setAttribute("state", "hidden");
    // Deduplicate only the META relationship, preserving every unrelated relationship.
    var matches = man.rels.filter(function (r) { return r.getAttribute("Id") === rid; });
    var rel = matches[0];
    matches.slice(1).forEach(function (r) { r.parentNode.removeChild(r); });
    if (!rel) { rel = man.relDoc.createElementNS(PKG, "Relationship"); man.relDoc.documentElement.appendChild(rel); }
    rel.setAttribute("Id", rid); rel.setAttribute("Type", REL + "/worksheet");
    rel.setAttribute("Target", "/" + target); rel.removeAttribute("TargetMode");
    var types = xml(ct.text), existing = els(types, "Override").filter(function (o) { return o.getAttribute("PartName") === "/" + target; });
    var override = existing[0];
    existing.slice(1).forEach(function (o) { o.parentNode.removeChild(o); });
    if (!override) { override = types.createElementNS(types.documentElement.namespaceURI, "Override"); types.documentElement.appendChild(override); }
    override.setAttribute("PartName", "/" + target); override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");
    var ser = new XMLSerializer();
    [[wb, man.wb], [rr, man.relDoc], [ct, types]].forEach(function (pair) { pair[0].text = ser.serializeToString(pair[1]); pair[0]._dirty = true; });
    var character = man.list.filter(function (s) { return s.path === (state._xlsxSheetPath || "xl/worksheets/sheet1.xml"); })[0];
    if (!character) throw new Error("导出未找到原角色工作表");
    var stringsEntry = find("xl/sharedStrings.xml"), data = sheet(find(character.path).text, sharedStrings(stringsEntry ? stringsEntry.text : ""));
    var output = metaXML(state, character.name, data.cells), dest = find(target);
    if (!dest) { dest = { name: target, method: 8, uncompSize: 0, compSize: 0 }; entries.push(dest); }
    dest.text = output; dest._dirty = true;
    return { ok: true, path: target, rid: rid, rows: (output.match(/<row /g) || []).length - 1 };
  }
  function ensureSharedPart(entries) {
    var ss = entries.filter(function (e) { return e.name === "xl/sharedStrings.xml"; })[0];
    if (ss) return ss;
    ss = { name: "xl/sharedStrings.xml", text: '<sst xmlns="' + NS + '"/>', method: 8, _dirty: true }; entries.push(ss);
    var rr = entries.filter(function (e) { return e.name === "xl/_rels/workbook.xml.rels"; })[0];
    var ct = entries.filter(function (e) { return e.name === "[Content_Types].xml"; })[0];
    var d = xml(rr.text), rels = els(d, "Relationship"), n = 1;
    while (rels.some(function (r) { return r.getAttribute("Id") === "rId" + n; })) n++;
    var r = d.createElementNS(PKG, "Relationship"); r.setAttribute("Id", "rId" + n); r.setAttribute("Type", REL + "/sharedStrings"); r.setAttribute("Target", "/xl/sharedStrings.xml"); d.documentElement.appendChild(r);
    rr.text = new XMLSerializer().serializeToString(d); rr._dirty = true;
    d = xml(ct.text); var o = d.createElementNS(d.documentElement.namespaceURI, "Override");
    o.setAttribute("PartName", "/xl/sharedStrings.xml"); o.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"); d.documentElement.appendChild(o);
    ct.text = new XMLSerializer().serializeToString(d); ct._dirty = true;
    return ss;
  }
  function normalizeLegacy(e) {
    var via = e.src || "";
    if (/^(?:法师|战士|牧师|游荡者)?学徒$/.test(via) || via === "背景" || via === "起源") {
      e.via = e.via || via; e.grantedBy = e.grantedBy || via; e.src = "";
      if (via === "法师学徒") { e.src = "法师"; if(e.free===undefined)e.free=true;if(e.occupies===undefined)e.occupies=e.freeSlot===false;if(e.freeSlot===undefined)e.freeSlot=!e.occupies; }
    }
    return e;
  }
  function talentLayout(text,strings) {
    var data=sheet(text,strings),headers={},counts={O:0,R:0},cells=data.cells;
    Object.keys(cells).forEach(function(ref){
      var c=ref.match(/^([OR])(\d+)$/);
      if(c&&Number(c[2])>=119&&/^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e031-7]\u9636\u5929\u8d4b\u6811/.test(cells[ref])){
        if(!headers[c[1]])headers[c[1]]={};
        headers[c[1]][tier(cells[ref])]=Number(c[2]);counts[c[1]]++;
      }
    });
    var col=counts.R>counts.O?"R":"O",hs=headers[col]||{},order=["\u4e00\u9636","\u4e8c\u9636","\u4e09\u9636","\u56db\u9636","\u4e94\u9636","\u516d\u9636","\u4e03\u9636"],map={};
    var limit=172;
    Object.keys(cells).forEach(function(ref){if(ref.indexOf(col)===0&&/\u56fe\u7eb8.*\u4e13\u4e1a/.test(cells[ref]))limit=Math.min(limit,Number(ref.replace(/^[A-Z]+/,"")));});
    order.forEach(function(t,i){
      if(!hs[t])return;
      var next=limit;
      for(var j=i+1;j<order.length;j++)if(hs[order[j]]){next=hs[order[j]];break;}
      map[t]=[hs[t]+1,Math.max(hs[t]+1,next-2)];
    });
    if(!Object.keys(map).length)map={"\u4e00\u9636":[122,126],"\u4e8c\u9636":[129,133],"\u4e09\u9636":[136,140],"\u56db\u9636":[143,147],"\u4e94\u9636":[150,154],"\u516d\u9636":[157,161],"\u4e03\u9636":[164,165]};
    return {column:col,rows:map};
  }
  function skillHeaders(set) {
    set("B166","\u5b50\u804c\u4e1a\uff08\uff09");set("B167","\u6280\u80fd\u540d\u79f0");
    set("D167","\u65bd\u5c55\u65f6\u95f4");set("E167","\u65bd\u5c55\u8ddd\u79bb");set("F167","\u6301\u7eed\u65f6\u95f4");set("H167","\u6d88\u8017");set("I167","\u6765\u6e90");set("J167","\u6548\u679c");set("I122","\u6765\u6e90");
  }
  return { talentLayout:talentLayout,skillHeaders:skillHeaders,readWorkbook: readWorkbook, readMeta: readMeta, sheet: sheet, sharedStrings: sharedStrings, manifest: manifest, normalizePath: path,
    tier: tier, candidates: candidates, search:search,resolve: resolve, rawEntry: rawEntry, applyMeta: applyMeta, metaXML: metaXML, attachMeta: attachMeta,
    prepareExport: prepareExport, recordWrite: recordWrite, ensureSharedPart: ensureSharedPart, normalizeLegacy: normalizeLegacy, escape: esc };
})();
