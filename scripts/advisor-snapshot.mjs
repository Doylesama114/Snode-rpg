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

export function sumProf(profs, keywords) {
  let total = 0;
  for (const [key, val] of Object.entries(profs || {})) {
    if (typeof val !== 'number') continue;
    if (keywords.some((kw) => key.includes(kw))) total += val;
  }
  return total;
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

  const profs = { ...(raw.profs || {}) };
  if (!Object.keys(profs).length && raw.proficiencies) {
    Object.assign(profs, raw.proficiencies);
  }

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
    classes: classes.length ? classes : [{ name: '法师', level: 1 }],
    skills,
    special_feats: raw.special_feats || [],
    xp: raw.xp ?? null,
    sp_points: raw.sp_points ?? null,
    color_marks: raw.color_marks || {},
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

  return {
    snapshot: {
      name: snapshot.name,
      race: snapshot.race,
      background: snapshot.background,
      mainClass: main.name,
      mainLevel: main.level,
      attrs: snapshot.attrs,
      skillNames: (snapshot.skills || []).map((s) => s.name),
    },
    mageMainRequirements: analyzeMageMainRequirements(snapshot, mageReq),
    multiclass: analyzeMulticlass(snapshot, multiclass),
    advancements: analyzeAdvancements(snapshot, advancements, advancementNames),
  };
}

export function formatSnapshotContext(analysis) {
  const lines = [];
  lines.push('## L6 角色快照');
  lines.push(`- 角色：${analysis.snapshot.name || '未命名'} | ${analysis.snapshot.race || '?'} | 主职 ${analysis.snapshot.mainClass} L${analysis.snapshot.mainLevel}`);
  lines.push(`- 属性：智力 ${analysis.snapshot.attrs?.智力 ?? '?'}（法师本职需≥15：${analysis.mageMainRequirements.intOk ? '✓' : '✗'}）`);
  lines.push(`- 熟练：逻辑/奥秘/知识合计 +${analysis.mageMainRequirements.profSum}（需≥6：${analysis.mageMainRequirements.profOk ? '✓' : '✗'}）`);
  if (analysis.snapshot.skillNames?.length) {
    lines.push(`- 已学技能：${analysis.snapshot.skillNames.slice(0, 12).join('、')}${analysis.snapshot.skillNames.length > 12 ? '…' : ''}`);
  }

  lines.push('');
  lines.push('### 进阶达标（仅属性门槛）');
  for (const a of analysis.advancements.slice(0, 8)) {
    lines.push(`- ${a.advancementName}：${a.eligible ? '✓' : '✗'}${Object.keys(a.gaps || {}).length ? ` gaps=${JSON.stringify(a.gaps)}` : ''}`);
  }

  if (analysis.multiclass.mainClass === '法师') {
    lines.push('');
    lines.push('### 兼职（主职7级+属性/熟练）');
    lines.push(`- 等级门槛 L${analysis.multiclass.unlockLevel}：${analysis.multiclass.levelOk ? '✓' : '✗'}`);
    for (const t of analysis.multiclass.targets.slice(0, 6)) {
      lines.push(`- ${t.class}：${t.eligible ? '✓' : '✗'}${t.attrGaps && Object.keys(t.attrGaps).length ? ` 属性gaps=${JSON.stringify(t.attrGaps)}` : ''} ${t.profDetail || ''}`);
    }
  }

  return lines.join('\n');
}

export function loadSnapshotFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  return normalizeSnapshot(raw);
}
