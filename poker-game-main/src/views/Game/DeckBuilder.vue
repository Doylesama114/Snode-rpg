<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { AccountState, Card, CardType } from '@/types/game'
import { CardDatabase, getDefaultDeckCardIds } from '@/data/cardDatabase'
import CardDetailPopover from '@/components/CardDetailPopover.vue'
import { getCardTypeLabel, formatCardEffects } from '@/utils/cardDisplay'
import { registerEscHandler } from '@/utils/escNavigation'

const router = useRouter()
const deckCardIds = ref<string[]>([])
const message = ref('')
const searchQuery = ref('')
const filterType = ref<CardType | 'all'>('all')
const replacingIndex = ref<number | null>(null)
const detailCard = ref<Card | null>(null)

const allCards = computed(() => {
  return CardDatabase.getAllCards().slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})

const filteredPool = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allCards.value.filter(c => {
    if (filterType.value !== 'all' && c.type !== filterType.value) return false
    if (!q) return true
    return c.name.toLowerCase().includes(q)
      || c.keywords.some(kw => kw.toLowerCase().includes(q))
      || c.attribute.includes(q)
  })
})

const deckCards = computed(() =>
  deckCardIds.value.map(id => CardDatabase.getCard(id)).filter((c): c is Card => !!c),
)

function effectPreview(card: Card): string {
  const fx = formatCardEffects(card.effects)
  return fx[0]?.description || '无效果'
}

let unregisterEsc: (() => void) | undefined

onMounted(() => {
  CardDatabase.initialize()
  try {
    const raw = localStorage.getItem('accountState')
    if (!raw) {
      router.replace('/account-setup')
      return
    }
    const accountState: AccountState = JSON.parse(raw)
    if (!accountState.isRegistered) {
      router.replace('/account-setup')
      return
    }
    deckCardIds.value = accountState.deckCardIds?.length === 15
      ? [...accountState.deckCardIds]
      : [...getDefaultDeckCardIds()]
  } catch {
    router.replace('/account-setup')
  }

  unregisterEsc = registerEscHandler(() => {
    if (detailCard.value) {
      closeDetail()
      return true
    }
    if (replacingIndex.value !== null) {
      cancelReplace()
      return true
    }
    return false
  })
})

onUnmounted(() => {
  unregisterEsc?.()
})

function isInDeck(cardId: string, exceptIndex?: number): boolean {
  return deckCardIds.value.some((id, idx) => id === cardId && idx !== exceptIndex)
}

function canPickForDeck(cardId: string): boolean {
  if (replacingIndex.value === null) return false
  return !isInDeck(cardId, replacingIndex.value)
}

function showDetail(card: Card) {
  detailCard.value = CardDatabase.getCard(card.id) ?? card
}

function closeDetail() {
  detailCard.value = null
}

function startReplace(index: number) {
  replacingIndex.value = index
  message.value = `正在更换第 ${index + 1} 张牌，请从下方卡池选择`
  setTimeout(() => { if (message.value.startsWith('正在更换')) message.value = '' }, 4000)
}

function cancelReplace() {
  replacingIndex.value = null
}

function pickFromPool(card: Card) {
  if (replacingIndex.value !== null) {
    if (!canPickForDeck(card.id)) {
      message.value = '该卡牌已在卡组中'
      setTimeout(() => { message.value = '' }, 2000)
      return
    }
    deckCardIds.value[replacingIndex.value] = card.id
    replacingIndex.value = null
    message.value = `已替换为 ${card.name}`
    setTimeout(() => { message.value = '' }, 2000)
    return
  }
  showDetail(card)
}

function onDeckCardClick(card: Card) {
  showDetail(card)
}

function useDefaultDeck() {
  deckCardIds.value = [...getDefaultDeckCardIds()]
  replacingIndex.value = null
  saveDeck()
}

function saveDeck() {
  try {
    const raw = localStorage.getItem('accountState')
    if (!raw) return
    const accountState: AccountState = JSON.parse(raw)
    accountState.deckCardIds = [...deckCardIds.value]
    localStorage.setItem('accountState', JSON.stringify(accountState))
    message.value = '卡组已保存！'
    setTimeout(() => { message.value = '' }, 2000)
  } catch {
    message.value = '保存失败'
  }
}

function goHome() {
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
          <button type="button" class="btn-primary" @click="saveDeck">保存卡组</button>
          <button type="button" class="btn-secondary" @click="goHome">← 返回主页</button>
        </div>
      </div>

      <p v-if="message" class="deck-message">{{ message }}</p>
      <p v-if="replacingIndex !== null" class="deck-hint replacing">
        正在更换第 {{ replacingIndex + 1 }} 张 ·
        <button type="button" class="link-btn" @click="cancelReplace">取消</button>
      </p>
      <p v-else class="deck-hint">点击卡牌查看效果 · 点「更换」从下方 148 张卡池替换</p>

      <section class="panel">
        <h3>当前卡组 ({{ deckCards.length }}/15)</h3>
        <div class="deck-grid">
          <div
            v-for="(card, idx) in deckCards"
            :key="card.id + '-' + idx"
            class="deck-slot"
            :class="{ replacing: replacingIndex === idx, 'in-deck-dup': false }"
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
            <button type="button" class="btn-replace" @click.stop="startReplace(idx)">更换</button>
          </div>
        </div>
      </section>

      <section class="panel pool-panel">
        <h3>卡池 ({{ filteredPool.length }}/148)</h3>
        <div class="pool-toolbar">
          <input
            v-model="searchQuery"
            type="search"
            class="pool-search"
            placeholder="搜索名称、关键词、属性…"
          >
          <select v-model="filterType" class="pool-filter">
            <option value="all">全部类型</option>
            <option value="unit">单位</option>
            <option value="environment">环境</option>
            <option value="tactic">战术</option>
          </select>
        </div>
        <div class="pool-grid">
          <button
            v-for="card in filteredPool"
            :key="card.id"
            type="button"
            class="pool-card"
            :class="{
              'already-in-deck': isInDeck(card.id, replacingIndex ?? undefined) && replacingIndex === null,
              pickable: replacingIndex !== null && canPickForDeck(card.id),
              disabled: replacingIndex !== null && !canPickForDeck(card.id),
            }"
            @click.stop="pickFromPool(card)"
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
      </section>
    </div>

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
  min-height: 100vh;
  background: #f6f4ef;
  padding: 20px;
}

.deck-wrap {
  max-width: 1100px;
  margin: 0 auto;
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
  color: #1f2522;
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

.deck-hint.replacing {
  color: #a46d1f;
  font-weight: 600;
}

.link-btn {
  background: none;
  border: none;
  color: #315f8f;
  cursor: pointer;
  text-decoration: underline;
  font-size: inherit;
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

.deck-slot {
  display: flex;
  align-items: stretch;
  gap: 6px;
  background: #f6f4ef;
  border: 2px solid #d8d2c4;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.15s;
}

.deck-slot.replacing {
  border-color: #a46d1f;
  box-shadow: 0 0 0 2px rgba(164, 109, 31, 0.2);
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

.btn-replace {
  flex-shrink: 0;
  padding: 0 12px;
  background: #2f6f5e;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.btn-replace:hover {
  background: #245a4c;
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

.pool-filter {
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
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
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

.pool-card:hover:not(.disabled) {
  border-color: #a46d1f;
}

.pool-card.pickable {
  border-color: #2f6f5e;
  box-shadow: 0 0 0 2px rgba(47, 111, 94, 0.25);
}

.pool-card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pool-card.already-in-deck:not(.pickable) {
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
