/**
 * Advisor — 主动追问（澄清缺失信息，返回可点选的选项）。
 * 原则：只在确实缺关键信息时追问；wizard/车卡/快照场景不打扰。
 */
import { matchClassNameFromQuery, matchAllClassesFromQuery, getL2EntryByClassName } from './advisor-class-l2.mjs';
import { loadAdvisorStore } from './advisor-retrieve.mjs';

const BUILDISH_INTENTS = new Set([
  'build_roadmap', 'build_review', 'class_skills', 'advancement', 'leveling', 'tips', 'chargen',
]);
const LEVEL_RE = /(\d+)\s*级/;

export function detectClarify(query, ctx = {}) {
  const q = String(query || '');
  const intent = ctx.intent || '';
  if (!BUILDISH_INTENTS.has(intent)) return null;
  if (ctx.mode === 'wizard' || ctx.hasChargenState || ctx.hasSnapshot) return null;
  // 已点名牧师神圣领域的问题，不再追问风格，直接列出该领域技能
  const CLERIC_DEITY_RE = /无尽饥饿与吞噬之神|神圣领域|生命与丰收之神|战争与谋略之神|知识与智慧之神|艺术与创造之神|爱、欲望与激情之神|幸运女神|隐秘与变化之神|公正与荣耀之神|火焰与锻造之神|死神|潮汐、引力与崩坏之神/;
  if (CLERIC_DEITY_RE.test(q)) return null;


  const className = ctx.retrievalClass || matchClassNameFromQuery(q);
  const namedClasses = matchAllClassesFromQuery(q);
  const store = ctx.store || loadAdvisorStore();
  const classNames = Object.keys(store.classBasicsByName || {}).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh'));

  const needs = [];
  if (!className && !namedClasses.length && classNames.length) {
    needs.push({
      type: 'class',
      prompt: '你想玩哪个职业？',
      options: classNames,
    });
    return { needs, query: q };
  }

  const planningContext = /升级|规划|路线|前几级|几级|升到|当前.*级|从.*级/.test(q);
  const styleChoice = /流派|风格|怎么选|选什么|哪个优先|对比|区别/.test(q);
  if (className && !LEVEL_RE.test(q) && !styleChoice && planningContext && /build_roadmap|leveling|advancement/.test(intent)) {
    needs.push({
      type: 'level',
      prompt: `当前角色等级是几级？（${className}）`,
      options: ['1', '3', '5', '7', '10', '15', '20'],
    });
    return { needs, query: q };
  }

  if (className && /class_skills|build_roadmap/.test(intent)) {
    const entry = getL2EntryByClassName(className);
    const styles = (entry?.styleKeywords || []).filter(Boolean);
    if (styles.length && !styles.some((s) => q.includes(s))) {
      needs.push({
        type: 'style',
        prompt: `想走哪个战斗风格？（${className}）`,
        options: styles,
      });
      return { needs, query: q };
    }
  }

  return null;
}
