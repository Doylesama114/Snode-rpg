/* 职业页 · 血量/疲劳计算器
 * 依赖：hp_calc_data.js（提供 REF_CLASSES/REF_RACES/REF_BACKGROUNDS）
 *       ../斯诺德跑团/character_stats.js（提供 SNOWD_CHARACTER_STATS.totalHP / totalFP）
 * 说明：计算完全复用权威实现，保证与角色面板结果一致。
 */
var SnowdHpCalc = (function () {
  function mod(v) { return Math.floor((Number(v) - 10) / 2); }
  function signed(n) { n = Number(n) || 0; return (n >= 0 ? '+' : '') + n; }
  function opts(map, sel) {
    return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + k + '</option>'; }).join('');
  }
  function mount(container, className) {
    if (!container) return;
    if (typeof SNOWD_HP_SRC === 'undefined' || typeof SNOWD_CHARACTER_STATS === 'undefined') {
      container.innerHTML = '<p class="hpcalc-err">计算器数据未加载（缺少 hp_calc_data.js 或 character_stats.js）</p>';
      return;
    }
    var C = SNOWD_HP_SRC.classes[className];
    if (!C) { container.innerHTML = '<p class="hpcalc-err">未找到职业「' + className + '」的血量数据</p>'; return; }
    var races = SNOWD_HP_SRC.races, bgs = SNOWD_HP_SRC.backgrounds;
    var keys = String(C.keyAttrRaw || '').split('或').filter(Boolean);
    var defKey = keys[0] || '体质';
    var firstRace = races['人类'] ? '人类' : Object.keys(races)[0];
    var h = '';
    h += '<div class="hpcalc-head"><h2>血量 / 疲劳计算器</h2>';
    h += '<p class="hpcalc-intro">本页职业：<b>' + className + '</b>。数值直接取自与角色面板相同的计算实现，因此结果与面板一致。</p></div>';
    h += '<div class="hpcalc-grid">';
    h += '<label class="hpcalc-f">等级<input type="number" id="hpLevel" min="1" max="20" step="1" value="1"></label>';
    h += '<label class="hpcalc-f">体质<input type="number" id="hpCon" min="1" max="30" step="1" value="10"></label>';
    if (keys.length > 1) h += '<label class="hpcalc-f">关键属性<select id="hpKeyName">' + opts(keys.reduce(function (o, k) { o[k] = 1; return o; }, {}), defKey) + '</select></label>';
    h += '<label class="hpcalc-f">' + defKey + '值<input type="number" id="hpKeyVal" min="1" max="30" step="1" value="10"></label>';
    h += '<label class="hpcalc-f">种族<select id="hpRace">' + opts(races, firstRace) + '</select></label>';
    h += '<label class="hpcalc-f" id="hpSizeWrap" style="display:none">体型<select id="hpSize"></select></label>';
    h += '<label class="hpcalc-f">个性背景<select id="hpBg"><option value="">（不选）</option>' + opts(bgs, '') + '</select></label>';
    h += '<label class="hpcalc-f hpcalc-check"><input type="checkbox" id="hpTough"> 健壮专长（+2 生命 × 选择后的等级）</label>';
    h += '<label class="hpcalc-f" id="hpToughLvWrap" style="display:none">健壮选择等级<select id="hpToughLv"></select></label>';
    h += '</div>';
    h += '<div class="hpcalc-out" id="hpOut"></div>';
    h += '<h3 class="hpcalc-sub">1–20 级速查表</h3><div class="hpcalc-tableWrap"><table class="hpcalc-table" id="hpTable"></table></div>';
    container.innerHTML = h;
    var $ = function (id) { return document.getElementById(id); };
    function readSize() {
      var r = races[$('hpRace').value] || {};
      var b = r.hp_bonus;
      if (typeof b === 'string' && b.indexOf('/') >= 0) {
        var parts = b.split('/');
        var sel = $('hpSize');
        if (sel && !sel.options.length) sel.innerHTML = '<option value="' + parts[0] + '">' + parts[0] + '（小体型）</option><option value="' + parts[1] + '">' + parts[1] + '（中/大体型）</option>';
        var wrap = $('hpSizeWrap'); if (wrap) wrap.style.display = '';
        return sel && sel.value ? sel.value : parts[1];
      }
      var wrap2 = $('hpSizeWrap'); if (wrap2) wrap2.style.display = 'none';
      return '';
    }
    function calc(level) {
      var S = SNOWD_CHARACTER_STATS;
      var con = Number($('hpCon').value) || 10;
      var ka = $('hpKeyName') ? $('hpKeyName').value : defKey;
      var kv = Number($('hpKeyVal').value) || 10;
      var race = $('hpRace').value;
      var bg = $('hpBg').value;
      var size = readSize();
      var tough = $('hpTough').checked;
      var lv = Math.max(1, Math.min(20, Number(level) || 1));
      var pickLv = Number($('hpToughLv') && $('hpToughLv').value) || 4;
      var effective = Math.max(0, lv - pickLv + 1);
      var fb = tough ? 2 * effective : 0;
      return { hp: S.totalHP(className, lv, '', 0, con, race, bg, fb, size), fp: S.totalFP(className, lv, '', 0, ka, kv, race, fb), con: con, ka: ka, kv: kv, race: race, bg: bg, size: size, level: lv, tough: tough, pickLv: pickLv, effective: effective, fb: fb };
    }
    function render() {
      var S = SNOWD_CHARACTER_STATS;
      var lv = Math.max(1, Math.min(20, Number($('hpLevel').value) || 1));
      $('hpLevel').value = lv;
      var r = calc(lv);
      var one = calc(1);
      var raceB = SNOWD_HP_SRC.races[r.race] || {};
      var bgB = SNOWD_HP_SRC.backgrounds[r.bg] || {};
      var cm = mod(r.con);
      var rHp = (typeof raceB.hp_bonus === 'number') ? raceB.hp_bonus : (r.size ? Number(r.size) : 0);
      var perHp = (C.hp.up + cm), perFp = C.fp.up;
      var o = '';
      o += '<div class="hpcalc-cards">';
      o += '<div class="hpcalc-card"><div class="hpcalc-k">' + lv + ' 级 生命值</div><div class="hpcalc-v">' + r.hp + '</div></div>';
      o += '<div class="hpcalc-card"><div class="hpcalc-k">' + lv + ' 级 疲劳值</div><div class="hpcalc-v">' + r.fp + '</div></div>';
      o += '<div class="hpcalc-card"><div class="hpcalc-k">1 级（初始）</div><div class="hpcalc-v">' + one.hp + ' / ' + one.fp + '</div></div>';
      o += '<div class="hpcalc-card"><div class="hpcalc-k">每级成长</div><div class="hpcalc-v">生命 ' + signed(perHp) + ' · 疲劳 ' + signed(perFp) + '</div></div>';
      o += '</div>';
      o += '<div class="hpcalc-formula">';
      o += '<div class="hpcalc-line"><b>生命值</b>：' + C.hp.first + '（职业基础）' + signed(cm) + '（体质 ' + r.con + ' → 调整 ' + signed(cm) + '）' + signed(rHp) + '（' + r.race + '）' + signed(bgB.hp_bonus || 0) + '（背景）' ;
      o += ' + [' + C.hp.up + '（职业每级）' + signed(cm) + '（体质每级）] × ' + (lv - 1) + '（等级 − 1）';
      if (r.tough) o += ' + 2 × ' + r.effective + '（健壮：' + r.pickLv + ' 级起，' + (r.effective ? r.pickLv + '→' + lv + ' 共 ' + r.effective + ' 级' : '当前等级不足 ' + r.pickLv + ' 级，暂不生效') + '）= ' + signed(r.fb);
      o += ' = <b>' + r.hp + '</b></div>';
      o += '<div class="hpcalc-line"><b>疲劳值</b>：' + C.fp.first + '（职业基础）' + signed(mod(r.kv)) + '（' + r.ka + ' ' + r.kv + ' → 调整 ' + signed(mod(r.kv)) + '）' + signed(raceB.fp_bonus || 0) + '（' + r.race + '）';
      o += ' + ' + C.fp.up + '（职业每级，疲劳不受属性影响）× ' + (lv - 1) + ' = <b>' + r.fp + '</b></div>';
      o += '<div class="hpcalc-note">升级公式：<b>生命</b> 每级 +' + C.hp.up + ' + 体质调整值；<b>疲劳</b> 每级 +' + C.fp.up + '（不加属性调整）。</div>';
      o += '</div>';
      $('hpOut').innerHTML = o;
      var wrapW = ($('hpTable').parentNode ? $('hpTable').parentNode.clientWidth : 600) || 600;
      var cols = Math.max(1, Math.min(4, Math.floor(wrapW / 175)));
      var perCol = Math.ceil(20 / cols);
      var head = '<thead><tr>';
      for (var cI = 0; cI < cols; cI++) head += '<th class="mc-lv mc-g' + (cI % 4) + '">等级</th><th>生命</th><th>疲劳</th>';
      head += '</tr></thead><tbody>';
      var body = '', x;
      for (var rI = 0; rI < perCol; rI++) {
        body += '<tr>';
        for (var cJ = 0; cJ < cols; cJ++) {
          var lvX = rI + 1 + cJ * perCol;
          if (lvX > 20) { body += '<td class="hpcalc-empty" colspan="3"></td>'; continue; }
          x = calc(lvX);
          var on = (lvX === lv) ? ' on3' : '';
          var g = ' mc-lv mc-g' + (cJ % 4);
          body += '<td class="mc-x' + g + on + '">' + lvX + '</td><td class="mc-x' + on + '">' + x.hp + '</td><td class="mc-x' + on + '">' + x.fp + '</td>';
        }
        body += '</tr>';
      }
      $('hpTable').innerHTML = head + body + '</tbody>';
    }
    ['hpLevel', 'hpCon', 'hpKeyVal', 'hpRace', 'hpBg', 'hpSize'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('input', render), el.addEventListener('change', render); });
    var kn = $('hpKeyName'); if (kn) kn.addEventListener('change', render);
    var rt = null;
    window.addEventListener('resize', function () { if (rt) clearTimeout(rt); rt = setTimeout(render, 150); });
    (function initTough() {
      var sel = $('hpToughLv');
      var lvls = (SNOWD_HP_SRC && SNOWD_HP_SRC.toughPickLevels) || [4, 8, 13];
      sel.innerHTML = lvls.map(function (v) { return '<option value="' + v + '">' + v + ' 级</option>'; }).join('');
      function sync() { var w = $('hpToughLvWrap'); if (w) w.style.display = $('hpTough').checked ? '' : 'none'; render(); }
      $('hpTough').addEventListener('change', sync);
      sel.addEventListener('change', render);
    })();
    render();
  }
  return { mount: mount, mod: mod };
})();
