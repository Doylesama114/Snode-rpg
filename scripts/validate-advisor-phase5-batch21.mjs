#!/usr/bin/env node
/**
 * Phase 6 batch 10 (7049) — 武僧升 full
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
const CN = '武僧';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry monk full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'monk_skills') pass('registry monk_skills');
else fail('promptProfile', profile.promptProfile);

if (!profile.isCaster) pass('registry not caster');
else fail('isCaster unexpected');

const audit = auditClassTier(CN);
if (audit.ready) pass(`monk audit ${audit.passCount}/${audit.total}`);
else fail('monk audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/monk_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('monk_class full');
else fail('monk_class');

if (classDoc.startingFeatures?.length >= 4 && classDoc.specializations?.length >= 3) pass('monk_class starting/specs');
else fail('monk_class enrich');

if (classDoc.combatStyles?.length >= 7) pass('monk seven styles');
else fail('monk styles', classDoc.combatStyles?.length);

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/monk_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /真气|徒手|拳刃/.test(r))) pass('monk equipment rules');
else fail('monk equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`monk tips ${tips.tips.length}`);
else fail('monk tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '极斗' && t.kind === 'style_guide')) pass('monk 极斗 style_guide');
else fail('monk jido style tip');

if (tips.tips.some((t) => t.id === 'tip-monk-cr-qi')) pass('monk qi combat_rule');
else fail('monk qi rule');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/武僧.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '武僧极斗1到3阶优先学什么' },
);
if (route.promptProfile === 'monk_skills' && route.layers.includes('L2-monk')) pass('router L2-monk');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'monk_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('武僧技能') && prompt.includes('full 档')) pass('prompt monk_skills');
else fail('prompt');

const ret = retrieve('武僧真气怎么用', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-monk') || ctx.includes('极斗') || ctx.includes('猛虎掌')) pass('retrieve monk L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7049') pass('registry version 7049');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
