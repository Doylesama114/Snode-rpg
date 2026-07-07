#!/usr/bin/env node
/**
 * Build Advisor — Phase 3: L3 advancements + L4 feats.
 * Run: node scripts/build-advisor-phase3.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advancementToChunk } from './advisor-advancement-chunk.mjs';
import { featToChunk } from './advisor-feat-chunk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const MAGE_ADV_JSON = path.join(ROOT, '职业页', '数据', '法师·进阶.json');
const UNIVERSAL_ADV_JSON = path.join(ROOT, '职业页', '数据', '通用·进阶.json');
const FEATS_JSON = path.join(ROOT, '职业页', '数据', '特殊专长.json');
const LEVELING_JSON = path.join(ROOT, 'advisor', 'rules', 'leveling.json');
const OUT_ADV = path.join(ROOT, 'advisor', 'advancements.json');
const OUT_FEATS = path.join(ROOT, 'advisor', 'feats.json');
const RULES_SUMMARY = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function mergeAdvancements(mageRaw, universalRaw) {
  const universalNames = new Set((universalRaw.advancements || []).map((a) => a.name));
  const byId = new Map();

  for (const adv of mageRaw.advancements || []) {
    const scope = universalNames.has(adv.name) ? 'universal' : 'mage-only';
    byId.set(adv.id, advancementToChunk(adv, scope));
  }

  for (const adv of universalRaw.advancements || []) {
    const dup = (mageRaw.advancements || []).find((a) => a.name === adv.name);
    if (dup) continue;
    byId.set(adv.id, advancementToChunk(adv, 'universal'));
  }

  const advancements = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const mageOnly = advancements.filter((a) => a.scope === 'mage-only').length;
  const universal = advancements.filter((a) => a.scope === 'universal').length;

  return {
    meta: {
      layer: 'L3',
      phase: '3',
      version: '1.0.0',
      sources: [
        '职业页/数据/法师·进阶.json',
        '职业页/数据/通用·进阶.json',
      ],
      count: advancements.length,
      mageOnlyCount: mageOnly,
      universalCount: universal,
      dedupeNote: '与通用·进阶同名的 10 条以法师·进阶 id 保留，scope=universal',
      confidenceNote: 'MVP 全部为 metadata_only（进阶 HTML 技能树未入库）',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    advancements,
  };
}

function buildFeats(featsRaw, leveling) {
  const feats = featsRaw.map(featToChunk);
  const byRelevance = { high: 0, medium: 0, low: 0, none: 0 };
  for (const f of feats) byRelevance[f.mageRelevance] += 1;

  return {
    meta: {
      layer: 'L4',
      phase: '3',
      version: '1.0.0',
      source: '职业页/数据/特殊专长.json',
      count: feats.length,
      featMilestones: leveling.featMilestones || [],
      advancementMilestones: leveling.advancementMilestones || [],
      mageRelevanceCounts: byRelevance,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    feats,
  };
}

function patchRulesSummary(advCount, featCount) {
  if (!fs.existsSync(RULES_SUMMARY)) return;
  const summary = loadJson(RULES_SUMMARY);
  summary.bullets = summary.bullets.filter(
    (b) => !b.startsWith('L3 进阶库') && !b.startsWith('L4 特殊专长'),
  );
  summary.bullets.push(`L3 进阶库：${advCount} 条（含 universal 去重合并）`);
  summary.bullets.push(`L4 特殊专长：${featCount} 条；专长窗口 L4/L8/L13`);
  summary.meta = { ...summary.meta, phase: '3' };
  writeJson(RULES_SUMMARY, summary);
}

function main() {
  const mageRaw = loadJson(MAGE_ADV_JSON);
  const universalRaw = loadJson(UNIVERSAL_ADV_JSON);
  const featsRaw = loadJson(FEATS_JSON);
  const leveling = loadJson(LEVELING_JSON);

  const advancementsDoc = mergeAdvancements(mageRaw, universalRaw);
  const featsDoc = buildFeats(featsRaw, leveling);

  writeJson(OUT_ADV, advancementsDoc);
  writeJson(OUT_FEATS, featsDoc);
  patchRulesSummary(advancementsDoc.meta.count, featsDoc.meta.count);

  console.log('Phase 3 complete:');
  console.log(`  advancements: ${advancementsDoc.meta.count} (mage-only ${advancementsDoc.meta.mageOnlyCount}, universal ${advancementsDoc.meta.universalCount})`);
  console.log(`  feats: ${featsDoc.meta.count}`);
  console.log(`  mage-relevant feats (high): ${featsDoc.meta.mageRelevanceCounts.high}`);
}

main();
