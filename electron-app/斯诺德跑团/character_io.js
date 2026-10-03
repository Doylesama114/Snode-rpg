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
  function decodeText(s){return String(s||"").replace(/_x([0-9a-f]{4})_/gi,function(_,hex){return String.fromCharCode(parseInt(hex,16));});}
  function textRuns(n) {
    if (!n) return "";
    // Phonetic annotations are not the displayed cell text.
    return decodeText(els(n, "t").filter(function (t) { return !t.parentNode || t.parentNode.localName !== "rPh"; })
      .map(function (t) { return t.textContent; }).join(""));
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
        if(type==="str")value=decodeText(value);
        cells[ref] = value; rawValues[ref] = value; values[colIndex(ref)] = value;
        if (child(c, "f")) formulas[ref] = { formula: child(c, "f").textContent, cached: !!v };
      });
      rows.push(values);
    });
    return { cells: cells, rawValues: rawValues, rows: rows, formulas: formulas,
      merges:els(d,"mergeCell").map(function(m){return m.getAttribute("ref");}).filter(Boolean) };
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
      if (version > 3) { var e = new Error("隐藏信息版本过新：" + version); e.unsupported = true; throw e; }
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
  async function readWorkbook(buffer, readZip, readEntry, options) {
    options=options||{};
    var zip = await readZip(buffer);
    if (!zip["xl/workbook.xml"] || !zip["xl/_rels/workbook.xml.rels"]) throw new Error("文件不是有效的角色工作簿");
    var texts = await Promise.all(["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml"].map(function (p) {
      return zip[p] ? readEntry(zip, p) : "";
    }));
    var man = manifest(texts[0], texts[1]), strings = sharedStrings(texts[2]), candidates = [],sheets=[];
    for (var i = 0; i < man.list.length; i++) {
      var s = man.list[i];
      if (s.name === META || !s.path || !zip[s.path]) continue;
      var data = sheet(await readEntry(zip, s.path), strings), vals = Object.keys(data.cells).map(function (k) { return data.cells[k]; });
      var score = 0;
      ["角色名称", "种族", "主职业", "技能列表", "天赋"].forEach(function (label) {
        if (vals.some(function (v) { return String(v).indexOf(label) >= 0; })) score++;
      });
      if(data.cells.C4)score+=0.5;if(data.cells.B17)score+=0.25;
      var item={item:s,data:data,score:score};sheets.push(item);
      var structural=typeof SNOWD_CHARACTER_LAYOUT!=="undefined"?SNOWD_CHARACTER_LAYOUT.detect(Object.assign({},data,{sheetName:s.name})):null;
      if((score>=4&&vals.some(function(v){return String(v).indexOf("技能列表")>=0;}))||(score>=2&&structural&&(structural.skills.length||structural.talents.length)))candidates.push(item);
    }
    if(!candidates.length)candidates=sheets.filter(function(s){return Object.values(s.data.cells).some(function(v){return String(v).trim();});});
    if(!candidates.length)throw new Error("工作簿没有可读取的工作表");
    candidates.sort(function (a, b) { return b.score - a.score; });
    var chosen=options.sheetPath?sheets.find(function(s){return s.item.path===options.sheetPath;}):null;if(options.sheetPath&&!chosen)throw new Error("选择的工作表不存在");
    var picked=chosen||candidates[0],meta={status:"absent",rows:[],message:""};
    picked.data.sheetSelectionPending=!chosen&&candidates.length>1&&candidates[0].score===candidates[1].score;
    picked.data.sheetChoices=sheets.map(function(s){return {name:s.item.name,path:s.item.path,score:s.score};});
    var ms = man.list.filter(function (s) { return s.name === META; });
    if (ms.length) {
      try {
        if (ms.length !== 1 || !ms[0].path || !zip[ms[0].path]) throw new Error("隐藏信息表关联缺失或重复");
        meta.rows = readMeta(await readEntry(zip, ms[0].path), strings);
        meta.status = "ok";
      } catch (e) { meta.status = e.unsupported ? "unsupported" : "invalid"; meta.message = e.message; }
    }
    picked.data.strings = strings; picked.data.meta = meta;
    picked.data.sheetName=picked.item.name;picked.data.sheetPath=picked.item.path;
    picked.data.otherSheets=sheets.filter(function(s){return s!==picked;}).map(function(s){var name=s.item.name,kind=/发展|计划|进度/.test(name)?"planning":/敌人/.test(name)?"enemy":/成员/.test(name)?"people":/详解/.test(name)?"class-reference":/环游|道具/.test(name)?"item-reference":"reference";return {name:name,path:s.item.path,kind:kind,cells:s.data.cells,formulas:s.data.formulas,merges:s.data.merges};});
    if(meta.status==="ok"){
      var saved=meta.rows.find(function(m){return m.sheet==="__STATE__"&&m.name==="importLayoutMappings";});
      if(saved){try{var mappings=JSON.parse(saved.src||"[]");picked.data.layoutMappings=mappings.filter(function(m){return m.sheet===picked.item.name&&(!m.signature||SNOWD_CHARACTER_LAYOUT.mappingSignature(picked.data,m)===m.signature);});}catch(e){}}
    }
    return picked.data;
  }
  function tier(t) {
    var m = String(t || "").match(/([一二三四五六七1-7])阶/);
    return m ? (/^[1-7]$/.test(m[1]) ? "一二三四五六七".charAt(Number(m[1]) - 1) : m[1]) + "阶" : "";
  }
  function persistentKey(k) { return k.charAt(0)!=="_" || ["_persistOrig","_futureLowestLeft","_futureMigrated","_orig","_addedLanguages","_panelApplied","_attrGained"].indexOf(k)>=0; }
  function candidates(name) {
    var ix=typeof SNOWD_SKILL_INDEX!=="undefined"?SNOWD_SKILL_INDEX:null;if(!ix)return [];
    var keys=Object.keys(ix.byName);
    if(nameIndexOwner!==ix||nameIndexCount!==keys.length){
      nameIndexOwner=ix;nameIndexCount=keys.length;nameIndex=Object.create(null);
      keys.forEach(function(n){var k=normalizeName(n);nameIndex[k]=(nameIndex[k]||[]).concat(ix.byName[n]);});
    }
    return (nameIndex[normalizeName(name)]||[]).map(function(n){var r=ix.rows[n];return {name:r[0],id:r[1],cls:r[2],kind:r[3],type:r[4],style:r[5],tier:tier(r[6]),isStarting:!!r[7]};});
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
    if(e.resolution==="variant"&&e.baseDefinition){return resolve({n:e.baseDefinition.name,src:e.baseDefinition.src,id:e.baseDefinition.id});}
    if(isCustom(e))return {all:[],candidates:[],pick:null,exact:false,ambiguous:false,mismatch:false,custom:true};
    var all = candidates(e.n || e.name), source = String(e.src || e.cls || e.source || "").trim();
    var aliases = typeof SNOWD_SKILL_INDEX !== "undefined" ? SNOWD_SKILL_INDEX.aliases || {} : {};
    var wantedId = aliases[source + "\t" + (e.id || "")] || e.id;
    var filtered = all.filter(function (c) { return (!source || c.cls === source) && (!wantedId || c.id === wantedId); });
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
    if(/^(?:长休|短休|战斗|回合|每日)(?:限)?(?:[一二三四五六七八九十\d]+次?)?$/.test(rawSource)){e.usageLimit=rawSource;e.rawCategory=rawSource;e.src="";}
    if(skill&&e.src&&rawSource&&ix&&!ix.meta.perClass[rawSource]&&
      (ix.rows.some(function(r){return r[5]===rawSource;})||["法术","战技","法咒","神术","戏法","幻象","专注","回合限一"].indexOf(rawSource)>=0)){
      e.rawCategory=rawSource;e.src="";
    }
    e.cellRef = ref; e.region = region; e.place = place;
    var suppliedVisible=e._visible||{};
    e._visible = { name: e.n, src: skill ? c["I" + row] || "" : "", tier: skill ? "" : tier(visibleTier),
      tm: skill ? e.tm || "" : "", range: skill ? e.range || "" : "", dur: skill ? e.dur || "" : "",
      dr: skill ? e.dr || "" : "", ds: skill ? e.ds || "" : "", sheet: parsed.sheetName || "", cellRef: ref, region: region, place: place };
    Object.keys(suppliedVisible).forEach(function(k){e._visible[k]=suppliedVisible[k];});
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
    var allEntries=entries(state), used = [], rows = meta.rows || [], usedUID = {};
    rows.forEach(function (m) {
      if (m.sheet !== "__STATE__") return;
      try {
        if(m.name==="characterState"){restoreCharacterState(state,JSON.parse(m.src||"{}"));return;}
        if (["unlocked_tiers","extra_slots","importExcluded","unmappedFields","importLayoutMappings","importFieldMappings"].indexOf(m.name)>=0) {
          var a = JSON.parse(m.src || "[]");
          if (!Array.isArray(a) || (["unlocked_tiers","extra_slots"].indexOf(m.name)>=0&&a.some(function (v) { return !tier(v); }))) throw new Error("阶位列表无效");
          if(["importLayoutMappings","importFieldMappings","importExcluded","unmappedFields"].indexOf(m.name)>=0&&a.some(function(v){return !v||typeof v!=="object"||Array.isArray(v);}))throw new Error("记录项必须是对象");
          if(m.name==="importLayoutMappings"&&a.some(function(v){return typeof v.range!=="string"||!v.fields||typeof v.fields!=="object";}))throw new Error("列映射格式无效");
          if(m.name==="importFieldMappings"&&a.some(function(v){return ["金币","银币","铜币"].indexOf(v.field)<0||!/^([A-Z]+)([1-9]\d*)$/.test(v.cellRef||"");}))throw new Error("字段映射格式无效");
          if(m.name==="unmappedFields"&&a.some(function(v){return !Array.isArray(v.values)||v.values.some(function(x){return !x||typeof x.cellRef!=="string";});}))throw new Error("未分类字段格式无效");
          state[m.name] = a;
        }
      } catch (e) { issue(state, null, "metadata-invalid", m.name + "：" + e.message); }
    });
    function compatible(e, m) {
      var v = e._visible || {}, base = m._baseline;
      if (normalizeName(e.n || e.name) !== normalizeName(m.name)) return false;
      if((e.place==="blueprint")!==(m.place==="blueprint"))return false;
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
      e.free=m.free==="?"?null:m.free==="1";e.occupies=m.occupies==="?"?null:m.occupies!=="0";
      e.freeSlot=e.occupies===null?false:payload.freeSlot!==undefined?!!payload.freeSlot:!e.occupies;
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
      var exact = allEntries.filter(function (e) {
        return used.indexOf(e) < 0 && compatible(e,m) && m.cellRef && e.cellRef === m.cellRef &&
          (!m._baseline || !m._baseline.sheet || m._baseline.sheet === (e._visible || {}).sheet);
      });
      if (exact.length === 1) { used.push(exact[0]); merge(exact[0],m,false); stats.applied++; }
      else pending.push(m);
    });
    pending.forEach(function (m) {
      var hits = allEntries.filter(function (e) { return used.indexOf(e) < 0 && compatible(e,m); });
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
      var target=e.place==="blueprint"?(state.blueprints=state.blueprints||[]):e.place==="talent"?state.talent_tree:state.skills;
      target.push(e);stats.restored++;
    });
    return stats;
  }
  function recordWrite(e, ref, region, place, fields) {
    e.cellRef = ref; e.region = region; e.place = place; e.writtenToVisible = true;e._writtenFields=fields||{};
  }
  function prepareExport(state) {
    [state.skills || [], state.talent_tree || [], state.blueprints||[]].forEach(function (list, li) {
      list.forEach(function (e, i) {
        if (!e.uid) e.uid = "sk-" + Date.now().toString(36) + "-" + li + "-" + i + "-" + Math.random().toString(36).slice(2, 8);
        normalizeLegacy(e);
        e.writtenToVisible = false; e.cellRef = "";delete e._writtenFields;
      });
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""); }
  function metaXML(state, sheetName, cells) {
    var cols=["uid","skillId","skillKey","name","src","tier","kind","place","free","occupies","via","growthBy","sheet","region","cellRef","writtenToVisible","issueFlags","metaVersion","visibleBaseline","entryJSON"],rows=[cols];
    [state.skills||[],state.talent_tree||[],state.blueprints||[]].forEach(function(list,li){
      list.forEach(function(e){
        var src=e.src||e.cls||e.source||"",place=e.place||(li===2?"blueprint":li===1?"talent":e.sub?"sub":"main"),ref=e.cellRef||"",rn=ref.replace(/^[A-Z]+/,""),baseline=null,entry={};
        Object.keys(e).forEach(function(k){if(persistentKey(k)&&k!=="restored")entry[k]=e[k];});
        if(e.writtenToVisible&&cells){
          var mapped=e._writtenFields||{},talent=place==="talent",bp=place==="blueprint";
          baseline={name:cells[ref]||"",src:talent||bp?"":cells["I"+rn]||"",tier:talent?tier(e.tier):"",tm:talent||bp?"":cells["D"+rn]||"",range:talent||bp?"":cells["E"+rn]||"",dur:talent||bp?"":cells["F"+rn]||"",dr:talent||bp?"":cells["H"+rn]||"",ds:talent?cells[colName(colIndex(ref)+2)+rn]||"":bp?"":cells["J"+rn]||"",sheet:sheetName,cellRef:ref,region:e.region||place,place:place};
          if(mapped.name)["src","tm","range","dur","dr","ds"].forEach(function(k){baseline[k]="";});
          Object.keys(mapped).forEach(function(k){if(k!=="name"&&Object.prototype.hasOwnProperty.call(baseline,k))baseline[k]=cells[mapped[k]]||"";});
          (e.mergedNotes||[]).filter(function(n){return n.status!=="confirmed"||n.target==="note";}).forEach(function(n){(n.fields||[]).forEach(function(k){baseline[k]="";});});
        }
        rows.push([e.uid||"",e.id||e.skillId||"",src+"\t"+(e.id||""),e.n||e.name||"",src,e.tier||"",e.kind||"",place,
          e.free===null?"?":(e.free===undefined?!!e.freeSlot:!!e.free)?"1":"0",e.occupies===null?"?":(e.occupies===undefined?!e.freeSlot:e.occupies!==false)?"1":"0",
          e.via||e.grantedBy||"",e.growthBy||"",sheetName||place,e.region||place,ref,e.writtenToVisible?"1":"0",(e.issueFlags||[]).join("|"),"3",baseline?JSON.stringify(baseline):"",JSON.stringify(entry)]);
      });
    });
    ["unlocked_tiers","extra_slots","importExcluded","unmappedFields","importLayoutMappings","importFieldMappings"].forEach(function(key){
      var r=cols.map(function(){return "";});r[3]=key;r[4]=JSON.stringify(state[key]||[]);r[12]="__STATE__";r[17]="3";rows.push(r);
    });
    var snapshot=cols.map(function(){return "";});snapshot[3]="characterState";snapshot[4]=JSON.stringify(characterState(state,cells,sheetName));snapshot[12]="__STATE__";snapshot[17]="3";rows.push(snapshot);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="'+NS+'"><sheetData>'+rows.map(function(r,ri){return '<row r="'+(ri+1)+'">'+r.map(function(v,ci){return '<c r="'+colName(ci)+(ri+1)+'" t="inlineStr"><is><t xml:space="preserve">'+esc(v)+'</t></is></c>';}).join("")+"</row>";}).join("")+"</sheetData></worksheet>";
  }

  function attachSupportingSheets(entries,state){
    var snapshots=state.supportingSheets||[];if(!snapshots.length)return;
    var wb=entries.find(function(e){return e.name==="xl/workbook.xml";}),rr=entries.find(function(e){return e.name==="xl/_rels/workbook.xml.rels";}),ct=entries.find(function(e){return e.name==="[Content_Types].xml";});if(!wb||!rr||!ct)return;
    snapshots.forEach(function(snapshot){
      var man=manifest(wb.text,rr.text);if(man.list.some(function(s){return s.name===snapshot.name;}))return;
      var used={},ids={},maxSheet=0;entries.forEach(function(e){used[e.name]=true;});man.rels.forEach(function(r){ids[r.getAttribute("Id")]=true;});man.sheets.forEach(function(s){maxSheet=Math.max(maxSheet,Number(s.getAttribute("sheetId"))||0);});
      var n=1;while(used["xl/worksheets/sheet"+n+".xml"])n++;var target="xl/worksheets/sheet"+n+".xml";n=1;while(ids["rId"+n])n++;var rid="rId"+n;
      var node=man.wb.createElementNS(NS,"sheet");node.setAttribute("name",snapshot.name);node.setAttribute("sheetId",String(maxSheet+1));node.setAttributeNS(REL,"r:id",rid);els(man.wb,"sheets")[0].appendChild(node);
      var relation=man.relDoc.createElementNS(PKG,"Relationship");relation.setAttribute("Id",rid);relation.setAttribute("Type",REL+"/worksheet");relation.setAttribute("Target","/"+target);man.relDoc.documentElement.appendChild(relation);
      var types=xml(ct.text),override=types.createElementNS(types.documentElement.namespaceURI,"Override");override.setAttribute("PartName","/"+target);override.setAttribute("ContentType","application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");types.documentElement.appendChild(override);
      var rows={};Object.keys(snapshot.cells||{}).forEach(function(ref){if(!/^[A-Z]+\d+$/.test(ref))return;var r=Number(ref.replace(/^[A-Z]+/,""));(rows[r]=rows[r]||[]).push(ref);});
      var text='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="'+NS+'"><sheetData>'+Object.keys(rows).sort(function(a,b){return Number(a)-Number(b);}).map(function(r){return '<row r="'+r+'">'+rows[r].sort(function(a,b){return colIndex(a)-colIndex(b);}).map(function(ref){var value=snapshot.cells[ref],f=snapshot.formulas&&snapshot.formulas[ref],numeric=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value));if(f)return '<c r="'+ref+'"><f>'+esc(f.formula||"")+'</f>'+(f.cached?'<v>'+esc(value)+'</v>':"")+'</c>';return numeric?'<c r="'+ref+'"><v>'+esc(value)+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+esc(value)+'</t></is></c>';}).join("")+'</row>';}).join("")+'</sheetData>';
      if((snapshot.merges||[]).length)text+='<mergeCells count="'+snapshot.merges.length+'">'+snapshot.merges.map(function(m){return '<mergeCell ref="'+esc(m)+'"/>';}).join("")+'</mergeCells>';text+='</worksheet>';
      entries.push({name:target,text:text,method:8,_dirty:true});var ser=new XMLSerializer();wb.text=ser.serializeToString(man.wb);rr.text=ser.serializeToString(man.relDoc);ct.text=ser.serializeToString(types);wb._dirty=rr._dirty=ct._dirty=true;
    });
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
    if(isCustom(e))return e;
    var via = e.src || "";
    if(candidates(via).some(function(c){return c.cls==="特殊专长";})){e.via=e.via||via;e.grantedBy=e.grantedBy||via;e.src="";return e;}
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

  var nameIndex=null,nameIndexOwner=null,nameIndexCount=0;
  function normalizeName(name){return String(name==null?"":name).replace(/[（]/g,"(").replace(/[）]/g,")").replace(/[\s\u00a0\u3000]+/g,"").trim();}
  function entries(state){return (state.skills||[]).concat(state.talent_tree||[],state.blueprints||[]);}
  function isCustom(e){return !!e&&e.resolution==="custom";}
  function slotState(e){return e&&e.occupies===null?"unknown":e&&e.occupies!==undefined?(e.occupies?"occupied":"free"):e&&e.freeSlot?"free":"occupied";}
  function fingerprint(e){return JSON.stringify([normalizeName(e.n||e.name),e.src||e.cls||"",e.tier||""]);}
  function isDeferred(e){return !!e&&e.resolution==="deferred"&&e.resolutionFingerprint===fingerprint(e);}
  function rawSkillData(e){
    e=e||{};var fields={},pairs=[["施展时间","tm"],["施展距离","range"],["持续时间","dur"],["疲劳消耗","dr"],["描述","ds"]];
    pairs.forEach(function(p){var value=e[p[1]];if(value!==undefined&&value!==null&&String(value)!=="")fields[p[0]]=String(value);});
    if(!fields["疲劳消耗"]){var cost=e.cost!==undefined&&typeof e.cost!=="object"?e.cost:e.fp;if(cost!==undefined&&cost!==null&&String(cost)!=="")fields["疲劳消耗"]=String(cost);}
    if(e.usageLimit)fields["使用频次"]=e.usageLimit;
    if(!fields["描述"]&&(e.rawDesc||e.note||e.desc))fields["描述"]=e.rawDesc||e.note||e.desc;
    return {name:e.n||e.name||"",fields:fields,description:(e.mergedNotes||[]).filter(function(n){return n.status!=="confirmed"||n.target==="note";}).map(function(n){return "跨列原文："+n.raw;}).concat(e.conditionNotes?["施展条件补充："+e.conditionNotes]:[],e.summonNotes?["召唤物补充说明："+e.summonNotes]:[]),unit_tables:e.unit_tables||[],level_upgrades:e.level_upgrades||[],tier:e.tier||"",style:e.via||e.grantedBy||"",cost:[]};
  }
  function removeResolutionIssues(state,uid){
    state.importIssues=(state.importIssues||[]).filter(function(i){return i.uid!==uid||["ambiguous","unmatched","typo-candidate","source-mismatch","catalog-changed","slot-pending"].indexOf(i.kind)<0;});
  }
  function confirmCustom(e,options){
    options=options||{};delete e.baseDefinition;delete e.id;delete e.skillId;delete e.catalogTier;delete e.st;
    e.resolution="custom";e.resolutionConfirmed=true;e.src="";if(e.place==="talent")e.cls="";
    e.origin={type:options.originType||"custom",label:options.via||e.via||e.grantedBy||""};
    e.via=e.origin.label;e.grantedBy=e.via;e.kind=e.place==="talent"?"天赋":e.place==="blueprint"?"配方":"技能";
    e.occupies=options.occupies===undefined?null:options.occupies;e.free=options.free===undefined?null:options.free;
    e.freeSlot=e.occupies===false;e.growthBy=options.growthBy||"";
    return e;
  }



  function characterState(state,cells,sheetName){
    var stats=typeof SNOWD_CHARACTER_STATS!=="undefined"?SNOWD_CHARACTER_STATS.read(state):null,combat=state.combatStats||{schemaVersion:1,fields:{}},baseline={};
    if(stats)Object.keys(stats.fields).forEach(function(k){if(!combat.fields[k])combat.fields[k]={mode:stats.fields[k].mode,source:stats.fields[k].source};});
    var scalar=state.fieldSources&&state.fieldSources.scalar||{};
    Object.keys(scalar).forEach(function(k){var v=scalar[k];if(v&&v.cellRef)baseline[k]={raw:cells&&cells[v.cellRef]!==undefined?String(cells[v.cellRef]):v.raw||"",cellRef:v.cellRef,sheet:sheetName||v.sheet};});
    return {schemaVersion:1,classes:state.classes||[],combatStats:combat,combatValues:state.combatValues||{},baseline:baseline,hpCurrent:state._hpCurrent,fpCurrent:state._fpCurrent,ruleRace:state.ruleRace||"",ruleBackground:state.ruleBackground||"",equipment:state.equipment||{},fieldSources:state.fieldSources||{},equipmentLayoutGroups:state.equipmentLayoutGroups||[],importCandidates:state.importCandidates||[],supportingSheets:state.supportingSheets||[],importNotes:state.importNotes||[],special_feats:state.special_feats||[],draft:!!state.importDraft};
  }
  function restoreCharacterState(state,payload){
    if(!payload||payload.schemaVersion!==1||!Array.isArray(payload.classes))throw new Error("角色状态结构无效");
    var old=payload.classes,current=state.classes||[],changedLevel=false;
    current.forEach(function(c,i){var p=old[i];if(!p||p.name!==c.name)return;if(p.level!==c.level)changedLevel=true;
      ["uid","baseClass","baseConfirmed","advancementId","levelMeaning","confirmedTotalLevel","ruleEnabled","rulesDisabled"].forEach(function(k){if(p[k]!==undefined)c[k]=p[k];});
    });
    if(changedLevel&&current[1]&&current[1].levelMeaning==="continuation")current[1].levelMeaning="unconfirmed";
    state.importDraft=!!payload.draft;
    if(Array.isArray(payload.special_feats))payload.special_feats.forEach(function(f){
      var match=(state.special_feats||[]).find(function(n){return n.name===f.name;});
      if(match){["uid","imported","grantStatus","origin"].forEach(function(k){if(f[k]!==undefined)match[k]=f[k];});}
      else if(f.imported&&!f.provenance)(state.special_feats=state.special_feats||[]).push(f);
    });
    state.ruleRace=payload.ruleRace||"";state.ruleBackground=payload.ruleBackground||"";
    if(payload.combatStats){
      if(payload.combatStats.schemaVersion!==1||!payload.combatStats.fields||typeof payload.combatStats.fields!=="object")throw new Error("数值策略格式无效");
      var freshSources=state.fieldSources&&state.fieldSources.scalar||{},fields=payload.combatStats.fields;
      Object.keys(fields).forEach(function(k){
        if(typeof SNOWD_CHARACTER_STATS==="undefined"||!Object.prototype.hasOwnProperty.call(SNOWD_CHARACTER_STATS.labels,k))return;
        var p=fields[k];if(!p||["fixed","rules"].indexOf(p.mode)<0)throw new Error("数值采用方式无效");
        var fresh=freshSources[k],base=payload.baseline&&payload.baseline[k],edited=fresh&&base&&String(fresh.raw)!==String(base.raw);
        if(fresh&&fresh.status==="valid"){
          SNOWD_CHARACTER_STATS.set(state,k,fresh.value,edited?"fixed":p.mode,edited?{origin:"sheet",sheet:fresh.sheet,cellRef:fresh.cellRef,raw:fresh.raw}:p.source);
          state.combatStats.fields[k].baseline=fresh.raw;state.combatStats.fields[k].originalValue=p.originalValue;
          if(edited)issue(state,null,"visible-edited","表格中的"+SNOWD_CHARACTER_STATS.labels[k]+"已修改，保留当前填写值。");
        }else if(fresh&&fresh.status!=="valid"&&base){
          if(k==="hp"||k==="fp")state[k]=null;
          delete (state.combatStats&&state.combatStats.fields||{})[k];
          issue(state,null,"field-cleared","表格中的"+SNOWD_CHARACTER_STATS.labels[k]+"已清空或无法读取；请确认采用方式。");state.importIssues[state.importIssues.length-1].field=k;
        }
      });
    }
    if(typeof payload.hpCurrent==="number"&&Number.isFinite(payload.hpCurrent))state._hpCurrent=payload.hpCurrent;
    if(typeof payload.fpCurrent==="number"&&Number.isFinite(payload.fpCurrent))state._fpCurrent=payload.fpCurrent;
    var previousItems=[];Object.keys(payload.equipment||{}).forEach(function(slot){(payload.equipment[slot]||[]).forEach(function(e){if(e.items)previousItems=previousItems.concat(e.items);else previousItems.push(e);});});
    Object.keys(state.equipment||{}).forEach(function(slot){(state.equipment[slot]||[]).forEach(function(e){var list=e.items||[e];list.forEach(function(n){var matches=previousItems.filter(function(p){return (p.item||p.name)===(n.item||n.name)&&p.provenance&&n.provenance&&p.provenance.nameRef===n.provenance.nameRef;});if(matches.length===1){n.uid=matches[0].uid||n.uid;if(matches[0].customDefinition)n.customDefinition=matches[0].customDefinition;}});});});
    if(Array.isArray(payload.importCandidates)){state.importCandidates=payload.importCandidates;state.importCandidates.forEach(function(c){if(c.kind==="feat-options"&&c.status==="owned")state.special_feats=(state.special_feats||[]).filter(function(f){return f.name!==c.raw||f.cellRef!==c.cellRef;});});}
    if(Array.isArray(payload.supportingSheets)&&!(state.supportingSheets||[]).length)state.supportingSheets=payload.supportingSheets;
    if(Array.isArray(payload.importNotes))state.importNotes=payload.importNotes;
    if(typeof SNOWD_CHARACTER_CLASSES!=="undefined")state.classIssues=SNOWD_CHARACTER_CLASSES.pending(state);
  }

  function abilityExportPlan(parsed,state){
    if(typeof SNOWD_CHARACTER_LAYOUT==="undefined")return {dynamic:false,sections:[],parsed:parsed};
    var source=Object.assign({},parsed),mappings=state.importLayoutMappings||[];
    source.layoutMappings=mappings.filter(function(m){return (!m.sheet||m.sheet===parsed.sheetName)&&(!m.signature||SNOWD_CHARACTER_LAYOUT.mappingSignature(parsed,m)===m.signature);});
    var read=SNOWD_CHARACTER_LAYOUT.readAbilities(source,state.classes),sections=read.sections.skills.concat(read.sections.talents,read.sections.blueprints);
    var standard={name:1,tm:3,range:4,dur:5,dr:7,src:8,ds:9};
    var dynamic=read.sections.skills.some(function(s){return ["B122","B167"].indexOf(s.header)<0||Object.keys(standard).some(function(k){return s.fields[k]!==standard[k];});})||read.sections.blueprints.some(function(s){return !/^O(?:172|173|210)$/.test(s.header);});
    return {dynamic:dynamic,sections:sections,parsed:parsed,issues:read.issues};
  }
  function protectAbilityCell(plan,cellRef){
    if(!plan.dynamic)return false;
    var p=SNOWD_CHARACTER_LAYOUT.point(cellRef);if(!p)return false;
    return (p.row>=119&&p.row<=230)||plan.sections.some(function(s){return p.row>=s.start-2&&p.row<s.end&&p.col>=s.nameCol&&p.col<=s.right;});
  }
  function writeAbilityTables(set,state,plan){
    var layout=typeof SNOWD_CHARACTER_LAYOUT!=="undefined"?SNOWD_CHARACTER_LAYOUT:null;
    if(!layout)return;
    (state.importFieldMappings||[]).forEach(function(m){if(m.sheet===plan.parsed.sheetName&&Number.isFinite(Number(state.currency[m.field])))set(m.cellRef,state.currency[m.field]);});
    var g=layout.grid(plan.parsed),nextRow=Math.max(233,g.maxRow+3),all=entries(state);
    function value(e,k,section){
      if(k==="name")return e.n||e.name||"";
      if(k==="src"){var header=section&&g.cells[layout.ref(section.fields.src,section.row||section.start-1)];return header&&layout.normalize(header)==="类别"?(e.rawCategory||e.usageLimit||e.src||e.cls||""):e.src||e.cls||"";}
      if(k==="tier")return e.tier||"";
      if(k==="ds")return e.ds||e.note||e.rawDesc||"";
      if(k==="dr"){var v=e.dr;if(v===undefined||v===null||v==="")v=typeof e.cost!=="object"?e.cost:e.fp;return v==null?"":v;}
      return e[k]==null?"":e[k];
    }
    function fieldMap(section,row){
      var fields={};Object.keys(section.fields).forEach(function(k){fields[k]=layout.ref(section.fields[k],row);});
      if(fields.ds===undefined&&section.inferredDescription){var span=g.span(fields.name),col=span.right+1;if(col<=section.right)fields.ds=layout.ref(col,row);}
      return fields;
    }
    function write(e,fields,place,section){Object.keys(fields).forEach(function(k){set(fields[k],value(e,k,section));});recordWrite(e,fields.name,place,place,fields);}
    if(plan.dynamic){
      all.forEach(function(e){e.writtenToVisible=false;e.cellRef="";delete e._writtenFields;});
      plan.sections.forEach(function(section){
        var capacity=section.end-section.start;
        if(section.capacity!==undefined){var filled=0;for(var r=section.start;r<section.end;r++)if(g.cells[layout.ref(section.nameCol,r)])filled++;capacity=Math.min(capacity,Math.max(section.capacity,filled));}
        var matches=all.filter(function(e){
          if(e.writtenToVisible||e.place!==section.place)return false;
          if(section.place==="talent")return !section.tier||tier(e.tier)===section.tier;
          if(section.auxiliary)return e.provenance&&e.provenance.section===section.header;
          if(e.origin&&(e.origin.type==="equipment"||e.origin.type==="advancement"))return false;
          if(section.ownerClassIndex!==undefined&&e.ownerClassIndex!==undefined)return e.ownerClassIndex===section.ownerClassIndex;
          return true;
        });
        for(var row=section.start;row<section.end;row++){var fields=fieldMap(section,row);Object.keys(fields).forEach(function(k){set(fields[k],"");});}
        for(var i=0;i<matches.length&&i<capacity;i++)write(matches[i],fieldMap(section,section.start+i),section.place,section);
      });
      all.forEach(function(e){(e.mergedNotes||[]).forEach(function(n){if(n.status!=="confirmed"||n.target==="note")set(n.range.split(":")[0],n.raw);});});
    }
    // Every confirmed extra ability and undecided-slot entry has a visible representation.
    var pending=all.filter(function(e){return !e.writtenToVisible&&(plan.dynamic||isCustom(e)||e.occupies===null);});
    ["main","sub","talent","blueprint"].forEach(function(place){
      var group=pending.filter(function(e){return (e.place||"main")===place;});if(!group.length)return;
      var title=place==="talent"?"天赋列表":place==="blueprint"?"图纸(专业槽位)":place==="sub"?"子职业(补充能力)":"额外能力";
      set(layout.ref(1,nextRow++),title);
      var columns=place==="talent"||place==="blueprint"?{name:1,src:3,ds:4,tier:6}:{name:1,tm:3,range:4,dur:5,dr:7,src:8,ds:9};
      var labels={tier:"阶位",name:place==="talent"?"天赋名称":place==="blueprint"?"配方名称":"能力名称",src:"来源",ds:"效果",tm:"施展时间",range:"施展距离",dur:"持续时间",dr:"疲劳消耗"};
      Object.keys(columns).forEach(function(k){set(layout.ref(columns[k],nextRow),labels[k]);});nextRow++;
      group.forEach(function(e){var fields={};Object.keys(columns).forEach(function(k){fields[k]=layout.ref(columns[k],nextRow);});write(e,fields,place);nextRow++;});nextRow+=2;
    });
    var notes=(state.unmappedFields||[]).filter(function(f){return (f.values||[]).length;});
    if(notes.length){set(layout.ref(1,nextRow++),"未分类字段");notes.forEach(function(f){(f.values||[]).forEach(function(v){set(layout.ref(1,nextRow),v.cellRef);set(layout.ref(3,nextRow),String(v.value));nextRow++;});});}
    if((state.importExcluded||[]).length){nextRow+=2;set(layout.ref(1,nextRow++),"导入排除记录");state.importExcluded.forEach(function(e){set(layout.ref(1,nextRow),e.n||e.cellRef||"区块");set(layout.ref(3,nextRow),e.exclusionReason||e.note||"玩家明确排除");nextRow++;});}
    plan.parsed.exportNextRow=nextRow;
  }

  return {attachSupportingSheets:attachSupportingSheets,characterState:characterState,restoreCharacterState:restoreCharacterState,colIndex:colIndex,colName:colName,abilityExportPlan:abilityExportPlan,protectAbilityCell:protectAbilityCell,writeAbilityTables:writeAbilityTables,normalizeName:normalizeName,entries:entries,isCustom:isCustom,isDeferred:isDeferred,fingerprint:fingerprint,slotState:slotState,rawSkillData:rawSkillData,confirmCustom:confirmCustom,removeResolutionIssues:removeResolutionIssues,talentLayout:talentLayout,skillHeaders:skillHeaders,readWorkbook: readWorkbook, readMeta: readMeta, sheet: sheet, sharedStrings: sharedStrings, manifest: manifest, normalizePath: path,
    tier: tier, candidates: candidates, search:search,resolve: resolve, rawEntry: rawEntry, applyMeta: applyMeta, metaXML: metaXML, attachMeta: attachMeta,
    prepareExport: prepareExport, recordWrite: recordWrite, ensureSharedPart: ensureSharedPart, normalizeLegacy: normalizeLegacy, escape: esc };
})();
