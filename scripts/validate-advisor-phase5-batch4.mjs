/**
 * Phase 5 batch 4 — 通用 L2-class + 物理系 Tier B（战士/蛮斗士/猎人/武僧）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClassProfile } from './advisor-chargen-registry.mjs';
import { applyClassRouteFilter, resolveClassL2Layer } from './advisor-router.mjs';
import { loadAdvisorStore, retrieve, formatContext } from './advisor-retrieve.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';
import { loadClassHintsFile } from './advisor-class-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const PHYSICAL = ['战士', '蛮斗士', '猎人', '武僧'];

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

if (fs.existsSync(path.join(__dirname, 'advisor-class-l2.mjs'))) pass('advisor-class-l2 module');
else fail('advisor-class-l2 module');

for (const cn of PHYSICAL) {
  const p = getClassProfile(cn);
  const tierOk = (cn === '战士' || cn === '蛮斗士') ? p.tier === 'full' : p.tier === 'partial';
  if (tierOk && p.l2Layer && p.l2Slug) pass(`registry ${cn}`);
  else fail(`registry ${cn}`, JSON.stringify(p));
}

const store = loadAdvisorStore();
for (const cn of PHYSICAL) {
  const p = getClassProfile(cn);
  const idx = store.classSkillIndexes?.[p.l2Layer];
  if (idx?.skills?.length > 40) pass(`index ${cn} (${idx.skills.length})`);
  else fail(`index ${cn}`, idx?.skills?.length);
  if (store.classBasicsByName?.[cn]) pass(`class doc ${cn}`);
  else fail(`class doc ${cn}`);
  const hints = loadClassHintsFile(cn);
  if (hints?.styleHints?.length >= 3) pass(`hints ${cn} styles`);
  else fail(`hints ${cn}`, hints?.styleHints?.length);
}

if (resolveClassL2Layer('战士') === 'L2-warrior') pass('resolve L2 warrior');
else fail('resolve L2 warrior');

const routeWar = applyClassRouteFilter(
  { id: 'general', intent: 'general', layers: ['L0', 'L1'], topK: {}, promptProfile: 'general' },
  { className: '战士', query: '战士流派' },
);
if (routeWar.layers.includes('L2-warrior') && !routeWar.layers.includes('L2-mage')) pass('router warrior L2');
else fail('router warrior', routeWar.layers);

const retBare = retrieve('战士职业树可以玩什么流派');
const ctxBare = formatContext(retBare);
if (!ctxBare.includes('L2 法师技能') && !ctxBare.includes('风格 塑能')) pass('bare query no mage bleed');
else fail('bare query mage bleed', ctxBare.slice(0, 250));

const retWar = retrieve('战士职业树可以玩什么流派', {
  mode: 'advisor',
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '战士' } }),
});
if ((retWar.results['L2-warrior'] || []).length > 0) pass('retrieve warrior L2');
else fail('retrieve warrior L2');
const ctxWar = formatContext(retWar);
if (ctxWar.includes('L2 战士技能') && ctxWar.includes('斗争')) pass('warrior style in context');
else fail('warrior context', ctxWar.slice(0, 400));

const retMage = retrieve('塑能1-3级优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '法师' } }),
});
if ((retMage.results['L2-mage'] || []).length > 0) pass('mage L2 intact');
else fail('mage L2');

const retArt = retrieve('奇械师精准优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '奇械师' } }),
});
if ((retArt.results['L2-artificer'] || []).length > 0) pass('artificer L2 intact');
else fail('artificer L2');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
