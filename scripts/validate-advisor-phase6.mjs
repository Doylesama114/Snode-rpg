#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 6: prompt assembly + optional live API sample.
 * Run: node scripts/validate-advisor-phase6.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advise } from './mage-advisor.mjs';
import { getAdvisorConfig, ROOT } from './advisor-env.mjs';
import { buildSystemPrompt } from './advisor-prompt.mjs';

const QUESTIONS = [
  { id: 1, query: '我想玩输出很猛的法师，种族和背景怎么选？', ctxIncludes: ['智力', '种族'] },
  { id: 2, query: '塑能流派 1～3 级优先学什么？', ctxIncludes: ['塑能', '魔法飞弹'] },
  { id: 3, query: '魔法飞弹和寒冰箭能一起学吗？', ctxIncludes: ['魔法飞弹', '寒冰箭', '抉择'] },
  { id: 4, query: '4 级特殊专长选什么适合输出法师？', ctxIncludes: ['专长'] },
  { id: 5, query: '5 级该关注什么系统奖励？', ctxIncludes: ['进阶', '5'] },
  { id: 6, query: '智力 14 的法师能走冰霜法师吗？', ctxIncludes: ['冰霜法师', 'gaps'] },
  { id: 7, query: '7 级法师能兼职什么？', ctxIncludes: ['吟游诗人', '魔契师'] },
  { id: 8, query: '通用天赋树里有什么适合法师的输出向天赋？', ctxIncludes: ['法术精准', '通用'] },
  { id: 9, query: '8 级第二次专长推荐？', ctxIncludes: ['专长'] },
  { id: 10, query: '咒法风格和塑能风格怎么选？', ctxIncludes: ['咒法', '塑能'] },
  { id: 11, query: '标识不够能学带紫色标识的技能吗？', ctxIncludes: ['sp_marks', '标识'] },
  { id: 12, query: '近卫进阶适合法师吗？', ctxIncludes: ['近卫', 'universal'] },
  { id: 13, query: '有没有塑能相关的战斗技巧或小贴士？', ctxIncludes: ['塑能', '小贴士'] },
  { id: 14, query: '主职 3 级解锁什么？', ctxIncludes: ['三阶', '3'] },
  { id: 15, query: '法师兼职奇械师要什么条件？', ctxIncludes: ['奇械师', '智力'] },
];

const API_SAMPLE_IDS = [1, 3, 6, 7, 11];

const API_EXPECT = {
  1: { any: ['种族', '背景', '智力'] },
  3: { any: ['抉择', '选', '魔法飞弹', '寒冰箭'] },
  6: { any: ['不达标', '不能', '无法', '✗', '差', '14', '15'] },
  7: { any: ['吟游诗人', '魔契师', '奇械师', '兼职'] },
  11: { any: ['不能', 'DM', '标识', '结算'] },
};

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

function chineseRatio(text) {
  const chars = [...text.replace(/\s/g, '')];
  if (!chars.length) return 0;
  const zh = chars.filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
  return zh / chars.length;
}

async function runDryRun() {
  const sys = buildSystemPrompt();
  ok('system prompt 含硬规则', sys.includes('硬规则') && sys.includes('简体中文'));
  ok('system prompt 含小贴士', sys.includes('小贴士'));
  ok('system prompt 禁 D&D', sys.includes('禁止套用 D&D'));
  ok('.env.example 存在', fs.existsSync(path.join(ROOT, '.env.example')));
  ok('.gitignore 含 .env', fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').includes('.env'));

  for (const q of QUESTIONS) {
    const out = await advise(q.query, { dryRun: true });
    const blob = `${out.context}\n${out.messages[1].content}`;
    ok(`Q${q.id} dry-run 有 context`, (out.context?.length || 0) > 80);
    ok(`Q${q.id} dry-run intent`, !!out.intent, out.intent);
    for (const needle of q.ctxIncludes) {
      ok(`Q${q.id} context∋${needle}`, blob.includes(needle), needle);
    }
    ok(`Q${q.id} thinking 默认关`, out.thinking === false);
  }
}

async function runApiSample() {
  const config = getAdvisorConfig();
  if (!config.apiKey) {
    ok('API 抽样（跳过：无 DEEPSEEK_API_KEY）', true, 'skipped');
    return;
  }

  for (const id of API_SAMPLE_IDS) {
    const q = QUESTIONS.find((x) => x.id === id);
    const out = await advise(q.query, { thinking: false, stream: false });
    const ans = out.answer || '';
    ok(`API Q${id} 有回答`, ans.length > 80, `len=${ans.length}`);
    ok(`API Q${id} 中文为主`, chineseRatio(ans) > 0.4, `${(chineseRatio(ans) * 100).toFixed(0)}%`);
    ok(`API Q${id} 无 D&D 法术位`, !/法术位/.test(ans));
    const exp = API_EXPECT[id];
    if (exp?.any) {
      ok(`API Q${id} 要点`, exp.any.some((s) => ans.includes(s)), exp.any.join('|'));
    }
  }
}

async function patchRulesSummary() {
  const p = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');
  const summary = JSON.parse(fs.readFileSync(p, 'utf8'));
  summary.bullets = summary.bullets.filter((b) => !b.startsWith('L6 DeepSeek'));
  summary.bullets.push('L6 DeepSeek CLI：mage-advisor.mjs（deepseek-v4-flash，默认 thinking 关）');
  summary.meta = { ...summary.meta, phase: '6' };
  fs.writeFileSync(p, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

async function main() {
  await runDryRun();
  await runApiSample();
  await patchRulesSummary();

  const failed = checks.filter((c) => !c.pass);
  console.log(`Phase 6 validation: ${checks.length - failed.length}/${checks.length} passed`);
  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
  }
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
