import { describe, expect, it } from 'vitest';
import sandJson from '../../data/cards/abilities/rogue-sand-throw.json';
import backstabJson from '../../data/cards/abilities/rogue-backstab.json';
import bewilderingJson from '../../data/cards/abilities/rogue-bewildering-blade.json';
import quickShotJson from '../../data/cards/abilities/rogue-quick-shot.json';
import shockShotJson from '../../data/cards/abilities/rogue-shock-shot.json';
import poisonJson from '../../data/cards/abilities/rogue-poison-blade.json';
import sprintJson from '../../data/cards/abilities/rogue-sprint.json';
import swordJson from '../../data/cards/abilities/rogue-sword-staccato.json';
const statusModules = import.meta.glob('../../data/cards/statuses/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
import type { AbilityCardData, StatusCardData } from '../cards';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { SeededRng } from '../rng';
import { beginTurn } from '../action-economy';
import { executeAbility, previewAbility, previewAttackRoll } from '../resolver';
import { normalizeAttrs, UnitInstance } from '../unit';
import type { UnitCard, WeaponData } from '../types';

const statuses = new Map<string, StatusCardData>();
for (const mod of Object.values(statusModules)) {
  const status = mod as unknown as StatusCardData;
  statuses.set(status.id, status);
}

class FixedHitRng {
  next(): number { return 0.5; }
  die(sides: number): number { return 1 + Math.floor(0.5 * sides); }
}

class QueueRng {
  constructor(private queue: number[]) {}
  next(): number { return 0.5; }
  die(sides: number): number {
    const v = this.queue.shift();
    return v == null ? 1 + Math.floor(0.5 * sides) : v;
  }
}

function baseRogueCard(): UnitCard {
  return {
    id: 'rogue', name: '游荡者', kind: 'player', class: '游荡者', level: 1,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20, fpMax: 10, ac: 14, speed: 6, proficiency: 2, keyAttr: '敏捷',
    weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1, 手弩: 1, 火枪: 1 },
    resources: { comboPointsMax: 5 },
  };
}

function player(x: number, y: number, opts: { facing?: 'N' | 'S'; weapon?: WeaponData; inventoryTags?: string[] } = {}) {
  const card = baseRogueCard();
  card.weapon = opts.weapon ?? {
    id: 'dagger', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1,
    dice: '1D4', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent',
  };
  card.inventoryTags = opts.inventoryTags ?? [];
  return new UnitInstance(card, { team: 'player', x, y, facing: opts.facing ?? 'N' });
}

function goblin(x: number, y: number, opts: { facing?: 'N' | 'S' | 'W' | 'E'; ac?: number } = {}) {
  return new UnitInstance(
    {
      id: 'goblin', name: '哥布林', kind: 'monster',
      attrs: normalizeAttrs({ 力量: 8, 敏捷: 14, 体质: 10, 智力: 10, 感知: 10, 魅力: 8, 意志: 8, 幸运: 10 }),
      hpMax: 20, fpMax: 4, ac: opts.ac ?? 14, speed: 5, proficiency: 2, keyAttr: '敏捷',
      weaponProfs: { 短剑: 1 },
      weapon: { id: 'short', name: '短剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D4', damageType: '挥砍', attackAttr: '敏捷', rangeMetric: 'adjacent' },
    },
    { team: 'enemy', x, y, facing: opts.facing ?? 'S' },
  );
}

function encounterWith(...units: UnitInstance[]) {
  const e = new Encounter('test', new Board(10, 10), new SeededRng(1));
  for (const u of units) e.addUnit(u);
  return e;
}

const abilities = {
  backstab: backstabJson as unknown as AbilityCardData,
  sand: sandJson as unknown as AbilityCardData,
  bewildering: bewilderingJson as unknown as AbilityCardData,
  quickShot: quickShotJson as unknown as AbilityCardData,
  shockShot: shockShotJson as unknown as AbilityCardData,
  poison: poisonJson as unknown as AbilityCardData,
  sprint: sprintJson as unknown as AbilityCardData,
  sword: swordJson as unknown as AbilityCardData,
};

