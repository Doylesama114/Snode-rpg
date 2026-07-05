<template>
  <router-view/>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { handleGlobalEscape } from '@/utils/escNavigation'
import { syncRouteBgm, stopBgm } from '@/utils/gameBgm'

const router = useRouter()
const route = useRoute()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleGlobalEscape(router)
  }
}

watch(() => route.path, path => syncRouteBgm(path), { immediate: true })

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  stopBgm()
})
</script>
