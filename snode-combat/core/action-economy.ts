import type { ActionType } from './types';
import type { UnitInstance } from './unit';

export const DEFAULT_REACTION_MAX_PER_BATTLE = 3;

/** 回合开始：主要/附赠动作恢复（额外主要动作只在授予回合内有效）。 */
export function beginTurn(unit: UnitInstance): void {
  unit.resetTurnActions();
}

/** 回合结束：清空本回合动作。 */
export function endTurn(unit: UnitInstance): void {
  unit.actions.main = false;
  unit.actions.bonus = false;
}

export function canUseAction(unit: UnitInstance, action: 'main' | 'bonus' | 'reaction'): boolean {
  return unit.canUseAction(action);
}

export function useAction(unit: UnitInstance, action: 'main' | 'bonus' | 'reaction'): boolean {
  return unit.useAction(action);
}

/** 将 1动作/0动作/附赠动作文本映射为 ActionType。 */
export function mapActionText(text: string): ActionType {
  const t = text.trim();
  if (t === 'main' || t === '1动作' || t === '主要动作') return 'main';
  if (t === 'bonus' || t === '0动作' || t === '附赠动作') return 'bonus';
  if (t === 'reaction' || t === '反应动作') return 'reaction';
  if (t === 'none' || t === 'free' || t === '立即' || t === '-') return 'none';
  if (t === '2动作') return 'main'; // v1 暂不实现跨回合双动作
  return 'none';
}
