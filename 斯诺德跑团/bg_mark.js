/* 个性背景色彩标识（26.10.22 色彩标识重做）
 * 数据来源：BG_PERSONALITY[背景].colors[traits|ideals|bonds|flaws]，与文本数组下标对齐。
 * 颜色语义见 help.html「技能点和色彩标识规则」。
 */
(function (root) {
  'use strict';

  /* 工作簿色值 -> 项目色名（与 panel_engine.js 的 MARK_COLOR_NAMES 一致） */
  var NAMES = {
    '#FF0000': '红色', '#F79646': '橙色', '#FFFF00': '黄色', '#FFC000': '黄色',
    '#00B050': '绿色', '#00FA99': '青色', '#00B0F0': '蓝色', '#B3F9FF': '浅色',
    '#D2B7FF': '紫色', '#FFB7E3': '粉色', '#AC6520': '棕色', '#595959': '黑色',
    '#FFFFFF': '白色'
  };
  var SHORT = {
    '#FF0000': '红', '#F79646': '橙', '#FFFF00': '黄', '#FFC000': '黄',
    '#00B050': '绿', '#00FA99': '青', '#00B0F0': '蓝', '#B3F9FF': '浅',
    '#D2B7FF': '紫', '#FFB7E3': '粉', '#AC6520': '棕', '#595959': '黑',
    '#FFFFFF': '白'
  };
  /* 浅色系：色块需要深描边才看得见 */
  var LIGHT = {
    '#FFFFFF': 1, '#FFFF00': 1, '#FFC000': 1, '#00FA99': 1,
    '#FFB7E3': 1, '#B3F9FF': 1, '#D2B7FF': 1
  };
  var NONE = '#FFFFFF';
  /* 状态字段（state.personality 等） -> 数据字段（BG_PERSONALITY[bg].colors.traits 等） */
  var FIELDS = ['personality', 'ideals', 'bonds', 'flaws'];
  var DATA_KEY = { personality: 'traits', ideals: 'ideals', bonds: 'bonds', flaws: 'flaws' };

  function norm(hex) {
    if (!hex) return NONE;
    var h = String(hex).trim().toUpperCase();
    if (h.charAt(0) !== '#') h = '#' + h;
    return NAMES[h] ? h : NONE;
  }
  function name(hex) { return NAMES[norm(hex)]; }
  function short(hex) { return SHORT[norm(hex)]; }
  /* 导出/文本用： （黄） */
  function text(hex) { return '（' + short(hex) + '）'; }

  /* 12x12 色块；浅色自动加深色描边 */
  function dot(hex, size) {
    var h = norm(hex);
    var s = size || 12;
    var light = LIGHT[h] ? 1 : 0;
    var border = light ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.5)';
    return '<span class="bg-mark-dot" data-mark="' + h + '" style="display:inline-block;flex:0 0 auto;width:' + s +
      'px;height:' + s + 'px;border-radius:2px;background:' + h + ';border:1px solid ' + border +
      ';vertical-align:middle;margin-right:5px;box-shadow:0 0 0 1px rgba(255,255,255,0.55) inset"></span>';
  }

  /* 色块 + 色名，例如 [■] 黄色 */
  function badge(hex, size) {
    return dot(hex, size) + "<span class='bg-mark-name'>" + name(hex) + '</span>';
  }

  function data() { return root.BG_PERSONALITY || null; }

  /* 按文本精确回查颜色；自定义内容返回 '' */
  function colorOf(bg, field, value) {
    var all = data();
    if (!all || !bg || !field || !value) return '';
    var item = all[bg];
    if (!item || !item.colors) return '';
    var texts = item[field] || [];
    var colors = item.colors[field] || [];
    var v = String(value).trim();
    for (var i = 0; i < texts.length; i++) {
      if (String(texts[i]).trim() === v) return colors[i] || NONE;
    }
    return '';
  }

  /* 从 "；" 连接的多选里拆出每一项，附颜色（field 用状态字段名：personality/ideals/bonds/flaws） */
  function choicesOf(state, field, bgName) {
    var raw = (state && state[field]) || '';
    if (!raw) return [];
    var bg = bgName || (state && state.background) || '';
    var dataKey = DATA_KEY[field] || field;
    var parts = String(raw).split(/[；;]/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var v = parts[i].trim();
      if (!v) continue;
      var hex = colorOf(bg, dataKey, v);
      out.push({ text: v, hex: hex, custom: !hex });
    }
    return out;
  }

  /* 本角色个性背景提供的色彩标识（只读派生，不写存档） */
  function marksOf(state, bgName) {
    var bg = bgName || (state && state.background) || '';
    var seen = {};
    var list = [];
    for (var f = 0; f < FIELDS.length; f++) {
      var items = choicesOf(state, FIELDS[f], bg);
      for (var i = 0; i < items.length; i++) {
        var hex = items[i].hex;
        if (!hex) continue;
        var h = norm(hex);
        if (seen[h] === undefined) {
          seen[h] = list.length;
          list.push({ hex: h, name: name(h), short: short(h), count: 1 });
        } else {
          list[seen[h]].count++;
        }
      }
    }
    return list;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 渲染一个字段的多选值，每项前置色块；自定义项显示灰色问号 */
  function marked(state, field, bgName) {
    var items = choicesOf(state, field, bgName);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.custom) {
        out.push("<span class='bg-mark-dot' style='display:inline-block;width:12px;height:12px;border-radius:2px;background:#e9e5dc;border:1px dashed #b9b3a6;vertical-align:middle;margin-right:5px;text-align:center;line-height:11px;font-size:9px;color:#8a8478'>?</span>" + esc(it.text));
      } else {
        out.push(dot(it.hex) + esc(it.text));
      }
    }
    return out.join('<span style="color:#c9c4b8">；</span>');
  }

  /* “色彩标识：● 红 ● 蓝（共 N 项）” */
  function marksLine(state, bgName) {
    var list = marksOf(state, bgName);
    if (!list.length) return '';
    var parts = [];
    for (var i = 0; i < list.length; i++) {
      parts.push(dot(list[i].hex, 12) + "<span style='margin-right:8px'>" + list[i].name + (list[i].count > 1 ? '×' + list[i].count : '') + '</span>');
    }
    return parts.join('');
  }

  /* 导出用：每项后附 （色名），自定义项原样输出 */
  function textOf(state, field, bgName) {
    var raw = (state && state[field]) || '';
    if (!raw) return '';
    var items = choicesOf(state, field, bgName);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (!items[i].text) continue;
      out.push(items[i].custom ? items[i].text : (items[i].text + text(items[i].hex)));
    }
    return out.length ? out.join('；') : raw;
  }

  /* 导入用：剥离文本末尾的 （色名） */
  var SUFFIX_RE = /[（(]\s*(红|橙|黄|绿|青|蓝|浅|紫|粉|棕|白|黑)色?\s*[)）]\s*$/;
  function stripSuffix(text) {
    if (!text) return text;
    return String(text).replace(SUFFIX_RE, '');
  }

  root.BgMark = {
    NAMES: NAMES, SHORT: SHORT, LIGHT: LIGHT, NONE: NONE, FIELDS: FIELDS,
    norm: norm, name: name, short: short, text: text, esc: esc,
    dot: dot, badge: badge, marked: marked, marksLine: marksLine,
    colorOf: colorOf, choicesOf: choicesOf, marksOf: marksOf,
    textOf: textOf, stripSuffix: stripSuffix
  };
})(typeof window !== 'undefined' ? window : globalThis);
