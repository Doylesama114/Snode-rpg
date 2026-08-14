/**
 * L6 character snapshot — normalize panel state & eligibility analysis (Phase 7).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAdvancementEligibility, checkEligibility } from './advisor-eligibility.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PROF_KEYWORDS = {
  mage_main: ['逻辑', '奥秘', '知识'],
  artificer: ['巧手', '知识', '逻辑'],
};

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

export function flattenProfs(rawProfs) {
  const flat = {};
  if (!rawProfs || typeof rawProfs !== 'object') return flat;
  for (const [, val] of Object.entries(rawProfs)) {
    if (typeof val === 'number') {
      continue;
    }
    if (val && typeof val === 'object') {
      for (const [subKey, subVal] of Object.entries(val)) {
        if (typeof subVal === 'number' && subVal > 0) {
          flat[subKey] = (flat[subKey] || 0) + subVal;
        }
      }
    }
  }
  for (const [key, val] of Object.entries(rawProfs)) {
    if (typeof val === 'number' && val > 0) {
      flat[key] = (flat[key] || 0) + val;
    }
  }
  return flat;
}

export function sumProf(profs, keywords) {
  const flat = profs && typeof profs === 'object'
    && !Object.values(profs).some((v) => v && typeof v === 'object')
    ? profs
    : flattenProfs(profs);
  let total = 0;
  for (const [key, val] of Object.entries(flat || {})) {
    if (typeof val !== 'number') continue;
    if (keywords.some((kw) => key.includes(kw))) total += val;
  }
  return total;
}

export function listNonZeroProfs(profs, limit = 24) {
  const flat = flattenProfs(profs);
  return Object.entries(flat)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .slice(0, limit)
    .map(([k, v]) => `${k}+${v}`);
}

let _levelingCache = null;
function loadLevelingRules() {
  if (!_levelingCache) {
    _levelingCache = loadJson('advisor/rules/leveling.json');
  }
  return _levelingCache;
}

/** @param {number} mainLevel @param {string[]|null} unlockedTiersFromPanel */
export function getLearnableTierLabels(mainLevel, unlockedTiersFromPanel = null) {
  if (Array.isArray(unlockedTiersFromPanel) && unlockedTiersFromPanel.length) {
    return [...unlockedTiersFromPanel];
  }
  const labels = ['一阶', '二阶'];
  const unlocks = loadLevelingRules().talentTierUnlocks?.unlocks || [];
  for (const row of unlocks) {
    if (mainLevel >= row.unlockAtMainLevel) {
      labels.push(row.tierLabel);
    }
  }
  return labels;
}

export function skillWithinLearnableTiers(skill, learnableTiers) {
  if (!learnableTiers?.length) return true;
  if (skill?.type === 'starting') return true;
  const tier = skill?.tier || '起手';
  if (tier === '起手' || tier === '-') return true;
  return learnableTiers.includes(tier);
}

/**
 * Map full panel_engine state → advisor snapshot subset.
 */
export function normalizeSnapshot(raw) {
  const classes = (raw.classes || [])
    .filter((c) => c?.name)
    .map((c) => ({
      name: c.name,
      level: c.level || 0,
      styles: (c.styles || []).filter(Boolean),
    }));

  const skills = (raw.skills || []).map((s) => (
    typeof s === 'string' ? { name: s } : { name: s.name, src: s.src, tier: s.tier }
  )).filter((s) => s.name);

  const profsNested = raw.profs || {};
  const profs = flattenProfs(profsNested);

  return {
    meta: {
      layer: 'L6',
      source: raw._charName ? 'panel_engine' : 'advisor_fixture',
      savedAt: raw._savedAt || null,
      fixtureId: raw.meta?.id || null,
    },
    name: raw.name || raw._charName || '',
    race: raw.race || '',
    background: raw.background || '',
    attrs: raw.attrs || {},
    profs,
    profsNested,
    unlocked_tiers: raw.unlocked_tiers || null,
    classes: classes.length ? classes : [{ name: '法师', level: 1 }],
    skills,
    special_feats: raw.special_feats || [],
    xp: raw.xp ?? null,
    sp_points: raw.sp_points ?? null,
    color_marks: raw.color_marks || {},
    aspirationPath: raw.aspirationPath || null,
    equipment: raw.equipment || null,
    armor: raw.armor || raw.equipment?.armor || null,
    shield: raw.shield || raw.equipment?.shield || null,
  };
}

