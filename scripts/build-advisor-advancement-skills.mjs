/**
 * Phase 5 batch 8 (7035) — 批量 documented 进阶技能（advancement_details.js）
 * Run: node scripts/build-advisor-advancement-skills.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAdvancementSkillsIndex } from './advisor-advancement-extract.mjs';
import { inferAdvancementTags } from './advisor-advancement-chunk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SKILLS_OUT = path.join(ROOT, 'advisor', 'advancement_skills.json');
const ADV_PATH = path.join(ROOT, 'advisor', 'advancements.json');
const DATA_PATH = path.join(ROOT, '职业页', 'advancement_data.json');
const SUMMARY_PATH = path.join(ROOT, 'advisor', 'rules', 'rules_summary.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function parseSourceClasses(row) {
  const fromSource = String(row.source || '')
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fromClass = row.class ? [String(row.class).trim()] : [];
  return [...new Set([...fromSource, ...fromClass])];
}

function loadAdvancementDataByName() {
  const rows = readJson(DATA_PATH);
  const byName = {};
  for (const row of rows) {
    if (!row.name) continue;
    if (!byName[row.name]) {
      byName[row.name] = { ...row, sourceClasses: parseSourceClasses(row) };
      continue;
    }
    const existing = byName[row.name];
    existing.sourceClasses = [...new Set([...(existing.sourceClasses || []), ...parseSourceClasses(row)])];
    if (!existing.conditions?.length && row.conditions?.length) existing.conditions = row.conditions;
    if (!Object.keys(existing.attrs || {}).length && row.attrs) existing.attrs = row.attrs;
  }
  return byName;
}

function supplementalChunk(name, row) {
  const sourceClasses = row?.sourceClasses || [];
  const { inferenceTag, inferenceBlurb } = inferAdvancementTags({
    name,
    conditions: row?.conditions || [],
  });
  const chunk = {
    id: `adv-panel-${name}`,
    name,
    scope: 'class-advancement',
    sourceClasses,
    attrsRequired: row?.attrs || {},
    markCost: [],
    conditions: row?.conditions || [],
    inferenceTag,
    inferenceBlurb,
    confidence: 'documented',
    mageEligible: sourceClasses.some((c) =>
      ['法师', '牧师', '魔契师', '术士', '奇械师', '德鲁伊', '吟游诗人', '全职业'].includes(c),
    ),
    searchText: '',
  };
  chunk.searchText = [
    chunk.name,
    chunk.scope,
    ...sourceClasses,
    ...Object.entries(chunk.attrsRequired).map(([k, v]) => `${k}${v}`),
    ...(chunk.conditions || []),
    ...(chunk.inferenceTag || []),
    chunk.inferenceBlurb,
  ].join(' ');
  return chunk;
}

function patchAdvancementsCatalog(byName, dataByName) {
  const advDoc = readJson(ADV_PATH);
  const existing = new Map((advDoc.advancements || []).map((a) => [a.name, a]));
  let added = 0;
  let patched = 0;

  for (const name of Object.keys(byName)) {
    if (existing.has(name)) {
      const row = existing.get(name);
      if (row.confidence !== 'documented') {
        row.confidence = 'documented';
        patched++;
      }
      row.searchText = `${row.searchText || row.name} documented`;
      continue;
    }
    const meta = dataByName[name];
    if (!meta) {
      console.warn('WARN: no advancement_data row for documented', name);
      continue;
    }
    existing.set(name, supplementalChunk(name, meta));
    added++;
  }

  const advancements = [...existing.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const documentedNames = Object.keys(byName);
  advDoc.meta = {
    ...advDoc.meta,
    phase: '5-batch8',
    documentedCount: documentedNames.length,
    catalogCount: advancements.length,
    confidenceNote: `${documentedNames.length} 条 documented（advancement_details.js）；其余 metadata_only`,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
  advDoc.advancements = advancements;
  writeJson(ADV_PATH, advDoc);
  return { added, patched, catalogCount: advancements.length };
}

function patchRulesSummary(documentedCount, catalogCount) {
  if (!fs.existsSync(SUMMARY_PATH)) return;
  const summary = readJson(SUMMARY_PATH);
  summary.bullets = summary.bullets.filter((b) => !b.startsWith('L3A 进阶技能'));
  summary.bullets.push(
    `L3A 进阶技能：advancement_skills.json（${documentedCount}/${catalogCount} 条 documented）`,
  );
  summary.meta = { ...summary.meta, phase: '5-batch8' };
  writeJson(SUMMARY_PATH, summary);
}

export function buildAdvancementSkills(options = {}) {
  const root = options.root || ROOT;
  const byName = buildAdvancementSkillsIndex(null);
  const documented = Object.keys(byName);
  const dataByName = loadAdvancementDataByName();

  const doc = {
    meta: {
      layer: 'L3A',
      phase: '5-batch8',
      source: '职业页/advancement_details.js',
      documentedCount: documented.length,
      catalogSource: 'advisor/advancements.json + 职业页/advancement_data.json',
      generatedAt: new Date().toISOString().slice(0, 10),
      note: '收录 advancement_details.js 全部条目；未在 details 中的进阶仍为 metadata_only',
    },
    byName,
  };

  writeJson(path.join(root, 'advisor', 'advancement_skills.json'), doc);
  const catalogStats = patchAdvancementsCatalog(byName, dataByName);
  patchRulesSummary(documented.length, catalogStats.catalogCount);

  return { documented: documented.length, names: documented, ...catalogStats };
}

function main() {
  const stats = buildAdvancementSkills();
  console.log('Advancement skills build complete:');
  console.log(`  documented: ${stats.documented}`);
  console.log(`  catalog added: ${stats.added}, patched: ${stats.patched}, total: ${stats.catalogCount}`);
  if (stats.names?.length) console.log(`  ${stats.names.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
