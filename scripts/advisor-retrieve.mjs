/**
 * Build Advisor — retrieval index (Phase 5).
 * Loads advisor JSON layers and exposes search + intent routing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAdvancementEligibility } from './advisor-eligibility.mjs';
import { analyzeSnapshot, normalizeSnapshot, formatSnapshotContext } from './advisor-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');

const STYLE_NAMES = ['塑能', '咒法', '预言', '防护', '附魔', '死灵', '幻术', '变化'];

const INTENT_RULES = [
  {
    id: 'eligibility',
    patterns: [/智力\s*\d+/, /能走/, /达标/, /属性.*进阶/],
    layers: ['L3', 'L0'],
    topK: { L3: 8, L0: 5 },
  },
  {
    id: 'multiclass_req',
    patterns: [/兼职.*条件/, /奇械师.*要/, /要什么条件/],
    layers: ['L0', 'L1'],
    topK: { L0: 8, L1: 5 },
  },
  {
    id: 'multiclass',
    patterns: [/兼职/, /子职/, /7级/],
    layers: ['L0'],
    topK: { L0: 10 },
  },
  {
    id: 'chargen',
    patterns: [/种族/, /背景/, /车卡/, /输出很猛/, /怎么选/],
    layers: ['L1', 'L0'],
    topK: { L1: 12, L0: 4 },
  },
  {
    id: 'feats',
    patterns: [/专长/, /4\s*级/, /8\s*级.*专长/],
    layers: ['L4', 'L0'],
    topK: { L4: 12, L0: 6 },
  },
  {
    id: 'advancement',
    patterns: [/进阶/, /近卫/, /5\s*级/, /系统奖励/, /冰霜法师/, /火焰法师/],
    layers: ['L3', 'L0'],
    topK: { L3: 10, L0: 5 },
  },
  {
    id: 'leveling',
    patterns: [/解锁/, /3\s*级/, /三阶/, /里程碑/, /升级/],
    layers: ['L0'],
    topK: { L0: 10 },
  },
  {
    id: 'sp_marks',
    patterns: [/标识/, /\bSP\b/, /sp_points/, /紫色标识/],
    layers: ['L0'],
    topK: { L0: 8 },
  },
  {
    id: 'universal_skills',
    patterns: [/通用天赋/, /通用.*天赋/, /通用天赋树/],
    layers: ['L2-universal', 'L0'],
    topK: { 'L2-universal': 18, L0: 3 },
  },
  {
    id: 'style_compare',
    patterns: [/咒法.*塑能/, /塑能.*咒法/, /风格.*选/, /流派.*选/, /怎么选.*风格/],
    layers: ['L2-mage', 'L1', 'L5'],
    topK: { 'L2-mage': 12, L1: 6, L5: 5 },
  },
  {
    id: 'tips',
    patterns: [/combo/, /小贴士/, /技巧/, /借机/, /反应动作/, /贴脸/, /塑能相关/],
    layers: ['L5', 'L2-mage'],
    topK: { L5: 8, 'L2-mage': 10 },
  },
  {
    id: 'mage_skills',
    patterns: [/塑能/, /咒法/, /预言/, /防护/, /附魔/, /死灵/, /幻术/, /变化/, /技能/, /法术/, /飞弹/, /寒冰/, /1～3|1-3|一级|二级|三级/],
    layers: ['L2-mage', 'L1'],
    topK: { 'L2-mage': 18, L1: 4 },
  },
];

let _cache = null;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

export function loadAdvisorStore() {
  if (_cache) return _cache;
  _cache = {
    rulesSummary: loadJson('rules/rules_summary.json'),
    leveling: loadJson('rules/leveling.json'),
    multiclass: loadJson('rules/multiclass.json'),
    spMarks: loadJson('rules/sp_marks.json'),
    statusConditions: loadJson('rules/status_conditions.json'),
    races: loadJson('chargen/races.json'),
    backgrounds: loadJson('chargen/backgrounds.json'),
    mageHints: loadJson('chargen/mage_hints.json'),
    mageClass: loadJson('chargen/mage_class.json'),
    pointBuy: loadJson('chargen/point_buy.json'),
    mageSkills: loadJson('skills/mage_index.json'),
    universalSkills: loadJson('skills/universal_index.json'),
    advancements: loadJson('advancements.json'),
    advancementSkills: fs.existsSync(path.join(ADVISOR, 'advancement_skills.json'))
      ? loadJson('advancement_skills.json')
      : { byName: {} },
    feats: loadJson('feats.json'),
    tips: loadJson('combos/mage_tips.json'),
  };
  return _cache;
}

export function tokenize(text) {
  const raw = String(text || '').toLowerCase();
  const tokens = new Set();
  for (const ch of raw.replace(/\s+/g, '')) {
    if (/[\u4e00-\u9fff]/.test(ch)) tokens.add(ch);
  }
  const words = raw.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const w of words) tokens.add(w);
  for (const s of STYLE_NAMES) {
    if (raw.includes(s)) tokens.add(s);
  }
  for (const kw of ['兼职', '专长', '进阶', '标识', '塑能', '咒法', '通用', '种族', '背景', '智力', '冰霜', '火球', '飞弹', 'combo', '小贴士']) {
    if (raw.includes(kw)) tokens.add(kw);
  }
  return [...tokens];
}

export function scoreText(queryTokens, text) {
  if (!text) return 0;
  const hay = String(text).toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (hay.includes(t)) score += t.length >= 2 ? 3 : 1;
  }
  return score;
}

function detectStyles(query) {
  return STYLE_NAMES.filter((s) => query.includes(s));
}

export function routeIntent(query) {
  const q = query.toLowerCase();
  if (/进阶/.test(query) && pickAdvancementName(query)) {
    return {
      id: 'advancement',
      layers: ['L3', 'L0'],
      topK: { L3: 10, L0: 5 },
      query,
    };
  }
  let best = { id: 'general', layers: ['L0', 'L1', 'L2-mage'], topK: { L0: 5, L1: 8, 'L2-mage': 12 } };
  let bestScore = 0;

  for (const rule of INTENT_RULES) {
    let s = 0;
    for (const p of rule.patterns) {
      if (p.test(q)) s += 2;
    }
    if (s > bestScore) {
      bestScore = s;
      best = rule;
    }
  }

  return { ...best, query };
}

function parseAttrsFromQuery(query) {
  const attrs = {};
  const intM = query.match(/智力\s*(\d+)/);
  if (intM) attrs.智力 = Number(intM[1]);
  return attrs;
}

function pickAdvancementName(query) {
  const store = loadAdvisorStore();
  for (const adv of store.advancements.advancements) {
    if (query.includes(adv.name)) return adv.name;
  }
  if (/冰霜/.test(query)) return '冰霜法师';
  return null;
}

function searchList(items, getText, queryTokens, limit, filterFn = null) {
  let pool = items;
  if (filterFn) pool = pool.filter(filterFn);
  return pool
    .map((item) => ({ item, score: scoreText(queryTokens, getText(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

function buildL0Results(store, query, queryTokens, topK) {
  const out = { rulesSummary: store.rulesSummary, hits: [] };

  if (/兼职|7级|子职/.test(query)) {
    const mage = store.multiclass.requirements.find((r) => r.class === '法师');
    const compat = store.multiclass.compatibility?.法师 || {};
    out.hits.push({
      type: 'multiclass_mage',
      unlockLevel: store.multiclass.meta.mainClassUnlockLevel,
      mageRequirement: mage,
      compatibleSubclasses: Object.entries(compat).filter(([, v]) => v).map(([k]) => k),
      incompatible: mage?.incompatibleWith || [],
    });
  }

  if (/奇械师/.test(query)) {
    const artificer = store.multiclass.requirements.find((r) => r.class === '奇械师');
    out.hits.push({ type: 'class_req', class: '奇械师', requirement: artificer });
  }

  if (/标识|sp|紫色/.test(query.toLowerCase())) {
    out.hits.push({
      type: 'sp_marks',
      learnCost: store.spMarks.spPoints?.learnCost,
      wildcards: store.spMarks.colorMarks?.wildcards,
      note: '标识由 DM 根据模组主题结算；顾问不得建议刻意刷标识',
    });
  }

  const levelMatch = query.match(/(\d+)\s*级/);
  if (levelMatch || /解锁|三阶|里程碑|系统奖励/.test(query) || /\d+\s*级/.test(query)) {
    const lv = levelMatch ? Number(levelMatch[1]) : null;
    const levels = store.leveling.mainClass?.levels || [];
    if (lv) {
      const row = levels.find((l) => l.level === lv);
      if (row) out.hits.push({ type: 'main_level', level: lv, row });
    }
    out.hits.push({ type: 'feat_milestones', milestones: store.leveling.featMilestones });
    out.hits.push({ type: 'advancement_milestones', milestones: store.leveling.advancementMilestones });
    out.hits.push({ type: 'talent_tier_unlocks', data: store.leveling.talentTierUnlocks });
    if (/3级|三阶/.test(query)) {
      const l3 = levels.find((l) => l.level === 3);
      out.hits.push({ type: 'level_3_highlight', row: l3, talentTier: store.leveling.talentTierUnlocks?.unlocks?.find((u) => u.tier === 3) });
    }
  }

  const bullets = store.rulesSummary.bullets.filter((b) => scoreText(queryTokens, b) > 0);
  out.hits.push({ type: 'rules_bullets', bullets: bullets.slice(0, topK || 5) });

  return out;
}

function buildL1Results(store, query, queryTokens, limit) {
  const races = searchList(
    store.races.races,
    (r) => `${r.name} ${r.intBonus ?? ''} ${r.description || ''} ${JSON.stringify(r)}`,
    queryTokens,
    Math.ceil(limit / 2),
  );
  const backgrounds = searchList(
    store.backgrounds.backgrounds,
    (b) => `${b.name} ${(b.skills || []).join(' ')} ${b.lore || ''} ${(b.mageSkillHits || []).join(' ')}`,
    queryTokens,
    Math.ceil(limit / 2),
  );

  const styles = detectStyles(query);
  let styleHints = store.mageHints.styleHints || [];
  if (styles.length) {
    styleHints = styleHints.filter((h) => styles.includes(h.name));
  } else if (/风格|流派|咒法|塑能/.test(query)) {
    styleHints = styleHints.slice(0, 4);
  }

  return {
    primaryAttr: store.mageHints.primaryAttr,
    recommendedRaces: store.mageHints.recommendedRaces,
    recommendedBackgrounds: store.mageHints.recommendedBackgrounds?.slice(0, 8),
    races,
    backgrounds,
    styleHints,
    combatStyles: styles.length
      ? (store.mageClass.combatStyles || []).filter((s) => styles.includes(s.name))
      : [],
  };
}

function buildL2MageResults(store, query, queryTokens, limit) {
  const styles = detectStyles(query);
  const tierFilter = /1[～~\-—到]3|1\s*~\s*3|一级|二级|三级|低阶|初期|前三级|优先学/.test(query);
  const byName = Object.fromEntries(store.mageSkills.skills.map((s) => [s.name, s]));

  let ranked = searchList(
    store.mageSkills.skills,
    (s) => s.searchText || `${s.name} ${s.style} ${s.summary}`,
    queryTokens,
    limit,
    (s) => {
      if (s.type === 'starting') return true;
      if (styles.length && s.style && !styles.includes(s.style)) return false;
      if (tierFilter && s.tier && !['一阶', '二阶', '三阶', null].includes(s.tier) && s.type !== 'starting') {
        return s.tier === '一阶' || s.tier === '二阶' || s.tier === '三阶';
      }
      return true;
    },
  );

  if (styles.includes('塑能') && tierFilter) {
    const pin = ['塑能箭', '魔法飞弹', '火焰箭', '雷光箭', '寒冰箭', '强酸箭']
      .map((n) => byName[n])
      .filter(Boolean);
    const seen = new Set();
    ranked = [...pin, ...ranked].filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).slice(0, limit);
  }

  return ranked;
}

function buildL2UniversalResults(store, query, queryTokens, limit) {
  const outputBias = /输出|法术|塑能|攻击|伤害|法师/.test(query);
  const MAGE_OUTPUT_BOOST = ['法术精准', '法术精通', '极速施法', '魔法发烧友', '头脑风暴'];
  const byName = Object.fromEntries(store.universalSkills.skills.map((s) => [s.name, s]));

  let ranked = searchList(
    store.universalSkills.skills,
    (s) => {
      let text = s.searchText || `${s.name} ${s.summary}`;
      if (outputBias && MAGE_OUTPUT_BOOST.includes(s.name)) text += ' mage_output_boost';
      return text;
    },
    queryTokens,
    limit,
    outputBias
      ? (s) => s.roleHints?.includes('burst')
        || s.roleHints?.includes('precision')
        || MAGE_OUTPUT_BOOST.includes(s.name)
        || /法术|施法|命中|塑能|输出/.test(s.searchText || '')
      : () => true,
  );

  if (outputBias) {
    const pinned = MAGE_OUTPUT_BOOST.filter((n) => byName[n]).map((n) => byName[n]);
    const seen = new Set();
    ranked = [...pinned, ...ranked].filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).slice(0, limit);
  }

  return ranked;
}

function buildL3Results(store, query, queryTokens, limit, attrs) {
  const advName = pickAdvancementName(query);
  let items = store.advancements.advancements;

  if (advName) {
    items = items.filter((a) => a.name.includes(advName) || advName.includes(a.name));
  }

  const ranked = searchList(
    items,
    (a) => a.searchText || `${a.name} ${a.inferenceBlurb} ${JSON.stringify(a.attrsRequired)}`,
    queryTokens,
    limit,
  );

  const eligibility = [];
  if (Object.keys(attrs).length) {
    for (const adv of ranked.slice(0, 5)) {
      eligibility.push(checkAdvancementEligibility(adv, attrs));
    }
  }

  return { advancements: ranked, eligibility, documentedSkills: pickDocumentedSkills(store, ranked) };
}

function pickDocumentedSkills(store, rankedAdvancements) {
  const byName = store.advancementSkills?.byName || {};
  const out = [];
  for (const adv of rankedAdvancements.slice(0, 5)) {
    const doc = byName[adv.name];
    if (!doc) continue;
    out.push({ advancementName: adv.name, ...doc });
  }
  return out;
}

function buildL4Results(store, query, queryTokens, limit) {
  const outputBias = /输出|法术|塑能|攻击|伤害/.test(query);
  return searchList(
    store.feats.feats,
    (f) => f.searchText || `${f.name} ${f.summary}`,
    queryTokens,
    limit,
    outputBias ? (f) => f.mageRelevance === 'high' || f.mageRelevance === 'medium' : () => true,
  );
}

function buildL5Results(store, query, queryTokens, limit) {
  const styles = detectStyles(query);
  return searchList(
    store.tips.tips,
    (t) => t.searchText || `${t.title} ${t.summary} ${t.detail}`,
    queryTokens,
    limit,
    styles.length ? (t) => !t.style || styles.includes(t.style) : () => true,
  );
}

/**
 * @param {string} query user question
 * @param {{ topK?: Record<string, number>, snapshot?: object }} options
 */
