import { reactive, readonly } from 'vue'
import type { Card, ReforgeOption } from '@/types/game'
import { shouldSkipAnimations } from '@/utils/gameSettings'
import { fieldAnimKey } from '@/utils/fieldAnimationDiff'
import type { FieldAnimEvent, DrawAnimEvent } from '@/utils/fieldAnimationDiff'
import type { FloatKind } from '@/utils/parseCombatFloats'

export type FlyKind =
  | 'deploy'
  | 'hidden'
  | 'tactic'
  | 'tactic-fade'
  | 'draw'
  | 'reforge-out'
  | 'reforge-in'
  | 'absorb'

export interface FlyCardPayload {
  kind: FlyKind
  card?: Card
  playerId: string
  fieldOwnerId?: string
  slotIndex?: number
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

export interface FlipRevealPayload {
  fieldOwnerId: string
  slotIndex: number
  card: Card
  hiddenOriginId?: string
}

export interface FloatTextPayload {
  kind: FloatKind
  text: string
  playerId: string
  slotIndex?: number
}

interface AnimationState {
  flying: FlyCardPayload | null
  reforge: ReforgeAnimPayload | null
  landFlash: LandFlashPayload | null
  flipping: FlipRevealPayload | null
  floatTexts: FloatTextPayload[]
  onFlyComplete: (() => void) | null
  onReforgeComplete: (() => void) | null
  onFlipComplete: (() => void) | null
}

const state = reactive<AnimationState>({
  flying: null,
  reforge: null,
  landFlash: null,
  flipping: null,
  floatTexts: [],
  onFlyComplete: null,
  onReforgeComplete: null,
  onFlipComplete: null,
})

const FLY_MS = 520
const REFORGE_STEP_MS = 380
const LAND_FLASH_MS = 320
const FLIP_MS = 480
const FLOAT_MS = 1200
const DRAW_MS = 480

export function getFlySelector(fieldOwnerId: string, slotIndex: number) {
  return `[data-field-slot="${fieldOwnerId}-${slotIndex}"]`
}

export function getHandSelector(playerId: string, handIndex: number) {
  return `[data-hand-card="${playerId}-${handIndex}"]`
}

export function getFlyOriginSelector(playerId: string) {
  return `[data-fly-origin="${playerId}"]`
}

export function getHiddenCardSelector(hiddenOriginId: string) {
  return `[data-hidden-card="${hiddenOriginId}"]`
}

export function getDeckZoneSelector(playerId: string) {
  return `[data-deck-zone="${playerId}"]`
}

export function getHandZoneSelector(playerId: string) {
  return `[data-hand-zone="${playerId}"]`
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function measureCenter(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  return el.getBoundingClientRect()
}

function resolveFlyFromSelector(payload: FlyCardPayload): string | null {
  const { kind, playerId, handIndex } = payload
  if (kind === 'draw' || kind === 'reforge-in') {
    return getDeckZoneSelector(playerId)
  }
  if (handIndex !== undefined) {
    return getHandSelector(playerId, handIndex)
  }
  return getFlyOriginSelector(playerId)
}

function resolveFlyToSelector(payload: FlyCardPayload): string | null {
  const { kind, playerId, fieldOwnerId, slotIndex, handIndex } = payload

  if (kind === 'draw' || kind === 'reforge-in') {
    if (handIndex !== undefined && document.querySelector(getHandSelector(playerId, handIndex))) {
      return getHandSelector(playerId, handIndex)
    }
    const handZone = getHandZoneSelector(playerId)
    if (document.querySelector(handZone)) return handZone
    return getFlyOriginSelector(playerId)
  }

  if (kind === 'reforge-out') {
    return getDeckZoneSelector(playerId)
  }

  if (kind === 'tactic-fade') {
    return getFlyOriginSelector(playerId)
  }

  if (kind === 'absorb' || kind === 'deploy' || kind === 'hidden' || kind === 'tactic') {
    if (fieldOwnerId !== undefined && slotIndex !== undefined) {
      return getFlySelector(fieldOwnerId, slotIndex)
    }
  }

  return getFlyOriginSelector(playerId)
}

export function useGameAnimations() {
  function resetAnimations() {
    state.flying = null
    state.reforge = null
    state.landFlash = null
    state.flipping = null
    state.floatTexts = []
    state.onFlyComplete = null
    state.onReforgeComplete = null
    state.onFlipComplete = null
  }

  function completeFlip() {
    const cb = state.onFlipComplete
    state.flipping = null
    state.onFlipComplete = null
    cb?.()
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

    const fromSel = resolveFlyFromSelector(payload)
    const toSel = resolveFlyToSelector(payload)

    if (!fromSel || !toSel || !measureCenter(fromSel) || !measureCenter(toSel)) {
      return
    }

    return new Promise<void>(resolve => {
      state.onFlyComplete = resolve
      state.flying = payload
    })
  }

  async function playDrawCard(payload: {
    playerId: string
    handIndex?: number
    card?: Card
    showBack?: boolean
  }): Promise<void> {
    return playCardFly({
      kind: 'draw',
      playerId: payload.playerId,
      handIndex: payload.handIndex,
      card: payload.card,
      showBack: payload.showBack,
    })
  }

  async function playReforgeRedraw(payload: {
    playerId: string
    handIndex: number
    oldCard?: Card
  }): Promise<void> {
    await playCardFly({
      kind: 'reforge-out',
      playerId: payload.playerId,
      handIndex: payload.handIndex,
      card: payload.oldCard,
    })
  }

  async function playFloatTexts(items: FloatTextPayload[]): Promise<void> {
    if (shouldSkipAnimations() || !items.length) return
    state.floatTexts = items
    await wait(FLOAT_MS)
    state.floatTexts = []
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

  async function playFlipReveal(payload: FlipRevealPayload): Promise<void> {
    if (shouldSkipAnimations()) return

    const slotSel = getFlySelector(payload.fieldOwnerId, payload.slotIndex)
    if (!measureCenter(slotSel)) return

    return new Promise<void>(resolve => {
      state.onFlipComplete = resolve
      state.flipping = payload
    })
  }

  async function playDrawEvents(
    events: DrawAnimEvent[],
    skipKeys: Set<string>,
  ): Promise<void> {
    for (const ev of events) {
      const key = `draw-${ev.playerId}-${ev.handIndex}`
      if (skipKeys.has(key)) continue
      await playDrawCard({
        playerId: ev.playerId,
        handIndex: ev.handIndex,
        card: ev.card,
        showBack: ev.showBack,
      })
    }
  }

  async function playFieldEvents(
    events: FieldAnimEvent[],
    skipKeys: Set<string>,
  ): Promise<void> {
    for (const ev of events) {
      const key = fieldAnimKey(ev)
      if (skipKeys.has(key)) continue
      if (ev.type === 'fly') {
        await playCardFly({
          kind: ev.showBack ? 'hidden' : 'deploy',
          card: ev.card,
          playerId: ev.playerId,
          fieldOwnerId: ev.fieldOwnerId,
          slotIndex: ev.slotIndex,
          handIndex: ev.handIndex,
          showBack: ev.showBack,
        })
        await flashLand(ev.fieldOwnerId, ev.slotIndex)
      } else {
        await playFlipReveal({
          fieldOwnerId: ev.fieldOwnerId,
          slotIndex: ev.slotIndex,
          card: ev.card,
        })
      }
    }
  }

  function getFlipDuration() {
    return shouldSkipAnimations() ? 0 : FLIP_MS
  }

  return {
    animState: readonly(state),
    resetAnimations,
    completeFly,
    completeReforge,
    completeFlip,
    playCardFly,
    playDrawCard,
    playReforgeRedraw,
    playFloatTexts,
    playReforge,
    playFlipReveal,
    playFieldEvents,
    playDrawEvents,
    flashLand,
    wait,
    getFlyDuration,
    getReforgeDuration,
    getFlipDuration,
    FLY_MS,
    DRAW_MS,
    REFORGE_STEP_MS,
    LAND_FLASH_MS,
    FLIP_MS,
    FLOAT_MS,
    measureCenter,
    getFlySelector,
    getHandSelector,
    getFlyOriginSelector,
    getHiddenCardSelector,
    getDeckZoneSelector,
    getHandZoneSelector,
  }
}
