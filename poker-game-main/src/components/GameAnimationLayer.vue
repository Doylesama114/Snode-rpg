<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Card } from '@/types/game'
import type { ReforgeOption } from '@/types/game'
import {
  useGameAnimations,
  getFlySelector,
  getHandSelector,
  getFlyOriginSelector,
  getHiddenCardSelector,
} from '@/composables/useGameAnimations'

const {
  animState,
  completeFly,
  completeReforge,
  completeFlip,
  FLY_MS,
  REFORGE_STEP_MS,
  FLIP_MS,
} = useGameAnimations()

const flyStyle = ref<Record<string, string>>({})
const flyVisible = ref(false)
const flyCard = ref<Card | null>(null)
const flyBack = ref(false)

const flipStyle = ref<Record<string, string>>({})
const flipVisible = ref(false)
const flipCard = ref<Card | null>(null)
const flipPhase = ref<'back' | 'flipping' | 'front'>('back')

const reforgeStep = ref(0)
const reforgeVisible = ref(false)
const reforgePos = ref({ x: 0, y: 0 })

const REFORGE_LABELS: Record<ReforgeOption, string> = {
  gainCost: '⚡ +2 费用',
  redraw: '🔄 换牌',
  gainPower: '💪 战力 +1',
}

const landFlashKey = computed(() => {
  const f = animState.landFlash
  return f ? `${f.fieldOwnerId}-${f.slotIndex}` : null
})

function cardMini(card: Card) {
  return {
    name: card.name,
    cost: card.cost,
    power: card.type === 'unit' ? card.basePower : null,
    type: card.type,
  }
}

watch(
  () => animState.flying,
  (payload) => {
    if (!payload) {
      flyVisible.value = false
      return
    }
    startFly(payload)
  },
)

watch(
  () => animState.reforge,
  (payload) => {
    if (!payload) {
      reforgeVisible.value = false
      return
    }
    startReforge(payload.playerId, payload.options)
  },
)

watch(
  () => animState.flipping,
  (payload) => {
    if (!payload) {
      flipVisible.value = false
      return
    }
    startFlip(payload)
  },
)

function startFlip(payload: NonNullable<typeof animState.flipping>) {
  const originSel = payload.hiddenOriginId
    ? getHiddenCardSelector(payload.hiddenOriginId)
    : getFlySelector(payload.fieldOwnerId, payload.slotIndex)
  const slotEl = document.querySelector(originSel)
  if (!slotEl) {
    completeFlip()
    return
  }

  const rect = slotEl.getBoundingClientRect()
  const w = Math.min(120, rect.width || 100)
  const h = Math.min(160, rect.height || 140)

  flipCard.value = payload.card
  flipPhase.value = 'back'
  flipVisible.value = true

  flipStyle.value = {
    width: `${w}px`,
    height: `${h}px`,
    left: `${rect.left + rect.width / 2 - w / 2}px`,
    top: `${rect.top + rect.height / 2 - h / 2}px`,
  }

  requestAnimationFrame(() => {
    flipPhase.value = 'flipping'
  })

  setTimeout(() => {
    flipPhase.value = 'front'
    flipVisible.value = false
    completeFlip()
  }, FLIP_MS + 40)
}

function startFly(payload: NonNullable<typeof animState.flying>) {
  const fromSel = payload.handIndex !== undefined
    ? getHandSelector(payload.playerId, payload.handIndex)
    : getFlyOriginSelector(payload.playerId)
  const toSel = getFlySelector(payload.fieldOwnerId, payload.slotIndex)
  const fromEl = document.querySelector(fromSel)
  const toEl = document.querySelector(toSel)
  if (!fromEl || !toEl) {
    completeFly()
    return
  }

  const from = fromEl.getBoundingClientRect()
  const to = toEl.getBoundingClientRect()
  const w = Math.min(120, from.width || 100)
  const h = Math.min(160, from.height || 140)

  flyCard.value = payload.card ?? null
  flyBack.value = !!payload.showBack
  flyVisible.value = true

  const startX = from.left + from.width / 2 - w / 2
  const startY = from.top + from.height / 2 - h / 2
  const endX = to.left + to.width / 2 - w / 2
  const endY = to.top + to.height / 2 - h / 2

  flyStyle.value = {
    width: `${w}px`,
    height: `${h}px`,
    left: `${startX}px`,
    top: `${startY}px`,
    transform: 'scale(1) rotate(0deg)',
    opacity: '1',
    transition: 'none',
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flyStyle.value = {
        width: `${w}px`,
        height: `${h}px`,
        left: `${endX}px`,
        top: `${endY}px`,
        transform: 'scale(0.92) rotate(-4deg)',
        opacity: '1',
        transition: `left ${FLY_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), top ${FLY_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), transform ${FLY_MS}ms ease-out`,
      }
    })
  })

  setTimeout(() => {
    flyVisible.value = false
    completeFly()
  }, FLY_MS + 40)
}

