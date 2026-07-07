/**
 * Phase 4 — mage chargen wizard API (validate, options, navigate).
 */
import { loadAdvisorStore } from './advisor-retrieve.mjs';
import {
  normalizeWizardState,
  getWizardStepDef,
  MAGE_WIZARD_STEPS,
} from './advisor-wizard-state.mjs';

export const MAGE_SKILL_POOL = ['专注', '调查', '逻辑', '奥秘', '知识', '洞悉', '感悟', '聆听'];

export const ALL_LANGUAGES = [
  '精灵语', '矮人语', '半身人语', '侏儒语', '地底通用语', '龙语', '地狱语', '深渊语',
  '兽人语', '巨魔语', '泽地语', '荒漠语', '鸟禽语', '兽语', '蛇语', '鱼人语', '海洋通用语', '元素语',
];

const GRANT_KINDS_NEEDING_CHOICE = new Set([
  'choice_from_category',
  'choice_language',
  'choice_one',
]);

function costTable(store) {
  const map = new Map();
  for (const row of store.pointBuy?.table || []) {
    map.set(row.attrValue, row.pointCost);
  }
  return map;
}

function attrPointCost(value, store) {
  const row = (store.pointBuy?.table || []).find((r) => r.attrValue === value);
  return row ? row.pointCost : null;
}

function defaultAttrs(store) {
  const def = store.pointBuy?.defaultUnspentValue ?? 8;
  const out = {};
  for (const a of store.pointBuy?.attrs || []) out[a] = def;
  return out;
}

function flattenBasicSkills(store) {
  const set = new Set();
  for (const list of Object.values(store.proficiencies?.byAttribute || {})) {
    for (const s of list) {
      if (s !== '豁免' && !s.endsWith('-自定义')) set.add(s);
    }
  }
  return [...set].sort();
}

export function createWizardState() {
  return normalizeWizardState({ step: 0, className: '法师' });
}

export function applyPatch(state, patch = {}) {
  const base = normalizeWizardState(state);
  const sel = { ...base.selections, ...(patch.selections || {}) };
  if (patch.selections?.backgroundSkillChoices) {
    sel.backgroundSkillChoices = {
      ...(base.selections.backgroundSkillChoices || {}),
      ...patch.selections.backgroundSkillChoices,
    };
  }
  if (
    patch.selections?.background
    && patch.selections.background !== base.selections.background
    && !patch.selections?.backgroundSkillChoices
  ) {
    sel.backgroundSkillChoices = {};
  }
  if (
    patch.selections?.specialization
    && patch.selections.specialization !== base.selections.specialization
    && !Object.prototype.hasOwnProperty.call(patch.selections || {}, 'specializationProfChoice')
  ) {
    sel.specializationProfChoice = null;
  }
  const nextStep = patch.step != null ? patch.step : base.step;
  return normalizeWizardState({
    ...base,
    step: nextStep,
    selections: sel,
    notes: patch.notes ?? base.notes,
  });
}

export function grantKey(index, grant) {
  return `${index}:${grant.kind}:${grant.category || ''}`;
}

export function getBackgroundEntity(store, name) {
  return store?.entities?.byType?.background?.[name] || null;
}

