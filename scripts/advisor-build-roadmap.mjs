/**
 * Advisor 3.0+ — generic build roadmap (L2 抽样 + 快照分析；kit 仅作可选参考).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveL2LayerForClass, MAGE_L2, matchAllClassesFromQuery } from './advisor-class-l2.mjs';
import { getMainClass } from './advisor-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const KITS_DIR = path.join(ADVISOR, 'build_kits');

export const ROADMAP_DISCLAIMER = '以上建议由 AI 根据当前资料整理，仅作参考；具体 build 请结合角色实际情况、规则书与 DM 沟通。';

const KIT_ALIASES = {
  magic_sword: ['魔剑士', '魔武', 'gish'],
  magic_bullet: ['魔弹射手', '魔弹'],
};

const BUILD_ROADMAP_RE = /怎么选|如何选择|想玩|规划|路线|build|配点|该怎么选|如何选|进阶.*怎么|怎么.*进阶|怎么规划|如何规划/;
const ROADMAP_SKILL_RE = /技能|build|配|路线|规划|流派|风格|专长|天赋|进阶/;
const CATALOG_LIST_RE = /有哪些|能学|哪些|什么技能|什么法术|什么战技|除了.*初始|除.*起手/;
const PANEL_REVIEW_RE = /怎么评价|评价.*build|当前的build|当前.*build|build.*评价/;
const PANEL_SKILL_RE = /技能|适合|缺口|学什么|点什么|推荐|build/i;

const TIER_BY_BAND = {
  early: ['起手', '一阶', '二阶', '-'],
  mid: ['三阶', '四阶'],
  late: ['五阶', '六阶', '七阶', '八阶', '九阶'],
};

let _kitCache = null;
let _advCache = null;

function loadKitIndex() {
  if (_kitCache) return _kitCache;
  _kitCache = {};
  if (!fs.existsSync(KITS_DIR)) return _kitCache;
  for (const file of fs.readdirSync(KITS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const kit = JSON.parse(fs.readFileSync(path.join(KITS_DIR, file), 'utf8'));
      if (kit.id) _kitCache[kit.id] = kit;
    } catch {
      /* skip */
    }
  }
  return _kitCache;
}

function loadAdvancementsList() {
  if (!_advCache) {
    _advCache = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'advancements.json'), 'utf8')).advancements || [];
  }
  return _advCache;
}

export function loadBuildKit(kitId) {
  if (!kitId) return null;
  return loadKitIndex()[kitId] || null;
}

export function detectRoadmapKitId(query) {
  const q = String(query || '');
  for (const [kitId, aliases] of Object.entries(KIT_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) return kitId;
  }
  return null;
}

export function resolveAdvancementName(query) {
  const q = String(query || '');
  const names = loadAdvancementsList()
    .map((a) => a.name)
    .sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (q.includes(name)) return name;
  }
  if (/冰霜/.test(q) && !q.includes('冰霜护盾')) return '冰霜法师';
  return null;
}

/**
 * @param {string} query
 * @param {object|null} snapshot
 */
export function parseRoadmapGoal(query, snapshot = null) {
  const q = String(query || '');
  const classesFromQuery = matchAllClassesFromQuery(q);
  let mainClass = classesFromQuery[0] || null;
  let subClass = classesFromQuery[1] || null;

  const mainM = q.match(/主职(?:业)?[：:\s]*([^，,、\s]{2,8})/);
  const subM = q.match(/子职(?:业)?[：:\s]*([^，,、\s]{2,8})/);
  if (mainM?.[1]) mainClass = mainM[1].replace(/的.*$/, '');
  if (subM?.[1]) subClass = subM[1].replace(/的.*$/, '');

  if (snapshot?.classes?.length) {
    const main = getMainClass(snapshot);
    mainClass = main.name || mainClass;
    const sub = snapshot.classes.slice(1).find((c) => c?.name && (c.level || 0) > 0);
    if (sub?.name) subClass = sub.name;
  }

  const advancementName = resolveAdvancementName(q);
  const kitId = detectRoadmapKitId(q);

  if (!mainClass) mainClass = '法师';

  return {
    mainClass,
    subClass: subClass || null,
    advancementName,
    kitId,
  };
}

