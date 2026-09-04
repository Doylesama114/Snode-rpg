#!/usr/bin/env node
/**
 * 全职业 L2 技能索引重建（含牧师神圣领域）。
 * 用法: node scripts/build-advisor-index-all.mjs [--out <dir>]
 * 默认输出到 advisor/skills；--out 用于试重建对比。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { skillToChunk } from './advisor-skill-chunk.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, '职业页', '数据');
const DEFAULT_OUT = path.join(ROOT, 'advisor', 'skills');

const CLASSES = [
  ['warrior', '战士.json', '战士'],
  ['mage', '法师.json', '法师'],
  ['rogue', '游荡者.json', '游荡者'],
  ['cleric', '牧师.json', '牧师'],
  ['paladin', '圣骑士.json', '圣骑士'],
  ['druid', '德鲁伊.json', '德鲁伊'],
  ['monk', '武僧.json', '武僧'],
  ['bard', '吟游诗人.json', '吟游诗人'],
  ['hunter', '猎人.json', '猎人'],
  ['sorcerer', '术士.json', '术士'],
  ['warlock', '魔契师.json', '魔契师'],
  ['artificer', '奇械师.json', '奇械师'],
  ['shaman', '萨满祭司.json', '萨满祭司'],
  ['barbarian', '蛮斗士.json', '蛮斗士'],
  ['warden', '守望者.json', '守望者'],
  ['universal', '通用天赋树.json', '通用天赋树'],
];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildIndex(rawSkills, { source, className, sourceLabel }) {
  const skills = rawSkills.map((s) => {
    const chunk = skillToChunk(s, { source, className, statusNames });
    if (s.deity) {
      chunk.deity = s.deity;
      chunk.tags = [...(chunk.tags || []), `\u9886\u57df\u00b7${s.deity}`];
    }
    return chunk;
  });
  const byStyle = {};
  const byTier = {};
  const byType = {};
  for (const s of skills) {
    if (s.style) byStyle[s.style] = (byStyle[s.style] || 0) + 1;
    if (s.tier) byTier[s.tier] = (byTier[s.tier] || 0) + 1;
    byType[s.type] = (byType[s.type] || 0) + 1;
  }
  return {
    meta: {
      layer: 'L2',
      phase: '2',
      version: '1.0.0',
      source: sourceLabel,
      class: className,
      count: skills.length,
      generatedAt: new Date().toISOString().slice(0, 10),
      facets: { byStyle, byTier, byType },
    },
    skills,
  };
}

const statusNames = loadJson(path.join(ROOT, 'advisor', 'rules', 'status_conditions.json')).conditions.map((c) => c.name);

function main() {
  const outDir = process.argv.includes('--out')
    ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
    : DEFAULT_OUT;

  const cleric = loadJson(path.join(DATA, '牧师.json'));
  const domain = loadJson(path.join(DATA, '牧师·神圣领域.json'));
  const domainSkills = [];
  for (const dom of Object.values(domain.domains || {})) {
    for (const s of dom.skills || []) {
      domainSkills.push({ ...s, deity: dom.name });
    }
  }

  const plans = [];
  for (const [slug, file, name] of CLASSES) {
    const raw = loadJson(path.join(DATA, file));
    let skills = raw.skills || [];
    let sourceLabel = `职业页/数据/${file}`;
    if (slug === 'cleric') {
      skills = [...(raw.skills || []), ...domainSkills];
      sourceLabel = '职业页/数据/牧师.json + 牧师·神圣领域.json';
    }
    plans.push({
      slug,
      name,
      outFile: path.join(outDir, `${slug}_index.json`),
      index: buildIndex(skills, { source: slug, className: name, sourceLabel }),
    });
  }

  for (const p of plans) {
    writeJson(p.outFile, p.index);
    console.log(`${p.slug.padEnd(12)} ${String(p.index.meta.count).padStart(4)} skills -> ${p.outFile}`);
  }
  console.log('done');
}

main();
