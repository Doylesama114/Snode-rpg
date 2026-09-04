/**
 * Phase 5 batch 7 (7034) — 全职业实体卡 + 起手套装 + 基础装备规则
 * Run: node scripts/build-advisor-class-infra.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadPanelConst,
  loadPanelWeaponProfs,
  loadClassesData,
  normalizeClassFromSource,
  toClassCard,
  buildSearchText,
} from './advisor-entity-sources.mjs';
import { validateEntityBundle } from './validate-advisor-entities.mjs';
import { buildIndexEntries } from './build-advisor-entities-helpers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');
const CHARGEN = path.join(ADVISOR, 'chargen');
const ENTITIES = path.join(ADVISOR, 'entities');

const GLOBAL_ARMOR_RULES = [
  '未着装护甲时 AC = 10 + 敏捷调整值。',
  '布衣/皮甲：AC 11 + 敏捷调整值（敏捷加成至多为 2）；布衣有隐匿劣势。',
  '鳞甲/锁甲/链甲等中重甲规则以基础规则战斗章与创建页为准。',
];

const SKIP_GEAR_OVERWRITE = new Set(['mage']);
const SKIP_RULES_OVERWRITE = new Set(['mage']);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function loadEquipData() {
  const text = fs.readFileSync(path.join(ROOT, '职业页', '数据', 'equipment_data.js'), 'utf8');
  const m = text.match(/var EQUIP_DATA = (\{[\s\S]*\});/);
  if (!m) throw new Error('EQUIP_DATA not found');
  return JSON.parse(m[1]);
}

function slugForClass(className, registryRow) {
  if (className === '法师') return 'mage';
  return registryRow?.l2Slug || null;
}

function splitKitItems(text) {
  return String(text || '')
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

function kitNoteFromSummary(summary) {
  const s = String(summary || '').trim();
  const head = s.split(/[。.]/)[0] || s;
  return head.slice(0, 80);
}

function buildStartingGear(className, equipRows) {
  const kits = {};
  for (const row of equipRows || []) {
    const letter = row.letter || 'A';
    kits[letter] = {
      letter,
      summary: row.text || '',
      items: splitKitItems(row.text),
    };
  }
  return {
    meta: {
      layer: 'L1',
      phase: '5-infra',
      class: className,
      source: '职业页/数据/equipment_data.js',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    kits,
    kitAdvisorNotes: Object.entries(kits).map(([kit, k]) => ({
      kit,
      note: kitNoteFromSummary(k.summary),
    })),
  };
}

function buildEquipmentRules(className, refClass, classesRow) {
  const armor = refClass?.armor || classesRow?.['护甲'] || '';
  const weapons = refClass?.weapons || classesRow?.['武器'] || '';
  const keyRules = [
    ...GLOBAL_ARMOR_RULES,
    `创建页护甲熟练：${armor || '—'}`,
    `创建页武器熟练：${weapons || '—'}`,
  ];
  const allowsGuns = /枪械/.test(weapons) && !/除枪械|枪械武器以外|不含枪械/.test(weapons);
  if (allowsGuns || className === '奇械师') {
    keyRules.push('枪械类武器消耗弹药；远程攻击规则见基础规则与职业页。');
  }
  if (/法杖|魔棒/.test(weapons)) {
    keyRules.push('部分戏法/法术需持法器或魔棒；具体以技能描述为准。');
  }
  return {
    meta: {
      layer: 'L1',
      phase: '5-infra',
      class: className,
      source: 'classes.json + 全局护甲摘要',
      generatedAt: new Date().toISOString().slice(0, 10),
      advisorTier: 'partial',
    },
    allowedArmor: armor.split(/、/).filter(Boolean),
    allowedWeapons: weapons.split(/、/).filter(Boolean),
    keyRules,
  };
}

function patchProficiencies(classSkillPick) {
  const p = path.join(CHARGEN, 'proficiencies.json');
  const prof = readJson(p);
  prof.classSkillPick = { ...(prof.classSkillPick || {}), ...classSkillPick };
  prof.meta = {
    ...prof.meta,
    phase: '5-infra',
    classSkillPickCount: Object.keys(prof.classSkillPick).length,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
  writeJson(p, prof);
}

function rebuildEntities(allClassCards, raceEntities, bgEntities, manualAliases) {
  const classEntities = allClassCards.map((c) => toClassCard(c.entity, c.sources));
  const all = [...raceEntities, ...bgEntities, ...classEntities];
  const bundle = { races: raceEntities, backgrounds: bgEntities, classes: classEntities };
  const validation = validateEntityBundle(bundle);
  if (!validation.ok) {
    console.error('Entity validation failed:');
    for (const e of validation.errors) console.error(' ', e);
    process.exit(1);
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  writeJson(path.join(ENTITIES, 'classes.json'), {
    meta: {
      phase: '5-infra',
      entityType: 'class',
      count: classEntities.length,
      generatedAt,
      sources: ['斯诺德跑团/panel_data.js → REF_CLASSES', 'advisor/chargen/*_class.json'],
    },
    entities: classEntities,
  });

  const index = readJson(path.join(ENTITIES, 'index.json'));
  const keepEntries = (index.entries || []).filter((e) => e.entityType !== 'class');
  index.entries = [...keepEntries, ...buildIndexEntries(classEntities, manualAliases)];
  index.meta = {
    ...index.meta,
    phase: '5-infra',
    generatedAt: new Date().toISOString().slice(0, 10),
    entryCount: index.entries.length,
  };
  writeJson(path.join(ENTITIES, 'index.json'), index);
  return { classEntities: classEntities.length, indexEntries: index.entries.length };
}

export function buildClassInfra(options = {}) {
  const root = options.root || ROOT;
  const registry = readJson(path.join(CHARGEN, 'class_registry.json'));
  const equipData = loadEquipData();
  const refClasses = loadPanelConst(path.join(root, '斯诺德跑团', 'panel_data.js'), 'REF_CLASSES');
  const weaponProfs = loadPanelWeaponProfs(path.join(root, '斯诺德跑团', 'panel_data.js'));
  const classesRows = loadClassesData(path.join(root, '职业页', '数据', 'classes_data.js'));
  const classesByName = Object.fromEntries(classesRows.map((c) => [c.name, c]));

  const classSkillPick = {};
  let gearBuilt = 0;
  let rulesBuilt = 0;
  const allClassCards = [];

  for (const className of Object.keys(registry.classes || {})) {
    const row = registry.classes[className];
    const slug = slugForClass(className, row);
    const ref = refClasses[className];
    if (!ref) {
      console.warn('SKIP no REF_CLASSES:', className);
      continue;
    }

    const slugClassPath = slug === 'mage'
      ? path.join(CHARGEN, 'mage_class.json')
      : path.join(CHARGEN, `${slug}_class.json`);
    const slugClass = fs.existsSync(slugClassPath) ? readJson(slugClassPath) : null;

    if (ref.skills) {
      classSkillPick[className] = ref.skills;
    } else if (slugClass?.skills) {
      classSkillPick[className] = slugClass.skills;
    }

    const equipRows = equipData[className];
    if (equipRows?.length && slug && !SKIP_GEAR_OVERWRITE.has(slug)) {
      const gearPath = path.join(CHARGEN, `${slug}_starting_gear.json`);
      writeJson(gearPath, buildStartingGear(className, equipRows));
      gearBuilt++;
    }

    if (slug && !SKIP_RULES_OVERWRITE.has(slug)) {
      const rulesPath = path.join(CHARGEN, `${slug}_equipment_rules.json`);
      writeJson(
        rulesPath,
        buildEquipmentRules(className, ref, classesByName[className]),
      );
      rulesBuilt++;
    }

    const normalized = normalizeClassFromSource(
      ref,
      classesByName[className],
      weaponProfs,
      slugClass,
    );
    if (equipRows?.length) {
      normalized.startingGearKits = equipRows.map((r) => ({
        letter: r.letter,
        summary: r.text,
      }));
    }
    allClassCards.push({
      entity: normalized,
      sources: ['斯诺德跑团/panel_data.js → REF_CLASSES', '职业页/数据/classes_data.js'],
    });
  }

  patchProficiencies(classSkillPick);

  const raceEntities = readJson(path.join(ENTITIES, 'races.json')).entities || [];
  const bgEntities = readJson(path.join(ENTITIES, 'backgrounds.json')).entities || [];
  const manualAliases = fs.existsSync(path.join(ENTITIES, 'aliases.manual.json'))
    ? readJson(path.join(ENTITIES, 'aliases.manual.json'))
    : { aliases: [] };
  const entityStats = rebuildEntities(allClassCards, raceEntities, bgEntities, manualAliases);

  return { gearBuilt, rulesBuilt, classSkillPick: Object.keys(classSkillPick).length, ...entityStats };
}

function main() {
  const stats = buildClassInfra();
  console.log('Class infra build complete:');
  console.log(`  starting_gear files: ${stats.gearBuilt}`);
  console.log(`  equipment_rules files: ${stats.rulesBuilt}`);
  console.log(`  classSkillPick: ${stats.classSkillPick}`);
  console.log(`  entity classes: ${stats.classEntities}`);
  console.log(`  index entries: ${stats.indexEntries}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
