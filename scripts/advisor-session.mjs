/**
 * Advisor 2.0 — in-memory conversation session helpers (server-side).
 * Client persists turns in sessionStorage; main process validates on receive.
 */
import {
  resolveAdvancementName,
  inferSourceClassForAdvancement,
} from './advisor-advancement-resolve.mjs';
import { matchAllClassesFromQuery } from './advisor-class-l2.mjs';

export const MAX_CONVERSATION_TURNS = 3;
export const MAX_TURN_USER_CHARS = 2000;
export const MAX_TURN_ASSISTANT_CHARS = 800;

/**
 * @param {unknown} raw
 * @returns {{ user: string, assistant: string, ts?: number }[]}
 */
export function normalizeConversationHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const user = String(item.user || '').trim().slice(0, MAX_TURN_USER_CHARS);
    const assistant = String(item.assistant || '').trim().slice(0, MAX_TURN_ASSISTANT_CHARS);
    if (!user && !assistant) continue;
    out.push({
      user,
      assistant,
      ts: typeof item.ts === 'number' ? item.ts : undefined,
    });
  }
  return out.slice(-MAX_CONVERSATION_TURNS);
}

/**
 * @param {{ user: string, assistant: string }[]} turns
 * @param {{ goalOverride?: object|null }} [options]
 */
export function summarizeSessionForPlanner(turns, options = {}) {
  if (!turns?.length) return '';
  const goalOverride = options.goalOverride || null;
  const lines = turns.map((t, i) => {
    const u = (t.user || '').slice(0, 120);
    const a = (t.assistant || '').slice(0, 160);
    return `[${i + 1}] 用户：${u}${u.length >= 120 ? '…' : ''}\n助理：${a}${a.length >= 160 ? '…' : ''}`;
  });

  if (goalOverride?.sessionFocus === 'reject_prior') {
    const focus = goalOverride.advancementName
      ? `进阶「${goalOverride.advancementName}」`
      : goalOverride.mainClass
        ? `主职「${goalOverride.mainClass}」`
        : '当前问题';
    const drop = (goalOverride.dropClasses || []).filter(Boolean);
    const dropNote = drop.length ? `；勿再引用：${drop.join('、')}` : '';
    lines.unshift(`[会话指令] 用户已否定此前假设，仅讨论 ${focus}${dropNote}`);
  }

  return lines.join('\n');
}

const SESSION_FOCUS_RE = /现在(?:只|就)?(?:说|问|谈|关心|讲)|我只(?:说|问|谈|关心|玩|做|选)|不是.*了|不要.*了|没(?:说|问|提).*(?:法师|战士|牧师)|不是问|不谈|别扯|别提/;
const SESSION_DROP_CLASS_RE = /不是.*?(法师|战士|牧师|猎人|游荡者|奇械师|魔契师|德鲁伊|萨满|蛮斗士|圣骑士)|不要.*?(法师|战士|牧师|猎人|游荡者)|没.*?问.*?(法师|战士|牧师|猎人|游荡者)|不谈.*?(法师|战士|牧师|猎人|游荡者)/;

/**
 * Detect when user resets topic (e.g.「我现在只说飞贼」).
 * @param {string} query
 * @param {{ user: string, assistant: string }[]} [history]
 * @returns {{ advancementName?: string, mainClass?: string, dropClasses?: string[], sessionFocus?: string }|null}
 */
export function extractGoalOverride(query, history = []) {
  const q = String(query || '');
  const override = {
    advancementName: null,
    mainClass: null,
    dropClasses: [],
    sessionFocus: null,
  };

  const advInQuery = resolveAdvancementName(q);
  const classesInQuery = matchAllClassesFromQuery(q);
  const hasFocusCue = SESSION_FOCUS_RE.test(q);

  if (advInQuery && (hasFocusCue || /只(?:玩|做|选)|成长路线|怎么安排|怎么规划/.test(q))) {
    override.advancementName = advInQuery;
    override.mainClass = inferSourceClassForAdvancement(advInQuery);
    override.sessionFocus = hasFocusCue ? 'reject_prior' : null;
  } else if (classesInQuery.length === 1 && hasFocusCue) {
    override.mainClass = classesInQuery[0];
    override.sessionFocus = 'reject_prior';
  }

  const dropM = q.match(SESSION_DROP_CLASS_RE);
  if (dropM?.[1] && !override.dropClasses.includes(dropM[1])) {
    override.dropClasses.push(dropM[1]);
    override.sessionFocus = override.sessionFocus || 'reject_prior';
  }
  if (/不是.*法师|不要.*法师|没.*问.*法师|不谈法师|不是问法师/.test(q)) {
    if (!override.dropClasses.includes('法师')) override.dropClasses.push('法师');
    override.sessionFocus = override.sessionFocus || 'reject_prior';
  }

  if (!override.advancementName && !override.mainClass && !override.dropClasses.length) {
    return null;
  }

  if (override.dropClasses.length && override.mainClass && override.dropClasses.includes(override.mainClass)) {
    override.mainClass = advInQuery ? inferSourceClassForAdvancement(advInQuery) : null;
  }

  if (override.sessionFocus === 'reject_prior' && history.length) {
    for (const cls of ['法师', '战士', '牧师', '猎人', '游荡者', '奇械师', '魔契师']) {
      const mentionedInHistory = history.some((t) => `${t.user || ''} ${t.assistant || ''}`.includes(cls));
      const mentionedInQuery = q.includes(cls) || classesInQuery.includes(cls);
      if (mentionedInHistory && !mentionedInQuery && override.mainClass !== cls) {
        if (!override.dropClasses.includes(cls)) override.dropClasses.push(cls);
      }
    }
  }

  return override;
}

/**
 * Merge goal override into planner/retrieve context.
 * @param {string} query
 * @param {object} ctx
 */
export function enrichPlannerContext(query, ctx = {}) {
  const goalOverride = ctx.goalOverride || extractGoalOverride(query, ctx.conversationHistory || []);
  if (!goalOverride) return ctx;

  let className = ctx.className || null;
  if (goalOverride.mainClass) {
    className = goalOverride.mainClass;
  } else if (goalOverride.dropClasses?.includes(className)) {
    className = goalOverride.advancementName
      ? inferSourceClassForAdvancement(goalOverride.advancementName)
      : null;
  }

  return { ...ctx, className, goalOverride };
}

/**
 * @param {{ user: string, assistant: string }[]} turns
 * @param {string} query
 */
export function isFullListFollowUp(turns, query) {
  const q = String(query || '');
  if (!/全列|全部|完整|详细|列出来|都列|逐项/.test(q)) return false;
  if (!turns?.length) return false;
  const last = turns[turns.length - 1];
  const prior = `${last.user || ''} ${last.assistant || ''}`;
  return /技能|法术|战技|流派|戏法|可选|有哪些/.test(prior);
}
