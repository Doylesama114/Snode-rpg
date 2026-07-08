#!/usr/bin/env node
/**
 * Advisor 2.0 — planner + multi-class retrieval regression (no live API).
 * Run: node scripts/validate-advisor-planner.mjs
 */
import { planFromRules, planQuery, buildPlanCacheKey, getCachedPlan, setCachedPlan, clearPlanCache } from './advisor-planner.mjs';
import { retrieve } from './advisor-retrieve.mjs';
import { matchAllClassesFromQuery } from './advisor-class-l2.mjs';
import { isFullListFollowUp } from './advisor-session.mjs';

let failed = 0;

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(label, cond, detail) {
  if (cond) pass(label);
  else fail(label, detail);
}

const dualQuery = '那么除了初始特性外，法师和战士有哪些技能我可以选择';

check('matchAllClassesFromQuery 双职业', () => {
  const classes = matchAllClassesFromQuery(dualQuery);
  return classes.includes('法师') && classes.includes('战士') && classes.length >= 2;
}, matchAllClassesFromQuery(dualQuery).join(','));

const plan = planFromRules(dualQuery, {});
check('planFromRules 触发 list_skills', plan?.tasks?.[0]?.type === 'list_skills');
check('planFromRules 含法师+战士', () => {
  const cls = plan?.tasks?.[0]?.classes || [];
  return cls.includes('法师') && cls.includes('战士');
});
check('planFromRules exclude starting', (plan?.tasks?.[0]?.exclude || []).includes('starting'));
check('planFromRules answerStyle catalog', plan?.answerStyle === 'catalog');

const retrieval = retrieve(dualQuery, { plan });
check('retrieve L2-mage 有结果', (retrieval.results['L2-mage']?.length || 0) > 0);
check('retrieve L2-warrior 有结果', (retrieval.results['L2-warrior']?.length || 0) > 0);
check('retrieve catalog 双职业', (retrieval.results._catalog?.length || 0) >= 2);
check('retrieve 多职业 retrievalClass 为空', retrieval.retrievalClass == null);

const warriorOnly = retrieve('战士防护线一阶有哪些战技', { plan: planFromRules('战士防护线一阶有哪些战技', {}) });
check('战士单职业 L2-warrior', (warriorOnly.results['L2-warrior']?.length || 0) > 0);

const followUpPlan = planFromRules('请把防护线完整列出来', {
  conversationHistory: [{
    user: '战士有哪些技能',
    assistant: 'catalog 示例回答',
  }],
  className: '战士',
});
check('追问 full_list', followUpPlan?.answerStyle === 'full_list');
check('isFullListFollowUp', isFullListFollowUp([{ user: '战士有哪些技能', assistant: 'x' }], '请完整列出来'));

const fullRet = retrieve('请把战士技能完整列出来', {
  plan: { ...planFromRules('请把战士技能完整列出来', {}), answerStyle: 'full_list' },
});
check('full_list 上下文', (fullRet.results._fullList?.length || 0) >= 1);

clearPlanCache();
const cacheKey = buildPlanCacheKey('sess1', dualQuery, 'mixed');
setCachedPlan(cacheKey, plan);
const cached = await planQuery(dualQuery, { planCacheKey: cacheKey, conversationHistory: [] }, { useLLM: false });
check('plan cache hit', cached?.source === 'cache');

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
