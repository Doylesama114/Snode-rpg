<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { AccountState, Card, SavedDeckSlot } from '@/types/game'
import { CardDatabase, getDefaultDeckCardIds } from '@/data/cardDatabase'

CardDatabase.initialize()
import CardDetailPopover from '@/components/CardDetailPopover.vue'
import DeckPoolFilterSidebar from '@/components/deck/DeckPoolFilterSidebar.vue'
import { useDeckPoolFilter } from '@/composables/useDeckPoolFilter'
import { getCardTypeLabel, formatCardEffects } from '@/utils/cardDisplay'
import { registerEscHandler } from '@/utils/escNavigation'
import {
  readAccountState,
  writeAccountState,
  migrateAccountState,
  updateActiveSlotCards,
  switchActiveDeckSlot,
  addDeckSlot,
  renameDeckSlot,
  deleteDeckSlot,
  MAX_DECK_SLOTS,
  getActiveDeckSlot,
} from '@/utils/deckSlots'
import { DECK_SIZE, validateDeckCardIds } from '@/utils/deckValidation'
import { playCardSound } from '@/utils/sound'

const router = useRouter()
const account = ref<AccountState | null>(null)
const deckCardIds = ref<string[]>([])
const message = ref('')
const detailCard = ref<Card | null>(null)
const newSlotName = ref('')
const renameSlotName = ref('')
const showNewSlotInput = ref(false)
const showRenameInput = ref(false)
const deckGridRef = ref<HTMLElement | null>(null)
const poolPanelRef = ref<HTMLElement | null>(null)
const leavingKeys = ref(new Set<string>())

interface FlyGhost {
  id: number
  label: string
  x: number
  y: number
  tx: number
  ty: number
  active: boolean
}

const flyGhosts = ref<FlyGhost[]>([])
let flySeq = 0

const savedDecks = computed(() => account.value?.savedDecks ?? [])
const activeSlotId = computed(() => account.value?.activeDeckSlotId ?? null)
const activeSlot = computed(() => savedDecks.value.find(s => s.id === activeSlotId.value))
const canAddSlot = computed(() => savedDecks.value.length < MAX_DECK_SLOTS)
const canDeleteSlot = computed(() => savedDecks.value.length > 1)
const deckValidation = computed(() => validateDeckCardIds(deckCardIds.value))
const canSaveDeck = computed(() => deckValidation.value.valid)

const allCards = computed(() => {
  return CardDatabase.getAllCards().slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})

const poolFilter = useDeckPoolFilter(allCards, deckCardIds)
const {
  criteria: poolCriteria,
  sidebarOpen: filterSidebarOpen,
  keywordSearch: filterKeywordSearch,
  meta: poolMeta,
  filteredPool,
  hasStructuredFilterActive,
  filteredKeywords,
  toggleType: toggleFilterType,
  toggleAttribute: toggleFilterAttribute,
  toggleKeyword: toggleFilterKeyword,
  setSearchQuery: setPoolSearchQuery,
  setDeckMembership: setPoolDeckMembership,
  setSortKey: setPoolSortKey,
  setKeywordSearch: setPoolKeywordSearch,
  clearFilters: clearPoolFilters,
  removeSelectedType,
  removeSelectedAttribute,
  removeSelectedKeyword,
  toggleSidebar: toggleFilterSidebar,
} = poolFilter

const deckCards = computed(() =>
  deckCardIds.value.map(id => CardDatabase.getCard(id)).filter((c): c is Card => !!c),
)

function effectPreview(card: Card): string {
  const fx = formatCardEffects(card.effects)
  return fx[0]?.description || '无效果'
}

function deckSlotKey(cardId: string, idx: number) {
  return `${cardId}-${idx}`
}

let unregisterEsc: (() => void) | undefined

onMounted(() => {
  const loaded = readAccountState()
  if (!loaded?.isRegistered) {
    router.replace('/account-setup')
    return
  }
  account.value = migrateAccountState(loaded)
  const active = getActiveDeckSlot(account.value)
  deckCardIds.value = active?.cardIds?.length
    ? [...active.cardIds]
    : account.value.deckCardIds?.length === DECK_SIZE
      ? [...account.value.deckCardIds]
      : [...getDefaultDeckCardIds()]
  writeAccountState(account.value)

  unregisterEsc = registerEscHandler(() => {
    if (detailCard.value) {
      closeDetail()
      return true
    }
    return false
  })
})

