import { describe, expect, it } from 'vitest';
import { SeededRng } from '../rng';

describe('SeededRng', () => {
  it('同种子序列一致', () => {
    const a = new SeededRng(1234);
    const b = new SeededRng(1234);
    const seqA = [a.next(), a.next(), a.d20(), a.die(6)];
    const seqB = [b.next(), b.next(), b.d20(), b.die(6)];
    expect(seqA).toEqual(seqB);
  });

  it('setState 可恢复序列', () => {
    const a = new SeededRng(42);
    const first = a.d20();
    const state = a.getState();
    const b = new SeededRng(0);
    b.setState(state);
    expect(b.d20()).toBe(a.d20());
    void first;
  });

  it('die 范围正确', () => {
    const rng = new SeededRng(7);
    for (let i = 0; i < 100; i += 1) {
      const roll = rng.die(6);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
  });

  it('intBetween 闭区间', () => {
    const rng = new SeededRng(9);
    for (let i = 0; i < 100; i += 1) {
      const n = rng.intBetween(1, 3);
      expect([1, 2, 3]).toContain(n);
    }
  });
});
