<script setup lang="ts">
import GameCard from './GameCard.vue'
import type { Card } from '@/types/game'

defineProps<{
  slotIndex: number
  slotKey: string | number
  card?: Card | null
  faceDown?: boolean
  emptyLabel?: string
  selectable?: boolean
  selectableCross?: boolean
  targetSelectable?: boolean
  selected?: boolean
  landFlash?: boolean
  bouncing?: boolean
  shaking?: boolean
  powerPulse?: 'up' | 'down' | null
}>()

const emit = defineEmits<{ click: [ev: MouseEvent] }>()
</script>

<template>
  <div
    class="field-slot"
    :data-field-slot="slotKey"
    :class="{
      'field-slot--selectable': selectable,
      'field-slot--cross': selectableCross,
      'field-slot--target': targetSelectable,
      'field-slot--selected': selected,
      'game-anim-land': landFlash,
      'game-anim-shake': shaking,
      'field-slot--bounce': bouncing,
    }"
    @click="emit('click', $event)"
  >
    <GameCard
      v-if="card"
      :card="card"
      size="field"
      :power-pulse="powerPulse"
    />
    <GameCard
      v-else-if="faceDown"
      size="field"
      face-down
    />
    <GameCard
      v-else
      size="field"
      :empty-label="emptyLabel || String(slotIndex + 1)"
    />
    <slot />
  </div>
</template>

<style scoped>
.field-slot {
  position: relative;
  border-radius: var(--game-radius-md);
  padding: 4px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid transparent;
  transition: transform 0.2s ease;
  min-height: 104px;
}

.field-slot--selectable {
  border-color: var(--game-accent-gold);
  animation: game-select-breathe 1.6s ease-in-out infinite;
  cursor: pointer;
}

.field-slot--cross {
  border-color: var(--game-cross);
  cursor: pointer;
}

.field-slot--target {
  border-color: var(--game-danger);
  cursor: pointer;
}

.field-slot--selected {
  box-shadow: 0 0 0 2px var(--game-accent-gold);
}

.field-slot--bounce {
  animation: game-slot-land 360ms cubic-bezier(0.34, 1.4, 0.64, 1);
}

.field-slot--selectable:hover,
.field-slot--cross:hover,
.field-slot--target:hover {
  transform: scale(1.03);
}
</style>
