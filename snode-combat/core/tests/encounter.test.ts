import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { Encounter } from '../encounter';
import { SeededRng } from '../rng';
import { UnitInstance, normalizeAttrs } from '../unit';

function makeUnit(id: string, team: 'player' | 'enemy', fixedInitiative: number, hp = 10) {
  return new UnitInstance(
    {
      id,
      name: id,
      kind: team === 'player' ? 'player' : 'monster',
      attrs: normalizeAttrs({ 敏捷: 14 }),
      hpMax: hp,
      fpMax: 5,
      ac: 10,
      speed: 6,
      initiative: { mode: 'fixed', value: fixedInitiative },
    },
    { team, x: 0, y: 0 },
  );
}

describe('Encounter', () => {
  it('先攻降序，同值稳定保持加入顺序', () => {
    const e = new Encounter('e', new Board(5, 5), new SeededRng(1));
    e.addUnit(makeUnit('player', 'player', 5));
    e.addUnit(makeUnit('wolf', 'enemy', 7));
    e.addUnit(makeUnit('goblin', 'enemy', 7));
    e.rollInitiative();
    expect(e.initiative.map((x) => x.unitId)).toEqual(['wolf', 'goblin', 'player']);
  });

  it('回合循环与轮次递增', () => {
    const e = new Encounter('e', new Board(5, 5), new SeededRng(1));
    e.addUnit(makeUnit('player', 'player', 5));
    e.addUnit(makeUnit('wolf', 'enemy', 7));
    e.rollInitiative();
    e.start();
    expect(e.currentUnit?.id).toBe('wolf');
    e.endTurn();
    expect(e.currentUnit?.id).toBe('player');
    expect(e.round).toBe(1);
    e.endTurn();
    expect(e.currentUnit?.id).toBe('wolf');
    expect(e.round).toBe(2);
  });

  it('回合开始恢复1主要+1附赠', () => {
    const e = new Encounter('e', new Board(5, 5), new SeededRng(1));
    const wolf = makeUnit('wolf', 'enemy', 7);
    const player = makeUnit('player', 'player', 5);
    e.addUnit(player);
    e.addUnit(wolf);
    e.rollInitiative();
    e.start();
    expect(wolf.actions.main).toBe(true);
    expect(wolf.actions.bonus).toBe(true);
    wolf.useAction('main');
    e.endTurn();
    expect(e.currentUnit?.id).toBe('player');
    expect(wolf.actions.main).toBe(false);
  });

  it('跳过死亡单位并判定胜负', () => {
    const e = new Encounter('e', new Board(5, 5), new SeededRng(1));
    const player = makeUnit('player', 'player', 5);
    const wolf = makeUnit('wolf', 'enemy', 7);
    e.addUnit(player);
    e.addUnit(wolf);
    e.rollInitiative();
    e.start();
    wolf.hp = 0;
    const outcome = e.endTurn();
    expect(outcome).toBe('victory');
    expect(e.phase).toBe('ended');
    expect(e.outcome).toBe('victory');
  });

  it('玩家死亡判定失败', () => {
    const e = new Encounter('e', new Board(5, 5), new SeededRng(1));
    const player = makeUnit('player', 'player', 5);
    const wolf = makeUnit('wolf', 'enemy', 7);
    e.addUnit(player);
    e.addUnit(wolf);
    e.rollInitiative();
    e.start();
    player.hp = 0;
    e.endTurn();
    expect(e.outcome).toBe('defeat');
  });
});
