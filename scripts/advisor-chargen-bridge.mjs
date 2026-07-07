/**
 * Phase 4′ — 角色创建页 CHAR → Build 顾问 wizard 上下文（只读镜像，不做第二套校验）。
 */
import { normalizeWizardState } from './advisor-wizard-state.mjs';

const MAGE_SPECS = new Set(['奥法学者', '知识传承', '魔法学派']);

function featNames(list) {
  if (!Array.isArray(list)) return [];
  return list.map((f) => (typeof f === 'string' ? f : (f?.n || f?.name || ''))).filter(Boolean);
}

function pickSpecialization(specChoices) {
  if (!specChoices || typeof specChoices !== 'object') return { name: null, prof: null };
  for (const name of Object.keys(specChoices)) {
    if (MAGE_SPECS.has(name)) {
      const ch = specChoices[name];
      const prof = ch?.skill || ch?.prof || null;
      return { name, prof };
    }
  }
  return { name: null, prof: null };
}

function attrsPlain(attrs) {
  if (!attrs || typeof attrs !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'number') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function equipmentLetter(char) {
  if (char?.equipChoice?.letter) return char.equipChoice.letter;
  if (char?.equipmentKit) return char.equipmentKit;
  return null;
}

function bgProfsToSkillChoices(bgProfs) {
  if (!bgProfs?.skills || typeof bgProfs.skills !== 'object') return {};
  const out = {};
  for (const [cat, v] of Object.entries(bgProfs.skills)) {
    if (cat === '_custom' && v && typeof v === 'object') {
      const label = v.attr && v.skill ? `${v.attr}·${v.skill}` : (v.skill || '');
      if (label) out._custom = [label];
    } else if (Array.isArray(v) && v.length) {
      out[cat] = v.slice();
    }
  }
  return out;
}

/**
 * @param {{ step?: number, stepLabel?: string, char?: object }} snapshot — from snowdChargen.getState()
 */
export function chargenToWizardState(snapshot) {
  if (!snapshot) return null;
  const step = snapshot.step ?? snapshot.currentStep ?? 0;
  const char = snapshot.char || snapshot;
  const spec = pickSpecialization(char.specChoices);

  const raw = {
    step,
    stepLabel: snapshot.stepLabel,
    meta: { source: 'chargen_page', version: 'phase4-prime' },
    className: char.className || null,
    specialization: spec.name,
    specializationProfChoice: spec.prof,
    startingFeatures: featNames(char.selectedFeatures),
    race: char.raceName || char.race || null,
    attrs: attrsPlain(char.attrs),
    skills: Array.isArray(char.selectedSkills) ? char.selectedSkills.slice() : [],
    background: char.bgName || char.background || null,
    backgroundSkillChoices: bgProfsToSkillChoices(char.bgProfs)
      || char.backgroundSkillChoices
      || {},
    equipmentKit: equipmentLetter(char),
    extraLanguages: char.extraLanguages || [],
    pointSpent: typeof char.pointSpent === 'number' ? char.pointSpent : null,
  };

  return normalizeWizardState(raw);
}

export function buildChargenFingerprint(snapshot) {
  if (!snapshot) return '';
  const char = snapshot.char || {};
  return [
    snapshot.step,
    char.className,
    char.raceName,
    char.bgName,
    featNames(char.selectedFeatures).join(','),
    (char.selectedSkills || []).join(','),
    JSON.stringify(char.attrs || {}),
    JSON.stringify(char.specChoices || {}),
    equipmentLetter(char),
  ].join('|');
}

export function normalizeChargenPayload(payload) {
  if (payload?.wizardState) return payload.wizardState;
  if (payload?.chargenState) return chargenToWizardState(payload.chargenState);
  return null;
}
