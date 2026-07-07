/**
 * Phase 4‴ — ledger, attrs, policy, sync fixes
 */
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';
import { buildChargenLedger, formatLedgerContext } from './advisor-chargen-ledger.mjs';
import { buildChargenBubbleQuery, buildChargenExtraContext } from './advisor-chargen-policy.mjs';
import { analyzePointBuy, formatSkillSynergyContext } from './advisor-chargen-attrs.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

const FULL_FEATURES = {
  source: 'chargen_page',
  step: 1,
  stepLabel: '选择起始特性',
  char: {
    className: '法师',
    selectedFeatures: ['塑能箭', '闪现术', '预知梦', '法术护盾'],
    specChoices: {
      奥法学者: { skill: '奥秘-魔法学识' },
      知识传承: { skill: '知识-历史' },
    },
    attrs: { 智力: 15, 体质: 10, 感知: 12, 力量: 8, 敏捷: 8, 魅力: 8, 意志: 8, 幸运: 8 },
    raceAttrBonuses: { 智力: 2 },
    pointSpent: 32,
    selectedSkills: ['奥秘-魔法学识', '调查', '专注', '洞悉'],
    raceName: '人类',
    overviewProfs: [
      { name: '奥秘-魔法学识', src: '专精' },
      { name: '知识-历史', src: '专精' },
      { name: '奥秘-魔法学识', src: '职业' },
      { name: '调查', src: '职业' },
      { name: '专注', src: '职业' },
      { name: '洞悉', src: '职业' },
    ],
  },
};

const ATTR_DONE = {
  source: 'chargen_page',
  step: 3,
  stepLabel: '分配属性',
  char: {
    className: '法师',
    attrs: {
      力量: 8, 敏捷: 8, 体质: 15, 智力: 15,
      感知: 15, 魅力: 8, 意志: 13, 幸运: 8,
    },
    raceAttrBonuses: { 智力: 1 },
    raceName: '人类',
  },
};

const SKILLS_STEP = {
  ...FULL_FEATURES,
  step: 4,
  stepLabel: '选择熟练项',
};

const REVIEW = {
  source: 'chargen_page',
  step: 7,
  stepLabel: '确认角色',
  char: {
    className: '法师',
    characterProfile: {
      charName: '艾拉',
      story: '曾在学院塔楼研究塑能法术',
      hair: '银白',
      personality: '冷静',
    },
  },
};

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const qRace = buildChargenBubbleQuery({ ...FULL_FEATURES, step: 2, stepLabel: '选择种族' });
if (qRace.includes('禁止提及兼职') && !qRace.includes('兼职 +6') && !qRace.includes('+6 进度')) pass('policy race no multiclass');
else fail('policy race multiclass', qRace.slice(0, 120));

const qBg = buildChargenBubbleQuery({ ...FULL_FEATURES, step: 5, stepLabel: '选择个性背景' });
if (qBg.includes('禁止提及兼职') && !qBg.includes('兼职 +6') && !qBg.includes('+6 进度')) pass('policy background no multiclass');
else fail('policy background multiclass', qBg.slice(0, 120));

const ledger = buildChargenLedger(FULL_FEATURES.char, { step: 4 });

const ledgerCtx = formatLedgerContext(ledger);
if (!ledgerCtx.includes('兼职法师门槛') && ledgerCtx.includes('禁止提及兼职')) pass('ledger no multiclass gate');
else fail('ledger multiclass gate', ledgerCtx);

if (ledger.fromOverview) pass('ledger uses overviewProfs');
else fail('ledger overview source');

const qFeat = buildChargenBubbleQuery(FULL_FEATURES);
if (qFeat.includes('【必须】评价') && qFeat.includes('塑能箭')) pass('policy features must review');
else fail('policy features', qFeat.slice(0, 100));

const qAttr = buildChargenBubbleQuery(ATTR_DONE);
if (qAttr.includes('【必须】评价') && qAttr.includes('32')) pass('policy attrs must review');
else fail('policy attrs', qAttr.slice(0, 100));

const qReview = buildChargenBubbleQuery(REVIEW);
if (qReview.includes('叙事') || qReview.includes('背景故事')) pass('policy review narrative');
else fail('policy review', qReview.slice(0, 100));

if (ledger.entries.some((e) => e.name === '奥秘-魔法学识' && e.subLabel)) pass('ledger subLabel');
else fail('ledger subLabel');

const syn = formatSkillSynergyContext(FULL_FEATURES.char, FULL_FEATURES.char.selectedSkills);
if (syn.includes('专注') && syn.includes('体质')) pass('skill synergy non-int');
else fail('skill synergy', syn);

const extra = buildChargenExtraContext(FULL_FEATURES);
if (extra.includes('购点分析') || extra.includes('熟练')) pass('extra context');
else fail('extra context');

const ret = retrieve('test', {
  mode: 'wizard',
  wizardState: chargenToWizardState(SKILLS_STEP),
  chargenState: SKILLS_STEP,
});
const block = formatContext(ret);
if (block.includes('奥秘-魔法学识') && block.includes('熟练↔属性')) pass('retrieve full skills');
else fail('retrieve context');

const pb = analyzePointBuy(ATTR_DONE.char);
if (pb.complete) pass('point buy complete');
else fail('point buy');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
