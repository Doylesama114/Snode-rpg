#!/usr/bin/env node
/**
 * Advisor 5.0 batch11 (7075) — feedback export → validate → sync dry-run smoke.
 * Run: node scripts/validate-advisor-feedback.mjs
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  ensureFeedbackDirs,
  FEEDBACK_DIR,
  INBOX_DIR,
  PENDING_DIR,
  PROCESSED_DIR,
  validateFeedbackCase,
  normalizeFeedbackPayload,
} from './advisor-feedback-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(FEEDBACK_DIR, 'fixtures');
const INBOX_FIXTURE = path.join(INBOX_DIR, 'queue-smoke.json');
const VALID_FIXTURE = path.join(FIXTURES, 'valid-pending-priest.json');

/** @type {{ id: string, run: () => boolean }[]} */
const CHECKS = [];

function pass(id, ok, detail = '') {
  CHECKS.push({ id, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${id}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function rmDirContents(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) rmDirContents(fp);
    else fs.unlinkSync(fp);
  }
}

function main() {
  console.log('=== validate-advisor-feedback (7075 batch11) ===\n');
  ensureFeedbackDirs();
  fs.mkdirSync(FIXTURES, { recursive: true });

  // 1) lib validate on fixture
  const fixtureRaw = JSON.parse(fs.readFileSync(VALID_FIXTURE, 'utf8'));
  const v1 = validateFeedbackCase(fixtureRaw);
  pass('fixture-validate-priest', v1.ok, v1.ok ? v1.intent : v1.reason);

  // 2) normalize infers mustInclude
  const norm = normalizeFeedbackPayload({
    query: '侍僧背景可以侍奉哪些神祇',
    description: '问句：侍僧背景可以侍奉哪些神祇\n期望：列出神祇',
  });
  pass(
    'infer-must-bg-deities',
    norm.expectIntent === 'background_detail'
      && norm.mustInclude.includes('Tools 层')
      && norm.mustInclude.some((t) => t.includes('侍僧') || t.includes('背景')),
    `intent=${norm.expectIntent} must=${norm.mustInclude.join('|')}`,
  );

  // 3) export inbox → pending (dry-run via lib, then real export script)
  if (!fs.existsSync(INBOX_FIXTURE)) {
    pass('inbox-fixture-exists', false, 'missing queue-smoke.json');
  } else {
    const exportScript = path.join(__dirname, 'advisor-feedback-export.mjs');
    rmDirContents(PENDING_DIR);
    const r = spawnSync(process.execPath, [exportScript, '--from', INBOX_FIXTURE], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const pendingFiles = fs.existsSync(PENDING_DIR)
      ? fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith('.json'))
      : [];
    pass('export-inbox-to-pending', r.status === 0 && pendingFiles.length >= 1, `${pendingFiles.length} file(s)`);

    // 4) each pending validates
    let allPendingOk = pendingFiles.length > 0;
    for (const f of pendingFiles) {
      const raw = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
      const chk = validateFeedbackCase(raw);
      if (!chk.ok) {
        allPendingOk = false;
        console.log(`  pending fail ${f}: ${chk.reason}`);
      }
    }
    pass('pending-all-validate', allPendingOk);

    // 5) sync dry-run
    const syncScript = path.join(__dirname, 'advisor-feedback-sync.mjs');
    const s = spawnSync(process.execPath, [syncScript, '--dry-run', '--import-dir', PENDING_DIR], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    pass('sync-dry-run', s.status === 0 && /Imported 0, skipped 0/.test(s.stdout || ''), (s.stdout || '').trim().split('\n').pop());
  }

  // 6) description parser
  const parsed = normalizeFeedbackPayload({
    description: '问句：牧师创建角色时起始装备有哪些\n必含：Tools 层,起始装备\n意图：starting_gear_lookup',
  });
  pass(
    'parse-description-fields',
    parsed.query.includes('牧师') && parsed.mustInclude.includes('起始装备') && parsed.expectIntent === 'starting_gear_lookup',
  );

  const failed = CHECKS.filter((c) => !c.ok);
  console.log(`\n7075 batch11 feedback: ${CHECKS.length - failed.length}/${CHECKS.length} OK`);
  if (failed.length) {
    console.error('Failed:', failed.map((f) => f.id).join(', '));
    process.exit(1);
  }
}

main();
