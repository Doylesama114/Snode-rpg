/**
 * Phase 5 batch 2 — universal tips, tier routing, anti cross-class
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectTipsPool } from './advisor-class-content.mjs';
import { applyClassRouteFilter } from './advisor-router.mjs';
import { loadAdvisorStore, retrieve, formatContext } from './advisor-retrieve.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const uni = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'combos', 'universal_tips.json'), 'utf8'));
if (uni.tips.length >= 10) pass('universal_tips count');
else fail('universal_tips count', uni.tips.length);

if (uni.tips.some((t) => t.scope === 'universal' && t.title.includes('反应种类'))) pass('universal reaction tip');
else fail('universal reaction tip');

const hintsDir = path.join(ADVISOR, 'chargen', 'hints');
const tipsDir = path.join(ADVISOR, 'combos', 'class_tips');
if (fs.existsSync(path.join(hintsDir, '战士.json'))) pass('warrior hints shell');
else fail('warrior hints shell');
if (fs.existsSync(path.join(tipsDir, '战士.json'))) pass('warrior tips shell');
else fail('warrior tips shell');

const store = loadAdvisorStore();
const warriorPool = collectTipsPool(store, '战士');
const magePool = collectTipsPool(store, '法师');
if (warriorPool.some((t) => t.scope === 'universal') && !warriorPool.some((t) => t.title.includes('塑能'))) {
  pass('warrior tips no mage style');
} else fail('warrior tips pool', warriorPool.map((t) => t.title).join(','));

if (magePool.some((t) => t.kind === 'style_guide') && warriorPool.some((t) => t.kind === 'style_guide')) {
  pass('class tips pools style_guide');
} else fail('tips pool style_guide', `mage ${magePool.length} warrior ${warriorPool.length}`);

const routeWar = applyClassRouteFilter(
  { layers: ['L0', 'L1', 'L2-mage'], topK: { 'L2-mage': 12 }, intent: 'general' },
  { className: '战士', query: '战士怎么加点' },
);
if (!routeWar.layers.includes('L2-mage')) pass('router blocks L2-mage for warrior');
else fail('router warrior', routeWar.layers);

const routeMage = applyClassRouteFilter(
  { layers: ['L0', 'L1', 'L2-mage'], topK: { 'L2-mage': 12 }, intent: 'mage_skills' },
  { className: '法师', query: '塑能优先学什么' },
);
if (routeMage.layers.includes('L2-mage')) pass('router allows L2-mage for mage');
else fail('router mage', routeMage.layers);

const retWar = retrieve('借机攻击规则是什么', {
  mode: 'advisor',
  wizardState: chargenToWizardState({
    source: 'chargen_page',
    step: 4,
    char: { className: '战士', selectedSkills: ['运动-跳跃', '运动-攀爬', '运动-游泳', '体操'] },
  }),
});
const ctxWar = formatContext(retWar);
if (!ctxWar.includes('L2 法师技能') && (ctxWar.includes('借机') || ctxWar.includes('L5'))) {
  pass('retrieve warrior no mage L2');
} else fail('retrieve warrior ctx', ctxWar.slice(0, 200));

const retMage = retrieve('塑能1-3级优先学什么', {
  mode: 'advisor',
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '法师' } }),
});
if ((retMage.results['L2-mage'] || []).length > 0) pass('retrieve mage L2');
else fail('retrieve mage L2');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
