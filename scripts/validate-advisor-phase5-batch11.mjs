#!/usr/bin/env node
/**
 * Phase 5 batch 11 (7038) — Phase 5 收尾 + 全量回归
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getClassProfile } from './advisor-chargen-registry.mjs';
import { listRegistryClassNames } from './advisor-class-content.mjs';
import { auditAllClasses } from './advisor-class-tier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function pass(n) { passed++; console.log('  ✓', n); }
function fail(n, d) { failed++; console.error('  ✗', n, d || ''); }

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/chargen/class_registry.json'), 'utf8'));
if (reg.meta?.phase === '5-complete') pass('registry phase 5-complete');
else fail('registry phase', reg.meta?.phase);

const names = listRegistryClassNames();
if (names.length === 14) pass('14 registry classes');
else fail('registry count', names.length);

const basic = names.filter((n) => getClassProfile(n).tier === 'basic');
if (basic.length === 0) pass('no basic tier');
else fail('basic remains', basic.join(','));

const audit = auditAllClasses();
if (audit.meta.fullReady === 5 && audit.meta.partialReady === 9) pass('tier audit all ready');
else fail('tier audit', `${audit.meta.fullReady}/5 ${audit.meta.partialReady}/9`);

const entities = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/entities/classes.json'), 'utf8'));
if (entities.meta?.count === 14) pass('14 entity class cards');
else fail('entity classes', entities.meta?.count);

const summary = JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/rules/rules_summary.json'), 'utf8'));
if (summary.bullets.some((b) => b.includes('Phase 5 完成'))) pass('rules_summary Phase5 note');
else fail('rules_summary Phase5');

if (fs.existsSync(path.join(__dirname, 'validate-advisor-phase5-regression.mjs'))) pass('regression runner exists');
else fail('regression runner');

console.log('\n--- full regression ---\n');
const r = spawnSync(process.execPath, [path.join(__dirname, 'validate-advisor-phase5-regression.mjs')], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (r.status === 0) pass('regression suite');
else fail('regression suite', `exit ${r.status}`);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
