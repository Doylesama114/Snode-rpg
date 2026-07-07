/**
 * Phase 3 — mage chargen wizard state (stub for Phase 4 UI).
 */
export const MAGE_WIZARD_STEPS = [
  { id: 0, key: 'class', label: '选择职业', goal: '确认主职为法师' },
  { id: 1, key: 'features', label: '选择起始特性', goal: '专精三选一 + 初始特性 8 选 4' },
  { id: 2, key: 'race', label: '选择种族', goal: '选择种族并了解属性加值与特性' },
  { id: 3, key: 'attributes', label: '分配属性', goal: '32 点购点，智力优先 15' },
  { id: 4, key: 'skills', label: '选择熟练项', goal: '职业技巧八选四（奥秘/知识须指定子项）' },
  { id: 5, key: 'background', label: '选择个性背景', goal: '背景熟练与装备；覆盖兼职 +6 门槛' },
  { id: 6, key: 'equipment', label: '选择装备', goal: '起始套装 A/B/C/D' },
  { id: 7, key: 'review', label: '确认角色', goal: '复核全部选择' },
];

export function normalizeWizardState(raw) {
  if (!raw) return null;
  const step = raw.step ?? raw.currentStep ?? 0;
  const stepDef = MAGE_WIZARD_STEPS.find((s) => s.id === step) || MAGE_WIZARD_STEPS[0];
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
    },
    notes: raw.notes || [],
  };
}

export function getWizardStepDef(stepId) {
  return MAGE_WIZARD_STEPS.find((s) => s.id === stepId) || null;
}

export function summarizeWizardGaps(state) {
  const gaps = [];
  const s = state.selections || {};
  if (state.step >= 1 && !s.specialization) gaps.push('未选专精（奥法学者/知识传承/魔法学派）');
  if (state.step >= 1 && (s.startingFeatures?.length || 0) < 4) {
    gaps.push(`初始特性已选 ${s.startingFeatures?.length || 0}/4`);
  }
  if (state.step >= 2 && !s.race) gaps.push('未选种族');
  if (state.step >= 3 && !s.attrs) gaps.push('未完成购点');
  if (state.step >= 4 && (s.skills?.length || 0) < 4) gaps.push(`职业熟练已选 ${s.skills?.length || 0}/4`);
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

export function formatWizardContext(state, store) {
  if (!state) return '';
  const def = getWizardStepDef(state.step);
  const gaps = summarizeWizardGaps(state);
  const lines = [
    '## 车卡向导状态',
  ];
  if (state.meta?.source === 'chargen_page') {
    lines.push('- 数据来源：角色创建页（只读镜像；校验以页面为准，顾问只推荐、不替用户选）');
  }
  lines.push(
    `- 模式：wizard；当前步骤 ${state.step} / ${MAGE_WIZARD_STEPS.length - 1}：${def?.label || state.stepLabel}`,
    `- 本步目标：${def?.goal || ''}`,
  );
  const sel = state.selections;
  if (sel.className) lines.push(`- 已选职业：${sel.className}`);
  if (sel.specialization) lines.push(`- 已选专精：${sel.specialization}`);
  if (sel.startingFeatures?.length) lines.push(`- 已选初始特性：${sel.startingFeatures.join('、')}`);
  if (sel.race) lines.push(`- 已选种族：${sel.race}`);
  if (sel.background) lines.push(`- 已选背景：${sel.background}`);
  if (sel.specializationProfChoice) lines.push(`- 专精熟练：${sel.specializationProfChoice}`);
  if (sel.backgroundSkillChoices && Object.keys(sel.backgroundSkillChoices).length) {
    const flat = Object.entries(sel.backgroundSkillChoices)
      .flatMap(([, v]) => (Array.isArray(v) ? v : [v]))
      .filter(Boolean);
    if (flat.length) lines.push(`- 背景熟练选项：${flat.join('、')}`);
  }
  if (sel.equipmentKit) lines.push(`- 已选套装：${sel.equipmentKit}`);
  if (sel.skills?.length) lines.push(`- 已选熟练：${sel.skills.join('、')}`);
  if (gaps.length) lines.push(`- 待完成：${gaps.join('；')}`);
  else lines.push('- 本步必选项：已全部填写（或尚未到该步）');

  if (state.step === 2 && store?.entities?.byType?.race) {
    lines.push('- 本步可选：全部种族见实体库；推荐高智力种族见 L1');
  }
  if (state.step === 5 && store?.entities?.byType?.background) {
    const mageBgs = Object.values(store.entities.byType.background)
      .filter((b) => b.mageSkillHits?.length)
      .slice(0, 6)
      .map((b) => b.name);
    if (mageBgs.length) lines.push(`- 法师友好背景示例：${mageBgs.join('、')}`);
  }
  if (state.step === 6 && store?.mageStartingGear?.kits) {
    lines.push('- 起始套装：A/B/C/D（见法师职业基础或 mage_starting_gear）');
  }

  lines.push('- 向导回答须先确认当前步骤，再给出 2～3 条可选建议；不要跳到未打开的步骤。');
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
