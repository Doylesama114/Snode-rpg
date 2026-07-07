#!/usr/bin/env node
/**
 * Phase 6 batch 3 (7041) — 猎人升 full
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
const CN = '猎人';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry hunter full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'hunter_skills') pass('registry hunter_skills');
else fail('promptProfile', profile.promptProfile);

const audit = auditClassTier(CN);
if (audit.ready) pass(`hunter audit ${audit.passCount}/${audit.total}`);
else fail('hunter audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hunter_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('hunter_class full');
else fail('hunter_class');

if (classDoc.hpFormula?.first && classDoc.multiclassRequirements?.class === CN) pass('hunter_class hp/mc');
else fail('hunter_class enrich');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hunter_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /枪械|远程/.test(r))) pass('hunter equipment rules');
else fail('hunter equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`hunter tips ${tips.tips.length}`);
else fail('hunter tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '兽群' && t.kind === 'style_guide')) pass('hunter 兽群 style_guide');
else fail('hunter beast style tip');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/猎人.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '猎人射击1到3阶优先学什么' },
);
if (route.promptProfile === 'hunter_skills' && route.layers.includes('L2-hunter')) pass('router L2-hunter');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'hunter_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('猎人技能') && prompt.includes('full 档')) pass('prompt hunter_skills');
else fail('prompt');

const ret = retrieve('猎人生存风格陷阱优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2-hunter') || ctx.includes('生存')) pass('retrieve hunter L2');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7041') pass('registry version 7041');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
