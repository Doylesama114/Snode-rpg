import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { SeededRng } from '../rng';
import { beginTurn } from '../action-economy';
import { normalizeAttrs, UnitInstance } from '../unit';
import { executeBasicAttack, reloadWeapon } from '../basic-actions';
import type { StatusCardData } from '../cards';

class FixedHitRng {
  next(): number { return 0.5; }
  die(sides: number): number { return 1 + Math.floor(0.5 * sides); }
}

class AlwaysOneRng {
  next(): number { return 0; }
  die(_sides: number): number { return 1; }
}

class AlwaysMaxRng {
  next(): number { return 1; }
  die(sides: number): number { return sides; }
}

class QueueRng {
  private queue: number[];
  constructor(...values: number[]) { this.queue = values; }
  next(): number { return (this.queue.shift() ?? 0) / 100; }
  die(sides: number): number {
    const v = this.queue.shift();
    return v == null ? sides : v;
  }
}

function playerUnit(x: number, y: number, id = 'player', name = '游荡者', luck = 10) {
  return new UnitInstance(
    {
      id, name, kind: 'player', class: '游荡者', level: 1,
      attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: luck }),
      hpMax: 20, fpMax: 10, ac: 14, speed: 6, proficiency: 2, keyAttr: '敏捷',
      weaponProfs: { 刺剑: 1, 匕首: 1 },
      weapon: { id: 'rapier', name: '刺剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' },
      resources: { comboPointsMax: 5 },
    },
    { id, name, team: 'player', x, y, facing: 'N' },
  );
}

function enemyUnit(id: string, x: number, y: number) {
  return new UnitInstance(
    {
      id, name: id, kind: 'monster',
      attrs: normalizeAttrs({ 力量: 8, 敏捷: 14, 体质: 10, 智力: 10, 感知: 10, 魅力: 8, 意志: 8, 幸运: 10 }),
      hpMax: 20, fpMax: 4, ac: 14, speed: 5, proficiency: 2, keyAttr: '敏捷',
      weaponProfs: { 短剑: 1 },
      weapon: { id: 'short', name: '短剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D4', damageType: '挥砍', attackAttr: '敏捷', rangeMetric: 'adjacent' },
    },
    { team: 'enemy', x, y, facing: 'S' },
  );
}

function encounterWith(...units: UnitInstance[]) {
  const e = new Encounter('test', new Board(6, 6), new SeededRng(1));
  for (const u of units) e.addUnit(u);
  return e;
}

const statusCatalog = new Map<string, StatusCardData>();

