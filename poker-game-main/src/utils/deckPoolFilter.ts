import type { AttributeType, Card, CardType } from '@/types/game'

export type DeckMembershipFilter = 'all' | 'notInDeck' | 'inDeck'

export type PoolSortKey =
  | 'nameAsc'
  | 'costAsc'
  | 'costDesc'
  | 'powerAsc'
  | 'powerDesc'

export interface DeckPoolFilterCriteria {
  selectedTypes: CardType[]
  selectedAttributes: AttributeType[]
  /** All selected keywords must appear on the card (AND). */
  selectedKeywords: string[]
  searchQuery: string
  deckMembership: DeckMembershipFilter
  sortKey: PoolSortKey
}

export const ALL_ATTRIBUTES: AttributeType[] = [
  '无', '土', '钢', '木', '火', '风', '水', '奥术',
]

export const ALL_CARD_TYPES: CardType[] = ['unit', 'environment', 'tactic']

export const DEFAULT_POOL_FILTER: DeckPoolFilterCriteria = {
  selectedTypes: [],
  selectedAttributes: [],
  selectedKeywords: [],
  searchQuery: '',
  deckMembership: 'all',
  sortKey: 'nameAsc',
}

const FILTER_STORAGE_KEY = 'deck-builder-pool-filter-v1'

export function buildCardSearchText(card: Card): string {
  const effectText = card.effects.map(e => e.description).join(' ')
  return [
    card.name,
    card.attribute,
    ...card.keywords,
    effectText,
  ].join(' ').toLowerCase()
}

export function cardMatchesPoolFilter(
  card: Card,
  criteria: DeckPoolFilterCriteria,
  deckCardIds: Set<string>,
): boolean {
  if (criteria.selectedTypes.length > 0 && !criteria.selectedTypes.includes(card.type)) {
    return false
  }

  if (criteria.selectedAttributes.length > 0 && !criteria.selectedAttributes.includes(card.attribute)) {
    return false
  }

  if (criteria.selectedKeywords.length > 0) {
    const kwSet = new Set(card.keywords)
    if (!criteria.selectedKeywords.every(kw => kwSet.has(kw))) {
      return false
    }
  }

  const q = criteria.searchQuery.trim().toLowerCase()
  if (q && !buildCardSearchText(card).includes(q)) {
    return false
  }

  if (criteria.deckMembership === 'inDeck' && !deckCardIds.has(card.id)) {
    return false
  }
  if (criteria.deckMembership === 'notInDeck' && deckCardIds.has(card.id)) {
    return false
  }

  return true
}

function compareName(a: Card, b: Card): number {
  return a.name.localeCompare(b.name, 'zh-CN')
}

function isZeroPower(card: Card): boolean {
  return card.basePower === 0
}

export function sortPoolCards(cards: Card[], sortKey: PoolSortKey): Card[] {
  const sorted = cards.slice()

  switch (sortKey) {
    case 'nameAsc':
      sorted.sort(compareName)
      break
    case 'costAsc':
      sorted.sort((a, b) => a.cost - b.cost || compareName(a, b))
      break
    case 'costDesc':
      sorted.sort((a, b) => b.cost - a.cost || compareName(a, b))
      break
    case 'powerAsc':
      sorted.sort((a, b) => {
        const aZero = isZeroPower(a)
        const bZero = isZeroPower(b)
        if (aZero !== bZero) return aZero ? 1 : -1
        if (a.basePower !== b.basePower) return a.basePower - b.basePower
        if (a.cost !== b.cost) return a.cost - b.cost
        return compareName(a, b)
      })
      break
    case 'powerDesc':
      sorted.sort((a, b) => {
        const aZero = isZeroPower(a)
        const bZero = isZeroPower(b)
        if (aZero !== bZero) return aZero ? 1 : -1
        if (a.basePower !== b.basePower) return b.basePower - a.basePower
        if (a.cost !== b.cost) return a.cost - b.cost
        return compareName(a, b)
      })
      break
  }

  return sorted
}

export function filterAndSortPoolCards(
  cards: Card[],
  criteria: DeckPoolFilterCriteria,
  deckCardIds: string[],
): Card[] {
  const deckSet = new Set(deckCardIds)
  const filtered = cards.filter(card => cardMatchesPoolFilter(card, criteria, deckSet))
  return sortPoolCards(filtered, criteria.sortKey)
}

export function countActiveFilters(criteria: DeckPoolFilterCriteria): number {
  let n = 0
  if (criteria.selectedTypes.length) n += criteria.selectedTypes.length
  if (criteria.selectedAttributes.length) n += criteria.selectedAttributes.length
  if (criteria.selectedKeywords.length) n += criteria.selectedKeywords.length
  if (criteria.searchQuery.trim()) n += 1
  if (criteria.deckMembership !== 'all') n += 1
  if (criteria.sortKey !== 'nameAsc') n += 1
  return n
}

export function hasStructuredFilters(criteria: DeckPoolFilterCriteria): boolean {
  return criteria.selectedTypes.length > 0
    || criteria.selectedAttributes.length > 0
    || criteria.selectedKeywords.length > 0
    || criteria.deckMembership !== 'all'
}

export interface PoolFilterMeta {
  totalCards: number
  keywords: { label: string; count: number }[]
  typeCounts: Record<CardType, number>
  attributeCounts: Record<AttributeType, number>
}

export function buildPoolFilterMeta(cards: Card[]): PoolFilterMeta {
  const keywordFreq = new Map<string, number>()
  const typeCounts: Record<CardType, number> = { unit: 0, environment: 0, tactic: 0 }
  const attributeCounts = Object.fromEntries(
    ALL_ATTRIBUTES.map(a => [a, 0]),
  ) as Record<AttributeType, number>

  for (const card of cards) {
    typeCounts[card.type] += 1
    attributeCounts[card.attribute] += 1
    for (const kw of card.keywords) {
      keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1)
    }
  }

  const keywords = [...keywordFreq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .map(([label, count]) => ({ label, count }))

  return {
    totalCards: cards.length,
    keywords,
    typeCounts,
    attributeCounts,
  }
}

export interface PersistedPoolFilterUi {
  criteria: DeckPoolFilterCriteria
  sidebarOpen: boolean
}

export function loadPersistedPoolFilter(): PersistedPoolFilterUi | null {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedPoolFilterUi
    if (!parsed?.criteria) return null
    return {
      criteria: { ...DEFAULT_POOL_FILTER, ...parsed.criteria },
      sidebarOpen: parsed.sidebarOpen ?? false,
    }
  } catch {
    return null
  }
}

export function savePersistedPoolFilter(state: PersistedPoolFilterUi): void {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}
