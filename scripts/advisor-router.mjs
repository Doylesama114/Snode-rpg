/**
 * Phase 3 — query router: mode + intent + layer plan + prompt profile.
 */
import { pickAdvancementName } from './advisor-router-utils.mjs';
import { getClassProfile, isFullTier } from './advisor-chargen-registry.mjs';

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
    patterns: [/咒法.*塑能/, /塑能.*咒法/, /风格.*选/, /流派.*选/, /怎么选.*风格/],
    layers: ['L2-mage', 'L1', 'L5'],
    topK: { 'L2-mage': 12, L1: 6, L5: 5 },
    promptProfile: 'mage_skills',
  },
  {
    id: 'artificer_style_compare',
    patterns: [/精准.*构想/, /构想.*精准/, /奇械师.*风格/, /战斗风格.*选/],
    layers: ['L2-artificer', 'L1', 'L5'],
    topK: { 'L2-artificer': 12, L1: 6, L5: 5 },
    promptProfile: 'artificer_skills',
  },
  {
    id: 'tips',
    patterns: [/combo/, /小贴士/, /技巧/, /借机/, /反应动作/, /贴脸/, /塑能相关/],
    layers: ['L5', 'L2-mage'],
    topK: { L5: 8, 'L2-mage': 10 },
    promptProfile: 'tips',
  },
  {
    id: 'artificer_skills',
    patterns: [/奇械师/, /精准/, /构想/, /炽擎/, /电涌/, /魔枢/, /枪械/, /图纸/, /零件包/, /同调/, /研发/, /战术装填/, /弹射齿轮/],
    layers: ['L2-artificer', 'L1'],
    topK: { 'L2-artificer': 18, L1: 4 },
    promptProfile: 'artificer_skills',
  },
  {
    id: 'mage_skills',
    patterns: [/塑能/, /咒法/, /预言/, /防护/, /附魔/, /死灵/, /幻术/, /变化/, /技能/, /法术/, /飞弹/, /寒冰/, /1～3|1-3|一级|二级|三级/],
    layers: ['L2-mage', 'L1'],
    topK: { 'L2-mage': 18, L1: 4 },
    promptProfile: 'mage_skills',
  },
];

const MAGE_QUERY_RE = /法师|塑能|咒法|预言|防护|附魔|死灵|幻术|变化|法术|魔弹|飞弹|寒冰|火球/;
const ARTIFICER_QUERY_RE = /奇械师|精准|构想|炽擎|电涌|魔枢|枪械|图纸|零件包|同调|研发|战术装填|弹射齿轮/;

function allowL2Mage(className, query) {
  if (className === '法师' && isFullTier(getClassProfile('法师'))) return true;
  if (!className && MAGE_QUERY_RE.test(query || '')) return true;
  return false;
}

function allowL2Artificer(className, query) {
  const profile = getClassProfile(className || '奇械师');
  if (className === '奇械师' && profile.tier === 'partial') return true;
  if (!className && ARTIFICER_QUERY_RE.test(query || '')) return true;
  return false;
}

export function resolveClassL2Layer(className, query = '') {
  if (allowL2Mage(className, query)) return 'L2-mage';
  if (allowL2Artificer(className, query)) return 'L2-artificer';
  return null;
}

const L2_INJECT_INTENTS = new Set([
  'general', 'chargen', 'wizard_step', 'artificer_skills', 'artificer_style_compare', 'tips',
]);

export function applyClassRouteFilter(route, ctx = {}) {
  const { className, query } = ctx;
  const intent = route.intent || route.id;
  const mageOk = allowL2Mage(className, query);
  const artOk = allowL2Artificer(className, query);
  const origTopK = { ...route.topK };

  route.layers = route.layers.filter((l) => {
    if (l === 'L2-mage') return mageOk;
    if (l === 'L2-artificer') return artOk;
    return true;
  });
  if (!mageOk) delete route.topK['L2-mage'];
  if (!artOk) delete route.topK['L2-artificer'];

  if (artOk && L2_INJECT_INTENTS.has(intent) && !route.layers.includes('L2-artificer')) {
    route.layers.push('L2-artificer');
    route.topK['L2-artificer'] = origTopK['L2-artificer'] || 12;
  }

  if (route.intent === 'mage_skills' || route.intent === 'style_compare') {
    if (!mageOk) {
      route.layers = [...new Set([...route.layers.filter((l) => l !== 'L2-mage'), 'L5', 'L0'])];
      route.topK.L5 = route.topK.L5 || 6;
      route.topK.L0 = route.topK.L0 || 4;
      route.promptProfile = route.intent === 'style_compare' ? 'tips' : 'general';
    }
  }

  if (route.intent === 'artificer_skills' || route.intent === 'artificer_style_compare') {
    if (!artOk) {
      route.layers = [...new Set([...route.layers.filter((l) => l !== 'L2-artificer'), 'L5', 'L0'])];
      route.topK.L5 = route.topK.L5 || 6;
      route.topK.L0 = route.topK.L0 || 4;
      route.promptProfile = route.intent === 'artificer_style_compare' ? 'tips' : 'general';
    }
  }

  if (route.intent === 'tips') {
    if (mageOk && !route.layers.includes('L2-mage')) {
      route.layers.push('L2-mage');
      route.topK['L2-mage'] = route.topK['L2-mage'] || 8;
    }
    if (artOk && !route.layers.includes('L2-artificer')) {
      route.layers.push('L2-artificer');
      route.topK['L2-artificer'] = route.topK['L2-artificer'] || 8;
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
  layers: ['L0', 'L1', 'L2-mage'],
  topK: { L0: 5, L1: 8, 'L2-mage': 12 },
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
  if (entityTypes.has('class') && /武器|护甲|豁免|初始武器|职业基础/.test(query)) return 'entity_qa';
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
    { ...rule, mode, layers: [...rule.layers], topK: { ...rule.topK } },
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
