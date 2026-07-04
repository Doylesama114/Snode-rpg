import type { Card, CardEffect, EffectTiming } from '@/types/game'

const TYPE_LABELS: Record<string, string> = {
  unit: '单位牌',
  environment: '环境牌',
  tactic: '战术牌',
}

const TIMING_LABELS: Record<EffectTiming, string> = {
  onPlay: '打出时',
  onDeploy: '部署时',
  onField: '在场时',
  onDestroy: '被摧毁时',
  onOtherPlay: '其他牌打出时',
  roundStart: '回合开始',
  roundEnd: '回合结束',
  onReveal: '揭示时',
  onGameEnd: '游戏结束时',
}

export function getCardTypeLabel(type: Card['type']): string {
  return TYPE_LABELS[type] || type
}

export function getEffectTimingLabel(timing: EffectTiming): string {
  return TIMING_LABELS[timing] || timing
}

export function formatCardEffects(effects: CardEffect[] | undefined): { timing: string; type: string; description: string }[] {
  if (!effects?.length) return [{ timing: '—', type: '—', description: '无效果' }]
  return effects.map(e => ({
    timing: getEffectTimingLabel(e.timing),
    type: e.type,
    description: e.description || '（无描述）',
  }))
}
