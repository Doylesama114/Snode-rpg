#!/usr/bin/env node
/**
 * Phase 6 batch 9 (7047) — 术士升 full
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
const CN = '术士';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry sorcerer full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'sorcerer_skills') pass('registry sorcerer_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

const audit = auditClassTier(CN);
if (audit.ready) pass(`sorcerer audit ${audit.passCount}/${audit.total}`);
else fail('sorcerer audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/sorcerer_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('sorcerer_class full');
else fail('sorcerer_class');

if (classDoc.startingFeatures?.length >= 3 && classDoc.specializations?.length >= 3) pass('sorcerer_class starting/specs');
else fail('sorcerer_class enrich');

if (classDoc.startingChoice === 'all') pass('sorcerer starting all granted');
else fail('sorcerer startingChoice', classDoc.startingChoice);

if (profile.startingFeaturePick === 'all') pass('registry startingFeaturePick all');
else fail('registry startingFeaturePick', profile.startingFeaturePick);

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/sorcerer_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /轻甲|混沌|幸运/.test(r))) pass('sorcerer equipment rules');
else fail('sorcerer equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`sorcerer tips ${tips.tips.length}`);
else fail('sorcerer tips count', tips.tips?.length);

if (tips.tips.some((t) => t.id === 'tip-sorcerer-cr-start' && /全得|自动获得|无需选择/.test(t.summary + t.title))) pass('sorcerer starting combat_rule');
else fail('sorcerer start rule');

if (tips.tips.some((t) => t.style === '潜能' && t.kind === 'style_guide')) pass('sorcerer 潜能 style_guide');
else fail('sorcerer potential style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/术士.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '术士潜能1到3阶优先学什么' },
);
if (route.promptProfile === 'sorcerer_skills' && route.layers.includes('L2-sorcerer')) pass('router L2-sorcerer');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'sorcerer_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('术士技能') && prompt.includes('full 档')) pass('prompt sorcerer_skills');
else fail('prompt');

const ret = retrieve('术士混沌法术怎么玩', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-sorcerer') || ctx.includes('混沌')) pass('retrieve sorcerer L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7048') pass('registry version 7048');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
