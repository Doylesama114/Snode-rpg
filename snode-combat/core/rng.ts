/**
 * 种子化随机数，保证回放一致。
 * mulberry32：确定性、可序列化。
 */

export interface RngLike {
  next(): number;
}

export class SeededRng implements RngLike {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [0, 1) 浮点数 */
  float(): number {
    return this.next();
  }

  /** [1, sides] 整数 */
  die(sides: number): number {
    if (sides < 1 || !Number.isInteger(sides)) {
      throw new Error(`非法骰面数: ${sides}`);
    }
    return 1 + Math.floor(this.next() * sides);
  }

  /** D20 */
  d20(): number {
    return this.die(20);
  }

  /** [min, max] 闭区间整数（用于随机数表） */
  intBetween(min: number, max: number): number {
    if (max < min) throw new Error('intBetween: max < min');
    return min + Math.floor(this.next() * (max - min + 1));
  }

  getState(): number {
    return this.state >>> 0;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }

  fork(seedMix: number): SeededRng {
    return new SeededRng((this.state ^ (seedMix >>> 0)) >>> 0);
  }
}

/** 从任意种子整数创建 RNG。 */
export function createRng(seed: number): SeededRng {
  return new SeededRng(seed);
}
