#!/usr/bin/env node
/**
 * Phase 6 batch 13 (7052) — 奇械师升 full（Phase 5 收尾）
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
const CN = '奇械师';

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const profile = getClassProfile(CN);
if (profile.tier === 'full') pass('registry artificer full');
else fail('registry tier', profile.tier);

if (profile.promptProfile === 'artificer_skills') pass('registry artificer_skills');
else fail('promptProfile', profile.promptProfile);

if (profile.isCaster) pass('registry isCaster');
else fail('isCaster');

if (profile.specProfChoices?.length >= 3) pass('registry specProfChoices');
else fail('specProfChoices', profile.specProfChoices);

const audit = auditClassTier(CN);
if (audit.ready) pass(`artificer audit ${audit.passCount}/${audit.total}`);
else fail('artificer audit', audit.checks.filter((c) => !c.pass).map((c) => c.id).join(','));

const classDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/artificer_class.json'), 'utf8'));
if (classDoc.meta?.advisorTier === 'full' && !classDoc.advisorPartialNote) pass('artificer_class full');
else fail('artificer_class');

if (classDoc.startingFeatures?.length >= 4 && classDoc.specializations?.length >= 3) pass('artificer_class starting/specs');
else fail('artificer_class enrich');

if (classDoc.combatStyles?.length >= 6) pass('artificer six styles');
else fail('artificer styles', classDoc.combatStyles?.length);

if (classDoc.timelineNote) pass('artificer timeline note');
else fail('timelineNote');

const equip = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/artificer_equipment_rules.json'), 'utf8'));
if (equip.meta?.advisorTier === 'full' && equip.keyRules.some((r) => /枪械|图纸|同调/.test(r))) pass('artificer equipment rules');
else fail('artificer equipment');

const tips = loadClassTipsFile(CN);
if ((tips.tips?.length || 0) >= 20) pass(`artificer tips ${tips.tips.length}`);
else fail('artificer tips count', tips.tips?.length);

if (tips.tips.some((t) => t.style === '精准' && t.kind === 'style_guide')) pass('artificer 精准 style_guide');
else fail('artificer precision style tip');

if (tips.tips.some((t) => t.id === 'tip-artificer-cr-blueprint')) pass('artificer blueprint combat_rule');
else fail('artificer blueprint rule');

const hints = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/hints/奇械师.json'), 'utf8'));
if (hints.meta?.tier === 'full' && !hints.advisorPartialNote) pass('hints meta full');
else fail('hints tier');

const route = applyClassRouteFilter(
  { intent: 'class_skills', layers: ['L1'], topK: { L1: 6 }, promptProfile: 'class_skills' },
  { className: CN, query: '奇械师精准1到3阶优先学什么' },
);
if (route.promptProfile === 'artificer_skills' && route.layers.includes('L2-artificer')) pass('router L2-artificer');
else fail('router', route.promptProfile, route.layers.join(','));

const prompt = buildSystemPrompt({
  intent: 'class_skills',
  promptProfile: 'artificer_skills',
  className: CN,
  tier: 'full',
});
if (prompt.includes('奇械师技能') && prompt.includes('full 档')) pass('prompt artificer_skills');
else fail('prompt');

const ret = retrieve('奇械师精准优先学什么', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: CN } }),
});
const ctx = formatContext(ret);
if (ctx.includes('L2 奇械师技能') && !ctx.includes('L2 法师技能') && !ctx.includes('部分支持')) pass('retrieve artificer L2 full');
else fail('retrieve ctx', ctx.slice(0, 200));

if (ret.tier === 'full') pass('retrieve tier full');
else fail('retrieve tier', ret.tier);

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.version === '1.0.7052') pass('registry version 7052');
else fail('registry version', reg.meta?.version);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
