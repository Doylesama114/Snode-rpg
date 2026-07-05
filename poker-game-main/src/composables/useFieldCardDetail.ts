import { ref } from 'vue'
import type { Card } from '@/types/game'

/** 场上卡牌悬停/点击查看详情（Teleport 到 body，避免被 overflow 裁切） */
export function useFieldCardDetail() {
  const hoveredCardKey = ref<string | null>(null)
  const hoveredCard = ref<Card | null>(null)
  const hoverStyle = ref<Record<string, string>>({})
  const pinnedCard = ref<Card | null>(null)

  function fieldCardKey(playerId: string, slotKey: string | number) {
    return `${playerId}-${slotKey}`
  }

  function onFieldCardEnter(e: MouseEvent, playerId: string, slotKey: string | number, card: Card) {
    hoveredCardKey.value = fieldCardKey(playerId, slotKey)
    hoveredCard.value = card
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    hoverStyle.value = {
      position: 'fixed',
      top: `${Math.max(8, rect.top - 8)}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translate(-50%, -100%)',
      zIndex: '5000',
      pointerEvents: 'none',
    }
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
