#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 8B: A-tier advancement skills + catalog UI.
 * Run: node scripts/validate-advisor-phase8b.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { getAdvancementCatalog } from './advisor-catalog.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';
import { buildAdvancementSkillsIndex, stripHtml } from './advisor-advancement-extract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

ok('advancement_skills.json', fs.existsSync(path.join(ROOT, 'advisor/advancement_skills.json')));
ok('advisor-advancement-extract.mjs', fs.existsSync(path.join(ROOT, 'scripts/advisor-advancement-extract.mjs')));
ok('advisor-catalog.mjs', fs.existsSync(path.join(ROOT, 'scripts/advisor-catalog.mjs')));

const skillsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/advancement_skills.json'), 'utf8'));
ok('A档 预言家', !!skillsDoc.byName['预言家']?.talents?.length);
ok('A档 诡术师', !!skillsDoc.byName['诡术师']?.talents?.length);
ok('documented confidence', skillsDoc.byName['预言家']?.confidence === 'documented');

const catalog = getAdvancementCatalog(loadSnapshotFile('advisor/snapshots/mock-frost-ready.json'));
ok('catalog >= 65 条', catalog.advancements.length >= 65);
ok('catalog 含 eligibility', catalog.advancements.some((a) => a.name === '冰霜法师' && a.eligibility?.eligible === true));
ok('catalog frost documented flag', catalog.advancements.find((a) => a.name === '冰霜法师')?.documented === false);

const rAdv = retrieve('预言家进阶有什么技能？');
ok('retrieve L3 documentedSkills', (rAdv.results.L3?.documentedSkills || []).some((d) => d.name === '预言家'));
const ctx = formatContext(rAdv);
ok('context 含精准预言', ctx.includes('精准预言'));
ok('context 置信度 documented', ctx.includes('置信度documented'));

ok('stripHtml', stripHtml('<strong>测试</strong>') === '测试');

const widget = read('斯诺德跑团/advisor-widget.js');
ok('widget 进阶 tab', widget.includes('_tab_adv') && widget.includes('进阶'));
ok('widget advisorCatalog', widget.includes('advisorCatalog'));

const preload = read('electron-app/preload.js');
ok('preload advisorCatalog', preload.includes('advisorCatalog'));

const main = read('electron-app/main.js');
ok('main advisor-catalog', main.includes("ipcMain.handle('advisor-catalog'"));

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 8B validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);
