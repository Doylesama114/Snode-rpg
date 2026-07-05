<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadGameSettings, saveGameSettings } from '@/utils/gameSettings'
import { registerEscHandler } from '@/utils/escNavigation'

const router = useRouter()
const skipAnimations = ref(false)
const saved = ref(false)

let unregisterEsc: (() => void) | undefined

onMounted(() => {
  skipAnimations.value = loadGameSettings().skipAnimations
  unregisterEsc = registerEscHandler(() => false)
})

onUnmounted(() => {
  unregisterEsc?.()
})

function goBack() {
  router.replace('/')
}

function persist() {
  saveGameSettings({ skipAnimations: skipAnimations.value })
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
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
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.saved-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: #2f6f5e;
}
</style>
