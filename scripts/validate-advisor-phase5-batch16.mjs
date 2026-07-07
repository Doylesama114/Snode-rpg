#!/usr/bin/env node
/**
 * Phase 6 batch 5 (7043) — 圣骑士升 full
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
const CN = '圣骑士';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry paladin full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'paladin_skills') pass('registry paladin_skills');
else fail('promptProfile', profile.promptProfile);

const audit = auditClassTier(CN);
if (audit.ready) pass(`paladin audit ${audit.passCount}/${audit.total}`);
else fail('paladin audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/paladin_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('paladin_class full');
else fail('paladin_class');

if (classDoc.startingFeatures?.length >= 5 && classDoc.specializations?.length >= 3) pass('paladin_class starting/specs');
else fail('paladin_class enrich');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/paladin_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /枪械/.test(r))) pass('paladin no firearms rule');
else fail('paladin equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`paladin tips ${tips.tips.length}`);
else fail('paladin tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '惩戒' && t.kind === 'style_guide')) pass('paladin 惩戒 style_guide');
else fail('paladin smite style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/圣骑士.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '圣骑士惩戒1到3阶优先学什么' },
);
if (route.promptProfile === 'paladin_skills' && route.layers.includes('L2-paladin')) pass('router L2-paladin');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'paladin_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('圣骑士技能') && prompt.includes('full 档')) pass('prompt paladin_skills');
else fail('prompt');

const ret = retrieve('圣骑士守护风格护盾优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-paladin') || ctx.includes('守护')) pass('retrieve paladin L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
const v = reg.meta?.version || '';
if (v >= '1.0.7043') pass('registry version ' + v);
else fail('registry version', v);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
