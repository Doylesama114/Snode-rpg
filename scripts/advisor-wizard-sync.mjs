/**
 * Phase 5 — wizard ↔ snapshot / panel / chargen handoff sync.
 */
import { loadAdvisorStore } from './advisor-retrieve.mjs';
import { normalizeSnapshot } from './advisor-snapshot.mjs';
import {
  normalizeWizardState,
} from './advisor-wizard-state.mjs';
import {
  validateStep,
  grantKey,
  MAGE_SKILL_POOL,
  getBackgroundEntity,
} from './advisor-wizard-api.mjs';

const ATTR_NAMES = ['力量', '敏捷', '体质', '智力', '感知', '魅力', '意志', '幸运'];

const SKILL_ATTR_MAP = {
  专注: '体质', 调查: '智力', 逻辑: '智力', 宗教: '智力',
  洞悉: '感知', 感悟: '感知', 聆听: '感知',
  奥秘: '智力', 知识: '智力',
};

const STARTING_FEATURE_NAMES = new Set([
  '塑能箭', '闪现术', '预知梦', '法术护盾', '魔法武器', '死灵弹', '次级幻影', '次级变形术',
]);

const SPEC_NAMES = new Set(['奥法学者', '知识传承', '魔法学派']);

function emptyNestedProfs(store) {
  const out = {};
  for (const [attr, list] of Object.entries(store.proficiencies?.byAttribute || {})) {
    out[attr] = {};
    for (const sk of list) out[attr][sk] = 0;
  }
  return out;
}

export function flattenPanelProfs(profs) {
  const flat = {};
  if (!profs) return flat;
  if (!profs.力量 && !profs.智力) {
    return { ...profs };
  }
  for (const skills of Object.values(profs)) {
    if (!skills || typeof skills !== 'object') continue;
    for (const [sk, val] of Object.entries(skills)) {
      if (typeof val === 'number' && val > 0) flat[sk] = val;
    }
  }
  return flat;
}

function resolveSkillAttr(skillName, store) {
  if (skillName.includes('-')) return skillName.split('-')[0] === '奥秘' || skillName.startsWith('知识-') ? '智力' : SKILL_ATTR_MAP[skillName.split('-')[0]];
  if (SKILL_ATTR_MAP[skillName]) return SKILL_ATTR_MAP[skillName];
  for (const [attr, list] of Object.entries(store.proficiencies?.byAttribute || {})) {
    if (list.includes(skillName)) return attr;
  }
  return '智力';
}

function applyFlatToNested(flat, store) {
  const nested = emptyNestedProfs(store);
  for (const [sk, val] of Object.entries(flat || {})) {
    const attr = resolveSkillAttr(sk, store);
    if (nested[attr] && nested[attr][sk] !== undefined) {
      nested[attr][sk] = val;
    } else if (nested[attr]) {
      nested[attr][sk] = val;
    }
  }
  return nested;
}

function getRaceEntity(store, name) {
  return store?.entities?.byType?.race?.[name] || null;
}

function subtractRaceBonus(attrs, raceEntity) {
  if (!attrs || !raceEntity?.attrBonus) return { ...attrs };
  const out = { ...attrs };
  for (const [a, b] of Object.entries(raceEntity.attrBonus)) {
    if (typeof b === 'number' && out[a] != null) out[a] = Math.max(8, out[a] - b);
  }
  return out;
}

function addRaceBonus(attrs, raceEntity) {
  const out = { ...(attrs || {}) };
  for (const a of ATTR_NAMES) {
    if (out[a] == null) out[a] = 8;
  }
  for (const [a, b] of Object.entries(raceEntity?.attrBonus || {})) {
    if (typeof b === 'number') out[a] = (out[a] || 8) + b;
  }
  return out;
}

