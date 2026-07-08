#!/usr/bin/env node
/**
 * Advisor 5.0 batch11 (7075) — export localStorage / inbox JSON → pending/.
 *
 * Usage:
 *   node scripts/advisor-feedback-export.mjs --from advisor/feedback/inbox/queue.json
 *   node scripts/advisor-feedback-export.mjs --from advisor/feedback/inbox/queue.json --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ensureFeedbackDirs,
  INBOX_DIR,
  PENDING_DIR,
  normalizeFeedbackPayload,
  slugPendingFilename,
} from './advisor-feedback-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { dryRun: false, from: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') out.dryRun = true;
    else if (argv[i] === '--from') out.from = argv[++i];
  }
  return out;
}

function loadInboxPayload(fp) {
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (raw.queue && Array.isArray(raw.queue)) return raw.queue;
  return [raw];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.from) {
    console.error('Usage: node scripts/advisor-feedback-export.mjs --from advisor/feedback/inbox/queue.json');
    process.exit(1);
  }

  ensureFeedbackDirs();
  const fp = path.isAbsolute(opts.from) ? opts.from : path.join(ROOT, opts.from);
  if (!fs.existsSync(fp)) {
    console.error(`File not found: ${fp}`);
    process.exit(1);
  }

  const items = loadInboxPayload(fp);
  let written = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const pending = normalizeFeedbackPayload(item);
      const outName = slugPendingFilename(pending.query);
      const outPath = path.join(PENDING_DIR, outName);
      console.log(`OK export: ${pending.query.slice(0, 40)}… → ${outName}`);
      console.log(`   intent=${pending.expectIntent} mustInclude=${pending.mustInclude.join(', ')}`);
      if (!opts.dryRun) {
        fs.writeFileSync(outPath, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
        written += 1;
      }
    } catch (e) {
      failed += 1;
      console.error(`FAIL: ${e.message}`);
    }
  }

  console.log(`\nExported ${written}, failed ${failed}${opts.dryRun ? ' (dry-run)' : ''}`);
  if (failed) process.exit(1);
}

main();
