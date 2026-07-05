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
  background: #fffdf8;
  border: 2px solid #a46d1f;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 8px 28px rgba(31, 37, 34, 0.22);
  pointer-events: none;
  text-align: left;
  color: #1f2522;
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
  border-bottom: 1px solid #e8e4da;
  padding-bottom: 6px;
}

.popover-name {
  font-size: 15px;
  font-weight: 700;
}

.popover-type {
  font-size: 11px;
  color: #a46d1f;
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
  background: #f6f4ef;
  border: 1px solid #d8d2c4;
  border-radius: 6px;
  padding: 2px 8px;
}

.meta-sub {
  color: #69706b;
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
  color: #69706b;
  margin-right: 2px;
}

.kw-tag {
  font-size: 10px;
  background: #e8f0ed;
  color: #2f6f5e;
  border-radius: 4px;
  padding: 1px 6px;
}

.effects-title {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #a46d1f;
}

.effect-block {
  background: #f6f4ef;
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
  color: #2f6f5e;
  font-weight: 600;
}

.effect-type {
  color: #69706b;
}

.effect-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #1f2522;
}
</style>
