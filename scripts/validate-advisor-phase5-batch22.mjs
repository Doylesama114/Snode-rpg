#!/usr/bin/env node
/**
 * Phase 6 batch 11 (7050) — 吟游诗人升 full
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
const CN = '吟游诗人';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry bard full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'bard_skills') pass('registry bard_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

const audit = auditClassTier(CN);
if (audit.ready) pass(`bard audit ${audit.passCount}/${audit.total}`);
else fail('bard audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/bard_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('bard_class full');
else fail('bard_class');

if (classDoc.startingFeatures?.length >= 5 && classDoc.specializations?.length >= 3) pass('bard_class starting/specs');
else fail('bard_class enrich');

if (classDoc.combatStyles?.length >= 5) pass('bard five styles');
else fail('bard styles', classDoc.combatStyles?.length);

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/bard_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /火枪|乐器|轻甲/.test(r))) pass('bard equipment rules');
else fail('bard equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`bard tips ${tips.tips.length}`);
else fail('bard tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '激昂' && t.kind === 'style_guide')) pass('bard 激昂 style_guide');
else fail('bard jiang style tip');

if (tips.tips.some((t) => t.id === 'tip-bard-cr-rhythm')) pass('bard rhythm combat_rule');
else fail('bard rhythm rule');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/吟游诗人.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '吟游诗人激昂1到3阶优先学什么' },
);
if (route.promptProfile === 'bard_skills' && route.layers.includes('L2-bard')) pass('router L2-bard');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'bard_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('吟游诗人技能') && prompt.includes('full 档')) pass('prompt bard_skills');
else fail('prompt');

const ret = retrieve('吟游诗人团队增益学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-bard') || ctx.includes('激昂') || ctx.includes('激励')) pass('retrieve bard L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
const v = reg.meta?.version || '';
if (v >= '1.0.7050') pass('registry version ' + v);
else fail('registry version', v);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
