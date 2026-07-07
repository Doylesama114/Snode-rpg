#!/usr/bin/env node
/**
 * Phase 4 — wizard API, background skillGrants validation, navigation.
 * Run: node scripts/validate-advisor-phase4.mjs
 */
import {
  createWizardState,
  applyPatch,
  validateStep,
  validateBackgroundSkillChoices,
  getStepOptions,
  navigate,
  wizardApiCall,
  getBackgroundEntity,
} from './advisor-wizard-api.mjs';
import { loadAdvisorStore } from './advisor-retrieve.mjs';
import { normalizeWizardState } from './advisor-wizard-state.mjs';

const store = loadAdvisorStore();
let failed = 0;

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

const fresh = createWizardState();
if (fresh.step !== 0) fail('createWizardState step', String(fresh.step));
else pass('createWizardState step=0');
if (fresh.selections.className !== '法师') fail('createWizardState class');
else pass('createWizardState class=法师');

const step0val = validateStep(fresh, store);
if (!step0val.valid) fail('validate step0', step0val.errors.join(';'));
else pass('validate step0');

const nav1 = navigate(fresh, 'next', store);
if (!nav1.ok || nav1.state.step !== 1) fail('navigate next 0→1', nav1.error);
else pass('navigate next 0→1');

const features = applyPatch(nav1.state, {
  selections: {
    specialization: '魔法学派',
    startingFeatures: ['塑能箭', '闪现术', '预知梦', '法术护盾'],
  },
});
const fval = validateStep(features, store);
if (!fval.valid) fail('validate features step', fval.errors.join(';'));
else pass('validate features step (魔法学派)');

const raceStep = navigate(features, 'next', store);
const withRace = applyPatch(raceStep.state, { selections: { race: '人类' } });
const rval = validateStep(withRace, store);
if (!rval.valid) fail('validate race', rval.errors.join(';'));
else pass('validate race=人类');

const attrs = {
  力量: 8, 敏捷: 8, 体质: 15, 智力: 15,
  感知: 15, 魅力: 8, 意志: 13, 幸运: 8,
};
const attrStep = navigate(withRace, 'next', store);
const withAttrs = applyPatch(attrStep.state, { selections: { attrs } });
const aval = validateStep(withAttrs, store);
if (!aval.valid) fail('validate attrs 32pt', aval.errors.join(';'));
else pass('validate attrs 32pt');

const badAttrs = applyPatch(attrStep.state, {
  selections: { attrs: { ...attrs, 意志: 8 } },
});
const badAval = validateStep(badAttrs, store);
if (badAval.valid) fail('reject attrs not 32pt');
else pass('reject attrs not 32pt');

const skillStep = navigate(withAttrs, 'next', store);
const badSkill = applyPatch(skillStep.state, {
  selections: { skills: ['逻辑', '奥秘', '专注', '聆听'] },
});
const badSval = validateStep(badSkill, store);
if (badSval.valid) fail('reject 奥秘 without sub');
else pass('reject 奥秘 without sub');

const withSkills = applyPatch(skillStep.state, {
  selections: {
    skills: ['逻辑', '奥秘-魔法学识', '专注', '聆听'],
  },
});
const sval = validateStep(withSkills, store);
if (!sval.valid) fail('validate skills', sval.errors.join(';'));
else pass('validate skills 4');

const bgStep = navigate(withSkills, 'next', store);
const acolyte = getBackgroundEntity(store, '侍僧');
if (!acolyte) fail('background 侍僧 exists');
else pass('background 侍僧 exists');

const noLang = applyPatch(bgStep.state, { selections: { background: '侍僧' } });
const bgFail = validateStep(noLang, store);
if (bgFail.valid) fail('reject 侍僧 without languages');
else pass('reject 侍僧 without languages');

const acolyteKey = acolyte.skillGrants.findIndex((g) => g.kind === 'choice_language');
const langGrantKey = `${acolyteKey}:choice_language:`;
const withLang = applyPatch(noLang, {
  selections: {
    backgroundSkillChoices: {
      [langGrantKey]: ['精灵语', '龙语'],
    },
  },
});
const bgOk = validateStep(withLang, store);
if (!bgOk.valid) fail('validate 侍僧 + languages', bgOk.errors.join(';'));
else pass('validate 侍僧 + 2 languages');

const liar = getBackgroundEntity(store, '骗子');
if (liar) {
  const liarIdx = liar.skillGrants.findIndex((g) => g.kind === 'choice_from_category');
  const liarKey = `${liarIdx}:choice_from_category:巧手`;
  const liarBad = validateBackgroundSkillChoices(liar, {}, store);
  if (liarBad.valid) fail('reject 骗子 without 巧手');
  else pass('reject 骗子 without 巧手 sub-skill');
  const liarOk = validateBackgroundSkillChoices(liar, {
    [liarKey]: ['巧手-开锁'],
  }, store);
  if (!liarOk.valid) fail('validate 骗子 巧手', liarOk.errors.join(';'));
  else pass('validate 骗子 巧手-开锁');
}

const opts = getStepOptions(withLang, store);
if (opts.step !== 5) fail('getStepOptions step', String(opts.step));
else pass('getStepOptions step=5');
const grantField = (opts.fields || []).find((f) => f.type === 'grant_choice');
if (!grantField) fail('getStepOptions grant_choice field');
else pass('getStepOptions has grant_choice');

const apiGet = wizardApiCall('get', { state: fresh });
if (!apiGet.ok || !apiGet.options) fail('wizardApiCall get');
else pass('wizardApiCall get');

const apiApply = wizardApiCall('apply', {
  state: fresh,
  patch: { selections: { race: '血族' } },
});
if (!apiApply.ok || apiApply.state.selections.race !== '血族') fail('wizardApiCall apply');
else pass('wizardApiCall apply race');

const norm = normalizeWizardState({ step: 2, race: '矮人', className: '法师' });
if (norm.selections.race !== '矮人') fail('normalizeWizardState race');
else pass('normalizeWizardState race');

const prev = navigate(withLang, 'prev', store);
if (!prev.ok || prev.state.step !== 4) fail('navigate prev 5→4');
else pass('navigate prev 5→4');

console.log(`\nPhase 4 validation: ${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}`);
if (failed) process.exit(1);
