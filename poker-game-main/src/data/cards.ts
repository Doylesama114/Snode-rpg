import { CardDatabase, getDefaultDeckCardIds, createDeckFromCardIds, createDefaultDeck, shuffleDeck } from './cardDatabase'

// Re-export all from cardDatabase
export {
  CardDatabase,
  getDefaultDeckCardIds,
  createDeckFromCardIds,
  createDefaultDeck,
  shuffleDeck
}

// Backward-compatible initialize (delegates to CardDatabase.initialize)
export function initializeCardDatabase() {
  CardDatabase.initialize()
}

// Backward-compatible createDeck (alias for createDefaultDeck)
export function createDeck() {
  return createDefaultDeck()
}
