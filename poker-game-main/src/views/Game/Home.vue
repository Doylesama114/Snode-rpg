<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AccountState } from '@/types/game'
import GameNav from '@/views/Layout/GameNav.vue'
import GameButton from '@/components/game/GameButton.vue'
import { navigateToLauncher } from '@/utils/escNavigation'
import { readAccountState } from '@/utils/deckSlots'
import { validateActiveDeck } from '@/utils/deckValidation'

const state = useGlobalState()
const router = useRouter()
const playerName = ref<string | null>(null)

onMounted(() => {
  try {
    const raw = localStorage.getItem('accountState')
    if (raw) {
      const accountState: AccountState = JSON.parse(raw)
      if (!accountState.isRegistered) {
        router.replace('/account-setup')
        return
      }
      playerName.value = accountState.playerName
    } else {
      router.replace('/account-setup')
    }
  } catch {
    router.replace('/account-setup')
  }
})

function ensureValidDeck(actionLabel: string): boolean {
  const account = readAccountState()
  const v = validateActiveDeck(account)
  if (!v.valid) {
    alert(`${v.message}\n无法${actionLabel}，请前往「管理卡组」调整。`)
    return false
  }
  return true
}

function startNewGame() {
  if (!ensureValidDeck('开始单机游戏')) return
  router.push('/new-game')
}

function startMultiplayer() {
  if (!ensureValidDeck('进入联机大厅')) return
  router.push('/multiplayer')
}

function goDeckBuilder() {
  router.push('/deck-builder')
}

function goSettings() {
  router.push('/settings')
}

function goBack() {
  navigateToLauncher()
}
</script>

<template>
  <main class="game-menu-page h-100dvh h-screen w-screen of-hidden">
    <GameNav />
    <button type="button" class="home-nav-btn home-nav-btn--left" @click="goBack">← 返回启动台</button>
    <button type="button" class="home-nav-btn home-nav-btn--right" @click="goSettings">⚙ 设置</button>
    <div class="game-menu-page__center">
      <div v-if="playerName" class="game-menu-page__welcome">欢迎, {{ playerName }}</div>
      <GameButton variant="primary" class="home-menu-btn" @click="startNewGame">单机游戏</GameButton>
      <GameButton variant="secondary" class="home-menu-btn home-menu-btn--mp" @click="startMultiplayer">🌐 联机对战</GameButton>
      <GameButton variant="secondary" class="home-menu-btn home-menu-btn--deck" @click="goDeckBuilder">管理卡组</GameButton>
    </div>
  </main>
</template>

<style scoped>
.home-nav-btn {
  position: fixed;
  top: 10px;
  z-index: 200;
  padding: 6px 12px;
  font-size: 14px;
  background: var(--game-bg-panel);
  color: var(--game-text-primary);
  border: 1px solid var(--game-border);
  border-radius: var(--game-radius-sm);
  cursor: pointer;
  font-family: var(--game-font-ui);
}

.home-nav-btn--left {
  left: 10px;
}

.home-nav-btn--right {
  right: 10px;
}

.home-menu-btn {
  width: 100%;
  padding: 18px 40px !important;
  font-size: 20px !important;
  min-height: 56px !important;
}

.home-menu-btn--mp :deep(.game-btn) {
  background: linear-gradient(180deg, #4a7ab0 0%, #315f8f 100%);
  color: #fff;
  border: none;
}

.home-menu-btn--deck :deep(.game-btn) {
  background: linear-gradient(180deg, #4a9b7a 0%, #2f6f5e 100%);
  color: #fff;
  border: none;
}
</style>