function buildFlatProfsFromWizard(sel, store) {
  const flat = {};
  const bump = (sk, n = 1) => {
    flat[sk] = (flat[sk] || 0) + n;
  };

  for (const sk of sel.skills || []) bump(sk, 1);
  if (sel.specializationProfChoice) bump(sel.specializationProfChoice, 1);

  const bg = sel.background ? getBackgroundEntity(store, sel.background) : null;
  if (bg?.skillGrants) {
    bg.skillGrants.forEach((grant, index) => {
      const key = grantKey(index, grant);
      const picked = sel.backgroundSkillChoices?.[key];
      const arr = Array.isArray(picked) ? picked : (picked ? [picked] : []);
      if (grant.kind === 'fixed' || grant.kind === 'fixed_professional') {
        (grant.skills || []).forEach((s) => bump(s, 1));
      } else if (grant.kind === 'choice_from_category' || grant.kind === 'choice_one') {
        arr.forEach((s) => bump(s, 1));
      }
    });
  }

  nestedSaves(flat, store);
  return flat;
}

function nestedSaves(flat, store) {
  const saves = store.mageClass?.saves || ['智力', '感知'];
  for (const saveAttr of saves) {
    flat[`${saveAttr}豁免`] = (flat[`${saveAttr}豁免`] || 0);
    // 豁免 stored under attr bucket as "豁免" in panel — handled in nested apply
  }
}

function kitEquipmentItems(kitLetter, store) {
  const kit = store.mageStartingGear?.kits?.[kitLetter];
  if (!kit) return [];
  const text = kit.summary || kit.items?.join('.') || '';
  const defaults = {
    A: ['匕首', '布衣', '魔法水晶球', '旅行腰包', '亚麻布毯', '写作工具', '水袋'],
    B: ['学徒魔棒', '匕首', '布衣', '背包', '亚麻布毯', '活力药水', '水袋'],
    C: ['学徒魔棒', '布衣', '背包', '羊绒毯', '任意法术学派的基础书籍', '水袋'],
    D: ['手弩', '匕首', '皮甲', '旅行腰包', '探索工具', '活力药水', '水袋'],
  };
  return defaults[kitLetter] || [];
}

function slotForItem(name) {
  if (/魔棒|法杖|手弩|匕首|武器/.test(name)) return '主手武器';
  if (/皮甲|布衣|甲/.test(name)) return '防具';
  if (/水晶球|戒指|项链/.test(name)) return '配饰';
  if (/旅行腰包|腰包/.test(name)) return '旅行腰包';
  if (/背包/.test(name)) return '背包';
  return '背包';
}

function buildEquipmentFromKit(kitLetter, store) {
  const equipment = {
    主手武器: [], 副手武器: [], 防具: [], 配饰: [], 背包: [],
    杂物包: [], 旅行腰包: [], 材料包: [],
  };
  for (const item of kitEquipmentItems(kitLetter, store)) {
    const slot = slotForItem(item);
    if (!equipment[slot]) equipment[slot] = [];
    equipment[slot].push(item);
  }
  return equipment;
}

function extractLanguagesFromWizard(sel, store) {
  const langs = [];
  const bg = sel.background ? getBackgroundEntity(store, sel.background) : null;
  if (!bg?.skillGrants) return langs;
  bg.skillGrants.forEach((grant, index) => {
    if (grant.kind !== 'choice_language') return;
    const key = grantKey(index, grant);
    const picked = sel.backgroundSkillChoices?.[key];
    const arr = Array.isArray(picked) ? picked : (picked ? [picked] : []);
    langs.push(...arr);
  });
  return langs;
}

function buildBackgroundSkillChoicesFromFlat(flat, background, store) {
  const choices = {};
  if (!background) return choices;
  const bg = getBackgroundEntity(store, background);
  if (!bg?.skillGrants) return choices;

  bg.skillGrants.forEach((grant, index) => {
    const key = grantKey(index, grant);
    if (grant.kind === 'choice_from_category') {
      const opts = new Set(grant.options || []);
      const picked = Object.keys(flat).filter((sk) => opts.has(sk) && flat[sk] > 0);
      if (picked.length) choices[key] = picked.slice(0, grant.count || 1);
    } else if (grant.kind === 'choice_one') {
      const picked = Object.keys(flat).find((sk) => flat[sk] > 0 && !MAGE_SKILL_POOL.includes(sk) && !sk.startsWith('奥秘-') && !sk.startsWith('知识-'));
      if (picked) choices[key] = [picked];
    } else if (grant.kind === 'choice_language') {
      // languages live in snapshot.languages / panel extraLanguages — skip here
    }
  });
  return choices;
}

