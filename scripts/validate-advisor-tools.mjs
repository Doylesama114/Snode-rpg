#!/usr/bin/env node
/**
 * Advisor 4.0 — tools layer validation (outline + entity + leveling).
 */
import { planFromRules } from './advisor-planner.mjs';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import {
  resolveEntity,
  getLevelingTable,
  getAdvancementBrief,
  outlineGrowthRoadmap,
  formatRoadmapOutline,
  lookupSkill,
  intersectSkills,
  listClassesByWeaponProf,
  detectStructuredQuestion,
  buildStructuredToolContext,
  summarizeChargenHp,
  outlineProficiencyRoadmap,
  lookupStatus,
  aggregateSkillByName,
  summarizeFeatWindows,
  parseCombatScenarioFromQuery,
  resolveCombatScenario,
  formatCombatScenarioText,
  mergeSnapshotIntoCombatScenario,
  abilityModFromScore,
  parseAcScenarioFromQuery,
  resolveAcScenario,
  lookupBackground,
  detectBackgroundQuestion,
  listClassesByProficiency,
  detectProficiencyLookupQuestion,
  resolveFullCombatScenario,
  mergeSnapshotIntoAcScenario,
  lookupStartingGear,
  lookupRace,
  lookupEquipment,
  searchEquipment,
  detectEquipmentQuestion,
  optimizePointBuy,
  parsePointBuyConstraintsFromQuery,
  summarizeLevelingRange,
} from './advisor-tools.mjs';
import { classifyQuestion, categoryForIntent } from './advisor-tools.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';
import { resolveAdvancementName } from './advisor-advancement-resolve.mjs';
import { matchAllClassesFromQuery } from './advisor-class-l2.mjs';
import { parseRoadmapGoal } from './advisor-build-roadmap.mjs';
import { loadAdvisorStore } from './advisor-retrieve.mjs';

const THIEF_QUERY = '我想玩飞贼，我该怎么安排我的成长路线？';
const UNKNOWN_QUERY = '元素大师怎么规划';

