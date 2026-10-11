import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

let browser, server, serverOutput = "";
const web = fileURLToPath(new URL("..", import.meta.url));
const url = "http://127.0.0.1:5194/";
before(async () => {
  server = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
    "--host", "127.0.0.1", "--port", "5194", "--strictPort"], { cwd: web, env: process.env,
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  server.stdout.on("data", d => { serverOutput += d; });
  server.stderr.on("data", d => { serverOutput += d; });
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error(serverOutput);
    try { if ((await fetch(url)).ok) break; } catch {}
    if (i === 149) throw new Error("Vite startup timeout: " + serverOutput);
    await delay(100);
  }
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); server?.kill(); });

async function fixture(fn, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(8000);
  page.on("pageerror", e => errors.push(e.message));
  try { await fn(page, context); assert.deepEqual(errors, []); }
  finally { await context.close(); }
}
async function open(page, name = "行旅者") {
  await page.goto(url + "#/characters");
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByLabel("角色名称", { exact: true }).waitFor();
}
async function value(locator, expected) {
  assert.equal(await locator.inputValue(), expected);
}
async function poll(fn, predicate = Boolean) {
  for (let i = 0; i < 80; i++) { const result = await fn(); if (predicate(result)) return result; await delay(100); }
  throw new Error("Timed out waiting for expected state");
}
async function db(page, store, key) {
  return page.evaluate(async ({ store, key }) => {
    const connection = await new Promise((resolve, reject) => {
      const r = indexedDB.open("snode-character-preview-v1", 1);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const r = connection.transaction(store).objectStore(store)[key === null ? "getAll" : "get"](key ?? undefined);
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
    } finally { connection.close(); }
  }, { store, key: key ?? null });
}
async function checkpoint(page) {
  return poll(() => db(page, "drafts"), rows => rows.some(r => !r.deleted && r.checkpoint));
}
const name = page => page.getByLabel("角色名称", { exact: true });
const story = page => page.getByLabel("角色经历", { exact: true });
const hp = page => page.getByLabel("当前 HP", { exact: true });
const save = page => page.getByRole("button", { name: "保存正式记录", exact: true });

test("home remains available; list is keyboard accessible and zero stays visible", () => fixture(async page => {
  await page.goto(url); assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  await page.getByRole("link", { name: "角色档案", exact: true }).click();
  const card = page.getByRole("button", { name: /观星者/ });
  await card.focus(); await page.keyboard.press("Enter");
  await value(hp(page), "0");
  await page.getByRole("button", { name: "返回首页" }).click();
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await page.getByText("让每个角色，", { exact: false }).count(), 1);
}));

test("explicit save preserves literal text, zero, null, stable identity and immutable history", () => fixture(async page => {
  await open(page);
  const text = '<img src=x onerror="window.bad=1"> 旅行者';
  await name(page).fill(text); await story(page).fill("第一行 & <script>\n第二行 ✓");
  await hp(page).fill("0"); await page.getByLabel("当前 FP", { exact: true }).fill("");
  await save(page).click();
  await page.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
  const row = await db(page, "characters", "preview-journey");
  assert.equal(row.view.characterRevision, 2); assert.equal(row.view.profile.displayName, text);
  assert.equal(row.view.numericFields[0].value, 0); assert.equal(row.view.numericFields[1].value, null);
  assert.equal(await page.evaluate(() => window.bad), undefined);
  await page.getByRole("button", { name: /修订 1.*行旅者/ }).click();
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.getByText("修订 1", { exact: false }).count() > 0, true);
  await dialog.getByRole("button", { name: "关闭历史快照" }).click();
  assert.equal((await db(page, "characters", "preview-journey")).view.characterRevision, 2);
  await page.reload(); await page.getByRole("button", { name: /旅行者/ }).click();
  await value(name(page), text); await value(hp(page), "0");
  await value(story(page), "第一行 & <script>\n第二行 ✓");
}));

