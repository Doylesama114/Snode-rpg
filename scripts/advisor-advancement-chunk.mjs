/**
 * Infer build-direction tags and blurbs for advancement chunks.
 */

const INFERENCE_RULES = [
  { re: /冰霜|冻结|臻冰/, tags: ['frost', 'control'], blurb: '名称与条件指向冰霜/控场方向' },
  { re: /火焰|灼烧|凤凰/, tags: ['fire', 'burst'], blurb: '名称与条件指向火焰/爆发输出方向' },
  { re: /雷电|雷光|风暴/, tags: ['lightning', 'burst'], blurb: '名称与条件指向雷电/爆发方向' },
  { re: /奥术|奥法|秘法/, tags: ['arcane', 'utility'], blurb: '名称指向奥术/多功能施法方向' },
  { re: /死灵|亡灵|尸/, tags: ['necromancy', 'control'], blurb: '名称指向死灵/控场方向' },
  { re: /幻术|幻象|迷惑/, tags: ['illusion', 'control'], blurb: '名称指向幻术/控场方向' },
  { re: /防护|结界|护盾/, tags: ['abjuration', 'defense'], blurb: '名称指向防护/生存方向' },
  { re: /变化|变形|炼金/, tags: ['transmutation', 'utility'], blurb: '名称指向变化/功能型方向' },
  { re: /咒法|召唤|元素/, tags: ['conjuration', 'summon'], blurb: '名称指向咒法/召唤方向' },
  { re: /预言|预知|占卜/, tags: ['divination', 'utility'], blurb: '名称指向预言/信息方向' },
  { re: /附魔|魅惑|心灵/, tags: ['enchantment', 'control'], blurb: '名称指向附魔/惑控方向' },
  { re: /魔剑|剑|刃/, tags: ['gish', 'melee'], blurb: '名称指向魔武双修/近战方向' },
  { re: /医师|医疗|医药/, tags: ['support', 'healing'], blurb: '名称指向医疗/支援方向' },
  { re: /近卫|骑士|扈从/, tags: ['tank', 'defense'], blurb: '名称指向护卫/承伤方向' },
  { re: /战斗大师|复仇者|勇士/, tags: ['martial', 'general'], blurb: '名称指向通用战斗强化方向' },
  { re: /边界行者|塑形者|高阶冒险者/, tags: ['general', 'progression'], blurb: '名称指向通用进阶/成长方向' },
];

export function inferAdvancementTags(adv) {
  const blob = `${adv.name} ${(adv.conditions || []).join(' ')}`;
  for (const rule of INFERENCE_RULES) {
    if (rule.re.test(blob)) {
      return { inferenceTag: rule.tags, inferenceBlurb: `${rule.blurb}，具体技能以规则书为准` };
    }
  }
  return {
    inferenceTag: ['general'],
    inferenceBlurb: '仅有进阶元数据（属性/标识/剧情条件），具体技能以规则书为准',
  };
}

export function inferConfidence(adv) {
  const hasMeta = Object.keys(adv.attrs || {}).length > 0
    || (adv.conditions || []).length > 0
    || (adv.cost || []).length > 0;
  return hasMeta ? 'metadata_only' : 'name_inference';
}

/**
 * @param {object} adv raw from 法师·进阶.json / 通用·进阶.json
 * @param {'mage-only'|'universal'} scope
 */
export function advancementToChunk(adv, scope) {
  const { inferenceTag, inferenceBlurb } = inferAdvancementTags(adv);
  const markCost = (adv.cost || []).map((c) => ({
    name: c.name,
    amount: c.amount,
    color: c.color || null,
  }));
  const chunk = {
    id: adv.id,
    name: adv.name,
    scope,
    sourceClasses: adv.source_classes || [],
    attrsRequired: adv.attrs || {},
    markCost,
    conditions: adv.conditions || [],
    inferenceTag,
    inferenceBlurb,
    confidence: inferConfidence(adv),
    mageEligible: (adv.source_classes || []).some((c) => c === '法师' || c === '全职业'),
    searchText: '',
  };
  if (adv.branch) chunk.branches = [adv.branch];
  if (adv.branch_full) chunk.branchFulls = [adv.branch_full];
  chunk.searchText = [
    chunk.name,
    chunk.scope,
    ...(chunk.sourceClasses || []),
    ...(chunk.branches || []),
    ...(chunk.branchFulls || []),
    ...Object.entries(chunk.attrsRequired).map(([k, v]) => `${k}${v}`),
    ...chunk.markCost.map((m) => `${m.name}${m.amount}`),
    ...(chunk.conditions || []),
    ...(chunk.inferenceTag || []),
    chunk.inferenceBlurb,
  ].join(' ');
  return chunk;
}
