import { describe, expect, it } from 'vitest';
import bonePierceJson from '../../data/cards/abilities/rogue-bone-pierce.json';
import dartStormJson from '../../data/cards/abilities/rogue-dart-storm.json';
import bladeDanceJson from '../../data/cards/abilities/rogue-blade-dance.json';
import heavyBlowJson from '../../data/cards/abilities/rogue-heavy-blow.json';
import shadowArmorJson from '../../data/cards/abilities/rogue-shadow-armor.json';
import acidSplashJson from '../../data/cards/abilities/rogue-acid-splash.json';
import type { AbilityCardData, StatusCardData } from '../cards';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { SeededRng } from '../rng';
import { beginTurn } from '../action-economy';
import { executeAbility } from '../resolver';
import { executeBasicAttack } from '../basic-actions';
import { normalizeAttrs, UnitInstance } from '../unit';
import type { UnitCard, WeaponData } from '../types';
import type { PoisonCardData } from '../poisons';
import quickPoisonJson from '../../data/cards/poisons/quick-poison.json';
import slowingPoisonJson from '../../data/cards/poisons/slowing-poison.json';

const statusModules = import.meta.glob('../../data/cards/statuses/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const statusCatalog = new Map<string, StatusCardData>();
for (const mod of Object.values(statusModules)) {
  const status = mod as unknown as StatusCardData;
  statusCatalog.set(status.id, status);
}

class FixedHitRng {
  next(): number { return 0.5; }
  die(sides: number): number { return 1 + Math.floor(0.5 * sides); }
}
class QueueRng {
  constructor(private queue: number[]) {}
  next(): number { return 0.5; }
  die(sides: number): number { return this.queue.shift() ?? 1 + Math.floor(0.5 * sides); }
}

function rogueCard(): UnitCard {
  return {
    id: 'rogue', name: '游荡者', kind: 'player', class: '游荡者', level: 15,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20, fpMax: 10, ac: 14, speed: 6, proficiency: 2, keyAttr: '敏捷',
    weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1, 火枪: 1 },
    resources: { comboPointsMax: 5 },
  };
}
function player(x: number, y: number, opts: { weapon?: WeaponData; facing?: 'N'|'S'; inventoryTags?: string[] } = {}) {
  const card = rogueCard();
  card.weapon = opts.weapon ?? { id: 'dagger', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
  card.inventoryTags = opts.inventoryTags ?? [];
  return new UnitInstance(card, { team: 'player', x, y, facing: opts.facing ?? 'N' });
}
function enemy(id: string, x: number, y: number, ac = 14, hp = 20) {
  return new UnitInstance({
    id, name: id, kind: 'monster',
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 14, 体质: 10, 智力: 10, 感知: 10, 魅力: 8, 意志: 8, 幸运: 10 }),
    hpMax: hp, fpMax: 4, ac, speed: 5, proficiency: 2, keyAttr: '敏捷',
    weaponProfs: { 短剑: 1 },
    weapon: { id: 'short', name: '短剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D4', damageType: '挥砍', attackAttr: '敏捷', rangeMetric: 'adjacent' },
  }, { team: 'enemy', x, y, facing: 'S' });
}
function enc(...units: UnitInstance[]) { const e = new Encounter('p1', new Board(10,10), new SeededRng(1)); for (const u of units) e.addUnit(u); return e; }

const cards = {
  bone: bonePierceJson as unknown as AbilityCardData,
  dart: dartStormJson as unknown as AbilityCardData,
  blade: bladeDanceJson as unknown as AbilityCardData,
  heavy: heavyBlowJson as unknown as AbilityCardData,
  shadow: shadowArmorJson as unknown as AbilityCardData,
  acid: acidSplashJson as unknown as AbilityCardData,
};

