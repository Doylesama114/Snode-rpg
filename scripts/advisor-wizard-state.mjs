/**
 * Phase 3 — mage chargen wizard state (创建页陪跑镜像).
 */
export const MAGE_WIZARD_STEPS = [
  { id: 0, key: 'class', label: '选择职业', goal: '确认法师；为奥法学者、知识传承各选 1 子熟练（三项专精 L1 均获得，非三选一）' },
  { id: 1, key: 'features', label: '选择起始特性', goal: '初始特性 8 选 4；选满后评价组合，不推销未选项' },
  { id: 2, key: 'race', label: '选择种族', goal: '结合已有熟练账本选种族（属性/语言/不重复熟练）' },
  { id: 3, key: 'attributes', label: '分配属性', goal: '32 点购点，智力优先 15' },
  { id: 4, key: 'skills', label: '选择熟练项', goal: '职业技巧八选四（奥秘/知识须指定子项；注意与专精/背景不重复）' },
  { id: 5, key: 'background', label: '选择个性背景', goal: '背景熟练与装备；结合账本补兼职 +6 缺口' },
  { id: 6, key: 'equipment', label: '选择装备', goal: '起始套装 A/B/C/D' },
  { id: 7, key: 'review', label: '确认角色', goal: '复核全部选择' },
];

export function normalizeWizardState(raw) {
  if (!raw) return null;
  const step = raw.step ?? raw.currentStep ?? 0;
  const stepDef = MAGE_WIZARD_STEPS.find((s) => s.id === step) || MAGE_WIZARD_STEPS[0];
  const specChoices = raw.specChoices ?? raw.selections?.specChoices ?? {};
  return {
    meta: {
      class: '法师',
      version: raw.meta?.version || 'phase4',
      source: raw.meta?.source || raw.source || undefined,
    },
    step: stepDef.id,
    stepKey: stepDef.key,
    stepLabel: stepDef.label,
    selections: {
      className: raw.className || raw.selections?.className || '法师',
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

export function getWizardStepDef(stepId) {
  return MAGE_WIZARD_STEPS.find((s) => s.id === stepId) || null;
}

function summarizeMageSpecGaps(specChoices) {
  const gaps = [];
  const sc = specChoices || {};
  if (!sc['奥法学者']?.skill) gaps.push('奥法学者：未选奥秘子熟练');
  if (!sc['知识传承']?.skill) gaps.push('知识传承：未选知识子熟练');
  return gaps;
}

export function summarizeWizardGaps(state) {
  const gaps = [];
  const s = state.selections || {};
  const isMage = s.className === '法师';

  if (isMage && state.step >= 0) {
    gaps.push(...summarizeMageSpecGaps(s.specChoices));
  }
  if (state.step >= 1 && isMage && (s.startingFeatures?.length || 0) < 4) {
    gaps.push(`初始特性已选 ${s.startingFeatures?.length || 0}/4`);
  }
  if (state.step >= 2 && !s.race) gaps.push('未选种族');
  if (state.step >= 3 && !s.attrs) gaps.push('未完成购点');
  if (state.step >= 4 && (s.skills?.length || 0) < 4) {
    gaps.push(`职业熟练已选 ${s.skills?.length || 0}/4`);
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
  const def = getWizardStepDef(state.step);
  const gaps = summarizeWizardGaps(state);
  const lines = [
    '## 车卡向导状态',
  ];
  if (state.meta?.source === 'chargen_page') {
    lines.push('- 数据来源：角色创建页（只读镜像；校验以页面为准，顾问只陪跑、不替用户选）');
    lines.push('- L1 法师：奥法学者、知识传承、魔法学派三项专精能力均获得（非三选一）；魔法学派对立/主修路线创建页不配置，进面板后再定');
  }
  lines.push(
    `- 模式：wizard；当前步骤 ${state.step} / ${MAGE_WIZARD_STEPS.length - 1}：${def?.label || state.stepLabel}`,
    `- 本步目标：${def?.goal || ''}`,
  );
  const sel = state.selections;
  if (sel.className) lines.push(`- 已选职业：${sel.className}`);
  if (sel.specChoices && typeof sel.specChoices === 'object') {
    for (const [specName, ch] of Object.entries(sel.specChoices)) {
      if (ch?.skill) lines.push(`- 专精·${specName}：${ch.skill}`);
      else if (specName === '武器专精' && ch?.attr) lines.push(`- 专精·${specName}：${ch.attr}`);
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
    lines.push('- 本步顾问姿态：评价已选起始特性组合；未选满时不推销具体未选特性名');
  } else if (state.step === 4 || state.step === 5) {
    lines.push('- 本步顾问姿态：结合熟练账本补缺口；重复熟练须说明 trade-off');
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