export function isBuildRoadmapQuery(query) {
  const q = String(query || '');
  if (/怎么评价|评价.*build|当前的build|当前.*build|build.*评价/.test(q)) return false;
  if (CATALOG_LIST_RE.test(q) && !/进阶|规划|路线|想玩|怎么规划|如何规划/.test(q)) return false;

  const planning = BUILD_ROADMAP_RE.test(q) && ROADMAP_SKILL_RE.test(q);
  const advancementPlan = /进阶/.test(q) && /怎么|规划|路线|选|build|技能/i.test(q);
  const dualClassPlan = /主职|子职|主职业|子职业/.test(q) && planning;

  return planning || advancementPlan || dualClassPlan;
}

export function isPanelRoadmapQuery(query, ctx = {}) {
  if (isBuildRoadmapQuery(query)) return true;
  if (!ctx.snapshot) return false;
  return PANEL_REVIEW_RE.test(query) && PANEL_SKILL_RE.test(query);
}

export function getRoadmapRouteConfig(goal = {}) {
  const mainClass = goal.mainClass || '法师';
  const mainLayer = mainClass === '法师' ? MAGE_L2 : resolveL2LayerForClass(mainClass);
  const layers = ['L3'];
  const topK = { L3: 12, 'L2-universal': 14, L4: 12, L0: 5 };

  if (mainLayer) {
    layers.push(mainLayer);
    topK[mainLayer] = 18;
  }

  if (goal.subClass) {
    const subLayer = resolveL2LayerForClass(goal.subClass);
    if (subLayer && !layers.includes(subLayer)) {
      layers.push(subLayer);
      topK[subLayer] = 18;
    }
  }

  layers.push('L2-universal', 'L4', 'L0');

  return { layers, topK, subLayer: goal.subClass ? resolveL2LayerForClass(goal.subClass) : null, goal };
}

export function getBuildPhaseBand(mainLevel) {
  const lv = Number(mainLevel) || 1;
  if (lv <= 3) return 'early';
  if (lv <= 8) return 'mid';
  return 'late';
}

export function getBuildPhaseLabel(band) {
  if (band === 'early') return '前期（主职约 L1–3，技能重心在一–二阶）';
  if (band === 'mid') return '中期（主职约 L4–8，技能重心在三–四阶）';
  return '后期（主职 L9+，技能重心在五阶及以上）';
}

function getSkillsForClass(store, className) {
  if (className === '法师') return store.mageSkills?.skills || [];
  const layer = resolveL2LayerForClass(className);
  if (layer && store.classSkillIndexes?.[layer]) {
    return store.classSkillIndexes[layer].skills || [];
  }
  return [];
}

function listStylesForClass(store, className) {
  const skills = getSkillsForClass(store, className);
  const styles = new Set();
  for (const s of skills) {
    if (s.style) styles.add(s.style);
  }
  return [...styles].sort((a, b) => a.localeCompare(b, 'zh'));
}

function skillTier(s) {
  return s.tier || (s.type === 'starting' ? '起手' : '-');
}

function sampleSkillsForStyle(store, className, style, band, limit = 4) {
  const tiers = TIER_BY_BAND[band] || TIER_BY_BAND.early;
  const skills = getSkillsForClass(store, className).filter((s) => {
    const tier = skillTier(s);
    return s.style === style && tiers.includes(tier);
  });
  return skills.slice(0, limit).map((s) => ({
    name: s.name,
    tier: skillTier(s),
    style: s.style || '',
    summary: (s.summary || '').slice(0, 90),
  }));
}

function buildClassPhaseCatalog(store, className) {
  const styles = listStylesForClass(store, className);
  const phases = {};
  for (const band of ['early', 'mid', 'late']) {
    const byStyle = {};
    for (const style of styles.slice(0, 6)) {
      const samples = sampleSkillsForStyle(store, className, style, band, 3);
      if (samples.length) byStyle[style] = samples;
    }
    phases[band] = {
      label: getBuildPhaseLabel(band),
      tierLabels: TIER_BY_BAND[band],
      byStyle,
    };
  }
  return { className, styles, phases };
}