describe('P1 技能结算', () => {
  it('刺骨：破甲、结算前+X、每连击点结算后1D6', () => {
    const source = player(0,0); beginTurn(source); source.fp=10; source.gainCombo(3);
    const target = enemy('goblin',1,0,14,40);
    const e = enc(source,target);
    const r = executeAbility(cards.bone, source, e, { rng:new FixedHitRng(), statusCatalog, level:1 });
    expect(r.ok).toBe(true);
    // 武器(3+3)+结算前3 + 3×1D6(4) = 21
    expect(r.damageByTarget.get('goblin')).toBe(21);
    expect(target.hp).toBe(19);
    expect(source.comboPoints).toBe(0);
  });

  it('袖箭风暴：AOE伤害随连击点重复', () => {
    const source = player(0,0, { inventoryTags:['飞镖'] }); beginTurn(source); source.fp=10; source.gainCombo(2);
    const a = enemy('a',0,1,10,20); const b = enemy('b',0,2,10,20);
    const e = enc(source,a,b);
    // 两次豁免D20=10,5均失败；D3原始D6=4->2、6->3
    const r = executeAbility(cards.dart, source, e, { rng:new QueueRng([10,5,4,6]), statusCatalog, level:1 });
    expect(r.ok).toBe(true);
    expect(a.hp).toBe(15); expect(b.hp).toBe(15);
    expect(source.comboPoints).toBe(0);
  });

  it('剑刃乱舞：DC15伤害豁免+DC(10+X)缴械豁免', () => {
    const source = player(0,0, { weapon:{ id:'sword',name:'刺剑',category:'剑类',tags:['剑'],hands:1,dice:'1D8',damageType:'穿刺',attackAttr:'敏捷',rangeMetric:'adjacent'} });
    beginTurn(source); source.fp=10; source.gainCombo(2);
    const target = enemy('bandit',1,0,10,20);
    const e = enc(source,target);
    // AOE豁免10失败；缴械豁免9 + 敏调2 =11 < DC12 失败
    const r = executeAbility(cards.blade, source, e, { rng:new QueueRng([10,9]), statusCatalog, level:1 });
    expect(r.ok).toBe(true);
    expect(target.hp).toBe(16); // 2X=4
    expect(target.hasCondition('disarmed')).toBe(true);
    expect(source.comboPoints).toBe(0);
  });

  it('重磅一击：暴击三倍 + 幸运豁免失败进入击倒灼烧', () => {
    const source = player(0,0, { weapon:{ id:'gun',name:'火枪',category:'火器',tags:['火枪'],hands:1,dice:'1D8',damageType:'穿刺',isTech:true,attackAttr:null,rangeMetric:'grid',rangeMax:12,ammoType:'弹药'} });
    source.ammo.set('弹药',{type:'弹药',reserve:20,loaded:true});
    beginTurn(source); source.fp=10; source.gainCombo(2);
    const target = enemy('goblin',2,0,10,30);
    const e = enc(source,target);
    // D20=19（2连击点暴击阈值19）、伤害骰8、幸运豁免10失败
    const r = executeAbility(cards.heavy, source, e, { rng:new QueueRng([19,8,10]), statusCatalog, level:1 });
    expect(r.ok).toBe(true);
    expect(r.damageByTarget.get('goblin')).toBe(26); // 8×3 + 2
    expect(target.hp).toBe(4);
    expect(target.hasCondition('prone')).toBe(true);
    expect(target.hasCondition('burning')).toBe(true);
    expect(source.comboPoints).toBe(0);
    expect(source.ammo.get('弹药')?.reserve).toBe(19);
  });

  it('暗影护甲：AC、抗性与易伤', () => {
    const source = player(0,0); beginTurn(source); source.fp=10;
    const e = enc(source);
    const r = executeAbility(cards.shadow, source, e, { rng:new FixedHitRng(), statusCatalog, level:1 });
    expect(r.ok).toBe(true);
    expect(source.acBonus).toBe(2); // 感知14 -> +2
    expect(source.acCap).toBe(18);
    expect(source.effectiveAc()).toBe(16);
    expect(source.resistances.get('暗影')).toBe(4);
    expect(source.vulnerabilities.get('光耀')).toBe(2);
    expect(source.hasCondition('shadow_armor')).toBe(true);
  });

  it('淬毒近战攻击：命中触发毒药效果', () => {
    const source = player(0,0, { weapon:{ id:'pd',name:'匕首',category:'匕首',tags:['匕首'],hands:1,dice:'1D4',damageType:'穿刺',attackAttr:'敏捷',rangeMetric:'adjacent',appliedPoisons:['slowing-poison','quick-poison']} });
    beginTurn(source); source.fp=10;
    const target = enemy('goblin',1,0,10,20);
    const e = enc(source,target);
    const poisonCatalog = new Map<string, PoisonCardData>([
      ['quick-poison', quickPoisonJson as unknown as PoisonCardData],
      ['slowing-poison', slowingPoisonJson as unknown as PoisonCardData],
    ]);
    const r = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog, poisonCatalog);
    expect(r.ok).toBe(true);
    expect(target.hp).toBe(10); // 武器6 + 15级速效毒药失血4
    // 减速毒药：D20=11 + 敏调2 =13 vs DC12 成功
    expect(target.hasCondition('slowed')).toBe(false);
  });

  it('酸液飞溅：AOE伤害+纯D20护甲检定', () => {
    const source = player(0,2, { facing:'N', inventoryTags:['强酸瓶'] });
    beginTurn(source); source.fp=10;
    const target = enemy('goblin',0,1,10,20);
    target.armorCategory = '轻甲';
    const e = enc(source,target);
    // AOE豁免10失败；伤害1D8=5；护甲检定D20=9失败；额外1D8=5
    const r = executeAbility(cards.acid, source, e, { rng:new QueueRng([10,5,9,5]), statusCatalog, level:1 });
    expect(r.ok).toBe(true);
    expect(target.hp).toBe(10);
  });
});
