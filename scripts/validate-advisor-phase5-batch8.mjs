/**
 * Phase 5 batch 8 (7035) — advancement_details.js 全量 documented
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAdvancementDetails } from './advisor-advancement-extract.mjs';
import { retrieve, formatContext, loadAdvisorStore } from './advisor-retrieve.mjs';
import { getAdvancementCatalog } from './advisor-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const detailNames = loadAdvancementDetails().map((d) => d.name);
const skillsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/advancement_skills.json'), 'utf8'));
const advDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/advancements.json'), 'utf8'));

if (skillsDoc.meta?.documentedCount === 55) pass('55 documented in advancement_skills');
else fail('documented count', skillsDoc.meta?.documentedCount);

for (const name of detailNames) {
  if (skillsDoc.byName[name]?.confidence === 'documented') pass(`skill ${name}`);
  else fail(`skill ${name}`);
}

if (advDoc.meta?.catalogCount >= 65) pass(`catalog ${advDoc.meta.catalogCount}`);
else fail('catalog count', advDoc.meta?.catalogCount);

const berserk = advDoc.advancements.find((a) => a.name === '狂战士');
if (berserk?.confidence === 'documented') pass('catalog 狂战士 documented');
else fail('catalog 狂战士', berserk?.confidence);

const frost = advDoc.advancements.find((a) => a.name === '冰霜法师');
if (frost?.confidence === 'documented') pass('冰霜法师 now documented');
else fail('frost confidence', frost?.confidence);

const store = loadAdvisorStore();
if (Object.keys(store.advancementSkills.byName).length === 55) pass('store loads 55 skills');
else fail('store skill count');

const retBerserk = retrieve('狂战士进阶有什么技能');
if ((retBerserk.results.L3?.documentedSkills || []).some((d) => d.name === '狂战士' || d.advancementName === '狂战士')) {
  pass('retrieve 狂战士 documentedSkills');
} else fail('retrieve 狂战士', retBerserk.results.L3?.documentedSkills?.length);
const ctxBerserk = formatContext(retBerserk);
if (ctxBerserk.includes('置信度documented')) pass('context 狂战士 documented');
else fail('context 狂战士', ctxBerserk.slice(0, 300));

const retProphet = retrieve('预言家进阶有什么技能');
const ctxProphet = formatContext(retProphet);
if (ctxProphet.includes('精准预言')) pass('预言家 talents intact');
else fail('预言家 context');

const catalog = getAdvancementCatalog();
if (catalog.meta.documentedCount === 55) pass('catalog documentedCount');
else fail('catalog documentedCount', catalog.meta.documentedCount);
if (catalog.advancements.find((a) => a.name === '守护骑士')?.documented) pass('catalog 守护骑士 flag');
else fail('catalog 守护骑士');

const retKnight = retrieve('守护骑士进阶技能');
const ctxKnight = formatContext(retKnight);
if (ctxKnight.includes('守护骑士') && ctxKnight.includes('documented')) pass('retrieve 守护骑士');
else fail('retrieve 守护骑士', ctxKnight.slice(0, 250));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
