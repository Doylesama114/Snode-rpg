#!/usr/bin/env node
/**
 * Advisor 5.0 batch20 (7084) — merge Tier-A scan candidates into combat_skill_modifiers.json.
 * Run: node scripts/build-advisor-combat-modifiers-from-scan.mjs [--dry-run]
 *
 * Advisor 5.0 batch22 (7086) — merge Tier-A scan candidates into combat_skill_modifiers.json.
 * Skips were: 荒野医疗/独行伙伴/奥术矩阵 — now structured via appliesTo (7086).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanCombatModifierCandidates } from './advisor-combat-modifiers-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOD_PATH = path.join(__dirname, '..', 'advisor', 'rules', 'combat_skill_modifiers.json');

const SKIP_BULK = new Set([
  '荒野医疗',
  '独行伙伴',
  '奥术矩阵屏障（图纸）',
  '皮匠工具大师',
]);

/**
 * @param {object} row scan Tier-A row
 */
export function tierARowToModifier(row) {
  const entry = {
    className: row.className,
    note: (row.summarySnippet || '').slice(0, 96),
    source: `${row.indexFile} · ${row.name} summary`,
  };
  const hitMs = {};
  for (const m of row.hit?.milestones || []) hitMs[`L${m.level}`] = m.value;
  if (row.hit?.flats?.length || Object.keys(hitMs).length) {
    entry.hitModifier = {
      base: row.hit?.flats?.[0]?.value ?? 0,
      ...(Object.keys(hitMs).length ? { milestones: hitMs } : {}),
    };
    if (/远程|弓|弩/.test(row.summarySnippet || '')) entry.requiresRanged = true;
  }
  if (row.ac?.flats?.length) {
    entry.acModifier = { base: row.ac.flats[0].value };
  }
  return entry;
}

/**
 * @param {{ dryRun?: boolean }} [opts]
 */
export function mergeTierAFromScan(opts = {}) {
  const doc = JSON.parse(fs.readFileSync(MOD_PATH, 'utf8'));
  const skills = { ...(doc.skills || {}) };
  const report = scanCombatModifierCandidates();
  const added = [];
  const skipped = [];

  for (const row of report.tiers.A) {
    if (skills[row.name]) continue;
    if (SKIP_BULK.has(row.name)) {
      skipped.push(row.name);
      continue;
    }
    const entry = tierARowToModifier(row);
    if (!entry.hitModifier && !entry.acModifier) {
      skipped.push(row.name);
      continue;
    }
    skills[row.name] = entry;
    added.push(row.name);
  }

  if (!opts.dryRun && added.length) {
    doc.skills = skills;
    doc.meta = {
      ...doc.meta,
      bulkMergedAt: new Date().toISOString().slice(0, 10),
      bulkMergedFrom: 'build-advisor-combat-modifiers-from-scan.mjs',
    };
    fs.writeFileSync(MOD_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }

  return { added, skipped, total: Object.keys(skills).length };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`=== build-advisor-combat-modifiers-from-scan (7084) ${dryRun ? 'DRY-RUN' : ''} ===\n`);
  const { added, skipped, total } = mergeTierAFromScan({ dryRun });
  console.log(`Would add / added: ${added.length} → ${added.join('、') || '(none)'}`);
  console.log(`Skipped: ${skipped.join('、') || '(none)'}`);
  console.log(`Corpus size: ${total} skills`);
  console.log(dryRun ? '\nOK (dry-run)' : '\nOK');
}

if (process.argv[1]?.endsWith('build-advisor-combat-modifiers-from-scan.mjs')) {
  main();
}
