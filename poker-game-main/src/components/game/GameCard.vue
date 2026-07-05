<script setup lang="ts">
import type { Card } from '@/types/game'
import { attributeClass, cardTypeLabel, powerColor } from '@/utils/gameUi'

withDefaults(defineProps<{
  card?: Card | null
  size?: 'hand' | 'field' | 'mini'
  faceDown?: boolean
  playable?: boolean
  disabled?: boolean
  selectable?: boolean
  selected?: boolean
  powerPulse?: 'up' | 'down' | null
  emptyLabel?: string
}>(), {
  size: 'hand',
  faceDown: false,
  playable: false,
  disabled: false,
  selectable: false,
  selected: false,
  powerPulse: null,
  emptyLabel: '',
})
</script>

<template>
  <div
    class="game-card"
    :class="[
      `game-card--${size}`,
      attributeClass(card?.attribute ?? '无'),
      {
        'game-card--face-down': faceDown,
        'game-card--playable': playable,
        'game-card--disabled': disabled,
        'game-card--selectable': selectable,
        'game-card--selected': selected,
        'game-card--empty': !card && !faceDown && emptyLabel,
      },
    ]"
  >
    <template v-if="faceDown">
      <div class="game-card__back">
        <div class="game-card__back-pattern" />
      </div>
    </template>
    <template v-else-if="card">
      <div class="game-card__top">
        <span class="game-card__cost">{{ card.cost }}</span>
        <span
          v-if="card.type === 'unit' || card.type === 'environment'"
          class="game-card__power"
          :class="{
            'game-anim-power-up': powerPulse === 'up',
            'game-anim-power-down': powerPulse === 'down',
          }"
          :style="{ color: powerColor(card) }"
        >{{ card.currentPower }}</span>
      </div>
      <div class="game-card__attr-bar" />
      <div class="game-card__name">{{ card.name }}</div>
      <div v-if="size === 'hand'" class="game-card__type">{{ cardTypeLabel(card.type) }}</div>
      <div v-if="size === 'hand' && card.keywords?.length" class="game-card__keywords">
        {{ card.keywords.slice(0, 2).join(' · ') }}
      </div>
    </template>
    <template v-else-if="emptyLabel">
      <span class="game-card__empty-label">{{ emptyLabel }}</span>
    </template>
  </div>
</template>

<style scoped>
.game-card {
  position: relative;
  background: var(--game-bg-card);
  color: var(--game-text-on-card);
  border-radius: var(--game-radius-md);
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: var(--game-shadow-card);
  overflow: hidden;
  flex-shrink: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  user-select: none;
}

.game-card--hand {
  width: var(--game-card-width-hand);
  min-height: 156px;
  padding: 8px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.game-card--field,
.game-card--mini {
  width: 100%;
  min-height: 96px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.game-card--playable {
  border-color: var(--game-accent-gold);
  box-shadow: 0 0 0 1px var(--game-accent-gold-dim), var(--game-shadow-card);
  cursor: pointer;
}

.game-card--playable:hover {
  transform: translateY(-6px);
  box-shadow: var(--game-shadow-lift);
}

.game-card--disabled {
  opacity: 0.55;
  filter: grayscale(0.35);
}

.game-card--selectable {
  border-color: var(--game-accent-gold);
  cursor: pointer;
}

.game-card--selected {
  border-color: var(--game-danger);
  box-shadow: 0 0 0 2px rgba(224, 85, 85, 0.35);
  transform: translateY(-4px);
}

.game-card--empty {
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed var(--game-border);
  box-shadow: none;
  min-height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 13px;
}

.game-card__cost {
  color: var(--game-energy);
}

.game-card__power {
  font-size: 15px;
}

.game-card__attr-bar {
  height: 3px;
  border-radius: 2px;
  width: 100%;
  margin: 2px 0 4px;
}

.attr-fire .game-card__attr-bar { background: var(--game-attr-fire); }
.attr-water .game-card__attr-bar { background: var(--game-attr-water); }
.attr-wind .game-card__attr-bar { background: var(--game-attr-wind); }
.attr-earth .game-card__attr-bar { background: var(--game-attr-earth); }
.attr-none .game-card__attr-bar { background: var(--game-attr-none); }

.game-card__name {
  font-weight: 700;
  font-size: 13px;
  line-height: 1.25;
  text-align: center;
  word-break: break-all;
}

.game-card--field .game-card__name,
.game-card--mini .game-card__name {
  font-size: 11px;
}

.game-card__type {
  font-size: 10px;
  text-align: center;
  color: var(--game-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.game-card__keywords {
  font-size: 10px;
  color: var(--game-text-muted);
  text-align: center;
  line-height: 1.2;
}

.game-card__empty-label {
  font-size: 12px;
  color: var(--game-text-muted);
}

.game-card__back {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, #3d2e22 0%, #1a1410 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-card__back-pattern {
  width: 70%;
  height: 80%;
  border: 2px solid rgba(196, 146, 58, 0.35);
  border-radius: 6px;
  background: repeating-linear-gradient(
    45deg,
    rgba(196, 146, 58, 0.08) 0,
    rgba(196, 146, 58, 0.08) 4px,
    transparent 4px,
    transparent 8px
  );
}
</style>
