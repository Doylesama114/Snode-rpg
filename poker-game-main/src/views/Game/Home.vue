<script lang="ts" setup>
import GameNav from "@/views/Layout/GameNav.vue";
import GameContent from '@/views/Layout/GameContent.vue'
import {getAssetsFile} from '@/utils'
import { useRouter } from 'vue-router'

const state = useGlobalState()
const router = useRouter()

function startNewGame() {
  router.push('/new-game')
}

function startMultiplayer() {
  router.push('/multiplayer')
}

function goBack() {
  window.history.back()
}
</script>

<template>
  <main h-100dvh h-screen w-screen of-hidden style="background: #f6f4ef;">
    <GameNav/>
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 100; display: flex; flex-direction: column; gap: 20px;">
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
        @click="goBack"
        style="padding: 12px 30px; font-size: 16px; background: #f6f4ef; color: #1f2522; border: 1px solid #d8d2c4; border-radius: 8px; cursor: pointer; margin-top: 8px;"
      >
        ← 返回启动台
      </button>
    </div>
    <GameContent/>
  </main>
</template>