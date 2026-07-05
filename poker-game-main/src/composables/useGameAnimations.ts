import { reactive, readonly } from 'vue'
import type { Card, ReforgeOption } from '@/types/game'
import { shouldSkipAnimations } from '@/utils/gameSettings'

export interface FlyCardPayload {
  kind: 'deploy' | 'hidden' | 'tactic'
  card?: Card
  playerId: string
  slotIndex: number
  fieldOwnerId: string
  handIndex?: number
  showBack?: boolean
}

export interface ReforgeAnimPayload {
  playerId: string
  options: ReforgeOption[]
}

export interface LandFlashPayload {
  fieldOwnerId: string
  slotIndex: number
}

interface AnimationState {
  flying: FlyCardPayload | null
  reforge: ReforgeAnimPayload | null
  landFlash: LandFlashPayload | null
  onFlyComplete: (() => void) | null
  onReforgeComplete: (() => void) | null
}

const state = reactive<AnimationState>({
  flying: null,
  reforge: null,
  landFlash: null,
  onFlyComplete: null,
  onReforgeComplete: null,
})

const FLY_MS = 520
const REFORGE_STEP_MS = 380
const LAND_FLASH_MS = 320

export function getFlySelector(fieldOwnerId: string, slotIndex: number) {
  return `[data-field-slot="${fieldOwnerId}-${slotIndex}"]`
}

export function getHandSelector(playerId: string, handIndex: number) {
  return `[data-hand-card="${playerId}-${handIndex}"]`
}

export function getFlyOriginSelector(playerId: string) {
  return `[data-fly-origin="${playerId}"]`
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function measureCenter(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  return el.getBoundingClientRect()
}

export function useGameAnimations() {
  function resetAnimations() {
    state.flying = null
    state.reforge = null
    state.landFlash = null
    state.onFlyComplete = null
    state.onReforgeComplete = null
  }

  function completeFly() {
    const cb = state.onFlyComplete
    state.flying = null
    state.onFlyComplete = null
    cb?.()
  }

  function completeReforge() {
    const cb = state.onReforgeComplete
    state.reforge = null
    state.onReforgeComplete = null
    cb?.()
  }

  function flashLand(fieldOwnerId: string, slotIndex: number) {
    if (shouldSkipAnimations()) return Promise.resolve()
    state.landFlash = { fieldOwnerId, slotIndex }
    return wait(LAND_FLASH_MS).then(() => {
      state.landFlash = null
    })
  }

  async function playCardFly(payload: FlyCardPayload): Promise<void> {
    if (shouldSkipAnimations()) return

    const fromSel = payload.handIndex !== undefined
      ? getHandSelector(payload.playerId, payload.handIndex)
      : getFlyOriginSelector(payload.playerId)
    const toSel = getFlySelector(payload.fieldOwnerId, payload.slotIndex)

    if (!measureCenter(fromSel) || !measureCenter(toSel)) {
      return
    }

    return new Promise<void>(resolve => {
      state.onFlyComplete = resolve
      state.flying = payload
    })
  }

  async function playReforge(payload: ReforgeAnimPayload): Promise<void> {
    if (shouldSkipAnimations()) return

    return new Promise<void>(resolve => {
      state.onReforgeComplete = resolve
      state.reforge = payload
    })
  }

  function getFlyDuration() {
    return shouldSkipAnimations() ? 0 : FLY_MS
  }

  function getReforgeDuration(options: ReforgeOption[]) {
    return shouldSkipAnimations() ? 0 : options.length * REFORGE_STEP_MS
  }

  return {
    animState: readonly(state),
    resetAnimations,
    completeFly,
    completeReforge,
    playCardFly,
    playReforge,
    flashLand,
    wait,
    getFlyDuration,
    getReforgeDuration,
    FLY_MS,
    REFORGE_STEP_MS,
    LAND_FLASH_MS,
    measureCenter,
    getFlySelector,
    getHandSelector,
    getFlyOriginSelector,
  }
}