onUnmounted(() => {
  unregisterEsc?.()
})

function isInDeck(cardId: string): boolean {
  return deckCardIds.value.includes(cardId)
}

function showDetail(card: Card) {
  detailCard.value = CardDatabase.getCard(card.id) ?? card
}

function closeDetail() {
  detailCard.value = null
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function playFly(fromEl: HTMLElement | null, toEl: HTMLElement | null, label: string) {
  if (!fromEl) return
  const from = fromEl.getBoundingClientRect()
  const to = toEl?.getBoundingClientRect()
  const tx = to ? to.left + to.width / 2 : from.left
  const ty = to ? to.top + to.height / 2 : from.top - 72
  const id = ++flySeq
  const ghost: FlyGhost = {
    id,
    label,
    x: from.left + from.width / 2,
    y: from.top + from.height / 2,
    tx,
    ty,
    active: false,
  }
  flyGhosts.value.push(ghost)
  await nextTick()
  requestAnimationFrame(() => {
    const g = flyGhosts.value.find(item => item.id === id)
    if (g) g.active = true
  })
  await sleep(480)
  flyGhosts.value = flyGhosts.value.filter(item => item.id !== id)
}

async function addFromPool(card: Card, ev: MouseEvent) {
  if (isInDeck(card.id)) {
    message.value = '该卡牌已在卡组中'
    playCardSound('error')
    setTimeout(() => { message.value = '' }, 2000)
    return
  }
  const poolEl = ev.currentTarget as HTMLElement
  playCardSound('deckAdd')
  await playFly(poolEl, deckGridRef.value, card.name)
  deckCardIds.value.push(card.id)
}

function onPoolClick(card: Card) {
  showDetail(card)
}

function onPoolContextMenu(card: Card, ev: MouseEvent) {
  ev.preventDefault()
  void addFromPool(card, ev)
}

async function removeFromDeck(index: number, ev: MouseEvent) {
  const card = deckCards.value[index]
  if (!card) return
  const key = deckSlotKey(card.id, index)
  const slotEl = (ev.currentTarget as HTMLElement).closest('.deck-slot') as HTMLElement | null
  leavingKeys.value.add(key)
  playCardSound('deckRemove')
  await playFly(slotEl, poolPanelRef.value, card.name)
  deckCardIds.value.splice(index, 1)
  leavingKeys.value.delete(key)
}

function onDeckCardClick(card: Card) {
  showDetail(card)
}

function useDefaultDeck() {
  deckCardIds.value = [...getDefaultDeckCardIds()]
  message.value = '已载入默认卡组（需保存后生效）'
  setTimeout(() => { message.value = '' }, 2000)
}

function persistCurrentDeck(silent = false): boolean {
  if (!account.value) return false
  if (!canSaveDeck.value) {
    if (!silent) {
      playCardSound('error')
      message.value = deckValidation.value.message
      setTimeout(() => { message.value = '' }, 3000)
    }
    return false
  }
  try {
    const ok = updateActiveSlotCards(account.value, deckCardIds.value)
    if (!ok) {
      if (!silent) message.value = '保存失败：卡组必须为 15 张'
      return false
    }
    writeAccountState(account.value)
    if (!silent) {
      playCardSound('saveSuccess')
      message.value = activeSlot.value
        ? `已保存到「${activeSlot.value.name}」`
        : '卡组已保存！'
      setTimeout(() => { message.value = '' }, 2000)
    }
    return true
  } catch {
    if (!silent) {
      playCardSound('error')
      message.value = '保存失败'
    }
    return false
  }
}

function saveDeck() {
  persistCurrentDeck(false)
}

function saveAndExit() {
  if (!persistCurrentDeck(false)) return
  router.push('/')
}

function deckDirty(): boolean {
  const saved = activeSlot.value?.cardIds ?? []
  if (saved.length !== deckCardIds.value.length) return true
  return saved.some((id, i) => id !== deckCardIds.value[i])
}

function switchToSlot(slot: SavedDeckSlot) {
  if (!account.value || slot.id === activeSlotId.value) return
  if (deckDirty()) {
    if (canSaveDeck.value) {
      if (!confirm('切换栏位前是否保存当前卡组？')) return
      if (!persistCurrentDeck(true)) return
    } else if (!confirm('当前卡组未凑满 15 张，切换将丢弃未保存修改。继续？')) {
      return
    }
  }
  switchActiveDeckSlot(account.value, slot.id)
  deckCardIds.value = [...slot.cardIds]
  writeAccountState(account.value)
  message.value = `已切换到「${slot.name}」`
  setTimeout(() => { message.value = '' }, 2000)
}

function openNewSlotForm() {
  if (!canSaveDeck.value) {
    message.value = '请先凑满 15 张卡牌再另存为新栏位'
    setTimeout(() => { message.value = '' }, 2500)
    return
  }
  if (!canAddSlot.value) {
    message.value = `最多保存 ${MAX_DECK_SLOTS} 套卡组`
    setTimeout(() => { message.value = '' }, 2000)
    return
  }
  newSlotName.value = `卡组 ${savedDecks.value.length + 1}`
  showNewSlotInput.value = true
  showRenameInput.value = false
}

function confirmNewSlot() {
  if (!account.value) return
  if (!persistCurrentDeck(true)) {
    message.value = deckValidation.value.message
    setTimeout(() => { message.value = '' }, 2500)
    return
  }
  const slot = addDeckSlot(account.value, newSlotName.value, [...deckCardIds.value])
  if (!slot) {
    message.value = `另存失败（需恰好 ${DECK_SIZE} 张且未超过栏位上限）`
    setTimeout(() => { message.value = '' }, 2500)
    return
  }
  writeAccountState(account.value)
  showNewSlotInput.value = false
  message.value = `已另存为「${slot.name}」`
  setTimeout(() => { message.value = '' }, 2000)
}

function cancelNewSlot() {
  showNewSlotInput.value = false
}

function openRenameForm() {
  if (!activeSlot.value) return
  renameSlotName.value = activeSlot.value.name
  showRenameInput.value = true
  showNewSlotInput.value = false
}

function confirmRename() {
  if (!account.value || !activeSlotId.value) return
  if (!renameDeckSlot(account.value, activeSlotId.value, renameSlotName.value)) {
    message.value = '名称不能为空'
    setTimeout(() => { message.value = '' }, 2000)
    return
  }
  writeAccountState(account.value)
  showRenameInput.value = false
  message.value = '栏位已重命名'
  setTimeout(() => { message.value = '' }, 2000)
}

function cancelRename() {
  showRenameInput.value = false
}

function deleteCurrentSlot() {
  if (!account.value || !activeSlotId.value || !canDeleteSlot.value) return
  const name = activeSlot.value?.name ?? '当前栏位'
  if (!confirm(`确定删除卡组栏位「${name}」？`)) return
  deleteDeckSlot(account.value, activeSlotId.value)
  deckCardIds.value = [...account.value.deckCardIds]
  writeAccountState(account.value)
  message.value = `已删除「${name}」`
  setTimeout(() => { message.value = '' }, 2000)
}

function goHome() {
  if (deckDirty() && !canSaveDeck.value) {
    if (!confirm('当前卡组不是 15 张，离开将丢弃未保存修改。确定返回？')) return
  } else if (deckDirty() && canSaveDeck.value) {
    if (!confirm('有未保存的修改，确定返回主页？')) return
  }
  router.push('/')
}
</script>

<template>
  <main class="deck-page" @click="closeDetail">
    <div class="deck-wrap" @click.stop>
      <div class="deck-header">
        <h1>卡组管理</h1>
        <div class="deck-actions">
          <button type="button" class="btn-secondary" @click="useDefaultDeck">恢复默认卡组</button>
          <button type="button" class="btn-primary" :disabled="!canSaveDeck" @click="saveDeck">保存卡组</button>
          <button type="button" class="btn-primary" :disabled="!canSaveDeck" @click="saveAndExit">保存并返回</button>
          <button type="button" class="btn-secondary" @click="goHome">← 返回主页</button>
        </div>
      </div>

      <p v-if="message" class="deck-message">{{ message }}</p>

      <section class="panel slots-panel">
        <div class="slots-header">
          <h3>卡组栏位 ({{ savedDecks.length }}/{{ MAX_DECK_SLOTS }})</h3>
          <div class="slots-toolbar">
            <button
              v-if="canAddSlot && !showNewSlotInput"
              type="button"
              class="btn-secondary btn-sm"
              @click="openNewSlotForm"
            >
              + 另存为新栏位
            </button>
            <template v-if="activeSlot">
              <button type="button" class="btn-secondary btn-sm" @click="openRenameForm">重命名</button>
              <button
                v-if="canDeleteSlot"
                type="button"
                class="btn-danger btn-sm"
                @click="deleteCurrentSlot"
              >
                删除栏位
              </button>
            </template>
          </div>
        </div>

        <div v-if="showNewSlotInput" class="slot-form">
          <input
            v-model="newSlotName"
            type="text"
            class="slot-name-input"
            placeholder="输入栏位名称"
            maxlength="24"
            @keyup.enter="confirmNewSlot"
          >
          <button type="button" class="btn-primary btn-sm" @click="confirmNewSlot">保存</button>
          <button type="button" class="btn-secondary btn-sm" @click="cancelNewSlot">取消</button>
        </div>

        <div v-if="showRenameInput" class="slot-form">
          <input
            v-model="renameSlotName"
            type="text"
            class="slot-name-input"
            placeholder="输入新名称"
            maxlength="24"
            @keyup.enter="confirmRename"
          >
          <button type="button" class="btn-primary btn-sm" @click="confirmRename">确定</button>
          <button type="button" class="btn-secondary btn-sm" @click="cancelRename">取消</button>
        </div>

        <div class="slots-row">
          <button
            v-for="slot in savedDecks"
            :key="slot.id"
            type="button"
            class="slot-chip"
            :class="{ active: slot.id === activeSlotId }"
            :title="`更新于 ${new Date(slot.updatedAt).toLocaleString()}`"
            @click="switchToSlot(slot)"
          >
            <span class="slot-chip-name">{{ slot.name }}</span>
            <span v-if="slot.id === activeSlotId" class="slot-chip-badge">使用中</span>
          </button>
        </div>
        <p class="slots-hint">点击栏位切换 · 凑满 {{ DECK_SIZE }} 张后点「保存卡组」</p>
      </section>

      <p class="deck-hint">
        左键查看效果 · 右键卡池卡牌快速加入卡组 · 点击卡组内 ✕ 移出
        <span v-if="!canSaveDeck" class="deck-hint-warn">（{{ deckValidation.message }}）</span>
      </p>

      <section class="panel">
        <h3>
          当前卡组 · {{ activeSlot?.name ?? '未命名' }}
          <span class="deck-count" :class="{ 'deck-count--invalid': !canSaveDeck }">({{ deckCards.length }}/{{ DECK_SIZE }})</span>
        </h3>
        <div ref="deckGridRef" class="deck-grid">
          <div
            v-for="(card, idx) in deckCards"
            :key="deckSlotKey(card.id, idx)"
            class="deck-slot"
            :class="{ 'deck-slot--leaving': leavingKeys.has(deckSlotKey(card.id, idx)) }"
          >
            <button type="button" class="slot-main" @click="onDeckCardClick(card)">
              <span class="slot-num">{{ idx + 1 }}</span>
              <div class="slot-body">
                <div class="slot-name">{{ card.name }}</div>
                <div class="slot-meta">
                  {{ getCardTypeLabel(card.type) }} · 费用 {{ card.cost }}
                  <template v-if="card.type !== 'tactic'"> · 战力 {{ card.basePower }}</template>
                </div>
                <div class="slot-effect">{{ effectPreview(card) }}</div>
              </div>
            </button>
            <button
              type="button"
              class="btn-remove"
              title="移出卡组"
              @click.stop="removeFromDeck(idx, $event)"
            >✕</button>
          </div>
          <p v-if="deckCards.length === 0" class="deck-empty">卡组为空，从下方卡池右键添加卡牌</p>
        </div>
      </section>

      <section ref="poolPanelRef" class="panel pool-panel">
        <div class="pool-head">
          <h3>
            卡池 ({{ filteredPool.length }}/{{ poolMeta.totalCards }})
            <span v-if="hasStructuredFilterActive" class="pool-filter-tag">已筛选</span>
          </h3>
        </div>
        <div class="pool-toolbar">
          <input
            :value="poolCriteria.searchQuery"
            type="search"
            class="pool-search"
            placeholder="搜索名称、关键词、效果描述…"
            @input="setPoolSearchQuery(($event.target as HTMLInputElement).value)"
          >
          <button
            v-if="poolCriteria.searchQuery || hasStructuredFilterActive"
            type="button"
            class="btn-secondary btn-sm"
            @click="clearPoolFilters"
          >
            清空筛选
          </button>
        </div>
        <div v-if="filteredPool.length === 0" class="pool-empty-state">
          无匹配卡牌，请放宽筛选条件或点击「清空筛选」
        </div>
        <div v-else class="pool-grid">
          <button
            v-for="card in filteredPool"
            :key="card.id"
            type="button"
            class="pool-card"
            :class="{ 'already-in-deck': isInDeck(card.id) }"
            @click.stop="onPoolClick(card)"
            @contextmenu="onPoolContextMenu(card, $event)"
          >
            <div class="pool-name">{{ card.name }}</div>
            <div class="pool-meta">
              {{ getCardTypeLabel(card.type) }} · {{ card.attribute }} · ⚡{{ card.cost }}
              <template v-if="card.type !== 'tactic'"> · 💪{{ card.basePower }}</template>
            </div>
            <div v-if="card.keywords?.length" class="pool-kw">{{ card.keywords.join(' · ') }}</div>
            <div class="pool-effect">{{ effectPreview(card) }}</div>
            <span v-if="isInDeck(card.id)" class="pool-badge">已在卡组</span>
          </button>
        </div>
        <p class="pool-hint">提示：右键卡池卡牌快速加入 · 右侧悬浮「筛选」可收起/展开，滚动页面时仍可使用</p>
      </section>
    </div>

    <DeckPoolFilterSidebar
      :open="filterSidebarOpen"
      :match-count="filteredPool.length"
      :total-count="poolMeta.totalCards"
      :selected-types="poolCriteria.selectedTypes"
      :selected-attributes="poolCriteria.selectedAttributes"
      :selected-keywords="poolCriteria.selectedKeywords"
      :deck-membership="poolCriteria.deckMembership"
      :sort-key="poolCriteria.sortKey"
      :type-counts="poolMeta.typeCounts"
      :attribute-counts="poolMeta.attributeCounts"
      :filtered-keywords="filteredKeywords"
      :keyword-search="filterKeywordSearch"
      @toggle-open="toggleFilterSidebar"
      @toggle-type="toggleFilterType"
      @toggle-attribute="toggleFilterAttribute"
      @toggle-keyword="toggleFilterKeyword"
      @set-deck-membership="setPoolDeckMembership"
      @set-sort-key="setPoolSortKey"
      @clear-filters="clearPoolFilters"
      @remove-type="removeSelectedType"
      @remove-attribute="removeSelectedAttribute"
      @remove-keyword="removeSelectedKeyword"
      @update:keyword-search="setPoolKeywordSearch"
    />

    <Teleport to="body">
      <div
        v-for="ghost in flyGhosts"
        :key="ghost.id"
        class="deck-fly-card"
        :class="{ 'deck-fly-card--active': ghost.active }"
        :style="{
          '--fly-x': ghost.x + 'px',
          '--fly-y': ghost.y + 'px',
          '--fly-tx': ghost.tx + 'px',
          '--fly-ty': ghost.ty + 'px',
        }"
      >
        {{ ghost.label }}
      </div>
    </Teleport>

    <div v-if="detailCard" class="detail-overlay" @click="closeDetail">
      <div class="detail-modal-wrap" @click.stop>
        <CardDetailPopover :card="detailCard" variant="modal" />
        <p class="detail-tip">点击空白处关闭</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.deck-page {
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: var(--game-bg-table);
  color: var(--game-text-primary);
  font-family: var(--game-font-ui);
  padding: 20px;
  box-sizing: border-box;
}

