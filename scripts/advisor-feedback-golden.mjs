#!/usr/bin/env node
/**
 * Advisor 5.0 batch6 — append user feedback as golden regression case.
 *
 * Usage:
 *   node scripts/advisor-feedback-golden.mjs --id my-case --query "问句" --must "关键词1" --must "关键词2"
 *   node scripts/advisor-feedback-golden.mjs --from-json advisor/feedback/pending.json
 *
 * Also reads localStorage export key `_snowd_advisor_feedback` if passed via --from-json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GOLDEN_PATH = path.join(ROOT, 'advisor', 'golden', 'conversations.json');
const FEEDBACK_DIR = path.join(ROOT, 'advisor', 'feedback');

function parseArgs(argv) {
  const out = { mustInclude: [], mustNotInclude: [], tags: ['user-feedback'] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--id') out.id = argv[++i];
    else if (a === '--query') out.query = argv[++i];
    else if (a === '--intent') out.expectIntent = argv[++i];
    else if (a === '--must') out.mustInclude.push(argv[++i]);
    else if (a === '--must-not') out.mustNotInclude.push(argv[++i]);
    else if (a === '--from-json') out.fromJson = argv[++i];
    else if (a === '--import-dir') out.importDir = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function slugId(query) {
  const base = String(query || 'feedback').slice(0, 24).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '-');
  return `feedback-${base}-${Date.now().toString(36)}`;
}

function loadGolden() {
  return JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
}

function saveGolden(doc) {
  fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function buildCase(opts) {
  const query = String(opts.query || '').trim();
  if (!query) throw new Error('--query required');
  const r = retrieve(query, opts.snapshot ? { snapshot: opts.snapshot } : {});
  const ctx = formatContext(r);
  const mustInclude = [...(opts.mustInclude || [])];
  if (mustInclude.length === 0 && ctx.includes('Tools 层')) {
    mustInclude.push('Tools 层');
  }
  return {
    id: opts.id || slugId(query),
    query,
    expectIntent: opts.expectIntent || r.intent,
    mustInclude,
    mustNotInclude: opts.mustNotInclude || ['当前资料未收录此项'],
    tags: opts.tags || ['user-feedback'],
    source: opts.source || 'advisor-feedback-golden.mjs',
    addedAt: new Date().toISOString().slice(0, 10),
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.importDir) {
    const dir = path.isAbsolute(opts.importDir) ? opts.importDir : path.join(ROOT, opts.importDir);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    let added = 0;
    for (const f of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const payload = { ...opts, ...raw, dryRun: opts.dryRun };
      const newCase = buildCase(payload);
      if (opts.dryRun) {
        console.log(JSON.stringify(newCase, null, 2));
        continue;
      }
      const doc = loadGolden();
      if (doc.cases.some((c) => c.id === newCase.id)) continue;
      doc.cases.push(newCase);
      saveGolden(doc);
      added += 1;
    }
    console.log(`Imported ${added} case(s) from ${dir}`);
    return;
  }

  let payload = opts;

  if (opts.fromJson) {
    const fp = path.isAbsolute(opts.fromJson) ? opts.fromJson : path.join(ROOT, opts.fromJson);
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    payload = {
      ...opts,
      ...(Array.isArray(raw) ? raw[0] : raw),
      mustInclude: [...(opts.mustInclude || []), ...(raw.mustInclude || [])],
    };
  }

  const newCase = buildCase(payload);
  const doc = loadGolden();
  if (doc.cases.some((c) => c.id === newCase.id)) {
    console.error(`Case id already exists: ${newCase.id}`);
    process.exit(1);
  }

  console.log('New golden case preview:');
  console.log(JSON.stringify(newCase, null, 2));

  if (opts.dryRun) {
    console.log('\n(dry-run — not written)');
    return;
  }

  doc.cases.push(newCase);
  doc.meta = {
    ...(doc.meta || {}),
    lastFeedbackAppend: newCase.addedAt,
    caseCount: doc.cases.length,
  };
  saveGolden(doc);
  fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(FEEDBACK_DIR, `${newCase.id}.json`),
    `${JSON.stringify(newCase, null, 2)}\n`,
    'utf8',
  );
  console.log(`\nAppended to ${GOLDEN_PATH} (${doc.cases.length} cases)`);
}

main();