function findAdvancementMeta(name) {
  if (!name) return null;
  return loadAdvancementsList().find((a) => a.name === name) || null;
}

function sampleFeats(store, limit = 10) {
  return (store.feats?.feats || [])
    .filter((f) => f.mageRelevance === 'high' || f.mageRelevance === 'medium')
    .slice(0, limit)
    .map((f) => ({ name: f.name, summary: (f.summary || '').slice(0, 100) }));
}

function sampleUniversalTalents(store, band, limit = 4) {
  const skills = store.universalSkills?.skills || [];
  const tierMap = { early: ['一阶', '二阶', '-'], mid: ['三阶', '四阶'], late: ['五阶', '六阶', '七阶', '八阶', '九阶'] };
  const tiers = tierMap[band] || tierMap.early;
  return skills
    .filter((s) => tiers.includes(s.tier || '-'))
    .slice(0, limit)
    .map((s) => ({ name: s.name, tier: s.tier || '-', summary: (s.summary || '').slice(0, 80) }));
}

function briefKitHint(kit) {
  if (!kit) return null;
  return {
    note: '以下为历史模板参考，可能不完整或有误，勿当作唯一标准答案。',
    id: kit.id,
    name: kit.name,
    styleHints: {
      main: [kit.mage?.primaryStyle, kit.mage?.secondaryStyle].filter(Boolean),
      sub: [kit.warrior?.primaryStyle, kit.warrior?.secondaryStyle].filter(Boolean),
    },
  };
}

function findSkillByName(store, className, name) {
  return getSkillsForClass(store, className).find((s) => s.name === name) || null;
}

export function analyzeSnapshotGeneric(snapshot, goal, store) {
  const main = getMainClass(snapshot);
  const phaseBand = getBuildPhaseBand(main.level || 1);
  const learned = (snapshot.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);

  const strengths = [];
  const gaps = [];
  const mainEntry = (snapshot.classes || []).find((c) => c.name === main.name);
  const subEntry = goal.subClass
    ? (snapshot.classes || []).find((c) => c.name === goal.subClass)
    : (snapshot.classes || []).slice(1).find((c) => c?.name);

  const mainStyles = (mainEntry?.styles || []).filter(Boolean);
  if (mainStyles.length) strengths.push(`主职已选流派：${mainStyles.join('、')}`);
  else gaps.push(`主职「${main.name}」尚未在快照中锁定战斗风格，可先明确 1～2 条流派方向`);

  if (subEntry?.name) {
    const subStyles = (subEntry.styles || []).filter(Boolean);
    if ((subEntry.level || 0) > 0 && !subStyles.length) {
      gaps.push(`子职「${subEntry.name}」已开启但未选战斗风格`);
    } else if (subStyles.length) {
      strengths.push(`子职 ${subEntry.name} L${subEntry.level || 0}，流派：${subStyles.join('、')}`);
    }
  }

  if (learned.length) {
    strengths.push(`已学技能 ${learned.length} 项：${learned.slice(0, 8).join('、')}${learned.length > 8 ? '…' : ''}`);
  } else {
    gaps.push('快照中尚无已学技能记录，可结合创角起手与前期规划');
  }

  const styleCounts = {};
  for (const name of learned) {
    const sk = findSkillByName(store, main.name, name)
      || (subEntry?.name ? findSkillByName(store, subEntry.name, name) : null);
    const st = sk?.style || '（未知流派）';
    styleCounts[st] = (styleCounts[st] || 0) + 1;
  }
  const styleSummary = Object.entries(styleCounts).map(([k, v]) => `${k}×${v}`).join('、');
  if (styleSummary) strengths.push(`已学技能流派分布：${styleSummary}`);

  const takenFeats = snapshot.special_feats || [];
  const nextFeatLevel = main.level >= 13 ? null : main.level >= 8 ? 13 : main.level >= 4 ? 8 : 4;

  return {
    phaseBand,
    phaseLabel: getBuildPhaseLabel(phaseBand),
    learned,
    strengths,
    gaps,
    takenFeats,
    nextFeatWindow: nextFeatLevel ? `L${nextFeatLevel} 专长窗口` : '暂无即将开放的专长窗口',
  };
}

