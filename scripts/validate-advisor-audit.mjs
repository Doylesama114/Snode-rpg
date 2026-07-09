#!/usr/bin/env node
/**
 * Advisor 5.0 — multi-angle retrieval audit (no LLM).
 * Run: node scripts/validate-advisor-audit.mjs
 */
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { loadAdvisorStore } from './advisor-retrieve.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CASES = [
  {
    id: 'user-hp-max',
    category: 'chargen_optimization',
    query: '在创建角色时，怎样构筑可以使我的角色初始血量达到最大值',
    expectInContext: ['hpFormula', '体质', 'hpBonus', '生命'],
    corpusPaths: ['advisor/chargen/races.json', 'advisor/chargen/*_class.json'],
  },
  {
    id: 'user-mage-knowledge',
    category: 'progression_plan',
    query: '我想让我的法师能够获取到几乎所有的知识，奥秘的熟练项，我最少升到多少级，学习哪些技能可以做到',
    expectInContext: ['知识', '奥秘', '奥法学者', '知识传承', '熟练项获取路线'],
  },
  {
    id: 'user-attack-bonus',
    category: 'combat_math',
    query: '我的角色力量调整值为+3，有一点剑类熟练度，拿着一把伤害为1d8的双手剑，开启了魔法武器，锐化武器，狂怒术，这个时候我的命中加值是多少',
    expectInContext: ['魔法武器', '锐化武器', '狂怒术', 'combat_basics.json', '+7'],
    corpusNote: '需要战斗规则引擎 + 技能效果结构化字段',
  },
  {
    id: 'user-skill-overlap',
    category: 'cross_class_compare',
    query: '法师和吟游诗人有哪些相同的技能',
    expectInContext: ['相同', '舞光术', '油腻术'],
    toolNeeded: 'intersectSkillNames(mage, bard)',
  },
  {
    id: 'user-thief-trade',
    category: 'skill_mechanics',
    query: '窃贼的交易这个技能我一共可以得到多少收益，与此同时我需要支付的代价又是多少',
    expectInContext: ['窃贼的交易', '生命值上限', '自由属性点'],
  },
  // Extra tricky cases
  {
    id: 'extra-hammer-prof',
    category: 'cross_class_lookup',
    query: '哪些初始职业的武器熟练度包含锤子',
    expectInContext: ['锤类', '战士', '牧师'],
  },
  {
    id: 'extra-guishushi',
    category: 'advancement_prereq',
    query: '我想进阶诡术士，我基础职业应该选择什么',
    expectInContext: ['诡术师', '游荡者', '不等于仅法师'],
  },
  {
    id: 'extra-silence-counter',
    category: 'status_rules',
    query: '沉默状态具体有什么效果，哪些技能可以造成沉默',
    expectInContext: ['沉默', 'status_conditions.json'],
  },
  {
    id: 'extra-multiclass-mage',
    category: 'multiclass',
    query: '7级战士想兼职法师需要满足什么条件',
    expectInContext: ['兼职', '逻辑', '奥秘', '智力'],
  },
  {
    id: 'extra-level-rewards',
    category: 'leveling',
    query: '主职从3级升到6级一共获得什么奖励',
    expectInContext: ['熟练', '技能槽', 'L4', '专长'],
  },
  {
    id: 'extra-feat-timing',
    category: 'feats',
    query: '特殊专长可以在哪些等级获取',
    expectInContext: ['L4', 'L8', 'L13', '专长'],
  },
  {
    id: 'extra-unknown-adv',
    category: 'unknown_gate',
    query: '元素大师怎么规划成长路线',
    expectInContext: ['未收录', '元素大师'],
  },
  {
    id: 'extra-duplicate-skill-name',
    category: 'disambiguation',
    query: '魔法武器这个技能哪些职业可以学，效果一样吗',
    expectInContext: ['魔法武器', '法师', '奇械师'],
  },
  {
    id: 'extra-point-buy',
    category: 'chargen_math',
    query: '32点购点怎样分配才能让法师智力达到15且体质尽量高',
    expectInContext: ['购点', '32', '智力', '15'],
  },
  {
    id: 'extra-sp-mark',
    category: 'sp_rules',
    query: '学习带紫色标识的三阶技能需要多少SP',
    expectInContext: ['紫色', 'SP', '标识'],
  },
  // --- 7069 extended audit (≥3 per category A–I) ---
  {
    id: 'extra-race-vampire',
    category: 'entity_qa',
    query: '吸血鬼种族有什么特性',
    expectInContext: ['吸血鬼', '特性', '种族'],
  },
  {
    id: 'extra-skill-fireball',
    category: 'entity_qa',
    query: '火球术这个技能效果是什么',
    expectInContext: ['火球', '塑能'],
  },
  {
    id: 'extra-priest-starting-gear',
    category: 'chargen_build',
    query: '牧师创建角色时起始装备有哪些',
    expectInContext: ['牧师', '装备', '起始'],
  },
  {
    id: 'extra-chargen-armor',
    category: 'chargen_build',
    query: '法师创建角色可以选哪些护甲',
    expectInContext: ['法师', '护甲', '轻甲'],
  },
  {
    id: 'extra-thief-roadmap',
    category: 'growth_planning',
    query: '我想玩飞贼，我该怎么安排我的成长路线',
    expectInContext: ['飞贼', '游荡者', '路线'],
  },
  {
    id: 'extra-magic-sword-roadmap',
    category: 'growth_planning',
    query: '魔剑士怎么规划成长路线',
    expectInContext: ['魔剑', '法师', '战士'],
  },
  {
    id: 'extra-adv-eligibility',
    category: 'growth_planning',
    query: '我想进阶诡术师需要满足什么属性',
    expectInContext: ['诡术师', '智力', '属性'],
  },
  {
    id: 'extra-prof-cap-l5',
    category: 'progression_proficiency',
    query: '法师5级时单项熟练上限是多少',
    expectInContext: ['L5', '熟练', 'prof'],
  },
  {
    id: 'extra-combat-ranged',
    category: 'combat_math',
    query: '我的角色敏捷调整值为+2，有一点弓箭熟练度，远程攻击命中加值是多少',
    expectInContext: ['敏捷', '弓箭', '+5', '类别增益'],
  },
  {
    id: 'extra-multiclass-artificer',
    category: 'rules_query',
    query: '7级法师想兼职奇械师需要满足什么条件',
    expectInContext: ['奇械师', '兼职', '巧手'],
  },
  {
    id: 'extra-leveling-l10',
    category: 'rules_query',
    query: '主职从8级升到10级一共获得什么奖励',
    expectInContext: ['L10', '熟练', '专长'],
  },
  {
    id: 'extra-status-stun',
    category: 'rules_query',
    query: '震慑状态有什么效果',
    expectInContext: ['震慑', 'status'],
  },
  {
    id: 'snap-build-review',
    category: 'panel_snapshot',
    query: '怎么评价我当前的build',
    snapshotFile: 'advisor/snapshots/mock-magic-sword-l6.json',
    expectInContext: ['L6', '芙兰', '法师'],
  },
  {
    id: 'snap-prof-roadmap',
    category: 'panel_snapshot',
    query: '我还缺哪些知识奥秘熟练项，最少升到多少级',
    snapshotFile: 'advisor/snapshots/mock-magic-sword-l6.json',
    expectInContext: ['L6 快照联动', '熟练项获取路线', '奥秘'],
  },
  {
    id: 'snap-combat-hit',
    category: 'panel_snapshot',
    query: '我开启了魔法武器和狂怒术，拿着双手剑，命中加值是多少',
    snapshotFile: 'advisor/snapshots/mock-combat-warrior-l6.json',
    expectInContext: ['L6 快照联动', '战斗命中演算', '+7'],
  },
  {
    id: 'extra-unknown-dragon',
    category: 'unknown_gate',
    query: '龙骑士怎么规划成长路线',
    expectInContext: ['未收录', '龙骑士'],
  },
  {
    id: 'extra-unknown-skill',
    category: 'unknown_gate',
    query: '宇宙射线这个技能效果是什么',
    expectInContext: ['宇宙射线'],
  },
  {
    id: 'extra-bard-mage-diff',
    category: 'cross_entity_compare',
    query: '吟游诗人和法师有哪些不同的技能',
    expectInContext: ['吟游诗人', '法师', '技能'],
  },
  {
    id: 'extra-warrior-skills',
    category: 'cross_entity_compare',
    query: '战士有哪些一阶战技可以选择',
    expectInContext: ['战士', '一阶', '战技'],
  },
  {
    id: 'extra-equip-purify',
    category: 'equipment_lookup',
    query: '净化水袋有什么效果',
    expectInContext: ['净化水袋', 'equipment_catalog_index', '净化'],
  },
  {
    id: 'extra-equip-mage-armor',
    category: 'equipment_search',
    query: '法师可以选哪些护甲',
    expectInContext: ['护甲', '布衣', '装备/物品检索'],
  },
  {
    id: 'extra-consumable-potion',
    category: 'equipment_lookup',
    query: '活力药水多少钱',
    expectInContext: ['活力药水', '价格', 'Tools 层'],
  },
  {
    id: 'user-damage-bonus',
    category: 'combat_math',
    query: '我的角色力量调整值为+3，拿着一把伤害为1d8的双手剑，开启了狂怒术，伤害加值是多少',
    expectInContext: ['伤害 flat 加值', '1d8', '+5', '狂怒术'],
  },
  {
    id: 'extra-bg-deities',
    category: 'background_detail',
    query: '侍僧背景可以侍奉哪些神祇',
    expectInContext: ['侍僧', '可侍奉神祇', '公正与荣耀之神', 'bg_personality'],
  },
  {
    id: 'extra-ac-leather',
    category: 'combat_math',
    query: '敏捷调整值+2穿着皮甲护甲值是多少',
    expectInContext: ['护甲值演算', 'AC', '13', '皮甲'],
  },
  {
    id: 'extra-ac-shield',
    category: 'combat_math',
    query: '敏捷调整值+2穿着皮甲和小圆盾防御等级是多少',
    expectInContext: ['护甲值演算', '15', '盾牌'],
  },
  {
    id: 'extra-combat-full',
    category: 'combat_math',
    query: '力量调整值+3有一点剑类熟练拿着1d8双手剑开启狂怒术命中和伤害加值分别是多少',
    expectInContext: ['战斗命中演算', '伤害 flat 加值', '+6', '+5'],
  },
  {
    id: 'extra-prof-religion',
    category: 'proficiency_lookup',
    query: '哪些初始职业可以在创建时选择宗教熟练',
    expectInContext: ['熟练项职业对照', '宗教', '牧师', '德鲁伊'],
  },
  {
    id: 'snap-ac-armor',
    category: 'combat_math',
    query: '我的护甲值是多少',
    snapshotFile: 'advisor/snapshots/mock-combat-warrior-l6.json',
    expectInContext: ['护甲值演算', '13', 'L6 快照联动', '皮甲'],
  },
  {
    id: 'extra-bg-soldier-chargen',
    category: 'background_chargen',
    query: '士兵背景起始装备和金币有哪些',
    expectInContext: ['士兵', '背景车卡', '金币'],
  },
  {
    id: 'extra-race-vampire-detail',
    category: 'race_detail',
    query: '吸血鬼种族有什么特性',
    expectInContext: ['血族', '饮血者', '种族特性', 'Tools 层'],
  },
  // --- 7075 batch11 feedback pipeline regressions ---
  {
    id: 'feedback-pending-bg-deities',
    category: 'entity_qa',
    query: '侍僧背景可以侍奉哪些神祇',
    expectInContext: ['侍僧', '公正与荣耀之神', '可侍奉神祇'],
  },
  {
    id: 'feedback-pending-priest-gear',
    category: 'chargen_build',
    query: '牧师创建角色时起始装备有哪些',
    expectInContext: ['起始装备', '轻锤', '套装'],
  },
  {
    id: 'feedback-pending-soldier-bg',
    category: 'chargen_build',
    query: '士兵背景起始装备和金币有哪些',
    expectInContext: ['士兵', '背景车卡', '金币'],
  },
  // --- 7076 batch12 combat Phase 3 ---
  {
    id: 'extra-combat-axe-crit',
    category: 'combat_math',
    query: '力量调整值+3有一点斧类熟练拿着1d10双手斧命中和暴击加值分别是多少',
    expectInContext: ['战斗命中演算', '暴击率', '+4', '斧类'],
  },
  {
    id: 'extra-combat-aim-shot',
    category: 'combat_math',
    query: '敏捷调整值+2有一点弓箭熟练远程攻击开启瞄准射击 L8 命中加值是多少',
    expectInContext: ['瞄准射击', '弓箭类别增益', '+10'],
  },
  {
    id: 'snap-combat-buffs-skills',
    category: 'panel_snapshot',
    query: '拿着双手剑，命中加值是多少',
    snapshotFile: 'advisor/snapshots/mock-combat-warrior-l6.json',
    expectInContext: ['L6 快照联动', '魔法武器', '狂怒术', '+7', '战斗 Buff 自快照'],
  },
  // --- 7077 batch13 proficiency roadmap generalize ---
  {
    id: 'extra-prof-cleric-religion',
    category: 'progression_plan',
    query: '牧师怎样获取宗教和自然熟练项最少升到多少级',
    expectInContext: ['熟练项获取路线', '宗教', '自然', '牧师'],
  },
  {
    id: 'extra-prof-rogue-deft',
    category: 'progression_plan',
    query: '游荡者怎样获取几乎所有巧手熟练项最少升到多少级',
    expectInContext: ['熟练项获取路线', '巧手', '巧手-开锁', '游荡者'],
  },
  {
    id: 'snap-prof-rogue-deft',
    category: 'panel_snapshot',
    query: '我还缺哪些巧手熟练项，最少升到多少级',
    snapshotFile: 'advisor/snapshots/mock-rogue-l6.json',
    expectInContext: ['L6 快照联动', '熟练项获取路线', '巧手', '巧手-开锁'],
  },
  // --- 7078 batch14 combat Phase 4 AC buffs + modifiers ---
  {
    id: 'extra-ac-guardian-seal',
    category: 'combat_math',
    query: '敏捷调整值+2穿着皮甲开启守护刻印护甲值是多少',
    expectInContext: ['护甲值演算', '守护刻印', '15', '皮甲'],
  },
  {
    id: 'extra-combat-penetrate-shot',
    category: 'combat_math',
    query: '敏捷调整值+2有一点弓箭熟练远程攻击开启穿透射击 L6 命中加值是多少',
    expectInContext: ['战斗命中演算', '穿透射击', '+10', '弓箭类别增益'],
  },
  {
    id: 'snap-ac-cleric-seal',
    category: 'panel_snapshot',
    query: '我开启了守护刻印，护甲值是多少',
    snapshotFile: 'advisor/snapshots/mock-cleric-l6.json',
    expectInContext: ['L6 快照联动', '护甲值演算', '守护刻印', '15', 'AC/战斗 Buff 自快照'],
  },
  // --- 7079 batch15 build_review Tools layer ---
  {
    id: 'extra-build-review-magic-sword',
    category: 'panel_snapshot',
    query: '怎么评价我当前的build，如果我想进阶魔剑士，还有没有什么适合我的技能',
    snapshotFile: 'advisor/snapshots/mock-magic-sword-l6.json',
    expectInContext: ['Build 评价', '魔剑士', '战吼术', '芙兰'],
  },
  {
    id: 'snap-build-review-tools',
    category: 'panel_snapshot',
    query: '怎么评价我当前的build',
    snapshotFile: 'advisor/snapshots/mock-magic-sword-l6.json',
    expectInContext: ['Build 评价', 'Tools 层', '可学技能位阶', '四阶'],
  },
  {
    id: 'extra-build-review-cleric',
    category: 'panel_snapshot',
    query: '怎么评价我当前的build还有什么技能适合我',
    snapshotFile: 'advisor/snapshots/mock-cleric-l6.json',
    expectInContext: ['Build 评价', '牧师', '艾拉', '强效治疗术', 'L2 抽样'],
  },
  // --- 7080 batch16 combat modifiers + build_review no-kit ---
  {
    id: 'extra-combat-charged-shot',
    category: 'combat_math',
    query: '敏捷调整值+2有一点弓箭熟练远程攻击额外花费主要动作开启蓄力劲射命中加值是多少',
    expectInContext: ['战斗命中演算', '蓄力劲射', '+10', '弓箭类别增益'],
  },
  {
    id: 'extra-ac-barkskin',
    category: 'combat_math',
    query: '敏捷调整值+2未穿护甲开启树皮术护甲值是多少',
    expectInContext: ['护甲值演算', '树皮术', '13'],
  },
  {
    id: 'extra-combat-cobra-poison',
    category: 'combat_math',
    query: '敏捷调整值+2有一点弓箭熟练远程攻击目标处于中毒状态开启眼镜蛇射击命中加值是多少',
    expectInContext: ['战斗命中演算', '眼镜蛇射击', '+12', '中毒'],
  },
  // --- 7081 batch17 conditional + proficiency modifiers + L2 scan ---
  {
    id: 'extra-combat-crusader-strike',
    category: 'combat_math',
    query: '力量调整值+3剑类熟练近战攻击目标阵营相反开启十字军打击命中加值是多少',
    expectInContext: ['战斗命中演算', '十字军打击', '+6', '阵营相反'],
  },
  {
    id: 'extra-combat-divine-hammer',
    category: 'combat_math',
    query: '力量调整值+2宗教熟练2点有一点剑类熟练近战攻击开启神力战槌命中加值是多少',
    expectInContext: ['战斗命中演算', '神力战槌', '+5', '宗教'],
  },
  {
    id: 'snap-combat-cleric-hammer',
    category: 'panel_snapshot',
    query: '我开启了神力战槌，近战攻击命中加值是多少',
    snapshotFile: 'advisor/snapshots/mock-cleric-l6.json',
    expectInContext: ['L6 快照联动', '战斗命中演算', '神力战槌', '+4', '宗教'],
  },
  // --- 7082 batch18 scan corpus + build_review multiclass ---
  {
    id: 'extra-combat-gun-forest-extreme',
    category: 'combat_math',
    query: '力量调整值+3有一点长柄熟练近战攻击开启枪影如林·极命中加值是多少',
    expectInContext: ['战斗命中演算', '枪影如林·极', '+6'],
  },
  {
    id: 'extra-ac-drunken-stagger',
    category: 'combat_math',
    query: '敏捷调整值+2未穿护甲处于醉酒状态开启酩酊大醉护甲值是多少',
    expectInContext: ['护甲值演算', '酩酊大醉', '13', '醉酒'],
  },
  {
    id: 'snap-build-review-multiclass',
    category: 'panel_snapshot',
    query: '怎么评价我当前的build，如果我想进阶魔剑士，还有没有什么适合我的技能',
    snapshotFile: 'advisor/snapshots/mock-magic-sword-l6.json',
    expectInContext: ['Build 评价', '**法师**', '**战士**', '战吼术', '芙兰'],
  },
  // --- 7084 batch20 engine Phase 6 + Tier-A/B bulk ---
  {
    id: 'extra-combat-long-range-shot',
    category: 'combat_math',
    query: '敏捷调整值+2有一点弓箭熟练远程攻击开启远效射击命中加值是多少',
    expectInContext: ['战斗命中演算', '远效射击', '+10', '弓箭类别增益'],
  },
  {
    id: 'extra-ac-spell-deflect',
    category: 'combat_math',
    query: '敏捷调整值+2未穿护甲花费反应动作开启法术偏斜护甲值是多少',
    expectInContext: ['护甲值演算', '法术偏斜', '16', '反应'],
  },
  {
    id: 'extra-ac-banner-evil',
    category: 'combat_math',
    query: '敏捷调整值+2穿着皮甲受到邪恶阵营攻击开启破邪战旗护甲值是多少',
    expectInContext: ['护甲值演算', '破邪战旗', '14', '邪恶阵营'],
  },
  // --- 7085 batch21 advantage + target AC debuff ---
  {
    id: 'extra-combat-aim-scope-adv',
    category: 'combat_math',
    query: '敏捷调整值+2有一点弓箭熟练远程攻击装备辅助瞄准镜命中加值是多少',
    expectInContext: ['战斗命中演算', '辅助瞄准镜', '优势', '+5'],
  },
  {
    id: 'extra-combat-power-boon-adv',
    category: 'combat_math',
    query: '力量调整值+3有一点剑类熟练近战攻击开启力量报偿命中加值是多少',
    expectInContext: ['战斗命中演算', '力量报偿', '优势', '+4'],
  },
  {
    id: 'extra-target-ac-corrosion',
    category: 'combat_math',
    query: '目标穿着重甲受到腐蚀术，防御等级是多少',
    expectInContext: ['护甲值演算', '腐蚀术', '13', '目标 AC debuff'],
  },
];

