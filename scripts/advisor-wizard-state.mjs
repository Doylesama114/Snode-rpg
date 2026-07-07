/**
 * Phase 3 / 5 — 创建页陪跑 wizard 状态（全职业参数化）
 */
import {
  formatTierAdvisorNote,
  getClassProfile,
  getStartingFeatureMax,
  resolveKeyAttrs,
} from './advisor-chargen-registry.mjs';

export const CHARGEN_WIZARD_STEPS = [
  { id: 0, key: 'class', label: '选择职业' },
  { id: 1, key: 'features', label: '选择起始特性' },
  { id: 2, key: 'race', label: '选择种族' },
  { id: 3, key: 'attributes', label: '分配属性' },
  { id: 4, key: 'skills', label: '选择熟练项' },
  { id: 5, key: 'background', label: '选择个性背景' },
  { id: 6, key: 'equipment', label: '选择装备' },
  { id: 7, key: 'review', label: '确认角色' },
];

/** @deprecated alias */
export const MAGE_WIZARD_STEPS = CHARGEN_WIZARD_STEPS;

function stepGoal(className, stepId) {
  const p = getClassProfile(className);
  const keyLabel = p.keyAttr || '关键属性';
  const featMax = p.startingFeaturePick === 'all' ? '全部' : String(p.startingFeaturePick ?? 2);
  const skillN = p.skillPickCount ?? 4;

  switch (stepId) {
    case 0:
      if (p.hasMageSpecs) {
        return '确认法师；为奥法学者、知识传承各选 1 子熟练（三项专精 L1 均获得，非三选一）';
      }
      if (p.specProfChoices?.length) {
        return `确认${className || '职业'}；完成专精选项（如 ${p.specProfChoices.join('、')} 等）`;
      }
      return `确认${className || '职业'}与专精/关键选项`;
    case 1:
      return p.startingFeaturePick === 'all'
        ? '起始特性（本职业为全选）；可评价组合倾向'
        : `起始特性选 ${featMax} 项；选满后评价组合，不推销未选项`;
    case 2:
      return '结合概览已有熟练选种族（属性/语言/避免重复熟练）';
    case 3:
      return `32 点购点；优先保障${keyLabel}≥${p.keyAttrTarget ?? 15}；满 32 点后评价分配`;
    case 4:
      return `职业技巧选 ${skillN} 项；须用完整子项名；注意与专精/背景不重复`;
    case 5:
      return '背景熟练与装备；结合概览已有熟练补缺口，避免重复 grant';
    case 6:
      return '起始套装 A/B/C/D';
    case 7:
      return '复核选择；对已填故事/外貌/个性做叙事简评';
    default:
      return '';
  }
}

export function getWizardSteps(className) {
  return CHARGEN_WIZARD_STEPS.map((s) => ({
    ...s,
    goal: stepGoal(className, s.id),
  }));
}

export function getWizardStepDef(stepId, className) {
  const steps = getWizardSteps(className);
  return steps.find((s) => s.id === stepId) || null;
}

export function normalizeWizardState(raw) {
  if (!raw) return null;
  const step = raw.step ?? raw.currentStep ?? 0;
  const className = raw.className || raw.selections?.className || null;
  const stepDef = getWizardStepDef(step, className) || CHARGEN_WIZARD_STEPS[0];
  const specChoices = raw.specChoices ?? raw.selections?.specChoices ?? {};
  return {
    meta: {
      class: className || raw.meta?.class || null,
      version: raw.meta?.version || 'phase5',
      source: raw.meta?.source || raw.source || undefined,
    },
    step: stepDef.id,
    stepKey: stepDef.key,
    stepLabel: raw.stepLabel || stepDef.label,
    selections: {
      className,
      keyAttr: raw.keyAttr ?? raw.selections?.keyAttr ?? null,
      specChoices,
      specialization: raw.specialization ?? raw.selections?.specialization ?? null,
      startingFeatures: raw.startingFeatures ?? raw.selections?.startingFeatures ?? [],
      race: raw.race ?? raw.selections?.race ?? null,
      attrs: raw.attrs ?? raw.selections?.attrs ?? null,
      skills: raw.skills ?? raw.selections?.skills ?? [],
      background: raw.background ?? raw.selections?.background ?? null,
      backgroundSkillChoices: raw.backgroundSkillChoices
        ?? raw.selections?.backgroundSkillChoices
        ?? {},
      specializationProfChoice: raw.specializationProfChoice
        ?? raw.selections?.specializationProfChoice
        ?? null,
      equipmentKit: raw.equipmentKit ?? raw.selections?.equipmentKit ?? null,
      humanFreeSkill: raw.humanFreeSkill ?? raw.selections?.humanFreeSkill ?? null,
    },
    notes: raw.notes || [],
  };
}

