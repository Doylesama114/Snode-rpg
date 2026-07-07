#!/usr/bin/env node
/**
 * Build Advisor Phase 8B: A-tier advancement skills index.
 * Run: node scripts/build-advisor-phase8b.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAdvancementSkillsIndex } from './advisor-advancement-extract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'advisor', 'advancement_skills.json');
const ADV_PATH = path.join(ROOT, 'advisor', 'advancements.json');
const SUMMARY_PATH = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

const byName = buildAdvancementSkillsIndex(null);
const documented = Object.keys(byName);

const doc = {
  meta: {
    layer: 'L3A',
    phase: '8B',
    source: '职业页/advancement_details.js',
    documentedCount: documented.length,
    mageEligibleCount: null,
    generatedAt: new Date().toISOString().slice(0, 10),
    note: '未收录的进阶仍为 metadata_only；随 advancement_details.js 更新后重建',
  },
  byName,
};

fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
summary.bullets = summary.bullets.filter((b) => !b.startsWith('L3A 进阶技能'));
summary.bullets.push(`L3A 进阶技能：advancement_skills.json（${documented.length} 条 documented）`);
summary.meta = { ...summary.meta, phase: '8B' };
fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(`Phase 8B build: ${documented.length} documented mage advancements → ${OUT}`);
if (documented.length) {
  console.log(`  ${documented.join(', ')}`);
}
