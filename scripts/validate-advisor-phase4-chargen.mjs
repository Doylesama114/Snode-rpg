/**
 * Phase 4″ — ledger, policy, bridge specChoices, starting-feature review mode.
 */
import {
  chargenToWizardState,
  buildChargenFingerprint,
  normalizeChargenPayload,
} from './advisor-chargen-bridge.mjs';
import { buildChargenLedger, formatLedgerContext } from './advisor-chargen-ledger.mjs';
import { buildChargenBubbleQuery } from './advisor-chargen-policy.mjs';
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
    selectedFeatures: ['塑能箭', '闪现术', '预知梦', '法术护盾'],
    specChoices: {
      奥法学者: { skill: '奥秘-魔法学识' },
      知识传承: { skill: '知识-历史' },
    },
    bgName: null,
    bgProfs: { skills: {} },
    equipChoice: null,
    extraLanguages: [],
  },
};

const SAMPLE_PARTIAL = {
  ...SAMPLE,
  char: {
    ...SAMPLE.char,
    selectedFeatures: ['塑能箭', '闪现术'],
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
if (ws?.selections?.specChoices?.['奥法学者']?.skill === '奥秘-魔法学识') {
  pass('bridge keeps full specChoices');
} else fail('bridge specChoices', ws?.selections?.specChoices);

const ledger = buildChargenLedger(SAMPLE.char, { step: 4 });
if (ledger.profNames.includes('奥秘-魔法学识')) pass('ledger spec prof');
else fail('ledger spec prof');

if (ledger.entries.some((e) => e.source === '专精·魔法学派')) pass('ledger magic school granted');
else fail('ledger magic school');

if (ledger.overlapWarnings.length === 0) pass('ledger no false overlap at step4 empty skills');
else fail('ledger false overlap', ledger.overlapWarnings);

const dupChar = {
  ...SAMPLE.char,
  selectedSkills: ['奥秘-魔法学识', '调查', '逻辑', '专注'],
};
const dupLedger = buildChargenLedger(dupChar, { step: 4 });
if (dupLedger.overlapWarnings.some((w) => w.prof.includes('魔法学识'))) {
  pass('ledger overlap magic学识');
} else fail('ledger overlap', dupLedger.overlapWarnings);

const qFull = buildChargenBubbleQuery(SAMPLE);
if (qFull.includes('评价') && qFull.includes('不要推荐改选')) pass('policy features full review');
else fail('policy full', qFull.slice(0, 80));

const qPartial = buildChargenBubbleQuery(SAMPLE_PARTIAL);
if (qPartial.includes('禁止') || qPartial.includes('勿')) pass('policy partial no push');
else fail('policy partial', qPartial.slice(0, 80));

const ctx = formatWizardContext(ws, {}, { ledgerContext: formatLedgerContext(ledger) });
if (ctx.includes('非三选一') && ctx.includes('熟练账本')) pass('wizard context rules');
else fail('wizard context');

const ret = retrieve('评价我的起始特性', {
  mode: 'wizard',
  wizardState: ws,
  chargenState: SAMPLE,
});
const block = formatContext(ret);
if (block.includes('车卡熟练账本') && block.includes('塑能箭')) pass('retrieve includes ledger');
else fail('retrieve ledger');

if (!block.includes('法师友好背景示例')) pass('no static bg list at step1');
else fail('static bg leak');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
