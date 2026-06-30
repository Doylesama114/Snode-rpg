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
  <main h-100dvh h-screen w-screen of-hidden bg-cover bg-center grid="~ rows-[max-content_1fr]"
        :style="{ backgroundImage: `url(${getAssetsFile(`${state.bgImage}.png`)})` }">
    <GameNav/>
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 100; display: flex; flex-direction: column; gap: 20px;">
      <button 
        @click="startNewGame"
        style="padding: 20px 40px; font-size: 24px; background: #ff9800; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.3);"
      >
        单机游戏
      </button>
      <button 
        @click="startMultiplayer"
        style="padding: 20px 40px; font-size: 24px; background: #9c27b0; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.3);"
      >
        🌐 联机对战
      </button>
      <button 
        @click="goBack"
        style="padding: 12px 30px; font-size: 18px; background: #69706b; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px;"
      >
        ← 返回启动台
      </button>
    </div>
    <GameContent/>
  </main>
</template>