describe('基础攻击与装填', () => {
  it('基础攻击：命中造成武器伤害并获得连击点', () => {
    const source = playerUnit(0, 0);
    beginTurn(source);
    const target = enemyUnit('goblin', 1, 0);
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog);
    expect(result.ok).toBe(true);
    expect(result.damage).toBe(8); // 1D8=5 + 敏调3
    expect(target.hp).toBe(12);
    expect(source.comboPoints).toBe(1);
    expect(source.actions.main).toBe(false);
  });

  it('大失败且无队友：自身进入击倒', () => {
    const source = playerUnit(0, 0);
    beginTurn(source);
    const target = enemyUnit('goblin', 1, 0);
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new AlwaysOneRng(), statusCatalog);
    expect(result.ok).toBe(true);
    expect(result.damage).toBe(0);
    expect(source.hasCondition('prone')).toBe(true);
    expect(target.hp).toBe(20);
  });

  it('大失败且有相邻队友：对队友重检，不再触发大失败', () => {
    const source = playerUnit(0, 0);
    beginTurn(source);
    const ally = playerUnit(0, 1, 'ally');
    const target = enemyUnit('goblin', 1, 0);
    const e = encounterWith(source, ally, target);
    const result = executeBasicAttack(source, target, e, new AlwaysOneRng(), statusCatalog);
    expect(result.ok).toBe(true);
    expect(source.hasCondition('prone')).toBe(false);
    expect(target.hp).toBe(20);
    expect(result.events.some((ev) => ev.label.includes('误伤队友'))).toBe(true);
  });

  it('暴击：未标注“结算后”的伤害全部翻倍', () => {
    const source = playerUnit(0, 0);
    beginTurn(source);
    const target = enemyUnit('goblin', 1, 0);
    target.hpMax = 30;
    target.hp = 30;
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new AlwaysMaxRng(), statusCatalog);
    expect(result.ok).toBe(true);
    // (1D8=8 + 敏调3) × 2 = 22
    expect(result.damage).toBe(22);
    expect(target.hp).toBe(8);
    expect(source.comboPoints).toBe(1);
  });

  it('大失败多个队友：幸运最低者成为误伤目标', () => {
    const source = playerUnit(0, 0, 'source', '游荡者');
    beginTurn(source);
    const allyHigh = playerUnit(0, 1, 'ally-high', '高幸运队友', 14);
    const allyLow = playerUnit(1, 1, 'ally-low', '低幸运队友', 8);
    const target = enemyUnit('goblin', 1, 0);
    const e = encounterWith(source, allyHigh, allyLow, target);
    const result = executeBasicAttack(source, target, e, new AlwaysOneRng(), statusCatalog);
    expect(result.ok).toBe(true);
    expect(result.events.some((ev) => ev.label.includes('误伤队友') && ev.targetId === 'ally-low')).toBe(true);
  });

  it('大失败幸运并列最低：D20 点数低者成为目标', () => {
    const source = playerUnit(0, 0, 'source', '游荡者');
    beginTurn(source);
    const allyA = playerUnit(0, 1, 'ally-a', '队友A', 8);
    const allyB = playerUnit(1, 1, 'ally-b', '队友B', 8);
    const target = enemyUnit('goblin', 1, 0);
    const e = encounterWith(source, allyA, allyB, target);
    // 判定骰顺序：allyA=10, allyB=5 → allyB 成为目标
    const result = executeBasicAttack(source, target, e, new QueueRng(1, 10, 5, 1), statusCatalog);
    expect(result.ok).toBe(true);
    expect(result.events.some((ev) => ev.label.includes('大失败误伤目标判定') && ev.unitId === 'ally-a' && ev.total === 10)).toBe(true);
    expect(result.events.some((ev) => ev.label.includes('大失败误伤目标判定') && ev.unitId === 'ally-b' && ev.total === 5)).toBe(true);
    expect(result.events.some((ev) => ev.label.includes('误伤队友') && ev.targetId === 'ally-b')).toBe(true);
  });

  it('双持相同武器：基础伤害×1.5', () => {
    const source = playerUnit(0, 0);
    source.weapon = { id: 'd1', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    source.offhand = { id: 'd2', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    beginTurn(source);
    const target = enemyUnit('goblin', 1, 0);
    target.hpMax = 30; target.hp = 30;
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog);
    expect(result.ok).toBe(true);
    // (1D4=3 + 敏调3) × 1.5 = 9
    expect(result.damage).toBe(9);
    expect(target.hp).toBe(21);
  });

  it('双持不同武器：取期望较低武器，基础伤害×1.5并向下取整', () => {
    const source = playerUnit(0, 0);
    source.weapon = { id: 'rapier', name: '刺剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    source.offhand = { id: 'short', name: '短剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D6', damageType: '挥砍', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    beginTurn(source);
    const target = enemyUnit('goblin', 1, 0);
    target.hpMax = 30; target.hp = 30;
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog);
    expect(result.ok).toBe(true);
    // 短剑 1D6=4 + 敏调3 = 7；×1.5 = 10.5 → floor 10
    expect(result.damage).toBe(10);
    expect(target.hp).toBe(20);
  });

  it('双持暴击：武器基础部分 2.5 倍，无 after 加成时最终取整', () => {
    const source = playerUnit(0, 0);
    source.weapon = { id: 'd1', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    source.offhand = { id: 'd2', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    beginTurn(source);
    const target = enemyUnit('goblin', 1, 0);
    target.hpMax = 30; target.hp = 30;
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new AlwaysMaxRng(), statusCatalog);
    expect(result.ok).toBe(true);
    // (1D4=4 + 敏调3) × 2.5 = 17.5 → floor 17
    expect(result.damage).toBe(17);
    expect(target.hp).toBe(13);
  });

  it('一手远程一手近战：不享受双持加成', () => {
    const source = playerUnit(0, 0);
    source.weapon = { id: 'gun', name: '火枪', category: '火器', tags: ['火枪'], hands: 1, dice: '1D8', damageType: '穿刺', isTech: true, attackAttr: null, rangeMetric: 'grid', rangeMax: 12, ammoType: '弹药' };
    source.offhand = { id: 'd1', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' };
    source.weaponProfs['火枪'] = 1;
    source.ammo.set('弹药', { type: '弹药', reserve: 20, loaded: true });
    beginTurn(source);
    const target = enemyUnit('goblin', 2, 0);
    target.ac = 10;
    target.hpMax = 30; target.hp = 30;
    const e = encounterWith(source, target);
    const result = executeBasicAttack(source, target, e, new FixedHitRng(), statusCatalog);
    expect(result.ok).toBe(true);
    // 火枪 1D8=5，无属性；近身有敌? 目标2格外，无劣势；伤害5
    expect(result.damage).toBe(5);
    expect(target.hp).toBe(25);
  });

  it('0动作装填：消耗附赠动作', () => {
    const source = playerUnit(0, 0);
    source.weapon = {
      id: 'handbow', name: '手弩', category: '远程', tags: ['手弩'], hands: 1,
      dice: '1D6', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'grid', rangeMax: 12, ammoType: '箭矢',
    };
    source.ammo.set('箭矢', { type: '箭矢', reserve: 20, loaded: false });
    beginTurn(source);
    expect(reloadWeapon(source).ok).toBe(true);
    expect(source.ammo.get('箭矢')?.loaded).toBe(true);
    expect(source.actions.bonus).toBe(false);
  });
});
