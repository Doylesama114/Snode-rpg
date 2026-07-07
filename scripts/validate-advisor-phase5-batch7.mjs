/**
 * Phase 5 batch 7 (7034) — 全职业实体卡 + 起手套装 + 装备规则
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listRegistryClassNames } from './advisor-class-content.mjs';
import { routeQuery } from './advisor-router.mjs';
import { loadAdvisorStore, retrieve, formatContext } from './advisor-retrieve.mjs';
import { resolveEntities, formatEntityCard } from './advisor-entities.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

if (fs.existsSync(path.join(__dirname, 'build-advisor-class-infra.mjs'))) pass('infra build script');
else fail('infra build script');

const classEntities = loadJson('entities/classes.json');
if (classEntities.meta?.count === 14 && classEntities.entities?.length === 14) pass('14 class entity cards');
else fail('class entity count', classEntities.meta?.count);

const allNames = listRegistryClassNames();
for (const cn of allNames) {
  const card = classEntities.entities.find((e) => e.name === cn);
  if (card?.entityType === 'class' && card.keyAttr) pass(`entity card ${cn}`);
  else fail(`entity card ${cn}`);
}

const prof = loadJson('chargen/proficiencies.json');
const pickCount = Object.keys(prof.classSkillPick || {}).length;
if (pickCount === 14) pass('classSkillPick 14 classes');
else fail('classSkillPick count', pickCount);

const store = loadAdvisorStore();
const gearNames = Object.keys(store.classStartingGearByName || {});
const rulesNames = Object.keys(store.classEquipmentRulesByName || {});
if (gearNames.length === 14) pass('starting gear loaded (14)');
else fail('starting gear count', gearNames.length);
if (rulesNames.length === 14) pass('equipment rules loaded (14)');
else fail('equipment rules count', rulesNames.length);

const warriorGear = store.classStartingGearByName['战士'];
if (warriorGear?.kits?.A && warriorGear?.kits?.D) pass('warrior kits A–D');
else fail('warrior kits');

const hits = resolveEntities('战士起始套装', store.entities);
if (hits.some((h) => h.entityType === 'class' && h.id === '战士')) pass('entity resolve warrior gear');
else fail('entity resolve warrior', hits.map((h) => h.id));

const warriorHit = hits.find((h) => h.id === '战士');
const cardText = warriorHit?.formatted || formatEntityCard(warriorHit?.card);
if (cardText.includes('套装 A') || cardText.includes('起始装备')) pass('entity card shows gear');
else fail('entity card gear text', cardText?.slice(0, 200));

const routed = routeQuery({
  query: '战士起始套装选什么',
  mode: 'entity_qa',
});
if (routed.intent === 'entity_qa' && routed.mode === 'entity_qa') pass('router entity_qa warrior gear');
else fail('router entity_qa', routed.intent, routed.mode);

const ret = retrieve('战士起始套装有哪些', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 6, char: { className: '战士' } }),
});
const ctx = formatContext(ret);
if (ctx.includes('起始套装 A') && ctx.includes('短剑')) pass('retrieve warrior starting kits');
else fail('retrieve warrior kits', ctx.slice(0, 400));

const retMage = retrieve('法师起始套装', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 6, char: { className: '法师' } }),
});
const ctxMage = formatContext(retMage);
if (ctxMage.includes('起始套装') && ctxMage.includes('魔棒')) pass('mage starting gear intact');
else fail('mage gear', ctxMage.slice(0, 400));

for (const slug of ['warrior', 'cleric', 'warlock']) {
  const gearFile = path.join(ADVISOR, 'chargen', `${slug}_starting_gear.json`);
  const rulesFile = path.join(ADVISOR, 'chargen', `${slug}_equipment_rules.json`);
  if (fs.existsSync(gearFile) && fs.existsSync(rulesFile)) pass(`files ${slug}`);
  else fail(`files ${slug}`);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
