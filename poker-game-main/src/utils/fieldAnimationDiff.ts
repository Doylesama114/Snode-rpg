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

export interface DrawAnimEvent {
  type: 'draw'
  playerId: string
  handIndex: number
  showBack: boolean
  card?: Card
}

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

/** 手牌数量增加 → 抽牌飞入动画 */
export function diffDrawEvents(
  prev: GameState | null | undefined,
  next: GameState,
  myPlayerId: string,
): DrawAnimEvent[] {
  if (!prev) return []
  const events: DrawAnimEvent[] = []

  for (const player of next.players) {
    const prevPlayer = prev.players.find(p => p.id === player.id)
    if (!prevPlayer) continue

    const delta = player.hand.length - prevPlayer.hand.length
    if (delta <= 0) continue

    const isOwn = player.id === myPlayerId
    for (let i = 0; i < delta; i++) {
      const hi = prevPlayer.hand.length + i
      const raw = player.hand[hi]
      const card = isOwn && raw && typeof raw === 'object' ? (raw as Card) : undefined
      events.push({
        type: 'draw',
        playerId: player.id,
        handIndex: hi,
        showBack: !isOwn,
        card,
      })
    }
  }

  return events
}
