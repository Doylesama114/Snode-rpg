#!/usr/bin/env node
/**
 * Advisor 3.0 — build_roadmap validation (planning + panel snapshot).
 */
import { planFromRules } from './advisor-planner.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';
import { isBuildRoadmapQuery, getBuildPhaseBand } from './advisor-build-roadmap.mjs';

const PLANNING_QUERY = '我想玩一个主职业法师，子职业战士的角色，然后想进阶魔剑士，我该怎么选择我的技能';
const PANEL_QUERY = '我是魔剑士 build，当前技能怎么选、有什么缺口？';

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

const plan = planFromRules(PLANNING_QUERY, {});
check('plan intent build_roadmap', plan?.intent === 'build_roadmap');
check('plan answerStyle roadmap', plan?.answerStyle === 'roadmap');
check('plan task type', plan?.tasks?.[0]?.type === 'build_roadmap');
check('plan kit magic_sword', plan?.tasks?.[0]?.kitId === 'magic_sword');

const rPlan = retrieve(PLANNING_QUERY, { plan });
check('retrieve intent build_roadmap', rPlan.intent === 'build_roadmap');
check('retrieve answerStyle roadmap', rPlan.answerStyle === 'roadmap');
check('retrieve has _roadmap', !!rPlan.results._roadmap);
check('retrieve has _roadmapText', !!rPlan.results._roadmapText);

const ctxPlan = formatContext(rPlan);
check('context Build 路线图', ctxPlan.includes('Build 路线图'));
check('context 附魔', ctxPlan.includes('附魔'));
check('context 狂攻', ctxPlan.includes('狂攻'));
check('context 专长 L4', ctxPlan.includes('L4'));
check('context 穿刺者', ctxPlan.includes('穿刺者'));
check('context 通用天赋', ctxPlan.includes('通用天赋'));
check('context scenario planning', ctxPlan.includes('创角/规划'));
check('context no catalog mode', !ctxPlan.includes('技能目录（catalog）'));

const snap = loadSnapshotFile('advisor/snapshots/mock-magic-sword-l6.json');
check('L6 phase mid', getBuildPhaseBand(6) === 'mid');

const planPanel = planFromRules(PANEL_QUERY, { snapshot: snap });
check('panel plan build_roadmap', planPanel?.intent === 'build_roadmap');

const rPanel = retrieve(PANEL_QUERY, { plan: planPanel, snapshot: snap });
const ctxPanel = formatContext(rPanel);
check('panel context 快照 build 评价', ctxPanel.includes('快照 build 评价'));
check('panel context 中期', ctxPanel.includes('中期'));
check('panel context 可学技能位阶', ctxPanel.includes('可学技能位阶'));
check('panel context 缺口', ctxPanel.includes('缺口') || ctxPanel.includes('偏差'));
check('panel no 六阶 recommend in roadmap picks only', !ctxPanel.match(/六阶.*推荐/));

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
