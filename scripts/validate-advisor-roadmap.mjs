#!/usr/bin/env node
/**
 * Advisor 3.0 — build_roadmap validation (generic + panel).
 */
import { planFromRules } from './advisor-planner.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';
import {
  isBuildRoadmapQuery,
  isPanelRoadmapQuery,
  getBuildPhaseBand,
  ROADMAP_DISCLAIMER,
} from './advisor-build-roadmap.mjs';

const PLANNING_QUERY = '我想玩一个主职业法师，子职业战士的角色，然后想进阶魔剑士，我该怎么选择我的技能';
const PANEL_REVIEW_QUERY = '怎么评价我当前的build，如果我想进阶魔剑士，还有没有什么适合我的技能';
const FROST_QUERY = '主职法师想进阶冰霜法师，该怎么规划技能路线';

let failed = 0;
function check(label, ok) {
  if (ok) console.log(`✓ ${label}`);
  else {
    console.log(`✗ ${label}`);
    failed += 1;
  }
}

console.log('=== validate-advisor-roadmap ===\n');

check('isBuildRoadmapQuery planning', isBuildRoadmapQuery(PLANNING_QUERY));
check('isBuildRoadmapQuery frost', isBuildRoadmapQuery(FROST_QUERY));

const plan = planFromRules(PLANNING_QUERY, {});
check('plan intent build_roadmap', plan?.intent === 'build_roadmap');
check('plan answerStyle roadmap', plan?.answerStyle === 'roadmap');
check('plan task generic', plan?.tasks?.[0]?.generic === true);
check('plan mainClass 法师', plan?.tasks?.[0]?.mainClass === '法师');

const rPlan = retrieve(PLANNING_QUERY, { plan });
const ctxPlan = formatContext(rPlan);
check('retrieve intent build_roadmap', rPlan.intent === 'build_roadmap');
check('context 通用', ctxPlan.includes('通用'));
check('context 仅作参考', ctxPlan.includes('仅作参考'));
check('context 候选示例', ctxPlan.includes('候选示例'));
check('context L2 法师', ctxPlan.includes('L2 法师技能'));
check('context no catalog', !ctxPlan.includes('技能目录（catalog）'));
check('roadmap mode generic', rPlan.results._roadmap?.mode === 'generic');

const planFrost = planFromRules(FROST_QUERY, {});
check('frost plan build_roadmap', planFrost?.intent === 'build_roadmap');
const rFrost = retrieve(FROST_QUERY, { plan: planFrost });
check('frost advancement 冰霜', formatContext(rFrost).includes('冰霜法师'));

const snap = loadSnapshotFile('advisor/snapshots/mock-magic-sword-l6.json');
check('L6 phase mid', getBuildPhaseBand(6) === 'mid');

check('panel review isPanelRoadmap', isPanelRoadmapQuery(PANEL_REVIEW_QUERY, { snapshot: snap }));

const rPanel = retrieve(PANEL_REVIEW_QUERY, { snapshot: snap });
const ctxPanel = formatContext(rPanel);
check('panel intent build_roadmap', rPanel.intent === 'build_roadmap');
check('panel 快照观察', ctxPanel.includes('快照 build 观察'));
check('panel disclaimer in ctx', ctxPanel.includes('仅作参考'));

const BULLET_QUERY = '我想玩主职业法师、子职业猎人，进阶魔弹射手，该怎么选技能';
const planBullet = planFromRules(BULLET_QUERY, {});
const rBullet = retrieve(BULLET_QUERY, { plan: planBullet });
check('magic_bullet L2-hunter', rBullet.layersHit.includes('L2-hunter'));

check('disclaimer constant', ROADMAP_DISCLAIMER.includes('仅作参考'));

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
