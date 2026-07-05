<script setup lang="ts">
import type { AttributeType, CardType } from '@/types/game'
import { getCardTypeLabel } from '@/utils/cardDisplay'
import type { DeckMembershipFilter, PoolSortKey } from '@/utils/deckPoolFilter'
import { ALL_ATTRIBUTES, ALL_CARD_TYPES } from '@/utils/deckPoolFilter'

defineProps<{
  open: boolean
  pinned: boolean
  matchCount: number
  totalCount: number
  selectedTypes: CardType[]
  selectedAttributes: AttributeType[]
  selectedKeywords: string[]
  deckMembership: DeckMembershipFilter
  sortKey: PoolSortKey
  typeCounts: Record<CardType, number>
  attributeCounts: Record<AttributeType, number>
  filteredKeywords: { label: string; count: number }[]
  keywordSearch: string
}>()

const emit = defineEmits<{
  toggleOpen: []
  togglePin: []
  toggleType: [type: CardType]
  toggleAttribute: [attr: AttributeType]
  toggleKeyword: [kw: string]
  setDeckMembership: [v: DeckMembershipFilter]
  setSortKey: [v: PoolSortKey]
  clearFilters: []
  'update:keywordSearch': [v: string]
  removeType: [type: CardType]
  removeAttribute: [attr: AttributeType]
  removeKeyword: [kw: string]
}>()

const sortOptions: { value: PoolSortKey; label: string }[] = [
  { value: 'nameAsc', label: '名称 A→Z' },
  { value: 'costAsc', label: '费用 低→高' },
  { value: 'costDesc', label: '费用 高→低' },
  { value: 'powerAsc', label: '战力 低→高' },
  { value: 'powerDesc', label: '战力 高→低' },
]

const membershipOptions: { value: DeckMembershipFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'notInDeck', label: '未加入' },
  { value: 'inDeck', label: '已在卡组' },
]
</script>

<template>
  <aside
    class="filter-sidebar"
    :class="{
      'filter-sidebar--open': open,
      'filter-sidebar--collapsed': !open,
      'filter-sidebar--pinned': pinned,
    }"
  >
    <div v-if="!open" class="filter-collapsed-bar">
      <button type="button" class="filter-expand-btn" title="展开筛选" @click="emit('toggleOpen')">
        <span class="filter-expand-icon">筛选</span>
        <span v-if="matchCount !== totalCount || selectedKeywords.length || selectedTypes.length || selectedAttributes.length || deckMembership !== 'all'" class="filter-badge">
          {{ matchCount }}
        </span>
      </button>
      <button
        type="button"
        class="filter-pin-mini"
        :class="{ active: pinned }"
        title="钉住侧栏"
        @click="emit('togglePin')"
      >
        📌
      </button>
    </div>

    <div v-else class="filter-panel">
      <header class="filter-header">
        <div class="filter-title-row">
          <h4>卡池筛选</h4>
          <span class="filter-match">{{ matchCount }} / {{ totalCount }}</span>
        </div>
        <div class="filter-header-actions">
          <button
            type="button"
            class="filter-icon-btn"
            :class="{ active: pinned }"
            :title="pinned ? '取消钉住' : '钉住侧栏'"
            @click="emit('togglePin')"
          >
            📌
          </button>
          <button type="button" class="filter-icon-btn" title="收起侧栏" @click="emit('toggleOpen')">
            ›
          </button>
        </div>
      </header>

      <div v-if="selectedTypes.length || selectedAttributes.length || selectedKeywords.length || deckMembership !== 'all'" class="filter-active-chips">
        <button
          v-for="t in selectedTypes"
          :key="'t-' + t"
          type="button"
          class="active-chip"
          @click="emit('removeType', t)"
        >
          {{ getCardTypeLabel(t) }} ×
        </button>
        <button
          v-for="a in selectedAttributes"
          :key="'a-' + a"
          type="button"
          class="active-chip"
          @click="emit('removeAttribute', a)"
        >
          {{ a }} ×
        </button>
        <button
          v-for="kw in selectedKeywords"
          :key="'k-' + kw"
          type="button"
          class="active-chip active-chip--kw"
          @click="emit('removeKeyword', kw)"
        >
          {{ kw }} ×
        </button>
        <button
          v-if="deckMembership !== 'all'"
          type="button"
          class="active-chip"
          @click="emit('setDeckMembership', 'all')"
        >
          {{ deckMembership === 'notInDeck' ? '未加入' : '已在卡组' }} ×
        </button>
        <button type="button" class="active-chip clear-chip" @click="emit('clearFilters')">清空</button>
      </div>

      <div class="filter-body">
        <section class="filter-section">
          <div class="filter-section-head">
            <span class="filter-label">类别</span>
            <span class="filter-hint">满足其一</span>
          </div>
          <div class="filter-chips">
            <button
              v-for="type in ALL_CARD_TYPES"
              :key="type"
              type="button"
              class="filter-chip"
              :class="{ active: selectedTypes.includes(type) }"
              @click="emit('toggleType', type)"
            >
              {{ getCardTypeLabel(type) }}
              <span class="chip-count">{{ typeCounts[type] }}</span>
            </button>
          </div>
        </section>

        <section class="filter-section">
          <div class="filter-section-head">
            <span class="filter-label">属性</span>
            <span class="filter-hint">满足其一</span>
          </div>
          <div class="filter-chips">
            <button
              v-for="attr in ALL_ATTRIBUTES"
              :key="attr"
              type="button"
              class="filter-chip"
              :class="{ active: selectedAttributes.includes(attr) }"
              @click="emit('toggleAttribute', attr)"
            >
              {{ attr }}
              <span class="chip-count">{{ attributeCounts[attr] }}</span>
            </button>
          </div>
        </section>

        <section class="filter-section">
          <div class="filter-section-head">
            <span class="filter-label">关键词</span>
            <span class="filter-hint">需全部包含</span>
          </div>
          <input
            :value="keywordSearch"
            type="search"
            class="filter-kw-search"
            placeholder="搜索关键词…"
            @input="emit('update:keywordSearch', ($event.target as HTMLInputElement).value)"
          >
          <div class="filter-chips filter-chips--scroll">
            <button
              v-for="item in filteredKeywords"
              :key="item.label"
              type="button"
              class="filter-chip filter-chip--kw"
              :class="{ active: selectedKeywords.includes(item.label) }"
              @click="emit('toggleKeyword', item.label)"
            >
              {{ item.label }}
              <span class="chip-count">{{ item.count }}</span>
            </button>
            <p v-if="filteredKeywords.length === 0" class="filter-empty">无匹配关键词</p>
          </div>
        </section>

        <section class="filter-section">
          <span class="filter-label">卡组状态</span>
          <div class="filter-chips">
            <button
              v-for="opt in membershipOptions"
              :key="opt.value"
              type="button"
              class="filter-chip"
              :class="{ active: deckMembership === opt.value }"
              @click="emit('setDeckMembership', opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </section>

        <section class="filter-section">
          <span class="filter-label">排序</span>
          <select
            class="filter-sort"
            :value="sortKey"
            @change="emit('setSortKey', ($event.target as HTMLSelectElement).value as PoolSortKey)"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <p class="filter-sort-note">零战力卡牌（战术等）排序时沉底</p>
        </section>
      </div>

      <p v-if="matchCount === 0" class="filter-zero">
        无匹配卡牌，请放宽筛选条件
      </p>
    </div>
  </aside>
