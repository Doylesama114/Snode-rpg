#!/usr/bin/env node
/**
 * Advisor 5.0 batch19 (7083) — combat modifier scan v2 CI gate.
 * Run: node scripts/validate-advisor-combat-scan.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  scanCombatModifierCandidates,
  writeCombatModifierScanReport,
  extractHitSignals,
  extractRollModifierSignals,
  extractTargetAcDebuffSignals,
  classifyModifierTier,
  DEFAULT_REPORT_PATH,
} from './advisor-combat-modifiers-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let failed = 0;

function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== validate-advisor-combat-scan (7086) ===\n');

check('extractHitSignals milestones', (() => {
  const s = extractHitSignals('L3: 瞄准射击改为本次攻击命中检定值+3 L6: 瞄准射击改为本次攻击命中检定值+5');
  return s.milestones.length >= 2 && s.milestones.some((m) => m.level === 6 && m.value === 5);
})());

check('classifyTier B conditional poison', classifyModifierTier(
  '攻击命中检定值+4，如果目标处于中毒状态，那么改为攻击命中检定值+7',
  {
    hit: extractHitSignals('攻击命中检定值+4，如果目标处于中毒状态，那么改为攻击命中检定值+7'),
    ac: { flats: [], milestones: [], conditionals: [] },
  },
) === 'B');

check('classifyTier A flat hit', classifyModifierTier(
  '远程攻击命中检定值+5',
  {
    hit: extractHitSignals('远程攻击命中检定值+5'),
    ac: { flats: [], milestones: [], conditionals: [] },
  },
) === 'A');

check('extractRollModifierSignals advantage', extractRollModifierSignals('持有者远程攻击命中检定具有优势').advantage === true);
check('extractTargetAcDebuffSignals', extractTargetAcDebuffSignals('目标的防御等级-5').flats[0]?.value === -5);

const report = scanCombatModifierCandidates();
writeCombatModifierScanReport(report, DEFAULT_REPORT_PATH);

check('report file written', fs.existsSync(DEFAULT_REPORT_PATH));
check('structured count >= 29', report.meta.structuredCount >= 29, `got ${report.meta.structuredCount}`);
check('total candidates >= 40', report.meta.candidateCount >= 40, `got ${report.meta.candidateCount}`);
check('pending tier-A <= 0', report.stats.pendingByTier.A <= 0, `got ${report.stats.pendingByTier.A}`);
check('pending tier-B >= 10', report.stats.pendingByTier.B >= 10, `got ${report.stats.pendingByTier.B}`);
check('duplicate name tracking', report.duplicateNames.some((d) => d.name === '瞄准射击' || d.name === '蓄力劲射'));

console.log(`\n7086 scan-v2.1: ${report.stats.pendingByTier.A} Tier-A · ${report.stats.pendingByTier.B} Tier-B · ${report.stats.pendingByTier.C} Tier-C · ${report.stats.pendingByTier.D} Tier-D pending`);
console.log(`Report: ${path.relative(path.join(__dirname, '..'), DEFAULT_REPORT_PATH)}`);

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
