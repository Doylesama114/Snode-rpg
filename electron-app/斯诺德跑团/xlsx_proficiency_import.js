// xlsx 熟练度导入：按模板固定行区读取 E 列标签 → G 列加值（与 xlsx_proficiency_export.js 同构）
// 模板属性块行区：力量36-45 / 敏捷46-56 / 体质57-61 / 智力62-86 / 感知87-99 / 魅力100-109 / 意志110-115 / 幸运116-125
// 用法：scanXlsxProficiencies(cells) → { 属性: { 熟练项: 加值 } }；Node 单测可 require 本文件（window 兜底导出）
(function (root) {
  var PROF_BLOCK_ROWS = [36, 46, 57, 62, 87, 100, 110, 116];
  var PROF_BLOCK_ATTRS = ["力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运"];
  var PROF_BLOCK_END = [46, 57, 62, 87, 100, 110, 116, 146];
  // 各属性块内的合法熟练标签（白名单，防止误收同区其他单元格）
  var PROF_BLOCK_LABELS = {
    "力量": ["豁免", "威力", "承重", "运动-跳跃", "运动-攀爬", "运动-游泳", "运动-自定义"],
    "敏捷": ["豁免", "体操", "骑乘", "隐匿", "巧手-偷窃", "巧手-开锁", "巧手-拆除", "巧手-自定义"],
    "体质": ["豁免", "专注", "耐力"],
    "智力": ["豁免", "宗教", "调查", "估价", "伪造", "读唇", "逻辑", "奥秘-魔法学识", "奥秘-炼金术", "奥秘-神奇道具", "奥秘-多元宇宙", "知识-历史", "知识-地理", "知识-人文", "知识-政治", "知识-神秘学", "知识-工程学", "知识-珠宝学", "知识-草药学", "知识-医药", "知识-烹饪", "知识-自定义"],
    "感知": ["豁免", "洞悉", "导航", "自然", "驯兽", "感悟", "聆听", "察觉", "警惕值"],
    "魅力": ["豁免", "欺瞒", "恐吓", "说服", "表演-歌唱", "表演-舞蹈", "表演-演奏", "表演-自定义"],
    "意志": ["豁免", "求生", "激励", "决策"],
    "幸运": ["豁免", "机遇", "探索"]
  };

  function scanXlsxProficiencies(cells) {
    var profs = {};
    function c(ref) { return cells ? cells[ref] : undefined; }
    for (var ai = 0; ai < PROF_BLOCK_ATTRS.length; ai++) {
      var attr = PROF_BLOCK_ATTRS[ai];
      var start = PROF_BLOCK_ROWS[ai];
      var end = PROF_BLOCK_END[ai];
      var valid = PROF_BLOCK_LABELS[attr] || [];
      for (var r = start; r < end; r++) {
        var label = String(c("E" + r) == null ? "" : c("E" + r)).trim();
        if (!label || label === attr) continue;
        if (valid.indexOf(label) < 0) continue;
        var v = parseInt(c("G" + r), 10);
        if (isNaN(v) || v <= 0) continue;
        if (!profs[attr]) profs[attr] = {};
        profs[attr][label] = v;
      }
    }
    return profs;
  }

  root.scanXlsxProficiencies = scanXlsxProficiencies;
  if (typeof module !== "undefined" && module.exports) module.exports = { scanXlsxProficiencies };
})(typeof window !== "undefined" ? window : globalThis);
