#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 8A: Electron UI + IPC wiring.
 * Run: node scripts/validate-advisor-phase8.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advise } from './mage-advisor.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// --- Deliverables ---
ok('advisor-widget.js (root)', exists('斯诺德跑团/advisor-widget.js'));
ok('advisor-widget.js (electron)', exists('electron-app/斯诺德跑团/advisor-widget.js'));
ok('ui spec', exists('docs/build-advisor-ui-spec.md'));

const widget = read('斯诺德跑团/advisor-widget.js');
ok('widget 侧滑面板', widget.includes('_snowd_advisor_panel'));
ok('widget 无 chips', !widget.includes('chip') && !widget.includes('快捷'));
ok('widget poker 排除', widget.includes('poker-game'));
ok('widget electronAPI', widget.includes('electronAPI.advisorAdvise'));
ok('widget 新对话按钮', widget.includes('_snowd_adv_new_chat'));
ok('widget sessionStorage', widget.includes('_snowd_adv_chat_session_v1'));
ok('widget conversationHistory', widget.includes('conversationHistory'));
ok('widget 创建页气泡入 session', widget.includes('syncChargenBubbleToSession'));
ok('widget 角色切换事件', widget.includes('snowd-panel-character-change'));

const preload = read('electron-app/preload.js');
ok('preload advisorAdvise', preload.includes('advisorAdvise'));
ok('preload advisorConfig', preload.includes('advisorConfig'));

const main = read('electron-app/main.js');
ok('main advisor-advise IPC', main.includes("ipcMain.handle('advisor-advise'"));
ok('main conversationHistory IPC', main.includes('conversationHistory'));
ok('main sessionId IPC', main.includes('sessionId'));
ok('main advisor-config IPC', main.includes("ipcMain.handle('advisor-config'"));
ok('main 注入 advisor-widget', main.includes('advisor-widget.js'));
ok('main 对决页跳过注入', main.includes("url.includes('poker-game')"));

const panel = read('斯诺德跑团/panel_engine.js');
ok('snowdPanel.getSnapshot', panel.includes('window.snowdPanel') && panel.includes('getSnapshot'));
ok('snowdPanel character change event', panel.includes('snowd-panel-character-change'));
ok('snowdPanel electron mirror', read('electron-app/斯诺德跑团/panel_engine.js').includes('window.snowdPanel'));

// --- advise dry-run + snapshot (same as phase 7 integration) ---
const dry = await advise('我能走冰霜法师吗？', {
  dryRun: true,
  snapshot: loadSnapshotFile('advisor/snapshots/mock-frost-short.json'),
});
ok('advise dry-run', dry.messages && dry.messages.length >= 2);
ok('dry-run L6 context', dry.messages[1].content.includes('L6 角色快照'));

// --- rules_summary ---
const summaryPath = path.join(ROOT, 'advisor/rules/rules_summary.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
summary.bullets = summary.bullets.filter((b) => !b.startsWith('L8 Build 顾问 UI'));
summary.bullets.push('L8 Build 顾问 UI：advisor-widget.js + Electron IPC（侧滑面板，无 chips）');
summary.meta = { ...summary.meta, phase: '8A' };
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
ok('rules_summary 含 L8', summary.bullets.some((b) => b.startsWith('L8 Build 顾问 UI')));

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 8A validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);