.deck-wrap {
  max-width: 1280px;
  margin: 0 auto;
  padding-bottom: 32px;
}

.deck-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.deck-header h1 {
  color: var(--game-text-primary);
  font-size: 28px;
  margin: 0;
}

.deck-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid #d8d2c4;
}

.btn-primary {
  background: #a46d1f;
  color: #fff;
  border: none;
  font-weight: bold;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f6f4ef;
  color: #1f2522;
}

.deck-message {
  text-align: center;
  color: #2f6f5e;
  font-weight: bold;
  margin-bottom: 12px;
}

.deck-hint {
  text-align: center;
  color: #69706b;
  font-size: 13px;
  margin: 0 0 16px;
}

.deck-hint-warn {
  color: #9d2f2f;
  font-weight: 600;
}

.deck-count--invalid {
  color: #9d2f2f;
}

.slots-panel {
  margin-bottom: 16px;
}

.slots-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

.slots-header h3 {
  margin: 0;
}

.slots-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-danger {
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  background: #fff;
  color: #9d2f2f;
  border: 1px solid #e0b4b4;
}

.btn-danger:hover {
  background: #fdf5f5;
}

.slots-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slot-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 2px solid #d8d2c4;
  background: #f6f4ef;
  cursor: pointer;
  font-size: 14px;
  color: #1f2522;
  transition: border-color 0.15s, background 0.15s;
}

