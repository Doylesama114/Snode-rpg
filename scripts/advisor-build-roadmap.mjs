/**
 * Advisor 3.0 — build kit presets + phased roadmap context.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveL2LayerForClass } from './advisor-class-l2.mjs';
import { getMainClass } from './advisor-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KITS_DIR = path.join(__dirname, '..', 'advisor', 'build_kits');

const KIT_ALIASES = {
  magic_sword: ['魔剑士', '魔武', 'gish'],
};

const ROADMAP_GOAL_PATTERNS = [
  { kitId: 'magic_sword', re: /魔剑士|魔武双修|主职.*法师.*子职.*战士|主职业法师.*子职业战士/ },
];

const BUILD_ROADMAP_RE = /怎么选|如何选择|想玩|规划|路线|build|配点|技能.*选|选.*技能|进阶.*怎么|怎么.*进阶/;
const ROADMAP_SKILL_RE = /技能|build|配|路线|规划|流派|风格|专长|天赋/;

let _kitCache = null;

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

export function loadBuildKit(kitId) {
  const kits = loadKitIndex();
  return kits[kitId] || null;
}

export function detectRoadmapKitId(query) {
  const q = String(query || '');
  for (const { kitId, re } of ROADMAP_GOAL_PATTERNS) {
    if (re.test(q)) return kitId;
  }
  for (const [kitId, aliases] of Object.entries(KIT_ALIASES)) {
    if (aliases.some((a) => q.includes(a))) return kitId;
  }
  return null;
}

export function isBuildRoadmapQuery(query) {
  const q = String(query || '');
  const kitId = detectRoadmapKitId(q);
  if (!kitId) return false;
  if (/怎么评价|评价.*build|当前的build|当前.*build|build.*评价/.test(q)) return false;
  return BUILD_ROADMAP_RE.test(q) && ROADMAP_SKILL_RE.test(q);
}

const PANEL_REVIEW_RE = /怎么评价|评价.*build|当前的build|当前.*build|build.*评价/;
const PANEL_SKILL_RE = /技能|适合|缺口|学什么|点什么|推荐|build/i;

/**
 * 规划问句，或绑定快照的面板 build 评价 + 已知 kit（如魔剑士）。
 */
export function isPanelRoadmapQuery(query, ctx = {}) {
  const q = String(query || '');
  const kitId = detectRoadmapKitId(q);
  if (!kitId) return false;
  if (isBuildRoadmapQuery(query)) return true;
  if (!ctx.snapshot) return false;
  return PANEL_REVIEW_RE.test(q) && PANEL_SKILL_RE.test(q);
}

/**
 * @param {number} mainLevel
 * @returns {'early'|'mid'|'late'}
 */
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

function findSkillByName(store, className, name) {
  const list = getSkillsForClass(store, className);
  return list.find((s) => s.name === name) || null;
}

function findUniversalTalent(store, name) {
  return (store.universalSkills?.skills || []).find((s) => s.name === name) || null;
}

function findFeat(store, name) {
  return (store.feats?.feats || []).find((f) => f.name === name) || null;
}

function resolveNamedSkills(store, className, names = []) {
  return names.map((name) => {
    const skill = findSkillByName(store, className, name);
    return {
      name,
      found: !!skill,
      tier: skill?.tier || (skill?.type === 'starting' ? '起手' : '-'),
      style: skill?.style || '',
      summary: (skill?.summary || '').slice(0, 100),
    };
  });
}

function resolvePhaseBlock(store, className, phaseBlock) {
  if (!phaseBlock) return null;
  const styles = {};
  for (const [style, picks] of Object.entries(phaseBlock.picks || {})) {
    styles[style] = resolveNamedSkills(store, className, picks);
  }
  return {
    label: phaseBlock.label,
    tierLabels: phaseBlock.tierLabels || [],
    styles,
  };
}

function resolveFeatsBlock(store, featsByLevel) {
  const out = {};
  for (const [lv, entries] of Object.entries(featsByLevel || {})) {
    out[lv] = (entries || []).map((entry) => {
      const name = typeof entry === 'string' ? entry : entry.name;
      const reason = typeof entry === 'object' ? entry.reason : '';
      const feat = findFeat(store, name);
      return {
        name,
        reason,
        found: !!feat,
        summary: (feat?.summary || '').slice(0, 120),
        mageRelevance: feat?.mageRelevance || '',
      };
    });
  }
  return out;
}

function resolveTalentsBlock(store, talentsByPhase) {
  const out = {};
  for (const [band, entries] of Object.entries(talentsByPhase || {})) {
    out[band] = (entries || []).map((entry) => {
      const name = typeof entry === 'string' ? entry : entry.name;
      const reason = typeof entry === 'object' ? entry.reason : '';
      const t = findUniversalTalent(store, name);
      return {
        name,
        reason,
        found: !!t,
        tier: t?.tier || '-',
        summary: (t?.summary || '').slice(0, 100),
      };
    });
  }
  return out;
}

/**
 * @param {object} store advisor store
 * @param {object} kit build kit JSON
 * @param {{ snapshot?: object, mainLevel?: number }} options
 */
