import { ref, computed, watch, type Ref } from 'vue'
import type { AttributeType, Card, CardType } from '@/types/game'
import {
  DEFAULT_POOL_FILTER,
  type DeckMembershipFilter,
  type DeckPoolFilterCriteria,
  type PoolSortKey,
  buildPoolFilterMeta,
  countActiveFilters,
  filterAndSortPoolCards,
  hasStructuredFilters,
  loadPersistedPoolFilter,
  savePersistedPoolFilter,
} from '@/utils/deckPoolFilter'

export function useDeckPoolFilter(allCards: Ref<Card[]>, deckCardIds: Ref<string[]>) {
  const persisted = loadPersistedPoolFilter()

  const criteria = ref<DeckPoolFilterCriteria>({
    ...DEFAULT_POOL_FILTER,
    ...(persisted?.criteria ?? {}),
  })
  const sidebarOpen = ref(persisted?.sidebarOpen ?? true)
  const keywordSearch = ref('')

  const meta = computed(() => buildPoolFilterMeta(allCards.value))

  const filteredPool = computed(() =>
    filterAndSortPoolCards(allCards.value, criteria.value, deckCardIds.value),
  )

  const activeFilterCount = computed(() => countActiveFilters(criteria.value))
  const hasActiveFilters = computed(() => activeFilterCount.value > 0)
  const hasStructuredFilterActive = computed(() => hasStructuredFilters(criteria.value))

  const filteredKeywords = computed(() => {
    const q = keywordSearch.value.trim().toLowerCase()
    if (!q) return meta.value.keywords
    return meta.value.keywords.filter(k => k.label.toLowerCase().includes(q))
  })

  watch(
    [criteria, sidebarOpen],
    () => {
      savePersistedPoolFilter({
        criteria: criteria.value,
        sidebarOpen: sidebarOpen.value,
      })
    },
    { deep: true },
  )

  function toggleType(type: CardType) {
    const set = new Set(criteria.value.selectedTypes)
    if (set.has(type)) set.delete(type)
    else set.add(type)
    criteria.value = { ...criteria.value, selectedTypes: [...set] }
  }

  function toggleAttribute(attr: AttributeType) {
    const set = new Set(criteria.value.selectedAttributes)
    if (set.has(attr)) set.delete(attr)
    else set.add(attr)
    criteria.value = { ...criteria.value, selectedAttributes: [...set] }
  }

  function toggleKeyword(kw: string) {
    const set = new Set(criteria.value.selectedKeywords)
    if (set.has(kw)) set.delete(kw)
    else set.add(kw)
    criteria.value = { ...criteria.value, selectedKeywords: [...set] }
  }

  function setSearchQuery(q: string) {
    criteria.value = { ...criteria.value, searchQuery: q }
  }

  function setDeckMembership(v: DeckMembershipFilter) {
    criteria.value = { ...criteria.value, deckMembership: v }
  }

  function setSortKey(v: PoolSortKey) {
    criteria.value = { ...criteria.value, sortKey: v }
  }

  function clearFilters() {
    criteria.value = {
      ...DEFAULT_POOL_FILTER,
      sortKey: criteria.value.sortKey,
    }
    keywordSearch.value = ''
  }

  function clearAllIncludingSort() {
    criteria.value = { ...DEFAULT_POOL_FILTER }
    keywordSearch.value = ''
  }

  function removeSelectedType(type: CardType) {
    criteria.value = {
      ...criteria.value,
      selectedTypes: criteria.value.selectedTypes.filter(t => t !== type),
    }
  }

  function removeSelectedAttribute(attr: AttributeType) {
    criteria.value = {
      ...criteria.value,
      selectedAttributes: criteria.value.selectedAttributes.filter(a => a !== attr),
    }
  }

  function removeSelectedKeyword(kw: string) {
    criteria.value = {
      ...criteria.value,
      selectedKeywords: criteria.value.selectedKeywords.filter(k => k !== kw),
    }
  }

  function setKeywordSearch(v: string) {
    keywordSearch.value = v
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  return {
    criteria,
    sidebarOpen,
    keywordSearch,
    meta,
    filteredPool,
    activeFilterCount,
    hasActiveFilters,
    hasStructuredFilterActive,
    filteredKeywords,
    toggleType,
    toggleAttribute,
    toggleKeyword,
    setSearchQuery,
    setDeckMembership,
    setSortKey,
    setKeywordSearch,
    clearFilters,
    clearAllIncludingSort,
    removeSelectedType,
    removeSelectedAttribute,
    removeSelectedKeyword,
    toggleSidebar,
  }
}
