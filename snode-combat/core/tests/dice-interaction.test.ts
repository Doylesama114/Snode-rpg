import { describe, expect, it } from 'vitest';
import backstabJson from '../../data/cards/abilities/rogue-backstab.json';
import bloodDrawJson from '../../data/cards/abilities/rogue-blood-draw.json';
import bleedingJson from '../../data/cards/statuses/bleeding.json';
import type { AbilityCardData, StatusCardData } from '../cards';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { SeededRng } from '../rng';
import { executeAbility } from '../resolver';
import { extractDiceSequence, DiceStepQueue } from '../dice-interaction';
import { beginTurn } from '../action-economy';
import { normalizeAttrs, UnitInstance } from '../unit';

const backstab = backstabJson as unknown as AbilityCardData;
const bloodDraw = bloodDrawJson as unknown as AbilityCardData;
const statusCatalog = new Map<string, StatusCardData>([
  [(bleedingJson as unknown as StatusCardData).id, bleedingJson as unknown as StatusCardData],
]);

class FixedRng {
  next(): number { return 0.5; }
  die(sides: number): number { return 1 + Math.floor(0.5 * sides); }
}

function makeRogue(x: number, y: number) {
  return new UnitInstance(
    {
      id: 'rogue', name: '游荡者', kind: 'player', class: '游荡者', level: 1,
      attrs: normalizeAttrs({ 力量: 8, 敏捷: 16, 体质: 12, 智力: 10, 感知: 14, 魅力: 10, 意志: 10, 幸运: 10 }),
      hpMax: 20, fpMax: 10, ac: 14, speed: 6, proficiency: 2, keyAttr: '敏捷',
      weaponProfs: { 刺剑: 1, 匕首: 1 },
      weapon: { id: 'dagger', name: '匕首', category: '匕首', tags: ['匕首'], hands: 1, dice: '1D8', damageType: '穿刺', attackAttr: '敏捷', rangeMetric: 'adjacent' },
      resources: { comboPointsMax: 5 },
    },
    { team: 'player', x, y, facing: 'N' },
  );
}

function makeGoblin(x: number, y: number) {
  return new UnitInstance(
    {
      id: 'goblin', name: '哥布林', kind: 'monster',
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

describe('掷骰交互层', () => {
  it('背刺：玩家掷骰队列包含命中D20与两个伤害骰', () => {
    const source = makeRogue(2, 0);
    beginTurn(source);
    source.fp = 10;
    const target = makeGoblin(1, 0);
    const e = encounterWith(source, target);
    const result = executeAbility(backstab, source, e, { rng: new FixedRng(), statusCatalog, level: 1 });
    const seq = extractDiceSequence(result.events);
    expect(seq.auto).toHaveLength(0);
    expect(seq.player.length).toBeGreaterThanOrEqual(3);
    expect(seq.player.map((s) => s.sides)).toEqual(expect.arrayContaining([20, 8, 4]));
    expect(seq.player.every((s) => s.owner === 'player')).toBe(true);
  });

  it('抽血：怪物豁免为自动，玩家伤害/层数骰为玩家', () => {
    const source = makeRogue(1, 0);
    beginTurn(source);
    source.fp = 10;
    source.gainCombo(2);
    const target = makeGoblin(0, 0);
    target.addCondition('bleeding', 1);
    const e = encounterWith(source, target);
    const result = executeAbility(bloodDraw, source, e, {
      rng: new FixedRng(),
      statusCatalog,
      level: 1,
      choose: (_p, _o) => 0,
    });
    const seq = extractDiceSequence(result.events);
    expect(seq.auto.length).toBeGreaterThanOrEqual(1);
    expect(seq.auto[0]?.owner).toBe('auto');
    expect(seq.auto[0]?.sides).toBe(20);
    const d3 = seq.player.find((s) => s.sides === 6 && s.mappedValues);
    expect(d3).toBeDefined();
    expect(d3?.mappedValues).toEqual([2]); // FixedRng D6=4 → 2
    expect(seq.player.some((s) => s.sides === 8)).toBe(true);
  });

  it('DiceStepQueue：player 与 auto 队列独立推进', () => {
    const steps = extractDiceSequence([
      {
        owner: 'player', label: '玩家攻击', kind: 'attack', unitId: 'p', targetId: 'e', total: 11,
        parts: [{ kind: 'dice', label: '1D20', values: [11], value: 11, owner: 'player' }],
      },
      {
        owner: 'auto', label: '怪物豁免', kind: 'save', unitId: 'e', targetId: 'p', total: 9,
        parts: [{ kind: 'dice', label: '1D20', values: [9], value: 9, owner: 'auto' }],
      },
    ]);
    const queue = new DiceStepQueue(steps);
    expect(queue.pendingPlayerCount).toBe(1);
    expect(queue.pendingAutoCount).toBe(1);
    expect(queue.takeNextPlayer()?.label).toBe('玩家攻击');
    expect(queue.takeNextAuto()?.label).toBe('怪物豁免');
    expect(queue.done).toBe(true);
  });
});
