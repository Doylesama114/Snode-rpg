/**
 * 回合阶段处理：状态卡 onTurnStart 触发、瞄准行动检定等。
 * 规则依据：help.html 异常状态规则、P2 裁决 A1/B3。
 */
import type { StatusCardData } from './cards';
import type { RollEvent } from './resolver';
import type { Encounter } from './encounter';
import { evaluateExpression } from './expression';
import type { UnitInstance } from './unit';
import type { DiceEval } from './types';

export function ownerFor(unit: UnitInstance): 'player' | 'auto' {
  return unit.team === 'player' ? 'player' : 'auto';
}

function variablesFor(unit: UnitInstance, status: string): Record<string, number> {
  return {
    layers: unit.conditionLayersOf(status),
    strMod: unit.attrMod('力量'),
    dexMod: unit.attrMod('敏捷'),
    conMod: unit.attrMod('体质'),
    intMod: unit.attrMod('智力'),
    wisMod: unit.attrMod('感知'),
    chaMod: unit.attrMod('魅力'),
    willMod: unit.attrMod('意志'),
    luckMod: unit.attrMod('幸运'),
    hp: unit.hp,
    hpMax: unit.hpMax,
    fp: unit.fp,
    fpMax: unit.fpMax,
  };
}

function emit(events: RollEvent[], unit: UnitInstance, event: Omit<RollEvent, 'owner' | 'unitId'> & { unitId?: string }): void {
  events.push({ owner: ownerFor(unit), unitId: event.unitId ?? unit.id, ...event });
}

/** 状态卡在目标自身回合开始时触发（灼烧/中毒/流血）。返回事件用于骰子动画。 */
export function processTurnStartStatuses(
  unit: UnitInstance,
  encounter: Encounter,
  statusCatalog: Map<string, StatusCardData>,
  rng: { next(): number; die(sides: number): number },
): RollEvent[] {
  const events: RollEvent[] = [];
  for (const [statusId, layers] of [...unit.conditionLayers]) {
    if (layers <= 0) continue;
    const card = statusCatalog.get(statusId);
    if (!card) continue;
    for (const trigger of card.triggers ?? []) {
      if (trigger.event !== 'onTurnStart') continue;
      for (const raw of trigger.effects ?? []) {
        const step = raw as Record<string, unknown>;
        const op = step.op;
        if (op === 'damage') {
          const dice = String(step.dice ?? '0').replaceAll('@layers', String(layers));
          const type = String(step.type ?? '物理');
          const evalResult = evaluateExpression(dice, {
            rng,
            variables: variablesFor(unit, statusId),
            owner: ownerFor(unit),
          });
          const vulnerability = unit.vulnerabilities.get(type) ?? 0;
          const resistance = unit.resistances.get(type) ?? 0;
          const amount = Math.max(0, Math.floor(evalResult.total + vulnerability - resistance));
          if (amount > 0) unit.applyDamage(amount);
          emit(events, unit, {
            label: `${unit.name} 回合开始：${card.name}伤害`,
            kind: 'damage',
            targetId: unit.id,
            expression: dice,
            parts: evalResult.parts,
            total: amount,
            detail: `${card.name} ${layers}层：${dice}=${evalResult.total}${vulnerability ? `+${vulnerability}` : ''}${resistance ? `-${resistance}` : ''} → ${amount} → HP ${unit.hp}/${unit.hpMax}`,
          });
        } else if (op === 'loseHp') {
          const amountExpr = String(step.amount ?? '0').replaceAll('@layers', String(layers));
          const evalResult = evaluateExpression(amountExpr, {
            rng,
            variables: variablesFor(unit, statusId),
            owner: ownerFor(unit),
          });
          const amount = Math.max(0, Math.floor(evalResult.total));
          if (amount > 0) unit.loseHp(amount);
          emit(events, unit, {
            label: `${unit.name} 回合开始：${card.name}失血`,
            kind: 'loseHp',
            targetId: unit.id,
            expression: amountExpr,
            parts: evalResult.parts,
            total: amount,
            detail: `${card.name} ${layers}层：直接失血 ${amount} → HP ${unit.hp}/${unit.hpMax}`,
          });
        } else if (op === 'statusLayers') {
          const rawName = String(step.name ?? statusId);
          const matched = [...statusCatalog.values()].find((c) => c.id === rawName || c.name === rawName);
          const statusIdToAdd = matched?.id ?? rawName;
          const amountExpr = String(step.amount ?? '0').replaceAll('@layers', String(layers));
          const evalResult = evaluateExpression(amountExpr, {
            rng,
            variables: variablesFor(unit, statusId),
            owner: ownerFor(unit),
          });
          const amount = Math.max(0, Math.floor(evalResult.total));
          if (amount > 0) {
            const statusCard = statusCatalog.get(statusIdToAdd);
            unit.addCondition(statusIdToAdd, amount, statusCard?.maxLayers ?? 99);
          }
          emit(events, unit, {
            label: `${unit.name} 回合开始：${card.name}层数追加`,
            kind: 'status',
            targetId: unit.id,
            expression: amountExpr,
            parts: evalResult.parts,
            total: amount,
            detail: `${matched?.name ?? statusIdToAdd} +${amount} 层 → ${unit.conditionLayersOf(statusIdToAdd)} 层`,
          });
        }
      }
    }
  }
  void encounter;
  return events;
}

/** 瞄准行动：附赠动作 + 专注熟练项检定 D12(+D8)+体质调整 >15。 */
export function performAimCheck(unit: UnitInstance, rng: { die(sides: number): number }): {
  ok: boolean;
  events: RollEvent[];
  total: number;
  d12: number;
  d8: number | null;
} {
  if (!unit.canUseAction('bonus')) return { ok: false, events: [], total: 0, d12: 0, d8: null };
  const hasProf = unit.hasSkillProf('专注');
  const d12 = rng.die(12);
  const d8 = hasProf ? rng.die(8) : null;
  const total = d12 + (d8 ?? 0) + unit.attrMod('体质');
  unit.useAction('bonus');
  const events: RollEvent[] = [{
    owner: ownerFor(unit),
    label: `${unit.name} 瞄准行动（专注检定）`,
    kind: 'save',
    unitId: unit.id,
    targetId: unit.id,
    expression: `D12${d8 !== null ? ' + D8' : ''} + ${unit.attrMod('体质')}`,
    parts: [
      { kind: 'dice', label: '1D12', values: [d12], value: d12, owner: ownerFor(unit) },
      ...(d8 !== null ? [{ kind: 'dice' as const, label: '1D8', values: [d8], value: d8, owner: ownerFor(unit) }] : []),
      { kind: 'flat', label: '体质调整', value: unit.attrMod('体质'), owner: ownerFor(unit) },
    ],
    total,
    detail: `D12${d8 !== null ? '+D8' : ''}+体质 = ${total} > 15 ${total > 15 ? '成功' : '失败'}`,
  }];
  return { ok: total > 15, events, total, d12, d8 };
}

export type PhaseEvent = RollEvent;