async function startReforge(playerId: string, options: ReforgeOption[]) {
  const origin = document.querySelector(getFlyOriginSelector(playerId))
    ?? document.querySelector(`[data-player-id="${playerId}"]`)
  const rect = origin?.getBoundingClientRect()
  reforgePos.value = {
    x: (rect?.left ?? window.innerWidth / 2) + (rect?.width ?? 0) / 2,
    y: (rect?.top ?? 200) + 40,
  }
  reforgeVisible.value = true
  reforgeStep.value = 0

  for (let i = 0; i < options.length; i++) {
    reforgeStep.value = i
    await new Promise(r => setTimeout(r, REFORGE_STEP_MS))
  }

  reforgeVisible.value = false
  completeReforge()
}

defineExpose({ landFlashKey })
</script>

<template>
  <Teleport to="body">
    <div v-if="flyVisible" class="fly-layer">
      <div class="fly-card" :style="flyStyle" :class="{ 'is-back': flyBack }">
        <template v-if="flyBack || !flyCard">
          <div class="card-back-art">?</div>
        </template>
        <template v-else>
          <div class="fly-name">{{ flyCard.name }}</div>
          <div class="fly-meta">⚡{{ flyCard.cost }}</div>
        </template>
      </div>
    </div>

    <div v-if="reforgeVisible && animState.reforge" class="reforge-layer" :style="{ left: reforgePos.x + 'px', top: reforgePos.y + 'px' }">
      <div
        v-for="(opt, i) in animState.reforge.options"
        :key="opt + i"
        class="reforge-burst"
        :class="{ active: i <= reforgeStep, [`opt-${opt}`]: true }"
      >
        {{ REFORGE_LABELS[opt] }}
      </div>
    </div>
    <div v-if="flipVisible && flipCard" class="fly-layer">
      <div class="flip-scene" :style="flipStyle">
        <div class="flip-inner" :class="{ 'is-flipped': flipPhase !== 'back' }">
          <div class="flip-face flip-back">
            <div class="card-back-art">?</div>
          </div>
          <div class="flip-face flip-front">
            <div class="fly-name">{{ flipCard.name }}</div>
            <div class="fly-meta">⚡{{ flipCard.cost }}</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fly-layer,
.reforge-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 6000;
}

.flip-scene {
  position: fixed;
  perspective: 800px;
}

.flip-inner {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.48s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flip-inner.is-flipped {
  transform: rotateY(180deg);
}

.flip-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  box-sizing: border-box;
  box-shadow: 0 12px 32px rgba(31, 37, 34, 0.35);
}

.flip-back {
  background: linear-gradient(145deg, #4a3728 0%, #2a1f18 100%);
  border: 2px solid #8a5718;
}

.flip-front {
  background: linear-gradient(145deg, #fffdf8 0%, #e8e4da 100%);
  border: 2px solid #a46d1f;
  transform: rotateY(180deg);
}

.fly-card {
  position: fixed;
  background: linear-gradient(145deg, #fffdf8 0%, #e8e4da 100%);
  border: 2px solid #a46d1f;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(31, 37, 34, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  box-sizing: border-box;
  will-change: transform, left, top;
}

.fly-card.is-back {
  background: linear-gradient(145deg, #4a3728 0%, #2a1f18 100%);
  border-color: #8a5718;
}

.card-back-art {
  font-size: 36px;
  font-weight: bold;
  color: #d4a574;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.fly-name {
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  line-height: 1.2;
}

.fly-meta {
  font-size: 11px;
  margin-top: 4px;
  color: #a46d1f;
}

.reforge-layer {
  position: fixed;
  transform: translate(-50%, 0);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.reforge-burst {
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: bold;
  font-size: 15px;
  opacity: 0;
  transform: scale(0.6) translateY(8px);
  transition: all 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
  box-shadow: 0 6px 20px rgba(31, 37, 34, 0.2);
  background: #fffdf8;
  border: 2px solid #d8d2c4;
  white-space: nowrap;
}

.reforge-burst.active {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.reforge-burst.opt-gainCost.active {
  border-color: #a46d1f;
  color: #a46d1f;
}

.reforge-burst.opt-redraw.active {
  border-color: #315f8f;
  color: #315f8f;
}

.reforge-burst.opt-gainPower.active {
  border-color: #9d2f2f;
  color: #9d2f2f;
}
</style>
