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
  getDeckZoneSelector,
  getHandZoneSelector,
} from '@/composables/useGameAnimations'

const {
  animState,
  completeFly,
  completeReforge,
  completeFlip,
  FLY_MS,
  DRAW_MS,
  REFORGE_STEP_MS,
  FLIP_MS,
  FLOAT_MS,
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

const floatStyles = ref<Array<{ style: Record<string, string>; kind: string; text: string }>>([])

const REFORGE_LABELS: Record<ReforgeOption, string> = {
  gainCost: '⚡ +2 费用',
  redraw: '🔄 换牌',
  gainPower: '💪 战力 +1',
}

const landFlashKey = computed(() => {
  const f = animState.landFlash
  return f ? `${f.fieldOwnerId}-${f.slotIndex}` : null
})

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

watch(
  () => animState.floatTexts,
  (items) => {
    if (!items.length) {
      floatStyles.value = []
      return
    }
    layoutFloats(items)
  },
)

function layoutFloats(items: typeof animState.floatTexts) {
  const styles: typeof floatStyles.value = []
  items.forEach((item, i) => {
    const anchor = item.slotIndex !== undefined
      ? document.querySelector(getFlySelector(item.playerId, item.slotIndex))
      : document.querySelector(getFlyOriginSelector(item.playerId))
    const rect = anchor?.getBoundingClientRect()
    const x = (rect?.left ?? window.innerWidth / 2) + (rect?.width ?? 0) / 2
    const y = (rect?.top ?? 120) - 8 - i * 28
    styles.push({
      kind: item.kind,
      text: item.text,
      style: {
        left: `${x}px`,
        top: `${y}px`,
        animationDelay: `${i * 80}ms`,
      },
    })
  })
  floatStyles.value = styles
}

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

function resolveFlyEndpoints(payload: NonNullable<typeof animState.flying>) {
  const { kind, playerId, fieldOwnerId, slotIndex, handIndex } = payload

  if (kind === 'draw' || kind === 'reforge-in') {
    const fromEl = document.querySelector(getDeckZoneSelector(playerId))
    const toSel = handIndex !== undefined && document.querySelector(getHandSelector(playerId, handIndex))
      ? getHandSelector(playerId, handIndex)
      : getHandZoneSelector(playerId)
    return { fromEl, toEl: document.querySelector(toSel) }
  }

  if (kind === 'reforge-out') {
    const fromSel = handIndex !== undefined
      ? getHandSelector(playerId, handIndex)
      : getHandZoneSelector(playerId)
    return {
      fromEl: document.querySelector(fromSel),
      toEl: document.querySelector(getDeckZoneSelector(playerId)),
    }
  }

  if (kind === 'tactic-fade') {
    const fromSel = handIndex !== undefined
      ? getHandSelector(playerId, handIndex)
      : getFlyOriginSelector(playerId)
    const fromEl = document.querySelector(fromSel)
    const playerEl = document.querySelector(`[data-player-id="${playerId}"]`)
    return { fromEl, toEl: playerEl, fadeAtCenter: true }
  }

  const fromSel = handIndex !== undefined
    ? getHandSelector(playerId, handIndex)
    : getFlyOriginSelector(playerId)
  const toSel = fieldOwnerId !== undefined && slotIndex !== undefined
    ? getFlySelector(fieldOwnerId, slotIndex)
    : getFlyOriginSelector(playerId)

  return {
    fromEl: document.querySelector(fromSel),
    toEl: document.querySelector(toSel),
    shrink: kind === 'absorb',
  }
}

function startFly(payload: NonNullable<typeof animState.flying>) {
  const { fromEl, toEl, fadeAtCenter, shrink } = resolveFlyEndpoints(payload)
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
  let endX = to.left + to.width / 2 - w / 2
  let endY = to.top + to.height / 2 - h / 2

  if (fadeAtCenter) {
    endX = to.left + to.width / 2 - w / 2
    endY = to.top + to.height / 2 - h / 2
  }

  const duration = payload.kind === 'draw' || payload.kind === 'reforge-in' || payload.kind === 'reforge-out'
    ? DRAW_MS
    : FLY_MS

  const endScale = shrink ? '0.35' : fadeAtCenter ? '1.15' : '0.92'
  const endOpacity = fadeAtCenter ? '0' : '1'
  const endRotate = shrink ? '0deg' : fadeAtCenter ? '8deg' : '-4deg'

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
        transform: `scale(${endScale}) rotate(${endRotate})`,
        opacity: endOpacity,
        transition: `left ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), top ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), transform ${duration}ms ease-out, opacity ${duration}ms ease-out`,
      }
    })
  })

  setTimeout(() => {
    flyVisible.value = false
    completeFly()
  }, duration + 40)
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

    <div
      v-for="(ft, i) in floatStyles"
      :key="i"
      class="float-text"
      :class="`float-${ft.kind}`"
      :style="ft.style"
    >
      {{ ft.text }}
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

.float-text {
  position: fixed;
  transform: translate(-50%, -100%);
  pointer-events: none;
  z-index: 6100;
  font-weight: 800;
  font-size: 15px;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  animation: float-rise 1.2s ease-out forwards;
  white-space: nowrap;
}

.float-power {
  color: #c0392b;
}

.float-cost {
  color: #a46d1f;
}

.float-destroy {
  color: #7f1d1d;
}

@keyframes float-rise {
  0% {
    opacity: 0;
    transform: translate(-50%, 0) scale(0.85);
  }
  15% {
    opacity: 1;
    transform: translate(-50%, -12px) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -48px) scale(1);
  }
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
