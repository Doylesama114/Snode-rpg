#!/usr/bin/env node
/**
 * Phase 6 batch 4 (7042) — 牧师升 full
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
const CN = '牧师';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry cleric full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'cleric_skills') pass('registry cleric_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

const audit = auditClassTier(CN);
if (audit.ready) pass(`cleric audit ${audit.passCount}/${audit.total}`);
else fail('cleric audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/cleric_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('cleric_class full');
else fail('cleric_class');

if (classDoc.startingFeatures?.length >= 4 && classDoc.specializations?.length >= 2) pass('cleric_class starting/specs');
else fail('cleric_class enrich', classDoc.startingFeatures?.length);

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/cleric_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /神术/.test(r))) pass('cleric equipment rules');
else fail('cleric equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`cleric tips ${tips.tips.length}`);
else fail('cleric tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '虔佑' && t.kind === 'style_guide')) pass('cleric 虔佑 style_guide');
else fail('cleric bless style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/牧师.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '牧师戒律1到3阶优先学什么' },
);
if (route.promptProfile === 'cleric_skills' && route.layers.includes('L2-cleric')) pass('router L2-cleric');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'cleric_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('牧师技能') && prompt.includes('full 档')) pass('prompt cleric_skills');
else fail('prompt');

const ret = retrieve('牧师虔佑治疗优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-cleric') || ctx.includes('虔佑')) pass('retrieve cleric L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7042') pass('registry version 7042');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