export function retrieve(query, options = {}) {
  const store = loadAdvisorStore();
  const intent = routeIntent(query);
  const queryTokens = tokenize(query);
  const topK = { ...intent.topK, ...options.topK };
  let attrs = parseAttrsFromQuery(query);

  let l6Analysis = null;
  if (options.snapshot) {
    const norm = options.snapshot.meta?.layer === 'L6'
      ? options.snapshot
      : normalizeSnapshot(options.snapshot);
    const advName = pickAdvancementName(query);
    l6Analysis = analyzeSnapshot(norm, {
      advancementNames: advName ? [advName] : null,
    });
    attrs = { ...(l6Analysis.snapshot.attrs || {}), ...attrs };
  }

  const layers = {};
  const layersHit = [];

  for (const layer of intent.layers) {
    layersHit.push(layer);
    const k = topK[layer] || 10;
    switch (layer) {
      case 'L0':
        layers.L0 = buildL0Results(store, query, queryTokens, k);
        break;
      case 'L1':
        layers.L1 = buildL1Results(store, query, queryTokens, k);
        break;
      case 'L2-mage':
        layers['L2-mage'] = buildL2MageResults(store, query, queryTokens, k);
        break;
      case 'L2-universal':
        layers['L2-universal'] = buildL2UniversalResults(store, query, queryTokens, k);
        break;
      case 'L3':
        layers.L3 = buildL3Results(store, query, queryTokens, k, attrs);
        break;
      case 'L4':
        layers.L4 = buildL4Results(store, query, queryTokens, k);
        break;
      case 'L5':
        layers.L5 = buildL5Results(store, query, queryTokens, k);
        break;
      default:
        break;
    }
  }

  if (l6Analysis) {
    layers.L6 = l6Analysis;
    if (!layersHit.includes('L6')) layersHit.push('L6');
    if (layers.L3) {
      layers.L3.eligibility = l6Analysis.advancements;
    }
  }

  return {
    query,
    intent: intent.id,
    layersRequested: intent.layers,
    layersHit,
    attrsParsed: attrs,
    hasSnapshot: !!l6Analysis,
    results: layers,
  };
}

