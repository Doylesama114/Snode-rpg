#!/usr/bin/env node
/**
 * Advisor 5.0 batch8 (7072) — batch-import validated feedback → golden.
 *
 * Usage:
 *   node scripts/advisor-feedback-sync.mjs
 *   node scripts/advisor-feedback-sync.mjs --dry-run
 *   node scripts/advisor-feedback-sync.mjs --import-dir advisor/feedback/pending
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GOLDEN_PATH = path.join(ROOT, 'advisor', 'golden', 'conversations.json');
const DEFAULT_PENDING = path.join(ROOT, 'advisor', 'feedback', 'pending');
const PROCESSED = path.join(ROOT, 'advisor', 'feedback', 'processed');

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

function validateCase(raw) {
  const query = String(raw.query || '').trim();
  if (!query) return { ok: false, reason: 'missing query' };
  const r = retrieve(query, raw.snapshot ? { snapshot: raw.snapshot } : {});
  const ctx = formatContext(r);
  const mustInclude = raw.mustInclude || [];
  const missing = mustInclude.filter((t) => !ctx.includes(t));
  const expectIntent = raw.expectIntent || r.intent;
  if (expectIntent && r.intent !== expectIntent) {
    return { ok: false, reason: `intent ${r.intent} != ${expectIntent}`, ctx };
  }
  if (missing.length) return { ok: false, reason: `missing: ${missing.join(', ')}`, ctx };
  return { ok: true, intent: r.intent, ctx };
}

function main() {
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
    const check = validateCase(raw);
    if (!check.ok) {
      skipped += 1;
      console.log(`SKIP ${f}: ${check.reason}`);
      continue;
    }

    const newCase = {
      id: raw.id || `feedback-${path.basename(f, '.json')}`,
      query: raw.query,
      expectIntent: raw.expectIntent || check.intent,
      mustInclude: raw.mustInclude || ['Tools 层'],
      mustNotInclude: raw.mustNotInclude || ['当前资料未收录此项'],
      tags: raw.tags || ['user-feedback', '7072-sync'],
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
    fs.mkdirSync(PROCESSED, { recursive: true });
    fs.renameSync(fp, path.join(PROCESSED, f));
  }

  if (!opts.dryRun && imported > 0) {
    doc.meta = { ...(doc.meta || {}), lastFeedbackSync: new Date().toISOString().slice(0, 10), caseCount: doc.cases.length };
    saveGolden(doc);
  }

  console.log(`\nImported ${imported}, skipped ${skipped}${opts.dryRun ? ' (dry-run)' : ''}`);
}

main();