/**
 * @param {object} store
 * @param {object} goal parseRoadmapGoal result
 * @param {{ snapshot?: object }} options
 */
export function buildGenericRoadmapContext(store, goal, options = {}) {
  const snapshot = options.snapshot || null;
  const main = snapshot ? getMainClass(snapshot) : { name: goal.mainClass, level: 1 };
  const mainLevel = main.level || 1;
  const advancement = findAdvancementMeta(goal.advancementName);
  const kit = goal.kitId ? loadBuildKit(goal.kitId) : null;

  return {
    mode: 'generic',
    disclaimer: ROADMAP_DISCLAIMER,
    goal: {
      advancementName: goal.advancementName || advancement?.name || null,
      mainClass: goal.mainClass || main.name,
      subClass: goal.subClass || null,
    },
    advancement: advancement ? {
      name: advancement.name,
      scope: advancement.scope,
      attrsRequired: advancement.attrsRequired,
      inferenceBlurb: advancement.inferenceBlurb,
      confidence: advancement.confidence,
      conditions: (advancement.conditions || []).slice(0, 4),
    } : null,
    scenario: snapshot ? 'panel' : 'planning',
    mainLevel,
    phaseBand: getBuildPhaseBand(mainLevel),
    phaseLabel: getBuildPhaseLabel(getBuildPhaseBand(mainLevel)),
    mainClassCatalog: buildClassPhaseCatalog(store, goal.mainClass || main.name),
    subClassCatalog: goal.subClass ? buildClassPhaseCatalog(store, goal.subClass) : null,
    universalTalents: {
      early: sampleUniversalTalents(store, 'early'),
      mid: sampleUniversalTalents(store, 'mid'),
      late: sampleUniversalTalents(store, 'late'),
    },
    featSamples: sampleFeats(store, 12),
    kitHint: briefKitHint(kit),
    analysis: snapshot ? analyzeSnapshotGeneric(snapshot, goal, store) : null,
  };
}

/** @deprecated use buildGenericRoadmapContext */
export function buildRoadmapContext(store, kit, options = {}) {
  const goal = {
    mainClass: kit.mainClass,
    subClass: kit.subClass,
    advancementName: kit.advancementName,
    kitId: kit.id,
  };
  return buildGenericRoadmapContext(store, goal, options);
}

