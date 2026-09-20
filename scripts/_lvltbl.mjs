import { readFileSync } from "node:fs";
import vm from "node:vm";
const code = readFileSync("斯诺德跑团/panel_data.js", "utf8");
const sb = { JSON, window: {}, document: { title: "" } };
sb.window = sb;
vm.runInNewContext(code + "\n;globalThis.__LT=LEVEL_TABLE;", sb);
const main = sb.__LT["主职业"];
for (const k of Object.keys(main)) {
  const L = main[k];
  if (Number(k) >= 3 && Number(k) <= 14) console.log("L" + k + ":", JSON.stringify(L));
}