export function validateBackgroundSkillChoices(background, choices = {}, store) {
  const errors = [];
  const warnings = [];
  if (!background) return { valid: false, errors: ['未选背景'], warnings, pendingGrants: [] };

  const grants = background.skillGrants || [];
  const pendingGrants = [];

  grants.forEach((grant, index) => {
    const key = grantKey(index, grant);
    if (!GRANT_KINDS_NEEDING_CHOICE.has(grant.kind)) return;

    const picked = choices[key];
    const arr = Array.isArray(picked) ? picked.filter(Boolean) : (picked ? [picked] : []);
    const need = grant.count ?? 1;

    if (grant.kind === 'choice_from_category') {
      const opts = new Set(grant.options || store.proficiencies?.parentCategories?.[grant.category] || []);
      if (arr.length < need) {
        errors.push(`${grant.label || grant.category}：需选 ${need} 项，已选 ${arr.length}`);
        pendingGrants.push({ key, grant, need, picked: arr });
        return;
      }
      for (const p of arr) {
        if (!opts.has(p)) errors.push(`${grant.label}：「${p}」不在可选项内`);
      }
      if (new Set(arr).size !== arr.length) errors.push(`${grant.label}：不可重复选择`);
      return;
    }

    if (grant.kind === 'choice_language') {
      const langSet = new Set(ALL_LANGUAGES);
      if (arr.length < need) {
        errors.push(`${grant.label || '语言'}：需选 ${need} 门，已选 ${arr.length}`);
        pendingGrants.push({ key, grant, need, picked: arr });
        return;
      }
      for (const p of arr) {
        if (!langSet.has(p)) warnings.push(`语言「${p}」不在标准列表（创建页可接受自定义）`);
      }
      if (new Set(arr).size !== arr.length) errors.push(`${grant.label}：不可重复选择同一语言`);
      return;
    }

    if (grant.kind === 'choice_one') {
      const basics = flattenBasicSkills(store);
      const opts = new Set(basics);
      if (arr.length < 1) {
        errors.push(`${grant.label || '任选熟练'}：需选 1 项`);
        pendingGrants.push({ key, grant, need: 1, picked: arr });
        return;
      }
      if (!opts.has(arr[0])) errors.push(`${grant.label}：「${arr[0]}」不是有效基础熟练`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    pendingGrants,
  };
}

export function validateStep(state, store = loadAdvisorStore()) {
  const st = normalizeWizardState(state);
  const sel = st.selections;
  const errors = [];
  const warnings = [];
  const stepDef = getWizardStepDef(st.step);

  switch (st.step) {
    case 0:
      if (sel.className !== '法师') errors.push('当前向导仅支持法师');
      break;

    case 1: {
      if (!sel.specialization) errors.push('请选择专精（奥法学者 / 知识传承 / 魔法学派）');
      const feats = sel.startingFeatures || [];
      const need = store.mageClass?.startingChoice ?? 4;
      const validNames = new Set((store.mageClass?.startingFeatures || []).map((f) => f.name));
      if (feats.length !== need) errors.push(`初始特性需选 ${need} 项，当前 ${feats.length} 项`);
      for (const f of feats) {
        if (!validNames.has(f)) errors.push(`无效初始特性：${f}`);
      }
      const spec = (store.mageClass?.specializations || []).find((s) => s.name === sel.specialization);
      if (spec?.profChoices?.length && !sel.specializationProfChoice) {
        errors.push(`专精「${sel.specialization}」需选择一项 ${spec.profChoices[0].split('-')[0]} 子项熟练`);
      }
      break;
    }

    case 2: {
      if (!sel.race) errors.push('请选择种族');
      else if (!store.entities?.byType?.race?.[sel.race]) errors.push(`未知种族：${sel.race}`);
      break;
    }

    case 3: {
      const attrs = sel.attrs || defaultAttrs(store);
      const attrsList = store.pointBuy?.attrs || [];
      let spent = 0;
      for (const a of attrsList) {
        const v = attrs[a];
        if (v == null) {
          errors.push(`属性 ${a} 未分配`);
          continue;
        }
        if (v < 8 || v > 15) errors.push(`${a} 须在 8～15 之间（当前 ${v}）`);
        const cost = attrPointCost(v, store);
        if (cost == null) errors.push(`${a} 购点费用未知`);
        else spent += cost;
      }
      const total = store.pointBuy?.totalPoints ?? 32;
      if (spent !== total) errors.push(`购点须恰好 ${total} 点，当前花费 ${spent}`);
      if ((attrs.智力 ?? 8) < 15) warnings.push('建议智力购至 15（兼职法师门槛与施法关键属性）');
      break;
    }

    case 4: {
      const skills = sel.skills || [];
      if (skills.length !== 4) errors.push(`职业熟练须选 4 项，当前 ${skills.length} 项`);
      const parentCats = store.proficiencies?.parentCategories || {};
      for (const sk of skills) {
        if (sk === '奥秘' || sk === '知识') {
          errors.push(`${sk}须指定子项（如 ${sk}-魔法学识）`);
          continue;
        }
        if (MAGE_SKILL_POOL.includes(sk)) continue;
        if (sk.startsWith('奥秘-') || sk.startsWith('知识-')) {
          const parent = sk.split('-')[0];
          const opts = parentCats[parent] || [];
          if (!opts.includes(sk)) errors.push(`无效子项：${sk}`);
          continue;
        }
        errors.push(`无效熟练：${sk}（须为八选一池或奥秘/知识子项）`);
      }
      if (new Set(skills).size !== skills.length) errors.push('职业熟练不可重复');
      break;
    }

    case 5: {
      if (!sel.background) errors.push('请选择背景');
      else {
        const bg = getBackgroundEntity(store, sel.background);
        if (!bg) errors.push(`未知背景：${sel.background}`);
        else {
          const bgVal = validateBackgroundSkillChoices(bg, sel.backgroundSkillChoices || {}, store);
          errors.push(...bgVal.errors);
          warnings.push(...bgVal.warnings);
        }
      }
      break;
    }

    case 6: {
      const kits = store.mageStartingGear?.kits || {};
      if (!sel.equipmentKit) errors.push('请选择起始套装 A/B/C/D');
      else if (!kits[sel.equipmentKit]) errors.push(`无效套装：${sel.equipmentKit}`);
      break;
    }

    case 7: {
      for (let i = 0; i < 7; i += 1) {
        const sub = validateStep({ ...st, step: i }, store);
        if (!sub.valid) errors.push(`步骤 ${i}（${MAGE_WIZARD_STEPS[i].label}）未完成：${sub.errors[0]}`);
      }
      break;
    }

    default:
      errors.push(`未知步骤 ${st.step}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    step: st.step,
    stepKey: stepDef?.key,
    stepLabel: stepDef?.label,
  };
}

function buildBackgroundGrantFields(bg, choices, store) {
  if (!bg?.skillGrants?.length) return [];
  return bg.skillGrants
    .map((grant, index) => {
      const key = grantKey(index, grant);
      if (!GRANT_KINDS_NEEDING_CHOICE.has(grant.kind)) {
        return {
          type: 'grant_info',
          grantKey: key,
          kind: grant.kind,
          label: grant.label,
          fixed: grant.skills || [],
        };
      }
      const field = {
        type: 'grant_choice',
        grantKey: key,
        kind: grant.kind,
        label: grant.label || grant.category,
        count: grant.count ?? 1,
        value: choices[key] || [],
      };
      if (grant.kind === 'choice_from_category') {
        field.options = (grant.options || store.proficiencies?.parentCategories?.[grant.category] || [])
          .map((v) => ({ value: v, label: v }));
      } else if (grant.kind === 'choice_language') {
        field.options = ALL_LANGUAGES.map((v) => ({ value: v, label: v }));
      } else if (grant.kind === 'choice_one') {
        field.options = flattenBasicSkills(store).map((v) => ({ value: v, label: v }));
      }
      return field;
    });
}

export function getStepOptions(state, store = loadAdvisorStore()) {
  const st = normalizeWizardState(state);
  const sel = st.selections;
  const stepDef = getWizardStepDef(st.step);
  const validation = validateStep(st, store);
  const fields = [];

  switch (st.step) {
    case 0:
      fields.push({
        type: 'info',
        text: '主职固定为法师。点击「下一步」进入起始特性选择。',
      });
      fields.push({ type: 'hidden', key: 'className', value: '法师' });
      break;

    case 1: {
      const specs = (store.mageClass?.specializations || []).map((s) => ({
        value: s.name,
        label: s.name,
        hint: s.effect,
      }));
      fields.push({ type: 'select', key: 'specialization', label: '专精', options: specs, value: sel.specialization });
      const spec = (store.mageClass?.specializations || []).find((s) => s.name === sel.specialization);
      if (spec?.profChoices?.length) {
        fields.push({
          type: 'select',
          key: 'specializationProfChoice',
          label: `${sel.specialization} 附加熟练`,
          options: spec.profChoices.map((v) => ({ value: v, label: v })),
          value: sel.specializationProfChoice,
        });
      }
      fields.push({
        type: 'multi',
        key: 'startingFeatures',
        label: `初始特性（${store.mageClass?.startingChoice ?? 4} 选）`,
        max: store.mageClass?.startingChoice ?? 4,
        options: (store.mageClass?.startingFeatures || []).map((f) => ({
          value: f.name,
          label: f.name,
          hint: f.desc,
        })),
        value: sel.startingFeatures || [],
      });
      break;
    }

    case 2: {
      const races = Object.values(store.entities?.byType?.race || {})
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        .map((r) => ({
          value: r.name,
          label: r.name,
          hint: r.attrBonus || r.description?.slice(0, 40),
        }));
      fields.push({ type: 'select', key: 'race', label: '种族', options: races, value: sel.race });
      break;
    }

    case 3: {
      const attrs = sel.attrs || defaultAttrs(store);
      fields.push({
        type: 'point_buy',
        key: 'attrs',
        label: '32 点购点',
        totalPoints: store.pointBuy?.totalPoints ?? 32,
        attrs: store.pointBuy?.attrs || [],
        table: store.pointBuy?.table || [],
        value: attrs,
      });
      break;
    }

    case 4: {
      const parentCats = store.proficiencies?.parentCategories || {};
      fields.push({
        type: 'skill_pick',
        key: 'skills',
        label: '职业熟练（八选四）',
        max: 4,
        pool: MAGE_SKILL_POOL.map((p) => ({
          value: p,
          label: p,
          subOptions: (p === '奥秘' || p === '知识')
            ? (parentCats[p] || []).map((v) => ({ value: v, label: v }))
            : null,
        })),
        value: sel.skills || [],
      });
      break;
    }

    case 5: {
      const bgs = Object.values(store.entities?.byType?.background || {})
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        .map((b) => ({
          value: b.name,
          label: b.name,
          hint: b.mageSkillHits?.length ? `法师相关：${b.mageSkillHits.join('、')}` : b.baseSkills,
        }));
      fields.push({ type: 'select', key: 'background', label: '背景', options: bgs, value: sel.background });
      if (sel.background) {
        const bg = getBackgroundEntity(store, sel.background);
        fields.push(...buildBackgroundGrantFields(bg, sel.backgroundSkillChoices || {}, store));
      }
      break;
    }

    case 6: {
      const kits = store.mageStartingGear?.kits || {};
      fields.push({
        type: 'select',
        key: 'equipmentKit',
        label: '起始套装',
        options: Object.keys(kits).sort().map((k) => ({
          value: k,
          label: `套装 ${k}`,
          hint: kits[k].summary?.slice(0, 60),
        })),
        value: sel.equipmentKit,
      });
      break;
    }

    case 7: {
      fields.push({ type: 'review', label: '确认', selections: sel });
      break;
    }

    default:
      break;
  }

  return {
    step: st.step,
    stepKey: stepDef?.key,
    label: stepDef?.label,
    goal: stepDef?.goal,
    totalSteps: MAGE_WIZARD_STEPS.length,
    fields,
    validation,
    selections: sel,
  };
}

export function navigate(state, action, store = loadAdvisorStore()) {
  const st = normalizeWizardState(state);
  const max = MAGE_WIZARD_STEPS.length - 1;

  if (action === 'next') {
    const val = validateStep(st, store);
    if (!val.valid) {
      return { ok: false, error: val.errors[0] || '当前步骤未完成', state: st, validation: val };
    }
    if (st.step >= max) {
      return { ok: false, error: '已在最后一步', state: st, validation: val };
    }
    const next = applyPatch(st, { step: st.step + 1 });
    return { ok: true, state: next, validation: validateStep(next, store) };
  }

  if (action === 'prev') {
    if (st.step <= 0) {
      return { ok: false, error: '已在第一步', state: st };
    }
    const prev = applyPatch(st, { step: st.step - 1 });
    return { ok: true, state: prev, validation: validateStep(prev, store) };
  }

  if (typeof action === 'number' || (action && action.goto != null)) {
    const target = typeof action === 'number' ? action : action.goto;
    if (target < 0 || target > max) {
      return { ok: false, error: `步骤 ${target} 超出范围`, state: st };
    }
    if (target > st.step) {
      let cursor = st;
      for (let i = st.step; i < target; i += 1) {
        const val = validateStep(cursor, store);
        if (!val.valid) {
          return {
            ok: false,
            error: `无法跳到步骤 ${target}：步骤 ${i}（${MAGE_WIZARD_STEPS[i].label}）未完成`,
            state: cursor,
            validation: val,
          };
        }
        cursor = applyPatch(cursor, { step: i + 1 });
      }
      return { ok: true, state: cursor, validation: validateStep(cursor, store) };
    }
    const jumped = applyPatch(st, { step: target });
    return { ok: true, state: jumped, validation: validateStep(jumped, store) };
  }

  return { ok: false, error: '未知导航动作', state: st };
}

export function wizardApiCall(method, payload = {}) {
  const store = loadAdvisorStore();
  const state = payload.state ? normalizeWizardState(payload.state) : createWizardState();

  switch (method) {
    case 'init':
      return {
        ok: true,
        state: payload.savedState ? normalizeWizardState(payload.savedState) : createWizardState(),
      };
    case 'get': {
      const st = payload.state ? normalizeWizardState(payload.state) : createWizardState();
      return { ok: true, state: st, options: getStepOptions(st, store) };
    }
    case 'apply': {
      const next = applyPatch(state, payload.patch || {});
      return { ok: true, state: next, options: getStepOptions(next, store) };
    }
    case 'navigate': {
      const nav = navigate(state, payload.action, store);
      const options = nav.state ? getStepOptions(nav.state, store) : null;
      return { ...nav, options };
    }
    default:
      return { ok: false, error: `未知 wizard 方法：${method}` };
  }
}
