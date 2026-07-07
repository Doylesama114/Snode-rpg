/**
 * Phase 5 batch 5 — Tier B：牧师/圣骑士/游荡者/德鲁伊/萨满/术士
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClassProfile } from './advisor-chargen-registry.mjs';
import { resolveClassL2Layer } from './advisor-router.mjs';
import { loadAdvisorStore, retrieve, formatContext } from './advisor-retrieve.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';
import { loadClassHintsFile } from './advisor-class-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const BATCH = ['牧师', '圣骑士', '游荡者', '德鲁伊', '萨满祭司', '术士'];

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

for (const cn of BATCH) {
  const p = getClassProfile(cn);
  const tierOk = ['牧师', '圣骑士', '游荡者'].includes(cn) ? p.tier === 'full' : (p.tier === 'partial' && p.l2Layer);
  if (tierOk) pass(`registry ${cn}`);
  else fail(`registry ${cn}`, JSON.stringify(p));
}

const store = loadAdvisorStore();
for (const cn of BATCH) {
  const p = getClassProfile(cn);
  const idx = store.classSkillIndexes?.[p.l2Layer];
  if (idx?.skills?.length >= 30) pass(`index ${cn} (${idx.skills.length})`);
  else fail(`index ${cn}`, idx?.skills?.length);
  const hints = loadClassHintsFile(cn);
  if (hints?.styleHints?.length >= 1) pass(`hints ${cn}`);
  else fail(`hints ${cn}`);
}

if (resolveClassL2Layer('德鲁伊') === 'L2-druid') pass('resolve druid');
else fail('resolve druid');

const retRog = retrieve('游荡者职业树可以玩什么流派', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '游荡者' } }),
});
if ((retRog.results['L2-rogue'] || []).length > 0) pass('retrieve rogue L2');
else fail('retrieve rogue L2');
const ctxRog = formatContext(retRog);
if (ctxRog.includes('奇袭') && !ctxRog.includes('L2 法师技能')) pass('rogue styles no mage');
else fail('rogue ctx', ctxRog.slice(0, 300));

const retSham = retrieve('萨满有什么流派');
if (retSham.retrievalClass === '萨满祭司' && (retSham.results['L2-shaman'] || []).length > 0) {
  pass('萨满 alias → 萨满祭司');
} else fail('shaman alias', retSham.retrievalClass);

const retWar = retrieve('战士职业树可以玩什么流派', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '战士' } }),
});
if ((retWar.results['L2-warrior'] || []).length > 0) pass('batch1 warrior regression');
else fail('warrior regression');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
