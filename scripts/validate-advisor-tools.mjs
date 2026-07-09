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
  parseProficiencyTargetsFromQuery,
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
import {
  outlineBuildReview,
  detectBuildReviewQuestion,
} from './advisor-build-review-tools.mjs';
import { isBuildReviewQuery } from './advisor-build-roadmap.mjs';
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

const clericRoad = outlineProficiencyRoadmap('牧师', ['宗教', '自然']);
check('outlineProficiencyRoadmap 牧师宗教', clericRoad.targetGroups.length === 2 && clericRoad.className === '牧师');
const rogueRoad = outlineProficiencyRoadmap('游荡者', ['巧手']);
check('outlineProficiencyRoadmap 游荡者巧手', rogueRoad.targetGroups[0]?.subs?.includes('巧手-开锁'));
const targets = parseProficiencyTargetsFromQuery('吟游诗人怎样获取表演熟练项最少升到多少级');
check('parseProficiencyTargets 表演', targets.includes('表演'));

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

const axe = resolveCombatScenario(parseCombatScenarioFromQuery('力量调整值+3有一点斧类熟练拿着1d10双手斧命中和暴击加值分别是多少'));
check('axe hit +4', axe.totalHitBonus === 4);
check('axe crit +1', axe.totalCritBonus === 1);

const aim = resolveCombatScenario(parseCombatScenarioFromQuery('敏捷调整值+2有一点弓箭熟练远程攻击开启瞄准射击 L8 命中加值是多少'));
check('aim shot L8 +10', aim.totalHitBonus === 10);

const snapBuffQ = '拿着双手剑，命中加值是多少';
const snapBuffMerged = mergeSnapshotIntoCombatScenario(parseCombatScenarioFromQuery(snapBuffQ), snapWar, snapBuffQ);
check('snapshot buffs from skills', snapBuffMerged.activeBuffs.includes('魔法武器') && snapBuffMerged.activeBuffs.includes('狂怒术'));
check('snapshot buff hit +7', resolveCombatScenario(snapBuffMerged).totalHitBonus === 7);
const rSnapBuff = retrieve(snapBuffQ, { snapshot: snapWar });
check('retrieve snap buff combat', formatContext(rSnapBuff).includes('战斗 Buff 自快照'));

const rClericProf = retrieve('牧师怎样获取宗教和自然熟练项最少升到多少级');
check('retrieve cleric prof roadmap', formatContext(rClericProf).includes('宗教') && formatContext(rClericProf).includes('牧师'));
const snapRogue = loadSnapshotFile('advisor/snapshots/mock-rogue-l6.json');
const rRogueSnapProf = retrieve('我还缺哪些巧手熟练项，最少升到多少级', { snapshot: snapRogue });
check('retrieve rogue snap prof', formatContext(rRogueSnapProf).includes('熟练项获取路线') && formatContext(rRogueSnapProf).includes('巧手-开锁'));

const acSeal = resolveAcScenario(parseAcScenarioFromQuery('敏捷调整值+2穿着皮甲开启守护刻印护甲值是多少'));
check('guardian seal AC 15', acSeal.totalAc === 15 && acSeal.components.some((c) => c.source === '守护刻印'));

const penetrate = resolveCombatScenario(parseCombatScenarioFromQuery('敏捷调整值+2有一点弓箭熟练远程攻击开启穿透射击 L6 命中加值是多少'));
check('penetrate shot L6 +10', penetrate.totalHitBonus === 10);

const snapCleric = loadSnapshotFile('advisor/snapshots/mock-cleric-l6.json');
const acSnapSeal = resolveAcScenario(mergeSnapshotIntoAcScenario(parseAcScenarioFromQuery('我开启了守护刻印，护甲值是多少'), snapCleric, '我开启了守护刻印，护甲值是多少'));
check('snap cleric guardian AC 15', acSnapSeal.totalAc === 15);
const rSnapAcSeal = retrieve('我开启了守护刻印，护甲值是多少', { snapshot: snapCleric });
check('retrieve snap ac guardian', formatContext(rSnapAcSeal).includes('守护刻印') && formatContext(rSnapAcSeal).includes('15'));

const snapMageReview = loadSnapshotFile('advisor/snapshots/mock-magic-sword-l6.json');
check('isBuildReviewQuery', isBuildReviewQuery('怎么评价我当前的build', { snapshot: snapMageReview }));
const reviewDet = detectBuildReviewQuestion('怎么评价我当前的build，如果我想进阶魔剑士', snapMageReview);
check('detectBuildReviewQuestion', reviewDet?.intent === 'build_review');
const review = outlineBuildReview(snapMageReview, { query: '魔剑士', store });
check('outlineBuildReview suggestions', review.suggestions.some((s) => s.name === '战吼术'));
const rBuildReview = retrieve('怎么评价我当前的build', { snapshot: snapMageReview });
check('retrieve build_review tools', rBuildReview.intent === 'build_review' && !!rBuildReview.results._toolsText);
check('context Build 评价', formatContext(rBuildReview).includes('Build 评价'));

const charged = resolveCombatScenario(parseCombatScenarioFromQuery('敏捷调整值+2有一点弓箭熟练远程攻击额外花费主要动作开启蓄力劲射命中加值是多少'));
check('charged shot +10', charged.totalHitBonus === 10 && charged.components.some((c) => c.source === '蓄力劲射'));

const barkAc = resolveAcScenario(parseAcScenarioFromQuery('敏捷调整值+2未穿护甲开启树皮术护甲值是多少'));
check('barkskin AC 13', barkAc.totalAc === 13 && barkAc.components.some((c) => c.source === '树皮术'));

const cobraPoison = resolveCombatScenario(parseCombatScenarioFromQuery('敏捷调整值+2有一点弓箭熟练远程攻击目标处于中毒状态开启眼镜蛇射击命中加值是多少'));
check('cobra poison +12', cobraPoison.totalHitBonus === 12);

const reviewCleric = outlineBuildReview(snapCleric, { query: '怎么评价build', store });
check('cleric no-kit suggestions', reviewCleric.suggestions.some((s) => s.name === '强效治疗术'));
const rClericReview = retrieve('怎么评价我当前的build还有什么技能适合我', { snapshot: snapCleric });
check('retrieve cleric build_review L2', rClericReview.intent === 'build_review' && formatContext(rClericReview).includes('强效治疗术'));

console.log(`\n${failed ? 'FAILED' : 'OK'} (${failed} failures)`);
process.exit(failed ? 1 : 0);
