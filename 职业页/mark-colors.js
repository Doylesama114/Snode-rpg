/**
 * Canonical mark-color helpers shared by class pages + homepage search.
 * Docx sometimes uses nonstandard hex; map them to the official palette.
 */
(function (root) {
  var MARK_HEX_ALIASES = {
    "#808080": "#595959", // 黑
    "#F79646": "#EE822F", // 橙
    "#FF66CC": "#FFB7E3", // 粉
    "#851321": "#843F0B"  // 棕（docx 暗红）
  };

  function normHex(h) {
    if (!h) return "";
    h = String(h).trim().toUpperCase();
    if (h.charAt(0) !== "#") h = "#" + h;
    return h;
  }

  function canonicalizeMarkHex(h) {
    h = normHex(h);
    return MARK_HEX_ALIASES[h] || h;
  }

  root.SNOWD_MARK_HEX_ALIASES = MARK_HEX_ALIASES;
  root.snowdNormHex = normHex;
  root.snowdCanonicalizeMarkHex = canonicalizeMarkHex;
})(typeof window !== "undefined" ? window : globalThis);