export function getMainClass(snapshot) {
  return snapshot.classes?.[0] || { name: '', level: 0 };
}

export function analyzeMulticlass(snapshot, multiclassRules) {
  const main = getMainClass(snapshot);
  const mainLevel = main.level || 0;
  const unlockLevel = multiclassRules.meta?.mainClassUnlockLevel || 7;
  const out = {
    mainClass: main.name,
    mainLevel,
    unlockLevel,
    levelOk: mainLevel >= unlockLevel,
    compatibleSubclasses: [],
    incompatibleSubclasses: [],
    targets: [],
  };

  if (main.name !== '法师') return out;

  const mageMeta = multiclassRules.mageAsMain || {};
  out.compatibleSubclasses = mageMeta.compatibleSubclasses || [];
  out.incompatibleSubclasses = mageMeta.incompatibleSubclasses || [];

  for (const req of multiclassRules.requirements || []) {
    if (!out.compatibleSubclasses.includes(req.class)) continue;
    const attrReq = {};
    const intM = req.attrRequired?.match(/智力属性(\d+)/);
    if (intM) attrReq.智力 = Number(intM[1]);
    const attrCheck = checkEligibility(snapshot.attrs, attrReq);
    let profOk = true;
    let profDetail = req.profRequired;
    if (req.class === '奇械师') {
      profOk = sumProf(snapshot.profs, PROF_KEYWORDS.artificer) >= 6;
      profDetail = `巧手+知识+逻辑=${sumProf(snapshot.profs, PROF_KEYWORDS.artificer)} (需≥6)`;
    }
    out.targets.push({
      class: req.class,
      eligible: out.levelOk && attrCheck.eligible && profOk,
      levelOk: out.levelOk,
      attrGaps: attrCheck.gaps,
      profOk,
      profDetail,
      otherRequired: req.otherRequired,
    });
  }

  return out;
}

export function analyzeMageMainRequirements(snapshot, mageReq) {
  const attrs = snapshot.attrs || {};
  const intOk = (attrs.智力 ?? 0) >= 15;
  const profSum = sumProf(snapshot.profs, PROF_KEYWORDS.mage_main);
  return {
    intOk,
    intValue: attrs.智力 ?? 0,
    profSum,
    profOk: profSum >= 6,
    eligible: intOk && profSum >= 6,
  };
}

export function analyzeAdvancements(snapshot, advancements, names = null) {
  const attrs = snapshot.attrs || {};
  let list = advancements.filter((a) => a.mageEligible !== false);
  if (names?.length) {
    list = list.filter((a) => names.includes(a.name));
  }
  return list.map((a) => checkAdvancementEligibility(a, attrs));
}

export function analyzeSnapshot(snapshot, options = {}) {
  const multiclass = loadJson('advisor/rules/multiclass.json');
  const advancements = loadJson('advisor/advancements.json').advancements;
  const mageReq = multiclass.requirements.find((r) => r.class === '法师');

  const main = getMainClass(snapshot);
  const advancementNames = options.advancementNames || null;
  const mainLevel = main.level || 0;
  const subclasses = (snapshot.classes || []).slice(1).filter((c) => c?.name && (c.level || 0) > 0);
  const learnableTiers = getLearnableTierLabels(mainLevel, snapshot.unlocked_tiers);
  const profHighlights = listNonZeroProfs(snapshot.profs);

  return {
    snapshot: {
      name: snapshot.name,
      race: snapshot.race,
      background: snapshot.background,
      mainClass: main.name,
      mainLevel,
      attrs: snapshot.attrs,
      skillNames: (snapshot.skills || []).map((s) => s.name),
      aspirationPath: snapshot.aspirationPath || null,
    },
    subclasses,
    profHighlights,
    learnableTiers,
    mageMainRequirements: analyzeMageMainRequirements(snapshot, mageReq),
    multiclass: analyzeMulticlass(snapshot, multiclass),
    advancements: analyzeAdvancements(snapshot, advancements, advancementNames),
  };
}

