import type { Card, GameState } from '@/types/game'

export function findFieldSlotForCard(
  game: GameState,
  card: Card,
): { fieldOwnerId: string; slotIndex: number } | null {
  for (const p of game.players) {
    const idx = p.field.findIndex(s => s.card === card)
    if (idx !== -1) return { fieldOwnerId: p.id, slotIndex: idx }
  }
  return null
}

export function findCardOnFieldByName(game: GameState, name: string): Card | null {
  for (const p of game.players) {
    for (const slot of p.field) {
      if (slot.card?.name === name) return slot.card
    }
  }
  return null
}

export function slotAnimKey(fieldOwnerId: string, slotIndex: number) {
  return `${fieldOwnerId}-${slotIndex}`
}
