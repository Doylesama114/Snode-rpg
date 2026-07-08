/**
 * Build Advisor — retrieval index (Phase 5).
 * Loads advisor JSON layers and exposes search + intent routing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAdvancementEligibility } from './advisor-eligibility.mjs';
import { resolveAdvancementName, briefAdvancementTalents } from './advisor-advancement-resolve.mjs';
import { analyzeSnapshot, normalizeSnapshot, formatSnapshotContext, skillWithinLearnableTiers } from './advisor-snapshot.mjs';
import {
  loadEntityStore,
  resolveEntities,
  formatEntityCard,
  getEntityCard,
} from './advisor-entities.mjs';
import { routeQuery, routeIntent } from './advisor-router.mjs';
import {
  normalizeWizardState,
  formatWizardContext,
  getWizardStepEntityHints,
} from './advisor-wizard-state.mjs';
import { buildChargenExtraContext } from './advisor-chargen-policy.mjs';
import { formatTierAuditContext } from './advisor-class-tier.mjs';
import { getClassProfile } from './advisor-chargen-registry.mjs';
import {
  collectTipsPool,
  resolvePrimaryAttrHint,
  loadClassHintsFile,
} from './advisor-class-content.mjs';
import {
  getL2EntryByLayer,
  listL2ClassEntries,
  detectClassStyles,
  matchAllClassesFromQuery,
  matchClassNameFromQuery,
  resolveL2LayerForClass,
  MAGE_QUERY_RE,
  MAGE_L2,
} from './advisor-class-l2.mjs';
import {
  buildGenericRoadmapContext,
  formatRoadmapContext,
  planBuildRoadmapFromRules,
  isPanelRoadmapQuery,
  parseRoadmapGoal,
  getRoadmapRouteConfig,
} from './advisor-build-roadmap.mjs';

export { routeIntent, routeQuery } from './advisor-router.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');

const STYLE_NAMES = ['塑能', '咒法', '预言', '防护', '附魔', '死灵', '幻术', '变化'];

function loadRegistryClassL2() {
  const classSkillIndexes = {};
  const classBasicsByName = {};
  for (const entry of listL2ClassEntries()) {
    const idxRel = `skills/${entry.l2Slug}_index.json`;
    const clsRel = `chargen/${entry.l2Slug}_class.json`;
    if (fs.existsSync(path.join(ADVISOR, idxRel))) {
      classSkillIndexes[entry.l2Layer] = loadJson(idxRel);
    }
    if (fs.existsSync(path.join(ADVISOR, clsRel))) {
      classBasicsByName[entry.className] = loadJson(clsRel);
    }
  }
  return { classSkillIndexes, classBasicsByName };
}

function loadRegistryClassInfra() {
  const registry = loadJson('chargen/class_registry.json');
  const classStartingGearByName = {};
  const classEquipmentRulesByName = {};
  for (const className of Object.keys(registry.classes || {})) {
    const row = registry.classes[className];
    const slug = className === '法师' ? 'mage' : row.l2Slug;
    if (!slug) continue;
    const gearPath = path.join(ADVISOR, 'chargen', `${slug}_starting_gear.json`);
    const rulesPath = path.join(ADVISOR, 'chargen', `${slug}_equipment_rules.json`);
    if (fs.existsSync(gearPath)) classStartingGearByName[className] = loadJson(`chargen/${slug}_starting_gear.json`);
    if (fs.existsSync(rulesPath)) classEquipmentRulesByName[className] = loadJson(`chargen/${slug}_equipment_rules.json`);
  }
  return { classStartingGearByName, classEquipmentRulesByName };
}

let _cache = null;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

export function loadAdvisorStore() {
  if (_cache) return _cache;
  const registryL2 = loadRegistryClassL2();
  const registryInfra = loadRegistryClassInfra();
  _cache = {
    rulesSummary: loadJson('rules/rules_summary.json'),
    leveling: loadJson('rules/leveling.json'),
    multiclass: loadJson('rules/multiclass.json'),
    spMarks: loadJson('rules/sp_marks.json'),
    statusConditions: loadJson('rules/status_conditions.json'),
    races: loadJson('chargen/races.json'),
    backgrounds: loadJson('chargen/backgrounds.json'),
    mageHints: loadJson('chargen/mage_hints.json'),
    mageClass: loadJson('chargen/mage_class.json'),
    mageEquipmentRules: fs.existsSync(path.join(ADVISOR, 'chargen/mage_equipment_rules.json'))
      ? loadJson('chargen/mage_equipment_rules.json')
      : null,
    mageStartingGear: fs.existsSync(path.join(ADVISOR, 'chargen/mage_starting_gear.json'))
      ? loadJson('chargen/mage_starting_gear.json')
      : null,
    proficiencies: fs.existsSync(path.join(ADVISOR, 'chargen/proficiencies.json'))
      ? loadJson('chargen/proficiencies.json')
      : null,
    pointBuy: loadJson('chargen/point_buy.json'),
    entities: loadEntityStore(ADVISOR),
    mageSkills: loadJson('skills/mage_index.json'),
    artificerSkills: fs.existsSync(path.join(ADVISOR, 'skills/artificer_index.json'))
      ? loadJson('skills/artificer_index.json')
      : { skills: [] },
    artificerClass: registryL2.classBasicsByName['奇械师']
      || (fs.existsSync(path.join(ADVISOR, 'chargen/artificer_class.json'))
        ? loadJson('chargen/artificer_class.json')
        : null),
    classSkillIndexes: registryL2.classSkillIndexes,
    classBasicsByName: registryL2.classBasicsByName,
    classStartingGearByName: registryInfra.classStartingGearByName,
    classEquipmentRulesByName: registryInfra.classEquipmentRulesByName,
    universalSkills: loadJson('skills/universal_index.json'),
    advancements: loadJson('advancements.json'),
    advancementSkills: fs.existsSync(path.join(ADVISOR, 'advancement_skills.json'))
      ? loadJson('advancement_skills.json')
      : { byName: {} },
    feats: loadJson('feats.json'),
    tips: loadJson('combos/mage_tips.json'),
    universalTips: fs.existsSync(path.join(ADVISOR, 'combos/universal_tips.json'))
      ? loadJson('combos/universal_tips.json')
      : { tips: [] },
    classRegistry: loadJson('chargen/class_registry.json'),
  };
  return _cache;
}

export function tokenize(text) {
  const raw = String(text || '').toLowerCase();
  const tokens = new Set();
  for (const ch of raw.replace(/\s+/g, '')) {
    if (/[\u4e00-\u9fff]/.test(ch)) tokens.add(ch);
  }
  const words = raw.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const w of words) tokens.add(w);
  for (const s of STYLE_NAMES) {
    if (raw.includes(s)) tokens.add(s);
  }
  for (const entry of listL2ClassEntries()) {
    if (raw.includes(entry.className)) tokens.add(entry.className);
    for (const kw of entry.styleKeywords || []) {
      if (kw && raw.includes(kw)) tokens.add(kw);
    }
  }
  for (const kw of ['兼职', '专长', '进阶', '标识', '塑能', '咒法', '通用', '种族', '背景', '智力', '冰霜', '火球', '飞弹', 'combo', '小贴士', '图纸', '枪械', '流派', '战斗风格', '职业树']) {
    if (raw.includes(kw)) tokens.add(kw);
  }
  return [...tokens];
}

export function scoreText(queryTokens, text) {
  if (!text) return 0;
  const hay = String(text).toLowerCase();
  let score = 0;
  for (const t of queryTokens) {
    if (hay.includes(t)) score += t.length >= 2 ? 3 : 1;
  }
  return score;
}

function detectStyles(query) {
  return STYLE_NAMES.filter((s) => query.includes(s));
}

function styleNamesForClass(store, className) {
  const profile = getClassProfile(className);
  const idx = store.classSkillIndexes?.[profile.l2Layer];
  const fromIndex = Object.keys(idx?.meta?.facets?.byStyle || {});
  if (fromIndex.length) return fromIndex;
  return (profile.styleKeywords || []).filter((k) => k !== className);
}

function detectStylesForClass(query, className, store) {
  if (className === '法师') return detectStyles(query);
  return detectClassStyles(query, className, styleNamesForClass(store, className));
}

function parseAttrsFromQuery(query) {
  const attrs = {};
  const intM = query.match(/智力\s*(\d+)/);
  if (intM) attrs.智力 = Number(intM[1]);
  return attrs;
}

/** 解析「1级升到8级」「从1到8级」「升到8级」等区间 */
export function parseLevelRange(query) {
  const q = String(query || '');
  const range1 = q.match(/(?:从)?\s*(\d+)\s*级?\s*(?:升|到|～|~|—|-)\s*(\d+)\s*级/);
  if (range1) {
    const from = Number(range1[1]);
    const to = Number(range1[2]);
    if (from !== to) return { from: Math.min(from, to), to: Math.max(from, to) };
  }
  const range2 = q.match(/(\d+)\s*级[\s\S]{0,12}?(\d+)\s*级/);
  if (range2 && range2[1] !== range2[2]) {
    const from = Number(range2[1]);
    const to = Number(range2[2]);
    return { from: Math.min(from, to), to: Math.max(from, to) };
  }
  const upTo = q.match(/升到\s*(\d+)\s*级/);
  if (upTo) return { from: 1, to: Number(upTo[1]) };
  const single = q.match(/(\d+)\s*级/);
  if (single) {
    const lv = Number(single[1]);
    return { from: lv, to: lv };
  }
  return null;
}

