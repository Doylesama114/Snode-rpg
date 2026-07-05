import type { AccountState, SavedDeckSlot } from '@/types/game'
import { getDefaultDeckCardIds } from '@/data/cardDatabase'

export const MAX_DECK_SLOTS = 10

const STORAGE_KEY = 'accountState'

export function readAccountState(): AccountState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return migrateAccountState(JSON.parse(raw) as AccountState)
  } catch {
    return null
  }
}

export function writeAccountState(account: AccountState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
}

function newSlotId() {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createDefaultSlot(name: string, cardIds?: string[]): SavedDeckSlot {
  return {
    id: newSlotId(),
    name,
    cardIds: [...(cardIds?.length === 15 ? cardIds : getDefaultDeckCardIds())],
    updatedAt: new Date().toISOString(),
  }
}

/** 兼容旧版仅 deckCardIds 的账户数据 */
export function migrateAccountState(account: AccountState): AccountState {
  const cardIds = account.deckCardIds?.length === 15
    ? [...account.deckCardIds]
    : getDefaultDeckCardIds()

  if (!account.savedDecks?.length) {
    const first = createDefaultSlot('默认卡组', cardIds)
    account.savedDecks = [first]
    account.activeDeckSlotId = first.id
  }

  if (!account.activeDeckSlotId || !account.savedDecks.some(s => s.id === account.activeDeckSlotId)) {
    account.activeDeckSlotId = account.savedDecks[0].id
  }

  syncActiveDeckToAccount(account)
  return account
}

export function getActiveDeckSlot(account: AccountState): SavedDeckSlot | undefined {
  return account.savedDecks?.find(s => s.id === account.activeDeckSlotId)
}

/** 将 active 栏位的 cardIds 同步到 deckCardIds（供单机/联机读取） */
export function syncActiveDeckToAccount(account: AccountState) {
  const active = getActiveDeckSlot(account)
  if (active) {
    account.deckCardIds = [...active.cardIds]
  } else if (account.deckCardIds?.length !== 15) {
    account.deckCardIds = getDefaultDeckCardIds()
  }
}

export function updateActiveSlotCards(account: AccountState, cardIds: string[]) {
  const active = getActiveDeckSlot(account)
  if (!active) return account
  active.cardIds = [...cardIds]
  active.updatedAt = new Date().toISOString()
  account.deckCardIds = [...cardIds]
  return account
}

export function switchActiveDeckSlot(account: AccountState, slotId: string): AccountState {
  const target = account.savedDecks?.find(s => s.id === slotId)
  if (!target) return account
  account.activeDeckSlotId = slotId
  account.deckCardIds = [...target.cardIds]
  return account
}

export function addDeckSlot(account: AccountState, name: string, cardIds: string[]): SavedDeckSlot | null {
  if ((account.savedDecks?.length ?? 0) >= MAX_DECK_SLOTS) return null
  const slot = createDefaultSlot(name.trim() || `卡组 ${account.savedDecks.length + 1}`, cardIds)
  account.savedDecks = [...(account.savedDecks ?? []), slot]
  account.activeDeckSlotId = slot.id
  account.deckCardIds = [...slot.cardIds]
  return slot
}

export function renameDeckSlot(account: AccountState, slotId: string, name: string): boolean {
  const slot = account.savedDecks?.find(s => s.id === slotId)
  if (!slot) return false
  const trimmed = name.trim()
  if (!trimmed) return false
  slot.name = trimmed
  slot.updatedAt = new Date().toISOString()
  return true
}

export function deleteDeckSlot(account: AccountState, slotId: string): boolean {
  if (!account.savedDecks || account.savedDecks.length <= 1) return false
  const idx = account.savedDecks.findIndex(s => s.id === slotId)
  if (idx === -1) return false
  account.savedDecks = account.savedDecks.filter(s => s.id !== slotId)
  if (account.activeDeckSlotId === slotId) {
    account.activeDeckSlotId = account.savedDecks[0].id
    account.deckCardIds = [...account.savedDecks[0].cardIds]
  }
  return true
}

export function duplicateDeckSlot(account: AccountState, slotId: string, name?: string): SavedDeckSlot | null {
  const source = account.savedDecks?.find(s => s.id === slotId)
  if (!source) return null
  return addDeckSlot(account, name ?? `${source.name} 副本`, source.cardIds)
}
