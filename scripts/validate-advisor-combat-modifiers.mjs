#!/usr/bin/env node
/**
 * Advisor 5.0 batch14 (7078) — combat_skill_modifiers corpus cross-check.
 * Run: node scripts/validate-advisor-combat-modifiers.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const MOD_PATH = path.join(ADVISOR, 'rules', 'combat_skill_modifiers.json');

function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function skillExistsInIndexes(name) {
  const skillsDir = path.join(ADVISOR, 'skills');
  for (const f of fs.readdirSync(skillsDir)) {
    if (!f.endsWith('_index.json')) continue;
    const idx = loadJson(path.join(skillsDir, f));
    if ((idx.skills || []).some((s) => s.name === name)) return f;
  }
  return null;
}

function main() {
  console.log('=== validate-advisor-combat-modifiers (7078) ===\n');
  const doc = loadJson(MOD_PATH);
  const skills = doc.skills || {};
  let failed = 0;

  for (const [name, def] of Object.entries(skills)) {
    const src = skillExistsInIndexes(name);
    const hasHit = def.hitModifier != null || def.attrModifier != null;
    const hasAc = def.acModifier != null;
    if (!src) {
      failed += 1;
      console.log(`✗ ${name} — not found in any skills/*_index.json`);
      continue;
    }
    if (!hasHit && !hasAc) {
      failed += 1;
      console.log(`✗ ${name} — missing hitModifier/acModifier/attrModifier`);
      continue;
    }
    console.log(`✓ ${name} ← ${src} (${hasHit ? 'hit' : ''}${hasHit && hasAc ? '+' : ''}${hasAc ? 'ac' : ''})`);
  }

  const expected = ['守护刻印', '穿透射击', '硬化铠甲'];
  for (const id of expected) {
    if (!skills[id]) {
      failed += 1;
      console.log(`✗ batch14 missing skill entry: ${id}`);
    }
  }

  console.log(`\n7078 combat modifiers: ${Object.keys(skills).length - failed}/${Object.keys(skills).length} OK`);
  if (failed) process.exit(1);
}

main();
