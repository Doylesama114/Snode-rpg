import type { DiceEval, DicePart, ExpressionContext } from './types';

type Token =
  | { type: 'num'; value: number }
  | { type: 'dice'; count: number; sides: number }
  | { type: 'var'; name: string }
  | { type: 'ident'; name: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

class ExprParser {
  private tokens: Token[] = [];
  private pos = 0;

  constructor(input: string) {
    this.tokens = tokenize(input);
  }

  parse(): DiceEval {
    if (this.tokens.length === 0) throw new Error('空表达式');
    const result = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error(`表达式存在未解析内容: ${JSON.stringify(this.tokens[this.pos])}`);
    }
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private take(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error('表达式意外结束');
    this.pos += 1;
    return token;
  }

  private parseAddSub(): DiceEval {
    let left = this.parseMulDiv();
    while (true) {
      const token = this.peek();
      if (token && token.type === 'op' && (token.value === '+' || token.value === '-')) {
        this.take();
        const right = this.parseMulDiv();
        left = combine(left, right, token.value);
      } else {
        return left;
      }
    }
  }

  private parseMulDiv(): DiceEval {
    let left = this.parseUnary();
    while (true) {
      const token = this.peek();
      if (token && token.type === 'op' && (token.value === '*' || token.value === '/')) {
        this.take();
        const right = this.parseUnary();
        left = combine(left, right, token.value);
      } else {
        return left;
      }
    }
  }

  private parseUnary(): DiceEval {
    const token = this.peek();
    if (token && token.type === 'op' && token.value === '-') {
      this.take();
      const value = this.parseUnary();
      return {
        total: -value.total,
        parts: value.parts.map((p) => ({ ...p, value: -p.value })),
      };
    }
    if (token && token.type === 'op' && token.value === '+') {
      this.take();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): DiceEval {
    const token = this.take();
    if (token.type === 'num') {
      return { total: token.value, parts: [this.ownedPart('flat', String(token.value), token.value)] };
    }
    if (token.type === 'dice') {
      const context = this.context;
      if (!context) throw new Error('掷骰表达式缺少 RNG 上下文');
      const values: number[] = [];
      const mappedValues: number[] = [];
      for (let i = 0; i < token.count; i += 1) {
        if (token.sides === 3) {
          // 项目所有者裁决：1D3 = 掷 D6，1/2→1，3/4→2，5/6→3
          const raw = context.rng.die(6);
          const mapped = raw <= 2 ? 1 : raw <= 4 ? 2 : 3;
          values.push(raw);
          mappedValues.push(mapped);
        } else {
          values.push(context.rng.die(token.sides));
        }
      }
      const floor = this.context?.diceFloor;
      const adjustedValues = values.map((v) => (floor !== undefined ? Math.max(v, floor) : v));
      const total = (mappedValues.length > 0 ? mappedValues : adjustedValues).reduce((sum, v) => sum + v, 0);
      return {
        total,
        parts: [
          {
            kind: 'dice',
            label: token.sides === 3 ? `${token.count}D3(D6)` : `${token.count}D${token.sides}`,
            values,
            mappedValues: mappedValues.length > 0 ? mappedValues : undefined,
            value: total,
            owner: this.context?.owner,
          },
        ],
      };
    }
    if (token.type === 'var') {
      const value = this.lookupVariable(token.name);
      return { total: value, parts: [this.ownedPart('flat', `@${token.name}`, value)] };
    }
    if (token.type === 'ident') {
      const fn = token.name;
      const left = this.peek();
      if (!left || left.type !== 'lparen') {
        throw new Error(`未知标识符: ${fn}`);
      }
      this.take(); // (
      const args: DiceEval[] = [];
      if (this.peek()?.type !== 'rparen') {
        args.push(this.parseAddSub());
        while (this.peek()?.type === 'comma') {
          this.take();
          args.push(this.parseAddSub());
        }
      }
      const right = this.peek();
      if (!right || right.type !== 'rparen') throw new Error(`${fn} 缺少右括号`);
      this.take();
      return this.callFunction(fn, args);
    }
    if (token.type === 'lparen') {
      const inner = this.parseAddSub();
      const right = this.take();
      if (right.type !== 'rparen') throw new Error('括号不匹配');
      return inner;
    }
    throw new Error(`无法解析 token: ${JSON.stringify(token)}`);
  }

  private context: ExpressionContext | null = null;

  evaluate(context: ExpressionContext): DiceEval {
    this.context = context;
    return this.parse();
  }

  private ownedPart(kind: 'flat' | 'variable', label: string, value: number): DicePart {
    return { kind, label, value, owner: this.context?.owner };
  }

  private lookupVariable(name: string): number {
    const variables = this.context?.variables ?? {};
    if (!(name in variables)) {
      throw new Error(`未定义变量: @${name}`);
    }
    return variables[name] as number;
  }

  private callFunction(name: string, args: DiceEval[]): DiceEval {
    const values = args.map((arg) => arg.total);
    const parts = args.flatMap((arg) => arg.parts);
    let total: number;
    switch (name) {
      case 'min':
        if (values.length < 1) throw new Error('min 至少需要 1 个参数');
        total = Math.min(...values);
        break;
      case 'max':
        if (values.length < 1) throw new Error('max 至少需要 1 个参数');
        total = Math.max(...values);
        break;
      case 'floor':
        if (values.length !== 1) throw new Error('floor 需要 1 个参数');
        total = Math.floor(values[0] as number);
        break;
      case 'ceil':
        if (values.length !== 1) throw new Error('ceil 需要 1 个参数');
        total = Math.ceil(values[0] as number);
        break;
      default:
        throw new Error(`不支持的函数: ${name}`);
    }
    return { total, parts: [...parts, this.ownedPart('flat', `${name}()`, total)] };
  }
}

function flatPart(label: string, value: number): DicePart {
  return { kind: 'flat', label, value };
}

function combine(left: DiceEval, right: DiceEval, op: string): DiceEval {
  const total =
    op === '+'
      ? left.total + right.total
      : op === '-'
        ? left.total - right.total
        : op === '*'
          ? left.total * right.total
          : op === '/'
            ? left.total / right.total
            : (() => {
                throw new Error(`不支持的运算符: ${op}`);
              })();
  return { total, parts: [...left.parts, ...right.parts] };
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '@') {
      const match = /^@[A-Za-z_][A-Za-z0-9_.]*/.exec(input.slice(i));
      if (!match) throw new Error(`非法变量 @ 位置 ${i}`);
      tokens.push({ type: 'var', name: match[0].slice(1) });
      i += match[0].length;
      continue;
    }
    const diceMatch = /^\d+[dD]\d+/.exec(input.slice(i));
    if (diceMatch) {
      const [countStr, sidesStr] = diceMatch[0].split(/[dD]/);
      tokens.push({ type: 'dice', count: Number(countStr), sides: Number(sidesStr as string) });
      i += diceMatch[0].length;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const match = /^\d+(\.\d+)?/.exec(input.slice(i));
      if (!match) throw new Error(`非法数字位置 ${i}`);
      tokens.push({ type: 'num', value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i));
    if (identMatch) {
      tokens.push({ type: 'ident', name: identMatch[0] });
      i += identMatch[0].length;
      continue;
    }
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }
    throw new Error(`非法字符: ${ch}`);
  }
  return tokens;
}

/** 解析并计算表达式。返回总值与明细 parts（掷骰动画/日志可用）。 */
export function evaluateExpression(input: string, context: ExpressionContext): DiceEval {
  const parser = new ExprParser(input);
  return parser.evaluate(context);
}

/** 只取数值。 */
export function evaluateNumber(input: string, context: ExpressionContext): number {
  return evaluateExpression(input, context).total;
}

/**
 * 计算表达式中的骰子期望值（用于双持“取期望伤害较低”的武器）。
 * 仅支持线性骰子表达式：NdS、整数、加减；其余返回 NaN。
 */
export function expectedDiceValue(input: string): number {
  const text = input.replace(/\s+/g, '');
  let total = 0;
  const diceRe = /(\d+)[dD](\d+)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = diceRe.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (!/^[+\-]*$/.test(before)) return Number.NaN;
    total += Number(match[1]) * (Number(match[2]) + 1) / 2;
    lastIndex = match.index + match[0].length;
  }
  const tail = text.slice(lastIndex);
  if (!/^$/.test(tail)) return Number.NaN;
  return total;
}
