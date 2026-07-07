/**
 * Phase 4′ — 角色创建页 CHAR → wizard 上下文桥接
 */
import {
  chargenToWizardState,
  buildChargenFingerprint,
  normalizeChargenPayload,
} from './advisor-chargen-bridge.mjs';
import { formatWizardContext } from './advisor-wizard-state.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

const SAMPLE = {
  source: 'chargen_page',
  step: 1,
  stepLabel: '选择起始特性',
  char: {
    className: '法师',
    raceName: null,
    attrs: { 智力: 15, 体质: 10 },
    selectedSkills: [],
    selectedFeatures: ['法术书', '奥术传承'],
    specChoices: { 奥法学者: { skill: '奥秘-魔法学识' } },
    bgName: null,
    bgProfs: { skills: {} },
    equipChoice: null,
    extraLanguages: [],
  },
};

let passed = 0;
let failed = 0;

function pass(name) {
  passed += 1;
  console.log('  ✓', name);
}

function fail(name, detail) {
  failed += 1;
  console.error('  ✗', name, detail || '');
}

const ws = chargenToWizardState(SAMPLE);
if (!ws || ws.step !== 1) fail('step maps to 1', ws?.step);
else pass('step maps to 1');

if (ws?.selections?.specialization !== '奥法学者') {
  fail('specialization from specChoices', ws?.selections?.specialization);
} else pass('specialization from specChoices');

if (ws?.selections?.specializationProfChoice !== '奥秘-魔法学识') {
  fail('spec prof choice', ws?.selections?.specializationProfChoice);
} else pass('spec prof choice');

if (ws?.meta?.source !== 'chargen_page') fail('meta source', ws?.meta);
else pass('meta source chargen_page');

const fp1 = buildChargenFingerprint(SAMPLE);
const fp2 = buildChargenFingerprint({ ...SAMPLE, char: { ...SAMPLE.char, raceName: '人类' } });
if (fp1 === fp2) fail('fingerprint changes on race');
else pass('fingerprint changes on race');

const norm = normalizeChargenPayload({ chargenState: SAMPLE });
if (!norm?.selections?.className) fail('normalizeChargenPayload');
else pass('normalizeChargenPayload');

const ctx = formatWizardContext(ws, {});
if (!ctx.includes('角色创建页')) fail('formatWizardContext mentions chargen');
else pass('formatWizardContext mentions chargen');

const ret = retrieve('当前步骤怎么选专精？', {
  mode: 'wizard',
  wizardState: ws,
});
if (ret.mode !== 'wizard') fail('retrieve mode', ret.mode);
else pass('retrieve mode wizard');

const ctxBlock = formatContext(ret);
if (!ctxBlock.includes('车卡向导状态')) fail('retrieve context');
else pass('retrieve context has wizard block');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
