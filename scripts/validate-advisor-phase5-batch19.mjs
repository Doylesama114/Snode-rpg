#!/usr/bin/env node
/**
 * Phase 6 batch 8 (7046) — 萨满祭司升 full
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
const CN = '萨满祭司';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry shaman full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'shaman_skills') pass('registry shaman_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

const audit = auditClassTier(CN);
if (audit.ready) pass(`shaman audit ${audit.passCount}/${audit.total}`);
else fail('shaman audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/shaman_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('shaman_class full');
else fail('shaman_class');

if (classDoc.startingFeatures?.length >= 4 && classDoc.specializations?.length >= 3) pass('shaman_class starting/specs');
else fail('shaman_class enrich');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/shaman_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /图腾/.test(r))) pass('shaman totem rules');
else fail('shaman equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`shaman tips ${tips.tips.length}`);
else fail('shaman tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '风暴' && t.kind === 'style_guide')) pass('shaman 风暴 style_guide');
else fail('shaman storm style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/萨满祭司.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '萨满风暴1到3阶优先学什么' },
);
if (route.promptProfile === 'shaman_skills' && route.layers.includes('L2-shaman')) pass('router L2-shaman');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'shaman_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('萨满祭司技能') && prompt.includes('full 档')) pass('prompt shaman_skills');
else fail('prompt');

const ret = retrieve('萨满有什么流派', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-shaman') || ctx.includes('风暴')) pass('retrieve shaman L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7046') pass('registry version 7046');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
