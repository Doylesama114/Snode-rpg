#!/usr/bin/env node
/**
 * Validate Build Advisor Phase 1 outputs against help.html / panel_data.
 * Run: node scripts/validate-advisor-phase1.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function loadPanelConst(name) {
  const text = fs.readFileSync(path.join(ROOT, '斯诺德跑团', 'panel_data.js'), 'utf8');
  const marker = `const ${name} = JSON.parse('`;
  const start = text.indexOf(marker);
  let i = start + marker.length;
  let raw = '';
  while (i < text.length) {
    const c = text[i];
    if (c === '\\' && text[i + 1] === "'") { raw += "'"; i += 2; continue; }
    if (c === "'") break;
    raw += c;
    i++;
  }
  return JSON.parse(raw);
}

const checks = [];
function ok(name, pass, detail = '') {
  checks.push({ name, pass, detail });
}

const leveling = loadJson('advisor/rules/leveling.json');
const multiclass = loadJson('advisor/rules/multiclass.json');
const spMarks = loadJson('advisor/rules/sp_marks.json');
const races = loadJson('advisor/chargen/races.json');
const backgrounds = loadJson('advisor/chargen/backgrounds.json');
const mageClass = loadJson('advisor/chargen/mage_class.json');
const mageHints = loadJson('advisor/chargen/mage_hints.json');
const statusConditions = loadJson('advisor/rules/status_conditions.json');
const refClasses = loadPanelConst('REF_CLASSES');
const refBackgrounds = loadPanelConst('REF_BACKGROUNDS');

// JSON parse smoke
ok('leveling.json parses', !!leveling.mainClass?.levels?.length);
ok('multiclass.json parses', multiclass.requirements?.length === 14);
ok('sp_marks.json parses', spMarks.colorMarks?.allMarkNames?.length === 14);
ok('races.json count', races.meta.count === 30 && races.races.length === 30);
ok('backgrounds count >= 42', backgrounds.backgrounds.length >= 42, `got ${backgrounds.backgrounds.length}`);

// Spot-check 1: LV.5 XP = 300 (help.html)
const l5 = leveling.mainClass.levels.find((l) => l.level === 5);
ok('LV.5 XP = 300', l5?.xp === 300, `got ${l5?.xp}`);

// Spot-check 2: LV.7 multiclass unlock text
const l7 = leveling.mainClass.levels.find((l) => l.level === 7);
ok('LV.7 unlocks multiclass', l7?.other?.includes('兼职'));

// Spot-check 3: Mage INT 15 requirement
const mageReq = multiclass.requirements.find((r) => r.class === '法师');
ok('法师智力15', mageReq?.attrRequired?.includes('15'));
ok('法师熟练+6', mageReq?.profRequired?.includes('+6'));

// Spot-check 4: Mage incompatible list
ok('法师不可兼职牧师', mageReq.incompatibleWith.includes('牧师'));
ok('法师可兼职奇械师', multiclass.compatibility['法师']['奇械师'] === true);

// Spot-check 5: REF_CLASSES mage key attr
ok('REF_CLASSES 法师 key_attr', refClasses['法师'].key_attr === mageClass.keyAttr);

// SP rules
ok('SP learn cost = 1', spMarks.spPoints.learnCost === 1);
ok('14 color marks', spMarks.colorMarks.allMarkNames.length === 14);
ok('wildcards 无色+炫彩', spMarks.colorMarks.wildcards.join(',') === '无色,炫彩');

// Mage hints sanity
ok('mage_hints has 侏儒', mageHints.recommendedRaces.high.some((r) => r.name === '侏儒'));
ok('mage_hints compatible subs includes 魔契师', mageHints.multiclassAsMain.compatibleSubclasses.includes('魔契师'));

// Phase 1.5 — status conditions
ok('status_conditions.json parses', statusConditions.conditions?.length === 35);
ok('35 status conditions', statusConditions.meta.conditionCount === 35);
ok('眩晕为 hard_cc', statusConditions.conditions.find((c) => c.name === '眩晕')?.controlTier === 'hard_cc');
ok('眩晕 summary 含跳过回合', statusConditions.conditions.find((c) => c.name === '眩晕')?.summary?.includes('跳过'));
ok('沉默反制施法', statusConditions.conditions.find((c) => c.name === '沉默')?.buildHints?.some((h) => h.includes('施法')));
ok('relatedKeywords 含惑控', statusConditions.relatedKeywords.some((k) => k.name === '惑控'));
ok('relatedKeywords 含专注', statusConditions.relatedKeywords.some((k) => k.name === '专注'));
ok('法师技能引用减速>=19', (statusConditions.conditions.find((c) => c.name === '减速')?.referencedByMageSkills || 0) >= 19);
ok('mageControlTop 含恐惧', statusConditions.mageControlTop.some((x) => x.name === '恐惧'));
ok('rules_summary 含 status 规则', loadJson('advisor/rules/rules_summary.json').bullets.some((b) => b.includes('status_conditions')));

// Phase 1.6
const pointBuy = loadJson('advisor/chargen/point_buy.json');
const profs = loadJson('advisor/chargen/proficiencies.json');
const mageClass16 = loadJson('advisor/chargen/mage_class.json');
const mageGear = loadJson('advisor/chargen/mage_starting_gear.json');
const equipRules = loadJson('advisor/chargen/mage_equipment_rules.json');
const equipIndex = loadJson('advisor/items/equipment_index.json');
const leveling16 = loadJson('advisor/rules/leveling.json');

ok('point_buy 32点', pointBuy.totalPoints === 32);
ok('智力15购点=9', pointBuy.table.find((r) => r.attrValue === 15)?.pointCost === 9);
ok('proficiencies 含逻辑', profs.byAttribute['智力'].includes('逻辑'));
ok('mage_class 8战斗风格', mageClass16.combatStyles?.length === 8);
ok('mage_class 奥法学者', mageClass16.specializations?.some((s) => s.id === '奥法学者'));
ok('mage_class roleSummary', mageClass16.roleSummary?.positioning?.includes('控制局势'));
ok('起手装 A-D', Object.keys(mageGear.kits || {}).length === 4);
ok('equipment_index >= 15', equipIndex.items.length >= 15, `got ${equipIndex.items.length}`);
ok('学徒魔棒在索引', equipIndex.items.some((i) => i.name.includes('魔棒')));
ok('三阶解锁 L3+50XP', leveling16.talentTierUnlocks?.unlocks?.some((u) => u.tier === 3 && u.unlockAtMainLevel === 3 && u.extraXpRequired === 50));
ok('背景 lore 侍僧', backgrounds.backgrounds.find((b) => b.name === '侍僧')?.lore?.length > 50);
ok('背景 图书管理员 mage hits', backgrounds.backgrounds.find((b) => b.name === '图书管理员')?.mageSkillHits?.includes('知识'));
ok('rules_summary 天赋同层5', loadJson('advisor/rules/rules_summary.json').bullets.some((b) => b.includes('5 项不同天赋')));

const failed = checks.filter((c) => !c.pass);
console.log(`Phase 1–1.6 validation: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
if (failed.length) process.exit(1);
