// 客户端游戏逻辑 - 只负责显示和发送操作请求
// 游戏逻辑在服务器端执行

import { ref, computed } from 'vue'
import type { GameState, Card, ReforgeOption } from '@/types/game'
import { EffectManager } from '@/game/effectManager'

export function useGameClient(initialPlayerId = '') {
  // 我的玩家ID（响应式）
  const myPlayerIdRef = ref(initialPlayerId)

  function setMyPlayerId(id: string) {
    myPlayerIdRef.value = id
  }
  
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
  const availableCrossPlayerSlots = ref<Array<{ playerIndex: number; slotIndex: number }>>([])
  const availableTargets = ref<Card[]>([])
  
  // 决策状态（从服务器状态派生）
  const myDecisionMade = computed(() => gameState.value?.playerDecisions?.[myPlayerIdRef.value]?.made ?? false)
  const allOtherDecisionsMade = computed(() => {
    const decisions = gameState.value?.playerDecisions
    if (!decisions) return false
    const totalPlayers = gameState.value?.players.length ?? 0
    if (totalPlayers <= 1) return false
    const myId = myPlayerIdRef.value
    const otherEntries = Object.entries(decisions).filter(([pid]) => pid !== myId)
    if (otherEntries.length < totalPlayers - 1) return false
    return otherEntries.every(([_, d]) => d.made)
  })

  /** 所有玩家（含自己）均已决策 */
  const allDecisionsMade = computed(() => {
    const decisions = gameState.value?.playerDecisions
    const players = gameState.value?.players
    if (!decisions || !players?.length) return false
    return players.every(p => decisions[p.id]?.made)
  })

  /** @deprecated 使用 allDecisionsMade */
  const bothDecisionsMade = allDecisionsMade
  
  const myReady = ref(false)

  /** 从服务器 playerReady 派生：全部玩家已准备 */
  const allPlayersReady = computed(() => {
    const ready = gameState.value?.playerReady
    const players = gameState.value?.players
    if (!ready || !players?.length) return false
    return players.every(p => ready[p.id] === true)
  })

  /** @deprecated 使用 allPlayersReady */
  const bothPlayersReady = allPlayersReady
  
  // 计算属性
  const myPlayer = computed(() => gameState.value?.players.find(p => p.id === myPlayerIdRef.value) || null)
  const otherPlayers = computed(() => gameState.value?.players.filter(p => p.id !== myPlayerIdRef.value) ?? [])
  const hasPlayedThisTurn = computed(() => myPlayer.value?.hasPlayedThisTurn || false)
  const canPlayExtra = computed(() => myPlayer.value?.canPlayExtra || false)

  function myRestrictions(): string[] | undefined {
    if (!gameState.value || !myPlayerIdRef.value) return undefined
    return gameState.value.playerRestrictions?.[myPlayerIdRef.value]
  }

  function hasAffordableTacticInHand(): boolean {
    if (!myPlayer.value || !gameState.value) return false
    return myPlayer.value.hand.some(card => {
      if (!card || card === 'hidden') return false
      const c = card as Card
      return c.type === 'tactic'
        && EffectManager.getEffectivePlayCost(c, myPlayer.value!) <= myPlayer.value!.currentCost
        && EffectManager.canPlayHandCard(c, myPlayer.value!, gameState.value!)
    })
  }

  const canChooseReforge = computed(() => {
    const r = myRestrictions()
    return !hasPlayedThisTurn.value
      && !r?.includes('cannotPlay')
      && !r?.includes('tacticsOnly')
  })

  const canChoosePlay = computed(() => {
    const r = myRestrictions()
    if (r?.includes('cannotPlay')) return false
    if (r?.includes('tacticsOnly')) return hasAffordableTacticInHand()
    return true
  })

  const finalRoundTacticsOnly = computed(() => !!myRestrictions()?.includes('tacticsOnly'))
  
  // 更新游戏状态（从服务器接收）
  function updateGameState(newState: GameState) {
    console.log('[useGameClient] 更新游戏状态:', newState)
    gameState.value = newState
  }
  
  // 选择出牌（返回操作对象，由调用者发送到服务器）
  function choosePlay() {
    console.log('[useGameClient] choosePlay 被调用')
    if (!canChoosePlay.value) return null
    reforgeState.value.active = false
    reforgeState.value.hasChosen = true
    
    return {
      type: 'choosePlay' as const
    }
  }
  
  // 选择重铸
  function chooseReforge() {
    console.log('[useGameClient] chooseReforge 被调用')
    if (!canChooseReforge.value) return null
    reforgeState.value.active = true
    reforgeState.value.hasChosen = true
    
    return {
      type: 'chooseReforge' as const
    }
  }
  
  // 选择手牌准备打出；返回 slot=需选格 / direct=战术直出 / false=不可出
  function selectCardToPlay(cardIndex: number): 'slot' | 'direct' | false {
    if (!gameState.value || !myPlayer.value) return false
    if (reforgeState.value.active) return false
    if (myPlayer.value.hasPlayedThisTurn && !myPlayer.value.canPlayExtra) return false
    
    const card = myPlayer.value.hand[cardIndex]
    if (!card || card === 'hidden') return false

    const restrictions = myRestrictions()
    if (restrictions?.includes('cannotPlay')) return false
    if (restrictions?.includes('tacticsOnly') && (card as Card).type !== 'tactic') return false

    if (!EffectManager.canPlayHandCard(card as Card, myPlayer.value, gameState.value)) {
      return false
    }
    
    if (myPlayer.value.currentCost < EffectManager.getEffectivePlayCost(card as Card, myPlayer.value)) {
      return false
    }
    
    selectedCard.value = card as Card

    if (EffectManager.requiresCrossPlayerDeploy(card as Card)) {
      const opts = EffectManager.getCrossPlayerDeployOptions(gameState.value, myPlayer.value, card as Card)
      availableCrossPlayerSlots.value = opts
      if (opts.length === 0) {
        selectedCard.value = null
        return false
      }
      return 'slot'
    }
    
    const slots = EffectManager.getAvailableSlotIndices(myPlayer.value, card as Card)
    availableSlots.value = slots
    availableCrossPlayerSlots.value = []
    
    if (slots.length === 0) {
      if ((card as Card).type === 'tactic' && EffectManager.countMainFieldCardsForLimit(myPlayer.value) >= 6) {
        return 'direct'
      }
      selectedCard.value = null
      return false
    }
    
    return 'slot'
  }

  function playTacticDirect(cardIndex: number) {
    if (!selectedCard.value && myPlayer.value) {
      const card = myPlayer.value.hand[cardIndex]
      if (card && card !== 'hidden') selectedCard.value = card as Card
    }
    if (!selectedCard.value) return null
    const action = {
      type: 'playCard' as const,
      data: {
        cardIndex,
        slotIndex: -1,
        cardId: selectedCard.value.id,
      },
    }
    selectedCard.value = null
    selectedSlot.value = null
    availableSlots.value = []
    availableCrossPlayerSlots.value = []
    return action
  }
  
  // 选择槽位打出卡牌（返回操作对象）
  function selectSlotToPlay(slotIndex: number, cardIndex: number, targetPlayerIndex?: number) {
    if (!selectedCard.value) return null
    
    const action = {
      type: 'playCard' as const,
      data: {
        cardIndex,
        slotIndex,
        cardId: selectedCard.value.id,
        ...(targetPlayerIndex !== undefined ? { targetPlayerIndex } : {}),
      }
    }
    
    // 重置选择状态
    selectedCard.value = null
    selectedSlot.value = null
    availableSlots.value = []
    availableCrossPlayerSlots.value = []
    
    return action
  }

  function isCrossPlayerSlotAvailable(playerIndex: number, slotIndex: number): boolean {
    return availableCrossPlayerSlots.value.some(
      o => o.playerIndex === playerIndex && o.slotIndex === slotIndex,
    )
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
  
  // 处理对手决策（旧版兼容，决策状态现从服务器派生）
  function handleOpponentDecision() {
    console.log('[useGameClient] handleOpponentDecision 被调用（已弃用，决策状态从服务器派生）')
  }
  
  // 重置决策状态（旧版兼容，决策状态现从服务器派生）
  function resetDecisionState() {
    console.log('[useGameClient] resetDecisionState 被调用（已弃用，决策状态从服务器派生）')
  }
  
  // 重置回合准备状态
  function resetReadyState() {
    myReady.value = false
  }
  
  // 标记自己准备完成
  function setMyReady() {
    myReady.value = true
  }

  function cancelActionChoice() {
    reforgeState.value.active = false
    reforgeState.value.selectedCard = null
    reforgeState.value.hasChosen = false
    selectedCard.value = null
    return { type: 'cancelDecision' as const }
  }

  function resolveEffectBranchChoice(branch: string, discardHandIndex: number) {
    return {
      type: 'resolveEffectBranch' as const,
      data: { branch, discardHandIndex },
    }
  }

  function skipEffectBranchChoice() {
    return { type: 'skipEffectBranch' as const }
  }

  function getTotalPower(playerIndex: number) {
    if (!gameState.value) return 0
    const player = gameState.value.players[playerIndex]
    if (!player) return 0
    return EffectManager.getPlayerTotalPower(player)
  }

  function isSlotAvailable(slotIndex: number): boolean {
    return availableSlots.value.includes(slotIndex)
  }

  function isCardPlayable(index: number): boolean {
    if (!gameState.value || !myPlayer.value) return false
    if (gameState.value.phase !== 'action') return false
    if (reforgeState.value.active) return false

    const restrictions = gameState.value.playerRestrictions?.[myPlayerIdRef.value]
    if (restrictions?.includes('cannotPlay')) return false
    if (restrictions?.includes('tacticsOnly')) {
      const card = myPlayer.value.hand[index]
      if (!card || card === 'hidden') return false
      if ((card as Card).type !== 'tactic') return false
      return myPlayer.value.currentCost >= EffectManager.getEffectivePlayCost(card as Card, myPlayer.value)
    }

    const card = myPlayer.value.hand[index]
    if (!card || card === 'hidden') return false

    if (hasPlayedThisTurn.value && !canPlayExtra.value) {
      return false
    }

    if (hasPlayedThisTurn.value && canPlayExtra.value) {
      if (!EffectManager.meetsExtraPlayRestriction(card as Card, myPlayer.value)) return false
    }

    if (!EffectManager.canPlayHandCard(card as Card, myPlayer.value, gameState.value)) {
      return false
    }

    return myPlayer.value.currentCost >= EffectManager.getEffectivePlayCost(card as Card, myPlayer.value)
  }

  return {
    gameState,
    myPlayer,
    otherPlayers,
    reforgeState,
    selectedCard,
    selectedSlot,
    availableSlots,
    availableCrossPlayerSlots,
    availableTargets,
    hasPlayedThisTurn,
    canPlayExtra,
    myDecisionMade,
    allOtherDecisionsMade,
    allDecisionsMade,
    bothDecisionsMade,
    myReady,
    allPlayersReady,
    bothPlayersReady,
    setMyPlayerId,
    updateGameState,
    choosePlay,
    chooseReforge,
    selectCardToPlay,
    playTacticDirect,
    selectSlotToPlay,
    selectReforgeCard,
    executeReforge,
    cancelActionChoice,
    resolveEffectBranchChoice,
    skipEffectBranchChoice,
    handleOpponentDecision,
    resetDecisionState,
    resetReadyState,
    setMyReady,
    getTotalPower,
    isSlotAvailable,
    isCrossPlayerSlotAvailable,
    isCardPlayable,
    canChoosePlay,
    canChooseReforge,
    finalRoundTacticsOnly,
  }
}
