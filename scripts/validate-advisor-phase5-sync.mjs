#!/usr/bin/env node
/**
 * Phase 5 — wizard ↔ snapshot / panel / chargen sync.
 * Run: node scripts/validate-advisor-phase5-sync.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyPatch,
  navigate,
  validateStep,
} from './advisor-wizard-api.mjs';
import {
  exportWizardToPanel,
  importSnapshotToWizard,
  flattenPanelProfs,
  summarizeExportPreview,
} from './advisor-wizard-sync.mjs';
import { loadAdvisorStore } from './advisor-retrieve.mjs';
import { normalizeSnapshot } from './advisor-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const store = loadAdvisorStore();
let failed = 0;

function pass(label) {
  console.log(`✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(label, cond, detail) {
  if (cond) pass(label);
  else fail(label, detail);
}

function buildCompleteWizard() {
  let st = navigate({ step: 0, className: '法师' }, 'next', store).state;
  st = applyPatch(st, {
    selections: {
      specialization: '奥法学者',
      specializationProfChoice: '奥秘-魔法学识',
      startingFeatures: ['塑能箭', '闪现术', '预知梦', '法术护盾'],
    },
  });
  st = navigate(st, 'next', store).state;
  st = applyPatch(st, { selections: { race: '侏儒' } });
  st = navigate(st, 'next', store).state;
  st = applyPatch(st, {
    selections: {
      attrs: {
        力量: 8, 敏捷: 8, 体质: 15, 智力: 15,
        感知: 15, 魅力: 8, 意志: 13, 幸运: 8,
      },
    },
  });
  st = navigate(st, 'next', store).state;
  st = applyPatch(st, {
    selections: { skills: ['逻辑', '奥秘-魔法学识', '专注', '聆听'] },
  });
  st = navigate(st, 'next', store).state;
  const acolyte = store.entities.byType.background['侍僧'];
  const langIdx = acolyte.skillGrants.findIndex((g) => g.kind === 'choice_language');
  const langKey = `${langIdx}:choice_language:`;
  st = applyPatch(st, {
    selections: {
      background: '侍僧',
      backgroundSkillChoices: { [langKey]: ['精灵语', '龙语'] },
    },
  });
  st = navigate(st, 'next', store).state;
  st = applyPatch(st, { selections: { equipmentKit: 'B' } });
  st = navigate(st, 'next', store).state;
  return st;
}

check('sync module exists', fs.existsSync(path.join(ROOT, 'scripts/advisor-wizard-sync.mjs')));
check('handoff in 角色创建页', fs.readFileSync(path.join(ROOT, '斯诺德跑团/角色创建页.html'), 'utf8').includes('applyAdvisorHandoff'));
const widgetSrc = fs.readFileSync(path.join(ROOT, 'electron-app/斯诺德跑团/advisor-widget.js'), 'utf8');
check('widget chargen bubble', widgetSrc.includes('_snowd_advisor_tip'));
check('widget no standalone wizard tab', !widgetSrc.includes('_tab_wiz'));
check('ledger module', fs.existsSync(path.join(ROOT, 'scripts/advisor-chargen-ledger.mjs')));
check('policy module', fs.existsSync(path.join(ROOT, 'scripts/advisor-chargen-policy.mjs')));
check('attrs module', fs.existsSync(path.join(ROOT, 'scripts/advisor-chargen-attrs.mjs')));
check('snowdChargen on 角色创建页', fs.readFileSync(path.join(ROOT, '斯诺德跑团/角色创建页.html'), 'utf8').includes('window.snowdChargen'));

const complete = buildCompleteWizard();
const reviewVal = validateStep({ ...complete, step: 7 }, store);
check('complete wizard valid', reviewVal.valid, reviewVal.errors?.join(';'));

const exported = exportWizardToPanel(complete, store, { charName: '测试法师' });
check('export wizard', exported.ok, exported.error);
check('export race', exported.snapshot?.race === complete.selections.race);
check('export attrs include racial', (exported.snapshot?.attrs?.智力 || 0) >= 15);
check('handoff specialization', exported.handoff?.selections?.specialization === '奥法学者');

const preview = summarizeExportPreview(exported);
check('export preview', preview.includes('测试法师'));

const incomplete = exportWizardToPanel({ step: 2, selections: { className: '法师', race: '人类' } }, store);
check('reject incomplete export', !incomplete.ok);

const reimport = importSnapshotToWizard(exported.panelState, store);
check('import panelState', reimport.ok, reimport.error);
check('roundtrip race', reimport.state.selections.race === complete.selections.race);
check('roundtrip background', reimport.state.selections.background === complete.selections.background);

const flat = flattenPanelProfs(exported.panelState.profs);
check('flat profs logic', (flat['逻辑'] || 0) >= 1);

const l1Fixture = {
  name: '导入测试',
  race: '人类',
  background: '法师学徒',
  attrs: { 力量: 9, 敏捷: 9, 体质: 10, 智力: 16, 感知: 11, 魅力: 9, 意志: 9, 幸运: 9 },
  classes: [{ name: '法师', level: 1 }],
  profs: { 逻辑: 1, 专注: 1, 聆听: 1, '奥秘-魔法学识': 1 },
  skills: [{ name: '塑能箭' }, { name: '闪现术' }],
  class_features: [{ name: '[法师] 奥法学者', desc: '' }],
  meta: { equipmentKit: 'B', specializationProfChoice: '奥秘-魔法学识' },
};

const impFix = importSnapshotToWizard(l1Fixture, store);
check('import L1 fixture', impFix.ok, impFix.error);
check('fixture race', impFix.state.selections.race === '人类');

const highLevel = importSnapshotToWizard(normalizeSnapshot({
  name: 'X',
  race: '人类',
  classes: [{ name: '法师', level: 5 }],
}), store);
check('reject L5 import', !highLevel.ok);

console.log(`\nPhase 5 sync validation: ${failed === 0 ? 'ALL PASSED' : `${failed} FAILED`}`);
if (failed) process.exit(1);
