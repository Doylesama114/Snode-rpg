/**
 * Phase 3 — query router: mode + intent + layer plan + prompt profile.
 */
import { pickAdvancementName } from './advisor-router-utils.mjs';
import { getClassProfile, isFullTier } from './advisor-chargen-registry.mjs';
import {
  MAGE_L2,
  MAGE_QUERY_RE,
  allowL2Layer,
  allowL2Mage,
  listL2ClassEntries,
  matchAllClassesFromQuery,
  matchClassNameFromQuery,
  resolveL2LayerForClass,
  resolveRegistryL2Layer,
} from './advisor-class-l2.mjs';

import { resolveClassPromptProfile } from './advisor-class-tier.mjs';
import { isBuildRoadmapQuery } from './advisor-build-roadmap.mjs';

export { resolveClassL2Layer } from './advisor-class-l2.mjs';

export const MODES = ['advisor', 'wizard', 'entity_qa'];

export const INTENT_RULES = [
  {
    id: 'eligibility',
    patterns: [/智力\s*\d+/, /能走/, /达标/, /属性.*进阶/],
    layers: ['L3', 'L0'],
    topK: { L3: 8, L0: 5 },
    promptProfile: 'eligibility',
  },
  {
    id: 'multiclass_req',
    patterns: [/兼职.*条件/, /奇械师.*要/, /要什么条件/],
    layers: ['L0', 'L1'],
    topK: { L0: 8, L1: 5 },
    promptProfile: 'multiclass',
  },
  {
    id: 'multiclass',
    patterns: [/兼职/, /子职/, /7级/],
    layers: ['L0'],
    topK: { L0: 10 },
    promptProfile: 'multiclass',
  },
  {
    id: 'entity_qa',
    patterns: [/种族特性/, /属性加成/, /什么特性/, /起始装备/, /起始资金/, /背景.*熟练/, /吸血鬼/],
    layers: ['L1'],
    topK: { L1: 4 },
    promptProfile: 'entity_qa',
  },
  {
    id: 'chargen',
    patterns: [/种族/, /背景/, /车卡/, /输出很猛/, /怎么选/, /武器/, /护甲/, /熟练/, /初始/, /起手/, /装备/, /购点/, /专精/, /创建/],
    layers: ['L1', 'L0'],
    topK: { L1: 12, L0: 4 },
    promptProfile: 'chargen',
  },
  {
    id: 'feats',
    patterns: [/专长/, /4\s*级/, /8\s*级.*专长/],
    layers: ['L4', 'L0'],
    topK: { L4: 12, L0: 6 },
    promptProfile: 'feats',
  },
  {
    id: 'build_review',
    patterns: [/怎么评价/, /评价.*build/, /当前的build/, /当前.*build/, /适合.*技能/, /build.*评价/],
    layers: ['L3', 'L2-mage', 'L0'],
    topK: { L3: 12, 'L2-mage': 14, L0: 4 },
    promptProfile: 'build_review',
  },
  {
    id: 'build_roadmap',
    patterns: [
      /魔剑士/, /主职.*法师.*子职.*战士/, /主职业法师.*子职业战士/,
      /进阶.*魔剑/, /想玩.*法师.*战士/, /规划.*技能/, /build.*路线/,
    ],
    layers: ['L3', 'L2-mage', 'L2-warrior', 'L2-universal', 'L4', 'L0'],
    topK: { L3: 10, 'L2-mage': 14, 'L2-warrior': 14, 'L2-universal': 12, L4: 10, L0: 4 },
    promptProfile: 'build_roadmap',
  },
  {
    id: 'advancement',
    patterns: [/进阶/, /近卫/, /5\s*级/, /系统奖励/, /冰霜法师/, /火焰法师/],
    layers: ['L3', 'L0'],
    topK: { L3: 10, L0: 5 },
    promptProfile: 'advancement',
  },
  {
    id: 'leveling',
    patterns: [/解锁/, /3\s*级/, /三阶/, /里程碑/, /升级/, /熟练/, /属性点/, /属性\+/, /奖励/, /获得什么/, /升到/, /升到.*级/, /槽位/],
    layers: ['L0'],
    topK: { L0: 10 },
    promptProfile: 'leveling',
  },
  {
    id: 'sp_marks',
    patterns: [/标识/, /\bSP\b/, /sp_points/, /紫色标识/],
    layers: ['L0'],
    topK: { L0: 8 },
    promptProfile: 'general',
  },
  {
    id: 'universal_skills',
    patterns: [/通用天赋/, /通用.*天赋/, /通用天赋树/],
    layers: ['L2-universal', 'L0'],
    topK: { 'L2-universal': 18, L0: 3 },
    promptProfile: 'mage_skills',
  },
  {
    id: 'style_compare',
    patterns: [/咒法.*塑能/, /塑能.*咒法/],
    layers: ['L2-mage', 'L1', 'L5'],
    topK: { 'L2-mage': 12, L1: 6, L5: 5 },
    promptProfile: 'mage_skills',
  },
  {
    id: 'tips',
    patterns: [/combo/, /小贴士/, /技巧/, /借机/, /反应动作/, /贴脸/, /塑能相关/],
    layers: ['L5'],
    topK: { L5: 8 },
    promptProfile: 'tips',
  },
  {
    id: 'class_skills',
    patterns: [
      /流派/, /战斗风格/, /职业树/, /什么流派/, /风格.*选/, /怎么选.*风格/,
      /优先学/, /1～3|1-3|一级|二级|三级/,
      /战士/, /蛮斗士/, /猎人/, /武僧/, /奇械师/,
      /牧师/, /圣骑士/, /游荡者/, /德鲁伊/, /萨满/, /术士/,
      /吟游诗人/, /吟游/, /魔契师/, /魔契/,
      /斗争/, /狂攻/, /防护/, /射击/, /军团/, /机敏/,
      /狂暴/, /生机/, /法咒/, /兽群/, /猎鹰/, /生存/,
      /极斗/, /踏风/, /织雾/, /无尘/, /锋岚/, /酒仙/, /凰火/,
      /戒律/, /虔佑/, /魂谒/, /惩戒/, /守护/, /圣洁/, /热诚/,
      /奇袭/, /妙手/, /魅影/, /狂妄/, /魔药/,
      /荒野/, /兽灵/, /复苏/, /月影/, /日怒/, /星辰/, /精火/,
      /风暴/, /火焰/, /水源/, /大地/, /巫术/, /潜能/,
      /激昂/, /舒缓/, /灵动/, /诙谐/, /集中/,
      /邪念/, /咒能/, /秘术/,
      /精准/, /构想/, /炽擎/, /电涌/, /魔枢/, /枪械/, /图纸/,
    ],
    layers: ['L1'],
    topK: { L1: 6 },
    promptProfile: 'class_skills',
  },
  {
    id: 'mage_skills',
    patterns: [/塑能/, /咒法/, /预言/, /防护/, /附魔/, /死灵/, /幻术/, /变化/, /法术/, /飞弹/, /寒冰/],
    layers: ['L2-mage', 'L1'],
    topK: { 'L2-mage': 18, L1: 4 },
    promptProfile: 'mage_skills',
  },
];