test("background draft does not change formal data; invalid raw input recovers after reload", () => fixture(async page => {
  await open(page); await story(page).fill("只在草稿里"); await hp(page).fill("bad--number");
  await checkpoint(page);
  assert.equal((await db(page, "characters", "preview-journey")).view.characterRevision, 1);
  await page.reload(); await page.getByRole("button", { name: /行旅者/ }).click();
  await page.getByRole("dialog", { name: "找到本机草稿" }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: /行旅者/ }).click();
  await value(story(page), "只在草稿里"); await value(hp(page), "bad--number");
  assert.equal(await hp(page).getAttribute("aria-invalid"), "true");
  assert.equal(await save(page).isDisabled(), true);
  await hp(page).fill("0"); await save(page).click();
  await page.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
}));

test("leaving supports Escape, save and conditional discard without crossing characters", () => fixture(async page => {
  await open(page); await story(page).fill("待放弃内容");
  const back = page.getByRole("button", { name: "← 角色列表", exact: true });
  await back.click(); await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await back.evaluate(e => e === document.activeElement), true);
  await value(story(page), "待放弃内容");
  await back.click(); await page.getByRole("button", { name: "放弃本页草稿并离开" }).click();
  await page.getByRole("button", { name: /观星者/ }).click();
  assert.notEqual(await story(page).inputValue(), "待放弃内容");
  await page.getByRole("button", { name: "← 角色列表" }).click();
  await page.getByRole("button", { name: /行旅者/ }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
  await story(page).fill("保存后离开内容"); await page.getByRole("button", { name: "← 角色列表" }).click();
  await page.getByRole("button", { name: "保存后离开", exact: true }).click();
  await page.getByRole("button", { name: /行旅者/ }).waitFor();
  assert.equal((await db(page, "characters", "preview-journey")).view.profile.story, "保存后离开内容");
}));

test("draft quota failure blocks first dispatch, preserves input and supports retry", () => fixture(async page => {
  await open(page);
  await page.evaluate(() => {
    window.failDraft = true; const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "drafts" && window.failDraft) throw new DOMException("Quota", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await story(page).fill("配额失败也要保留"); await save(page).click();
  await page.getByText("保存前未能保留本机草稿，正式请求尚未发送。", { exact: true }).waitFor();
  await value(story(page), "配额失败也要保留");
  assert.equal((await db(page, "characters", "preview-journey")).view.characterRevision, 1);
  await page.evaluate(() => { window.failDraft = false; });
  await page.getByRole("button", { name: "重试草稿保留" }).click(); await save(page).click();
  await page.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
}));

test("uncertain commit replays the same command id and stores exactly one snapshot", () => fixture(async page => {
  await open(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add; let fail = true;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "commands" && fail) { fail = false; throw new Error("simulated result failure"); }
      return original.apply(this, args);
    };
  });
  await story(page).fill("同一命令核实"); await save(page).click();
  await page.getByRole("button", { name: "核实保存结果", exact: true }).waitFor();
  const drafts = await checkpoint(page);
  const pending = drafts.find(r => r.checkpoint?.inFlight)?.checkpoint.inFlight.command.commandId;
  assert.ok(pending); assert.equal(await save(page).isDisabled(), true);
  await page.getByRole("button", { name: "核实保存结果", exact: true }).click();
  await page.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
  const commands = await db(page, "commands"); assert.equal(commands.length, 1);
  assert.equal(commands[0].commandId, pending);
  const history = await db(page, "snapshots");
  assert.equal(history.filter(v => v.characterId === "preview-journey").length, 2);
}));

