<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadGameSettings, saveGameSettings } from '@/utils/gameSettings'
import { refreshBgmVolume } from '@/utils/gameBgm'
import { registerEscHandler } from '@/utils/escNavigation'

const router = useRouter()
const skipAnimations = ref(false)
const bgmVolume = ref(70)
const bgmMuted = ref(false)
const saved = ref(false)

const volumeLabel = computed(() => `${bgmVolume.value}%`)

let unregisterEsc: (() => void) | undefined

onMounted(() => {
  const s = loadGameSettings()
  skipAnimations.value = s.skipAnimations
  bgmVolume.value = Math.round(s.bgmVolume * 100)
  bgmMuted.value = s.bgmMuted
  unregisterEsc = registerEscHandler(() => false)
})

onUnmounted(() => {
  unregisterEsc?.()
})

function goBack() {
  router.replace('/')
}

function persist() {
  saveGameSettings({
    skipAnimations: skipAnimations.value,
    bgmVolume: bgmVolume.value / 100,
    bgmMuted: bgmMuted.value,
  })
  refreshBgmVolume()
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function toggleBgmMute() {
  bgmMuted.value = !bgmMuted.value
  persist()
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <button type="button" class="btn-back" @click="goBack">← 返回</button>
      <h1>游戏设置</h1>
    </header>

    <section class="settings-panel">
      <label class="setting-row">
        <div class="setting-text">
          <span class="setting-title">跳过动画</span>
          <span class="setting-desc">关闭出牌飞牌、重铸特效等动画，加快对局节奏</span>
        </div>
        <input v-model="skipAnimations" type="checkbox" class="setting-toggle" @change="persist">
      </label>

      <div class="setting-block">
        <div class="setting-row setting-row--static">
          <div class="setting-text">
            <span class="setting-title">背景音乐</span>
            <span class="setting-desc">主页 / 构筑 / 大厅播放 HALL1；对局播放 Battle1；最后一回合切换 END1</span>
          </div>
          <button type="button" class="btn-mute" :class="{ 'btn-mute--off': bgmMuted }" @click="toggleBgmMute">
            {{ bgmMuted ? '🔇 已静音' : '🔊 开启' }}
          </button>
        </div>
        <label class="volume-row">
          <span class="volume-label">音量 {{ volumeLabel }}</span>
          <input
            v-model.number="bgmVolume"
            type="range"
            min="0"
            max="100"
            step="1"
            class="volume-slider"
            :disabled="bgmMuted"
            @input="persist"
          >
        </label>
      </div>

      <p v-if="saved" class="saved-hint">已保存</p>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #f6f4ef;
  color: #1f2522;
  padding: 16px 20px 32px;
  box-sizing: border-box;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.settings-header h1 {
  margin: 0;
  font-size: 24px;
  color: #a46d1f;
}

.btn-back {
  padding: 8px 14px;
  border: 1px solid #d8d2c4;
  border-radius: 8px;
  background: #fffdf8;
  cursor: pointer;
  font-size: 14px;
}

.settings-panel {
  max-width: 520px;
  background: #fffdf8;
  border: 1px solid #d8d2c4;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.setting-row--static {
  cursor: default;
}

.setting-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid #ece8df;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.setting-title {
  font-size: 17px;
  font-weight: bold;
}

.setting-desc {
  font-size: 13px;
  color: #69706b;
  line-height: 1.4;
}

.setting-toggle {
  width: 22px;
  height: 22px;
  accent-color: #a46d1f;
  flex-shrink: 0;
}

.btn-mute {
  padding: 8px 14px;
  border: 1px solid #d8d2c4;
  border-radius: 999px;
  background: #f6f4ef;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-mute--off {
  opacity: 0.75;
}

.volume-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.volume-label {
  font-size: 14px;
  color: #69706b;
}

.volume-slider {
  width: 100%;
  accent-color: #a46d1f;
}

.volume-slider:disabled {
  opacity: 0.45;
}

.saved-hint {
  margin: 0;
  font-size: 13px;
  color: #2f6f5e;
}
</style>
