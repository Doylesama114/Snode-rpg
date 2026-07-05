import type { Card } from '@/types/game'

const ATTR_CLASS: Record<string, string> = {
  '火': 'attr-fire',
  '水': 'attr-water',
  '风': 'attr-wind',
  '土': 'attr-earth',
  '无': 'attr-none',
}

export function attributeClass(attr: string): string {
  return ATTR_CLASS[attr] ?? 'attr-none'
}

export function powerColor(card: { currentPower: number; basePower: number }): string {
  if (card.currentPower > card.basePower) return 'var(--game-human)'
  if (card.currentPower < card.basePower) return 'var(--game-danger)'
  return 'var(--game-text-on-card)'
}

export function cardTypeLabel(type: Card['type']): string {
  if (type === 'environment') return '环境'
  if (type === 'tactic') return '战术'
  return '单位'
}

export function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    draw: '抽牌',
    decision: '决策',
    action: '行动',
    selectSlot: '选槽位',
    selectTarget: '选目标',
    selectCrossPlayerSlot: '跨场部署',
    selectEffectBranch: '回合效果',
    gameOver: '结束',
  }
  return map[phase] ?? phase
}
