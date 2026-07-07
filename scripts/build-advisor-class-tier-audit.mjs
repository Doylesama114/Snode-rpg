/**
 * Phase 5 batch 10 (7037) — 生成 class_tier_audit.json
 * Run: node scripts/build-advisor-class-tier-audit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditAllClasses } from './advisor-class-tier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'advisor', 'chargen', 'class_tier_audit.json');
const SUMMARY = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

function main() {
  const doc = auditAllClasses();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

  if (fs.existsSync(SUMMARY)) {
    const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
    summary.bullets = summary.bullets.filter((b) => !b.startsWith('职业档位 audit'));
    summary.bullets.push(
      `职业档位 audit：full ${doc.meta.fullReady}/1 ready；partial ${doc.meta.partialReady}/13 ready（class_tier_audit.json）`,
    );
    summary.meta = { ...summary.meta, phase: '5-batch10' };
    fs.writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  console.log('Class tier audit:');
  console.log(`  full ready: ${doc.meta.fullReady}/1`);
  console.log(`  partial ready: ${doc.meta.partialReady}/13`);
  for (const a of doc.audits) {
    const mark = a.ready ? 'OK' : 'GAP';
    console.log(`  [${mark}] ${a.className} ${a.passCount}/${a.total}`);
  }
  console.log(`→ ${OUT}`);
}

main();