function corpusHas(store, term) {
  const dir = path.join(ROOT, 'advisor');
  const hits = [];
  function scanFile(fp) {
    try {
      const t = fs.readFileSync(fp, 'utf8');
      if (t.includes(term)) hits.push(path.relative(ROOT, fp));
    } catch { /* skip */ }
  }
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if (f.endsWith('.json')) scanFile(fp);
    }
  }
  walk(dir);
  return hits.slice(0, 5);
}

function skillOverlap(classA, classB, store) {
  const idxA = store.mageSkills?.skills;
  const idxB = store.classSkillIndexes?.['L2-bard']?.skills;
  if (!idxA || !idxB) return [];
  const namesB = new Set(idxB.map((s) => s.name));
  return idxA.filter((s) => namesB.has(s.name)).map((s) => s.name).sort();
}

function scoreContext(ctx, terms) {
  const found = [];
  const missing = [];
  for (const t of terms) {
    if (ctx.includes(t)) found.push(t);
    else missing.push(t);
  }
  return { found, missing, ratio: terms.length ? found.length / terms.length : 0 };
}

function classifyGap(c, ctxScore, store) {
  const opts = c.snapshotFile ? { snapshot: loadSnapshotFile(c.snapshotFile) } : {};
  const r = retrieve(c.query, opts);
  const ctx = formatContext(r);

  if (r.intent === 'skill_detail' && c.id === 'user-thief-trade') return ctx.includes('窃贼的交易') ? 'OK' : 'RETRIEVAL_GAP';
  if (r.intent === 'cross_class_compare' && c.id === 'user-skill-overlap') return ctx.includes('跨职业同名技能') ? 'OK' : 'RETRIEVAL_GAP';
  if (r.intent === 'class_weapon_prof' && c.id === 'extra-hammer-prof') return ctx.includes('锤类') ? 'OK' : 'RETRIEVAL_GAP';
  if (r.intent === 'chargen_hp_optimize' && c.id === 'user-hp-max') {
    return ctx.includes('L1 初始 HP') && ctx.includes('推荐组合') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (r.intent === 'proficiency_roadmap' && c.id === 'user-mage-knowledge') {
    return ctx.includes('熟练项获取路线') && ctx.includes('奥法学者') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (r.intent === 'status_rules' && c.id === 'extra-silence-counter') {
    return ctx.includes('status_conditions.json') && ctx.includes('沉默') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (r.intent === 'feat_timing' && c.id === 'extra-feat-timing') {
    return ctx.includes('L4') && ctx.includes('L8') && ctx.includes('L13') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (r.intent === 'unknown_entity' && c.id === 'extra-unknown-adv') {
    return ctx.includes('未收录') || ctx.includes('不在当前资料库') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (r.intent === 'skill_aggregate' && c.id === 'extra-duplicate-skill-name') {
    return ctx.includes('魔法武器') && ctx.includes('奇械师') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (r.intent === 'combat_math' && c.id === 'user-attack-bonus') {
    return ctx.includes('战斗命中演算') && ctx.includes('+7') ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'snap-combat-hit') {
    return ctx.includes('战斗命中演算') && ctx.includes('+7') && ctx.includes('L6 快照联动')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'snap-prof-roadmap') {
    return ctx.includes('L6 快照联动') && ctx.includes('熟练项获取路线') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'snap-build-review') {
    return (r.intent === 'build_review' || r.intent === 'build_roadmap')
      && ctx.includes('L6 角色快照') && ctx.includes('芙兰')
      && (ctx.includes('Build 评价') || ctx.includes('Build 路线图'))
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-combat-ranged') {
    return r.intent === 'combat_math' && ctx.includes('+5') && ctx.includes('弓箭类别增益')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-unknown-dragon') {
    return ctx.includes('未收录') || ctx.includes('不在当前资料库') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-thief-roadmap') {
    return ctx.includes('路线骨架') || ctx.includes('飞贼') ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-equip-purify') {
    return r.intent === 'equipment_lookup' && ctx.includes('净化水袋') && ctx.includes('Tools 层')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-equip-mage-armor') {
    return r.intent === 'equipment_search' && ctx.includes('装备/物品检索') && ctx.includes('布衣')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-consumable-potion') {
    return r.intent === 'equipment_lookup' && ctx.includes('活力药水') && ctx.includes('价格')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-point-buy') {
    return r.intent === 'point_buy_optimize' && ctx.includes('购点优化') && ctx.includes('智力') && ctx.includes('15')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-level-rewards') {
    return r.intent === 'leveling_summary' && ctx.includes('等级区间累计奖励') && ctx.includes('L4')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'user-damage-bonus') {
    return r.intent === 'combat_math' && ctx.includes('伤害 flat 加值') && ctx.includes('+5')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-bg-deities') {
    return r.intent === 'background_detail' && ctx.includes('侍僧') && ctx.includes('公正与荣耀之神')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-ac-leather') {
    return r.intent === 'combat_math' && ctx.includes('护甲值演算') && ctx.includes('13')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-ac-shield') {
    return r.intent === 'combat_math' && ctx.includes('护甲值演算') && ctx.includes('15') && ctx.includes('盾牌')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-full') {
    return r.intent === 'combat_math' && ctx.includes('战斗命中演算') && ctx.includes('伤害 flat 加值')
      && ctx.includes('+6') && ctx.includes('+5')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-prof-religion') {
    return r.intent === 'proficiency_lookup' && ctx.includes('牧师') && ctx.includes('德鲁伊')
      && ctx.includes('熟练项职业对照')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-priest-starting-gear') {
    return r.intent === 'starting_gear_lookup' && ctx.includes('起始装备') && ctx.includes('套装 A')
      && ctx.includes('轻锤')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'snap-ac-armor') {
    return r.intent === 'combat_math' && ctx.includes('护甲值演算') && ctx.includes('13')
      && ctx.includes('L6 快照联动')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-bg-soldier-chargen') {
    return r.intent === 'background_chargen' && ctx.includes('士兵') && ctx.includes('背景车卡')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-race-vampire-detail') {
    return r.intent === 'race_detail' && ctx.includes('血族') && ctx.includes('饮血者')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'feedback-pending-bg-deities') {
    return r.intent === 'background_detail' && ctx.includes('侍僧') && ctx.includes('公正与荣耀之神')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'feedback-pending-priest-gear') {
    return r.intent === 'starting_gear_lookup' && ctx.includes('起始装备') && ctx.includes('轻锤')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'feedback-pending-soldier-bg') {
    return r.intent === 'background_chargen' && ctx.includes('士兵') && ctx.includes('背景车卡')
      ? 'OK' : 'RETRIEVAL_GAP';
  }
  if (c.id === 'extra-combat-axe-crit') {
    return r.intent === 'combat_math' && ctx.includes('战斗命中演算') && ctx.includes('暴击率') && ctx.includes('+4')
      && ctx.includes('斧类')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-aim-shot') {
    return r.intent === 'combat_math' && ctx.includes('瞄准射击') && ctx.includes('+10') && ctx.includes('弓箭类别增益')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'snap-combat-buffs-skills') {
    return r.intent === 'combat_math' && ctx.includes('L6 快照联动') && ctx.includes('魔法武器')
      && ctx.includes('狂怒术') && ctx.includes('+7') && ctx.includes('战斗 Buff 自快照')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-prof-cleric-religion') {
    return r.intent === 'proficiency_roadmap' && ctx.includes('熟练项获取路线') && ctx.includes('宗教')
      && ctx.includes('自然') && ctx.includes('牧师')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'extra-prof-rogue-deft') {
    return r.intent === 'proficiency_roadmap' && ctx.includes('熟练项获取路线') && ctx.includes('巧手')
      && ctx.includes('巧手-开锁') && ctx.includes('游荡者')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'snap-prof-rogue-deft') {
    return r.intent === 'proficiency_roadmap' && ctx.includes('L6 快照联动') && ctx.includes('熟练项获取路线')
      && ctx.includes('巧手') && ctx.includes('巧手-开锁')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'extra-ac-guardian-seal') {
    return r.intent === 'combat_math' && ctx.includes('护甲值演算') && ctx.includes('守护刻印') && ctx.includes('15')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-penetrate-shot') {
    return r.intent === 'combat_math' && ctx.includes('穿透射击') && ctx.includes('+10') && ctx.includes('弓箭类别增益')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'snap-ac-cleric-seal') {
    return r.intent === 'combat_math' && ctx.includes('L6 快照联动') && ctx.includes('守护刻印') && ctx.includes('15')
      && ctx.includes('AC/战斗 Buff 自快照')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-build-review-magic-sword') {
    return r.intent === 'build_review' && ctx.includes('Build 评价') && ctx.includes('魔剑士')
      && ctx.includes('战吼术') && ctx.includes('芙兰')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'snap-build-review-tools') {
    return r.intent === 'build_review' && ctx.includes('Build 评价') && ctx.includes('Tools 层')
      && ctx.includes('可学技能位阶') && ctx.includes('四阶')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'extra-build-review-cleric') {
    return r.intent === 'build_review' && ctx.includes('Build 评价') && ctx.includes('牧师')
      && ctx.includes('艾拉') && ctx.includes('强效治疗术')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'extra-combat-charged-shot') {
    return r.intent === 'combat_math' && ctx.includes('蓄力劲射') && ctx.includes('+10')
      && ctx.includes('弓箭类别增益')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-ac-barkskin') {
    return r.intent === 'combat_math' && ctx.includes('护甲值演算') && ctx.includes('树皮术') && ctx.includes('13')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-cobra-poison') {
    return r.intent === 'combat_math' && ctx.includes('眼镜蛇射击') && ctx.includes('+12')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-crusader-strike') {
    return r.intent === 'combat_math' && ctx.includes('十字军打击') && ctx.includes('+6')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-divine-hammer') {
    return r.intent === 'combat_math' && ctx.includes('神力战槌') && ctx.includes('+5')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'snap-combat-cleric-hammer') {
    return r.intent === 'combat_math' && ctx.includes('L6 快照联动') && ctx.includes('神力战槌')
      && ctx.includes('+4') && ctx.includes('宗教')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-gun-forest-extreme') {
    return r.intent === 'combat_math' && ctx.includes('枪影如林·极') && ctx.includes('+6')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-ac-drunken-stagger') {
    return r.intent === 'combat_math' && ctx.includes('酩酊大醉') && ctx.includes('13')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'snap-build-review-multiclass') {
    return r.intent === 'build_review' && ctx.includes('Build 评价') && ctx.includes('**法师**')
      && ctx.includes('**战士**') && ctx.includes('战吼术') && ctx.includes('芙兰')
      ? 'OK' : 'TOOL_GAP';
  }
  if (c.id === 'extra-combat-long-range-shot') {
    return r.intent === 'combat_math' && ctx.includes('远效射击') && ctx.includes('+10')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-ac-spell-deflect') {
    return r.intent === 'combat_math' && ctx.includes('法术偏斜') && ctx.includes('16')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-ac-banner-evil') {
    return r.intent === 'combat_math' && ctx.includes('破邪战旗') && ctx.includes('14')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-aim-scope-adv') {
    return r.intent === 'combat_math' && ctx.includes('辅助瞄准镜') && ctx.includes('优势') && ctx.includes('+5')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-combat-power-boon-adv') {
    return r.intent === 'combat_math' && ctx.includes('力量报偿') && ctx.includes('优势') && ctx.includes('+4')
      ? 'OK' : 'ENGINE_GAP';
  }
  if (c.id === 'extra-target-ac-corrosion') {
    return r.intent === 'combat_math' && ctx.includes('腐蚀术') && ctx.includes('13') && ctx.includes('目标 AC debuff')
      ? 'OK' : 'ENGINE_GAP';
  }

  const corpusChecks = c.expectInContext.map((term) => ({
    term,
    inCorpus: corpusHas(store, term).length > 0,
    inContext: ctx.includes(term),
  }));

  const allInCorpus = corpusChecks.filter((x) => x.inCorpus).length;
  const inCtx = corpusChecks.filter((x) => x.inContext).length;
  const corpusNotContext = corpusChecks.filter((x) => x.inCorpus && !x.inContext);

  if (inCtx === 0 && allInCorpus === 0) return 'CORPUS_GAP';
  if (corpusNotContext.length >= Math.ceil(c.expectInContext.length / 2)) return 'RETRIEVAL_GAP';
  if (c.category === 'combat_math' && r.intent !== 'combat_math') return 'ENGINE_GAP';
  if (c.category === 'combat_math') return 'ENGINE_GAP';
  if (c.category === 'cross_class_compare' && !ctx.includes('相同')) return 'TOOL_GAP';
  return inCtx >= c.expectInContext.length * 0.6 ? 'OK' : 'PARTIAL';
}

const store = loadAdvisorStore();
const overlap = skillOverlap('法师', '吟游诗人', store);

console.log('=== Advisor Multi-Angle Audit ===\n');
console.log(`法师∩吟游诗人 同名技能（语料）: ${overlap.length} 个`);
console.log(overlap.slice(0, 20).join('、') + (overlap.length > 20 ? '…' : ''));
console.log('');

const rows = [];
let failures = 0;

for (const c of CASES) {
  const opts = c.snapshotFile ? { snapshot: loadSnapshotFile(c.snapshotFile) } : {};
  const r = retrieve(c.query, opts);
  const ctx = formatContext(r);
  const score = scoreContext(ctx, c.expectInContext);
  const gap = classifyGap(c, score, store);
  if (gap !== 'OK') failures += 1;

  rows.push({
    id: c.id,
    category: c.category,
    intent: r.intent,
    layers: (r.layersHit || []).join(','),
    ctxLen: ctx.length,
    score: `${score.found.length}/${c.expectInContext.length}`,
    missing: score.missing.join('|') || '—',
    gap,
  });

  console.log(`[${gap.padEnd(14)}] ${c.id}`);
  console.log(`  intent=${r.intent} layers=${rows.at(-1).layers} ctx=${ctx.length}ch score=${rows.at(-1).score}`);
  if (score.missing.length) console.log(`  missing: ${score.missing.join(', ')}`);
  console.log('');
}

console.log('=== Summary ===');
const byGap = {};
for (const row of rows) {
  byGap[row.gap] = (byGap[row.gap] || 0) + 1;
}
console.log(JSON.stringify(byGap, null, 2));
const BATCH1_IDS = new Set(['user-skill-overlap', 'user-thief-trade', 'extra-hammer-prof']);
const BATCH2_IDS = new Set(['user-hp-max', 'user-mage-knowledge']);
const BATCH3_IDS = new Set([
  'extra-silence-counter',
  'extra-feat-timing',
  'extra-unknown-adv',
  'extra-duplicate-skill-name',
]);
const BATCH4_IDS = new Set(['user-attack-bonus']);
const BATCH5_IDS = new Set(['snap-build-review', 'snap-prof-roadmap', 'snap-combat-hit']);
const BATCH6_IDS = new Set(['extra-equip-purify', 'extra-equip-mage-armor', 'extra-consumable-potion']);
const BATCH7_IDS = new Set(['extra-point-buy', 'extra-level-rewards', 'user-damage-bonus']);
const BATCH8_IDS = new Set(['extra-bg-deities', 'extra-ac-leather', 'extra-ac-shield']);
const BATCH9_IDS = new Set(['extra-combat-full', 'extra-prof-religion', 'extra-combat-ranged']);
const BATCH10_IDS = new Set(['extra-priest-starting-gear', 'snap-ac-armor', 'extra-race-vampire-detail']);
const BATCH11_IDS = new Set(['feedback-pending-bg-deities', 'feedback-pending-priest-gear', 'feedback-pending-soldier-bg']);
const BATCH12_IDS = new Set(['extra-combat-axe-crit', 'extra-combat-aim-shot', 'snap-combat-buffs-skills']);
const BATCH13_IDS = new Set(['extra-prof-cleric-religion', 'extra-prof-rogue-deft', 'snap-prof-rogue-deft']);
const BATCH14_IDS = new Set(['extra-ac-guardian-seal', 'extra-combat-penetrate-shot', 'snap-ac-cleric-seal']);
const BATCH15_IDS = new Set(['extra-build-review-magic-sword', 'snap-build-review-tools', 'extra-build-review-cleric']);
const BATCH16_IDS = new Set(['extra-combat-charged-shot', 'extra-ac-barkskin', 'extra-combat-cobra-poison']);
const BATCH17_IDS = new Set(['extra-combat-crusader-strike', 'extra-combat-divine-hammer', 'snap-combat-cleric-hammer']);
const BATCH18_IDS = new Set(['extra-combat-gun-forest-extreme', 'extra-ac-drunken-stagger', 'snap-build-review-multiclass']);
const BATCH19_IDS = new Set(['extra-combat-long-range-shot', 'extra-ac-spell-deflect', 'extra-ac-banner-evil']);
const BATCH20_IDS = new Set(['extra-combat-aim-scope-adv', 'extra-combat-power-boon-adv', 'extra-target-ac-corrosion']);

console.log(`\nNon-OK cases: ${failures}/${CASES.length}`);
console.log(`Audit cases total: ${CASES.length} (target ≥30)`);
const batch1Failed = rows.filter((r) => BATCH1_IDS.has(r.id) && r.gap !== 'OK').length;
const batch2Failed = rows.filter((r) => BATCH2_IDS.has(r.id) && r.gap !== 'OK').length;
const batch3Failed = rows.filter((r) => BATCH3_IDS.has(r.id) && r.gap !== 'OK').length;
const batch4Failed = rows.filter((r) => BATCH4_IDS.has(r.id) && r.gap !== 'OK').length;
const batch5Failed = rows.filter((r) => BATCH5_IDS.has(r.id) && r.gap !== 'OK').length;
const batch6Failed = rows.filter((r) => BATCH6_IDS.has(r.id) && r.gap !== 'OK').length;
const batch7Failed = rows.filter((r) => BATCH7_IDS.has(r.id) && r.gap !== 'OK').length;
const batch8Failed = rows.filter((r) => BATCH8_IDS.has(r.id) && r.gap !== 'OK').length;
const batch9Failed = rows.filter((r) => BATCH9_IDS.has(r.id) && r.gap !== 'OK').length;
const batch10Failed = rows.filter((r) => BATCH10_IDS.has(r.id) && r.gap !== 'OK').length;
const batch11Failed = rows.filter((r) => BATCH11_IDS.has(r.id) && r.gap !== 'OK').length;
const batch12Failed = rows.filter((r) => BATCH12_IDS.has(r.id) && r.gap !== 'OK').length;
const batch13Failed = rows.filter((r) => BATCH13_IDS.has(r.id) && r.gap !== 'OK').length;
const batch14Failed = rows.filter((r) => BATCH14_IDS.has(r.id) && r.gap !== 'OK').length;
const batch15Failed = rows.filter((r) => BATCH15_IDS.has(r.id) && r.gap !== 'OK').length;
const batch16Failed = rows.filter((r) => BATCH16_IDS.has(r.id) && r.gap !== 'OK').length;
const batch17Failed = rows.filter((r) => BATCH17_IDS.has(r.id) && r.gap !== 'OK').length;
const batch18Failed = rows.filter((r) => BATCH18_IDS.has(r.id) && r.gap !== 'OK').length;
const batch19Failed = rows.filter((r) => BATCH19_IDS.has(r.id) && r.gap !== 'OK').length;
const batch20Failed = rows.filter((r) => BATCH20_IDS.has(r.id) && r.gap !== 'OK').length;
console.log(`7065 batch1 must-pass: ${BATCH1_IDS.size - batch1Failed}/${BATCH1_IDS.size}`);
console.log(`7066 batch2 must-pass: ${BATCH2_IDS.size - batch2Failed}/${BATCH2_IDS.size}`);
console.log(`7067 batch3 must-pass: ${BATCH3_IDS.size - batch3Failed}/${BATCH3_IDS.size}`);
console.log(`7068 batch4 must-pass: ${BATCH4_IDS.size - batch4Failed}/${BATCH4_IDS.size}`);
console.log(`7069 batch5 must-pass: ${BATCH5_IDS.size - batch5Failed}/${BATCH5_IDS.size}`);
console.log(`7070 batch6 must-pass: ${BATCH6_IDS.size - batch6Failed}/${BATCH6_IDS.size}`);
console.log(`7071 batch7 must-pass: ${BATCH7_IDS.size - batch7Failed}/${BATCH7_IDS.size}`);
console.log(`7072 batch8 must-pass: ${BATCH8_IDS.size - batch8Failed}/${BATCH8_IDS.size}`);
console.log(`7073 batch9 must-pass: ${BATCH9_IDS.size - batch9Failed}/${BATCH9_IDS.size}`);
console.log(`7074 batch10 must-pass: ${BATCH10_IDS.size - batch10Failed}/${BATCH10_IDS.size}`);
console.log(`7075 batch11 must-pass: ${BATCH11_IDS.size - batch11Failed}/${BATCH11_IDS.size}`);
console.log(`7076 batch12 must-pass: ${BATCH12_IDS.size - batch12Failed}/${BATCH12_IDS.size}`);
console.log(`7077 batch13 must-pass: ${BATCH13_IDS.size - batch13Failed}/${BATCH13_IDS.size}`);
console.log(`7078 batch14 must-pass: ${BATCH14_IDS.size - batch14Failed}/${BATCH14_IDS.size}`);
console.log(`7079 batch15 must-pass: ${BATCH15_IDS.size - batch15Failed}/${BATCH15_IDS.size}`);
console.log(`7080 batch16 must-pass: ${BATCH16_IDS.size - batch16Failed}/${BATCH16_IDS.size}`);
console.log(`7081 batch17 must-pass: ${BATCH17_IDS.size - batch17Failed}/${BATCH17_IDS.size}`);
console.log(`7082 batch18 must-pass: ${BATCH18_IDS.size - batch18Failed}/${BATCH18_IDS.size}`);
console.log(`7084 batch19 must-pass: ${BATCH19_IDS.size - batch19Failed}/${BATCH19_IDS.size}`);
console.log(`7085 batch20 must-pass: ${BATCH20_IDS.size - batch20Failed}/${BATCH20_IDS.size}`);

const categoryIds = {};
for (const c of CASES) {
  categoryIds[c.category] = (categoryIds[c.category] || 0) + 1;
}
console.log(`Categories covered: ${Object.keys(categoryIds).length} types, min per-type=${Math.min(...Object.values(categoryIds))}`);

if (
  batch1Failed > 0 || batch2Failed > 0 || batch3Failed > 0 || batch4Failed > 0
  || batch5Failed > 0 || batch6Failed > 0 || batch7Failed > 0 || batch8Failed > 0 || batch9Failed > 0
  || batch10Failed > 0 || batch11Failed > 0   || batch12Failed > 0   || batch13Failed > 0 || batch14Failed > 0 || batch15Failed > 0 || batch16Failed > 0 || batch17Failed > 0 || batch18Failed > 0 || batch19Failed > 0 || batch20Failed > 0
) process.exitCode = 1;
else if (failures > 0) {
  console.log('(其余失败项为 7072+ 计划范围，不阻断 CI)');
}
if (CASES.length < 30) {
  console.log('WARN: audit case count below 30');
  process.exitCode = 1;
}
