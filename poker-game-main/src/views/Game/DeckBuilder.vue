<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { AccountState } from '@/types/game'
import { CardDatabase, getDefaultDeckCardIds } from '@/data/cardDatabase'

const router = useRouter()
const deckCardIds = ref<string[]>([])
const deckCards = ref<Array<{ id: string; name: string; type: string; cost: number; basePower: number }>>([])
const message = ref('')

onMounted(() => {
  // Ensure CardDatabase is initialized
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
    deckCardIds.value = accountState.deckCardIds && accountState.deckCardIds.length === 15
      ? [...accountState.deckCardIds]
      : [...getDefaultDeckCardIds()]
    refreshDeckDisplay()
  } catch {
    router.replace('/account-setup')
  }
})

function refreshDeckDisplay() {
  deckCards.value = deckCardIds.value.map(id => {
    const card = CardDatabase.getCard(id)
    return card
      ? { id: card.id, name: card.name, type: card.type, cost: card.cost, basePower: card.basePower }
      : { id, name: `未知 (${id})`, type: 'unit', cost: 0, basePower: 0 }
  })
}

function useDefaultDeck() {
  deckCardIds.value = [...getDefaultDeckCardIds()]
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
    refreshDeckDisplay()
  } catch {
    message.value = '保存失败'
  }
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <main style="min-height: 100vh; background: #f6f4ef; padding: 20px;">
    <div style="max-width: 800px; margin: 0 auto;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <h1 style="color: #1f2522; font-size: 28px; margin: 0;">卡组管理</h1>
        <div style="display: flex; gap: 12px;">
          <button @click="useDefaultDeck" style="padding: 10px 20px; background: #f6f4ef; border: 1px solid #d8d2c4; border-radius: 8px; cursor: pointer; font-size: 14px; color: #1f2522;">
            恢复默认卡组
          </button>
          <button @click="saveDeck" style="padding: 10px 20px; background: #a46d1f; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold;">
            保存卡组
          </button>
          <button @click="goHome" style="padding: 10px 20px; background: #f6f4ef; border: 1px solid #d8d2c4; border-radius: 8px; cursor: pointer; font-size: 14px; color: #1f2522;">
            ← 返回主页
          </button>
        </div>
      </div>

      <div v-if="message" style="text-align: center; color: #2f6f5e; font-weight: bold; margin-bottom: 16px;">{{ message }}</div>

      <div style="background: #fffdf8; border: 1px solid #d8d2c4; border-radius: 12px; padding: 20px;">
        <h3 style="color: #1f2522; margin: 0 0 16px 0;">当前卡组 ({{ deckCards.length }}/15)</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
          <div
            v-for="(card, idx) in deckCards"
            :key="card.id + idx"
            style="background: #f6f4ef; border: 1px solid #d8d2c4; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;"
          >
            <span style="color: #a46d1f; font-weight: bold; min-width: 24px;">{{ idx + 1 }}</span>
            <div style="flex: 1;">
              <div style="font-weight: bold; color: #1f2522; font-size: 14px;">{{ card.name }}</div>
              <div style="font-size: 12px; color: #888;">
                {{ card.type === 'unit' ? '单位' : card.type === 'environment' ? '环境' : '战术' }}
                · 费用 {{ card.cost }}
                · 战力 {{ card.basePower }}
              </div>
            </div>
          </div>
        </div>
        <div v-if="deckCards.length < 15" style="color: #a46d1f; margin-top: 12px; text-align: center;">
          提示：使用默认卡组或从全部卡牌中选择 15 张组建自定义卡组
        </div>
      </div>
    </div>
  </main>
</template>
