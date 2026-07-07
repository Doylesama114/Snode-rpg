#!/usr/bin/env node
/**
 * Build Advisor — Phase 2: entity cards from game sources + schema validation.
 * Run: node scripts/build-advisor-entities.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPhase2Sources,
  toRaceCard,
  toBackgroundCard,
  toClassCard,
} from './advisor-entity-sources.mjs';
import { validateEntityBundle } from './validate-advisor-entities.mjs';
import { buildIndexEntries } from './build-advisor-entities-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'advisor', 'entities');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function syncChargenRaces(races) {
  const p = path.join(ROOT, 'advisor', 'chargen', 'races.json');
  const existing = fs.existsSync(p) ? readJson(p) : { meta: {} };
  writeJson(p, {
    meta: {
      ...existing.meta,
      phase: '2',
      source: '职业页/数据/races_data.js (via build-advisor-entities.mjs)',
      count: races.length,
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    races: races.map((r) => ({
      name: r.name,
      description: r.description,
      attrBonus: r.attrBonus,
      hpBonus: r.hpBonus,
      moveSpeed: r.moveSpeed,
      size: r.size,
      lifespan: r.lifespan,
      traits: r.traits,
      intBonus: r.intBonus,
    })),
  });
}

function main() {
  const manualAliases = readJson(path.join(OUT, 'aliases.manual.json'));
  const loaded = loadPhase2Sources(ROOT);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const raceEntities = loaded.races.map((r) => toRaceCard(r, loaded.sources.races));
  const bgEntities = loaded.backgrounds.map((b) => toBackgroundCard(b, loaded.sources.backgrounds));
  const classEntities = [toClassCard(loaded.mageClass, loaded.sources.classes)];
  const all = [...raceEntities, ...bgEntities, ...classEntities];

  const bundle = {
    races: raceEntities,
    backgrounds: bgEntities,
    classes: classEntities,
  };
  const validation = validateEntityBundle(bundle);
  if (!validation.ok) {
    console.error('Entity schema validation failed:');
    for (const err of validation.errors) console.error(' ', err);
    process.exit(1);
  }

  writeJson(path.join(OUT, 'races.json'), {
    meta: { phase: '2', entityType: 'race', count: raceEntities.length, generatedAt, sources: loaded.sources.races },
    entities: raceEntities,
  });
  writeJson(path.join(OUT, 'backgrounds.json'), {
    meta: { phase: '2', entityType: 'background', count: bgEntities.length, generatedAt, sources: loaded.sources.backgrounds },
    entities: bgEntities,
  });
  writeJson(path.join(OUT, 'classes.json'), {
    meta: { phase: '2', entityType: 'class', count: classEntities.length, generatedAt, sources: loaded.sources.classes },
    entities: classEntities,
  });
  writeJson(path.join(OUT, 'index.json'), {
    meta: {
      phase: '2',
      generatedAt,
      sources: [
        ...loaded.sources.races,
        ...loaded.sources.backgrounds,
        ...loaded.sources.classes,
        'advisor/entities/aliases.manual.json',
      ],
      entryCount: 0,
    },
    entries: buildIndexEntries(all, manualAliases),
  });

  const index = readJson(path.join(OUT, 'index.json'));
  index.meta.entryCount = index.entries.length;
  writeJson(path.join(OUT, 'index.json'), index);

  syncChargenRaces(loaded.races);

  const choiceBgs = bgEntities.filter((b) =>
    (b.skillGrants || []).some((g) => g.kind !== 'fixed' && g.kind !== 'fixed_professional'),
  );

  console.log('Phase 2 entities build complete:');
  console.log('  races:', raceEntities.length);
  console.log('  backgrounds:', bgEntities.length);
  console.log('  classes:', classEntities.length);
  console.log('  index entries:', index.meta.entryCount);
  console.log('  backgrounds with choices:', choiceBgs.length);
  console.log('  schema:', validation.ok ? 'OK' : 'FAIL');
}

main();
