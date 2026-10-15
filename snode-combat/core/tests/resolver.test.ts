import { describe, expect, it } from 'vitest';
import backstabJson from '../../data/cards/abilities/rogue-backstab.json';
import bloodDrawJson from '../../data/cards/abilities/rogue-blood-draw.json';
import bleedingJson from '../../data/cards/statuses/bleeding.json';
import type { AbilityCardData, StatusCardData } from '../cards';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { executeAbility } from '../resolver';
import { beginTurn } from '../action-economy';
import { normalizeAttrs, UnitInstance } from '../unit';
import { SeededRng } from '../rng';
import type { UnitCard } from '../types';

const backstab = backstabJson as unknown as AbilityCardData;
const bloodDraw = bloodDrawJson as unknown as AbilityCardData;
const statusCatalog = new Map<string, StatusCardData>([
  [(bleedingJson as unknown as StatusCardData).id, bleedingJson as unknown as StatusCardData],
]);

class FixedRng {
  next(): number {
    return 0.5;
  }
  die(sides: number): number {
    return 1 + Math.floor(0.5 * sides);
  }
}

function rogueCard(): UnitCard {
  return {
    id: 'rogue',
    name: '游荡者',
    kind: 'player',
    class: '游荡者',
    level: 1,
    attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
    hpMax: 20,
    fpMax: 10,
    ac: 14,
    speed: 6,
    proficiency: 2,
    keyAttr: '敏捷',
    weaponProfs: { 刺剑: 1, 匕首: 1, 袖剑: 1 },
    resources: { comboPointsMax: 5 },
  };
}

function daggerUnit(x: number, y: number): UnitInstance {
  const card = rogueCard();
  card.weapon = {
    id: 'dagger', name: '匕首', category: '匕首', tags: ['匕首', '单手'], hands: 1,
    dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent',
  };
  return new UnitInstance(card, { team: 'player', x, y, facing: 'N' });
}

function rapierUnit(x: number, y: number): UnitInstance {
  const card = rogueCard();
  card.weapon = {
    id: 'rapier', name: '刺剑', category: '剑类', tags: ['剑', '单手'], hands: 1,
    dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent',
  };
  return new UnitInstance(card, { team: 'player', x, y, facing: 'N' });
}

function goblinTarget(x: number, y: number, facing: 'W' | 'N' = 'N'): UnitInstance {
  return new UnitInstance(
    {
      id: 'goblin',
      name: '哥布林',
      kind: 'monster',
      attrs: normalizeAttrs({ 力量: 8, 敏捷: 14, 体质: 10, 智力: 10, 感知: 10, 魅力: 8, 意志: 8, 幸运: 10 }),
      hpMax: 20,
      fpMax: 4,
      ac: 14,
      speed: 5,
      proficiency: 2,
      keyAttr: '敏捷',
      weaponProfs: { 短剑: 1 },
      weapon: { id: 'shortsword', name: '短剑', category: '剑类', tags: ['剑'], hands: 1, dice: '1D4', damageType: '挥砍', attackAttr: '敏捷', rangeMetric: 'adjacent' },
    },
    { team: 'enemy', x, y, facing },
  );
}

function encounterWith(...units: UnitInstance[]): Encounter {
  const e = new Encounter('test', new Board(6, 6), new SeededRng(1));
  for (const u of units) e.addUnit(u);
  return e;
}

describe('AbilityResolver P0 链路', () => {
  it('背刺：背后+2命中，武器伤害+1D4', () => {
    const source = daggerUnit(2, 0);
    beginTurn(source);
    source.fp = 10;
    // 目标面向 W，背后格 = (2,0) = 游荡者位置
    const target = goblinTarget(1, 0, 'W');
    const e = encounterWith(source, target);
    const result = executeAbility(backstab, source, e, { rng: new FixedRng(), statusCatalog, level: 1 });
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.damageByTarget.get('goblin')).toBe(11); // 1D8=5 + 敏调3 + 1D4=3
    expect(target.hp).toBe(9);
    expect(source.fp).toBe(9);
    expect(source.actions.main).toBe(false);
    expect(result.events.some((ev) => ev.kind === 'attack' && ev.owner === 'player')).toBe(true);
  });

  it('抽血：流血前置加成 + 豁免失败 D3 + 可选连击点消耗', () => {
    const source = rapierUnit(1, 0);
    beginTurn(source);
    source.fp = 10;
    source.gainCombo(3);
    const target = goblinTarget(0, 0);
    target.addCondition('bleeding', 2); // 施放前已流血2层

    const e = encounterWith(source, target);
    const result = executeAbility(bloodDraw, source, e, {
      rng: new FixedRng(),
      statusCatalog,
      level: 1,
      choose: (_prompt, options, _ctx) => {
        expect(options[0]).toContain('消耗全部连击点');
        return 0;
      },
    });

    expect(result.ok).toBe(true);
    // 武器 8 + 失血 5 = 13；HP 20 -> 7
    expect(target.hp).toBe(7);
    // 原2层 + 豁免失败D3(固定D6=4 -> 2) + 已流血+1 + 消耗3连击点+3 = 8层
    expect(target.conditionLayersOf('bleeding')).toBe(8);
    expect(source.comboPoints).toBe(0);
    expect(source.fp).toBe(8);
    expect(result.appliedStatuses.some((s) => s.status === 'bleeding')).toBe(true);
  });
});
