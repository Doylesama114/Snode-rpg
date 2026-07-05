import { ref, nextTick } from 'vue'
import type { Card } from '@/types/game'

const VIEWPORT_MARGIN = 8
const EST_WIDTH = 320
const EST_HEIGHT = 420

/** 场上卡牌悬停/点击查看详情（Teleport 到 body，避免被 overflow 裁切） */
export function useFieldCardDetail() {
  const hoveredCardKey = ref<string | null>(null)
  const hoveredCard = ref<Card | null>(null)
  const hoverStyle = ref<Record<string, string>>({})
  const pinnedCard = ref<Card | null>(null)

  function fieldCardKey(playerId: string, slotKey: string | number) {
    return `${playerId}-${slotKey}`
  }

  function clampHoverPosition(rect: DOMRect) {
    const vw = window.innerWidth
    const vh = window.innerHeight

    let placeBelow = rect.top < EST_HEIGHT + VIEWPORT_MARGIN
    if (!placeBelow && rect.bottom + EST_HEIGHT + VIEWPORT_MARGIN > vh) {
      placeBelow = rect.top < vh - rect.bottom
    }

    let top = placeBelow ? rect.bottom + VIEWPORT_MARGIN : rect.top - VIEWPORT_MARGIN
    let left = rect.left + rect.width / 2
    let transform = placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'

    const halfW = EST_WIDTH / 2
    left = Math.max(VIEWPORT_MARGIN + halfW, Math.min(vw - VIEWPORT_MARGIN - halfW, left))

    if (placeBelow) {
      top = Math.min(top, vh - EST_HEIGHT - VIEWPORT_MARGIN)
    } else {
      top = Math.max(EST_HEIGHT + VIEWPORT_MARGIN, top)
    }

    return { top, left, transform }
  }

  function applyMeasuredClamp(key: string) {
    nextTick(() => {
      if (hoveredCardKey.value !== key) return
      const el = document.querySelector('.field-hover-popover') as HTMLElement | null
      if (!el) return
      const pop = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      let top = parseFloat(hoverStyle.value.top || '0')
      let left = parseFloat(hoverStyle.value.left || '0')
      const transform = hoverStyle.value.transform || ''

      if (transform.includes('-100%')) {
        if (top - pop.height < VIEWPORT_MARGIN) {
          top = VIEWPORT_MARGIN + pop.height
        }
      } else if (top + pop.height > vh - VIEWPORT_MARGIN) {
        top = vh - pop.height - VIEWPORT_MARGIN
      }

      const halfW = pop.width / 2
      left = Math.max(VIEWPORT_MARGIN + halfW, Math.min(vw - VIEWPORT_MARGIN - halfW, left))

      hoverStyle.value = {
        ...hoverStyle.value,
        top: `${top}px`,
        left: `${left}px`,
      }
    })
  }

  function onFieldCardEnter(e: MouseEvent, playerId: string, slotKey: string | number, card: Card) {
    const key = fieldCardKey(playerId, slotKey)
    hoveredCardKey.value = key
    hoveredCard.value = card
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const { top, left, transform } = clampHoverPosition(rect)
    hoverStyle.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      transform,
      zIndex: '5000',
      pointerEvents: 'none',
    }
    applyMeasuredClamp(key)
  }

  function onFieldCardLeave(playerId: string, slotKey: string | number) {
    const key = fieldCardKey(playerId, slotKey)
    if (hoveredCardKey.value === key) {
      hoveredCardKey.value = null
      hoveredCard.value = null
    }
  }

  /** blockWhen 为 true 时不打开详情（例如正在选部署格） */
  function onFieldCardClick(card: Card, e: MouseEvent, blockWhen?: () => boolean) {
    if (blockWhen?.()) return
    e.stopPropagation()
    pinnedCard.value = card
  }

  function closePinned() {
    pinnedCard.value = null
  }

  function clearHover() {
    hoveredCardKey.value = null
    hoveredCard.value = null
  }

  return {
    hoveredCardKey,
    hoveredCard,
    hoverStyle,
    pinnedCard,
    fieldCardKey,
    onFieldCardEnter,
    onFieldCardLeave,
    onFieldCardClick,
    closePinned,
    clearHover,
  }
}