let failed = 0;
function check(label, ok, detail) {
  if (ok) console.log(`✓ ${label}`);
  else {
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

console.log('=== validate-advisor-tools ===\n');

const entity = resolveEntity('飞贼');
check('resolveEntity 飞贼', entity?.type === 'advancement' && entity.name === '飞贼');

check('resolve 诡术士→诡术师', resolveAdvancementName('我想进阶诡术士') === '诡术师');
check('strip 诡术士 no 术士 class', !matchAllClassesFromQuery('我想进阶诡术士').includes('术士'));

const rogue = resolveEntity('游荡者');
check('resolveEntity 游荡者', rogue?.type === 'class');

const table = getLevelingTable(1, 5);
check('leveling L1-5 rows', table.rows.length === 5);
check('leveling L5 advancement', table.advancementUnlock?.level === 5);

const brief = getAdvancementBrief('飞贼');
check('飞贼 brief attrs', brief?.attrsRequired?.敏捷 === 15 && brief?.attrsRequired?.感知 === 15);
check('飞贼 brief insight', (brief?.insightMilestones?.length || 0) > 0);

const store = loadAdvisorStore();
const goal = parseRoadmapGoal(THIEF_QUERY);
const outline = outlineGrowthRoadmap(goal, { store, roadmapCtx: null });
check('outline sections', (outline.sections?.length || 0) >= 5);
check('outline mainClass 游荡者', outline.mainClass === '游荡者');
check('outline 敏捷门槛', outline.sections.some((s) => s.bullets.some((b) => /敏捷/.test(b))));
const outlineText = formatRoadmapOutline(outline);
check('outline text 路线骨架', outlineText.includes('路线骨架'));

const unknownGoal = parseRoadmapGoal(UNKNOWN_QUERY);
const unknownOutline = outlineGrowthRoadmap(unknownGoal, { store });
check('unknown outline mode', unknownOutline.mode === 'unknown_advancement');
check('unknown 未收录', unknownOutline.sections.some((s) => s.bullets.some((b) => /未收录|不得编造/.test(b))));

const plan = planFromRules(THIEF_QUERY, {});
const r = retrieve(THIEF_QUERY, { plan });
check('retrieve _roadmapOutline', !!r.results._roadmapOutline);
check('context 路线骨架', formatContext(r).includes('路线骨架'));
check('outline 飞贼心得', formatContext(r).includes('飞贼心得') || formatContext(r).includes('心得'));

const thiefTrade = lookupSkill('窃贼的交易');
check('lookupSkill 窃贼的交易', thiefTrade?.name === '窃贼的交易' && thiefTrade.occurrences[0]?.className === '游荡者');
check('窃贼的交易 含生命值上限', (thiefTrade?.occurrences[0]?.summary || '').includes('生命值上限'));

const overlap = intersectSkills('法师', '吟游诗人');
check('intersect 法师∩吟游诗人 >= 30', overlap.length >= 30, `got ${overlap.length}`);
check('intersect 含舞光术', overlap.includes('舞光术'));

const hammers = listClassesByWeaponProf('锤子');
check('weaponProf 锤子→锤类', hammers.category === '锤类');
check('weaponProf 锤类含牧师', hammers.classes.includes('牧师'));

const detSkill = detectStructuredQuestion('窃贼的交易这个技能收益和代价');
check('detect skill_detail', detSkill?.intent === 'skill_detail');
const detCross = detectStructuredQuestion('法师和吟游诗人有哪些相同的技能');
check('detect cross_class_compare', detCross?.intent === 'cross_class_compare');
const detWeapon = detectStructuredQuestion('哪些初始职业的武器熟练度包含锤子');
check('detect class_weapon_prof', detWeapon?.intent === 'class_weapon_prof');

const ctxSkill = buildStructuredToolContext(detSkill);
check('buildStructured skill_detail text', ctxSkill?.text?.includes('窃贼的交易'));

const rOverlap = retrieve('法师和吟游诗人有哪些相同的技能', { plan: planFromRules('法师和吟游诗人有哪些相同的技能', {}) });
check('retrieve cross_class tools', !!rOverlap.results._toolsText);
check('context 跨职业同名', formatContext(rOverlap).includes('跨职业同名技能'));

const hp = summarizeChargenHp();
check('summarizeChargenHp best', hp.best.hp >= 18 && hp.best.className === '蛮斗士');
check('summarizeChargenHp races', hp.topRaces.some((r) => r.hpBonus >= 4));

const roadmap = outlineProficiencyRoadmap('法师');
check('outlineProficiencyRoadmap subs', roadmap.arcanaSubs.length >= 4 && roadmap.knowledgeSubs.length >= 8);
check('outlineProficiencyRoadmap 奥法学者', roadmap.l1Sources.some((s) => s.includes('奥法学者')));

const detHp = detectStructuredQuestion('在创建角色时怎样构筑初始血量最大');
check('detect chargen_hp_optimize', detHp?.intent === 'chargen_hp_optimize');
const detProf = detectStructuredQuestion('法师怎样获取几乎所有知识奥秘熟练项最少升到多少级');
check('detect proficiency_roadmap', detProf?.intent === 'proficiency_roadmap');

const ctxHp = buildStructuredToolContext(detHp);
check('buildStructured chargen_hp text', ctxHp?.text?.includes('19 HP'));

const rHp = retrieve('在创建角色时，怎样构筑可以使我的角色初始血量达到最大值', {
  plan: planFromRules('在创建角色时，怎样构筑可以使我的角色初始血量达到最大值', {}),
});
check('retrieve chargen_hp tools', !!rHp.results._toolsText);
check('context L1 初始 HP', formatContext(rHp).includes('L1 初始 HP'));

const profQuery = '我想让我的法师能够获取到几乎所有的知识，奥秘的熟练项，我最少升到多少级，学习哪些技能可以做到';
const rProf = retrieve(profQuery, { plan: planFromRules(profQuery, {}) });
check('retrieve proficiency_roadmap tools', !!rProf.results._toolsText);
check('context 熟练项获取路线', formatContext(rProf).includes('熟练项获取路线'));

const silence = lookupStatus('沉默');
check('lookupStatus 沉默', silence?.name === '沉默' && silence.appliers.length >= 10);
check('沉默 含 status_conditions', silence?.sourceFile?.includes('status_conditions'));

const detStatus = detectStructuredQuestion('沉默状态具体有什么效果，哪些技能可以造成沉默');
check('detect status_rules', detStatus?.intent === 'status_rules');
const rStatus = retrieve('沉默状态具体有什么效果，哪些技能可以造成沉默', {
  plan: planFromRules('沉默状态具体有什么效果，哪些技能可以造成沉默', {}),
});
check('retrieve status tools', !!rStatus.results._toolsText);
check('context status_conditions.json', formatContext(rStatus).includes('status_conditions.json'));

const featWin = summarizeFeatWindows();
check('summarizeFeatWindows L4/L8/L13', featWin.labels.join(',') === 'L4,L8,L13');
const detFeat = detectStructuredQuestion('特殊专长可以在哪些等级获取');
check('detect feat_timing', detFeat?.intent === 'feat_timing');
const rFeat = retrieve('特殊专长可以在哪些等级获取', {
  plan: planFromRules('特殊专长可以在哪些等级获取', {}),
});
check('retrieve feat_timing tools', !!rFeat.results._toolsText);
check('context feat L8', formatContext(rFeat).includes('L8'));

const agg = aggregateSkillByName('魔法武器');
check('aggregateSkillByName 魔法武器', agg?.classCount >= 2 && agg.classNames.includes('奇械师'));
const detAgg = detectStructuredQuestion('魔法武器这个技能哪些职业可以学，效果一样吗');
check('detect skill_aggregate', detAgg?.intent === 'skill_aggregate');

const detUnknown = detectStructuredQuestion('元素大师怎么规划成长路线');
check('detect unknown_entity', detUnknown?.intent === 'unknown_entity');
const rUnknown = retrieve('元素大师怎么规划成长路线', {});
check('retrieve unknown tools', !!rUnknown.results._toolsText);
check('context 未收录', formatContext(rUnknown).includes('不在当前资料库'));
check('unknown intent', rUnknown.intent === 'unknown_entity');

const COMBAT_Q = '我的角色力量调整值为+3，有一点剑类熟练度，拿着一把伤害为1d8的双手剑，开启了魔法武器，锐化武器，狂怒术，这个时候我的命中加值是多少';
const detCombat = detectStructuredQuestion(COMBAT_Q);
check('detect combat_math', detCombat?.intent === 'combat_math');
const combat = resolveCombatScenario(parseCombatScenarioFromQuery(COMBAT_Q));
check('resolveCombatScenario +7', combat.totalHitBonus === 7);
check('combat 魔法武器', combat.components.some((c) => c.source === '魔法武器' && c.value === 1));
const rCombat = retrieve(COMBAT_Q, { plan: planFromRules(COMBAT_Q, {}) });
check('retrieve combat_math tools', !!rCombat.results._toolsText);
check('context 战斗命中演算', formatContext(rCombat).includes('战斗命中演算'));
check('context +7', formatContext(rCombat).includes('+7'));

const clsHp = classifyQuestion('在创建角色时怎样构筑初始血量最大');
check('classifyQuestion chargen_hp', clsHp?.intent === 'chargen_hp_optimize' && clsHp?.category === 'C');
check('categoryForIntent combat', categoryForIntent('combat_math') === 'F');

const snapWar = loadSnapshotFile('advisor/snapshots/mock-combat-warrior-l6.json');
const SNAP_COMBAT_Q = '我开启了魔法武器和狂怒术，拿着双手剑，命中加值是多少';
const clsSnap = classifyQuestion(SNAP_COMBAT_Q, { snapshot: snapWar });
check('classifyQuestion snap combat', clsSnap?.intent === 'combat_math' && clsSnap?.meta?.snapshotLinked);
const merged = mergeSnapshotIntoCombatScenario(parseCombatScenarioFromQuery(SNAP_COMBAT_Q), snapWar, SNAP_COMBAT_Q);
check('mergeSnapshot STR +3', merged.abilityMods?.力量 === 3);
check('mergeSnapshot 剑类 prof', merged.weaponProfPoints === 1);
const snapCombat = resolveCombatScenario(merged);
check('snap combat +7', snapCombat.totalHitBonus === 7);
const rSnapCombat = retrieve(SNAP_COMBAT_Q, { snapshot: snapWar });
check('retrieve snap combat tools', !!rSnapCombat.results._toolsText);
check('context L6 快照联动', formatContext(rSnapCombat).includes('L6 快照联动'));

const snapMage = loadSnapshotFile('advisor/snapshots/mock-magic-sword-l6.json');
const rSnapProf = retrieve('我还缺哪些知识奥秘熟练项，最少升到多少级', { snapshot: snapMage });
check('retrieve snap prof tools', rSnapProf.results._toolsText?.includes('L6 快照联动'));

const purify = lookupEquipment('净化水袋');
check('lookupEquipment 净化水袋', purify?.name === '净化水袋' && purify?.effect?.includes('净化'));
const detEquip = detectStructuredQuestion('净化水袋有什么效果');
check('detect equipment_lookup', detEquip?.intent === 'equipment_lookup');
const rEquip = retrieve('净化水袋有什么效果');
check('retrieve equipment tools', !!rEquip.results._toolsText);
check('context 净化水袋', formatContext(rEquip).includes('净化水袋'));

const armorSearch = searchEquipment('法师可以选哪些护甲', { category: '护甲' });
check('searchEquipment 护甲', armorSearch.total >= 3);
const rArmor = retrieve('法师可以选哪些护甲');
check('retrieve equipment_search', rArmor.intent === 'equipment_search');

const vitality = lookupEquipment('活力药水');
check('lookupEquipment 活力药水', vitality?.name === '活力药水' && vitality?.price);

const pb = optimizePointBuy(parsePointBuyConstraintsFromQuery('32点购点怎样分配才能让法师智力达到15且体质尽量高'));
check('optimizePointBuy 智力15', pb.ok && pb.allocation.智力 === 15);
check('optimizePointBuy 体质15', pb.allocation.体质 === 15);

const lvl = summarizeLevelingRange(3, 6);
check('summarizeLevelingRange L4 feat', lvl.featLevels.includes(4));
check('summarizeLevelingRange prof', lvl.proficiencyGain >= 2);

const dmgQ = '我的角色力量调整值为+3，拿着一把伤害为1d8的双手剑，开启了狂怒术，伤害加值是多少';
const dmg = resolveCombatScenario(parseCombatScenarioFromQuery(dmgQ));
check('resolveCombatScenario damage +5', dmg.totalDamageBonus === 5);
const rDmg = retrieve(dmgQ);
check('retrieve damage tools', formatContext(rDmg).includes('伤害 flat 加值'));

const acQ = '敏捷调整值+2穿着皮甲护甲值是多少';
const ac = resolveAcScenario(parseAcScenarioFromQuery(acQ));
check('resolveAcScenario leather 13', ac.totalAc === 13);
const detAc = detectStructuredQuestion(acQ);
check('detect combat_math ac', detAc?.intent === 'combat_math' && detAc?.mode === 'ac');
const rAc = retrieve(acQ);
check('retrieve ac tools', formatContext(rAc).includes('护甲值演算'));

const bg = lookupBackground('侍僧');
check('lookupBackground 侍僧', bg?.name === '侍僧' && bg.deities?.length === 11);
const detBg = detectStructuredQuestion('侍僧背景可以侍奉哪些神祇');
check('detect background_detail', detBg?.intent === 'background_detail');
const rBg = retrieve('侍僧背景可以侍奉哪些神祇');
check('retrieve background tools', formatContext(rBg).includes('可侍奉神祇'));

const religion = listClassesByProficiency('宗教');
check('listClassesByProficiency 宗教', religion.classes.length >= 6);
const detProfLookup = detectStructuredQuestion('哪些初始职业可以在创建时选择宗教熟练');
check('detect proficiency_lookup', detProfLookup?.intent === 'proficiency_lookup');
const rProfLookup = retrieve('哪些初始职业可以在创建时选择宗教熟练');
check('retrieve prof tools', formatContext(rProfLookup).includes('熟练项职业对照'));

const fullQ = '力量调整值+3有一点剑类熟练拿着1d8双手剑开启狂怒术命中和伤害加值分别是多少';
const fullDet = detectStructuredQuestion(fullQ);
check('detect combat both', fullDet?.mode === 'both');
const full = resolveFullCombatScenario(parseCombatScenarioFromQuery(fullQ));
check('resolveFullCombatScenario hit +6', full.totalHitBonus === 6);
check('resolveFullCombatScenario dmg +5', full.totalDamageBonus === 5);

const ranged = resolveCombatScenario(parseCombatScenarioFromQuery('敏捷调整值+2有一点弓箭熟练度远程攻击命中加值是多少'));
check('ranged bow +5', ranged.totalHitBonus === 5);

const priestGear = lookupStartingGear('牧师');
check('lookupStartingGear 牧师', priestGear?.kits?.length === 4);
const detGear = detectStructuredQuestion('牧师创建角色时起始装备有哪些');
check('detect starting_gear_lookup', detGear?.intent === 'starting_gear_lookup');
const rGear = retrieve('牧师创建角色时起始装备有哪些');
check('retrieve starting gear tools', formatContext(rGear).includes('起始装备'));

const vampire = lookupRace('吸血鬼');
check('lookupRace 吸血鬼→血族', vampire?.name === '血族');
const detRace = detectStructuredQuestion('吸血鬼种族有什么特性');
check('detect race_detail', detRace?.intent === 'race_detail');

const snapAc = mergeSnapshotIntoAcScenario(parseAcScenarioFromQuery('我的护甲值是多少'), snapWar, '我的护甲值是多少');
check('mergeSnapshotIntoAcScenario 皮甲', snapAc.armorKey === 'light_11');
const acSnap = resolveAcScenario(snapAc);
check('snap AC 13', acSnap.totalAc === 13);
const rSnapAc = retrieve('我的护甲值是多少', { snapshot: snapWar });
check('retrieve snap ac tools', formatContext(rSnapAc).includes('L6 快照联动'));

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