function summarizeMageSpecGaps(specChoices) {
  const gaps = [];
  const sc = specChoices || {};
  if (!sc['奥法学者']?.skill) gaps.push('奥法学者：未选奥秘子熟练');
  if (!sc['知识传承']?.skill) gaps.push('知识传承：未选知识子熟练');
  return gaps;
}

function summarizeSpecGaps(className, specChoices) {
  const p = getClassProfile(className);
  if (p.hasMageSpecs) return summarizeMageSpecGaps(specChoices);
  const gaps = [];
  const sc = specChoices || {};
  for (const specName of p.specProfChoices || []) {
    const ch = sc[specName];
    if (specName === '武器专精' && !ch?.weapon && !ch?.skill) {
      gaps.push(`${specName}：未完成选择`);
    } else if (specName === '运动健将' && !ch?.skill && !ch?.attr) {
      gaps.push(`${specName}：未选熟练方向`);
    } else if (!ch?.skill && !ch?.prof) {
      gaps.push(`${specName}：未完成选择`);
    }
  }
  return gaps;
}

export function summarizeWizardGaps(state) {
  const gaps = [];
  const s = state.selections || {};
  const className = s.className;
  const profile = getClassProfile(className);
  const featMax = getStartingFeatureMax({ className, selectedFeatures: s.startingFeatures }, profile);
  const skillN = profile.skillPickCount ?? 4;

  if (className && state.step >= 0) {
    gaps.push(...summarizeSpecGaps(className, s.specChoices));
  }
  if (state.step >= 1 && className && profile.startingFeaturePick !== 'all') {
    const n = s.startingFeatures?.length || 0;
    if (n < featMax) gaps.push(`初始特性已选 ${n}/${featMax}`);
  }
  if (state.step >= 2 && !s.race) gaps.push('未选种族');
  if (state.step >= 3 && !s.attrs) gaps.push('未完成购点');
  if (state.step >= 4 && (s.skills?.length || 0) < skillN) {
    gaps.push(`职业熟练已选 ${s.skills?.length || 0}/${skillN}`);
  }
  if (state.step >= 5 && !s.background) gaps.push('未选背景');
  if (state.step >= 5 && s.background && s.backgroundSkillChoices) {
    const pending = Object.values(s.backgroundSkillChoices).filter((v) => {
      const arr = Array.isArray(v) ? v : (v ? [v] : []);
      return arr.length === 0;
    });
    if (pending.length) gaps.push('背景熟练/语言选项未填完');
  }
  if (state.step >= 6 && !s.equipmentKit) gaps.push('未选起始套装');
  return gaps;
}