export function buildRoadmapContext(store, kit, options = {}) {
  const snapshot = options.snapshot || null;
  const main = snapshot ? getMainClass(snapshot) : { name: kit.mainClass, level: options.mainLevel || 1 };
  const mainLevel = main.level || options.mainLevel || 1;

  return {
    kitId: kit.id,
    kitName: kit.name,
    advancementName: kit.advancementName,
    mainClass: kit.mainClass,
    subClass: kit.subClass,
    summary: kit.summary,
    scenario: snapshot ? 'panel' : 'planning',
    mainLevel,
    phaseBand: getBuildPhaseBand(mainLevel),
    phaseLabel: getBuildPhaseLabel(getBuildPhaseBand(mainLevel)),
    mage: {
      primaryStyle: kit.mage.primaryStyle,
      secondaryStyle: kit.mage.secondaryStyle,
      optionalStyles: kit.mage.optionalStyles || [],
      phases: {
        early: resolvePhaseBlock(store, kit.mainClass, kit.mage.phases.early),
        mid: resolvePhaseBlock(store, kit.mainClass, kit.mage.phases.mid),
        late: resolvePhaseBlock(store, kit.mainClass, kit.mage.phases.late),
      },
    },
    warrior: {
      primaryStyle: kit.warrior.primaryStyle,
      secondaryStyle: kit.warrior.secondaryStyle,
      optionalStyles: kit.warrior.optionalStyles || [],
      phases: {
        early: resolvePhaseBlock(store, kit.subClass, kit.warrior.phases.early),
        mid: resolvePhaseBlock(store, kit.subClass, kit.warrior.phases.mid),
        late: resolvePhaseBlock(store, kit.subClass, kit.warrior.phases.late),
        },
    },
    feats: resolveFeatsBlock(store, kit.feats),
    universalTalents: resolveTalentsBlock(store, kit.universalTalents),
    summaryNotes: kit.summaryNotes || {},
    analysis: snapshot ? analyzeBuildAgainstKit(snapshot, kit, store) : null,
  };
}

export function analyzeBuildAgainstKit(snapshot, kit, store) {
  const learned = new Set((snapshot.skills || []).map((s) => (typeof s === 'string' ? s : s.name)));
  const main = getMainClass(snapshot);
  const phaseBand = getBuildPhaseBand(main.level || 1);
  const phaseKey = phaseBand;

  const collectKitPicks = (side, className) => {
    const phase = kit[side]?.phases?.[phaseKey];
    const picks = [];
    for (const names of Object.values(phase?.picks || {})) {
      for (const n of names) picks.push({ name: n, className });
    }
    return picks;
  };

  const currentPicks = [
    ...collectKitPicks('mage', kit.mainClass),
    ...collectKitPicks('warrior', kit.subClass),
  ];

  const matched = [];
  const missing = [];
  for (const pick of currentPicks) {
    if (learned.has(pick.name)) matched.push(pick.name);
    else missing.push(pick.name);
  }

  const strengths = [];
  const gaps = [];
  const mageEntry = (snapshot.classes || []).find((c) => c.name === kit.mainClass);
  const warriorEntry = (snapshot.classes || []).find((c) => c.name === kit.subClass);
  const mageStyles = (mageEntry?.styles || []).filter(Boolean);
  const warriorStyles = (warriorEntry?.styles || []).filter(Boolean);

  if (mageStyles.includes(kit.mage.primaryStyle.name)) {
    strengths.push(`主职已选核心流派「${kit.mage.primaryStyle.name}」`);
  } else if (!mageStyles.length) {
    gaps.push(`主职尚未锁定流派，建议优先「${kit.mage.primaryStyle.name}」+「${kit.mage.secondaryStyle.name}」`);
  } else if (!mageStyles.includes(kit.mage.primaryStyle.name)) {
    gaps.push(`主职流派偏 ${mageStyles.join('、')}，与魔剑士常见的「${kit.mage.primaryStyle.name}」有偏差，可保留或逐步补附魔线`);
  }

  if (warriorEntry && (warriorEntry.level || 0) > 0 && !warriorStyles.length) {
    gaps.push(`子职战士已开但未选战斗风格，建议「${kit.warrior.primaryStyle.name}」或「${kit.warrior.secondaryStyle.name}」`);
  }

  if (missing.length) {
    gaps.push(`当前阶段 kit 建议尚未覆盖：${missing.slice(0, 6).join('、')}${missing.length > 6 ? '…' : ''}`);
  }

  const takenFeats = snapshot.special_feats || [];
  const nextFeatLevel = main.level >= 13 ? null : main.level >= 8 ? 13 : main.level >= 4 ? 8 : 4;

  return {
    phaseBand,
    phaseLabel: getBuildPhaseLabel(phaseBand),
    learned: [...learned],
    matchedKitPicks: matched,
    missingKitPicks: missing,
    strengths,
    gaps,
    takenFeats,
    nextFeatWindow: nextFeatLevel ? `L${nextFeatLevel} 专长窗口` : '暂无即将开放的专长窗口',
  };
}

