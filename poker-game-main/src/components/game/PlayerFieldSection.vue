<script setup lang="ts">
import FieldSlot from './FieldSlot.vue'
import GameCard from './GameCard.vue'
import type { Card, FieldSlot as FieldSlotType, Player } from '@/types/game'

const props = defineProps<{
  player: Player
  playerIndex: number
  isHuman: boolean
  getHiddenAtSlot?: (slotIndex: number) => unknown
  hiddenDomKey?: (slotIndex: number) => string
  isSlotAvailable?: (slotIndex: number) => boolean
  isCrossSlotAvailable?: (slotIndex: number) => boolean
  isTargetSelectable?: (card: Card | null | undefined) => boolean
  selectedSlot?: number
  slotFlashKey: (slotIndex: number) => string | number
  isFlashing?: (slotIndex: number) => boolean
  isShaking?: (slotIndex: number) => boolean
  isBouncing?: (slotIndex: number) => boolean
  powerPulse?: (slotIndex: number) => 'up' | 'down' | null
  isFaceDownCard?: (card: Card | null | undefined) => boolean
}>()

function slotShowsCard(slot: FieldSlotType) {
  return !!slot.card && !props.isFaceDownCard?.(slot.card)
}

function slotShowsFaceDown(slot: FieldSlotType, idx: number) {
  if (slot.card && props.isFaceDownCard?.(slot.card)) return true
  return !slot.card && !!props.getHiddenAtSlot?.(idx)
}

const emit = defineEmits<{
  slotClick: [slot: FieldSlotType, slotIndex: number, ev: MouseEvent]
  extraSlotClick: [slotIndex: number]
  cardEnter: [ev: MouseEvent, slotKey: string | number, card: Card]
  cardLeave: [slotKey: string | number]
  cardClick: [card: Card, ev: MouseEvent]
}>()

function mainSlots() {
  return props.player.field.filter(s => !s.isExtra)
}

function slotIndexOf(slot: FieldSlotType) {
  return props.player.field.indexOf(slot)
}

function extraSlots(parentSi: number) {
  return props.player.field.filter(s => s.isExtra && s.parentSlot === parentSi)
}
</script>

<template>
  <div class="field-section">
    <div class="field-section__label">场上</div>
    <div class="field-grid">
      <FieldSlot
        v-for="(slot, si) in mainSlots()"
        :key="si"
        :slot-index="si"
        :slot-key="slotFlashKey(slotIndexOf(slot))"
        :card="slotShowsCard(slot) ? slot.card! : undefined"
        :face-down="slotShowsFaceDown(slot, slotIndexOf(slot))"
        :empty-label="isHuman ? String(si + 1) : '空'"
        :selectable="isHuman && !!isSlotAvailable?.(slotIndexOf(slot))"
        :selectable-cross="!!isCrossSlotAvailable?.(slotIndexOf(slot))"
        :target-selectable="isHuman && isTargetSelectable?.(slot.card)"
        :selected="isHuman && selectedSlot === slotIndexOf(slot)"
        :land-flash="!!isFlashing?.(slotIndexOf(slot))"
        :shaking="!!isShaking?.(slotIndexOf(slot))"
        :bouncing="!!isBouncing?.(slotIndexOf(slot))"
        :power-pulse="powerPulse?.(slotIndexOf(slot)) ?? null"
        @click="emit('slotClick', slot, slotIndexOf(slot), $event)"
      >
        <div
          v-if="slotShowsCard(slot)"
          class="field-card-hit"
          @mouseenter="emit('cardEnter', $event, si, slot.card!)"
          @mouseleave="emit('cardLeave', si)"
          @click.stop="emit('cardClick', slot.card!, $event)"
        />
        <div
          v-if="getHiddenAtSlot?.(slotIndexOf(slot))"
          class="field-hidden-marker"
          :data-hidden-card="hiddenDomKey?.(slotIndexOf(slot))"
        />
        <div v-if="extraSlots(si).length" class="extra-slots">
          <div
            v-for="extra in extraSlots(si)"
            :key="extra.position"
            class="extra-slot-wrap"
            :class="{ 'extra-slot-wrap--selectable': isHuman && isSlotAvailable?.(extra.position) }"
            @click.stop="emit('extraSlotClick', extra.position)"
          >
            <GameCard
              v-if="extra.card"
              :card="extra.card"
              size="mini"
              :power-pulse="powerPulse?.(extra.position) ?? null"
              @mouseenter="emit('cardEnter', $event, extra.position, extra.card!)"
              @mouseleave="emit('cardLeave', extra.position)"
              @click.stop="emit('cardClick', extra.card!, $event)"
            />
            <GameCard v-else size="mini" empty-label="额外" />
          </div>
        </div>
      </FieldSlot>
    </div>
  </div>
</template>

<style scoped>
.field-card-hit {
  position: absolute;
  inset: 4px;
  z-index: 2;
  cursor: pointer;
}

.field-hidden-marker {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.extra-slots {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--game-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.extra-slot-wrap {
  border-radius: var(--game-radius-sm);
  padding: 2px;
  border: 1px dashed transparent;
}

.extra-slot-wrap--selectable {
  border-color: var(--game-accent-gold);
  cursor: pointer;
}
</style>
