// 客户端游戏逻辑 - 只负责显示和发送操作请求
// 游戏逻辑在服务器端执行

import { ref, computed } from 'vue'
import type { GameState, Card, ReforgeOption } from '@/types/game'
import { EffectManager } from '@/game/effectManager'
import { syncBroadcastFromMessage } from '@/utils/gameBroadcast'

export type ClientSelectMode = 'none' | 'hostDeploy' | 'quickPlayTarget'

export function useGameClient(initialPlayerId = '') {
  const myPlayerIdRef = ref(initialPlayerId)

  function setMyPlayerId(id: string) {
    myPlayerIdRef.value = id
  }
  
  const gameState = ref<GameState | null>(null)
  
  const reforgeState = ref<{ active: boolean; selectedRedrawIndices: number[]; hasChosen: boolean }>({
    active: false,
    selectedRedrawIndices: [],
    hasChosen: false
  })
  
  const selectedCard = ref<Card | null>(null)
  const selectedSlot = ref<number | null>(null)
  const availableSlots = ref<number[]>([])
  const availableCrossPlayerSlots = ref<Array<{ playerIndex: number; slotIndex: number }>>([])
  const availableTargets = ref<Card[]>([])
  const clientSelectMode = ref<ClientSelectMode>('none')
  const pendingCardIndex = ref<number | null>(null)
  const deployHint = ref('')
  
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

  const allDecisionsMade = computed(() => {
    const decisions = gameState.value?.playerDecisions
    const players = gameState.value?.players
    if (!decisions || !players?.length) return false
    return players.every(p => decisions[p.id]?.made)
  })

  const bothDecisionsMade = allDecisionsMade
  
  const myReady = ref(false)

  const allPlayersReady = computed(() => {
    const ready = gameState.value?.playerReady
    const players = gameState.value?.players
    if (!ready || !players?.length) return false
    return players.every(p => ready[p.id] === true)
  })

  const bothPlayersReady = allPlayersReady
  
  const myPlayer = computed(() => gameState.value?.players.find(p => p.id === myPlayerIdRef.value) || null)
  const otherPlayers = computed(() => gameState.value?.players.filter(p => p.id !== myPlayerIdRef.value) ?? [])
  const hasPlayedThisTurn = computed(() => myPlayer.value?.hasPlayedThisTurn || false)
  const canPlayExtra = computed(() => myPlayer.value?.canPlayExtra || false)

  const isSelectingTarget = computed(() =>
    clientSelectMode.value !== 'none'
    || !!gameState.value?.pendingRevealTargetSelection?.playerId && gameState.value.pendingRevealTargetSelection.playerId === myPlayerIdRef.value,
  )

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

  function findFieldCardsByIds(ids: string[]): Card[] {
    if (!gameState.value) return []
    const out: Card[] = []
    for (const p of gameState.value.players) {
      for (const slot of p.field) {
        if (slot.card && ids.includes(slot.card.id)) out.push(slot.card)
      }
    }
    return out
  }

  function syncRevealTargetSelectionFromServer() {
    const pending = gameState.value?.pendingRevealTargetSelection
    if (!pending || pending.playerId !== myPlayerIdRef.value) return
    availableTargets.value = findFieldCardsByIds(pending.targetCardIds)
    clientSelectMode.value = 'none'
    deployHint.value = '选择一张单位牌作为揭示效果目标'
  }

  function resetClientSelection() {
    selectedCard.value = null
    selectedSlot.value = null
    availableSlots.value = []
    availableCrossPlayerSlots.value = []
    availableTargets.value = []
    clientSelectMode.value = 'none'
    pendingCardIndex.value = null
    deployHint.value = ''
  }
  
  function updateGameState(newState: GameState) {
    const prevLog = gameState.value?.broadcastLog ?? []
    const prevMessage = gameState.value?.message ?? ''
    gameState.value = newState
    if (!newState.broadcastLog) newState.broadcastLog = []
    const seen = new Set(newState.broadcastLog.map(e => `${e.round}:${e.text}`))
    for (const entry of prevLog) {
      const key = `${entry.round}:${entry.text}`
      if (!seen.has(key)) {
        newState.broadcastLog.push(entry)
        seen.add(key)
      }
    }
    if (newState.broadcastLog.length > 120) {
      newState.broadcastLog.length = 120
    }
    syncBroadcastFromMessage(newState, prevMessage)
    syncRevealTargetSelectionFromServer()
  }
  
  function choosePlay() {
    if (!canChoosePlay.value) return null
    reforgeState.value.active = false
    reforgeState.value.hasChosen = true
    return { type: 'choosePlay' as const }
  }
  
  function chooseReforge() {
    if (!canChooseReforge.value) return null
    reforgeState.value.active = true
    reforgeState.value.hasChosen = true
    return { type: 'chooseReforge' as const }
  }

  function getOnPlayModifyTargetEffect(card: Card) {
    return card.effects?.find(
      e => e.timing === 'onPlay' && e.type === 'modifyPower' && e.targetKeywords?.length,
    )
  }
  
  function selectCardToPlay(cardIndex: number): 'slot' | 'direct' | 'host' | 'target' | false {
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

    resetClientSelection()
    selectedCard.value = card as Card
    pendingCardIndex.value = cardIndex

    if ((card as Card).quickPlay && (card as Card).type === 'tactic') {
      const onPlayMod = getOnPlayModifyTargetEffect(card as Card)
      if (onPlayMod) {
        const targets = EffectManager.getRevealModifyTargets(gameState.value, myPlayer.value, onPlayMod)
        if (targets.length === 0) return false
        if (targets.length > 1) {
          availableTargets.value = targets
          clientSelectMode.value = 'quickPlayTarget'
          deployHint.value = `选择 ${(card as Card).name} 的目标单位`
          return 'target'
        }
      }
      return 'direct'
    }

    if (EffectManager.requiresMandatoryHostDeploy(card as Card) && !(card as Card).quickPlay) {
      const targets = EffectManager.getQuickPlayHostTargets(myPlayer.value, card as Card)
      if (targets.length === 0) return false
      availableTargets.value = targets
      clientSelectMode.value = 'hostDeploy'
      deployHint.value = `选择 ${(card as Card).name} 的部署宿主`
      return 'host'
    }

    if (EffectManager.requiresCrossPlayerDeploy(card as Card)) {
      const opts = EffectManager.getCrossPlayerDeployOptions(gameState.value, myPlayer.value, card as Card)
      availableCrossPlayerSlots.value = opts
      if (opts.length === 0) {
        resetClientSelection()
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
      resetClientSelection()
      return false
    }
    
    return 'slot'
  }

  function playTacticDirect(cardIndex: number, targetCardId?: string) {
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
        ...(targetCardId ? { targetCardId } : {}),
      },
    }
    resetClientSelection()
    return action
  }

  function playHostDeploy(cardIndex: number, hostCardId: string) {
    if (pendingCardIndex.value !== cardIndex && myPlayer.value) {
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
        hostCardId,
      },
    }
    resetClientSelection()
    return action
  }

  function selectRevealTarget(targetCardId: string) {
    return {
      type: 'selectRevealTarget' as const,
      data: { targetCardId },
    }
  }
  
  function selectSlotToPlay(slotIndex: number, cardIndex: number, targetPlayerIndex?: number) {
    if (!selectedCard.value || !myPlayer.value) return null

    const resolvedSlot = targetPlayerIndex === undefined
      ? EffectManager.resolveDeploySlotIndex(myPlayer.value, selectedCard.value, slotIndex)
      : slotIndex
    
    const action = {
      type: 'playCard' as const,
      data: {
        cardIndex,
        slotIndex: resolvedSlot,
        cardId: selectedCard.value.id,
        ...(targetPlayerIndex !== undefined ? { targetPlayerIndex } : {}),
      }
    }
    
    resetClientSelection()
    return action
  }

  function isCrossPlayerSlotAvailable(playerIndex: number, slotIndex: number): boolean {
    return availableCrossPlayerSlots.value.some(
      o => o.playerIndex === playerIndex && o.slotIndex === slotIndex,
    )
  }
  
  function selectReforgeCard(cardIndex: number) {
    if (!reforgeState.value.active) return
    if (reforgeState.value.selectedRedrawIndices.includes(cardIndex)) return
    reforgeState.value.selectedRedrawIndices.push(cardIndex)
  }
  
  function executeReforge(options: [ReforgeOption, ReforgeOption]) {
    const action = {
      type: 'executeReforge' as const,
      data: {
        options,
        selectedCardIndices: [...reforgeState.value.selectedRedrawIndices],
        selectedCardIndex: reforgeState.value.selectedRedrawIndices[0] ?? null,
      }
    }
    reforgeState.value.active = false
    reforgeState.value.selectedRedrawIndices = []
    return action
  }
  
  function handleOpponentDecision() {
    console.log('[useGameClient] handleOpponentDecision 被调用（已弃用）')
  }
  
  function resetDecisionState() {
    console.log('[useGameClient] resetDecisionState 被调用（已弃用）')
  }
  
  function resetReadyState() {
    myReady.value = false
  }
  
  function setMyReady() {
    myReady.value = true
  }

  function cancelActionChoice() {
    reforgeState.value.active = false
    reforgeState.value.selectedRedrawIndices = []
    reforgeState.value.hasChosen = false
    resetClientSelection()
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

  function isTargetSelectable(card: Card | null | undefined): boolean {
    if (!card) return false
    if (clientSelectMode.value !== 'none') {
      return availableTargets.value.some(t => t.id === card.id)
    }
    const pending = gameState.value?.pendingRevealTargetSelection
    if (pending?.playerId === myPlayerIdRef.value) {
      return pending.targetCardIds.includes(card.id)
    }
    return false
  }

  function isCardPlayable(index: number): boolean {
    if (!gameState.value || !myPlayer.value) return false
    if (gameState.value.phase !== 'action') return false
    if (reforgeState.value.active) return false
    if (isSelectingTarget.value) return false

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
    clientSelectMode,
    deployHint,
    pendingCardIndex,
    isSelectingTarget,
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
    playHostDeploy,
    selectRevealTarget,
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
    isTargetSelectable,
    isCardPlayable,
    canChoosePlay,
    canChooseReforge,
    finalRoundTacticsOnly,
    resetClientSelection,
  }
}
