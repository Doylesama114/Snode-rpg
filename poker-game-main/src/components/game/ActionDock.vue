<script setup lang="ts">
defineProps<{ visible?: boolean }>()
</script>

<template>
  <footer v-if="visible !== false" class="action-dock">
    <div class="action-dock__inner">
      <slot />
    </div>
  </footer>
</template>

<style scoped>
.action-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  padding: 8px 12px max(8px, env(safe-area-inset-bottom));
  background: linear-gradient(0deg, rgba(14, 12, 10, 0.98) 0%, rgba(14, 12, 10, 0.88) 100%);
  border-top: 1px solid var(--game-border);
  backdrop-filter: blur(10px);
}

.action-dock__inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.action-dock__inner :deep(.action-dock-row) {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.action-dock__inner :deep(.action-dock-hint) {
  font-size: 12px;
  color: var(--game-text-secondary);
  text-align: center;
  width: 100%;
}

.action-dock__inner :deep(.action-dock-branch) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--game-radius-md);
  background: var(--game-human-dim);
  border: 1px solid rgba(61, 155, 122, 0.35);
}
</style>
