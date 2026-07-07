#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 2 skill indexes.
 * Run: node scripts/validate-advisor-phase2.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function skillNames(arr) {
  return new Set(arr.map((s) => s.name));
}

function diff(a, b) {
  return [...a].filter((x) => !b.has(x));
}

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const mageIndex = loadJson('advisor/skills/mage_index.json');
const universalIndex = loadJson('advisor/skills/universal_index.json');
const mageSource = loadJson('职业页/数据/法师.json');
const universalSource = loadJson('职业页/数据/通用天赋树.json');
const mageEffects = loadJson('斯诺德跑团/skill_effects_法师.json')['法师'];
const universalEffects = loadJson('斯诺德跑团/skill_effects_通用天赋树.json')['通用天赋树'];

// Counts
ok('mage_index count = 356', mageIndex.meta.count === 356 && mageIndex.skills.length === 356);
ok('universal_index count = 390', universalIndex.meta.count === 390 && universalIndex.skills.length === 390);

// Zero name diff vs source JSON
const mageSrcNames = skillNames(mageSource.skills);
const mageIdxNames = skillNames(mageIndex.skills);
ok('mage 与 法师.json 零名差', diff(mageSrcNames, mageIdxNames).length === 0 && diff(mageIdxNames, mageSrcNames).length === 0);

const uniSrcNames = skillNames(universalSource.skills);
const uniIdxNames = skillNames(universalIndex.skills);
ok('universal 与 通用天赋树.json 零名差', diff(uniSrcNames, uniIdxNames).length === 0 && diff(uniIdxNames, uniSrcNames).length === 0);

// Zero name diff vs skill_effects
ok('mage 与 skill_effects_法师 零名差',
  diff(mageIdxNames, skillNames(mageEffects)).length === 0
  && diff(skillNames(mageEffects), mageIdxNames).length === 0);
ok('universal 与 skill_effects_通用 零名差',
  diff(uniIdxNames, skillNames(universalEffects)).length === 0
  && diff(skillNames(universalEffects), uniIdxNames).length === 0);

// Unique ids
ok('mage id 唯一', mageIndex.skills.length === new Set(mageIndex.skills.map((s) => s.id)).size);
ok('universal id 唯一', universalIndex.skills.length === new Set(universalIndex.skills.map((s) => s.id)).size);

// Required chunk fields
const required = ['id', 'name', 'source', 'class', 'tier', 'type', 'tags', 'marks', 'spCost', 'summary', 'searchText'];
const mageMissing = mageIndex.skills.filter((s) => required.some((k) => s[k] === undefined));
ok('mage chunk 字段完整', mageMissing.length === 0, mageMissing[0]?.name || '');

// Spot checks
const missile = mageIndex.skills.find((s) => s.name === '魔法飞弹');
ok('魔法飞弹 style=塑能', missile?.style === '塑能');
ok('魔法飞弹 spCost=1', missile?.spCost === 1);
ok('魔法飞弹 marks 含紫色', missile?.marks?.includes('紫色'));
ok('魔法飞弹 type=spell', missile?.type === 'spell');
ok('魔法飞弹 choicesFrom', missile?.choicesFrom?.includes('寒冰箭'));
ok('魔法飞弹 roleHints 含 burst', missile?.roleHints?.includes('burst'));

const starting = mageIndex.skills.filter((s) => s.type === 'starting');
ok('法师起手 8 项', starting.length === 8);

const meditation = universalIndex.skills.find((s) => s.name === '冥想');
ok('冥想 type=talent', meditation?.type === 'talent');
ok('冥想 tier=一阶', meditation?.tier === '一阶');

const blizzard = mageIndex.skills.find((s) => s.name === '暴风雪');
ok('暴风雪 tier=六阶', blizzard?.tier === '六阶');
ok('暴风雪 appliesStatuses 含减速', blizzard?.appliesStatuses?.includes('减速'));

ok('mage 8 战斗风格', Object.keys(mageIndex.meta.facets.byStyle).length === 8);
ok('rules_summary 含 L2', loadJson('advisor/rules/rules_summary.json').bullets.some((b) => b.startsWith('L2 技能索引')));

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 2 validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);