</template>

<style scoped>
.filter-sidebar {
  flex-shrink: 0;
  transition: width 0.25s ease;
  align-self: stretch;
}

.filter-sidebar--open {
  width: 280px;
}

.filter-sidebar--collapsed {
  width: 44px;
}

.filter-sidebar--pinned.filter-sidebar--open {
  position: relative;
}

.filter-sidebar:not(.filter-sidebar--pinned).filter-sidebar--open {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  box-shadow: -4px 0 20px rgba(31, 37, 34, 0.12);
}

.filter-collapsed-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 10px 4px;
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-radius: 12px;
}

.filter-expand-btn {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #a46d1f;
  font-weight: 700;
  font-size: 13px;
  position: relative;
}

.filter-expand-icon {
  letter-spacing: 2px;
}

.filter-badge {
  position: absolute;
  top: 4px;
  right: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #a46d1f;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: horizontal-tb;
}

.filter-pin-mini {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.45;
  padding: 4px;
}

.filter-pin-mini.active {
  opacity: 1;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 720px;
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-radius: 12px;
  overflow: hidden;
}

.filter-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 12px 8px;
  border-bottom: 1px solid #e8e4da;
  flex-shrink: 0;
}

.filter-title-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.filter-header h4 {
  margin: 0;
  font-size: 15px;
  color: #1f2522;
}

.filter-match {
  font-size: 12px;
  color: #69706b;
}

.filter-header-actions {
  display: flex;
  gap: 4px;
}

.filter-icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #d8d2c4;
  border-radius: 6px;
  background: #f6f4ef;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: #69706b;
}

.filter-icon-btn.active {
  border-color: #a46d1f;
  background: rgba(164, 109, 31, 0.12);
}

.filter-active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #e8e4da;
  flex-shrink: 0;
}

.active-chip {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid #a46d1f;
  background: rgba(164, 109, 31, 0.1);
  color: #7a5218;
  font-size: 11px;
  cursor: pointer;
}

.active-chip--kw {
  border-color: #2f6f5e;
  background: rgba(47, 111, 94, 0.1);
  color: #2f6f5e;
}

.clear-chip {
  border-color: #d8d2c4;
  background: #f6f4ef;
  color: #69706b;
}

.filter-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 12px;
  -webkit-overflow-scrolling: touch;
}

.filter-section {
  margin-bottom: 14px;
}

.filter-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.filter-label {
  font-size: 12px;
  font-weight: 700;
  color: #1f2522;
}

.filter-hint {
  font-size: 10px;
  color: #888;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chips--scroll {
  max-height: 160px;
  overflow-y: auto;
  padding-right: 2px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid #d8d2c4;
  background: #f6f4ef;
  color: #1f2522;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.filter-chip:hover {
  border-color: #a46d1f;
}

.filter-chip.active {
  border-color: #a46d1f;
  background: rgba(164, 109, 31, 0.15);
  font-weight: 600;
}

.filter-chip--kw.active {
  border-color: #2f6f5e;
  background: rgba(47, 111, 94, 0.12);
}

.chip-count {
  font-size: 10px;
  color: #888;
  font-weight: 400;
}

.filter-kw-search {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 10px;
  margin-bottom: 8px;
  border: 1px solid #d8d2c4;
  border-radius: 6px;
  font-size: 12px;
}

.filter-sort {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #d8d2c4;
  border-radius: 6px;
  font-size: 12px;
  background: #fff;
}

.filter-sort-note {
  margin: 6px 0 0;
  font-size: 10px;
  color: #888;
}

.filter-empty {
  margin: 0;
  font-size: 11px;
  color: #888;
}

.filter-zero {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: #9d2f2f;
  background: #fdf5f5;
  border-top: 1px solid #e0b4b4;
  flex-shrink: 0;
}
</style>
