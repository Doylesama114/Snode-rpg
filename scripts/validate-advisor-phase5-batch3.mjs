/**
 * Phase 5 batch 3 — 奇械师 Tier B（partial）：技能索引 + L2-artificer 路由
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

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile('奇械师');
if (profile.tier === 'partial' && profile.l2Layer === 'L2-artificer') pass('registry artificer partial + l2Layer');
else fail('registry artificer', JSON.stringify(profile));

const idxPath = path.join(ADVISOR, 'skills', 'artificer_index.json');
const classPath = path.join(ADVISOR, 'chargen', 'artificer_class.json');
const hintsPath = path.join(ADVISOR, 'chargen', 'hints', '奇械师.json');
if (fs.existsSync(idxPath)) {
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  if (idx.skills?.length >= 90) pass('artificer_index count');
  else fail('artificer_index count', idx.skills?.length);
} else fail('artificer_index missing');

if (fs.existsSync(classPath)) pass('artificer_class.json');
else fail('artificer_class.json');

const hints = loadClassHintsFile('奇械师');
if (hints?.styleHints?.length >= 6 && hints.advisorPartialNote) pass('奇械师 hints');
else fail('奇械师 hints');

const store = loadAdvisorStore();
if (store.artificerSkills?.skills?.length >= 90) pass('store loads artificerSkills');
else fail('store artificerSkills');

if (resolveClassL2Layer('奇械师') === 'L2-artificer') pass('resolveClassL2Layer artificer');
else fail('resolveClassL2Layer artificer');

if (resolveClassL2Layer('战士') == null) pass('resolveClassL2Layer warrior null');
else fail('resolveClassL2Layer warrior');

const routeArt = applyClassRouteFilter(
  { id: 'general', intent: 'general', layers: ['L0', 'L1', 'L2-mage'], topK: { 'L2-mage': 12 }, promptProfile: 'general' },
  { className: '奇械师', query: '奇械师怎么选起始特性' },
);
if (routeArt.layers.includes('L2-artificer') && !routeArt.layers.includes('L2-mage')) {
  pass('router injects L2-artificer for 奇械师');
} else fail('router artificer layers', routeArt.layers);

const routeWar = applyClassRouteFilter(
  { id: 'general', intent: 'general', layers: ['L0', 'L1', 'L2-mage'], topK: { 'L2-mage': 12 }, promptProfile: 'general' },
  { className: '战士', query: '战士技能' },
);
if (!routeWar.layers.includes('L2-artificer') && !routeWar.layers.includes('L2-mage')) {
  pass('router blocks both L2 for warrior');
} else fail('router warrior L2', routeWar.layers);

const retArt = retrieve('奇械师精准1-3级优先学什么', {
  mode: 'advisor',
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '奇械师' } }),
});
if ((retArt.results['L2-artificer'] || []).length > 0) pass('retrieve artificer L2');
else fail('retrieve artificer L2');

const ctxArt = formatContext(retArt);
if (ctxArt.includes('L2 奇械师技能') && !ctxArt.includes('L2 法师技能') && ctxArt.includes('部分支持')) {
  pass('formatContext artificer no mage bleed');
} else fail('formatContext artificer', ctxArt.slice(0, 300));

const retMage = retrieve('塑能1-3级优先学什么', {
  mode: 'advisor',
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '法师' } }),
});
if ((retMage.results['L2-mage'] || []).length > 0 && !(retMage.results['L2-artificer'] || []).length) {
  pass('retrieve mage still L2-mage only');
} else fail('retrieve mage cross bleed');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
