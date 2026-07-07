#!/usr/bin/env node
/**
 * Phase 6 batch 7 (7045) — 德鲁伊升 full
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
const CN = '德鲁伊';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry druid full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'druid_skills') pass('registry druid_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

const audit = auditClassTier(CN);
if (audit.ready) pass(`druid audit ${audit.passCount}/${audit.total}`);
else fail('druid audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/druid_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('druid_class full');
else fail('druid_class');

if (classDoc.startingFeatures?.length >= 5 && classDoc.specializations?.length >= 3) pass('druid_class starting/specs');
else fail('druid_class enrich');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/druid_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /非金属/.test(r))) pass('druid non-metal armor rule');
else fail('druid equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`druid tips ${tips.tips.length}`);
else fail('druid tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '月影' && t.kind === 'style_guide')) pass('druid 月影 style_guide');
else fail('druid moon style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/德鲁伊.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '德鲁伊月影1到3阶优先学什么' },
);
if (route.promptProfile === 'druid_skills' && route.layers.includes('L2-druid')) pass('router L2-druid');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'druid_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('德鲁伊技能') && prompt.includes('full 档')) pass('prompt druid_skills');
else fail('prompt');

const ret = retrieve('德鲁伊复苏治疗优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-druid') || ctx.includes('复苏')) pass('retrieve druid L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7045') pass('registry version 7045');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
