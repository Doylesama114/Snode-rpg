import { readFileSync } from "node:fs";
import vm from "node:vm";
const code = readFileSync("斯诺德跑团/panel_data.js", "utf8");
const sandbox = { JSON, window: {}, document: { title: "" } };
sandbox.window = sandbox;
try {
  vm.runInNewContext(code + "\n;globalThis.__SF = SPECIAL_FEATS;", sandbox, { filename: "panel_data.js" });
  const keys = Object.keys(sandbox.__SF || {});
  console.log("SPECIAL_FEATS keys =", keys.length);
  const legacy = keys.filter(k => k === "质朴" || k === "额外槽位");
  console.log("legacy:", JSON.stringify(legacy));
  const want = ["武器精通", "嗜血者", "额外槽", "卷轴助理", "鲜明特点"];
  for (const w of want) {
    const fd = sandbox.__SF[w];
    console.log(w + ":", fd ? "ok type=" + fd.effects.type + " prereq=" + fd.prerequisite.slice(0, 20) : "MISSING");
  }
  const extra = sandbox.__SF["额外槽"];
  console.log("额外槽 extra_slot:", JSON.stringify(extra && extra.effects.extra_slot));
} catch (e) {
  console.log("PARSE ERROR:", String(e.message).slice(0, 400));
  process.exit(1);
}