export function formatSnapshotContext(analysis, options = {}) {
  const intent = options.intent || 'general';
  const includeMulticlass = options.includeMulticlass
    || intent === 'multiclass'
    || intent === 'multiclass_req'
    || /兼职|子职|7\s*级/.test(options.query || '');

  const lines = [];
  lines.push('## L6 角色快照');
  let classLine = `- 角色：${analysis.snapshot.name || '未命名'} | ${analysis.snapshot.race || '?'} | 主职 ${analysis.snapshot.mainClass} L${analysis.snapshot.mainLevel}`;
  if (analysis.subclasses?.length) {
    classLine += ` | 子职 ${analysis.subclasses.map((c) => `${c.name} L${c.level}`).join('、')}`;
  }
  lines.push(classLine);

  if (analysis.profHighlights?.length) {
    lines.push(`- 已有熟练（非零）：${analysis.profHighlights.join('、')}`);
  }
  lines.push(`- 逻辑/奥秘/知识合计 +${analysis.mageMainRequirements.profSum}（创角本职参考≥6：${analysis.mageMainRequirements.profOk ? '✓' : '✗'}；勿与「兼职法师」混淆）`);
  lines.push(`- 属性：智力 ${analysis.snapshot.attrs?.智力 ?? '?'}（法师创角参考≥15：${analysis.mageMainRequirements.intOk ? '✓' : '✗'}）`);
  lines.push(`- 当前可学技能位阶：${(analysis.learnableTiers || []).join('、')}（推荐技能不得超出此列表）`);

  if (analysis.snapshot.skillNames?.length) {
    lines.push(`- 已学技能：${analysis.snapshot.skillNames.slice(0, 12).join('、')}${analysis.snapshot.skillNames.length > 12 ? '…' : ''}`);
  }

  lines.push('');
  lines.push('### 进阶达标（属性门槛）');
  for (const a of analysis.advancements.slice(0, 8)) {
    lines.push(`- ${a.advancementName}：${a.eligible ? '✓' : '✗'}${Object.keys(a.gaps || {}).length ? ` gaps=${JSON.stringify(a.gaps)}` : ''}`);
  }
  const aspiration = analysis.snapshot.aspirationPath || null;
  if (aspiration && ((aspiration.picks || []).length || String(aspiration.text || '').trim())) {
    lines.push('');
    lines.push('### 期望进阶路线（玩家愿景）');
    if ((aspiration.picks || []).length) lines.push(`- 期望进阶：${aspiration.picks.join(' → ')}`);
    if (String(aspiration.text || '').trim()) lines.push(`- 备注：${String(aspiration.text).trim()}`);
    lines.push('- 回答时应结合该期望方向给出取舍评价；若问题涉及 build/技能/加点，需先点明期望目标及达标状态。');
  }

  if (includeMulticlass && analysis.multiclass.mainClass === '法师') {
    lines.push('');
    lines.push('### 兼职可选（主职7级+；与「进阶途径」不同）');
    lines.push(`- 等级门槛 L${analysis.multiclass.unlockLevel}：${analysis.multiclass.levelOk ? '✓' : '✗'}`);
    for (const t of analysis.multiclass.targets.slice(0, 6)) {
      lines.push(`- 可兼 ${t.class}：${t.eligible ? '✓' : '✗'}${t.attrGaps && Object.keys(t.attrGaps).length ? ` 属性gaps=${JSON.stringify(t.attrGaps)}` : ''} ${t.profDetail || ''}`);
    }
  }

  return lines.join('\n');
}

export function loadSnapshotFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  return normalizeSnapshot(raw);
}