export function formatContext(retrieval) {
  const lines = [];
  lines.push(`# 检索上下文（意图: ${retrieval.intent}）`);
  lines.push(`问题: ${retrieval.query}`);
  lines.push('');

  if (retrieval.results.L6) {
    lines.push(formatSnapshotContext(retrieval.results.L6));
    lines.push('');
  }

  if (retrieval.results.L0) {
    lines.push('## L0 规则');
    for (const hit of retrieval.results.L0.hits || []) {
      lines.push(`- ${hit.type}: ${JSON.stringify(hit).slice(0, 500)}`);
    }
    lines.push('');
  }

  if (retrieval.results.L1) {
    const l1 = retrieval.results.L1;
    lines.push('## L1 车卡');
    if (l1.primaryAttr) lines.push(`- 关键属性: ${l1.primaryAttr.name} 目标 ${l1.primaryAttr.targetAtCreation}`);
    for (const r of (l1.races || []).slice(0, 5)) lines.push(`- 种族: ${r.name} 智力${r.intBonus ?? '?'}`);
    for (const b of (l1.backgrounds || []).slice(0, 5)) lines.push(`- 背景: ${b.name} 技能${(b.skills || []).join('、')}`);
    for (const h of l1.styleHints || []) lines.push(`- 风格 ${h.name}: ${h.summary || h.sampleSkills?.join('、')}`);
    lines.push('');
  }

  if (retrieval.results['L2-mage']?.length) {
    lines.push('## L2 法师技能');
    for (const s of retrieval.results['L2-mage'].slice(0, 15)) {
      lines.push(`- ${s.name} [${s.style || '起手'}·${s.tier || '-'}] ${s.summary?.slice(0, 120) || ''}`);
      if (s.choicesFrom) lines.push(`  抉择: ${s.choicesFrom}`);
    }
    lines.push('');
  }

  if (retrieval.results['L2-universal']?.length) {
    lines.push('## L2 通用天赋');
    for (const s of retrieval.results['L2-universal'].slice(0, 12)) {
      lines.push(`- ${s.name}: ${s.summary?.slice(0, 100) || ''}`);
    }
    lines.push('');
  }

  if (retrieval.results.L3) {
    lines.push('## L3 进阶');
    for (const a of retrieval.results.L3.advancements || []) {
      const doc = retrieval.results.L3.documentedSkills?.find((d) => d.advancementName === a.name || d.name === a.name);
      const conf = doc ? 'documented' : a.confidence;
      lines.push(`- ${a.name} [${a.scope}] 属性${JSON.stringify(a.attrsRequired)} 置信度${conf}`);
      if (doc) {
        lines.push(`  描述: ${doc.description?.slice(0, 160) || ''}`);
        for (const t of (doc.talents || []).slice(0, 6)) {
          lines.push(`  · ${t.name}（${t.kind}）: ${(t.summary || '').slice(0, 140)}`);
        }
      } else {
        lines.push(`  ${a.inferenceBlurb}`);
      }
    }
    for (const e of retrieval.results.L3.eligibility || []) {
      lines.push(`- 达标检测 ${e.advancementName}: ${e.eligible ? '✓' : '✗'} gaps=${JSON.stringify(e.gaps)}`);
    }
    lines.push('');
  }

  if (retrieval.results.L4?.length) {
    lines.push('## L4 专长');
    for (const f of retrieval.results.L4.slice(0, 10)) {
      lines.push(`- ${f.name}: ${f.summary?.slice(0, 100) || ''}`);
    }
    lines.push('');
  }

  if (retrieval.results.L5?.length) {
    lines.push('## L5 小贴士');
    for (const t of retrieval.results.L5.slice(0, 8)) {
      lines.push(`- ${t.title}: ${t.summary}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('硬规则: 仅引用上文出现的名称；进阶 metadata_only 须免责声明；标识由 DM 结算。');
  return lines.join('\n');
}

function mainCli() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!query) {
    console.error('Usage: node scripts/advisor-retrieve.mjs [--json] "你的问题"');
    process.exit(1);
  }
  const result = retrieve(query);
  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatContext(result));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mainCli();
}
