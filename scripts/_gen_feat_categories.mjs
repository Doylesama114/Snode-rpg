import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("职业页/特殊专长.html", "utf8");
const cats = {};
const re = /<article class="skill" id="feat-\d+"[^>]*data-category="([^"]+)"[^>]*>\s*<h4>([^<]+?) <span/g;
let m, n = 0;
while ((m = re.exec(html)) !== null) {
  const name = m[2].trim();
  cats[name] = m[1];
  n++;
}
console.log("articles parsed:", n);
const names = Object.keys(cats).sort();
const obj = {};
for (const nm of names) obj[nm] = cats[nm];
writeFileSync("scripts/_feat_categories.json", JSON.stringify(obj, null, 0), "utf8");
const panel = readFileSync("斯诺德跑团/panel_data.js", "utf8");
const marker = "const SPECIAL_FEATS = {";
if (panel.indexOf("const SPECIAL_FEAT_CATEGORIES") >= 0) {
  console.log("categories const already present, skipping insert");
} else {
  const block = "// 特殊专长分类（源自 职业页/特殊专长.html data-category；供专长选择器筛选与一致性校验）\nconst SPECIAL_FEAT_CATEGORIES = JSON.parse('" + JSON.stringify(obj) + "');\n\n";
  const next = panel.replace(marker, block + marker);
  writeFileSync("斯诺德跑团/panel_data.js", next, "utf8");
  console.log("inserted SPECIAL_FEAT_CATEGORIES (" + n + " entries)");
}