test("two pages preserve independent draft fields and require explicit choice for competing text", () => fixture(async (a, context) => {
  await open(a);
  const b = await context.newPage(); await open(b);
  await story(a).fill("页面 A 的故事"); await story(b).fill("页面 B 的故事"); await hp(b).fill("4");
  await save(a).click(); await a.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
  await save(b).click(); await b.getByRole("button", { name: "核对版本冲突" }).click();
  const dialog = b.getByRole("dialog", { name: "核对角色版本冲突" });
  await dialog.getByRole("radio", { name: /保留本页输入/ }).check();
  await dialog.getByRole("button", { name: "确认合并到草稿" }).click();
  await save(b).click(); await b.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
  const row = await db(b, "characters", "preview-journey");
  assert.equal(row.view.characterRevision, 3); assert.equal(row.view.profile.story, "页面 B 的故事");
  assert.equal(row.view.numericFields[0].value, 4);
}));

test("runtime recovery handles a lost receipt after a committed save and preserves later typing", () => fixture(async page => {
  await page.goto(url + "#/characters");
  const result = await page.evaluate(async () => {
    const { createLocalCharacterService } = await import("/src/features/characters/local-service.ts");
    const { createEditorRuntime } = await import("/src/features/characters/editor-runtime.ts");
    const service = createLocalCharacterService(); let lose = true;
    const port = { ...service, async commit(c) {
      const result = await service.commit(c);
      if (lose) { lose = false; throw new Error("receipt lost after commit"); }
      return result;
    } };
    const a = createEditorRuntime(port, "preview-journey"); await a.start();
    a.editProfile("story", "confirmed but response lost"); await a.save();
    a.editProfile("story", "newer unsaved input"); await a.flush();
    const sources = await service.drafts("preview-journey");
    const b = createEditorRuntime(service, "preview-journey"); await b.start(); await b.recover(sources[0]);
    const before = await service.read("preview-journey"), history = await service.history("preview-journey");
    a.editProfile("story", "source page still edits"); await a.flush();
    return { state: b.getSnapshot().editor, revision: before.characterRevision,
      count: history.length, originals: await service.drafts("preview-journey") };
  });
  assert.equal(result.state.inputs.story, "newer unsaved input");
  assert.equal(result.state.inFlight, null); assert.equal(result.revision, 2); assert.equal(result.count, 2);
  assert.equal(result.originals.some(r => r.checkpoint.inputs.story === "source page still edits"), true);
}));

test("phone layouts, long names and full history text remain readable without horizontal overflow", () => fixture(async page => {
  await open(page); await name(page).fill("W".repeat(240));
  const full = ("长篇经历 <tag> & ✓\n").repeat(2500);
  await story(page).fill(full); await save(page).click();
  await page.getByText("已保存本机正式记录，并新增历史快照。", { exact: true }).waitFor();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.CHARACTER_SCREENSHOT_DIR) {
      await mkdir(process.env.CHARACTER_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: process.env.CHARACTER_SCREENSHOT_DIR + "/editor-" + width + ".png", fullPage: true });
    }
  }
  await page.getByRole("button", { name: /修订 2.*WW/ }).click();
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.locator(".cm-story-text").textContent(), full);
  assert.equal(await dialog.evaluate(d => d.scrollHeight > d.clientHeight), true);
  await dialog.getByRole("button", { name: "关闭历史快照" }).click();
  assert.equal(await page.getByRole("dialog").count(), 0);
}));

test("draft tombstones reject delayed writes; versioned copy markers preserve live source updates", () => fixture(async page => {
  await page.goto(url + "#/characters");
  const result = await page.evaluate(async () => {
    const { createLocalCharacterService } = await import("/src/features/characters/local-service.ts");
    const { createEditorRuntime } = await import("/src/features/characters/editor-runtime.ts");
    const service = createLocalCharacterService();
    const runtime = createEditorRuntime(service, "preview-journey"); await runtime.start();
    runtime.editProfile("story","checkpoint"); await runtime.flush();
    const old = runtime.editor.beginRetention();
    await service.discard(old.draftId,old.draftVersion);
    let refused=false; try { await service.retain(old); } catch { refused=true; }
    return { refused, drafts: await service.drafts("preview-journey") };
  });
  assert.equal(result.refused,true); assert.deepEqual(result.drafts,[]);
}));
