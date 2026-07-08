/**
 * Advisor 2.0 — lightweight query planner (LLM JSON + rule fallback).
 */
import { getAdvisorConfig } from './advisor-env.mjs';
import { fetch, abortAfter } from './advisor-fetch.mjs';
import { matchAllClassesFromQuery } from './advisor-class-l2.mjs';
import { resolveClassPromptProfile } from './advisor-class-tier.mjs';
import { isFullListFollowUp, summarizeSessionForPlanner } from './advisor-session.mjs';

const PLAN_CACHE = new Map();
const PLAN_CACHE_MAX = 48;

export function buildPlanCacheKey(sessionId, query, bindingKey) {
  const sid = String(sessionId || 'anon').trim();
  const bind = String(bindingKey || 'anon').trim();
  const q = String(query || '').trim().slice(0, 240);
  return `${sid}\0${bind}\0${q}`;
}

export function getCachedPlan(cacheKey) {
  if (!cacheKey) return null;
  return PLAN_CACHE.get(cacheKey) || null;
}

export function setCachedPlan(cacheKey, plan) {
  if (!cacheKey || !plan) return;
  PLAN_CACHE.set(cacheKey, plan);
  if (PLAN_CACHE.size > PLAN_CACHE_MAX) {
    const first = PLAN_CACHE.keys().next().value;
    PLAN_CACHE.delete(first);
  }
}

export function clearPlanCache() {
  PLAN_CACHE.clear();
}

const LIST_SKILLS_RE = /技能|法术|戏法|战技|流派|除了.*初始|可选|有哪些|能学|哪些|什么技能|什么法术|什么战技/;
const EXCLUDE_STARTING_RE = /除了.*初始|除.*初始|初始特性之外|非起手|初始特性外|除起手/;
const FULL_LIST_RE = /全列|全部列出|完整列表|列出来|全部技能|完整技能|详细列出|都列|逐项列出/;

/**
 * @typedef {object} AdvisorPlan
 * @property {'planner'|'rules'} source
 * @property {'build'|'chargen'|'mixed'} [scenario]
 * @property {'catalog'|'full_list'|'recommend'} answerStyle
 * @property {{ type: string, classes: string[], exclude?: string[] }[]} tasks
 * @property {string} [intent]
 * @property {string} [promptProfile]
 */

/**
 * @param {string} query
 * @param {{ className?: string|null, mode?: string, snapshot?: object, conversationHistory?: object[] }} ctx
 * @returns {AdvisorPlan|null}
 */
export function planFromRules(query, ctx = {}) {
  const q = String(query || '');
  const classes = matchAllClassesFromQuery(q);
  if (!classes.length && ctx.className) classes.push(ctx.className);

  const history = ctx.conversationHistory || [];
  const listSkills = LIST_SKILLS_RE.test(q);
  const excludeStarting = EXCLUDE_STARTING_RE.test(q);
  const fullList = FULL_LIST_RE.test(q) || isFullListFollowUp(history, q);

  if (fullList && history.length && !classes.length) {
    const lastUser = history[history.length - 1]?.user || '';
    classes.push(...matchAllClassesFromQuery(lastUser));
    if (!classes.length && ctx.className) classes.push(ctx.className);
  }

  if ((listSkills || fullList) && classes.length) {
    const singleMage = classes.length === 1 && classes[0] === '法师';
    const base = singleMage ? 'mage_skills' : 'class_skills';
    const promptProfile = singleMage
      ? 'mage_skills'
      : resolveClassPromptProfile(classes[0], 'class_skills');

    let scenario = 'mixed';
    if (ctx.mode === 'wizard') scenario = 'chargen';
    else if (ctx.snapshot) scenario = 'build';

    return {
      source: 'rules',
      scenario,
      answerStyle: fullList ? 'full_list' : 'catalog',
      tasks: [{
        type: 'list_skills',
        classes: [...new Set(classes)],
        exclude: excludeStarting ? ['starting'] : [],
      }],
      intent: singleMage ? 'mage_skills' : 'class_skills',
      promptProfile,
    };
  }

  return null;
}

