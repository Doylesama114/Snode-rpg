import type { Direction, DirectionVector, Position, Vec2 } from './types';

export const DIRECTION_VECTORS: Record<Direction, DirectionVector> = {
  N:  { dir: 'N',  dx: 0,  dy: -1 },
  NE: { dir: 'NE', dx: 1,  dy: -1 },
  E:  { dir: 'E',  dx: 1,  dy: 0 },
  SE: { dir: 'SE', dx: 1,  dy: 1 },
  S:  { dir: 'S',  dx: 0,  dy: 1 },
  SW: { dir: 'SW', dx: -1, dy: 1 },
  W:  { dir: 'W',  dx: -1, dy: 0 },
  NW: { dir: 'NW', dx: -1, dy: -1 },
};

export const DIRECTIONS_8: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function oppositeDirection(dir: Direction): Direction {
  return DIRECTIONS_8[(DIRECTIONS_8.indexOf(dir) + 4) % 8] as Direction;
}

/**
 * 位移/射程水平距离：正交 1，斜角 2。
 * 规则裁决：gridDistance(a,b) = |dx| + |dy|。
 */
export function gridDistance(a: Vec2, b: Vec2): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

/**
 * 相邻判定：周围 8 格都算相邻（近战/触及/借机威胁）。
 * 规则裁决：isAdjacent(a,b) = max(|dx|,|dy|) <= 1。
 */
export function isAdjacent(a: Vec2, b: Vec2): boolean {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) <= 1;
}

/** 实际距离 = 水平距离 + 高度差绝对值。 */
export function combatDistance(a: Position, b: Position): number {
  const hd = gridDistance(a, b);
  return hd + Math.abs((a.z ?? 0) - (b.z ?? 0));
}

/** 近战/触及相邻：8 格相邻且高度差 <= 1。 */
export function isMeleeAdjacent(a: Position, b: Position): boolean {
  return isAdjacent(a, b) && Math.abs((a.z ?? 0) - (b.z ?? 0)) <= 1;
}

/**
 * 把 from -> to 归一到最近的 8 方向。
 * 同一格返回 null。
 */
export function directionFromTo(from: Vec2, to: Vec2): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;

  // 屏幕坐标 y 向下。角度 0=东，90=北（与常用方向一致）。
  const angle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const octant = ((Math.round(angle / 45) % 8) + 8) % 8;
  const mapping: Direction[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  return mapping[octant] as Direction;
}

/**
 * 判定 from 沿 facing 方向的射线是否经过 to。
 * 用于“面朝向施法者所在格”。
 */
export function rayAimsAtCell(from: Vec2, facing: Direction, to: Vec2): boolean {
  const v = DIRECTION_VECTORS[facing];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (v.dx === 0) {
    return dx === 0 && Math.sign(dy) === Math.sign(v.dy);
  }
  if (v.dy === 0) {
    return dy === 0 && Math.sign(dx) === Math.sign(v.dx);
  }
  return Math.sign(dx) === Math.sign(v.dx)
    && Math.sign(dy) === Math.sign(v.dy)
    && Math.abs(dx) === Math.abs(dy);
}

/**
 * 扇形（锥形）范围模板。
 * 正方向：第 r 层宽度 2r-1。
 * 斜方向：第 r 层 r 格，(dx*k, dy*(r+1-k))，k=1..r。
 */
export function coneCells(origin: Vec2, facing: Direction, rings: number): { cells: Vec2[]; layers: Vec2[][] } {
  const v = DIRECTION_VECTORS[facing];
  const isDiagonal = v.dx !== 0 && v.dy !== 0;
  const layers: Vec2[][] = [];

  for (let ring = 1; ring <= rings; ring += 1) {
    const cells: Vec2[] = [];
    if (isDiagonal) {
      for (let k = 1; k <= ring; k += 1) {
        cells.push({
          x: origin.x + v.dx * k,
          y: origin.y + v.dy * (ring + 1 - k),
        });
      }
    } else {
      const width = 2 * ring - 1;
      const lx = origin.x + v.dx * ring;
      const ly = origin.y + v.dy * ring;
      for (let w = 0; w < width; w += 1) {
        if (v.dx !== 0) {
          cells.push({ x: lx, y: origin.y - Math.floor(width / 2) + w });
        } else {
          cells.push({ x: origin.x - Math.floor(width / 2) + w, y: ly });
        }
      }
    }
    layers.push(cells);
  }

  return { cells: layers.flat(), layers };
}

/**
 * 从 start 沿 direction 直线取格（不含起点），直到累计成本超过 maxCost。
 * 正交每步成本 1，斜向每步成本 2。
 */
export function line8Cells(start: Vec2, direction: Direction, maxCost: number): Vec2[] {
  const v = DIRECTION_VECTORS[direction];
  const stepCost = v.dx !== 0 && v.dy !== 0 ? 2 : 1;
  const maxSteps = Math.floor(maxCost / stepCost);
  const cells: Vec2[] = [];
  for (let i = 1; i <= maxSteps; i += 1) {
    cells.push({ x: start.x + v.dx * i, y: start.y + v.dy * i });
  }
  return cells;
}

/** 格子是否位于目标周围 8 格内。 */
export function isAroundCell(cell: Vec2, target: Vec2): boolean {
  return isAdjacent(cell, target);
}

/** 朝向反方向那一格（背刺的“背后”）。 */
export function backCell(pos: Vec2, facing: Direction): Vec2 {
  const v = DIRECTION_VECTORS[facing];
  return { x: pos.x - v.dx, y: pos.y - v.dy };
}

/** 移动路径成本（含从起点到后续每格）：正交 1，斜向 2。 */
export function pathCost(path: Vec2[], start: Vec2 = { x: 0, y: 0 }): number {
  let total = 0;
  let prev = start;
  for (const cell of path) {
    total += gridDistance(prev, cell);
    prev = cell;
  }
  return total;
}
