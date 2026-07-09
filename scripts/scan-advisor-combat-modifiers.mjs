#!/usr/bin/env node
/**
 * Advisor 5.0 batch19 (7083) — CLI for L2 combat modifier scan v2.
 * Run: node scripts/scan-advisor-combat-modifiers.mjs [--json] [--tier-a] [--tier-b] [--write]
 */
import {
  scanCombatModifierCandidates,
  writeCombatModifierScanReport,
  DEFAULT_REPORT_PATH,
} from './advisor-combat-modifiers-scan.mjs';

const args = new Set(process.argv.slice(2));
const writeReport = args.has('--write') || args.has('--json');
const onlyTierA = args.has('--tier-a');
const onlyTierB = args.has('--tier-b');

function printTier(label, rows, limit = 15) {
  console.log(`\n${label} (${rows.length})`);
  for (const row of rows.slice(0, limit)) {
    const hit = row.hit?.flats?.[0]?.value ?? row.hit?.milestones?.[0]?.value;
    const ac = row.ac?.flats?.[0]?.value ?? row.ac?.milestones?.[0]?.value;
    const bonus = hit != null ? `命中+${hit}` : ac != null ? `AC+${ac}` : row.kind;
    console.log(`  · ${row.name}（${row.className}）${bonus} [${row.tier}] ← ${row.indexFile}${row.structured ? ' ✓structured' : ''}`);
  }
  if (rows.length > limit) console.log(`  … +${rows.length - limit} more`);
}

function main() {
  console.log('=== scan-advisor-combat-modifiers v2 (7083) ===\n');
  const report = scanCombatModifierCandidates();
  const { meta, stats, tiers, duplicateNames } = report;

  console.log(`Structured corpus: ${meta.structuredCount} skills`);
  console.log(`L2 modifier signals: ${meta.candidateCount} skills (${meta.pendingCount} pending)`);
  console.log(`Pending by tier: A=${stats.pendingByTier.A} B=${stats.pendingByTier.B} C=${stats.pendingByTier.C} D=${stats.pendingByTier.D}`);
  if (duplicateNames.length) {
    console.log(`Duplicate skill names across indexes: ${duplicateNames.length} (e.g. ${duplicateNames.slice(0, 3).map((d) => d.name).join('、')})`);
  }

  if (onlyTierA) printTier('Tier-A (flat/milestone · bulk-ready)', tiers.A);
  else if (onlyTierB) printTier('Tier-B (conditional · semi-auto)', tiers.B);
  else {
    printTier('Tier-A pending', tiers.A);
    printTier('Tier-B pending', tiers.B, 10);
    printTier('Tier-C pending (engine gap)', tiers.C, 8);
    printTier('Tier-D pending (enemy debuff)', tiers.D, 8);
  }

  if (writeReport) {
    const fp = writeCombatModifierScanReport(report, DEFAULT_REPORT_PATH);
    console.log(`\nWrote ${fp}`);
  }

  console.log('\nOK (report only)');
}

main();
