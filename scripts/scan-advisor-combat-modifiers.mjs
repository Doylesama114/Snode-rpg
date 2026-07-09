#!/usr/bin/env node
/**
 * Advisor 5.0 batch17 (7081) — scan L2 skill summaries for combat modifier candidates.
 * Run: node scripts/scan-advisor-combat-modifiers.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');
const MOD_PATH = path.join(ADVISOR, 'rules', 'combat_skill_modifiers.json');

const HIT_RE = /攻击命中检定值\+(\d+)|命中检定值\+(\d+)/;
const AC_RE = /防御等级\+(\d+)/;

function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function scanIndexes() {
  const known = new Set(Object.keys(loadJson(MOD_PATH).skills || {}));
  const hits = [];
  const acs = [];
  const skillsDir = path.join(ADVISOR, 'skills');

  for (const f of fs.readdirSync(skillsDir)) {
    if (!f.endsWith('_index.json')) continue;
    const idx = loadJson(path.join(skillsDir, f));
    for (const sk of idx.skills || []) {
      if (!sk.name || known.has(sk.name)) continue;
      const summary = sk.summary || '';
      const hm = summary.match(HIT_RE);
      const am = summary.match(AC_RE);
      if (hm) {
        hits.push({
          name: sk.name,
          className: sk.class || sk.className || f.replace('_index.json', ''),
          bonus: Number(hm[1] || hm[2]),
          source: f,
        });
      } else if (am) {
        acs.push({
          name: sk.name,
          className: sk.class || sk.className || f.replace('_index.json', ''),
          bonus: Number(am[1]),
          source: f,
        });
      }
    }
  }

  hits.sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name, 'zh'));
  acs.sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name, 'zh'));
  return { hits, acs, knownCount: known.size };
}

function main() {
  console.log('=== scan-advisor-combat-modifiers (7081) ===\n');
  const { hits, acs, knownCount } = scanIndexes();
  console.log(`Structured corpus: ${knownCount} skills`);
  console.log(`L2 hit candidates (not yet structured): ${hits.length}`);
  for (const row of hits.slice(0, 12)) {
    console.log(`  · ${row.name}（${row.className}）命中+${row.bonus} ← ${row.source}`);
  }
  if (hits.length > 12) console.log(`  … +${hits.length - 12} more`);
  console.log(`\nL2 AC candidates (not yet structured): ${acs.length}`);
  for (const row of acs.slice(0, 8)) {
    console.log(`  · ${row.name}（${row.className}）AC+${row.bonus} ← ${row.source}`);
  }
  if (acs.length > 8) console.log(`  … +${acs.length - 8} more`);
  console.log('\nOK (report only)');
}

main();