export function formatWizardContext(state, store, options = {}) {
  if (!state) return '';
  const className = state.selections?.className;
  const profile = getClassProfile(className);
  const def = getWizardStepDef(state.step, className);
  const gaps = summarizeWizardGaps(state);
  const featMax = getStartingFeatureMax(
    { className, selectedFeatures: state.selections?.startingFeatures },
    profile,
  );
  const lines = ['## 车卡向导状态'];

  if (state.meta?.source === 'chargen_page') {
    lines.push('- 数据来源：角色创建页（只读镜像；校验以页面为准，顾问只陪跑、不替用户选）');
    lines.push('- L1 创建阶段禁止提及兼职、7 级子职或兼职熟练门槛（+6）；兼职与当前车卡无关');
    if (profile.hasMageSpecs) {
      lines.push('- L1 法师：奥法学者、知识传承、魔法学派三项专精能力均获得（非三选一）；魔法学派对立/主修创建页不配置');
    }
    const tierNote = formatTierAdvisorNote(profile);
    if (tierNote) lines.push(`- 顾问档位（${profile.tier}）：${tierNote}`);
  }

  lines.push(
    `- 模式：wizard；当前步骤 ${state.step} / ${CHARGEN_WIZARD_STEPS.length - 1}：${def?.label || state.stepLabel}`,
    `- 本步目标：${def?.goal || ''}`,
  );

  const sel = state.selections;
  if (sel.className) lines.push(`- 已选职业：${sel.className}（顾问档位：${profile.tier}）`);
  if (sel.keyAttr) lines.push(`- 关键属性（页面）：${sel.keyAttr}`);
  else if (profile.keyAttr) lines.push(`- 关键属性：${profile.keyAttr}`);
  if (sel.specChoices && typeof sel.specChoices === 'object') {
    for (const [specName, ch] of Object.entries(sel.specChoices)) {
      if (ch?.skill) lines.push(`- 专精·${specName}：${ch.skill}`);
      else if (specName === '武器专精' && (ch?.weapon || ch?.attr)) {
        lines.push(`- 专精·${specName}：${ch.weapon || ch.attr}`);
      } else if (ch?.attr) lines.push(`- 专精·${specName}：${ch.attr}`);
    }
  }
  if (sel.startingFeatures?.length) lines.push(`- 已选初始特性：${sel.startingFeatures.join('、')}`);
  if (sel.race) lines.push(`- 已选种族：${sel.race}`);
  if (sel.background) lines.push(`- 已选背景：${sel.background}`);
  if (sel.backgroundSkillChoices && Object.keys(sel.backgroundSkillChoices).length) {
    const flat = Object.entries(sel.backgroundSkillChoices)
      .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
      .filter(Boolean);
    if (flat.length) lines.push(`- 背景熟练选项：${flat.join('、')}`);
  }
  if (sel.equipmentKit) lines.push(`- 已选套装：${sel.equipmentKit}`);
  if (sel.skills?.length) lines.push(`- 已选熟练：${sel.skills.join('、')}`);
  if (sel.humanFreeSkill) lines.push(`- 人类自由熟练：${sel.humanFreeSkill}`);
  if (gaps.length) lines.push(`- 待完成：${gaps.join('；')}`);
  else lines.push('- 本步必选项：已全部填写（或尚未到该步）');

  if (options.ledgerContext) {
    lines.push('');
    lines.push(options.ledgerContext);
  }

  if (state.step === 1) {
    lines.push(`- 本步顾问姿态：选满 ${featMax} 项起始特性后【必须】评价组合；未选满时不推销具体未选特性名`);
  } else if (state.step === 3) {
    const keys = resolveKeyAttrs({ className, keyAttr: sel.keyAttr }, profile);
    const keyHint = keys.length ? keys.join('或') : '关键属性';
    lines.push(`- 本步顾问姿态：购点满 32 后【必须】评价当前加点（优先${keyHint}≥${profile.keyAttrTarget ?? 15}）；未满时只给方向`);
  } else if (state.step === 4 || state.step === 5) {
    lines.push('- 本步顾问姿态：熟练须用完整子项名；结合高属性与对应熟练协同；重复须 trade-off');
  } else if (state.step === 7) {
    lines.push('- 本步顾问姿态：对已填故事/外貌/个性做简评，勿替用户改写');
  }

  lines.push('- 回答须先确认当前步骤；不要跳到未打开步骤；勿替用户指定未选项');
  return lines.join('\n');
}

export function getWizardStepEntityHints(state, store) {
  if (!state || !store?.entities) return [];
  const hints = [];
  const sel = state.selections;
  if (state.step === 2 && sel.race) {
    const card = store.entities.byType?.race?.[sel.race];
    if (card) hints.push({ entityType: 'race', id: sel.race, card });
  }
  if (state.step === 5 && sel.background) {
    const card = store.entities.byType?.background?.[sel.background];
    if (card) hints.push({ entityType: 'background', id: sel.background, card });
  }
  return hints;
}
