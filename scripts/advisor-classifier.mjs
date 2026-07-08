/**
 * Advisor 5.0 batch5 — question classifier (7069).
 * Maps queries to categories A–I with intent + confidence; preferred over raw INTENT_RULES scoring.
 */
import { detectStructuredQuestion, parseProficiencyTargetsFromQuery } from './advisor-query-tools.mjs';
import { matchClassNameFromQuery } from './advisor-class-l2.mjs';
import { parseAcScenarioFromQuery, parseCombatScenarioFromQuery } from './advisor-combat-engine.mjs';
import { isBuildRoadmapQuery, isPanelRoadmapQuery } from './advisor-build-roadmap.mjs';
import { pickAdvancementName } from './advisor-router-utils.mjs';

/** @typedef {'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'} QuestionCategory */

export const QUESTION_CATEGORIES = {
  A: 'entity_qa',
  B: 'cross_entity_compare',
  C: 'chargen_build',
  D: 'growth_planning',
  E: 'progression_proficiency',
  F: 'combat_math',
  G: 'rules_query',
  H: 'panel_snapshot',
  I: 'unknown_gate',
};

export const INTENT_TO_CATEGORY = {
  skill_detail: 'A',
  entity_qa: 'A',
  cross_class_compare: 'B',
  class_weapon_prof: 'B',
  skill_aggregate: 'B',
  class_skills: 'B',
  chargen_hp_optimize: 'C',
  point_buy_optimize: 'C',
  leveling_summary: 'E',
  chargen: 'C',
  build_roadmap: 'D',
  advancement: 'D',
  build_review: 'H',
  proficiency_roadmap: 'E',
  leveling: 'E',
  combat_math: 'F',
  status_rules: 'G',
  feat_timing: 'G',
  multiclass: 'G',
  multiclass_req: 'G',
  feats: 'G',
  general: 'G',
  unknown_entity: 'I',
  equipment_lookup: 'A',
  equipment_search: 'A',
  background_detail: 'A',
  proficiency_lookup: 'B',
  starting_gear_lookup: 'C',
  race_detail: 'A',
  background_chargen: 'C',
  mage_skills: 'A',
  wizard_step: 'C',
};

const PANEL_SNAPSHOT_RE = /当前.*build|我的build|面板|快照|已学技能|已有熟练|我还缺|怎么评价|build.*评价|角色现状/;
const ENTITY_QA_RE = /种族特性|属性加成|什么特性|起始装备|起始资金|背景.*熟练|吸血鬼|人类.*特性/;
const COMBAT_SHORT_RE = /命中加值|攻击加值|伤害加值|护甲值|防御等级/;

/**
 * @param {string} intent
 * @returns {QuestionCategory}
 */
export function categoryForIntent(intent) {
  return INTENT_TO_CATEGORY[intent] || 'G';
}

/**
 * @param {string} query
 * @param {{ snapshot?: object|null, mode?: string }} [ctx]
 * @returns {{
 *   category: QuestionCategory,
 *   intent: string,
 *   confidence: number,
 *   source: 'structured'|'panel'|'heuristic'|'roadmap'|'fallback',
 *   structured?: object|null,
 *   meta?: object,
 * }|null}
 */
export function classifyQuestion(query, ctx = {}) {
  const q = String(query || '').trim();
  if (!q) return null;

  const snapshot = ctx.snapshot || null;

  const structured = detectStructuredQuestion(q);
  if (structured?.intent) {
    const meta = {};
    if (snapshot && (structured.intent === 'combat_math' || structured.intent === 'proficiency_roadmap')) {
      meta.snapshotLinked = true;
    }
    return {
      category: categoryForIntent(structured.intent),
      intent: structured.intent,
      confidence: 0.92,
      source: 'structured',
      structured,
      meta: Object.keys(meta).length ? meta : undefined,
    };
  }

  if (snapshot && isPanelRoadmapQuery(q, ctx)) {
    return {
      category: 'D',
      intent: 'build_roadmap',
      confidence: 0.95,
      source: 'roadmap',
    };
  }

  if (isBuildRoadmapQuery(q)) {
    return {
      category: 'D',
      intent: 'build_roadmap',
      confidence: 0.88,
      source: 'roadmap',
    };
  }

  if (snapshot?.meta?.layer === 'L6' || snapshot?.attrs) {
    if (PANEL_SNAPSHOT_RE.test(q)) {
      if (/怎么评价|build.*评价|适合.*技能/.test(q)) {
        return {
          category: 'H',
          intent: 'build_review',
          confidence: 0.85,
          source: 'panel',
          meta: { snapshotLinked: true },
        };
      }
      if (/(知识|奥秘|巧手|宗教|表演|运动|自然|欺瞒|洞悉|我还缺).*熟练|熟练.*(知识|奥秘|巧手|宗教|表演)/.test(q)) {
        const targets = parseProficiencyTargetsFromQuery(q);
        return {
          category: 'E',
          intent: 'proficiency_roadmap',
          confidence: 0.82,
          source: 'panel',
          structured: {
            intent: 'proficiency_roadmap',
            className: snapshot.classes?.[0]?.name || matchClassNameFromQuery(q) || '法师',
            targets: targets.length ? targets : ['知识', '奥秘'],
            query: q,
            fromSnapshot: true,
          },
          meta: { snapshotLinked: true },
        };
      }
    }

    if (COMBAT_SHORT_RE.test(q) && /多少|是多少|怎么算/.test(q) && !/力量调整值[为是]?\+?\d+/.test(q)) {
      const isAc = /护甲值|防御等级|\bAC\b/i.test(q);
      return {
        category: 'F',
        intent: 'combat_math',
        confidence: 0.8,
        source: 'panel',
        structured: {
          intent: 'combat_math',
          mode: isAc ? 'ac' : 'hit',
          query: q,
          fromSnapshot: true,
          scenario: isAc ? parseAcScenarioFromQuery(q) : parseCombatScenarioFromQuery(q),
        },
        meta: { snapshotLinked: true },
      };
    }
  }

  if (ENTITY_QA_RE.test(q)) {
    return {
      category: 'A',
      intent: 'entity_qa',
      confidence: 0.75,
      source: 'heuristic',
    };
  }

  if (/进阶/.test(q) && pickAdvancementName(q)) {
    return {
      category: 'D',
      intent: 'advancement',
      confidence: 0.72,
      source: 'heuristic',
    };
  }

  if (/兼职|子职|7\s*级.*兼/.test(q)) {
    return {
      category: 'G',
      intent: /条件|需要|满足/.test(q) ? 'multiclass_req' : 'multiclass',
      confidence: 0.7,
      source: 'heuristic',
    };
  }

  if (/主职.*升到|升到.*级.*获得|累计.*奖励/.test(q)) {
    return {
      category: 'E',
      intent: 'leveling',
      confidence: 0.68,
      source: 'heuristic',
    };
  }

  if (/购点|32\s*点|创建角色|车卡/.test(q)) {
    return {
      category: 'C',
      intent: 'chargen',
      confidence: 0.65,
      source: 'heuristic',
    };
  }

  return null;
}
