#!/usr/bin/env node
/**
 * Advisor 4.0 — tools layer validation (outline + entity + leveling).
 */
import { planFromRules } from './advisor-planner.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import {
  resolveEntity,
  getLevelingTable,
  getAdvancementBrief,
  outlineGrowthRoadmap,
  formatRoadmapOutline,
} from './advisor-tools.mjs';
import { parseRoadmapGoal } from './advisor-build-roadmap.mjs';
import { loadAdvisorStore } from './advisor-retrieve.mjs';

const THIEF_QUERY = '我想玩飞贼，我该怎么安排我的成长路线？';
const UNKNOWN_QUERY = '元素大师怎么规划';

let failed = 0;
function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

console.log('=== validate-advisor-tools ===\n');

const entity = resolveEntity('飞贼');
check('resolveEntity 飞贼', entity?.type === 'advancement' && entity.name === '飞贼');

const rogue = resolveEntity('游荡者');
check('resolveEntity 游荡者', rogue?.type === 'class');

const table = getLevelingTable(1, 5);
check('leveling L1-5 rows', table.rows.length === 5);
check('leveling L5 advancement', table.advancementUnlock?.level === 5);

const brief = getAdvancementBrief('飞贼');
check('飞贼 brief attrs', brief?.attrsRequired?.敏捷 === 15 && brief?.attrsRequired?.感知 === 15);
check('飞贼 brief insight', (brief?.insightMilestones?.length || 0) > 0);

const store = loadAdvisorStore();
const goal = parseRoadmapGoal(THIEF_QUERY);
const outline = outlineGrowthRoadmap(goal, { store, roadmapCtx: null });
check('outline sections', (outline.sections?.length || 0) >= 5);
check('outline mainClass 游荡者', outline.mainClass === '游荡者');
check('outline 敏捷门槛', outline.sections.some((s) => s.bullets.some((b) => /敏捷/.test(b))));
const outlineText = formatRoadmapOutline(outline);
check('outline text 路线骨架', outlineText.includes('路线骨架'));

const unknownGoal = parseRoadmapGoal(UNKNOWN_QUERY);
const unknownOutline = outlineGrowthRoadmap(unknownGoal, { store });
check('unknown outline mode', unknownOutline.mode === 'unknown_advancement');
check('unknown 未收录', unknownOutline.sections.some((s) => s.bullets.some((b) => /未收录|不得编造/.test(b))));

const plan = planFromRules(THIEF_QUERY, {});
const r = retrieve(THIEF_QUERY, { plan });
check('retrieve _roadmapOutline', !!r.results._roadmapOutline);
check('context 路线骨架', formatContext(r).includes('路线骨架'));
check('outline 飞贼心得', formatContext(r).includes('飞贼心得') || formatContext(r).includes('心得'));

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
