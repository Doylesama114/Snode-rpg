/**
 * Phase 5 batch 9 (7036) — L5 class_tips stub + 复杂职业 chargen policy
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listRegistryClassNames } from './advisor-class-content.mjs';
import { collectTipsPool } from './advisor-class-content.mjs';
import { buildChargenBubbleQuery } from './advisor-chargen-policy.mjs';
import { analyzeKeyAttrTargets } from './advisor-chargen-registry.mjs';
import { formatPointBuyContext } from './advisor-chargen-attrs.mjs';
import { loadAdvisorStore, retrieve, formatContext } from './advisor-retrieve.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const tipsDir = path.join(ADVISOR, 'combos', 'class_tips');
const classNames = listRegistryClassNames().filter((n) => n !== '法师');

for (const cn of classNames) {
  const p = path.join(tipsDir, `${cn}.json`);
  if (!fs.existsSync(p)) { fail(`tips file ${cn}`); continue; }
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (doc.meta?.status === 'auto_stub' && doc.tips?.length >= 2) pass(`tips stub ${cn} (${doc.tips.length})`);
  else fail(`tips stub ${cn}`, doc.tips?.length);
  if (doc.tips.some((t) => t.kind === 'style_guide')) pass(`style_guide ${cn}`);
  else fail(`style_guide ${cn}`);
}

const warriorTips = JSON.parse(fs.readFileSync(path.join(tipsDir, '战士.json'), 'utf8'));
if (warriorTips.tips.some((t) => t.style === '防护' && t.title.includes('防护'))) pass('warrior 防护 tip');
else fail('warrior style tip');

const store = loadAdvisorStore();
const warPool = collectTipsPool(store, '战士');
const magePool = collectTipsPool(store, '法师');
if (warPool.some((t) => t.kind === 'style_guide' && t.applicableClasses?.includes('战士'))) pass('pool warrior style_guide');
else fail('pool warrior styles');
if (warPool.length > 10 && !warPool.some((t) => t.title.includes('塑能'))) pass('warrior pool no mage bleed');
else fail('warrior pool bleed', warPool.length);

const retWar = retrieve('战士防护风格怎么玩', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '战士' } }),
});
const ctxWar = formatContext(retWar);
if (ctxWar.includes('L5') && (ctxWar.includes('防护') || ctxWar.includes('style_guide'))) pass('retrieve warrior L5');
else fail('retrieve warrior L5', ctxWar.slice(0, 300));

const qArt = buildChargenBubbleQuery({
  source: 'chargen_page', step: 0, stepLabel: '选择职业',
  char: { className: '奇械师' },
});
if (qArt.includes('FP') && qArt.includes('奇械构装')) pass('policy artificer step0');
else fail('policy artificer', qArt.slice(0, 200));

const qLock = buildChargenBubbleQuery({
  source: 'chargen_page', step: 0, stepLabel: '选择职业',
  char: { className: '魔契师' },
});
if (qLock.includes('魔契') && qLock.includes('起始特性')) pass('policy warlock step0');
else fail('policy warlock', qLock.slice(0, 200));

const qSorc = buildChargenBubbleQuery({
  source: 'chargen_page', step: 1, stepLabel: '选择起始特性',
  char: { className: '术士', selectedFeatures: ['魔法飞弹'] },
});
if (qSorc.includes('三选二') && qSorc.includes('幸运')) pass('policy sorcerer step1');
else fail('policy sorcerer', qSorc.slice(0, 200));

const warOr = analyzeKeyAttrTargets({
  className: '战士',
  attrs: { 力量: 12, 敏捷: 15, 体质: 12, 智力: 8, 感知: 10, 魅力: 8, 意志: 8, 幸运: 8 },
  raceAttrBonuses: { 敏捷: 0 },
}, { keyAttr: '力量或敏捷', keyAttrTarget: 15 });
if (warOr.orChoice && warOr.allMet) pass('dual key attr OR met');
else fail('dual key OR', JSON.stringify(warOr));

const pbCtx = formatPointBuyContext({
  className: '战士',
  keyAttr: '力量',
  attrs: { 力量: 15, 敏捷: 12, 体质: 12, 智力: 8, 感知: 10, 魅力: 8, 意志: 8, 幸运: 8 },
  raceAttrBonuses: {},
  pointSpent: 32,
});
if (pbCtx.includes('关键属性')) pass('point buy context key attr');

const qWarAttr = buildChargenBubbleQuery({
  source: 'chargen_page', step: 3, stepLabel: '分配属性',
  char: {
    className: '战士',
    attrs: { 力量: 15, 敏捷: 14, 体质: 12, 智力: 8, 感知: 10, 魅力: 8, 意志: 8, 幸运: 8 },
    raceAttrBonuses: { 力量: 1 },
    pointSpent: 32,
  },
});
if (qWarAttr.includes('至少一项') || qWarAttr.includes('力量')) pass('policy warrior attrs phrase');
else fail('policy warrior attrs', qWarAttr.slice(0, 150));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