export function formatRoadmapContext(ctx) {
  const lines = [];
  lines.push('## Build 路线图（build_roadmap · 通用）');
  lines.push('- 说明：以下为资料库抽样与检索摘要，供 AI 组织分阶段建议；**非固定配点表**，须结合玩家取向灵活发挥。');
  lines.push(`- 免责声明（回答末尾须复述）：${ctx.disclaimer || ROADMAP_DISCLAIMER}`);

  const g = ctx.goal || {};
  const goalParts = [
    g.advancementName ? `进阶「${g.advancementName}」` : null,
    `主职 ${g.mainClass || '?'}`,
    g.subClass ? `子职 ${g.subClass}` : null,
  ].filter(Boolean);
  lines.push(`- 目标：${goalParts.join(' · ')}`);
  lines.push(`- 场景：${ctx.scenario === 'panel' ? '面板（含快照）' : '规划（无快照）'}`);
  lines.push(`- 当前阶段：${ctx.phaseLabel || ''}${ctx.mainLevel ? `（主职 L${ctx.mainLevel}）` : ''}`);
  lines.push('');

  if (ctx.advancement) {
    const a = ctx.advancement;
    lines.push('### L3 进阶参考');
    lines.push(`- ${a.name}（${a.scope || ''}，confidence=${a.confidence || '?'})`);
    if (a.inferenceBlurb) lines.push(`- 方向：${a.inferenceBlurb}`);
    if (a.attrsRequired) lines.push(`- 属性门槛：${JSON.stringify(a.attrsRequired)}`);
    if (a.conditions?.length) lines.push(`- 剧情/行为条件（摘要）：${a.conditions.join('；')}`);
    lines.push('');
  }

  function formatClassCatalog(catalog) {
    if (!catalog) return;
    lines.push(`### ${catalog.className} — 流派与分阶段候选示例（从 L2 索引抽样，非完整列表）`);
    lines.push(`- 可用战斗风格：${catalog.styles.join('、') || '见 L2 上下文'}`);
    for (const band of ['early', 'mid', 'late']) {
      const ph = catalog.phases[band];
      if (!ph) continue;
      lines.push(`\n#### ${catalog.className} · ${ph.label}`);
      for (const [style, skills] of Object.entries(ph.byStyle || {})) {
        const items = skills.map((s) => `${s.name}(${s.tier})`).join('、');
        lines.push(`- ${style} 例：${items}`);
      }
    }
    lines.push('');
  }

  formatClassCatalog(ctx.mainClassCatalog);
  formatClassCatalog(ctx.subClassCatalog);

  lines.push('### 通用天赋（L2-universal 抽样）');
  for (const band of ['early', 'mid', 'late']) {
    const talents = ctx.universalTalents?.[band];
    if (!talents?.length) continue;
    const label = band === 'early' ? '前期' : band === 'mid' ? '中期' : '后期';
    lines.push(`- ${label}：${talents.map((t) => t.name).join('、')}`);
  }
  lines.push('');

  if (ctx.featSamples?.length) {
    lines.push('### 专长候选（L4 上下文抽样，须结合 build 自选）');
    lines.push(`- 例：${ctx.featSamples.slice(0, 8).map((f) => f.name).join('、')}`);
    lines.push('');
  }

  if (ctx.kitHint) {
    lines.push('### 可选模板参考（非强制、可能有误）');
    lines.push(`- ${ctx.kitHint.note}`);
    if (ctx.kitHint.styleHints?.main?.length) {
      lines.push(`- 主职风格参考：${ctx.kitHint.styleHints.main.map((s) => s.name).join('、')}`);
    }
    if (ctx.kitHint.styleHints?.sub?.length) {
      lines.push(`- 子职风格参考：${ctx.kitHint.styleHints.sub.map((s) => s.name).join('、')}`);
    }
    lines.push('');
  }

  if (ctx.analysis) {
    const a = ctx.analysis;
    lines.push('### 快照 build 观察（供评价，非扣分清单）');
    lines.push(`- 阶段：${a.phaseLabel}`);
    if (a.strengths.length) lines.push(`- 现状：${a.strengths.join('；')}`);
    if (a.gaps.length) lines.push(`- 可思考方向：${a.gaps.join('；')}`);
    if (a.takenFeats?.length) lines.push(`- 已选专长：${a.takenFeats.join('、')}`);
    lines.push(`- 下一专长窗口：${a.nextFeatWindow}`);
    lines.push('');
  }

  lines.push('### 作答要求（给模型）');
  lines.push('- 根据用户取向与 L2/L3/L4 检索内容组织路线，可提出多条流派思路，勿机械照搬上文示例清单。');
  lines.push('- 有快照时：推荐技能不得超出「可学技能位阶」；进阶≠兼职。');
  lines.push(`- 结尾单独一行：${ctx.disclaimer || ROADMAP_DISCLAIMER}`);

  return lines.join('\n');
}

export function planBuildRoadmapFromRules(query, ctx = {}) {
  if (!isPanelRoadmapQuery(query, ctx)) return null;
  const goal = parseRoadmapGoal(query, ctx.snapshot || null);
  let scenario = 'mixed';
  if (ctx.mode === 'wizard') scenario = 'chargen';
  else if (ctx.snapshot) scenario = 'build';

  return {
    source: 'rules',
    scenario,
    answerStyle: 'roadmap',
    tasks: [{
      type: 'build_roadmap',
      generic: true,
      mainClass: goal.mainClass,
      subClass: goal.subClass,
      advancementName: goal.advancementName,
      goal: goal.advancementName || goal.mainClass,
      kitId: goal.kitId || null,
    }],
    intent: 'build_roadmap',
    promptProfile: 'build_roadmap',
  };
}
