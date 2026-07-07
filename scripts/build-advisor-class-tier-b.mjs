#!/usr/bin/env node
/**
 * Phase 5 — Tier B 职业数据：index + class json + hints
 * 用法: node scripts/build-advisor-class-tier-b.mjs [职业名...]
 * 无参数时处理 registry 中 l2Slug 已配置且 hints 仍为 placeholder 的职业
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildIndex } from './build-advisor-index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, '职业页', '数据');
const OUT_SKILLS = path.join(ROOT, 'advisor', 'skills');
const OUT_CHARGEN = path.join(ROOT, 'advisor', 'chargen');
const CLASSES_JSON = path.join(DATA, 'classes.json');
const REGISTRY = path.join(OUT_CHARGEN, 'class_registry.json');

const PARTIAL_NOTE =
  '顾问为部分支持：技能索引来自职业页数据，标识系统与进阶目录尚未完整收录；深度 build 与标识消耗请以规则书/DM 为准。';

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function firstSummary(skill) {
  const d = skill?.summary
    || skill?.fields?.描述
    || skill?.description?.[0]
    || skill?.flavor
    || '';
  return String(d).replace(/\s+/g, ' ').slice(0, 80);
}

function inferStyleSummary(styleName, skills) {
  const inStyle = skills.filter((s) => s.style === styleName && s.type !== 'starting');
  if (!inStyle.length) return `${styleName}战斗风格（详见职业页技能树）。`;
  const tags = new Set();
  for (const s of inStyle.slice(0, 8)) {
    for (const t of s.tags || []) tags.add(t);
    const kw = s.fields?.关键词 || '';
    if (kw) kw.split(/[.·]/).slice(0, 2).forEach((k) => tags.add(k));
  }
  const tagStr = [...tags].slice(0, 4).join('、');
  return tagStr
    ? `${styleName}：偏${tagStr}等能力。`
    : `${styleName}：${firstSummary(inStyle[0]) || '该风格技能以职业页为准。'}`;
}

function buildClassTierB(className, profile) {
  const slug = profile.l2Slug;
  const sourceFile = path.join(DATA, `${className}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.warn('SKIP (no data):', className);
    return null;
  }

  const classes = loadJson(CLASSES_JSON);
  const cls = classes.find((c) => c.name === className);
  const raw = loadJson(sourceFile);
  const skills = raw.skills || [];

  const idx = buildIndex({
    sourceFile,
    sourceKey: slug,
    className,
    outFile: path.join(OUT_SKILLS, `${slug}_index.json`),
  });
  writeJson(idx.outFile, { meta: idx.meta, skills: idx.skills });

  const styleNames = Object.keys(idx.meta.facets.byStyle || {});
  const startingFeatures = skills
    .filter((s) => s.type === 'starting')
    .map((s) => ({ name: s.name, desc: firstSummary(s) }));

  const specializations = (profile.specProfChoices || []).map((name) => ({
    name,
    effect: `创建页专精「${name}」（详见角色创建页说明）`,
  }));

  const classDoc = {
    meta: {
      layer: 'L1',
      phase: '5-tier-b',
      source: `职业页/数据/classes.json + ${className}.json`,
      generatedAt: new Date().toISOString().split('T')[0],
      advisorTier: 'partial',
    },
    id: className,
    name: className,
    description: cls?.description || raw.description || '',
    rolePositioning: cls?.['职责定位'] || '',
    keyAttr: cls?.['关键属性'] || profile.keyAttr || '',
    armor: cls?.['护甲'] || '',
    weapons: cls?.['武器'] || '',
    saves: (cls?.['豁免'] || '').split('、').filter(Boolean),
    skills: cls?.['技巧'] || '',
    startingFeatures,
    startingChoice: typeof profile.startingFeaturePick === 'number' ? profile.startingFeaturePick : 2,
    specializations,
    combatStyles: styleNames.map((name) => ({
      name,
      summary: inferStyleSummary(name, skills),
    })),
    advisorPartialNote: `${className}${PARTIAL_NOTE}`,
  };
  writeJson(path.join(OUT_CHARGEN, `${slug}_class.json`), classDoc);

  const hints = {
    meta: {
      layer: 'L1',
      phase: '5-tier-b',
      targetClass: className,
      tier: 'partial',
      status: 'auto',
      note: '风格摘要由脚本从技能标签生成；种族/背景/build 推荐待补充',
    },
    primaryAttr: {
      name: profile.keyAttr || classDoc.keyAttr,
      targetAtCreation: profile.keyAttrTarget ?? 15,
      reason: `${className}关键属性为 ${profile.keyAttr || classDoc.keyAttr}`,
    },
    roleSummary: {
      positioning: (classDoc.rolePositioning || '').split('、').filter(Boolean),
      blurb: (classDoc.description || '').slice(0, 220),
    },
    specializationHints: specializations.map((s) => ({
      name: s.name,
      buildHint: s.effect,
    })),
    styleHints: styleNames.map((name) => ({
      name,
      summary: inferStyleSummary(name, skills),
      sampleSkills: skills.filter((sk) => sk.style === name && sk.type !== 'starting').slice(0, 3).map((sk) => sk.name),
    })),
    recommendedRaces: [],
    recommendedBackgrounds: [],
    chargenTips: [
      `顾问档位 partial：可检索 ${className} 技能名与战斗风格；勿假设已有标识或完整进阶路线。`,
    ],
    advisorPartialNote: classDoc.advisorPartialNote,
  };
  writeJson(path.join(OUT_CHARGEN, 'hints', `${className}.json`), hints);

  return {
    className,
    slug,
    skillCount: idx.meta.count,
    styles: styleNames,
    styleKeywords: [className, ...styleNames],
  };
}

function patchRegistry(entries) {
  const reg = loadJson(REGISTRY);
  for (const e of entries) {
    if (!reg.classes[e.className]) continue;
    reg.classes[e.className].tier = 'partial';
    reg.classes[e.className].l2Slug = e.slug;
    reg.classes[e.className].l2Layer = `L2-${e.slug}`;
    reg.classes[e.className].styleKeywords = e.styleKeywords;
    reg.classes[e.className].advisorNote = `${e.className}顾问为部分支持：技能索引已收录，标识系统与进阶目录尚未完整；深度 build 请以规则书/DM 为准。`;
  }
  writeJson(REGISTRY, reg);
}

function main() {
  const reg = loadJson(REGISTRY);
  const argv = process.argv.slice(2).filter(Boolean);
  const targets = argv.length
    ? argv
    : ['战士', '蛮斗士', '猎人', '武僧'];

  const built = [];
  for (const className of targets) {
    const profile = reg.classes[className];
    if (!profile?.l2Slug && !argv.length) {
      console.warn('SKIP (no l2Slug in registry):', className);
      continue;
    }
    const p = { ...profile, l2Slug: profile?.l2Slug || slugify(className) };
    const result = buildClassTierB(className, p);
    if (result) {
      built.push(result);
      console.log(`OK ${className}: ${result.skillCount} skills, ${result.styles.length} styles → ${result.slug}_index.json`);
    }
  }

  if (built.length) patchRegistry(built);
  console.log(`Done. ${built.length} class(es) built.`);
}

function slugify(className) {
  const map = {
    战士: 'warrior',
    蛮斗士: 'barbarian',
    猎人: 'hunter',
    武僧: 'monk',
    奇械师: 'artificer',
  };
  return map[className] || className;
}

main();