function getLowestAttrGain(row) {
  if (!row) return 0;
  if (row.lowest_attr_gain != null) return row.lowest_attr_gain;
  if (row.special === 'lowest_attr') return 2;
  return 0;
}

export function formatLevelRow(row) {
  if (!row) return '';
  const parts = [`LV.${row.level}（累计XP≥${row.xp}）`];
  if (row.proficiency) parts.push(`熟练+${row.proficiency}`);
  else parts.push('熟练—');
  const lowestGain = getLowestAttrGain(row);
  if (row.attr_gain) parts.push(`属性+${row.attr_gain}（自由分配）`);
  else if (lowestGain) parts.push(`最低属性+${lowestGain}（自动加至当前最低项）`);
  else parts.push('属性—');
  if (row.level === 1 && row.skill_slots != null) parts.push(`技能槽基数${row.skill_slots}`);
  else if (row.skill_slots) parts.push(`技能槽+${row.skill_slots}`);
  if (row.attr_cap != null) parts.push(`属性上限${row.attr_cap}`);
  if (row.prof_cap != null) parts.push(`熟练上限${row.prof_cap}`);
  if (row.rank) parts.push(`头衔「${row.rank}」`);
  const otherText = row.other && row.other !== '-' ? row.other : '';
  const skipOther = lowestGain && otherText.includes('最低');
  if (otherText && !skipOther) parts.push(`其他：${otherText}`);
  return parts.join('；');
}

export function computeMainClassCumulative(levels, fromLevel, toLevel) {
  const slice = levels.filter((l) => l.level >= fromLevel && l.level <= toLevel);
  let proficiencyTotal = 0;
  let attrTotal = 0;
  let lowestAttrTotal = 0;
  let slotIncrements = 0;
  let slotBase = 0;
  const profLevels = [];
  const attrLevels = [];
  const lowestAttrLevels = [];
  for (const row of slice) {
    if (row.proficiency) {
      proficiencyTotal += row.proficiency;
      profLevels.push(row.level);
    }
    if (row.attr_gain) {
      attrTotal += row.attr_gain;
      attrLevels.push(row.level);
    }
    const lowestGain = getLowestAttrGain(row);
    if (lowestGain) {
      lowestAttrTotal += lowestGain;
      lowestAttrLevels.push(row.level);
    }
    if (row.level === 1 && row.skill_slots != null) slotBase = row.skill_slots;
    else if (row.skill_slots) slotIncrements += row.skill_slots;
  }
  const last = slice[slice.length - 1];
  return {
    fromLevel,
    toLevel,
    proficiencyTotal,
    attrTotal,
    lowestAttrTotal,
    skillSlotsTotal: slotBase + slotIncrements,
    profAtLevels: profLevels,
    attrAtLevels: attrLevels,
    lowestAttrAtLevels: lowestAttrLevels,
    attrCap: last?.attr_cap ?? null,
    profCap: last?.prof_cap ?? null,
    ranks: slice.filter((r) => r.rank).map((r) => `L${r.level} ${r.rank}`),
  };
}

/** 法师：2 级起每级槽位增量×2（panel_engine calcSkillSlots） */
export function calcMageSkillSlotsAtLevel(level) {
  if (level <= 0) return 0;
  if (level === 1) return 10;
  return 10 + 2 * (level - 1);
}

