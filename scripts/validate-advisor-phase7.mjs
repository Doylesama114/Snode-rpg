#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 7: snapshot + eligibility integration.
 * Run: node scripts/validate-advisor-phase7.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadSnapshotFile,
  analyzeSnapshot,
  normalizeSnapshot,
  sumProf,
  flattenProfs,
} from './advisor-snapshot.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

function frost(advances) {
  return advances.find((a) => a.advancementName === '冰霜法师');
}

function artificerTarget(analysis) {
  return analysis.multiclass.targets.find((t) => t.class === '奇械师');
}

// --- Unit: 3 mock snapshots ---
const ready = loadSnapshotFile('advisor/snapshots/mock-frost-ready.json');
const short = loadSnapshotFile('advisor/snapshots/mock-frost-short.json');
const l7 = loadSnapshotFile('advisor/snapshots/mock-artificer-l7.json');

ok('mock-frost-ready 加载', ready.name === '艾拉' && ready.attrs.智力 === 16);
ok('mock-frost-short 加载', short.attrs.智力 === 14);
ok('mock-artificer-l7 加载', l7.classes[0].level === 7);

const aReady = analyzeSnapshot(ready, { advancementNames: ['冰霜法师'] });
const aShort = analyzeSnapshot(short, { advancementNames: ['冰霜法师'] });
const aL7 = analyzeSnapshot(l7);

ok('艾拉 冰霜法师 ✓', frost(aReady.advancements)?.eligible === true);
ok('伯恩 冰霜法师 ✗', frost(aShort.advancements)?.eligible === false);
ok('伯恩 gaps 智力=1', frost(aShort.advancements)?.gaps?.智力 === 1);
ok('卡琳 L7 等级门槛 ✓', aL7.multiclass.levelOk === true);
ok('卡琳 奇械师兼职 ✓', artificerTarget(aL7)?.eligible === true);

ok('熟练合计 逻辑/奥秘/知识', sumProf(ready.profs, ['逻辑', '奥秘', '知识']) >= 6);
ok('奇械师熟练合计', sumProf(l7.profs, ['巧手', '知识', '逻辑']) >= 6);

// --- Integration: retrieve + snapshot ---
const q6 = '我能走冰霜法师进阶吗？';
const rShort = retrieve(q6, { snapshot: short });
ok('检索含 L6', rShort.layersHit.includes('L6'));
ok('L6 context 含 ✗', formatContext(rShort).includes('冰霜法师') && formatContext(rShort).includes('✗'));

const rReady = retrieve(q6, { snapshot: ready });
ok('艾拉 L6 冰霜 ✓', formatContext(rReady).includes('冰霜法师：✓'));

const rMc = retrieve('现在能兼职奇械师吗？', { snapshot: l7 });
ok('卡琳 兼职 context', formatContext(rMc).includes('奇械师') && formatContext(rMc).includes('✓'));

// --- panel-like raw normalize smoke ---
// --- panel-like nested profs ---
const nestedPanel = normalizeSnapshot({
  name: '嵌套熟练测试',
  attrs: { 智力: 16 },
  profs: { 智力: { 逻辑: 2, '奥秘-魔法学识': 2, '知识-人文': 2 } },
  classes: [{ name: '法师', level: 6 }],
});
ok('panel nested prof sum', sumProf(nestedPanel.profs, ['逻辑', '奥秘', '知识']) >= 6);

const panelLike = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/snapshots/mock-frost-short.json'), 'utf8'));
panelLike._charName = '伯恩';
const norm = normalizeSnapshot(panelLike);
ok('normalize 保留智力', norm.attrs.智力 === 14);
ok('normalize layer L6', norm.meta.layer === 'L6');

// --- CLI smoke (dry-run with snapshot) ---
const { advise } = await import('./mage-advisor.mjs');
const dry = await advise('我能走冰霜法师吗？', {
  dryRun: true,
  snapshot: 'advisor/snapshots/mock-frost-short.json',
});
ok('advise+dry-run snapshot', dry.messages[1].content.includes('L6 角色快照'));
ok('dry-run 含 gaps', dry.messages[1].content.includes('gaps'));

// rules_summary patch
const summaryPath = path.join(ROOT, 'advisor/rules/rules_summary.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
summary.bullets = summary.bullets.filter((b) => !b.startsWith('L6 角色快照'));
summary.bullets.push('L6 角色快照：advisor-snapshot.mjs + 3 mock；与 retrieve/mage-advisor --snapshot 联调');
summary.meta = { ...summary.meta, phase: '7' };
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
ok('rules_summary 含 L6', summary.bullets.some((b) => b.startsWith('L6 角色快照')));

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 7 validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);
