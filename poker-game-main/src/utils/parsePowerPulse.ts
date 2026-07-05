import type { GameState } from '@/types/game'
import { findCardOnFieldByName, findFieldSlotForCard } from '@/utils/fieldSlot'

export interface PowerPulseHint {
  fieldOwnerId: string
  slotIndex: number
  delta: number
}

/** 从效果文案解析场上战力变化，用于数字脉冲动画 */
export function parsePowerPulsesFromSegment(segment: string, game: GameState): PowerPulseHint[] {
  const s = segment.trim()
  if (!s) return []

  const arrow = s.match(/(.+?) 战力(\d+)→(\d+)/)
  if (arrow) {
    const card = findCardOnFieldByName(game, arrow[1].trim())
    if (card) {
      const loc = findFieldSlotForCard(game, card)
      if (loc) {
        const delta = Number(arrow[3]) - Number(arrow[2])
        if (delta !== 0) return [{ ...loc, delta }]
      }
    }
  }

  const named = s.match(/(.+?) 战力([+-]\d+)/)
  if (named) {
    const card = findCardOnFieldByName(game, named[1].trim())
    if (card) {
      const loc = findFieldSlotForCard(game, card)
      if (loc) return [{ ...loc, delta: Number(named[2]) }]
    }
  }

  return []
}

export function parsePowerPulsesFromMessage(message: string, game: GameState): PowerPulseHint[] {
  const seen = new Set<string>()
  const out: PowerPulseHint[] = []
  for (const part of message.split('|').map(p => p.trim())) {
    for (const hint of parsePowerPulsesFromSegment(part, game)) {
      const key = `${hint.fieldOwnerId}-${hint.slotIndex}-${hint.delta}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(hint)
      }
    }
  }
  return out.slice(0, 6)
}