function formatL0Hit(hit) {
  switch (hit.type) {
    case 'main_level':
      return formatLevelRow(hit.row);
    case 'level_range': {
      const lines = [`主职 L${hit.from}→L${hit.to} 逐级奖励：`];
      for (const line of hit.rows || []) lines.push(`  ${line}`);
      const c = hit.cumulative;
      if (c) {
        let attrSummary = `自由属性+${c.attrTotal}`;
        if (c.attrAtLevels?.length) attrSummary += `（L${c.attrAtLevels.join('/')}）`;
        else if (!c.attrTotal) attrSummary += '（无）';
        if (c.lowestAttrTotal) {
          attrSummary += `；最低属性+${c.lowestAttrTotal}（L${c.lowestAttrAtLevels.join('/')}，各加至当时最低项）`;
        }
        lines.push(
          `累计（L${c.fromLevel}→L${c.toLevel}）：熟练+${c.proficiencyTotal}（L${c.profAtLevels.join('/')}）；`
          + `${attrSummary}；`
          + `技能槽合计${c.skillSlotsTotal}（通用职业）；`
          + `L${c.toLevel} 属性上限${c.attrCap}、熟练上限${c.profCap}`,
        );
        if (c.ranks?.length) lines.push(`头衔变化：${c.ranks.join('；')}`);
        if (hit.mageSlotsAtEnd != null) {
          lines.push(`法师特例：L${hit.to} 技能槽合计约 ${hit.mageSlotsAtEnd}（2 级起每级槽位增量×2）；奥法学者另每级+1 法术槽`);
        }
      }
      return lines.join('\n');
    }
    case 'lowest_attr_milestones':
      return `最低属性奖励：${(hit.milestones || []).map((m) => `L${m.level} +${m.gain}（${m.rule}）`).join('；')}`;
    case 'feat_milestones':
      return `专长窗口：${(hit.milestones || []).map((m) => `L${m.level} ${m.reward}`).join('；')}`;
    case 'advancement_milestones':
      return `进阶窗口：${(hit.milestones || []).map((m) => `L${m.level} ${m.reward}`).join('；')}`;
    case 'talent_tier_unlocks': {
      const unlocks = hit.data?.unlocks || [];
      return `天赋位阶解锁：${unlocks.map((u) => `L${u.unlockAtMainLevel} ${u.tierLabel}（额外XP ${u.extraXpRequired}）`).join('；')}；同层最多${hit.data?.sameLayerTalentCap ?? 5}项`;
    }
    case 'level_3_highlight':
      return `${formatLevelRow(hit.row)}；三阶额外XP ${hit.talentTier?.extraXpRequired ?? 50}`;
    case 'leveling_notes':
      return (hit.notes || []).join('；');
    case 'multiclass_mage':
      return `兼职：主职 L${hit.unlockLevel} 解锁；法师要求 ${JSON.stringify(hit.mageRequirement?.attrs)} / 熟练 ${JSON.stringify(hit.mageRequirement?.proficiencies)}；可兼 ${(hit.compatibleSubclasses || []).slice(0, 8).join('、')}`;
    case 'class_req':
      return `${hit.class} 兼职条件：${JSON.stringify(hit.requirement)}`;
    case 'sp_marks':
      return `标识：学 1 技能通常 ${hit.learnCost?.sp ?? 1} SP + 对应 color_marks；${hit.note || ''}`;
    case 'rules_bullets':
      return (hit.bullets || []).join('\n');
    default:
      return JSON.stringify(hit).slice(0, 400);
  }
}

