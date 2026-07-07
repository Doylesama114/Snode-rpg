#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 3 outputs + eligibility unit tests.
 * Run: node scripts/validate-advisor-phase3.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkEligibility, checkAdvancementEligibility } from './advisor-eligibility.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const advancements = loadJson('advisor/advancements.json');
const feats = loadJson('advisor/feats.json');
const mageAdvSource = loadJson('职业页/数据/法师·进阶.json');
const featsSource = loadJson('职业页/数据/特殊专长.json');
const featsEffects = loadJson('斯诺德跑团/skill_effects_特殊专长.json')['特殊专长'];

// L3 counts & structure
ok('advancements count = 40', advancements.meta.count === 40 && advancements.advancements.length === 40);
ok('30 mage-only', advancements.meta.mageOnlyCount === 30);
ok('10 universal', advancements.meta.universalCount === 10);
ok('advancement id 唯一', advancements.advancements.length === new Set(advancements.advancements.map((a) => a.id)).size);

const advNames = new Set(advancements.advancements.map((a) => a.name));
const srcNames = new Set(mageAdvSource.advancements.map((a) => a.name));
ok('进阶与法师·进阶 零名差', advNames.size === srcNames.size && [...srcNames].every((n) => advNames.has(n)));

const frost = advancements.advancements.find((a) => a.name === '冰霜法师');
ok('冰霜法师 scope=mage-only', frost?.scope === 'mage-only');
ok('冰霜法师 INT15', frost?.attrsRequired?.智力 === 15);
ok('冰霜法师 confidence=metadata_only', frost?.confidence === 'metadata_only');
ok('冰霜法师 inferenceTag 含 frost', frost?.inferenceTag?.includes('frost'));
ok('冰霜法师 mageEligible', frost?.mageEligible === true);

const guard = advancements.advancements.find((a) => a.name === '近卫');
ok('近卫 scope=universal', guard?.scope === 'universal');

// L4 feats
ok('feats count = 100', feats.meta.count === 100 && feats.feats.length === 100);
ok('feat id 唯一', feats.feats.length === new Set(feats.feats.map((f) => f.id)).size);

const featNames = new Set(feats.feats.map((f) => f.name));
const featSrcNames = new Set(featsSource.map((f) => f.name));
ok('专长与 特殊专长.json 零名差', featNames.size === featSrcNames.size && [...featSrcNames].every((n) => featNames.has(n)));
ok('专长与 skill_effects 零名差', [...featNames].every((n) => featsEffects.some((e) => e.name === n)));

ok('专长窗口 L4/L8/L13', feats.meta.featMilestones?.map((m) => m.level).join(',') === '4,8,13');
ok('进阶窗口 L5', feats.meta.advancementMilestones?.some((m) => m.level === 5));

const spellSniper = feats.feats.find((f) => f.name === '法术射手');
ok('法术射手 mageRelevance=high', spellSniper?.mageRelevance === 'high');

ok('rules_summary 含 L3/L4', loadJson('advisor/rules/rules_summary.json').bullets.some((b) => b.startsWith('L3 进阶库'))
  && loadJson('advisor/rules/rules_summary.json').bullets.some((b) => b.startsWith('L4 特殊专长')));

// Eligibility unit tests (5)
const t1 = checkAdvancementEligibility(frost, { 智力: 16 });
ok('elig① 冰霜 INT16 达标', t1.eligible && Object.keys(t1.gaps).length === 0);

const t2 = checkAdvancementEligibility(frost, { 智力: 14 });
ok('elig② 冰霜 INT14 差1', !t2.eligible && t2.gaps.智力 === 1);

const spellblade = advancements.advancements.find((a) => a.name === '魔剑士');
const t3 = checkEligibility({ 敏捷: 12, 智力: 15 }, spellblade.attrsRequired);
ok('elig③ 魔剑士双属性达标', t3.eligible);

const t4 = checkEligibility({ 敏捷: 11, 智力: 15 }, spellblade.attrsRequired);
ok('elig④ 魔剑士敏捷不足', !t4.eligible && t4.gaps.敏捷 === 1);

const highAdventurer = advancements.advancements.find((a) => a.name === '高阶冒险者');
const t5 = checkAdvancementEligibility(highAdventurer, { 智力: 8 });
ok('elig⑤ 高阶冒险者无属性门槛', t5.eligible);

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 3 validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);
