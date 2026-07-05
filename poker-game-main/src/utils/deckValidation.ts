import type { AccountState } from '@/types/game'
import { getActiveDeckSlot } from '@/utils/deckSlots'

export const DECK_SIZE = 15

export function validateDeckCardIds(cardIds: string[] | undefined | null): { valid: boolean; message: string; count: number } {
  const count = cardIds?.length ?? 0
  if (count === DECK_SIZE) {
    return { valid: true, message: '', count }
  }
  if (count < DECK_SIZE) {
    return { valid: false, message: `卡组仅有 ${count} 张，需要恰好 ${DECK_SIZE} 张才能保存或开始游戏`, count }
  }
  return { valid: false, message: `卡组有 ${count} 张，超过 ${DECK_SIZE} 张，请先移出多余卡牌`, count }
}

export function validateActiveDeck(account: AccountState | null): { valid: boolean; message: string; count: number } {
  if (!account) {
    return { valid: false, message: '账户数据无效', count: 0 }
  }
  const active = getActiveDeckSlot(account)
  const cardIds = active?.cardIds ?? account.deckCardIds
  return validateDeckCardIds(cardIds)
}

export function getPlayableDeckCardIds(account: AccountState | null): string[] {
  if (!account) return []
  const active = getActiveDeckSlot(account)
  const cardIds = active?.cardIds ?? account.deckCardIds
  const v = validateDeckCardIds(cardIds)
  return v.valid && cardIds ? [...cardIds] : []
}
