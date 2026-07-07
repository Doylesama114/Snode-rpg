/**
 * Phase 5 batch 6 — 收尾：吟游诗人/魔契师 + 全 14 职业 L2 回归
 */
import { getClassProfile } from './advisor-chargen-registry.mjs';
import { listRegistryClassNames } from './advisor-class-content.mjs';
import { resolveClassL2Layer } from './advisor-router.mjs';
import { loadAdvisorStore, retrieve } from './advisor-retrieve.mjs';
import { loadClassHintsFile } from './advisor-class-content.mjs';
import { listL2ClassEntries } from './advisor-class-l2.mjs';
import { chargenToWizardState } from './advisor-chargen-bridge.mjs';

const FINAL_TWO = ['吟游诗人', '魔契师'];

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

for (const cn of FINAL_TWO) {
  const p = getClassProfile(cn);
  if (p.tier === 'full' && p.l2Layer) pass(`registry ${cn}`);
  else fail(`registry ${cn}`, JSON.stringify(p));
}

const store = loadAdvisorStore();
for (const cn of FINAL_TWO) {
  const p = getClassProfile(cn);
  const idx = store.classSkillIndexes?.[p.l2Layer];
  if (idx?.skills?.length >= 80) pass(`index ${cn} (${idx.skills.length})`);
  else fail(`index ${cn}`, idx?.skills?.length);
  if (loadClassHintsFile(cn)?.styleHints?.length >= 3) pass(`hints ${cn}`);
  else fail(`hints ${cn}`);
}

const retBard = retrieve('吟游诗人有什么流派');
if (retBard.retrievalClass === '吟游诗人' && (retBard.results['L2-bard'] || []).length > 0) pass('retrieve bard');
else fail('retrieve bard', retBard.retrievalClass);

const retLock = retrieve('魔契流派怎么选', {
  wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: '魔契师' } }),
});
if ((retLock.results['L2-warlock'] || []).length > 0) pass('retrieve warlock');
else fail('retrieve warlock');

const allNames = listRegistryClassNames();
const basicLeft = allNames.filter((n) => getClassProfile(n).tier === 'basic');
if (basicLeft.length === 0) pass('no basic tier left');
else fail('basic tier remains', basicLeft.join(','));

const l2Entries = listL2ClassEntries();
if (l2Entries.length === 13) pass('13 registry L2 classes (+ mage full)');
else fail('L2 entry count', l2Entries.length);

for (const entry of l2Entries) {
  const idx = store.classSkillIndexes?.[entry.l2Layer];
  if (idx?.skills?.length > 0) pass(`L2 loaded ${entry.className}`);
  else fail(`L2 loaded ${entry.className}`);
}

if (resolveClassL2Layer('法师') === 'L2-mage') pass('mage full L2');
else fail('mage L2');

const samples = [
  ['战士', 'L2-warrior'],
  ['德鲁伊', 'L2-druid'],
  ['奇械师', 'L2-artificer'],
];
for (const [cn, layer] of samples) {
  const r = retrieve(`${cn}流派`, {
    wizardState: chargenToWizardState({ source: 'chargen_page', step: 0, char: { className: cn } }),
  });
  if ((r.results[layer] || []).length > 0) pass(`spot ${cn}`);
  else fail(`spot ${cn}`);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