function searchList(items, getText, queryTokens, limit, filterFn = null) {
  let pool = items;
  if (filterFn) pool = pool.filter(filterFn);
  return pool
    .map((item) => ({ item, score: scoreText(queryTokens, getText(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

function buildL0Results(store, query, queryTokens, topK) {
  const out = { rulesSummary: store.rulesSummary, hits: [] };

  if (/兼职|7级|子职/.test(query)) {
    const mage = store.multiclass.requirements.find((r) => r.class === '法师');
    const compat = store.multiclass.compatibility?.法师 || {};
    out.hits.push({
      type: 'multiclass_mage',
      unlockLevel: store.multiclass.meta.mainClassUnlockLevel,
      mageRequirement: mage,
      compatibleSubclasses: Object.entries(compat).filter(([, v]) => v).map(([k]) => k),
      incompatible: mage?.incompatibleWith || [],
    });
  }

  if (/奇械师/.test(query)) {
    const artificer = store.multiclass.requirements.find((r) => r.class === '奇械师');
    out.hits.push({ type: 'class_req', class: '奇械师', requirement: artificer });
  }

  if (/标识|sp|紫色/.test(query.toLowerCase())) {
    out.hits.push({
      type: 'sp_marks',
      learnCost: store.spMarks.spPoints?.learnCost,
      wildcards: store.spMarks.colorMarks?.wildcards,
      note: '标识由 DM 根据模组主题结算；顾问不得建议刻意刷标识',
    });
  }

  const levelRange = parseLevelRange(query);
  const isLevelingQuery = levelRange
    || /解锁|三阶|里程碑|系统奖励|升级|熟练|属性|奖励|获得什么|槽位/.test(query);

  if (isLevelingQuery) {
    const levels = store.leveling.mainClass?.levels || [];
    if (levelRange) {
      const { from, to } = levelRange;
      const rowsInRange = levels.filter((l) => l.level >= from && l.level <= to);
      out.hits.push({
        type: 'level_range',
        from,
        to,
        rows: rowsInRange.map(formatLevelRow),
        cumulative: computeMainClassCumulative(levels, from, to),
        mageSlotsAtEnd: calcMageSkillSlotsAtLevel(to),
      });
    } else {
      const lv = levelRange?.from ?? null;
      if (lv) {
        const row = levels.find((l) => l.level === lv);
        if (row) out.hits.push({ type: 'main_level', level: lv, row });
      }
    }
    if (/16|19|最低属性|lowest/.test(query) && store.leveling.lowestAttrMilestones?.length) {
      out.hits.push({ type: 'lowest_attr_milestones', milestones: store.leveling.lowestAttrMilestones });
    }
    out.hits.push({ type: 'feat_milestones', milestones: store.leveling.featMilestones });
    out.hits.push({ type: 'advancement_milestones', milestones: store.leveling.advancementMilestones });
    out.hits.push({ type: 'talent_tier_unlocks', data: store.leveling.talentTierUnlocks });
    out.hits.push({
      type: 'leveling_notes',
      notes: [
        store.leveling.profCapNote,
        store.leveling.attrCapNote,
        '主职升级表每行均含：熟练增量、自由属性增量、最低属性奖励（L16/L19）、技能槽增量、属性上限、熟练上限、头衔与其他里程碑；回答区间奖励时必须全部列出，不可只写天赋/专长/兼职。',
        ...(store.leveling.levelUpAnswerChecklist || []).slice(-2),
        store.leveling.classModifiers?.mage?.skillSlotRule,
        store.leveling.classModifiers?.mage?.arcanistNote,
      ].filter(Boolean),
    });
    if (/3级|三阶/.test(query)) {
      const l3 = levels.find((l) => l.level === 3);
      out.hits.push({ type: 'level_3_highlight', row: l3, talentTier: store.leveling.talentTierUnlocks?.unlocks?.find((u) => u.tier === 3) });
    }
  }

  const bullets = store.rulesSummary.bullets.filter((b) => scoreText(queryTokens, b) > 0);
  out.hits.push({ type: 'rules_bullets', bullets: bullets.slice(0, topK || 5) });

  return out;
}

export function formatMageClassBasics(store, query = '') {
  const classCard = getEntityCard(store.entities, 'class', '法师');
  if (classCard) {
    let text = formatEntityCard(classCard);
    const equip = store.mageEquipmentRules || {};
    const gear = store.mageStartingGear || {};
    const prof = store.proficiencies || {};
    const extras = [];
    if (prof.classSkillPick?.法师 && !text.includes('选奥秘')) {
      extras.push(`- 技巧选择：${prof.classSkillPick.法师}`);
    }
    if (equip.keyRules?.length) {
      extras.push(`- 装备规则：${equip.keyRules.slice(0, 3).join('；')}`);
    }
    if (/装备|起手|套装/.test(query) && gear.kits) {
      for (const letter of ['A', 'B', 'C', 'D']) {
        const kit = gear.kits[letter];
        if (kit) extras.push(`- 起始套装 ${letter}：${kit.summary}`);
      }
      const note = gear.kitAdvisorNotes?.map((k) => `${k.kit}=${k.note}`).join('；');
      if (note) extras.push(`- 套装建议：${note}`);
    }
    if (/购点|属性点|32/.test(query) && store.pointBuy) {
      extras.push(`- 购点：共 ${store.pointBuy.totalPoints} 点；单项至多 ${store.pointBuy.maxPointsPerAttr} 点费用（属性 15）`);
    }
    if (extras.length) text += `\n${extras.join('\n')}`;
    return text;
  }
  const mc = store.mageClass || {};
  const prof = store.proficiencies || {};
  const equip = store.mageEquipmentRules || {};
  const gear = store.mageStartingGear || {};
  const lines = [
    `法师（${mc.rolePositioning || mc.roleSummary?.positioning?.join('、') || '法术输出'}）`,
    `- 关键属性：${mc.keyAttr}；豁免：${(mc.saves || []).join('、')}`,
    `- 护甲熟练：${mc.armor}；武器熟练（创建页）：${mc.weapons}`,
    `- 武器熟练类别（面板）：${(mc.weaponProfCategories || []).join('、') || '—'}`,
  ];
  if (mc.weaponCategoryNote) lines.push(`- ${mc.weaponCategoryNote}`);
  lines.push(`- 技巧选择：${prof.classSkillPick?.法师 || mc.skills || '—'}`);
  lines.push(`- 生命/疲劳：${mc.hpFormula?.first || '8+体质调整值'}；${mc.fpFormula?.first || '12+关键属性调整值'}`);
  lines.push(`- 初始特性：${mc.startingFeatures?.length || 8} 选 ${mc.startingChoice || 4}（${(mc.startingFeatures || []).map((f) => f.name).join('、')}）`);
  for (const spec of mc.specializations || []) {
    lines.push(`- 专精「${spec.name}」：${spec.effect || spec.buildHint || ''}`);
  }
  if (equip.keyRules?.length) {
    lines.push(`- 装备规则：${equip.keyRules.slice(0, 3).join('；')}`);
  }
  if (/装备|起手|套装|A|B|C|D/.test(query) && gear.kits) {
    for (const letter of ['A', 'B', 'C', 'D']) {
      const kit = gear.kits[letter];
      if (kit) lines.push(`- 起始套装 ${letter}：${kit.summary}`);
    }
    const note = gear.kitAdvisorNotes?.map((k) => `${k.kit}=${k.note}`).join('；');
    if (note) lines.push(`- 套装建议：${note}`);
  }
  if (/购点|属性点|32/.test(query) && store.pointBuy) {
    lines.push(`- 购点：共 ${store.pointBuy.totalPoints} 点；单项至多 ${store.pointBuy.maxPointsPerAttr} 点费用（属性 15）；${(store.pointBuy.rules || []).join('')}`);
  }
  return lines.join('\n');
}

export function formatRegistryClassBasics(store, className, query = '') {
  const doc = store.classBasicsByName?.[className] || {};
  const hints = loadClassHintsFile(className) || {};
  const positioning = doc.rolePositioning || hints.roleSummary?.positioning?.join('、') || '';
  const lines = [
    `${className}（${positioning || '见职业页'}）`,
    `- 关键属性：${doc.keyAttr || hints.primaryAttr?.name || '—'}；豁免：${(doc.saves || []).join('、') || '—'}`,
    `- 护甲熟练：${doc.armor || '—'}；武器熟练：${doc.weapons || '—'}`,
    `- 技巧选择：${doc.skills || '—'}`,
  ];
  if (doc.startingFeatures?.length) {
    const names = doc.startingFeatures.map((f) => f.name).join('、');
    lines.push(
      doc.startingChoice === 'all'
        ? `- 初始特性：全部获得（${names}）`
        : `- 初始特性：${doc.startingFeatures.length} 选 ${doc.startingChoice || 2}（${names}）`,
    );
  }
  for (const spec of doc.specializations || hints.specializationHints || []) {
    lines.push(`- 专精「${spec.name}」：${spec.effect || spec.buildHint || ''}`);
  }
  const equip = store.classEquipmentRulesByName?.[className];
  const gear = store.classStartingGearByName?.[className];
  if (equip?.keyRules?.length) {
    lines.push(`- 装备规则：${equip.keyRules.slice(0, 3).join('；')}`);
  }
  if (/装备|起手|套装|起始/.test(query) && gear?.kits) {
    for (const letter of ['A', 'B', 'C', 'D']) {
      const kit = gear.kits[letter];
      if (kit) lines.push(`- 起始套装 ${letter}：${kit.summary}`);
    }
    const note = gear.kitAdvisorNotes?.map((k) => `${k.kit}=${k.note}`).join('；');
    if (note) lines.push(`- 套装建议：${note}`);
  }
  if (doc.advisorPartialNote) lines.push(`- 顾问说明：${doc.advisorPartialNote}`);
  if (doc.timelineNote) lines.push(`- ${doc.timelineNote}`);
  if (/购点|属性点|32/.test(query) && store.pointBuy) {
    lines.push(`- 购点：共 ${store.pointBuy.totalPoints} 点；单项至多 ${store.pointBuy.maxPointsPerAttr} 点费用（属性 15）`);
  }
  return lines.join('\n');
}

function buildL1Results(store, query, queryTokens, limit, entityHits = [], className = null) {
  const races = searchList(
    store.races.races,
    (r) => `${r.name} ${r.intBonus ?? ''} ${r.description || ''} ${JSON.stringify(r)}`,
    queryTokens,
    Math.ceil(limit / 2),
  );
  const backgrounds = searchList(
    store.backgrounds.backgrounds,
    (b) => `${b.name} ${(b.skills || []).join(' ')} ${b.lore || ''} ${(b.mageSkillHits || []).join(' ')}`,
    queryTokens,
    Math.ceil(limit / 2),
  );

  const isMageContext = className === '法师' || (!className && MAGE_QUERY_RE.test(query));
  const partialClass = className && store.classBasicsByName?.[className] ? className : null;
  const classHints = className && !isMageContext ? loadClassHintsFile(className) : null;
  const styles = isMageContext
    ? detectStyles(query)
    : (partialClass ? detectStylesForClass(query, partialClass, store) : []);

  let styleHints = isMageContext
    ? (store.mageHints.styleHints || [])
    : (classHints?.styleHints || []);
  if (styles.length) {
    styleHints = styleHints.filter((h) => styles.includes(h.name));
  } else if (isMageContext && /风格|流派|咒法|塑能/.test(query)) {
    styleHints = styleHints.slice(0, 4);
  } else if (partialClass && /风格|流派|战斗风格|职业树/.test(query)) {
    styleHints = styleHints.slice(0, 6);
  }

  const classQueryRe = partialClass
    ? new RegExp(className)
    : null;
  const entityTypes = new Set(entityHits.map((e) => e.entityType));
  const skipClassBasics = entityHits.length > 0
    && !entityTypes.has('class')
    && !/武器|护甲|专精|起手|装备|创建|车卡|初始|购点|输出|怎么选|流派|战斗风格|职业树/.test(query)
    && !(classQueryRe && classQueryRe.test(query));
  const includeClassBasics = !skipClassBasics && (
    (isMageContext && /武器|护甲|熟练|豁免|专精|起手|装备|创建|车卡|法师|初始|购点|种族|背景|输出|怎么选/.test(query))
    || (partialClass && /武器|护甲|熟练|豁免|专精|起手|装备|创建|车卡|初始|购点|种族|背景|输出|怎么选|流派|战斗风格|职业树/.test(query))
    || (isMageContext && !className && limit >= 4 && MAGE_QUERY_RE.test(query))
  );

  const primaryAttr = resolvePrimaryAttrHint(store, className);
  const mageRec = isMageContext ? store.mageHints : null;

  let classBasics = null;
  if (includeClassBasics) {
    if (partialClass) classBasics = formatRegistryClassBasics(store, partialClass, query);
    else if (isMageContext) classBasics = formatMageClassBasics(store, query);
  }

  const combatDoc = partialClass ? store.classBasicsByName[partialClass] : null;

  return {
    className: className || null,
    primaryAttr,
    recommendedRaces: mageRec?.recommendedRaces || classHints?.recommendedRaces,
    recommendedBackgrounds: mageRec?.recommendedBackgrounds?.slice(0, 8) || classHints?.recommendedBackgrounds?.slice(0, 8),
    classBasics,
    races,
    backgrounds,
    styleHints,
    combatStyles: styles.length && isMageContext
      ? (store.mageClass.combatStyles || []).filter((s) => styles.includes(s.name))
      : (styles.length && combatDoc
        ? (combatDoc.combatStyles || []).filter((s) => styles.includes(s.name))
        : []),
  };
}

function buildL2MageResults(store, query, queryTokens, limit, opts = {}) {
  const styles = detectStyles(query);
  const tierFilter = /1[～~\-—到]3|1\s*~\s*3|一级|二级|三级|低阶|初期|前三级|优先学/.test(query);
  const byName = Object.fromEntries(store.mageSkills.skills.map((s) => [s.name, s]));

  let ranked = searchList(
    store.mageSkills.skills,
    (s) => s.searchText || `${s.name} ${s.style} ${s.summary}`,
    queryTokens,
    limit,
    (s) => {
      if (!skillWithinLearnableTiers(s, opts.learnableTiers)) return false;
      if (s.type === 'starting') return true;
      if (styles.length && s.style && !styles.includes(s.style)) return false;
      if (tierFilter && s.tier && !['一阶', '二阶', '三阶', null].includes(s.tier) && s.type !== 'starting') {
        return s.tier === '一阶' || s.tier === '二阶' || s.tier === '三阶';
      }
      return true;
    },
  );

  if (styles.includes('塑能') && tierFilter) {
    const pin = ['塑能箭', '魔法飞弹', '火焰箭', '雷光箭', '寒冰箭', '强酸箭']
      .map((n) => byName[n])
      .filter(Boolean);
    const seen = new Set();
    ranked = [...pin, ...ranked].filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).slice(0, limit);
  }

  return ranked;
}

function buildL2RegistryResults(store, l2Layer, query, queryTokens, limit, opts = {}) {
  const entry = getL2EntryByLayer(l2Layer);
  const index = store.classSkillIndexes?.[l2Layer];
  if (!index?.skills?.length) return [];

  const className = entry?.className || index.meta?.class;
  const styles = className
    ? detectStylesForClass(query, className, store)
    : [];
  const tierFilter = /1[～~\-—到]3|1\s*~\s*3|一级|二级|三级|低阶|初期|前三级|优先学/.test(query);
  const byName = Object.fromEntries(index.skills.map((s) => [s.name, s]));

  let ranked = searchList(
    index.skills,
    (s) => s.searchText || `${s.name} ${s.style} ${s.summary}`,
    queryTokens,
    limit,
    (s) => {
      if (!skillWithinLearnableTiers(s, opts.learnableTiers)) return false;
      if (s.type === 'starting') return true;
      if (styles.length && s.style && !styles.includes(s.style)) return false;
      if (tierFilter && s.tier && !['一阶', '二阶', '三阶', null].includes(s.tier) && s.type !== 'starting') {
        return s.tier === '一阶' || s.tier === '二阶' || s.tier === '三阶';
      }
      return true;
    },
  );

  if (styles.length === 1 && tierFilter) {
    const pin = index.skills
      .filter((s) => s.style === styles[0] && (s.tier === '一阶' || s.type === 'starting'))
      .slice(0, 4);
    const seen = new Set();
    ranked = [...pin, ...ranked].filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).slice(0, limit);
  }

  return ranked;
}

function buildL2UniversalResults(store, query, queryTokens, limit) {
  const outputBias = /输出|法术|塑能|攻击|伤害|法师/.test(query);
  const MAGE_OUTPUT_BOOST = ['法术精准', '法术精通', '极速施法', '魔法发烧友', '头脑风暴'];
  const byName = Object.fromEntries(store.universalSkills.skills.map((s) => [s.name, s]));

  let ranked = searchList(
    store.universalSkills.skills,
    (s) => {
      let text = s.searchText || `${s.name} ${s.summary}`;
      if (outputBias && MAGE_OUTPUT_BOOST.includes(s.name)) text += ' mage_output_boost';
      return text;
    },
    queryTokens,
    limit,
    outputBias
      ? (s) => s.roleHints?.includes('burst')
        || s.roleHints?.includes('precision')
        || MAGE_OUTPUT_BOOST.includes(s.name)
        || /法术|施法|命中|塑能|输出/.test(s.searchText || '')
      : () => true,
  );

  if (outputBias) {
    const pinned = MAGE_OUTPUT_BOOST.filter((n) => byName[n]).map((n) => byName[n]);
    const seen = new Set();
    ranked = [...pinned, ...ranked].filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    }).slice(0, limit);
  }

  return ranked;
}

function buildL3Results(store, query, queryTokens, limit, attrs) {
  const advName = resolveAdvancementName(query);
  let items = store.advancements.advancements;

  if (advName) {
    items = items.filter((a) => a.name.includes(advName) || advName.includes(a.name));
    if (!items.length && store.advancementSkills?.byName?.[advName]) {
      const doc = store.advancementSkills.byName[advName];
      items = [{
        id: `adv-documented-${advName}`,
        name: advName,
        scope: 'class-advancement',
        confidence: 'documented',
        inferenceBlurb: (doc.description || '').slice(0, 120),
        searchText: `${advName} documented ${doc.description || ''}`,
      }];
    }
  }

  const ranked = searchList(
    items,
    (a) => a.searchText || `${a.name} ${a.inferenceBlurb} ${JSON.stringify(a.attrsRequired)}`,
    queryTokens,
    limit,
  );

  const eligibility = [];
  if (Object.keys(attrs).length) {
    for (const adv of ranked.slice(0, 5)) {
      eligibility.push(checkAdvancementEligibility(adv, attrs));
    }
  }

  return { advancements: ranked, eligibility, documentedSkills: pickDocumentedSkills(store, ranked) };
}

function pickDocumentedSkills(store, rankedAdvancements) {
  const byName = store.advancementSkills?.byName || {};
  const out = [];
  for (const adv of rankedAdvancements.slice(0, 5)) {
    const doc = byName[adv.name];
    if (!doc) continue;
    out.push({ advancementName: adv.name, ...doc });
  }
  return out;
}

function buildL4Results(store, query, queryTokens, limit) {
  const outputBias = /输出|法术|塑能|攻击|伤害/.test(query);
  return searchList(
    store.feats.feats,
    (f) => f.searchText || `${f.name} ${f.summary}`,
    queryTokens,
    limit,
    outputBias ? (f) => f.mageRelevance === 'high' || f.mageRelevance === 'medium' : () => true,
  );
}

function buildL5Results(store, query, queryTokens, limit, className = null) {
  const styles = detectStyles(query);
  const pool = collectTipsPool(store, className);
  return searchList(
    pool,
    (t) => t.searchText || `${t.title} ${t.summary} ${t.detail}`,
    queryTokens,
    limit,
    styles.length ? (t) => !t.style || styles.includes(t.style) : () => true,
  );
}

function getSkillsForClass(store, className) {
  if (className === '法师') return store.mageSkills.skills || [];
  const layer = resolveL2LayerForClass(className);
  return store.classSkillIndexes?.[layer]?.skills || [];
}

function filterSkillsByPlan(skills, options = {}) {
  const exclude = new Set(options.excludeTypes || options.exclude || []);
  return skills.filter((s) => {
    if (exclude.has('starting') && s.type === 'starting') return false;
    if (exclude.has(s.type)) return false;
    return true;
  });
}

export function buildSkillCatalog(store, className, options = {}) {
  const skills = filterSkillsByPlan(getSkillsForClass(store, className), options);
  /** @type {Record<string, { style: string, tier: string, count: number, examples: object[] }>} */
  const groups = {};
  for (const s of skills) {
    const style = s.style || (s.type === 'starting' ? '起手' : '其他');
    const tier = s.tier || (s.type === 'starting' ? '起手' : '-');
    const key = `${style}\0${tier}`;
    if (!groups[key]) {
      groups[key] = { style, tier, count: 0, examples: [] };
    }
    groups[key].count += 1;
    if (groups[key].examples.length < 2) {
      groups[key].examples.push({
        name: s.name,
        summary: (s.summary || '').slice(0, 100),
      });
    }
  }
  return {
    className,
    layer: resolveL2LayerForClass(className),
    total: skills.length,
    groups: Object.values(groups).sort((a, b) => {
      if (a.style !== b.style) return a.style.localeCompare(b.style, 'zh');
      return String(a.tier).localeCompare(String(b.tier), 'zh');
    }),
  };
}

export function buildSkillFullList(store, className, options = {}) {
  const skills = filterSkillsByPlan(getSkillsForClass(store, className), options);
  const byStyle = {};
  for (const s of skills) {
    const style = s.style || (s.type === 'starting' ? '起手' : '其他');
    if (!byStyle[style]) byStyle[style] = [];
    byStyle[style].push(s);
  }
  return {
    className,
    layer: resolveL2LayerForClass(className),
    total: skills.length,
    skills: skills.slice(0, 120),
    byStyle: Object.fromEntries(
      Object.entries(byStyle).map(([style, list]) => [
        style,
        list.map((s) => ({
          name: s.name,
          tier: s.tier || (s.type === 'starting' ? '起手' : '-'),
          type: s.type,
          summary: (s.summary || '').slice(0, 120),
          choicesFrom: s.choicesFrom || null,
        })),
      ]),
    ),
  };
}

function applyBuildRoadmapPlan(retrieval, plan, task, store, snapshotNorm, goalOverride = null) {
  const parsed = parseRoadmapGoal(retrieval.query || '', snapshotNorm, goalOverride);
  const goal = {
    mainClass: task.mainClass || parsed.mainClass,
    subClass: task.subClass ?? parsed.subClass,
    advancementName: task.advancementName ?? parsed.advancementName,
    unknownAdvancement: task.unknownAdvancement ?? parsed.unknownAdvancement,
    roadmapMode: task.roadmapMode ?? parsed.roadmapMode,
    kitId: task.kitId ?? parsed.kitId,
    goalOverride: parsed.goalOverride,
    query: retrieval.query || '',
  };

  retrieval.plan = plan;
  retrieval.answerStyle = 'roadmap';
  retrieval.intent = plan.intent || (goal.unknownAdvancement ? 'unknown_entity' : 'build_roadmap');
  retrieval.promptProfile = plan.promptProfile || retrieval.intent;
  retrieval.unknownAdvancement = goal.unknownAdvancement || null;
  retrieval.retrievalClass = goal.mainClass;

  const ctx = buildGenericRoadmapContext(store, goal, {
    snapshot: snapshotNorm || null,
  });
  retrieval.results._roadmap = ctx;
  retrieval.results._roadmapText = formatRoadmapContext(ctx);

  const { layers } = getRoadmapRouteConfig(goal);
  for (const layer of layers) {
    if (!retrieval.layersRequested.includes(layer)) retrieval.layersRequested.push(layer);
    if (!retrieval.layersHit.includes(layer)) retrieval.layersHit.push(layer);
  }

  return retrieval;
}

function applyPlanToRetrieval(retrieval, plan, store, query, queryTokens, l2Opts = {}, snapshotNorm = null, goalOverride = null) {
  if (!plan?.tasks?.length) return retrieval;

  const roadmapTask = plan.tasks.find((t) => t.type === 'build_roadmap');
  if (roadmapTask) {
    return applyBuildRoadmapPlan(retrieval, plan, roadmapTask, store, snapshotNorm, goalOverride);
  }

  const listTask = plan.tasks.find((t) => t.type === 'list_skills');
  if (!listTask?.classes?.length) return retrieval;

  retrieval.plan = plan;
  retrieval.answerStyle = plan.answerStyle || 'catalog';
  if (!retrieval.results._catalog) retrieval.results._catalog = [];
  if (!retrieval.results._fullList) retrieval.results._fullList = [];

  const opts = { excludeTypes: listTask.exclude || [] };
  for (const className of listTask.classes) {
    if (plan.answerStyle === 'full_list') {
      const fl = buildSkillFullList(store, className, opts);
      retrieval.results._fullList.push(fl);
      const layer = fl.layer;
      if (layer) {
        retrieval.results[layer] = fl.skills.slice(0, 60);
        if (!retrieval.layersHit.includes(layer)) retrieval.layersHit.push(layer);
        if (!retrieval.layersRequested.includes(layer)) retrieval.layersRequested.push(layer);
      }
    } else {
      const cat = buildSkillCatalog(store, className, opts);
      retrieval.results._catalog.push(cat);
      const layer = cat.layer;
      if (layer) {
        if (layer === MAGE_L2) {
          retrieval.results[MAGE_L2] = buildL2MageResults(store, query, queryTokens, 24, l2Opts);
        } else {
          const sample = buildL2RegistryResults(store, layer, query, queryTokens, 24, l2Opts);
          if (sample.length) retrieval.results[layer] = sample;
        }
        if (!retrieval.layersHit.includes(layer)) retrieval.layersHit.push(layer);
        if (!retrieval.layersRequested.includes(layer)) retrieval.layersRequested.push(layer);
      }
    }
  }

  if (listTask.classes.length === 1) {
    retrieval.retrievalClass = listTask.classes[0];
    retrieval.tier = getClassProfile(listTask.classes[0]).tier;
  } else {
    retrieval.retrievalClass = null;
    retrieval.tier = null;
  }

  if (plan.intent) retrieval.intent = plan.intent;
  if (plan.promptProfile) retrieval.promptProfile = plan.promptProfile;

  return retrieval;
}

function resolveRetrievalClass(wizardState, chargenState, snapshot, query = '') {
  return wizardState?.selections?.className
    || chargenState?.char?.className
    || snapshot?.classes?.[0]?.name
    || snapshot?.className
    || matchClassNameFromQuery(query)
    || null;
}

/**
 * @param {string} query user question
 * @param {{ topK?: Record<string, number>, snapshot?: object, mode?: string, wizardState?: object }} options
 */
export function retrieve(query, options = {}) {
  const store = loadAdvisorStore();
  const wizardState = normalizeWizardState(options.wizardState);
  const goalOverride = options.goalOverride || null;

  let snapshotNorm = null;
  let l6Analysis = null;
  let l2Opts = {};
  if (options.snapshot) {
    snapshotNorm = options.snapshot.meta?.layer === 'L6'
      ? options.snapshot
      : normalizeSnapshot(options.snapshot);
    const advName = resolveAdvancementName(query);
    l6Analysis = analyzeSnapshot(snapshotNorm, {
      advancementNames: advName ? [advName] : null,
    });
    if (l6Analysis.learnableTiers?.length) {
      l2Opts = { learnableTiers: l6Analysis.learnableTiers };
    }
  }

  let plan = options.plan;
  if (!plan && snapshotNorm && isPanelRoadmapQuery(query, { snapshot: snapshotNorm })) {
    plan = planBuildRoadmapFromRules(query, { snapshot: snapshotNorm, mode: options.mode, goalOverride });
  }

  const retrievalClass = resolveRetrievalClass(
    wizardState,
    options.chargenState,
    snapshotNorm || options.snapshot,
    query,
  );
  const effectiveClass = goalOverride?.mainClass || retrievalClass;
  const entityHits = resolveEntities(query, store.entities);
  const route = routeQuery({
    query,
    mode: options.mode,
    entityHits,
    wizardState,
    className: effectiveClass,
    snapshot: snapshotNorm,
  });
  const roadmapTask = plan?.tasks?.find((t) => t.type === 'build_roadmap');
  const panelRoadmap = snapshotNorm && isPanelRoadmapQuery(query, { snapshot: snapshotNorm });
  const roadmapGoal = roadmapTask
    ? {
      mainClass: roadmapTask.mainClass,
      subClass: roadmapTask.subClass,
      advancementName: roadmapTask.advancementName,
      unknownAdvancement: roadmapTask.unknownAdvancement,
      roadmapMode: roadmapTask.roadmapMode,
      kitId: roadmapTask.kitId,
      query,
    }
    : parseRoadmapGoal(query, snapshotNorm, goalOverride);
  if (roadmapTask || plan?.intent === 'build_roadmap' || plan?.intent === 'unknown_entity' || panelRoadmap) {
    const roadmapRoute = getRoadmapRouteConfig(roadmapGoal);
    route.intent = plan?.intent || 'build_roadmap';
    route.promptProfile = plan?.promptProfile || route.intent;
    route.layers = roadmapRoute.layers;
    route.topK = roadmapRoute.topK;
  }
  const queryTokens = tokenize(query);
  const topK = { ...route.topK, ...options.topK };
  let attrs = parseAttrsFromQuery(query);
  if (l6Analysis) {
    attrs = { ...(l6Analysis.snapshot.attrs || {}), ...attrs };
  }

  const layers = {};
  const layersHit = [];
  const mergedEntities = [...entityHits];
  if (wizardState) {
    for (const hint of getWizardStepEntityHints(wizardState, store)) {
      if (!mergedEntities.some((e) => e.entityType === hint.entityType && e.id === hint.id)) {
        mergedEntities.push({
          ...hint,
          matchKey: hint.id,
          formatted: formatEntityCard(hint.card),
        });
      }
    }
  }

  for (const layer of route.layers) {
    layersHit.push(layer);
    const k = topK[layer] || 10;
    switch (layer) {
      case 'L0':
        layers.L0 = buildL0Results(store, query, queryTokens, k);
        break;
      case 'L1':
        layers.L1 = buildL1Results(store, query, queryTokens, k, mergedEntities, retrievalClass);
        break;
      case 'L2-mage':
        layers['L2-mage'] = buildL2MageResults(store, query, queryTokens, k, l2Opts);
        break;
      case 'L2-universal':
        layers['L2-universal'] = buildL2UniversalResults(store, query, queryTokens, k);
        break;
      case 'L3':
        layers.L3 = buildL3Results(store, query, queryTokens, k, attrs);
        break;
      case 'L4':
        layers.L4 = buildL4Results(store, query, queryTokens, k);
        break;
      case 'L5':
        layers.L5 = buildL5Results(store, query, queryTokens, k, retrievalClass);
        break;
      default:
        if (layer.startsWith('L2-') && store.classSkillIndexes?.[layer]) {
          layers[layer] = buildL2RegistryResults(store, layer, query, queryTokens, k, l2Opts);
        }
        break;
    }
  }

  if (l6Analysis) {
    layers.L6 = l6Analysis;
    if (!layersHit.includes('L6')) layersHit.push('L6');
    if (layers.L3) {
      layers.L3.eligibility = l6Analysis.advancements;
    }
  }

  if (wizardState) {
    let extraContext = '';
    if (options.chargenState) {
      extraContext = buildChargenExtraContext(options.chargenState);
    }
    layers.wizard = {
      state: wizardState,
      context: formatWizardContext(wizardState, store, { ledgerContext: extraContext }),
    };
    if (!layersHit.includes('wizard')) layersHit.push('wizard');
  }

  let retrieval = {
    query,
    mode: route.mode,
    intent: route.intent,
    promptProfile: route.promptProfile,
    layersRequested: route.layers,
    layersHit,
    attrsParsed: attrs,
    hasSnapshot: !!l6Analysis,
    wizardState,
    retrievalClass,
    tier: retrievalClass ? getClassProfile(retrievalClass).tier : null,
    entities: mergedEntities,
    results: layers,
  };

  if (plan) {
    retrieval = applyPlanToRetrieval(
      retrieval,
      plan,
      store,
      query,
      queryTokens,
      l2Opts,
      snapshotNorm,
      goalOverride,
    );
  }

  return retrieval;
}

export function formatContext(retrieval) {
  const store = loadAdvisorStore();
  const lines = [];
  lines.push(`# 检索上下文（模式: ${retrieval.mode || 'advisor'}；意图: ${retrieval.intent}）`);
  if (retrieval.retrievalClass) {
    lines.push(`当前职业: ${retrieval.retrievalClass}`);
    lines.push(formatTierAuditContext(retrieval.retrievalClass));
  } else if (retrieval.results._catalog?.length > 1 || retrieval.results._fullList?.length > 1) {
    const names = (retrieval.results._catalog || retrieval.results._fullList || [])
      .map((c) => c.className)
      .filter(Boolean);
    if (names.length) lines.push(`涉及职业: ${names.join('、')}`);
  }
  if (retrieval.answerStyle) {
    lines.push(`回答模式: ${retrieval.answerStyle}${retrieval.plan?.source ? `（规划: ${retrieval.plan.source}）` : ''}`);
  }
  lines.push(`问题: ${retrieval.query}`);
  lines.push('');

  if (retrieval.results.wizard?.context) {
    lines.push(retrieval.results.wizard.context);
    lines.push('');
  }

  if (retrieval.entities?.length) {
    lines.push('## 实体详情');
    for (const hit of retrieval.entities) {
      lines.push(hit.formatted || formatEntityCard(hit.card));
    }
    lines.push('');
  }

  if (retrieval.results.L6) {
    lines.push(formatSnapshotContext(retrieval.results.L6, {
      intent: retrieval.intent,
      query: retrieval.query,
    }));
    lines.push('');
  }

  if (retrieval.results._roadmapText) {
    lines.push(retrieval.results._roadmapText);
    lines.push('');
  }

  if (retrieval.results.L0) {
    lines.push('## L0 规则');
    for (const hit of retrieval.results.L0.hits || []) {
      lines.push(formatL0Hit(hit));
    }
    lines.push('');
  }

  if (retrieval.results.L1) {
    const l1 = retrieval.results.L1;
    lines.push('## L1 车卡');
    if (l1.classBasics) {
      const basicsLabel = l1.className || (retrieval.retrievalClass) || '职业';
      lines.push(`### ${basicsLabel}职业基础（角色创建页）`);
      lines.push(l1.classBasics);
    }
    const entityRaceIds = new Set(
      (retrieval.entities || []).filter((e) => e.entityType === 'race').map((e) => e.id),
    );
    const entityBgIds = new Set(
      (retrieval.entities || []).filter((e) => e.entityType === 'background').map((e) => e.id),
    );
    if (l1.primaryAttr) lines.push(`- 关键属性: ${l1.primaryAttr.name} 目标 ${l1.primaryAttr.targetAtCreation}`);
    for (const r of (l1.races || []).slice(0, 5)) {
      if (entityRaceIds.has(r.name)) continue;
      lines.push(`- 种族: ${r.name} 智力${r.intBonus ?? '?'}`);
    }
    for (const b of (l1.backgrounds || []).slice(0, 5)) {
      if (entityBgIds.has(b.name)) continue;
      lines.push(`- 背景: ${b.name} 技能${(b.skills || []).join('、')}`);
    }
    for (const h of l1.styleHints || []) lines.push(`- 风格 ${h.name}: ${h.summary || h.sampleSkills?.join('、')}`);
    lines.push('');
  }

  if (retrieval.results._catalog?.length) {
    lines.push('## 技能目录（catalog）');
    for (const cat of retrieval.results._catalog) {
      lines.push(`### ${cat.className}（共 ${cat.total} 项）`);
      for (const g of cat.groups || []) {
        const ex = (g.examples || []).map((e) => e.name).join('、');
        lines.push(`- ${g.style} · ${g.tier}：${g.count} 项；例：${ex || '—'}`);
      }
      lines.push('');
    }
  }

  if (retrieval.results._fullList?.length) {
    lines.push('## 技能完整列表（full_list）');
    for (const fl of retrieval.results._fullList) {
      lines.push(`### ${fl.className}（共 ${fl.total} 项）`);
      for (const [style, items] of Object.entries(fl.byStyle || {})) {
        lines.push(`#### ${style}`);
        for (const s of items.slice(0, 40)) {
          lines.push(`- ${s.name} [${s.tier}] ${s.summary || ''}`);
        }
        if (items.length > 40) lines.push(`  … 另有 ${items.length - 40} 项`);
      }
      lines.push('');
    }
  }

  if (retrieval.results['L2-mage']?.length) {
    lines.push('## L2 法师技能');
    for (const s of retrieval.results['L2-mage'].slice(0, 15)) {
      lines.push(`- ${s.name} [${s.style || '起手'}·${s.tier || '-'}] ${s.summary?.slice(0, 120) || ''}`);
      if (s.choicesFrom) lines.push(`  抉择: ${s.choicesFrom}`);
    }
    lines.push('');
  }

  for (const entry of listL2ClassEntries()) {
    const hits = retrieval.results[entry.l2Layer];
    if (!hits?.length) continue;
    lines.push(`## L2 ${entry.className}技能`);
    for (const s of hits.slice(0, 15)) {
      lines.push(`- ${s.name} [${s.style || '起手'}·${s.tier || '-'}] ${s.summary?.slice(0, 120) || ''}`);
      if (s.prerequisite) lines.push(`  前置: ${String(s.prerequisite).slice(0, 100)}`);
      if (s.choicesFrom) lines.push(`  抉择: ${s.choicesFrom}`);
    }
    const note = store.classBasicsByName?.[entry.className]?.advisorPartialNote;
    if (note) lines.push(`（${note}）`);
    lines.push('');
  }

  if (retrieval.results['L2-universal']?.length) {
    lines.push('## L2 通用天赋');
    for (const s of retrieval.results['L2-universal'].slice(0, 12)) {
      lines.push(`- ${s.name}: ${s.summary?.slice(0, 100) || ''}`);
    }
    lines.push('');
  }

  if (retrieval.results.L3) {
    const roadmapMode = retrieval.intent === 'build_roadmap' || retrieval.answerStyle === 'roadmap';
    lines.push('## L3 进阶');
    for (const a of retrieval.results.L3.advancements || []) {
      const doc = retrieval.results.L3.documentedSkills?.find((d) => d.advancementName === a.name || d.name === a.name);
      const conf = doc ? 'documented' : a.confidence;
      lines.push(`- ${a.name} [${a.scope}] 属性${JSON.stringify(a.attrsRequired)} 置信度${conf}`);
      if (doc) {
        if (roadmapMode) {
          const brief = briefAdvancementTalents(a.name);
          if (brief?.abilityNames?.length) {
            lines.push(`  天赋名（路线模式·勿展开）：${brief.abilityNames.join('、')}`);
          }
          for (const ins of brief?.insightMilestones || []) {
            lines.push(`  · 心得节点·${ins.name}：${ins.summary.slice(0, 120)}`);
          }
        } else {
          lines.push(`  描述: ${doc.description?.slice(0, 160) || ''}`);
          for (const t of (doc.talents || []).slice(0, 6)) {
            lines.push(`  · ${t.name}（${t.kind}）: ${(t.summary || '').slice(0, 140)}`);
          }
        }
      } else {
        lines.push(`  ${a.inferenceBlurb}`);
      }
    }
    for (const e of retrieval.results.L3.eligibility || []) {
      lines.push(`- 达标检测 ${e.advancementName}: ${e.eligible ? '✓' : '✗'} gaps=${JSON.stringify(e.gaps)}`);
    }
    lines.push('');
  }

  if (retrieval.results.L4?.length) {
    lines.push('## L4 专长');
    for (const f of retrieval.results.L4.slice(0, 10)) {
      lines.push(`- ${f.name}: ${f.summary?.slice(0, 100) || ''}`);
    }
    lines.push('');
  }

  if (retrieval.results.L5?.length) {
    lines.push('## L5 小贴士');
    for (const t of retrieval.results.L5.slice(0, 8)) {
      const scope = t.scope ? `[${t.scope}] ` : '';
      lines.push(`- ${scope}${t.title}: ${t.summary}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('硬规则: 仅引用上文出现的名称；进阶 metadata_only 须免责声明；标识由 DM 结算。');
  return lines.join('\n');
}

function mainCli() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!query) {
    console.error('Usage: node scripts/advisor-retrieve.mjs [--json] "你的问题"');
    process.exit(1);
  }
  const result = retrieve(query);
  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatContext(result));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mainCli();
}
