<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  isYou?: boolean
  isCurrent?: boolean
  energy: number
  totalPower: number
  handCount: number
  deckCount: number
  fieldCardCount: number
  defaultCollapsed?: boolean
}>(), {
  isYou: false,
  isCurrent: false,
  defaultCollapsed: false,
})

const collapsed = ref(props.defaultCollapsed && !props.isYou)

function toggle() {
  if (!props.isYou) collapsed.value = !collapsed.value
}
</script>

<template>
  <div
    class="player-strip"
    :class="{
      'player-strip--you': isYou,
      'player-strip--current': isCurrent,
      'player-strip--collapsed': collapsed && !isYou,
    }"
  >
    <button
      v-if="!isYou"
      type="button"
      class="player-strip__toggle"
      @click="toggle"
    >
      <div class="player-strip__summary">
        <span class="player-strip__name">{{ name }}</span>
        <span v-if="isCurrent" class="player-strip__badge">回合中</span>
        <span class="stat-chip">⚡ {{ energy }}</span>
        <span class="stat-chip stat-chip--power">💪 {{ totalPower }}</span>
        <span class="stat-chip">场 {{ fieldCardCount }}</span>
      </div>
      <span class="player-strip__chevron">{{ collapsed ? '▼' : '▲' }}</span>
    </button>
    <div v-show="!collapsed || isYou" class="player-strip__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.player-strip {
  border-radius: var(--game-radius-lg);
  border: 1px solid var(--game-border);
  background: var(--game-bg-panel);
  overflow: hidden;
}

.player-strip--you {
  border-color: var(--game-human-dim);
}

.player-strip--current {
  box-shadow: 0 0 0 1px var(--game-accent-gold-dim);
}

.player-strip__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: var(--game-bg-table);
  border: none;
  color: var(--game-text-primary);
  cursor: pointer;
  font-family: inherit;
}

.player-strip__summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  text-align: left;
}

.player-strip__name {
  font-weight: 700;
  font-size: 14px;
}

.player-strip__badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--game-accent-gold-dim);
  color: var(--game-accent-gold);
}

.player-strip__chevron {
  font-size: 11px;
  color: var(--game-text-muted);
  flex-shrink: 0;
}

.player-strip__body {
  padding: 0 12px 12px;
}

.player-strip--collapsed .player-strip__body {
  display: none;
}
</style>
