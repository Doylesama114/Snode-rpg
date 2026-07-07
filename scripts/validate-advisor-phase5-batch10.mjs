/**
 * Phase 5 batch 10 (7037) — 档位 checklist + prompt 硬规则
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditAllClasses, auditClassTier, formatTierAuditContext } from './advisor-class-tier.mjs';
import { applyClassRouteFilter } from './advisor-router.mjs';
import { buildSystemPrompt } from './advisor-prompt.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

if (fs.existsSync(path.join(ROOT, 'scripts/build-advisor-class-tier-audit.mjs'))) pass('tier audit build script');
else fail('tier audit build script');

const audit = auditAllClasses();
if (audit.meta.fullReady === 7) pass('7 full ready');
else fail('full ready', audit.meta.fullReady);

if (audit.meta.partialReady === 7) pass('7 partial ready');
else fail('partial ready', audit.meta.partialReady);

for (const cn of ['战士', '奇械师', '德鲁伊']) {
  const a = auditClassTier(cn);
  if (a.ready) pass(`audit ${cn}`);
  else fail(`audit ${cn}`, `${a.passCount}/${a.total}`);
}

const magePrompt = buildSystemPrompt({
  intent: 'mage_skills',
  mode: 'advisor',
  promptProfile: 'mage_skills',
  className: '法师',
  tier: 'full',
});
if (magePrompt.includes('full 档') && magePrompt.includes('塑能箭')) pass('prompt mage full');
else fail('prompt mage full');

const warPrompt = buildSystemPrompt({
  intent: 'class_skills',
  mode: 'advisor',
  promptProfile: 'warrior_skills',
  className: '战士',
  tier: 'full',
});
if (warPrompt.includes('full 档') && warPrompt.includes('战士技能')) pass('prompt warrior full');
else fail('prompt warrior');

const routeWar = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: '战士', query: '战士防护风格优先学什么' },
);
if (routeWar.promptProfile === 'warrior_skills') pass('router warrior promptProfile');
else fail('router warrior', routeWar.promptProfile);

const artPrompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'artificer_skills',
  className: '奇械师',
  tier: 'partial',
});
if (artPrompt.includes('奇械师') && artPrompt.includes('标识系统')) pass('prompt artificer_skills');
else fail('prompt artificer');

const entityPrompt = buildSystemPrompt({ intent: 'entity_qa', mode: 'entity_qa', promptProfile: 'entity_qa' });
if (entityPrompt.includes('套装 A/B/C/D')) pass('prompt entity_qa gear');
else fail('prompt entity_qa');

const routeArt = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: '奇械师', query: '奇械师精准优先学什么' },
);
if (routeArt.promptProfile === 'artificer_skills') pass('router artificer promptProfile');
else fail('router artificer', routeArt.promptProfile);

const retWar = retrieve('战士防护风格小贴士', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '战士' } }),
});
const ctxWar = formatContext(retWar);
if (ctxWar.includes('顾问档位检查') && ctxWar.includes('战士')) pass('context tier audit');
else fail('context tier audit', ctxWar.slice(0, 250));

if (retWar.tier === 'full') pass('retrieve tier full warrior');
else fail('retrieve tier', retWar.tier);

const auditJson = path.join(ROOT, 'advisor/chargen/class_tier_audit.json');
if (fs.existsSync(auditJson)) pass('class_tier_audit.json');
else fail('audit json missing');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
