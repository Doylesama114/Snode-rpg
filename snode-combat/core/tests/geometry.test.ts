import { describe, expect, it } from 'vitest';
import {
  backCell,
  combatDistance,
  coneCells,
  directionFromTo,
  gridDistance,
  isAdjacent,
  isMeleeAdjacent,
  line8Cells,
  rayAimsAtCell,
} from '../geometry';

describe('距离函数', () => {
  it('gridDistance：正交1、斜角2', () => {
    expect(gridDistance({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(2);
    expect(gridDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(2);
    expect(gridDistance({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(4);
  });

  it('isAdjacent：周围8格均相邻', () => {
    expect(isAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true);
    expect(isAdjacent({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it('combatDistance：水平距离+高度差', () => {
    expect(combatDistance({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 3 })).toBe(5);
  });

  it('isMeleeAdjacent：高度差<=1才可近战', () => {
    expect(isMeleeAdjacent({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBe(true);
    expect(isMeleeAdjacent({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 2 })).toBe(false);
  });
});

describe('扇形范围模板', () => {
  const key = (cells: { x: number; y: number }[]) =>
    cells.map((c) => `${c.x},${c.y}`).sort().join('|');

  it('正方向2环：九宫格8朝上 = 1,2,3,5', () => {
    // 九宫格坐标：1=(0,0) 2=(1,0) 3=(2,0) 5=(1,1) 8=(1,2)
    const result = coneCells({ x: 1, y: 2 }, 'N', 2).cells;
    expect(key(result)).toBe(key([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 },
    ]));
  });

  it('斜方向2环：九宫格9朝左上 = 2,4,5', () => {
    const result = coneCells({ x: 2, y: 2 }, 'NW', 2).cells;
    expect(key(result)).toBe(key([
      { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ]));
  });

  it('斜方向3环：5x5的19朝左上 = 3,7,8,11,12,13', () => {
    // 19=(3,3)，结果坐标：3=(2,0) 7=(1,1) 8=(2,1) 11=(0,2) 12=(1,2) 13=(2,2)
    const result = coneCells({ x: 3, y: 3 }, 'NW', 3).cells;
    expect(key(result)).toBe(key([
      { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    ]));
  });
});

describe('朝向与直线', () => {
  it('directionFromTo：归一到最近8方向', () => {
    expect(directionFromTo({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe('E');
    expect(directionFromTo({ x: 0, y: 0 }, { x: 0, y: -2 })).toBe('N');
    expect(directionFromTo({ x: 0, y: 0 }, { x: 3, y: -3 })).toBe('NE');
    expect(directionFromTo({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe('SE');
    expect(directionFromTo({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(null);
  });

  it('rayAimsAtCell：面朝向施法者判定', () => {
    expect(rayAimsAtCell({ x: 2, y: 0 }, 'W', { x: 0, y: 0 })).toBe(true);
    expect(rayAimsAtCell({ x: 2, y: 1 }, 'W', { x: 0, y: 0 })).toBe(false);
    expect(rayAimsAtCell({ x: 2, y: 2 }, 'NW', { x: 0, y: 0 })).toBe(true);
  });

  it('line8Cells：斜向每步成本2', () => {
    const cells = line8Cells({ x: 0, y: 0 }, 'SE', 4);
    expect(cells).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
    expect(line8Cells({ x: 0, y: 0 }, 'N', 4).length).toBe(4);
  });

  it('backCell：朝向反方向那一格', () => {
    expect(backCell({ x: 2, y: 2 }, 'N')).toEqual({ x: 2, y: 3 });
    expect(backCell({ x: 2, y: 2 }, 'NW')).toEqual({ x: 3, y: 3 });
  });
});
