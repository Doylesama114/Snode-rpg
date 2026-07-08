#!/usr/bin/env node
/**
 * Advisor 5.0 full CI suite — tools, audit, golden, intents, feedback.
 * Run: node scripts/validate-advisor-5-regression.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** @type {[string, string][]} */
const SUITE = [
  ['tools', 'validate-advisor-tools.mjs'],
  ['audit', 'validate-advisor-audit.mjs'],
  ['golden', 'validate-advisor-golden.mjs'],
  ['intents', 'validate-advisor-intents.mjs'],
  ['feedback', 'validate-advisor-feedback.mjs'],
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
  const tail = (r.stdout || r.stderr || '').trim().split(/\r?\n/).slice(-2).join(' | ');
  return { name, script: scriptRel, ok: r.status === 0, status: r.status ?? 1, ms, tail };
}

function main() {
  console.log('Advisor 5.0 regression suite\n');
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
  console.log(`\nAdvisor 5.0: ${passed}/${results.length} passed (${results.reduce((s, r) => s + r.ms, 0)}ms total)`);
  if (failed.length) {
    console.error('Failed:');
    for (const f of failed) console.error(`  - ${f.name} (${f.script})`);
    process.exit(1);
  }
}

main();
