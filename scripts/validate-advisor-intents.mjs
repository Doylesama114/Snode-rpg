#!/usr/bin/env node
/**
 * Advisor 5.0 batch8 — per-intent routing smoke tests.
 * Run: node scripts/validate-advisor-intents.mjs
 */
import { classifyQuestion } from './advisor-classifier.mjs';
import { detectStructuredQuestion } from './advisor-query-tools.mjs';
import { retrieve } from './advisor-retrieve.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';

let failed = 0;

function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const CASES = [
  { id: 'skill_detail', query: '窃贼的交易收益和代价', expect: 'skill_detail' },
  { id: 'cross_class', query: '法师和吟游诗人有哪些相同的技能', expect: 'cross_class_compare' },
  { id: 'class_weapon', query: '哪些初始职业的武器熟练度包含锤子', expect: 'class_weapon_prof' },
  { id: 'hp_optimize', query: '怎样构筑初始血量最大', expect: 'chargen_hp_optimize' },
  { id: 'prof_cleric', query: '牧师怎样获取宗教和自然熟练项最少升到多少级', expect: 'proficiency_roadmap' },
  { id: 'prof_rogue', query: '游荡者怎样获取几乎所有巧手熟练项最少升到多少级', expect: 'proficiency_roadmap' },
  { id: 'prof_mage', query: '法师怎样获取几乎所有知识奥秘熟练项最少升到多少级', expect: 'proficiency_roadmap' },
  { id: 'combat_hit', query: '力量+3剑类熟练魔法武器狂怒术命中加值是多少', expect: 'combat_math' },
  { id: 'combat_damage', query: '力量+3拿着1d8双手剑狂怒术伤害加值是多少', expect: 'combat_math' },
  { id: 'status', query: '沉默状态具体有什么效果', expect: 'status_rules' },
  { id: 'feat_timing', query: '特殊专长可以在哪些等级获取', expect: 'feat_timing' },
  { id: 'unknown', query: '元素大师怎么规划成长路线', expect: 'unknown_entity' },
  { id: 'equipment', query: '净化水袋有什么效果', expect: 'equipment_lookup' },
  { id: 'point_buy', query: '32点购点怎样分配才能让法师智力达到15且体质尽量高', expect: 'point_buy_optimize' },
  { id: 'leveling', query: '主职从3级升到6级一共获得什么奖励', expect: 'leveling_summary' },
  { id: 'background', query: '侍僧背景可以侍奉哪些神祇', expect: 'background_detail' },
  { id: 'combat_ac', query: '敏捷调整值+2穿着皮甲护甲值是多少', expect: 'combat_math' },
  { id: 'prof_religion', query: '哪些初始职业可以在创建时选择宗教熟练', expect: 'proficiency_lookup' },
  { id: 'combat_full', query: '力量+3剑类熟练1d8双手剑狂怒术命中和伤害加值分别是多少', expect: 'combat_math' },
  { id: 'starting_gear', query: '牧师创建角色时起始装备有哪些', expect: 'starting_gear_lookup' },
  { id: 'race_vampire', query: '吸血鬼种族有什么特性', expect: 'race_detail' },
  { id: 'roadmap', query: '我想玩飞贼怎么安排成长路线', expect: 'build_roadmap', skipDetect: true },
];

console.log('=== validate-advisor-intents ===\n');

for (const c of CASES) {
  const det = detectStructuredQuestion(c.query);
  const cls = classifyQuestion(c.query);
  const r = retrieve(c.query);
  check(`${c.id} detectStructured`, c.skipDetect ? !det?.intent || det?.intent === c.expect : det?.intent === c.expect, c.skipDetect ? `optional got ${det?.intent}` : `got ${det?.intent}`);
  check(`${c.id} classify`, cls?.intent === c.expect, `got ${cls?.intent}`);
  check(`${c.id} retrieve`, r.intent === c.expect, `got ${r.intent}`);
}

const snap = loadSnapshotFile('advisor/snapshots/mock-combat-warrior-l6.json');
const snapQ = '我开启了魔法武器和狂怒术，拿着双手剑，命中加值是多少';
check('snap classify combat', classifyQuestion(snapQ, { snapshot: snap })?.intent === 'combat_math');
check('snap retrieve combat', retrieve(snapQ, { snapshot: snap }).intent === 'combat_math');

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