export function formatRoadmapContext(ctx) {
  const lines = [];
  lines.push('## Build 路线图（build_roadmap）');
  lines.push(`- 目标：${ctx.kitName}（${ctx.advancementName}）| 主职 ${ctx.mainClass} + 子职 ${ctx.subClass}`);
  lines.push(`- 场景：${ctx.scenario === 'panel' ? '面板评价（含快照）' : '创角/规划（无快照）'}`);
  if (ctx.summary) lines.push(`- 定位：${ctx.summary}`);
  lines.push(`- 当前阶段：${ctx.phaseLabel}${ctx.mainLevel ? `（快照主职 L${ctx.mainLevel}）` : ''}`);
  lines.push('');

  lines.push('### 法师流派与分阶段技能');
  lines.push(`- 主选：${ctx.mage.primaryStyle.name} — ${ctx.mage.primaryStyle.reason}`);
  lines.push(`- 副选：${ctx.mage.secondaryStyle.name} — ${ctx.mage.secondaryStyle.reason}`);
  for (const opt of ctx.mage.optionalStyles) {
    lines.push(`- 可选：${opt.name} — ${opt.reason}`);
  }
  for (const band of ['early', 'mid', 'late']) {
    const ph = ctx.mage.phases[band];
    if (!ph) continue;
    lines.push(`\n#### 法师 · ${ph.label}`);
    for (const [style, skills] of Object.entries(ph.styles)) {
      const items = skills.map((s) => `${s.name}(${s.tier}${s.found ? '' : '·未收录'})`).join('、');
      lines.push(`- ${style}：${items}`);
    }
  }

  lines.push('');
  lines.push('### 战士（子职）流派与分阶段战技');
  lines.push(`- 主选：${ctx.warrior.primaryStyle.name} — ${ctx.warrior.primaryStyle.reason}`);
  lines.push(`- 副选：${ctx.warrior.secondaryStyle.name} — ${ctx.warrior.secondaryStyle.reason}`);
  for (const band of ['early', 'mid', 'late']) {
    const ph = ctx.warrior.phases[band];
    if (!ph) continue;
    lines.push(`\n#### 战士 · ${ph.label}`);
    for (const [style, skills] of Object.entries(ph.styles)) {
      const items = skills.map((s) => `${s.name}(${s.tier}${s.found ? '' : '·未收录'})`).join('、');
      lines.push(`- ${style}：${items}`);
    }
  }

  lines.push('');
  lines.push('### 通用天赋（L2-universal 参考）');
  for (const band of ['early', 'mid', 'late']) {
    const talents = ctx.universalTalents[band];
    if (!talents?.length) continue;
    lines.push(`- ${band === 'early' ? '前期' : band === 'mid' ? '中期' : '后期'}：${talents.map((t) => `${t.name}（${t.reason}）`).join('；')}`);
  }

  lines.push('');
  lines.push('### 专长窗口（L4 / L8 / L13）');
  for (const lv of ['4', '8', '13']) {
    const feats = ctx.feats[lv];
    if (!feats?.length) continue;
    lines.push(`- L${lv}：${feats.map((f) => `${f.name}（${f.reason}）`).join('；')}`);
  }

  if (ctx.summaryNotes) {
    lines.push('');
    lines.push('### 阶段总结（预设）');
    for (const key of ['early', 'mid', 'late', 'payoff']) {
      if (ctx.summaryNotes[key]) {
        const label = { early: '前期', mid: '中期', late: '后期', payoff: '成型要点' }[key];
        lines.push(`- ${label}：${ctx.summaryNotes[key]}`);
      }
    }
  }

  if (ctx.analysis) {
    const a = ctx.analysis;
    lines.push('');
    lines.push('### 快照 build 评价（相对 kit）');
    lines.push(`- 阶段：${a.phaseLabel}`);
    if (a.strengths.length) lines.push(`- 优点：${a.strengths.join('；')}`);
    if (a.gaps.length) lines.push(`- 缺口/偏差：${a.gaps.join('；')}`);
    if (a.matchedKitPicks.length) lines.push(`- 已覆盖 kit 建议：${a.matchedKitPicks.join('、')}`);
    if (a.takenFeats?.length) lines.push(`- 已选专长：${a.takenFeats.join('、')}`);
    lines.push(`- 下一专长：${a.nextFeatWindow}`);
  }

  return lines.join('\n');
}

/**
 * @param {string} query
 * @param {{ snapshot?: object, mode?: string }} ctx
 */
export function planBuildRoadmapFromRules(query, ctx = {}) {
  if (!isPanelRoadmapQuery(query, ctx)) return null;
  const kitId = detectRoadmapKitId(query) || 'magic_sword';
  let scenario = 'mixed';
  if (ctx.mode === 'wizard') scenario = 'chargen';
  else if (ctx.snapshot) scenario = 'build';

  return {
    source: 'rules',
    scenario,
    answerStyle: 'roadmap',
    tasks: [{
      type: 'build_roadmap',
      kitId,
      mainClass: '法师',
      subClass: '战士',
      goal: kitId === 'magic_sword' ? '魔剑士' : kitId,
    }],
    intent: 'build_roadmap',
    promptProfile: 'build_roadmap',
  };
}