const REGISTRY_L2_LAYERS = () => listL2ClassEntries().map((e) => e.l2Layer);

const L2_INJECT_INTENTS = new Set([
  'general', 'chargen', 'wizard_step', 'class_skills', 'tips', 'build_review', 'build_roadmap', 'advancement',
]);

function activeL2Layer(className, query) {
  return resolveRegistryL2Layer(className, query) || (allowL2Mage(className, query) ? MAGE_L2 : null);
}

export function applyClassRouteFilter(route, ctx = {}) {
  const { className, query } = ctx;
  const intent = route.intent || route.id;
  const resolvedClass = className || matchClassNameFromQuery(query);
  const origTopK = { ...route.topK };
  const registryLayers = REGISTRY_L2_LAYERS();

  route.layers = route.layers.filter((l) => {
    if (l === MAGE_L2) return allowL2Layer(MAGE_L2, resolvedClass, query);
    if (registryLayers.includes(l)) return allowL2Layer(l, resolvedClass, query);
    return true;
  });

  if (!allowL2Layer(MAGE_L2, resolvedClass, query)) delete route.topK[MAGE_L2];
  for (const layerId of registryLayers) {
    if (!allowL2Layer(layerId, resolvedClass, query)) delete route.topK[layerId];
  }

  const injectLayer = activeL2Layer(resolvedClass, query);
  if (injectLayer && L2_INJECT_INTENTS.has(intent) && !route.layers.includes(injectLayer)) {
    route.layers.push(injectLayer);
    route.topK[injectLayer] = origTopK[injectLayer] || 12;
  }

  const multiClasses = matchAllClassesFromQuery(query);
  if (multiClasses.length > 1 && L2_INJECT_INTENTS.has(intent)) {
    for (const cn of multiClasses) {
      const layer = resolveL2LayerForClass(cn);
      if (layer && allowL2Layer(layer, cn, query) && !route.layers.includes(layer)) {
        route.layers.push(layer);
        route.topK[layer] = origTopK[layer] || 18;
      }
    }
    if (multiClasses.length > 1) {
      route.promptProfile = 'class_skills';
    }
  }

  if (intent === 'class_skills') {
    if (injectLayer) {
      route.layers = [...new Set(['L1', injectLayer, ...route.layers.filter((l) => l === 'L0' || l === 'L5')])];
      route.topK[injectLayer] = route.topK[injectLayer] || 18;
      route.topK.L1 = route.topK.L1 || 6;
      const profile = getClassProfile(resolvedClass);
      const base = profile.tier === 'full' && resolvedClass === '法师' ? 'mage_skills' : 'class_skills';
      route.promptProfile = resolveClassPromptProfile(resolvedClass, base);
    } else {
      route.layers = [...new Set([...route.layers.filter((l) => l !== MAGE_L2 && !registryLayers.includes(l)), 'L5', 'L0'])];
      route.topK.L5 = route.topK.L5 || 6;
      route.topK.L0 = route.topK.L0 || 4;
      route.promptProfile = 'general';
    }
  }

  if (route.intent === 'mage_skills' || route.intent === 'style_compare') {
    if (!allowL2Mage(resolvedClass, query)) {
      route.layers = [...new Set([...route.layers.filter((l) => l !== MAGE_L2), 'L5', 'L0'])];
      route.topK.L5 = route.topK.L5 || 6;
      route.topK.L0 = route.topK.L0 || 4;
      route.promptProfile = route.intent === 'style_compare' ? 'tips' : 'general';
    }
  }

  if (route.intent === 'tips') {
    const layer = activeL2Layer(resolvedClass, query);
    if (layer && !route.layers.includes(layer)) {
      route.layers.push(layer);
      route.topK[layer] = route.topK[layer] || 8;
    }
    if (!route.layers.includes('L5')) {
      route.layers.push('L5');
      route.topK.L5 = route.topK.L5 || 8;
    }
  }

  return route;
}

