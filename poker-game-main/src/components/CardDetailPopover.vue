<script setup lang="ts">
import type { Card } from '@/types/game'
import { formatCardEffects, getCardTypeLabel } from '@/utils/cardDisplay'

withDefaults(defineProps<{
  card: Card
  variant?: 'popover' | 'modal'
}>(), { variant: 'popover' })
</script>

<template>
  <div class="card-detail-popover" :class="{ modal: variant === 'modal' }" @click.stop>
    <div class="popover-header">
      <span class="popover-name">{{ card.name }}</span>
      <span class="popover-type">{{ getCardTypeLabel(card.type) }}</span>
    </div>
    <div class="popover-meta">
      <span class="meta-chip">属性 {{ card.attribute }}</span>
      <span class="meta-chip">费用 ⚡{{ card.cost }}</span>
      <span v-if="card.type === 'unit' || card.type === 'environment'" class="meta-chip">
        战力 💪{{ card.currentPower }}
        <span v-if="card.currentPower !== card.basePower" class="meta-sub">(基础 {{ card.basePower }})</span>
      </span>
    </div>
    <div v-if="card.keywords?.length" class="popover-keywords">
      <span class="kw-label">关键词</span>
      <span v-for="kw in card.keywords" :key="kw" class="kw-tag">{{ kw }}</span>
    </div>
    <div class="popover-effects">
      <div class="effects-title">卡牌效果</div>
      <div v-for="(eff, i) in formatCardEffects(card.effects)" :key="i" class="effect-block">
        <div class="effect-head">
          <span class="effect-timing">{{ eff.timing }}</span>
          <span class="effect-type">{{ eff.type }}</span>
        </div>
        <p class="effect-desc">{{ eff.description }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-detail-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  z-index: 1500;
  min-width: 260px;
  max-width: 320px;
  background: var(--game-bg-panel-elevated);
  border: 1px solid var(--game-border-strong);
  border-radius: var(--game-radius-md);
  padding: 12px 14px;
  box-shadow: var(--game-shadow-lift);
  pointer-events: none;
  text-align: left;
  color: var(--game-text-primary);
  font-family: var(--game-font-ui);
}

.card-detail-popover.modal {
  position: relative;
  left: auto;
  bottom: auto;
  transform: none;
  pointer-events: auto;
  min-width: 280px;
  max-width: 420px;
  max-height: 70vh;
  overflow-y: auto;
}

.popover-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--game-border);
  padding-bottom: 6px;
}

.popover-name {
  font-size: 15px;
  font-weight: 700;
}

.popover-type {
  font-size: 11px;
  color: var(--game-accent-gold);
  font-weight: 600;
  white-space: nowrap;
}

.popover-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.meta-chip {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--game-border);
  border-radius: 6px;
  padding: 2px 8px;
}

.meta-sub {
  color: var(--game-text-muted);
  font-size: 10px;
}

.popover-keywords {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}

.kw-label {
  font-size: 11px;
  color: var(--game-text-muted);
  margin-right: 2px;
}

.kw-tag {
  font-size: 10px;
  background: var(--game-human-dim);
  color: var(--game-human);
  border-radius: 4px;
  padding: 1px 6px;
}

.effects-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--game-accent-gold);
}

.effect-block {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 6px;
}

.effect-block:last-child {
  margin-bottom: 0;
}

.effect-head {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 10px;
}

.effect-timing {
  color: var(--game-human);
  font-weight: 600;
}

.effect-type {
  color: var(--game-text-muted);
}

.effect-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--game-text-primary);
}
</style>
