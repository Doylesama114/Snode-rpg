/**
 * Build Advisor — retrieval index (Phase 5).
 * Loads advisor JSON layers and exposes search + intent routing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAdvancementEligibility } from './advisor-eligibility.mjs';
import { analyzeSnapshot, normalizeSnapshot, formatSnapshotContext } from './advisor-snapshot.mjs';
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

export { routeIntent, routeQuery } from './advisor-router.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');

const STYLE_NAMES = ['塑能', '咒法', '预言', '防护', '附魔', '死灵', '幻术', '变化'];

let _cache = null;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

export function loadAdvisorStore() {
  if (_cache) return _cache;
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
    universalSkills: loadJson('skills/universal_index.json'),
    advancements: loadJson('advancements.json'),
    advancementSkills: fs.existsSync(path.join(ADVISOR, 'advancement_skills.json'))
      ? loadJson('advancement_skills.json')
      : { byName: {} },
    feats: loadJson('feats.json'),
    tips: loadJson('combos/mage_tips.json'),
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
  for (const kw of ['兼职', '专长', '进阶', '标识', '塑能', '咒法', '通用', '种族', '背景', '智力', '冰霜', '火球', '飞弹', 'combo', '小贴士']) {
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

function parseAttrsFromQuery(query) {
  const attrs = {};
  const intM = query.match(/智力\s*(\d+)/);
  if (intM) attrs.智力 = Number(intM[1]);
  return attrs;
}

function pickAdvancementName(query) {
  const store = loadAdvisorStore();
  for (const adv of store.advancements.advancements) {
    if (query.includes(adv.name)) return adv.name;
  }
  if (/冰霜/.test(query)) return '冰霜法师';
  return null;
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

function buildL1Results(store, query, queryTokens, limit, entityHits = []) {
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

  const styles = detectStyles(query);
  let styleHints = store.mageHints.styleHints || [];
  if (styles.length) {
    styleHints = styleHints.filter((h) => styles.includes(h.name));
  } else if (/风格|流派|咒法|塑能/.test(query)) {
    styleHints = styleHints.slice(0, 4);
  }

  const entityTypes = new Set(entityHits.map((e) => e.entityType));
  const skipClassBasics = entityHits.length > 0
    && !entityTypes.has('class')
    && !/武器|护甲|专精|起手|装备|创建|车卡|法师|初始|购点|输出|怎么选/.test(query);
  const includeClassBasics = !skipClassBasics
    && (/武器|护甲|熟练|豁免|专精|起手|装备|创建|车卡|法师.*(能|会|可以)|初始|购点|种族|背景|输出|怎么选/.test(query)
      || limit >= 4);

  return {
    primaryAttr: store.mageHints.primaryAttr,
    recommendedRaces: store.mageHints.recommendedRaces,
    recommendedBackgrounds: store.mageHints.recommendedBackgrounds?.slice(0, 8),
    classBasics: includeClassBasics ? formatMageClassBasics(store, query) : null,
    races,
    backgrounds,
    styleHints,
    combatStyles: styles.length
      ? (store.mageClass.combatStyles || []).filter((s) => styles.includes(s.name))
      : [],
  };
}

function buildL2MageResults(store, query, queryTokens, limit) {
  const styles = detectStyles(query);
  const tierFilter = /1[～~\-—到]3|1\s*~\s*3|一级|二级|三级|低阶|初期|前三级|优先学/.test(query);
  const byName = Object.fromEntries(store.mageSkills.skills.map((s) => [s.name, s]));

  let ranked = searchList(
    store.mageSkills.skills,
    (s) => s.searchText || `${s.name} ${s.style} ${s.summary}`,
    queryTokens,
    limit,
    (s) => {
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
  const advName = pickAdvancementName(query);
  let items = store.advancements.advancements;

  if (advName) {
    items = items.filter((a) => a.name.includes(advName) || advName.includes(a.name));
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

function buildL5Results(store, query, queryTokens, limit) {
  const styles = detectStyles(query);
  return searchList(
    store.tips.tips,
    (t) => t.searchText || `${t.title} ${t.summary} ${t.detail}`,
    queryTokens,
    limit,
    styles.length ? (t) => !t.style || styles.includes(t.style) : () => true,
  );
}

/**
 * @param {string} query user question
 * @param {{ topK?: Record<string, number>, snapshot?: object, mode?: string, wizardState?: object }} options
 */
export function retrieve(query, options = {}) {
  const store = loadAdvisorStore();
  const wizardState = normalizeWizardState(options.wizardState);
  const entityHits = resolveEntities(query, store.entities);
  const route = routeQuery({
    query,
    mode: options.mode,
    entityHits,
    wizardState,
  });
  const queryTokens = tokenize(query);
  const topK = { ...route.topK, ...options.topK };
  let attrs = parseAttrsFromQuery(query);

  let l6Analysis = null;
  if (options.snapshot) {
    const norm = options.snapshot.meta?.layer === 'L6'
      ? options.snapshot
      : normalizeSnapshot(options.snapshot);
    const advName = pickAdvancementName(query);
    l6Analysis = analyzeSnapshot(norm, {
      advancementNames: advName ? [advName] : null,
    });
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
        layers.L1 = buildL1Results(store, query, queryTokens, k, mergedEntities);
        break;
      case 'L2-mage':
        layers['L2-mage'] = buildL2MageResults(store, query, queryTokens, k);
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
        layers.L5 = buildL5Results(store, query, queryTokens, k);
        break;
      default:
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
    layers.wizard = {
      state: wizardState,
      context: formatWizardContext(wizardState, store),
    };
    if (!layersHit.includes('wizard')) layersHit.push('wizard');
  }

  return {
    query,
    mode: route.mode,
    intent: route.intent,
    promptProfile: route.promptProfile,
    layersRequested: route.layers,
    layersHit,
    attrsParsed: attrs,
    hasSnapshot: !!l6Analysis,
    wizardState,
    entities: mergedEntities,
    results: layers,
  };
}

export function formatContext(retrieval) {
  const lines = [];
  lines.push(`# 检索上下文（模式: ${retrieval.mode || 'advisor'}；意图: ${retrieval.intent}）`);
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
    lines.push(formatSnapshotContext(retrieval.results.L6));
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
      lines.push('### 法师职业基础（角色创建页）');
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

  if (retrieval.results['L2-mage']?.length) {
    lines.push('## L2 法师技能');
    for (const s of retrieval.results['L2-mage'].slice(0, 15)) {
      lines.push(`- ${s.name} [${s.style || '起手'}·${s.tier || '-'}] ${s.summary?.slice(0, 120) || ''}`);
      if (s.choicesFrom) lines.push(`  抉择: ${s.choicesFrom}`);
    }
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
    lines.push('## L3 进阶');
    for (const a of retrieval.results.L3.advancements || []) {
      const doc = retrieval.results.L3.documentedSkills?.find((d) => d.advancementName === a.name || d.name === a.name);
      const conf = doc ? 'documented' : a.confidence;
      lines.push(`- ${a.name} [${a.scope}] 属性${JSON.stringify(a.attrsRequired)} 置信度${conf}`);
      if (doc) {
        lines.push(`  描述: ${doc.description?.slice(0, 160) || ''}`);
        for (const t of (doc.talents || []).slice(0, 6)) {
          lines.push(`  · ${t.name}（${t.kind}）: ${(t.summary || '').slice(0, 140)}`);
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
      lines.push(`- ${t.title}: ${t.summary}`);
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
