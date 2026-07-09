#!/usr/bin/env node
/**
 * Advisor 5.0 batch20 (7084) — merge Tier-A scan candidates into combat_skill_modifiers.json.
 * Run: node scripts/build-advisor-combat-modifiers-from-scan.mjs [--dry-run]
 *
 * Advisor 5.0 batch23 (7087) — merge Tier-B scan candidates into combat_skill_modifiers.json.
 * Skips were: 荒野医疗/独行伙伴/奥术矩阵 — now structured via appliesTo (7086).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanCombatModifierCandidates } from './advisor-combat-modifiers-scan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOD_PATH = path.join(__dirname, '..', 'advisor', 'rules', 'combat_skill_modifiers.json');

const SKIP_BULK = new Set([
  '荒野医疗',
  '独行伙伴',
  '奥术矩阵屏障（图纸）',
  '皮匠工具大师',
  '凶蛮无羁',
  '混乱箭',
  '干扰信标',
  '讨债者',
  '酸液飞溅',
  '鬼魅攻击',
  '高压水刃',
  '镜像水域',
  '旋风斩',
]);

/**
 * @param {object} row scan Tier-A row
 */
export function tierARowToModifier(row) {
  const entry = {
    className: row.className,
    note: (row.summarySnippet || '').slice(0, 96),
    source: `${row.indexFile} · ${row.name} summary`,
  };
  const hitMs = {};
  for (const m of row.hit?.milestones || []) hitMs[`L${m.level}`] = m.value;
  if (row.hit?.flats?.length || Object.keys(hitMs).length) {
    entry.hitModifier = {
      base: row.hit?.flats?.[0]?.value ?? 0,
      ...(Object.keys(hitMs).length ? { milestones: hitMs } : {}),
    };
    if (/远程|弓|弩/.test(row.summarySnippet || '')) entry.requiresRanged = true;
  }
  if (row.ac?.flats?.length) {
    entry.acModifier = { base: row.ac.flats[0].value };
  }
  return entry;
}

/**
 * @param {object} row scan Tier-B row
 */
export function tierBRowToModifier(row) {
  const entry = {
    className: row.className,
    note: (row.summarySnippet || '').slice(0, 96),
    source: `${row.indexFile} · ${row.name} summary`,
  };
  const hitCond = row.hit?.conditionals?.[0];
  const acCond = row.ac?.conditionals?.[0];
  const hitFlat = row.hit?.flats?.[0]?.value;
  const acFlat = row.ac?.flats?.[0]?.value;

  if (hitCond) {
    entry.hitModifier = { base: 0 };
    entry.conditionalHitModifier = {
      queryHint: inferQueryHint(row.summarySnippet, hitCond.snippet),
      value: hitCond.value,
    };
  } else if (hitFlat != null) {
    entry.hitModifier = { base: hitFlat };
    if (/远程|弓|弩|法术/.test(row.summarySnippet || '')) entry.requiresRanged = true;
  }

  if (acCond) {
    entry.acModifier = { base: 0 };
    entry.conditionalAcModifier = {
      queryHint: inferQueryHint(row.summarySnippet, acCond.snippet),
      value: acCond.value,
    };
  } else if (acFlat != null) {
    entry.acModifier = { base: acFlat };
  }

  if (/目标|敌方|忽视.+防御等级/.test(row.summarySnippet || '')) {
    const debuffM = (row.summarySnippet || '').match(/忽视(?:敌方角色的)?(\d+)点防御等级/);
    if (debuffM) {
      entry.targetAcModifier = { base: 0, milestones: { L12: -Number(debuffM[1]) } };
    }
  }

  return entry;
}

/**
 * @param {string} summary
 * @param {string} snippet
 */
function inferQueryHint(summary, snippet) {
  const text = `${summary} ${snippet}`;
  if (/皮甲|兽皮/.test(text)) return '皮甲';
  if (/额外花费.*主要动作/.test(text)) return '额外花费主要动作';
  if (/中毒/.test(text)) return '中毒';
  if (/阵营相反/.test(text)) return '阵营相反';
  if (/醉酒/.test(text)) return '醉酒';
  if (/邪恶阵营/.test(text)) return '邪恶阵营';
  if (/山地|洞穴/.test(text)) return '山地';
  return snippet?.slice(0, 8) || '条件满足';
}

/**
 * @param {{ dryRun?: boolean }} [opts]
 */
export function mergeTierBFromScan(opts = {}) {
  const doc = JSON.parse(fs.readFileSync(MOD_PATH, 'utf8'));
  const skills = { ...(doc.skills || {}) };
  const report = scanCombatModifierCandidates();
  const added = [];
  const skipped = [];

  for (const row of report.tiers.B) {
    if (skills[row.name]?.className === row.className) continue;
    if (SKIP_BULK.has(row.name)) {
      skipped.push(row.name);
      continue;
    }
    const entry = tierBRowToModifier(row);
    if (!entry.hitModifier && !entry.acModifier && !entry.targetAcModifier) {
      skipped.push(row.name);
      continue;
    }
    skills[row.name] = entry;
    added.push(row.name);
  }

  if (!opts.dryRun && added.length) {
    doc.skills = skills;
    doc.meta = {
      ...doc.meta,
      bulkMergedAt: new Date().toISOString().slice(0, 10),
      bulkMergedFrom: 'build-advisor-combat-modifiers-from-scan.mjs#tierB',
    };
    fs.writeFileSync(MOD_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }

  return { added, skipped, total: Object.keys(skills).length };
}

/**
 * @param {{ dryRun?: boolean }} [opts]
 */
export function mergeTierAFromScan(opts = {}) {
  const doc = JSON.parse(fs.readFileSync(MOD_PATH, 'utf8'));
  const skills = { ...(doc.skills || {}) };
  const report = scanCombatModifierCandidates();
  const added = [];
  const skipped = [];

  for (const row of report.tiers.A) {
    if (skills[row.name]) continue;
    if (SKIP_BULK.has(row.name)) {
      skipped.push(row.name);
      continue;
    }
    const entry = tierARowToModifier(row);
    if (!entry.hitModifier && !entry.acModifier) {
      skipped.push(row.name);
      continue;
    }
    skills[row.name] = entry;
    added.push(row.name);
  }

  if (!opts.dryRun && added.length) {
    doc.skills = skills;
    doc.meta = {
      ...doc.meta,
      bulkMergedAt: new Date().toISOString().slice(0, 10),
      bulkMergedFrom: 'build-advisor-combat-modifiers-from-scan.mjs',
    };
    fs.writeFileSync(MOD_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  }

  return { added, skipped, total: Object.keys(skills).length };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tierB = process.argv.includes('--tier-b');
  console.log(`=== build-advisor-combat-modifiers-from-scan (7087) ${dryRun ? 'DRY-RUN' : ''}${tierB ? ' tier-B' : ' tier-A'} ===\n`);
  const { added, skipped, total } = tierB ? mergeTierBFromScan({ dryRun }) : mergeTierAFromScan({ dryRun });
  console.log(`Would add / added: ${added.length} → ${added.join('、') || '(none)'}`);
  console.log(`Skipped: ${skipped.join('、') || '(none)'}`);
  console.log(`Corpus size: ${total} skills`);
  console.log(dryRun ? '\nOK (dry-run)' : '\nOK');
}

if (process.argv[1]?.endsWith('build-advisor-combat-modifiers-from-scan.mjs')) {
  main();
}
