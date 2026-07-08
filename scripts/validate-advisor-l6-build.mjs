#!/usr/bin/env node
/**
 * L6 build 评价 — 嵌套熟练、位阶过滤、进阶≠兼职
 * Run: node scripts/validate-advisor-l6-build.mjs
 */
import {
  loadSnapshotFile,
  normalizeSnapshot,
  analyzeSnapshot,
  flattenProfs,
  sumProf,
  getLearnableTierLabels,
} from './advisor-snapshot.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

let failed = 0;

function pass(label) { console.log(`✓ ${label}`); }
function fail(label, detail) {
  failed += 1;
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}
function check(label, cond, detail) {
  if (cond) pass(label);
  else fail(label, detail);
}

const QUERY = '怎么评价我当前的build，如果我想进阶魔剑士，还有没有什么适合我的技能';

const nested = {
  智力: { 逻辑: 2, '奥秘-魔法学识': 2, '知识-人文': 2 },
};
check('flatten nested profs', sumProf(flattenProfs(nested), ['逻辑', '奥秘', '知识']) === 6);

const snap = loadSnapshotFile('advisor/snapshots/mock-magic-sword-l6.json');
const analysis = analyzeSnapshot(snap, { advancementNames: ['魔剑士'] });
check('mock 芙兰 L6', snap.classes[0].level === 6);
check('prof sum from panel shape', analysis.mageMainRequirements.profSum >= 6);
check('prof highlights', analysis.profHighlights.some((p) => p.startsWith('逻辑+')));
check('subclass warrior', analysis.subclasses.some((c) => c.name === '战士'));
check('learnable 四阶', analysis.learnableTiers.includes('四阶'));
check('not 六阶 yet', !analysis.learnableTiers.includes('六阶'));
check('魔剑士 attr ok', analysis.advancements.find((a) => a.advancementName === '魔剑士')?.eligible === true);

const tiersL6 = getLearnableTierLabels(6, null);
check('leveling 四阶 at L6', tiersL6.includes('四阶') && !tiersL6.includes('六阶'));

const r = retrieve(QUERY, { snapshot: snap });
const ctx = formatContext(r);
const l2MageBlock = (ctx.split('## L2 法师技能')[1] || '').split('##')[0];
check('intent build_roadmap (panel)', r.intent === 'build_roadmap');
check('answerStyle roadmap', r.answerStyle === 'roadmap');
check('has _roadmap', !!r.results._roadmap);
check('context 路线图', ctx.includes('Build 路线图'));
check('context 快照评价', ctx.includes('快照 build 评价'));
check('L6 in layers', r.layersHit.includes('L6'));
check('context 子职', ctx.includes('子职 战士'));
check('context 熟练非零', ctx.includes('逻辑+2'));
check('omit 兼职 block', !ctx.includes('兼职可选'));
check('可学位阶', ctx.includes('可学技能位阶') && ctx.includes('四阶'));
check('L2 无六阶 闪烁骑士', !l2MageBlock.includes('闪烁骑士之剑'));
check('L2 无六阶 多重武器', !l2MageBlock.includes('附魔武器·多重武器'));
check('魔剑士 进阶', ctx.includes('魔剑士'));

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
