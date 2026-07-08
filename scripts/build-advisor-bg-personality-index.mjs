#!/usr/bin/env node
/**
 * Advisor 5.0 batch8 (7072) — background personality index from bg_personality.json.
 * Run: node scripts/build-advisor-bg-personality-index.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '职业页', '数据', 'bg_personality.json');
const OUT = path.join(ROOT, 'advisor', 'chargen', 'bg_personality_index.json');

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const items = [];

for (const [key, bg] of Object.entries(raw)) {
  if (!bg?.name) continue;
  items.push({
    name: bg.name,
    id: key,
    traits: bg.traits || [],
    ideals: bg.ideals || [],
    bonds: bg.bonds || [],
    flaws: bg.flaws || [],
    equipment: bg.equipment || [],
    deities: bg.deities || [],
    contacts: bg.contacts || [],
    scamTypes: bg.scam_types || bg.scamTypes || [],
    missionChannels: bg.mission_channels || bg.missionChannels || [],
    academicDomains: bg.academic_domains || bg.academicDomains || [],
    desc: bg.desc || '',
    hp: bg.hp || null,
    baseProfs: bg.base_profs || bg.baseProfs || '',
    specialProfs: bg.special_profs || bg.specialProfs || '',
    other: bg.other || '',
    gold: bg.gold || null,
    traitDesc: bg.trait_desc || bg.traitDesc || '',
    source: '职业页/数据/bg_personality.json',
  });
}

items.sort((a, b) => a.name.localeCompare(b.name, 'zh'));

const doc = {
  meta: {
    layer: 'L1',
    phase: '7072',
    source: '职业页/数据/bg_personality.json',
    count: items.length,
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  backgrounds: items,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUT} (${items.length} backgrounds)`);
