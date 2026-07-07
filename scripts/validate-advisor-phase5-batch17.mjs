#!/usr/bin/env node
/**
 * Phase 6 batch 6 (7044) — 游荡者升 full
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
const CN = '游荡者';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry rogue full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'rogue_skills') pass('registry rogue_skills');
else fail('promptProfile', profile.promptProfile);

const audit = auditClassTier(CN);
if (audit.ready) pass(`rogue audit ${audit.passCount}/${audit.total}`);
else fail('rogue audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/rogue_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('rogue_class full');
else fail('rogue_class');

if (classDoc.startingFeatures?.length >= 4 && classDoc.specializations?.length >= 3) pass('rogue_class starting/specs');
else fail('rogue_class enrich');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/rogue_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /火枪|手弩/.test(r))) pass('rogue firearm rules');
else fail('rogue equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`rogue tips ${tips.tips.length}`);
else fail('rogue tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '奇袭' && t.kind === 'style_guide')) pass('rogue 奇袭 style_guide');
else fail('rogue sneak style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/游荡者.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '游荡者奇袭1到3阶优先学什么' },
);
if (route.promptProfile === 'rogue_skills' && route.layers.includes('L2-rogue')) pass('router L2-rogue');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'rogue_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('游荡者技能') && prompt.includes('full 档')) pass('prompt rogue_skills');
else fail('prompt');

const ret = retrieve('游荡者魔药风格优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-rogue') || ctx.includes('魔药')) pass('retrieve rogue L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7044') pass('registry version 7044');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
