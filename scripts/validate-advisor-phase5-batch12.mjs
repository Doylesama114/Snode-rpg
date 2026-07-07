#!/usr/bin/env node
/**
 * Phase 6 batch 1 (7039) — 战士升 full
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClassProfile } from './advisor-chargen-registry.mjs';
import { auditClassTier } from './advisor-class-tier.mjs';
import { applyClassRouteFilter } from './advisor-router.mjs';
import { buildSystemPrompt } from './advisor-prompt.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';
import { loadClassTipsFile } from './advisor-class-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile('战士');
if (profile.tier === 'full') pass('registry warrior full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'warrior_skills') pass('registry warrior_skills');
else fail('promptProfile', profile.promptProfile);

const audit = auditClassTier('战士');
if (audit.ready) pass(`warrior audit ${audit.passCount}/${audit.total}`);
else fail('warrior audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/warrior_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('warrior_class full');
else fail('warrior_class');

if (classDoc.hpFormula?.first && classDoc.multiclassRequirements?.class === '战士') pass('warrior_class hp/mc');
else fail('warrior_class enrich');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/warrior_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /盾牌/.test(r))) pass('warrior_equipment_rules');
else fail('warrior equipment');

const tips = loadClassTipsFile('战士');
if ((tips.tips?.length || 0) >= 20) pass(`warrior tips ${tips.tips.length}`);
else fail('warrior tips count', tips.tips?.length);

if (!tips.tips.some((t) => t.id === 'tip-warrior-partial-note')) pass('no partial meta tip');
else fail('partial tip remains');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/战士.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: '战士', query: '战士狂攻1到3阶优先学什么' },
);
if (route.promptProfile === 'warrior_skills' && route.layers.includes('L2-warrior')) pass('router L2-warrior');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'warrior_skills',
  className: '战士',
  tier: 'full',
});
if (prompt.includes('战士技能') && prompt.includes('full 档')) pass('prompt warrior_skills');
else fail('prompt');

const ret = retrieve('战士防护风格1到3阶优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '战士' } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-warrior') || ctx.includes('防护')) pass('retrieve warrior L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7040') pass('registry version 7040');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