describe('P0 技能接入', () => {
  it('抛沙：扇形2环且面朝施法者，失败进入致盲', () => {
    const source = player(1, 2, { facing: 'N', inventoryTags: ['沙袋'] });
    beginTurn(source);
    const target = goblin(1, 1, { facing: 'S' }); // 面朝施法者
    const e = encounterWith(source, target);
    const result = executeAbility(abilities.sand, source, e, { rng: new FixedHitRng(), statusCatalog: statuses, level: 1 });
    expect(result.ok).toBe(true);
    expect(target.hasCondition('blinded')).toBe(true);
    expect(source.actions.main).toBe(false);
  });

  it('迷惑之刃：施法攻击命中造成2D4，豁免成功不进入困惑', () => {
    const source = player(0, 0);
    beginTurn(source);
    source.fp = 10;
    const target = goblin(2, 0, { ac: 14 });
    const e = encounterWith(source, target);
    const result = executeAbility(abilities.bewildering, source, e, { rng: new FixedHitRng(), statusCatalog: statuses, level: 1 });
    expect(result.ok).toBe(true);
    expect(result.damageByTarget.get('goblin')).toBe(6); // 2D4: 3+3
    expect(target.hasCondition('confused')).toBe(false);
    expect(source.fp).toBe(8);
  });

  it('迅捷连射：消耗弹药并获得连击点', () => {
    const source = player(0, 0, {
      weapon: {
        id: 'handbow', name: '手弩', category: '手弩', tags: ['手弩'], hands: 1,
        dice: '1D6', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'grid', rangeMax: 12, ammoType: '箭矢',
      },
    });
    source.ammo.set('箭矢', { type: '箭矢', reserve: 20, loaded: true });
    beginTurn(source);
    source.fp = 10;
    const target = goblin(2, 0, { ac: 14 });
    const e = encounterWith(source, target);
    const result = executeAbility(abilities.quickShot, source, e, { rng: new FixedHitRng(), statusCatalog: statuses, level: 1 });
    expect(result.ok).toBe(true);
    expect(result.damageByTarget.get('goblin')).toBe(7); // 1D6=4 + 敏调3
    expect(source.comboPoints).toBe(1);
    expect(source.ammo.get('箭矢')?.reserve).toBe(19);
    expect(source.ammo.get('箭矢')?.loaded).toBe(false);
    expect(source.actions.bonus).toBe(false);
  });

  it('震慑射击：AOE伤害+力量豁免击倒', () => {
    const source = player(0, 3, {
      facing: 'S',
      weapon: {
        id: 'gun', name: '火枪', category: '火器', tags: ['火枪'], hands: 1,
        dice: '1D8', damageType: '穿刺', isTech: true, attackAttr: null, rangeMetric: 'grid', rangeMax: 12, ammoType: '弹药',
      },
    });
    source.ammo.set('弹药', { type: '弹药', reserve: 20, loaded: true });
    beginTurn(source);
    source.fp = 10;
    const target = goblin(0, 4, { ac: 10 });
    const e = encounterWith(source, target);
    // AOE敏捷豁免D20=10失败→全伤；伤害骰1D8=5；力量豁免D20=9失败→击倒
    const result = executeAbility(abilities.shockShot, source, e, { rng: new QueueRng([10, 5, 9]), statusCatalog: statuses, level: 1 });
    expect(result.ok).toBe(true);
    expect(result.damageByTarget.get('goblin')).toBe(5);
    expect(target.hp).toBe(15);
    expect(target.hasCondition('prone')).toBe(true);
    expect(source.ammo.get('弹药')?.reserve).toBe(19);
    expect(source.fp).toBe(7);
  });

  it('疾跑：0动作=附赠动作，获得全速移动预算且仍可再花1动作全速移动', () => {
    const source = player(0, 0);
    beginTurn(source);
    source.fp = 10;
    const e = encounterWith(source);
    const result = executeAbility(abilities.sprint, source, e, { rng: new FixedHitRng(), statusCatalog: statuses, level: 1 });
    expect(result.ok).toBe(true);
    expect(source.actions.bonus).toBe(false);
    expect(source.actions.main).toBe(true);
    expect(source.fp).toBe(7);
    expect(source.moveBudget).toBe(12);
    expect(source.moveMode).toBe('dash');
    expect(source.dashUsedThisTurn).toBe(true);
  });

  it('短剑断奏：8方向直线位移4米内到目标8邻，再攻击', () => {
    const source = player(0, 4, {
      weapon: {
        id: 'rapier', name: '刺剑', category: '剑类', tags: ['剑', '单手'], hands: 1,
        dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent',
      },
    });
    beginTurn(source);
    source.fp = 10;
    const target = goblin(0, 1, { ac: 14 });
    const e = encounterWith(source, target);
    const result = executeAbility(abilities.sword, source, e, { rng: new FixedHitRng(), statusCatalog: statuses, level: 1 });
    expect(result.ok).toBe(true);
    expect(source.x).toBe(0);
    expect(source.y).toBe(2);
    expect(source.facing).toBe('N');
    expect(result.damageByTarget.get('goblin')).toBe(8); // 1D8=5 + 敏调3
    expect(target.hp).toBe(12);
    expect(target.hasCondition('disarmed')).toBe(false); // 敏捷豁免成功
    expect(source.fp).toBe(7);
    expect(source.actions.main).toBe(false);
    expect(result.events.some((ev) => ev.kind === 'move' && ev.detail?.includes('触发'))).toBe(true);
  });

  it('previewAbility：返回合法目标、条件/费用错误与范围格', () => {
    const source = player(1, 2, { facing: 'N', inventoryTags: ['沙袋'] });
    beginTurn(source);
    const target = goblin(1, 1, { facing: 'S' });
    const other = goblin(3, 0, { facing: 'W' });
    const e = encounterWith(source, target, other);
    const preview = previewAbility(abilities.sand, source, e, { rng: new FixedHitRng(), statusCatalog: statuses, level: 1 });
    expect(preview.targets.map((u) => u.id)).toEqual(['goblin']);
    expect(preview.conditionErrors).toEqual([]);
    expect(preview.costError).toBeNull();
    expect(preview.areaCells.length).toBe(4); // 扇形2环
  });

  it('previewAttackRoll：背刺在身后时命中加值+2', () => {
    const source = player(2, 0, { facing: 'N' });
    beginTurn(source);
    const target = goblin(1, 0, { facing: 'W' }); // 目标背后格=2,0
    const e = encounterWith(source, target);
    const preview = previewAttackRoll(abilities.backstab, source, target, e, {
      rng: new FixedHitRng(), statusCatalog: statuses, level: 1,
    });
    expect(preview).not.toBeNull();
    expect(preview?.bonus).toBe(6); // 敏调3 + 武器熟练1 + 背后2
    expect(preview?.vsAc).toBe(14);
    expect(preview?.hitChance).toBeCloseTo(0.65, 2); // 需要 d20>=8，13/20
  });

  it('毒刃：自选剧毒伤害，命中后体质豁免失败进入中毒', () => {
    const source = player(0, 0, { inventoryTags: ['基础毒药'] });
    beginTurn(source);
    source.fp = 10;
    const target = goblin(1, 0, { ac: 14 });
    const e = encounterWith(source, target);
    const result = executeAbility(abilities.poison, source, e, {
      rng: new FixedHitRng(),
      statusCatalog: statuses,
      level: 1,
      damageTypeChoice: '剧毒',
    });
    expect(result.ok).toBe(true);
    expect(result.damageByTarget.get('goblin')).toBe(6); // 1D4=3 + 敏调3
    expect(target.hp).toBe(14);
    expect(target.conditionLayersOf('poisoned')).toBe(2); // D3(D6=4) -> 2
    expect(source.fp).toBe(9);
  });
});