.slot-chip:hover {
  border-color: #a46d1f;
}

.slot-chip.active {
  border-color: #a46d1f;
  background: rgba(164, 109, 31, 0.12);
  font-weight: 600;
}

.slot-chip-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-chip-badge {
  font-size: 10px;
  background: #a46d1f;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.slot-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.slot-name-input {
  flex: 1;
  min-width: 160px;
  padding: 8px 12px;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  font-size: 14px;
}

.slots-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #69706b;
}

.panel {
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.panel h3 {
  color: #1f2522;
  margin: 0 0 16px;
  font-size: 18px;
}

.deck-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

.deck-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #69706b;
  font-size: 14px;
  margin: 8px 0;
}

.deck-slot {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: #f6f4ef;
  border: 2px solid #d8d2c4;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s, opacity 0.2s, transform 0.2s;
}

.deck-slot--leaving {
  opacity: 0.35;
  transform: scale(0.96);
}

.slot-main {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  min-width: 0;
}

.slot-main:hover {
  background: rgba(164, 109, 31, 0.06);
}

.slot-num {
  color: #a46d1f;
  font-weight: bold;
  min-width: 22px;
}

.slot-name {
  font-weight: bold;
  color: #1f2522;
  font-size: 14px;
}

.slot-meta {
  font-size: 12px;
  color: #69706b;
  margin-top: 2px;
}

