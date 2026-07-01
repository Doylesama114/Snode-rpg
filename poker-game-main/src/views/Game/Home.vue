<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AccountState } from '@/types/game'
import GameNav from "@/views/Layout/GameNav.vue";
import GameContent from '@/views/Layout/GameContent.vue'
import {getAssetsFile} from '@/utils'

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

function startNewGame() {
  router.push('/new-game')
}

function startMultiplayer() {
  router.push('/multiplayer')
}

function goDeckBuilder() {
  router.push('/deck-builder')
}

function goBack() {
  window.history.back()
}
</script>

<template>
  <main h-100dvh h-screen w-screen of-hidden style="background: #f6f4ef;">
    <GameNav/>
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 100; display: flex; flex-direction: column; gap: 20px;">
      <div v-if="playerName" style="text-align: center; font-size: 20px; color: #1f2522; font-weight: bold; margin-bottom: 8px;">
        欢迎, {{ playerName }}
      </div>
      <button 
        @click="startNewGame"
        style="padding: 20px 40px; font-size: 24px; background: #a46d1f; color: #fff; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(31,37,34,0.08);"
      >
        单机游戏
      </button>
      <button 
        @click="startMultiplayer"
        style="padding: 20px 40px; font-size: 24px; background: #315f8f; color: #fff; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(31,37,34,0.08);"
      >
        🌐 联机对战
      </button>
      <button 
        @click="goDeckBuilder"
        style="padding: 20px 40px; font-size: 24px; background: #2f6f5e; color: #fff; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(31,37,34,0.08);"
      >
        管理卡组
      </button>
      <button 
        @click="goBack"
        style="padding: 12px 30px; font-size: 16px; background: #f6f4ef; color: #1f2522; border: 1px solid #d8d2c4; border-radius: 8px; cursor: pointer; margin-top: 8px;"
      >
        ← 返回启动台
      </button>
    </div>
    <GameContent/>
  </main>
</template>
