#!/usr/bin/env node
/**
 * Build Advisor — Phase 2: L2 skill indexes (mage + universal).
 * Run: node scripts/build-advisor-index.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { skillToChunk } from './advisor-skill-chunk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_SKILLS = path.join(ROOT, 'advisor', 'skills');

const MAGE_JSON = path.join(ROOT, '职业页', '数据', '法师.json');
const ARTIFICER_JSON = path.join(ROOT, '职业页', '数据', '奇械师.json');
const UNIVERSAL_JSON = path.join(ROOT, '职业页', '数据', '通用天赋树.json');
const STATUS_JSON = path.join(ROOT, 'advisor', 'rules', 'status_conditions.json');
const RULES_SUMMARY = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function buildIndex({ sourceFile, sourceKey, className, outFile }) {
  const raw = loadJson(sourceFile);
  const statusNames = loadJson(STATUS_JSON).conditions.map((c) => c.name);
  const skills = (raw.skills || []).map((s) => skillToChunk(s, {
    source: sourceKey,
    className,
    statusNames,
  }));

  const byStyle = {};
  const byTier = {};
  const byType = {};
  for (const s of skills) {
    if (s.style) byStyle[s.style] = (byStyle[s.style] || 0) + 1;
    if (s.tier) byTier[s.tier] = (byTier[s.tier] || 0) + 1;
    byType[s.type] = (byType[s.type] || 0) + 1;
  }

  return {
    meta: {
      layer: 'L2',
      phase: '2',
      version: '1.0.0',
      source: `职业页/数据/${path.basename(sourceFile)}`,
      class: className,
      count: skills.length,
      generatedAt: new Date().toISOString().slice(0, 10),
      facets: { byStyle, byTier, byType },
    },
    skills,
    outFile,
  };
}

function patchRulesSummary(mageCount, universalCount, artificerCount = 0) {
  if (!fs.existsSync(RULES_SUMMARY)) return;
  const summary = loadJson(RULES_SUMMARY);
  const bullet = artificerCount
    ? `L2 技能索引：法师 ${mageCount} + 通用 ${universalCount} + 奇械师 ${artificerCount}`
    : `L2 技能索引：法师 ${mageCount} + 通用 ${universalCount}（与 skill_effects 零名差）`;
  summary.bullets = summary.bullets.filter((b) => !b.startsWith('L2 技能索引'));
  summary.bullets.push(bullet);
  summary.meta = { ...summary.meta, phase: '2' };
  writeJson(RULES_SUMMARY, summary);
}

function main() {
  const mage = buildIndex({
    sourceFile: MAGE_JSON,
    sourceKey: 'mage',
    className: '法师',
    outFile: path.join(OUT_SKILLS, 'mage_index.json'),
  });
  const universal = buildIndex({
    sourceFile: UNIVERSAL_JSON,
    sourceKey: 'universal',
    className: '通用天赋树',
    outFile: path.join(OUT_SKILLS, 'universal_index.json'),
  });
  const artificer = buildIndex({
    sourceFile: ARTIFICER_JSON,
    sourceKey: 'artificer',
    className: '奇械师',
    outFile: path.join(OUT_SKILLS, 'artificer_index.json'),
  });

  writeJson(mage.outFile, { meta: mage.meta, skills: mage.skills });
  writeJson(universal.outFile, { meta: universal.meta, skills: universal.skills });
  writeJson(artificer.outFile, { meta: artificer.meta, skills: artificer.skills });
  patchRulesSummary(mage.meta.count, universal.meta.count, artificer.meta.count);

  console.log('Phase 2 complete:');
  console.log(`  mage_index: ${mage.meta.count} skills`);
  console.log(`  universal_index: ${universal.meta.count} skills`);
  console.log(`  artificer_index: ${artificer.meta.count} skills`);
  console.log(`  mage styles: ${Object.keys(mage.meta.facets.byStyle).length}`);
  console.log(`  universal tiers: ${Object.keys(universal.meta.facets.byTier).length}`);
}

main();
