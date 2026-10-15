import type { DicePart, RollOwner } from './types';
import type { RollEvent } from './resolver';

export interface DiceRollStep {
  /** 全局唯一步骤 id */
  id: string;
  owner: RollOwner;
  eventKind: RollEvent['kind'];
  /** 展示名，例如“游荡者 攻击 哥布林” */
  label: string;
  /** 该次动画需要展示的骰子数量与面数 */
  count: number;
  sides: number;
  /** 已确定的结果（UI 点击/动画后展示） */
  values: number[];
  /** D3(D6) 等映射骰的最终映射值 */
  mappedValues?: number[];
  total: number;
}

export interface DiceSequence {
  /** 需要玩家点击掷骰的步骤 */
  player: DiceRollStep[];
  /** 自动动画步骤 */
  auto: DiceRollStep[];
}

function diceSides(part: DicePart): number {
  const upper = part.label.toUpperCase();
  const mappedMatch = /\(D(\d+)\)/.exec(upper);
  if (mappedMatch) return Number(mappedMatch[1]);
  const match = /D(\d+)/.exec(upper);
  return match ? Number(match[1]) : 6;
}

function dedupeKey(step: DiceRollStep): string {
  return [
    step.owner,
    step.eventKind,
    step.label,
    step.count,
    step.sides,
    step.values.join(','),
    step.mappedValues?.join(',') ?? '',
  ].join('|');
}

/**
 * 从结算事件中提取掷骰步骤。
 * 玩家归属 → player 队列；其余 → auto 队列。
 * AOE 等同一骰重复出现在多目标事件中的情况会自动去重。
 */
export function extractDiceSequence(events: RollEvent[]): DiceSequence {
  const player: DiceRollStep[] = [];
  const auto: DiceRollStep[] = [];
  const seen = new Set<string>();
  let seq = 0;

  for (const event of events) {
    for (const part of event.parts ?? []) {
      if (part.kind !== 'dice' || !part.values || part.values.length === 0) continue;
      const step: DiceRollStep = {
        id: `${event.unitId}-${event.kind}-${seq}`,
        owner: part.owner ?? event.owner ?? 'auto',
        eventKind: event.kind,
        label: event.label,
        count: part.values.length,
        sides: diceSides(part),
        values: [...part.values],
        mappedValues: part.mappedValues ? [...part.mappedValues] : undefined,
        total: part.value,
      };
      seq += 1;
      const key = dedupeKey(step);
      if (seen.has(key)) continue;
      seen.add(key);
      if (step.owner === 'player') player.push(step);
      else auto.push(step);
    }
  }

  return { player, auto };
}

/**
 * UI 消费队列。`takeNext()` 返回下一步；auto 步骤可由 UI 快速播放。
 */
export class DiceStepQueue {
  readonly playerSteps: DiceRollStep[];
  readonly autoSteps: DiceRollStep[];
  private playerIndex = 0;
  private autoIndex = 0;

  constructor(sequence: DiceSequence) {
    this.playerSteps = [...sequence.player];
    this.autoSteps = [...sequence.auto];
  }

  get pendingPlayerCount(): number {
    return this.playerSteps.length - this.playerIndex;
  }

  get pendingAutoCount(): number {
    return this.autoSteps.length - this.autoIndex;
  }

  get done(): boolean {
    return this.pendingPlayerCount === 0 && this.pendingAutoCount === 0;
  }

  peekPlayer(): DiceRollStep | null {
    return this.playerSteps[this.playerIndex] ?? null;
  }

  takeNextPlayer(): DiceRollStep | null {
    const step = this.peekPlayer();
    if (step) this.playerIndex += 1;
    return step;
  }

  peekAuto(): DiceRollStep | null {
    return this.autoSteps[this.autoIndex] ?? null;
  }

  takeNextAuto(): DiceRollStep | null {
    const step = this.peekAuto();
    if (step) this.autoIndex += 1;
    return step;
  }
}