function validatePlan(raw, query, ctx) {
  if (!raw || typeof raw !== 'object') return null;
  const answerStyle = ['catalog', 'full_list', 'recommend'].includes(raw.answerStyle)
    ? raw.answerStyle
    : 'catalog';
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const normalizedTasks = [];
  for (const t of tasks) {
    if (!t || t.type !== 'list_skills') continue;
    const classes = (Array.isArray(t.classes) ? t.classes : [])
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    if (!classes.length) continue;
    normalizedTasks.push({
      type: 'list_skills',
      classes: [...new Set(classes)],
      exclude: Array.isArray(t.exclude) ? t.exclude.map(String) : [],
    });
  }
  if (!normalizedTasks.length) return planFromRules(query, ctx);

  const firstClass = normalizedTasks[0].classes[0];
  const singleMage = normalizedTasks[0].classes.length === 1 && firstClass === '法师';
  return {
    source: 'planner',
    scenario: raw.scenario || 'mixed',
    answerStyle,
    tasks: normalizedTasks,
    intent: raw.intent || (singleMage ? 'mage_skills' : 'class_skills'),
    promptProfile: raw.promptProfile || (singleMage ? 'mage_skills' : resolveClassPromptProfile(firstClass, 'class_skills')),
  };
}

async function planWithLLM(query, ctx) {
  const config = getAdvisorConfig();
  if (!config.apiKey) return null;

  const sessionSummary = summarizeSessionForPlanner(ctx.conversationHistory || []);
  const system = `你是斯诺德跑团 Build 顾问的检索规划器。根据用户问题输出 JSON，不要解释。
字段：
- answerStyle: "catalog" | "full_list" | "recommend"（列举技能首次用 catalog；用户追问要完整列表用 full_list）
- tasks: [{ "type":"list_skills", "classes":["法师","战士"], "exclude":["starting"] }]
- intent: "class_skills" | "mage_skills" | "chargen" | "general"
- promptProfile: 同 intent 或 mage_skills/class_skills
仅当用户明确在问「有哪些技能/法术/战技/流派可选」时输出 list_skills；否则 tasks 为空数组且 answerStyle 为 recommend。`;

  const user = [
    `当前职业上下文：${ctx.className || '无'}`,
    `模式：${ctx.mode || 'advisor'}`,
    sessionSummary ? `近期对话：\n${sessionSummary}` : '',
    `用户问题：${query}`,
  ].filter(Boolean).join('\n\n');

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
    signal: abortAfter(25_000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  try {
    const parsed = JSON.parse(text);
    return validatePlan(parsed, query, ctx);
  } catch {
    return null;
  }
}

/**
 * @param {string} query
 * @param {object} ctx
 * @param {{ useLLM?: boolean }} options
 * @returns {Promise<AdvisorPlan|null>}
 */
export async function planQuery(query, ctx = {}, options = {}) {
  const cacheKey = ctx.planCacheKey || null;
  if (cacheKey && options.useCache !== false) {
    const cached = getCachedPlan(cacheKey);
    if (cached) return { ...cached, source: 'cache' };
  }

  const rulesPlan = planFromRules(query, ctx);
  if (options.rulesOnly) return rulesPlan;
  if (options.useLLM === false) {
    if (cacheKey && rulesPlan) setCachedPlan(cacheKey, rulesPlan);
    return rulesPlan;
  }

  try {
    const llmPlan = await planWithLLM(query, ctx);
    if (llmPlan?.tasks?.length) {
      if (cacheKey) setCachedPlan(cacheKey, llmPlan);
      return llmPlan;
    }
  } catch {
    /* fallback */
  }
  if (cacheKey && rulesPlan) setCachedPlan(cacheKey, rulesPlan);
  return rulesPlan;
}
