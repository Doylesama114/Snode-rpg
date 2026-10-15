import { describe, expect, it } from 'vitest';
import { Board } from '../board';
import { UnitInstance, normalizeAttrs } from '../unit';

function unitAt(id: string, x: number, y: number) {
  return new UnitInstance(
    {
      id,
      name: id,
      kind: 'monster',
      attrs: normalizeAttrs({}),
      hpMax: 10,
      fpMax: 5,
      ac: 10,
      speed: 6,
    },
    { team: 'enemy', x, y },
  );
}

describe('Board', () => {
  it('越界与地形', () => {
    const board = new Board(5, 5, [{ x: 1, y: 1, type: 'blocked' }]);
    expect(board.inBounds(0, 0)).toBe(true);
    expect(board.inBounds(5, 0)).toBe(false);
    expect(board.isBlocked(1, 1)).toBe(true);
    expect(board.isBlocked(99, 0)).toBe(true);
  });

  it('斜向路径成本为2：0,0 -> 2,2 成本4', () => {
    const board = new Board(5, 5);
    const u = unitAt('u', 0, 0);
    const result = board.findPath(u, { x: 2, y: 2 }, [u]);
    expect(result).not.toBeNull();
    expect(result?.cost).toBe(4);
    expect(result?.path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('障碍物迫使绕行', () => {
    const board = new Board(4, 3, [{ x: 1, y: 0, type: 'blocked' }]);
    const u = unitAt('u', 0, 0);
    const result = board.findPath(u, { x: 2, y: 0 }, [u]);
    expect(result).not.toBeNull();
    expect(result?.cost).toBe(4);
    expect(result?.path.at(-1)).toEqual({ x: 2, y: 0 });
  });

  it('单位占位不可通行', () => {
    const board = new Board(3, 3);
    const mover = unitAt('mover', 0, 0);
    const blocker = unitAt('blocker', 1, 0);
    expect(board.canStandAt(mover, 1, 0, [mover, blocker])).toBe(false);
    expect(board.canStandAt(mover, 0, 0, [mover, blocker])).toBe(true);
  });

  it('reachableCells：最大预算过滤', () => {
    const board = new Board(6, 6);
    const u = unitAt('u', 2, 2);
    const cells = board.reachableCells(u, [u], 2);
    // 预算2：4个正交邻格(1) + 4个斜角邻格(2) + 4个正交两格(2) = 12
    expect(cells.size).toBe(12);
    expect(cells.get('3,2')).toBe(1);
    expect(cells.get('3,3')).toBe(2);
    expect(cells.get('4,2')).toBe(2);
  });
});
