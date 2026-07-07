#!/usr/bin/env node
/**
 * Phase 6 batch 12 (7051) — 魔契师升 full
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
const CN = '魔契师';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry warlock full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'warlock_skills') pass('registry warlock_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

const audit = auditClassTier(CN);
if (audit.ready) pass(`warlock audit ${audit.passCount}/${audit.total}`);
else fail('warlock audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/warlock_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('warlock_class full');
else fail('warlock_class');

if (classDoc.startingFeatures?.length >= 4 && classDoc.specializations?.length >= 2) pass('warlock_class starting/specs');
else fail('warlock_class enrich');

if (classDoc.combatStyles?.length >= 5) pass('warlock five styles');
else fail('warlock styles', classDoc.combatStyles?.length);

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/warlock_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /魔棒|宗主|轻甲/.test(r))) pass('warlock equipment rules');
else fail('warlock equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`warlock tips ${tips.tips.length}`);
else fail('warlock tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '魔契' && t.kind === 'style_guide')) pass('warlock 魔契 style_guide');
else fail('warlock pact style tip');

if (tips.tips.some((t) => t.id === 'tip-warlock-cr-pact')) pass('warlock pact combat_rule');
else fail('warlock pact rule');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/魔契师.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '魔契师魔契1到3阶优先学什么' },
);
if (route.promptProfile === 'warlock_skills' && route.layers.includes('L2-warlock')) pass('router L2-warlock');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'warlock_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('魔契师技能') && prompt.includes('full 档')) pass('prompt warlock_skills');
else fail('prompt');

const ret = retrieve('魔契师巫术箭和宗主', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-warlock') || ctx.includes('魔契') || ctx.includes('巫术箭')) pass('retrieve warlock L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7051') pass('registry version 7051');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
