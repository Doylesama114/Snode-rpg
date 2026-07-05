<template>
  <router-view/>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { handleGlobalEscape } from '@/utils/escNavigation'

const router = useRouter()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleGlobalEscape(router)
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>
