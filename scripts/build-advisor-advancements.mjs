#!/usr/bin/env node
/**
 * Rebuild advisor/advancements.json from all 职业页/数据/*·进阶.json (post docx sync).
 * Run: node scripts/build-advisor-advancements.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { advancementToChunk, inferAdvancementTags } from './advisor-advancement-chunk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, '职业页', '数据');
const OUT_ADV = path.join(ROOT, 'advisor', 'advancements.json');
const RULES_SUMMARY = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

const BASE_CLASSES = [
  '蛮斗士', '战士', '法师', '猎人', '牧师', '圣骑士', '游荡者', '德鲁伊',
  '萨满祭司', '术士', '武僧', '吟游诗人', '魔契师', '奇械师',
];

const CASTER_CLASSES = new Set([
  '法师', '牧师', '魔契师', '术士', '奇械师', '德鲁伊', '吟游诗人', '全职业',
]);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function mergeMarkCost(a, b) {
  if (!b?.length) return a || [];
  if (!a?.length) return b;
  const score = (arr) => arr.reduce((s, c) => s + (c.amount || 0), 0);
  return score(b) >= score(a) ? b : a;
}

function mergeAttrs(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    if (!(k in out) || out[k] === 'X') out[k] = v;
  }
  return out;
}

function mergeEntry(existing, adv, scope) {
  const sourceClasses = [...new Set([
    ...(existing.sourceClasses || []),
    ...(adv.source_classes || []),
  ])];
  existing.sourceClasses = sourceClasses;
  existing.scope = scope;
  existing.attrsRequired = mergeAttrs(existing.attrsRequired, adv.attrs);
  existing.markCost = mergeMarkCost(existing.markCost, (adv.cost || []).map((c) => ({
    name: c.name,
    amount: c.amount,
    color: c.color || null,
  })));
  const condSet = new Set([...(existing.conditions || []), ...(adv.conditions || [])]);
  existing.conditions = [...condSet];
  if (adv.branch) {
    existing.branches = [...new Set([...(existing.branches || []), adv.branch])];
  }
  if (adv.branch_full) {
    existing.branchFulls = [...new Set([...(existing.branchFulls || []), adv.branch_full])];
  }
  existing.mageEligible = sourceClasses.some((c) => CASTER_CLASSES.has(c));
  const { inferenceTag, inferenceBlurb } = inferAdvancementTags({
    name: existing.name,
    conditions: existing.conditions,
  });
  existing.inferenceTag = inferenceTag;
  existing.inferenceBlurb = inferenceBlurb;
  existing.searchText = [
    existing.name,
    existing.scope,
    ...sourceClasses,
    ...(existing.branches || []),
    ...(existing.branchFulls || []),
    ...Object.entries(existing.attrsRequired).map(([k, v]) => `${k}${v}`),
    ...(existing.markCost || []).map((m) => `${m.name}${m.amount}`),
    ...(existing.conditions || []),
    ...(existing.inferenceTag || []),
    existing.inferenceBlurb,
  ].join(' ');
  return existing;
}

function scopeFor(adv, universalNames) {
  if (universalNames.has(adv.name)) return 'universal';
  const src = adv.source_classes || [];
  if (src.includes('全职业')) return 'universal';
  if (src.includes('法师') && src.length === 1) return 'mage-only';
  if (src.includes('法师') && src.every((c) => ['法师', '牧师', '魔契师', '术士'].includes(c))) {
    return 'mage-only';
  }
  return 'class-advancement';
}

/**
 * @param {{ root?: string, write?: boolean }} [options]
 */
export function buildAdvancementsCatalog(options = {}) {
  const root = options.root || ROOT;
  const dataDir = path.join(root, '职业页', '数据');
  const universalPath = path.join(dataDir, '通用·进阶.json');
  const universalRaw = readJson(universalPath);
  const universalNames = new Set((universalRaw.advancements || []).map((a) => a.name));

  const byName = new Map();
  let sourceRows = 0;

  function ingest(adv, forcedScope) {
    sourceRows += 1;
    const scope = forcedScope || scopeFor(adv, universalNames);
    const existing = byName.get(adv.name);
    if (!existing) {
      const chunk = advancementToChunk(adv, scope === 'universal' ? 'universal' : 'mage-only');
      if (scope === 'class-advancement') chunk.scope = 'class-advancement';
      if (scope === 'universal') chunk.scope = 'universal';
      chunk.mageEligible = (adv.source_classes || []).some((c) => CASTER_CLASSES.has(c));
      byName.set(adv.name, chunk);
      return;
    }
    mergeEntry(existing, adv, scope);
  }

  for (const adv of universalRaw.advancements || []) {
    ingest(adv, 'universal');
  }

  for (const cls of BASE_CLASSES) {
    const p = path.join(dataDir, `${cls}·进阶.json`);
    if (!fs.existsSync(p)) continue;
    const raw = readJson(p);
    for (const adv of raw.advancements || []) {
      if (universalNames.has(adv.name)) continue;
      ingest(adv);
    }
  }

  const advancements = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const scopeCounts = {};
  for (const a of advancements) {
    scopeCounts[a.scope] = (scopeCounts[a.scope] || 0) + 1;
  }

  const doc = {
    meta: {
      layer: 'L3',
      phase: 'advancement-docx-sync',
      version: '2.0.0',
      sources: [
        '职业页/数据/通用·进阶.json',
        ...BASE_CLASSES.map((c) => `职业页/数据/${c}·进阶.json`),
      ],
      sourceRows,
      count: advancements.length,
      catalogCount: advancements.length,
      scopeCounts,
      universalNameCount: universalNames.size,
      dedupeNote: '按进阶名去重；多职业同名合并 sourceClasses；牧师/魔契师写入 branches[]',
      confidenceNote: '默认 metadata_only；documented 由 build-advisor-advancement-skills.mjs 标注',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    advancements,
  };

  if (options.write !== false) {
    writeJson(path.join(root, 'advisor', 'advancements.json'), doc);
    patchRulesSummary(root, doc.meta.count);
  }

  return doc;
}

function patchRulesSummary(root, count) {
  const summaryPath = path.join(root, 'advisor', 'rules', 'rules_summary.json');
  if (!fs.existsSync(summaryPath)) return;
  const summary = readJson(summaryPath);
  summary.bullets = summary.bullets.filter((b) => !b.startsWith('L3 进阶库'));
  summary.bullets.push(`L3 进阶库：${count} 条（全职业·进阶 docx 同步后去重合并）`);
  writeJson(summaryPath, summary);
}

function main() {
  const doc = buildAdvancementsCatalog();
  console.log('Advancements catalog build complete:');
  console.log(`  unique names: ${doc.meta.count} (from ${doc.meta.sourceRows} class rows)`);
  console.log(`  scopes: ${JSON.stringify(doc.meta.scopeCounts)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
