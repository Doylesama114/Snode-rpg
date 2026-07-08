#!/usr/bin/env node
/**
 * Build kit 数据校验 — 技能/天赋/专长名称与流派位阶
 * Run: node scripts/validate-advisor-build-kit.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveL2LayerForClass } from './advisor-class-l2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const KITS_DIR = path.join(ROOT, 'advisor', 'build_kits');

let failed = 0;
function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function loadIndex(className) {
  if (className === '法师') {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/skills/mage_index.json'), 'utf8')).skills;
  }
  const layer = resolveL2LayerForClass(className);
  const slug = layer?.replace('L2-', '') || className;
  const p = path.join(ROOT, 'advisor/skills', `${slug}_index.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8')).skills;
}

function skillMap(className) {
  return Object.fromEntries(loadIndex(className).map((s) => [s.name, s]));
}

const universal = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/skills/universal_index.json'), 'utf8')).skills.map((s) => [s.name, s]),
);
const feats = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'advisor/feats.json'), 'utf8')).feats.map((f) => [f.name, f]),
);

console.log('=== validate-advisor-build-kit ===\n');

const kitFiles = fs.readdirSync(KITS_DIR).filter((f) => f.endsWith('.json'));
check('至少一个 build kit', kitFiles.length >= 1);

for (const file of kitFiles) {
  const kit = JSON.parse(fs.readFileSync(path.join(KITS_DIR, file), 'utf8'));
  console.log(`\n--- ${kit.id || file} ---`);
  const mageByName = skillMap(kit.mainClass || '法师');
  const subByName = skillMap(kit.subClass || '战士');

  for (const band of ['early', 'mid', 'late']) {
    for (const [style, names] of Object.entries(kit.mage?.phases?.[band]?.picks || {})) {
      for (const name of names) {
        const s = mageByName[name];
        check(`${kit.id} 法师/${style}/${name}`, !!s, '未收录');
        if (s?.style && s.style !== style && s.type !== 'starting') {
          check(`${kit.id} 流派 ${name}`, false, `期望 ${style} 实际 ${s.style}`);
        }
      }
    }
    for (const [style, names] of Object.entries(kit.warrior?.phases?.[band]?.picks || {})) {
      for (const name of names) {
        const s = subByName[name];
        check(`${kit.id} ${kit.subClass}/${style}/${name}`, !!s, '未收录');
        if (s?.style && s.style !== style) {
          check(`${kit.id} 流派 ${name}`, false, `期望 ${style} 实际 ${s.style}`);
        }
      }
    }
  }

  for (const band of ['early', 'mid', 'late']) {
    for (const t of kit.universalTalents?.[band] || []) {
      check(`${kit.id} 天赋 ${t.name}`, !!universal[t.name]);
    }
  }
  for (const lv of ['4', '8', '13']) {
    for (const f of kit.feats?.[lv] || []) {
      check(`${kit.id} 专长 L${lv} ${f.name}`, !!feats[f.name]);
    }
  }
}

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
