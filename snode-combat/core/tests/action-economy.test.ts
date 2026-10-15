import { describe, expect, it } from 'vitest';
import { UnitInstance } from '../unit';
import { beginTurn, endTurn, mapActionText, useAction } from '../action-economy';
import { normalizeAttrs } from '../unit';

function makeUnit() {
  return new UnitInstance(
    {
      id: 'u',
      name: 'u',
      kind: 'monster',
      attrs: normalizeAttrs({}),
      hpMax: 10,
      fpMax: 5,
      ac: 10,
      speed: 6,
    },
    { team: 'enemy' },
  );
}

describe('动作经济', () => {
  it('每回合1主要+1附赠', () => {
    const u = makeUnit();
    beginTurn(u);
    expect(useAction(u, 'main')).toBe(true);
    expect(useAction(u, 'main')).toBe(false);
    expect(useAction(u, 'bonus')).toBe(true);
    expect(useAction(u, 'bonus')).toBe(false);
  });

  it('反应整场最多3次，不随回合恢复', () => {
    const u = makeUnit();
    beginTurn(u);
    for (let i = 0; i < 3; i += 1) expect(useAction(u, 'reaction')).toBe(true);
    expect(useAction(u, 'reaction')).toBe(false);
    endTurn(u);
    beginTurn(u);
    expect(useAction(u, 'reaction')).toBe(false);
  });

  it('动作文本映射：1动作=main，0动作=bonus', () => {
    expect(mapActionText('1动作')).toBe('main');
    expect(mapActionText('0动作')).toBe('bonus');
    expect(mapActionText('附赠动作')).toBe('bonus');
    expect(mapActionText('反应动作')).toBe('reaction');
  });
});