/**
 * Export completed wizard state → panel_engine charData + L6 snapshot + chargen handoff.
 */
export function exportWizardToPanel(wizardState, store = loadAdvisorStore(), options = {}) {
  const st = normalizeWizardState(wizardState);
  const sel = st.selections;
  const reviewVal = validateStep({ ...st, step: 7 }, store);
  if (!reviewVal.valid && !options.allowIncomplete) {
    return { ok: false, error: reviewVal.errors[0] || '向导未完成，无法导出', validation: reviewVal };
  }

  const raceEntity = sel.race ? getRaceEntity(store, sel.race) : null;
  const attrsWithRace = addRaceBonus(sel.attrs, raceEntity);
  const flatProfs = buildFlatProfsFromWizard(sel, store);
  const nestedProfs = applyFlatToNested(flatProfs, store);

  for (const saveAttr of (store.mageClass?.saves || ['智力', '感知'])) {
    if (nestedProfs[saveAttr]) nestedProfs[saveAttr].豁免 = 1;
  }

  const startingSkills = (sel.startingFeatures || []).map((name) => ({
    n: name,
    src: '法师',
    sub: '',
    locked: false,
    granted: true,
  }));

  const talentNames = new Set(['预知梦']);
  const skills = [];
  const talent_tree = [];
  for (const f of sel.startingFeatures || []) {
    if (talentNames.has(f)) {
      talent_tree.push({ n: f, src: '法师', tier: '一阶', desc: '' });
    } else {
      skills.push({ n: f, src: '法师', sub: '', locked: false, granted: true });
    }
  }

  const classFeatures = [];
  if (sel.specialization) {
    const spec = (store.mageClass?.specializations || []).find((s) => s.name === sel.specialization);
    classFeatures.push({
      name: `[法师] ${sel.specialization}`,
      desc: spec?.effect || '',
    });
  }

  const charName = options.charName || options.name || '顾问导出';
  const kit = sel.equipmentKit || 'B';
  const bgEntity = sel.background ? getBackgroundEntity(store, sel.background) : null;
  const fundsMatch = bgEntity?.funds?.match(/(\d+)/);
  const gold = fundsMatch ? parseInt(fundsMatch[1], 10) : 0;
  const kitGold = { A: 25, B: 15, C: 15, D: 20 };
  const totalGold = gold + (kitGold[kit] || 0);

  const panelState = {
    player: options.playerName || '玩家',
    name: charName,
    race: sel.race || '',
    background: sel.background || '',
    attrs: attrsWithRace,
    profs: nestedProfs,
    classes: [
      { name: '法师', level: 1, keyAttr: '智力', styles: ['', '', '', ''] },
      { name: '', level: 0, styles: ['', '', '', ''] },
      { name: '', level: 0, styles: ['', '', '', ''] },
    ],
    skills,
    talent_tree,
    class_features: classFeatures,
    special_feats: [],
    feats: [],
    xp: 0,
    sp_points: 0,
    color_marks: {
      橙色: false, 白色: false, 紫色: false, 黄色: false, 无色: false,
      蓝色: false, 青色: false, 黑色: false, 红色: false, 棕色: false,
      粉色: false, 绿色: false, 浅色: false, 炫彩: false,
    },
    equipment: buildEquipmentFromKit(kit, store),
    containerItems: { 背包: '', 旅行腰包: '', 烹饪材料包: '', 垂钓材料包: '', 医用材料包: '', 草药材料包: '', 裁缝材料包: '', 矿石材料包: '', 珠宝材料包: '', 炼金材料包: '', 铭文材料包: '' },
    currency: { 金币: totalGold, 银币: 0, 铜币: 0, 其他: '' },
    languages: extractLanguagesFromWizard(sel, store),
    professionals: [],
    racial_traits: (raceEntity?.traits || []).map((t) => ({ name: t.name, desc: t.desc || '' })),
    meta: {
      advisorWizardExport: true,
      exportedAt: new Date().toISOString(),
      equipmentKit: kit,
      specialization: sel.specialization,
      specializationProfChoice: sel.specializationProfChoice,
    },
  };

  const snapshot = normalizeSnapshot({
    ...panelState,
    proficiencies: flatProfs,
    _charName: charName,
  });

  const handoff = {
    version: 'phase5',
    source: 'advisor-wizard',
    exportedAt: panelState.meta.exportedAt,
    targetStep: 7,
    charName,
    selections: { ...sel },
    specChoices: sel.specialization && sel.specializationProfChoice
      ? { [sel.specialization]: { attr: '', skill: sel.specializationProfChoice } }
      : {},
    extraLanguages: extractLanguagesFromWizard(sel, store),
    equipmentKit: kit,
  };

  return {
    ok: true,
    panelState,
    snapshot,
    handoff,
    flatProfs,
    validation: reviewVal,
  };
}

