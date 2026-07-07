/**
 * Phase 2 — validate entity cards against advisor/entities/schema.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', 'advisor', 'entities', 'schema.json');

export function loadEntitySchema() {
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

function checkRequired(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) errors.push(`${label}: missing required field "${f}"`);
  }
  return errors;
}

function validateRace(entity) {
  const errors = checkRequired(entity, ['entityType', 'id', 'name', 'searchText', 'source'], entity.name);
  errors.push(...checkRequired(entity, ['description', 'attrBonus', 'traits', 'hpBonus'], entity.name));
  if (entity.entityType !== 'race') errors.push(`${entity.name}: entityType must be race`);
  if (!Array.isArray(entity.traits)) errors.push(`${entity.name}: traits must be array`);
  return errors;
}

function validateBackground(entity) {
  const errors = checkRequired(entity, ['entityType', 'id', 'name', 'searchText', 'source'], entity.name);
  errors.push(...checkRequired(entity, ['description', 'skillGrants', 'funds'], entity.name));
  if (entity.entityType !== 'background') errors.push(`${entity.name}: entityType must be background`);
  if (!Array.isArray(entity.skillGrants)) errors.push(`${entity.name}: skillGrants must be array`);
  for (const g of entity.skillGrants || []) {
    if (!g.kind) errors.push(`${entity.name}: skillGrant missing kind`);
  }
  return errors;
}

function validateClass(entity) {
  const errors = checkRequired(entity, ['entityType', 'id', 'name', 'searchText', 'source'], entity.name);
  errors.push(...checkRequired(entity, [
    'keyAttr', 'armor', 'weapons', 'saves', 'skillPickRule', 'startingFeatures', 'startingChoice',
  ], entity.name));
  if (entity.entityType !== 'class') errors.push(`${entity.name}: entityType must be class`);
  if (!Array.isArray(entity.startingFeatures) || !entity.startingFeatures.length) {
    errors.push(`${entity.name}: startingFeatures empty`);
  }
  return errors;
}

export function validateEntity(entity) {
  switch (entity.entityType) {
    case 'race':
      return validateRace(entity);
    case 'background':
      return validateBackground(entity);
    case 'class':
      return validateClass(entity);
    default:
      return [`${entity.name || entity.id}: unknown entityType ${entity.entityType}`];
  }
}

export function validateEntityBundle(bundle) {
  const errors = [];
  const ids = new Set();

  for (const list of [bundle.races || [], bundle.backgrounds || [], bundle.classes || []]) {
    for (const e of list) {
      const sig = `${e.entityType}:${e.id}`;
      if (ids.has(sig)) errors.push(`duplicate entity id ${sig}`);
      ids.add(sig);
      errors.push(...validateEntity(e));
    }
  }

  if ((bundle.races || []).length < 1) errors.push('expected at least 1 race');
  if ((bundle.backgrounds || []).length < 1) errors.push('expected at least 1 background');
  if ((bundle.classes || []).length < 1) errors.push('expected at least 1 class');

  return { ok: errors.length === 0, errors };
}

export function validateEntityFiles(entitiesDir) {
  const races = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'races.json'), 'utf8')).entities;
  const backgrounds = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'backgrounds.json'), 'utf8')).entities;
  const classes = JSON.parse(fs.readFileSync(path.join(entitiesDir, 'classes.json'), 'utf8')).entities;
  return validateEntityBundle({ races, backgrounds, classes });
}

if (process.argv[1] && process.argv[1].endsWith('validate-advisor-entities.mjs')) {
  const dir = path.join(__dirname, '..', 'advisor', 'entities');
  const result = validateEntityFiles(dir);
  if (result.ok) {
    console.log('Entity schema validation: OK');
    process.exit(0);
  }
  console.error('Entity schema validation failed:');
  for (const e of result.errors) console.error(' ', e);
  process.exit(1);
}
