#!/usr/bin/env node
/**
 * Advisor 5.0 batch8 (7072) / batch11 (7075) — batch-import validated feedback → golden.
 *
 * Usage:
 *   node scripts/advisor-feedback-sync.mjs
 *   node scripts/advisor-feedback-sync.mjs --dry-run
 *   node scripts/advisor-feedback-sync.mjs --import-dir advisor/feedback/pending
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GOLDEN_PATH,
  PROCESSED_DIR,
  validateFeedbackCase,
  normalizeFeedbackPayloadSync,
  ensureFeedbackDirs,
} from './advisor-feedback-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PENDING = path.join(ROOT, 'advisor', 'feedback', 'pending');

function parseArgs(argv) {
  const out = { dryRun: false, importDir: DEFAULT_PENDING };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--import-dir') out.importDir = path.resolve(ROOT, argv[++i]);
  }
  return out;
}

function loadGolden() {
  return JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
}

function saveGolden(doc) {
  fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function main() {
  ensureFeedbackDirs();
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.importDir)) {
    console.log(`No pending dir: ${opts.importDir}`);
    return;
  }
  const files = fs.readdirSync(opts.importDir).filter((f) => f.endsWith('.json'));
  if (!files.length) {
    console.log(`No pending JSON in ${opts.importDir}`);
    return;
  }

  const doc = loadGolden();
  let imported = 0;
  let skipped = 0;

  for (const f of files) {
    const fp = path.join(opts.importDir, f);
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const norm = normalizeFeedbackPayloadSync(raw);
    const check = validateFeedbackCase(norm);
    if (!check.ok) {
      skipped += 1;
      console.log(`SKIP ${f}: ${check.reason}`);
      continue;
    }

    const newCase = {
      id: norm.id || `feedback-${path.basename(f, '.json')}`,
      query: norm.query,
      expectIntent: norm.expectIntent || check.intent,
      mustInclude: norm.mustInclude?.length ? norm.mustInclude : ['Tools 层'],
      mustNotInclude: norm.mustNotInclude || ['当前资料未收录此项'],
      tags: norm.tags || ['user-feedback', '7075-sync'],
      source: 'advisor-feedback-sync.mjs',
      addedAt: new Date().toISOString().slice(0, 10),
    };

    if (doc.cases.some((c) => c.id === newCase.id)) {
      skipped += 1;
      console.log(`SKIP ${f}: id exists ${newCase.id}`);
      continue;
    }

    console.log(`OK ${f} → ${newCase.id} (${newCase.expectIntent})`);
    if (opts.dryRun) continue;

    doc.cases.push(newCase);
    imported += 1;
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
    fs.renameSync(fp, path.join(PROCESSED_DIR, f));
  }

  if (!opts.dryRun && imported > 0) {
    doc.meta = { ...(doc.meta || {}), lastFeedbackSync: new Date().toISOString().slice(0, 10), caseCount: doc.cases.length };
    saveGolden(doc);
  }

  console.log(`\nImported ${imported}, skipped ${skipped}${opts.dryRun ? ' (dry-run)' : ''}`);
}

main();
