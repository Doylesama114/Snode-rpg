/**
 * Advisor 5.0 batch5 — question classifier (7069).
 * Maps queries to categories A–I with intent + confidence; preferred over raw INTENT_RULES scoring.
 */
import { detectStructuredQuestion, parseProficiencyTargetsFromQuery } from './advisor-query-tools.mjs';
import { matchClassNameFromQuery } from './advisor-class-l2.mjs';
import { parseAcScenarioFromQuery, parseCombatScenarioFromQuery } from './advisor-combat-engine.mjs';
import { isBuildRoadmapQuery, isPanelRoadmapQuery, isBuildReviewQuery } from './advisor-build-roadmap.mjs';
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
  worldview_lore: 'G',
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
const WORLDVIEW_LORE_RE = /世界观|设定集|斯诺德大陆|盖茨|雷恩王国|年代记|地图志|九柱神|正神|异教神|邪恶神|拜伦帝国|上古年代|辉煌年代|混乱年代|灰色年代|曙光年代|古老的文明|周边政权|组织势力|雷恩.*节日|雷恩.*神|有哪些.*正神|公正与荣耀|奥法评议|泰瑟兰|轻语森林|北境|南境|西境|东境|四境|首都|王都|君冠城|主要城市|最大的城市|城市与城镇|城镇名录|国土|地域与形势|介绍一下.*境|.*境.*介绍|君冠城|白霜城|冬怒堡|嚎叫湾|洛克镇|箭谷镇|寒鸦镇|边陲镇|绿河谷镇|银烛城|砰砰城|威斯威尔|烬铁镇|布雷泽火焰-能源集团|灰隼镇|纺锤镇|金穗城|鹅湾|晴风郡|紫藤堡|绿野镇|河谷镇|暖径镇|赤戟城|阳葵城|牛堡|旧城|跳鼠镇|狼毒镇|红杈三角洲|沙枣镇与怪柳镇|道路系统|关卡与登记|交通方式|怎么走|如何前往|从.*出发|前往.*(?:城|镇|堡|湾)|行程|旅途|旅行|环游|旅游|观光|值得去|游玩|游览|目的地|名胜|景点|这个世界|世界.*介绍|讲讲.*世界|世界.*什么样|神秘.*(?:地方|地点|区域)|危险.*(?:地方|地点|区域)|传说.*(?:地方|地点)|吃什么|饮食|美食|食物|料理|祭拜|祈祷|礼拜|信仰.*仪式|这个游戏怎么玩|游戏怎么玩|怎么玩这个游戏/;

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

  // Worldview / setting questions (before build/chargen heuristics)
  if (WORLDVIEW_LORE_RE.test(q) && !/侍奉哪些神|背景.*神|侍僧/.test(q) && !/加点|购点|技能|进阶|兼职|专长|build|成长路线/.test(q)) {
    return {
      category: 'G',
      intent: 'worldview_lore',
      confidence: 0.9,
      source: 'heuristic',
    };
  }

  if (snapshot && isBuildReviewQuery(q, ctx)) {
    return {
      category: 'H',
      intent: 'build_review',
      confidence: 0.93,
      source: 'panel',
      meta: { snapshotLinked: true },
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
      if (isBuildReviewQuery(q, { snapshot })) {
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
