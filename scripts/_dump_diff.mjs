import { readFileSync } from "node:fs";
import vm from "node:vm";
const html = readFileSync("职业页/特殊专长.html", "utf8");
const targets = ["共享钱袋", "影界触碰", "意外横财", "特别彩蛋", "第四面墙"];
const artRe = /<article class="skill" id="feat-\d+"[\s\S]*?<\/article>/g;
let m;
const pageMap = {};
while ((m = artRe.exec(html)) !== null) {
  const art = m[0];
  const nameM = /<h4>([^<]+?) <span class="chip"/.exec(art);
  if (!nameM) continue;
  const name = nameM[1].trim();
  if (targets.indexOf(name) < 0) continue;
  const effRe = /<div class="effect-cell">([\s\S]*?)<\/div>/g;
  const cells = []; let em;
  while ((em = effRe.exec(art)) !== null) cells.push(em[1].trim());
  const noteRe = /<div class="note-cell">([\s\S]*?)<\/div>/g;
  const notes = []; let nm;
  while ((nm = noteRe.exec(art)) !== null) notes.push(nm[1].trim());
  pageMap[name] = { cells, notes };
}
const code = readFileSync("斯诺德跑团/panel_data.js", "utf8");
const sb = { JSON, window: {}, document: { title: "" } };
sb.window = sb;
vm.runInNewContext(code + "\n;globalThis.__SF=SPECIAL_FEATS;", sb);
for (const t of targets) {
  console.log("=== " + t + " === page cells:");
  for (const c of pageMap[t].cells) console.log("  [" + c + "]");
  for (const n of pageMap[t].notes) console.log("  (note) [" + n + "]");
  console.log("  panel desc: " + (sb.__SF[t] && sb.__SF[t].effects.description));
}
