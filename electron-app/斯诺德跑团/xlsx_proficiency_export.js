// xlsx 熟练度导出：解析模板 E 列标签 → 写入 G 列加值（与 panel_engine 一致）
function fillXlsxProficiencies(set, xml, strings, state) {
  if (!state || !state.profs || !xml || !strings || typeof set !== "function") return;
  var profMap = {};
  var attrRows = [36, 46, 57, 62, 87, 100, 110, 116];
  var attrNames = ["力量", "敏捷", "体质", "智力", "感知", "魅力", "意志", "幸运"];
  var profRe = /<c r="E(\d+)"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g;
  var m;
  while ((m = profRe.exec(xml)) !== null) {
    var rowNum = parseInt(m[1], 10);
    var si = parseInt(m[2], 10);
    if (si < strings.length) {
      var label = strings[si];
      var attr = "";
      var ai;
      for (ai = attrRows.length - 1; ai >= 0; ai--) {
        if (rowNum >= attrRows[ai] && (ai === attrRows.length - 1 || rowNum < attrRows[ai + 1])) {
          attr = attrNames[ai];
          break;
        }
      }
      if (label === "豁免" && attr) profMap[attr + "::豁免"] = rowNum;
      profMap[label] = rowNum;
    }
  }
  for (var pk in state.profs) {
    var pv = state.profs[pk];
    if (!pv || typeof pv !== "object") continue;
    for (var sk in pv) {
      var sv = pv[sk];
      if (sv === 0 || sv === undefined || sv === false) continue;
      var key = (sk === "豁免") ? (pk + "::豁免") : sk;
      var targetRow = profMap[key];
      if (targetRow) set("G" + targetRow, sv);
    }
  }
}
