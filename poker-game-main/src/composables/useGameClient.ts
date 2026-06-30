// 客户端游戏逻辑 - 只负责显示和发送操作请求
// 游戏逻辑在服务器端执行

import { ref, computed } from 'vue'
import type { GameState, Card, ReforgeOption } from '@/types/game'

export function useGameClient() {
  // 游戏状态（从服务器接收）
  const gameState = ref<GameState | null>(null)
  
  // 本地UI状态
  const reforgeState = ref<{ active: boolean; selectedCard: number | null; hasChosen: boolean }>({
    active: false,
    selectedCard: null,
    hasChosen: false
  })
  
  const selectedCard = ref<Card | null>(null)
  const selectedSlot = ref<number | null>(null)
  const availableSlots = ref<number[]>([])
  const availableTargets = ref<Card[]>([])
  
  // 决策状态
  const myDecisionMade = ref(false)
  const opponentDecisionMade = ref(false)
  const bothDecisionsMade = computed(() => myDecisionMade.value && opponentDecisionMade.value)
  
  // 回合准备状态
  const myReady = ref(false)
  const opponentReady = ref(false)
  const bothPlayersReady = computed(() => myReady.value && opponentReady.value)
  
  // 计算属性
  const myPlayer = computed(() => gameState.value?.players[0] || null)
  const opponent = computed(() => gameState.value?.players[1] || null)
  const hasPlayedThisTurn = computed(() => myPlayer.value?.hasPlayedThisTurn || false)
  const canPlayExtra = computed(() => myPlayer.value?.canPlayExtra || false)
  
  // 更新游戏状态（从服务器接收）
  function updateGameState(newState: GameState) {
    console.log('[useGameClient] 更新游戏状态:', newState)
    gameState.value = newState
  }
  
  // 选择出牌（返回操作对象，由调用者发送到服务器）
  function choosePlay() {
    console.log('[useGameClient] choosePlay 被调用')
    console.log('[useGameClient] 设置 myDecisionMade = true')
    myDecisionMade.value = true
    reforgeState.value.active = false
    reforgeState.value.hasChosen = true
    
    return {
      type: 'choosePlay' as const
    }
  }
  
  // 选择重铸
  function chooseReforge() {
    console.log('[useGameClient] chooseReforge 被调用')
    console.log('[useGameClient] 设置 myDecisionMade = true')
    myDecisionMade.value = true
    reforgeState.value.active = true
    reforgeState.value.hasChosen = true
    
    return {
      type: 'chooseReforge' as const
    }
  }
  
  // 选择手牌准备打出
  function selectCardToPlay(cardIndex: number) {
    if (!gameState.value || !myPlayer.value) return false
    if (reforgeState.value.active) return false
    if (myPlayer.value.hasPlayedThisTurn && !myPlayer.value.canPlayExtra) return false
    
    const card = myPlayer.value.hand[cardIndex]
    if (!card || card === 'hidden') return false
    
    if (myPlayer.value.currentCost < (card as Card).cost) {
      return false
    }
    
    selectedCard.value = card as Card
    
    // 获取可用槽位
    const slots: number[] = []
    myPlayer.value.field.forEach((slot, index) => {
      if (!slot.isExtra && !slot.card) {
        slots.push(index)
      } else if (slot.isExtra && !slot.card && (card as Card).type === 'unit') {
        slots.push(index)
      }
    })
    
    availableSlots.value = slots
    
    if (slots.length === 0) {
      selectedCard.value = null
      return false
    }
    
    return true
  }
  
  // 选择槽位打出卡牌（返回操作对象）
  function selectSlotToPlay(slotIndex: number, cardIndex: number) {
    if (!selectedCard.value) return null
    
    const action = {
      type: 'playCard' as const,
      data: {
        cardIndex,
        slotIndex,
        cardId: selectedCard.value.id
      }
    }
    
    // 重置选择状态
    selectedCard.value = null
    selectedSlot.value = null
    availableSlots.value = []
    
    return action
  }
  
  // 选择重铸手牌
  function selectReforgeCard(cardIndex: number) {
    if (!reforgeState.value.active) return
    reforgeState.value.selectedCard = cardIndex
  }
  
  // 执行重铸（返回操作对象）
  function executeReforge(options: [ReforgeOption, ReforgeOption]) {
    const action = {
      type: 'executeReforge' as const,
      data: {
        options,
        selectedCardIndex: reforgeState.value.selectedCard
      }
    }
    
    // 重置重铸状态
    reforgeState.value.active = false
    reforgeState.value.selectedCard = null
    
    return action
  }
  
  // 处理对手决策
  function handleOpponentDecision() {
    console.log('[useGameClient] handleOpponentDecision 被调用')
    console.log('[useGameClient] 设置 opponentDecisionMade = true')
    opponentDecisionMade.value = true
  }
  
  // 重置决策状态（新回合开始时）
  function resetDecisionState() {
    console.log('[useGameClient] resetDecisionState 被调用')
    console.log('[useGameClient] 重置 myDecisionMade 和 opponentDecisionMade 为 false')
    myDecisionMade.value = false
    opponentDecisionMade.value = false
  }
  
  // 重置回合准备状态
  function resetReadyState() {
    myReady.value = false
    opponentReady.value = false
  }
  
  // 标记自己准备完成
  function setMyReady() {
    myReady.value = true
  }
  
  // 标记对手准备完成
  function setOpponentReady() {
    opponentReady.value = true
  }
  
  // 获取总战力
  function getTotalPower(playerIndex: number) {
    if (!gameState.value) return 0
    const player = gameState.value.players[playerIndex]
    if (!player) return 0
    
    let totalPower = player.bonusPower
    player.field.forEach(slot => {
      if (slot.card && !slot.isExtra) {
        totalPower += slot.card.currentPower
      }
    })
    return totalPower
  }
  
  // 检查槽位是否可用
  function isSlotAvailable(slotIndex: number): boolean {
    return availableSlots.value.includes(slotIndex)
  }
  
  // 检查卡牌是否可打出
  function isCardPlayable(index: number): boolean {
    if (!gameState.value || !myPlayer.value) return false
    if (gameState.value.phase !== 'action') return false
    if (reforgeState.value.active) return false
    
    const card = myPlayer.value.hand[index]
    if (!card || card === 'hidden') return false
    
    if (hasPlayedThisTurn.value && !canPlayExtra.value) {
      return false
    }
    
    return myPlayer.value.currentCost >= (card as Card).cost
  }
  
  return {
    gameState,
    myPlayer,
    opponent,
    reforgeState,
    selectedCard,
    selectedSlot,
    availableSlots,
    availableTargets,
    hasPlayedThisTurn,
    canPlayExtra,
    myDecisionMade,
    opponentDecisionMade,
    bothDecisionsMade,
    myReady,
    opponentReady,
    bothPlayersReady,
    updateGameState,
    choosePlay,
    chooseReforge,
    selectCardToPlay,
    selectSlotToPlay,
    selectReforgeCard,
    executeReforge,
    handleOpponentDecision,
    resetDecisionState,
    resetReadyState,
    setMyReady,
    setOpponentReady,
    getTotalPower,
    isSlotAvailable,
    isCardPlayable
  }
}