/**
 * Import L6 snapshot or panel state → wizard selections (L1 chargen focus).
 */
export function importSnapshotToWizard(source, store = loadAdvisorStore()) {
  if (!source) return { ok: false, error: '缺少快照数据' };
  const snap = normalizeSnapshot(source);
  const main = snap.classes?.[0];
  if (main?.name && main.name !== '法师') {
    return { ok: false, error: `当前仅支持法师向导，快照主职为「${main.name}」` };
  }
  if ((main?.level || 1) > 1) {
    return { ok: false, error: `快照为 L${main.level} 角色，向导仅支持 L1 车卡导入` };
  }

  const raceEntity = snap.race ? getRaceEntity(store, snap.race) : null;
  const attrs = subtractRaceBonus(snap.attrs || {}, raceEntity);
  const flat = flattenPanelProfs(snap.profs);

  const classSkills = [];
  for (const sk of Object.keys(flat)) {
    if (MAGE_SKILL_POOL.includes(sk) || sk.startsWith('奥秘-') || sk.startsWith('知识-')) {
      if (flat[sk] > 0) classSkills.push(sk);
    }
  }

  let specialization = null;
  let specializationProfChoice = null;
  for (const cf of source.class_features || []) {
    const m = String(cf.name || cf).match(/\[法师\]\s*(.+)/);
    if (m && SPEC_NAMES.has(m[1])) specialization = m[1];
  }
  if (!specialization && source.meta?.specialization) specialization = source.meta.specialization;
  if (source.meta?.specializationProfChoice) specializationProfChoice = source.meta.specializationProfChoice;

  if (!specializationProfChoice && specialization) {
    const specDef = (store.mageClass?.specializations || []).find((s) => s.name === specialization);
    if (specDef?.profChoices?.length) {
      const hit = specDef.profChoices.find((p) => flat[p] > 0);
      if (hit) specializationProfChoice = hit;
    }
  }

  const startingFeatures = (snap.skills || [])
    .map((s) => s.name || s.n)
    .filter((n) => STARTING_FEATURE_NAMES.has(n));

  const equipmentKit = source.meta?.equipmentKit
    || source.equipmentKit
    || null;

  const wizardState = normalizeWizardState({
    step: 7,
    selections: {
      className: '法师',
      specialization,
      specializationProfChoice,
      startingFeatures,
      race: snap.race || null,
      attrs,
      skills: classSkills.slice(0, 4),
      background: snap.background || null,
      backgroundSkillChoices: buildBackgroundSkillChoicesFromFlat(flat, snap.background, store),
      equipmentKit,
    },
  });

  return {
    ok: true,
    state: wizardState,
    snapshot: snap,
    warnings: [],
  };
}

export function wizardSyncCall(method, payload = {}, store = loadAdvisorStore()) {
  switch (method) {
    case 'export':
      return exportWizardToPanel(payload.state, store, payload.options || {});
    case 'import':
      return importSnapshotToWizard(payload.snapshot || payload.panelState, store);
    default:
      return { ok: false, error: `未知 sync 方法：${method}` };
  }
}

export function summarizeExportPreview(exportResult) {
  if (!exportResult?.ok) return '';
  const s = exportResult.snapshot;
  return [
    `角色：${s.name || '未命名'}`,
    `种族：${s.race} | 背景：${s.background}`,
    `智力：${s.attrs?.智力 ?? '?'}`,
    `职业熟练：${Object.keys(exportResult.flatProfs || {}).slice(0, 8).join('、')}`,
    `起始特性：${(exportResult.panelState?.skills || []).map((x) => x.n).join('、')}`,
  ].join('\n');
}