.slot-effect {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.btn-remove {
  flex-shrink: 0;
  width: 36px;
  background: #fff;
  color: #9d2f2f;
  border: none;
  border-left: 1px solid #e0b4b4;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.btn-remove:hover {
  background: #fdf5f5;
}

.pool-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.pool-head h3 {
  margin: 0;
  font-size: 18px;
}

.pool-filter-tag {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #a46d1f;
  background: rgba(164, 109, 31, 0.12);
  padding: 2px 8px;
  border-radius: 999px;
  vertical-align: middle;
}

.pool-empty-state {
  text-align: center;
  padding: 32px 16px;
  color: #9d2f2f;
  font-size: 14px;
  background: #fdf5f5;
  border: 1px dashed #e0b4b4;
  border-radius: 8px;
  margin-bottom: 12px;
}

.pool-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pool-search {
  flex: 1;
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
}

.pool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
}

.pool-card {
  position: relative;
  text-align: left;
  padding: 10px 12px;
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.pool-card:hover {
  border-color: #a46d1f;
}

.pool-card.already-in-deck {
  opacity: 0.7;
}

.pool-name {
  font-weight: bold;
  font-size: 14px;
  color: #1f2522;
}

.pool-meta {
  font-size: 11px;
  color: #69706b;
  margin-top: 2px;
}

.pool-kw {
  font-size: 10px;
  color: #2f6f5e;
  margin-top: 4px;
}

.pool-effect {
  font-size: 11px;
  color: #888;
  margin-top: 4px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pool-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 9px;
  background: #e8e4da;
  color: #69706b;
  padding: 2px 6px;
  border-radius: 4px;
}

.pool-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #69706b;
  text-align: center;
}

.deck-fly-card {
  position: fixed;
  left: var(--fly-x);
  top: var(--fly-y);
  z-index: 3000;
  transform: translate(-50%, -50%) scale(1);
  padding: 6px 12px;
  border-radius: 8px;
  background: #fffdf8;
  border: 2px solid #a46d1f;
  color: #1f2522;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 8px 24px rgba(31, 37, 34, 0.2);
  pointer-events: none;
  transition: left 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.45s ease,
    transform 0.45s ease;
  white-space: nowrap;
}

.deck-fly-card--active {
  left: var(--fly-tx);
  top: var(--fly-ty);
  opacity: 0.85;
  transform: translate(-50%, -50%) scale(0.82);
}

.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(31, 37, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.detail-modal-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.detail-tip {
  margin: 0;
  font-size: 12px;
  color: #fffdf8;
  opacity: 0.9;
}
</style>