const DEFAULT_RULE = {
  id: 'general',
  layers: ['L0', 'L1'],
  topK: { L0: 5, L1: 8 },
  promptProfile: 'general',
};

function scoreRule(rule, q) {
  let s = 0;
  for (const p of rule.patterns) {
    if (p.test(q)) s += 2;
  }
  return s;
}

function resolveIntentFromEntities(query, entityHits, baseIntent) {
  if (!entityHits?.length) return baseIntent;
  if (/种族特性|属性加成|起始装备|起始资金|吸血鬼/.test(query)) return 'entity_qa';
  const entityTypes = new Set(entityHits.map((e) => e.entityType));
  if (entityTypes.has('race') && /血族|精灵|矮人|人类|种族|属性|特性|加成|吸血鬼/.test(query)) {
    return 'entity_qa';
  }
  if (entityTypes.has('background') && /背景/.test(query)) return 'entity_qa';
  if (entityTypes.has('class') && /武器|护甲|豁免|初始武器|职业基础|起始套装|起手套装|起始装备/.test(query)) return 'entity_qa';
  return baseIntent;
}

function normalizeMode(mode, query, wizardState) {
  if (mode && MODES.includes(mode)) return mode;
  if (wizardState?.step != null || wizardState?.currentStep != null) return 'wizard';
  if (/种族特性|属性加成|有什么特性|起始装备|起始资金|吸血鬼/.test(query)) return 'entity_qa';
  return 'advisor';
}

function pickRuleByIntent(intentId) {
  return INTENT_RULES.find((r) => r.id === intentId) || DEFAULT_RULE;
}

export function routeIntent(query) {
  if (isBuildRoadmapQuery(query)) {
    return { ...pickRuleByIntent('build_roadmap'), id: 'build_roadmap', query };
  }
  const q = query.toLowerCase();
  if (/进阶/.test(query) && pickAdvancementName(query)) {
    return { ...pickRuleByIntent('advancement'), id: 'advancement', query };
  }
  let best = DEFAULT_RULE;
  let bestScore = 0;
  for (const rule of INTENT_RULES) {
    const s = scoreRule(rule, q);
    if (s > bestScore) {
      bestScore = s;
      best = rule;
    }
  }
  if (
    best.id === 'class_skills'
    && MAGE_QUERY_RE.test(query)
    && !listL2ClassEntries().some((e) => e.className !== '法师' && query.includes(e.className))
  ) {
    const mageRule = pickRuleByIntent('mage_skills');
    if (scoreRule(mageRule, q) > 0) {
      best = mageRule;
    }
  }
  return { ...best, query };
}

/**
 * @param {{ query: string, mode?: string, entityHits?: object[], wizardState?: object }} input
 */
export function routeQuery(input) {
  const { query, entityHits = [], wizardState = null, className = null } = input;
  const mode = normalizeMode(input.mode, query, wizardState);
  const base = routeIntent(query);
  let intent = base.id;

  if (mode === 'entity_qa') {
    intent = resolveIntentFromEntities(query, entityHits, 'entity_qa');
  } else {
    intent = resolveIntentFromEntities(query, entityHits, intent);
  }

  if (mode === 'wizard' && wizardState?.step != null) {
    intent = 'wizard_step';
  }

  let rule = intent === 'wizard_step'
    ? { ...DEFAULT_RULE, id: 'wizard_step', layers: ['L1'], topK: { L1: 10 }, promptProfile: 'wizard' }
    : pickRuleByIntent(intent);

  rule = applyClassRouteFilter(
    { ...rule, intent, mode, layers: [...rule.layers], topK: { ...rule.topK } },
    { className: className || wizardState?.selections?.className, query },
  );

  return {
    mode,
    intent,
    promptProfile: rule.promptProfile || intent,
    layers: [...rule.layers],
    topK: { ...rule.topK },
    query,
  };
}

export function getPromptProfile(intent, mode) {
  if (mode === 'wizard' || intent === 'wizard_step') return 'wizard';
  if (intent === 'entity_qa') return 'entity_qa';
  const rule = pickRuleByIntent(intent);
  return rule.promptProfile || intent;
}
