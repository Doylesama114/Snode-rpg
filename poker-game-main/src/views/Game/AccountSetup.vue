<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDefaultDeckCardIds } from '@/data/cardDatabase'
import type { AccountState } from '@/types/game'
import { createDefaultSlot, migrateAccountState, writeAccountState } from '@/utils/deckSlots'

const router = useRouter()
const playerName = ref('')
const error = ref('')

function handleRegister() {
  const name = playerName.value.trim()
  if (!name) {
    error.value = '请输入玩家名称'
    return
  }

  const defaultIds = getDefaultDeckCardIds()
  const firstSlot = createDefaultSlot('默认卡组', defaultIds)
  const accountState: AccountState = {
    isRegistered: true,
    playerName: name,
    deckCardIds: defaultIds,
    savedDecks: [firstSlot],
    activeDeckSlotId: firstSlot.id,
  }

  writeAccountState(migrateAccountState(accountState))
  router.replace('/')
}
</script>

<template>
  <main style="min-height: 100vh; background: #f6f4ef; display: flex; align-items: center; justify-content: center;">
    <div style="background: #fffdf8; border: 1px solid #d8d2c4; border-radius: 16px; padding: 40px; max-width: 420px; width: 100%; text-align: center;">
      <h1 style="color: #1f2522; font-size: 28px; margin-bottom: 8px;">账户设置</h1>
      <p style="color: #666; margin-bottom: 24px;">首次游戏需要创建玩家账户</p>
      <div v-if="error" style="color: #9d2f2f; margin-bottom: 12px;">{{ error }}</div>
      <input
        v-model="playerName"
        type="text"
        placeholder="输入你的玩家名称"
        style="width: 100%; padding: 12px; border: 2px solid #d8d2c4; border-radius: 8px; font-size: 16px; margin-bottom: 20px; box-sizing: border-box; outline: none;"
        @keyup.enter="handleRegister"
      />
      <button
        @click="handleRegister"
        style="width: 100%; padding: 14px; font-size: 18px; background: #a46d1f; color: #fff; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;"
      >
        注册并开始游戏
      </button>
    </div>
  </main>
</template>
