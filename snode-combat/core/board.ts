import type { Position, Vec2 } from './types';
import { gridDistance } from './geometry';
import type { UnitInstance } from './unit';

export type TerrainType = 'floor' | 'blocked' | 'cover' | 'danger';

export interface TerrainCell {
  x: number;
  y: number;
  z?: number;
  type: TerrainType;
  height?: number;
  note?: string;
}

const NEIGHBORS_8: Vec2[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

export class Board {
  readonly width: number;
  readonly height: number;
  private readonly terrain = new Map<string, TerrainCell>();

  constructor(width: number, height: number, cells: TerrainCell[] = []) {
    if (width < 1 || height < 1) throw new Error('棋盘尺寸必须大于 0');
    this.width = width;
    this.height = height;
    for (const cell of cells) {
      this.setTerrain(cell);
    }
  }

  static key(x: number, y: number): string {
    return `${x},${y}`;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  setTerrain(cell: TerrainCell): void {
    if (!this.inBounds(cell.x, cell.y)) {
      throw new Error(`地形越界: ${cell.x},${cell.y}`);
    }
    this.terrain.set(Board.key(cell.x, cell.y), cell);
  }

  terrainAt(x: number, y: number): TerrainCell {
    return (
      this.terrain.get(Board.key(x, y)) ?? {
        x,
        y,
        type: 'floor',
        z: 0,
        height: 0,
      }
    );
  }

  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.terrainAt(x, y).type === 'blocked';
  }

  isPassable(x: number, y: number): boolean {
    return this.inBounds(x, y) && !this.isBlocked(x, y);
  }

  terrainZ(x: number, y: number): number {
    return this.terrainAt(x, y).z ?? 0;
  }

  /**
   * 是否可站立：界内、非障碍、无其他单位占据。
   * v1 无攀爬，地形高度必须与单位当前高度一致。
   */
  canStandAt(unit: UnitInstance, x: number, y: number, units: readonly UnitInstance[]): boolean {
    if (!this.isPassable(x, y)) return false;
    if (this.terrainZ(x, y) !== unit.z) return false;
    const occupant = this.unitAt(x, y, units);
    return occupant === null || occupant.id === unit.id;
  }

  unitAt(x: number, y: number, units: readonly UnitInstance[]): UnitInstance | null {
    for (const unit of units) {
      if (unit.hp > 0 && unit.x === x && unit.y === y) return unit;
    }
    return null;
  }

  /**
   * 8 方向 Dijkstra：正交成本 1、斜向成本 2。
   * 返回不含起点的路径；maxCost 为 undefined 时不限。
   */
  findPath(
    unit: UnitInstance,
    target: Vec2,
    units: readonly UnitInstance[],
    maxCost?: number,
    passThroughUnits = false,
  ): { path: Vec2[]; cost: number } | null {
    if (!this.canStandAt(unit, target.x, target.y, units)) return null;
    const start = Board.key(unit.x, unit.y);
    const goal = Board.key(target.x, target.y);
    if (start === goal) return { path: [], cost: 0 };

    const cameFrom = new Map<string, string>();
    const costs = new Map<string, number>([[start, 0]]);
    const open: { x: number; y: number; cost: number }[] = [
      { x: unit.x, y: unit.y, cost: 0 },
    ];

    while (open.length > 0) {
      open.sort((a, b) => a.cost - b.cost);
      const current = open.shift() as { x: number; y: number; cost: number };
      const currentKey = Board.key(current.x, current.y);
      if (currentKey === goal) break;
      if ((costs.get(currentKey) ?? Infinity) < current.cost) continue;

      for (const n of NEIGHBORS_8) {
        const nx = current.x + n.x;
        const ny = current.y + n.y;
        const standable = passThroughUnits
          ? this.isPassable(nx, ny) && this.terrainZ(nx, ny) === unit.z
          : this.canStandAt(unit, nx, ny, units);
        if (!standable) continue;
        const stepCost = n.x !== 0 && n.y !== 0 ? 2 : 1;
        const nextCost = current.cost + stepCost;
        if (maxCost !== undefined && nextCost > maxCost) continue;
        const nk = Board.key(nx, ny);
        if ((costs.get(nk) ?? Infinity) <= nextCost) continue;
        costs.set(nk, nextCost);
        cameFrom.set(nk, currentKey);
        open.push({ x: nx, y: ny, cost: nextCost });
      }
    }

    const endCost = costs.get(goal);
    if (endCost === undefined) return null;

    const path: Vec2[] = [];
    let cursor = goal;
    while (cursor !== start) {
      const [x, y] = cursor.split(',').map(Number);
      path.push({ x: x as number, y: y as number });
      const prev = cameFrom.get(cursor);
      if (!prev) return null;
      cursor = prev;
    }
    path.reverse();
    return { path, cost: endCost };
  }

  /** 返回预算内所有可到达格及成本。 */
  reachableCells(
    unit: UnitInstance,
    units: readonly UnitInstance[],
    maxCost: number,
  ): Map<string, number> {
    const start = Board.key(unit.x, unit.y);
    const costs = new Map<string, number>([[start, 0]]);
    const open: { x: number; y: number; cost: number }[] = [
      { x: unit.x, y: unit.y, cost: 0 },
    ];
    while (open.length > 0) {
      open.sort((a, b) => a.cost - b.cost);
      const current = open.shift() as { x: number; y: number; cost: number };
      const currentKey = Board.key(current.x, current.y);
      if ((costs.get(currentKey) ?? Infinity) < current.cost) continue;
      for (const n of NEIGHBORS_8) {
        const nx = current.x + n.x;
        const ny = current.y + n.y;
        if (!this.canStandAt(unit, nx, ny, units)) continue;
        const stepCost = n.x !== 0 && n.y !== 0 ? 2 : 1;
        const nextCost = current.cost + stepCost;
        if (nextCost > maxCost) continue;
        const nk = Board.key(nx, ny);
        if ((costs.get(nk) ?? Infinity) <= nextCost) continue;
        costs.set(nk, nextCost);
        open.push({ x: nx, y: ny, cost: nextCost });
      }
    }
    costs.delete(start);
    return costs;
  }

  /** 两个位置间的水平地形距离（不考虑单位占位）。 */
  static terrainDistance(a: Position, b: Position): number {
    return gridDistance(a, b) + Math.abs((a.z ?? 0) - (b.z ?? 0));
  }
}
