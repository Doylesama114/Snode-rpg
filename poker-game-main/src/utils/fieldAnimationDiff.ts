import type { Card, GameState } from '@/types/game'

export interface FieldFlyEvent {
  type: 'fly'
  playerId: string
  fieldOwnerId: string
  slotIndex: number
  showBack: boolean
  card?: Card
  handIndex?: number
}

export interface FieldFlipEvent {
  type: 'flip'
  fieldOwnerId: string
  slotIndex: number
  card: Card
}

export type FieldAnimEvent = FieldFlyEvent | FieldFlipEvent

function isHiddenCard(card: Card | null | undefined): boolean {
  if (!card) return false
  return card.id === 'hidden' || card.name === '？？？'
}

/** 对比两次 gameState，提取需播放的飞牌/翻牌事件 */
export function diffFieldAnimations(
  prev: GameState | null | undefined,
  next: GameState,
  myPlayerId: string,
): FieldAnimEvent[] {
  if (!prev) return []
  const events: FieldAnimEvent[] = []

  for (const player of next.players) {
    const prevPlayer = prev.players.find(p => p.id === player.id)
    if (!prevPlayer) continue

    player.field.forEach((slot, si) => {
      const prevSlot = prevPlayer.field[si]
      const prevCard = prevSlot?.card as Card | null | undefined
      const nextCard = slot.card as Card | null | undefined

      if (!nextCard && prevCard) return

      if (nextCard && !prevCard) {
        const isOwn = player.id === myPlayerId
        const hidden = isHiddenCard(nextCard)
        events.push({
          type: 'fly',
          playerId: player.id,
          fieldOwnerId: player.id,
          slotIndex: si,
          showBack: !isOwn || hidden,
          card: hidden ? undefined : nextCard,
        })
        return
      }

      if (nextCard && prevCard && isHiddenCard(prevCard) && !isHiddenCard(nextCard)) {
        events.push({
          type: 'flip',
          fieldOwnerId: player.id,
          slotIndex: si,
          card: nextCard,
        })
      }
    })
  }

  return events
}

export function fieldAnimKey(ev: FieldAnimEvent): string {
  if (ev.type === 'flip') return `flip-${ev.fieldOwnerId}-${ev.slotIndex}`
  return `fly-${ev.fieldOwnerId}-${ev.slotIndex}`
}
