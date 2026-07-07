#!/usr/bin/env node
/**
 * Build Advisor — Phase 4: L5 mage tips library.
 * Run: node scripts/build-advisor-phase4.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAGE_TIPS } from './mage-tips.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MAGE_INDEX = path.join(ROOT, 'advisor', 'skills', 'mage_index.json');
const UNIVERSAL_INDEX = path.join(ROOT, 'advisor', 'skills', 'universal_index.json');
const OUT = path.join(ROOT, 'advisor', 'combos', 'mage_tips.json');
const LEGACY_OUT = path.join(ROOT, 'advisor', 'combos', 'mage_starter.json');
const RULES_SUMMARY = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildSkillLookup(mageIndex, universalIndex) {
  const lookup = new Map();
  for (const s of mageIndex.skills) lookup.set(s.name, { source: 'mage', id: s.id });
  for (const s of universalIndex.skills) lookup.set(s.name, { source: 'universal', id: s.id });
  return lookup;
}

function validateTipSkills(tip, lookup) {
  const missing = (tip.relatedSkills || []).filter((name) => !lookup.has(name));
  if (missing.length) {
    throw new Error(`Tip ${tip.id} 含未知技能名: ${missing.join(', ')}`);
  }
}

function enrichTip(tip, lookup) {
  const skillRefs = (tip.relatedSkills || []).map((name) => ({
    name,
    ...lookup.get(name),
  }));
  const searchText = [
    tip.title,
    tip.kind,
    tip.style,
    tip.confidence,
    tip.summary,
    tip.detail,
    ...(tip.tags || []),
    ...(tip.relatedSkills || []),
    skillRefs.map((r) => r.id).join(' '),
  ].filter(Boolean).join(' ');

  return { ...tip, skillRefs, searchText };
}

function patchRulesSummary(tipCount, userCount, supplementCount) {
  if (!fs.existsSync(RULES_SUMMARY)) return;
  const summary = loadJson(RULES_SUMMARY);
  summary.bullets = summary.bullets.filter(
    (b) => !b.startsWith('L5 Combo') && !b.startsWith('L5 法师小贴士'),
  );
  summary.bullets.push(
    `L5 法师小贴士：mage_tips ${tipCount} 条（user ${userCount} + supplement ${supplementCount}）`,
  );
  summary.meta = { ...summary.meta, phase: '4' };
  writeJson(RULES_SUMMARY, summary);
}

function main() {
  const mageIndex = loadJson(MAGE_INDEX);
  const universalIndex = loadJson(UNIVERSAL_INDEX);
  const lookup = buildSkillLookup(mageIndex, universalIndex);

  for (const tip of MAGE_TIPS) {
    validateTipSkills(tip, lookup);
  }

  const tips = MAGE_TIPS.map((t) => enrichTip(t, lookup));
  const userProvided = tips.filter((t) => t.confidence === 'user_provided').length;
  const supplement = tips.filter((t) => t.confidence === 'supplement').length;

  const byKind = {};
  for (const t of tips) {
    byKind[t.kind] = (byKind[t.kind] || 0) + 1;
  }

  const doc = {
    meta: {
      layer: 'L5',
      phase: '4',
      version: '2.0.0',
      type: 'tips',
      targetClass: '法师',
      count: tips.length,
      userProvidedCount: userProvided,
      supplementCount: supplement,
      byKind,
      note: '非战斗 combo；人工审核的战斗规则、战术与八大学派风格建议，供顾问检索引用',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    tips,
  };

  writeJson(OUT, doc);
  if (fs.existsSync(LEGACY_OUT)) fs.unlinkSync(LEGACY_OUT);
  patchRulesSummary(tips.length, userProvided, supplement);

  console.log('Phase 4 complete:');
  console.log(`  mage_tips: ${tips.length} (user ${userProvided}, supplement ${supplement})`);
  console.log(`  kinds: ${JSON.stringify(byKind)}`);
}

main();
