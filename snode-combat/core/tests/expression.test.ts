import { describe, expect, it } from 'vitest';
import { evaluateExpression, evaluateNumber } from '../expression';
import { SeededRng } from '../rng';

function ctx(vars: Record<string, number> = {}) {
  return { rng: new SeededRng(1), variables: vars };
}

describe('表达式', () => {
  it('基础运算与优先级', () => {
    expect(evaluateNumber('1+2*3', ctx())).toBe(7);
    expect(evaluateNumber('(1+2)*3', ctx())).toBe(9);
    expect(evaluateNumber('-5 + 10', ctx())).toBe(5);
    expect(evaluateNumber('10 / 4', ctx())).toBe(2.5);
  });

  it('变量', () => {
    expect(evaluateNumber('@strMod + 1', ctx({ strMod: 3 }))).toBe(4);
    expect(() => evaluateNumber('@missing', ctx())).toThrow('未定义变量');
  });

  it('掷骰表达式记录明细', () => {
    const result = evaluateExpression('2D4 + 1', ctx());
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeLessThanOrEqual(9);
    expect(result.parts[0]?.kind).toBe('dice');
    expect(result.parts[0]?.values).toHaveLength(2);
    expect(result.parts[1]?.value).toBe(1);
  });

  it('函数', () => {
    expect(evaluateNumber('min(@wisMod, 2)', ctx({ wisMod: 4 }))).toBe(2);
    expect(evaluateNumber('max(@wisMod, 2)', ctx({ wisMod: 4 }))).toBe(4);
    expect(evaluateNumber('floor(@speed / 2)', ctx({ speed: 7 }))).toBe(3);
    expect(evaluateNumber('ceil(@speed / 2)', ctx({ speed: 7 }))).toBe(4);
  });

  it('掷骰归属记录到 parts', () => {
    const player = evaluateExpression('1D4', { ...ctx(), owner: 'player' });
    expect(player.parts[0]?.owner).toBe('player');
    const auto = evaluateExpression('1D4', { ...ctx(), owner: 'auto' });
    expect(auto.parts[0]?.owner).toBe('auto');
  });

  it('1D3 按 D6 映射：1/2=1，3/4=2，5/6=3', () => {
    const fake = { next: () => 0.5, die: (sides: number) => (sides === 6 ? 5 : sides) };
    const result = evaluateExpression('1D3', { rng: fake, variables: {}, owner: 'player' });
    expect(result.total).toBe(3);
    expect(result.parts[0]?.values).toEqual([5]);
    expect(result.parts[0]?.mappedValues).toEqual([3]);
    expect(result.parts[0]?.label).toBe('1D3(D6)');
  });

  it('非法输入报错', () => {
    expect(() => evaluateNumber('1D', ctx())).toThrow();
    expect(() => evaluateNumber('foo(1)', ctx())).toThrow('不支持的函数');
  });
});
