#!/usr/bin/env node
/**
 * Phase 5 全量回归 — 一键跑核心 validate 脚本（无 live API）
 * Run: node scripts/validate-advisor-phase5-regression.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** @type {[string, string][]} */
const SUITE = [
  ['entities', 'validate-advisor-entities.mjs'],
  ['phase1', 'validate-advisor-phase1.mjs'],
  ['phase2', 'validate-advisor-phase2.mjs'],
  ['phase3', 'validate-advisor-phase3.mjs'],
  ['phase4', 'validate-advisor-phase4.mjs'],
  ['phase4-chargen', 'validate-advisor-phase4-chargen.mjs'],
  ['phase5-spot', 'validate-advisor-phase5.mjs'],
  ['phase5-sync', 'validate-advisor-phase5-sync.mjs'],
  ['phase6-dry', 'validate-advisor-phase6.mjs'],
  ['phase8b-adv', 'validate-advisor-phase8b.mjs'],
  ['batch2-tips', 'validate-advisor-phase5-batch2.mjs'],
  ['batch3-artificer', 'validate-advisor-phase5-batch3.mjs'],
  ['batch4-physical', 'validate-advisor-phase5-batch4.mjs'],
  ['batch5-caster', 'validate-advisor-phase5-batch5.mjs'],
  ['batch6-final', 'validate-advisor-phase5-batch6.mjs'],
  ['batch7-infra', 'validate-advisor-phase5-batch7.mjs'],
  ['batch8-l3a', 'validate-advisor-phase5-batch8.mjs'],
  ['batch9-tips', 'validate-advisor-phase5-batch9.mjs'],
  ['batch10-tier', 'validate-advisor-phase5-batch10.mjs'],
  ['batch12-warrior-full', 'validate-advisor-phase5-batch12.mjs'],
  ['batch13-barbarian-full', 'validate-advisor-phase5-batch13.mjs'],
  ['batch14-hunter-full', 'validate-advisor-phase5-batch14.mjs'],
  ['batch15-cleric-full', 'validate-advisor-phase5-batch15.mjs'],
  ['batch16-paladin-full', 'validate-advisor-phase5-batch16.mjs'],
  ['batch17-rogue-full', 'validate-advisor-phase5-batch17.mjs'],
  ['batch18-druid-full', 'validate-advisor-phase5-batch18.mjs'],
  ['batch19-shaman-full', 'validate-advisor-phase5-batch19.mjs'],
  ['batch20-sorcerer-full', 'validate-advisor-phase5-batch20.mjs'],
  ['batch21-monk-full', 'validate-advisor-phase5-batch21.mjs'],
  ['batch22-bard-full', 'validate-advisor-phase5-batch22.mjs'],
  ['batch23-warlock-full', 'validate-advisor-phase5-batch23.mjs'],
  ['batch24-artificer-full', 'validate-advisor-phase5-batch24.mjs'],
  ['advisor-2-planner', 'validate-advisor-planner.mjs'],
];

function runCase(name, scriptRel) {
  const scriptPath = path.join(__dirname, scriptRel);
  const started = Date.now();
  const r = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ms = Date.now() - started;
  const tail = (r.stdout || r.stderr || '').trim().split(/\r?\n/).slice(-3).join(' | ');
  return {
    name,
    script: scriptRel,
    ok: r.status === 0,
    status: r.status ?? 1,
    ms,
    tail,
  };
}

function main() {
  console.log('Phase 5 full regression suite\n');
  const results = [];
  for (const [name, rel] of SUITE) {
    process.stdout.write(`  … ${name}`);
    const row = runCase(name, rel);
    results.push(row);
    console.log(row.ok ? ` ✓ (${row.ms}ms)` : ` ✗ exit ${row.status}`);
    if (!row.ok && row.tail) console.log(`    ${row.tail}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\nRegression: ${passed}/${results.length} passed (${results.reduce((s, r) => s + r.ms, 0)}ms total)`);
  if (failed.length) {
    console.error('Failed:');
    for (const f of failed) console.error(`  - ${f.name} (${f.script})`);
    process.exit(1);
  }
}

main();
