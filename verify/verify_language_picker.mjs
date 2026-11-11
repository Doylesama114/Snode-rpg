import { chromium } from "playwright";
const ROOT = process.cwd().replace(/\\/g, "/");
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log("  PASS " + n + (x ? "  " + x : "")); } else { fail++; console.log("  FAIL " + n + (x ? "  " + x : "")); } };
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on("pageerror", e => errs.push(String(e.message).slice(0, 60)));
await p.goto("file:///" + ROOT + "/" + encodeURI("斯诺德跑团/角色创建页.html") + "?v=" + Date.now(), { waitUntil: "load" });
await p.waitForTimeout(2300);
const r = await p.evaluate(() => {
  const BGS = (typeof BACKGROUNDS !== "undefined") ? BACKGROUNDS : null;
  if (!BGS) return { err: "no BACKGROUNDS" };
  let bg = null;
  for (const k in BGS) { if (parseBgLangCount(BGS[k]) > 0) { bg = BGS[k]; break; } }
  if (!bg) return { err: "no lang background" };
  let picked = null;
  showLangPicker(bg, function (sel) { picked = sel; });
  const cells = Array.from(document.querySelectorAll(".lang-cell"));
  const find = (n) => cells.find(c => c.getAttribute("data-lang") === n);
  const beast = find("兽语"), elem = find("元素语"), orc = find("兽人语");
  const out = { total: cells.length, count: parseBgLangCount(bg), bgName: bg.name,
    beastDisabled: beast ? beast.getAttribute("data-disabled") === "1" : "missing",
    elemDisabled: elem ? elem.getAttribute("data-disabled") === "1" : "missing",
    orcDisabled: orc ? orc.getAttribute("data-disabled") === "1" : "missing" };
  if (beast) beast.click();
  out.beastStillUnselected = beast ? beast.classList.contains("dark-bg") : false;
  if (orc) orc.click();
  out.orcSelected = orc ? !orc.classList.contains("dark-bg") : false;
  const others = cells.filter(c => !c.getAttribute("data-disabled") && c.getAttribute("data-lang") !== "兽人语");
  for (let i = 0; i < out.count - 1 && i < others.length; i++) others[i].click();
  const cf = document.getElementById("langConfirmBtn"); if (cf) cf.click();
  out.picked = picked ? picked.slice() : null;
  return out;
});
await b.close();
console.log("  背景「" + r.bgName + "」需 " + r.count + " 门 · 语言格 " + r.total + " 个");
ok("兽语不可点击", r.beastDisabled === true);
ok("元素语不可点击", r.elemDisabled === true);
ok("兽人语仍可点击（防误伤）", r.orcDisabled === false);
ok("点击兽语无效", r.beastStillUnselected === true);
ok("兽人语可被选中", r.orcSelected === true);
ok("计数校验未被破坏（回调返回 " + r.count + " 门）", r.picked && r.picked.length === r.count, JSON.stringify(r.picked));
ok("回调不含兽语", r.picked && r.picked.indexOf("兽语") < 0);
ok("无 JS 错误", errs.length === 0, JSON.stringify(errs.slice(0, 2)));
console.log("");
console.log("语言选择器校验: " + pass + "P " + fail + "F");
process.exit(fail === 0 ? 0 : 1);
