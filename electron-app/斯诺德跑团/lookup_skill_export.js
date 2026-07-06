// Lazy-load panel_data.js for xlsx export skill field lookup (upload / creation pages)
function lookupSkillForExport(name) {
  if (!name || typeof SKILL_DATA === 'undefined') return null;
  for (var cn in SKILL_DATA) {
    var arr = SKILL_DATA[cn];
    if (!arr) continue;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].name === name || arr[i].n === name) return arr[i];
    }
  }
  return null;
}

var _skillDataLoadPromise = null;
function ensureSkillDataForExport() {
  if (typeof SKILL_DATA !== 'undefined') return Promise.resolve();
  if (_skillDataLoadPromise) return _skillDataLoadPromise;
  _skillDataLoadPromise = new Promise(function (resolve) {
    var s = document.createElement('script');
    s.src = 'panel_data.js';
    s.onload = function () { resolve(); };
    s.onerror = function () { resolve(); };
    document.head.appendChild(s);
  });
  return _skillDataLoadPromise;
}
