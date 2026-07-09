import type { GameState, Player, Card, ReforgeOption, FieldSlot, GameAction, CardEffect } from '@/types/game'
import { createDeck, shuffleDeck, initializeCardDatabase } from '@/data/cards'
import { CardDatabase } from '@/data/cardDatabase'
import { EffectManager } from '@/game/effectManager'

export function useGameMultiplayer(myPlayerId: string, opponentId: string, myPlayerName: string, opponentName: string) {
  // 初始化卡牌数据库
  initializeCardDatabase()

  // 创建初始槽位
  function createInitialSlots(): FieldSlot[] {
    return Array.from({ length: 6 }, (_, i) => ({
      card: null,
      position: i,
      isExtra: false
    }))
  }

  // 游戏状态
  const gameState = ref<GameState>({
    players: [
      {
        id: myPlayerId,
        name: myPlayerName,
        hand: [],
        deck: [],
        field: createInitialSlots(),
        discard: [],
        currentCost: 4,
        bonusPower: 0,
        canPlayExtra: false,
        hasPlayedThisTurn: false
      },
      {
        id: opponentId,
        name: opponentName,
        hand: [],
        deck: [],
        field: createInitialSlots(),
        discard: [],
        currentCost: 4,
        bonusPower: 0,
        canPlayExtra: false,
        hasPlayedThisTurn: false
      }
    ],
    currentPlayerIndex: 0,
    round: 0,
    phase: 'draw',
    isFinalRound: false,
    message: '游戏开始！'
  })

  const myPlayer = computed(() => gameState.value.players[0])
  const opponent = computed(() => gameState.value.players[1])
  const reforgeState = ref<{ active: boolean; selectedRedrawIndices: number[]; hasChosen: boolean }>({
    active: false,
    selectedRedrawIndices: [],
    hasChosen: false
  })

  // 用于UI显示的计算属性
  const hasPlayedThisTurn = computed(() => myPlayer.value.hasPlayedThisTurn)
  const canPlayExtra = computed(() => myPlayer.value.canPlayExtra)

  // 初始化游戏
  function initGame() {
    console.log('[useGameMultiplayer] 初始化游戏')
    
    // 只初始化自己的牌组和手牌
    myPlayer.value.deck = shuffleDeck(createDeck())
    myPlayer.value.hand = []
    myPlayer.value.field = createInitialSlots()
    myPlayer.value.discard = []
    myPlayer.value.currentCost = 4
    myPlayer.value.bonusPower = 0
    myPlayer.value.canPlayExtra = false
    myPlayer.value.hasPlayedThisTurn = false
    
    for (let i = 0; i < 3; i++) {
      drawCard(myPlayer.value)
    }
    
    // 对手只初始化基本信息，不初始化牌组（因为我们看不到对手的牌）
    opponent.value.hand = Array(3).fill(null).map(() => ({ id: 'hidden' } as any)) // 占位符，显示手牌数量
    opponent.value.deck = Array(12).fill(null).map(() => ({ id: 'hidden' } as any)) // 占位符
    opponent.value.field = createInitialSlots()
    opponent.value.discard = []
    opponent.value.currentCost = 4
    opponent.value.bonusPower = 0
    opponent.value.canPlayExtra = false
    opponent.value.hasPlayedThisTurn = false
    
    gameState.value.round = 1
    gameState.value.phase = 'draw'
    gameState.value.isFinalRound = false
    gameState.value.winner = undefined
    reforgeState.value = { active: false, selectedRedrawIndices: [], hasChosen: false }
    gameState.value.selectedCard = undefined
    gameState.value.selectedSlot = undefined
    gameState.value.message = '回合 1 - 同时操作'
    
    console.log('[useGameMultiplayer] 我的手牌:', myPlayer.value.hand.map(c => c.name))
    console.log('[useGameMultiplayer] 对手手牌数量:', opponent.value.hand.length)
    
    nextTick(() => startDrawPhase())
  }

  // 抽牌
  function drawCard(player: Player): Card | null {
    if (player.deck.length === 0) return null
    const card = player.deck.pop()!
    player.hand.push(card)
    return card
  }

  // 开始抽牌阶段
  function startDrawPhase() {
    if (gameState.value.isFinalRound && 
        gameState.value.finalRoundTriggeredBy === 0) {
      gameState.value.message = `你已填满场地，跳过本回合`
      return
    }
    
    // 重置出牌状态
    myPlayer.value.hasPlayedThisTurn = false
    myPlayer.value.canPlayExtra = false
    reforgeState.value.hasChosen = false
    
    const card = drawCard(myPlayer.value)
    
    if (card) {
      gameState.value.message = `回合 ${gameState.value.round} - 你抽了一张牌：${card.name}`
    } else {
      gameState.value.message = `回合 ${gameState.value.round} - 牌组已空，无法抽牌`
    }
    
    setTimeout(() => {
      gameState.value.phase = 'decision'
      gameState.value.message = `选择出牌或重铸`
    }, 1000)
  }

  // 选择出牌
  function choosePlay(): GameAction {
    reforgeState.value.active = false
    reforgeState.value.hasChosen = true
    gameState.value.phase = 'action'
    gameState.value.message = '选择一张手牌打出'
    return { type: 'choosePlay', playerId: myPlayer.value.id }
  }

  // 选择重铸
  function chooseReforge(): GameAction {
    reforgeState.value.active = true
    reforgeState.value.hasChosen = true
    gameState.value.phase = 'action'
    gameState.value.message = '重铸：选择两个操作'
    return { type: 'chooseReforge', playerId: myPlayer.value.id }
  }

  // 选择手牌准备打出
  function selectCardToPlay(cardIndex: number) {
    if (gameState.value.phase !== 'action' || reforgeState.value.active) return
    if (myPlayer.value.hasPlayedThisTurn && !myPlayer.value.canPlayExtra) {
      gameState.value.message = '本回合已经出过牌了！'
      return
    }
    
    const card = myPlayer.value.hand[cardIndex]
    if (!card) return
    
    const effCost = EffectManager.getEffectivePlayCost(card, myPlayer.value)
    if (myPlayer.value.currentCost < effCost) {
      gameState.value.message = `费用不足！需要 ${effCost}，当前 ${myPlayer.value.currentCost}`
      return
    }
    
    gameState.value.selectedCard = card
    gameState.value.phase = 'selectSlot'
    
    // 获取可用槽位
    const availableSlots = getAvailableSlots(myPlayer.value, card)
    gameState.value.availableSlots = availableSlots
    
    if (availableSlots.length === 0) {
      gameState.value.message = '没有可用的槽位！'
      gameState.value.phase = 'action'
      gameState.value.selectedCard = undefined
      return
    }
    
    gameState.value.message = `选择一个槽位打出 ${card.name}`
  }

  // 获取可用槽位
  function getAvailableSlots(player: Player, card: Card): number[] {
    return EffectManager.getAvailableSlotIndices(player, card)
  }

  // 选择槽位打出卡牌
  function selectSlotToPlay(slotIndex: number): GameAction | null {
    if (gameState.value.phase !== 'selectSlot' || !gameState.value.selectedCard) return null
    
    const card = gameState.value.selectedCard
    const cardIndex = myPlayer.value.hand.indexOf(card)
    
    if (cardIndex === -1) return null

    const resolvedSlot = EffectManager.resolveDeploySlotIndex(myPlayer.value, card, slotIndex)
    const available = gameState.value.availableSlots ?? []
    if (!available.includes(resolvedSlot)) return null
    
    // 执行打出卡牌（不改变 phase，因为这是本地操作）
    playCardToSlot(cardIndex, resolvedSlot)
    
    // 重置 phase 回到 action（保持在行动阶段）
    gameState.value.phase = 'action'
    
    return {
      type: 'playCard',
      data: { cardIndex, slotIndex: resolvedSlot, cardId: card.id },
      playerId: myPlayer.value.id
    }
  }

  // 打出卡牌到指定槽位
  function playCardToSlot(cardIndex: number, slotIndex: number) {
    const player = myPlayer.value
    const card = player.hand[cardIndex]
    
    if (!card) return
    
    // 支付费用
    const playCost = EffectManager.getEffectivePlayCost(card, player)
    player.currentCost -= playCost
    
    // 从手牌移除
    player.hand.splice(cardIndex, 1)
    
    // 标记已出牌
    if (player.hasPlayedThisTurn && player.canPlayExtra) {
      player.canPlayExtra = false
    } else {
      player.hasPlayedThisTurn = true
    }
    
    // 部署卡牌
    deployCard(card, player, slotIndex, playCost)
  }

  // 部署卡牌
  function deployCard(card: Card, player: Player, slotIndex: number, playCost?: number) {
    const slot = player.field[slotIndex]
    if (!slot) return
    
    slot.card = card
    
    gameState.value.message = `${player.name} 打出了 ${card.name}（费用-${playCost ?? card.cost}）`
    
    // 战术牌特殊处理
    if (card.type === 'tactic') {
      triggerDeployEffects(card, player)
      handleTacticCard(card, player, slotIndex)
      return
    }
    
    // 触发部署效果
    triggerDeployEffects(card, player)
    
    // 触发"其他卡牌打出时"的效果
    EffectManager.triggerOnOtherPlayEffects(card, player, gameState.value)
    
    // 重新计算战力
    EffectManager.recalculateAllPowers(gameState.value)
    
    // 检查是否填满场地
    checkFieldFull()
    
    gameState.value.phase = 'action'
    gameState.value.selectedCard = undefined
    gameState.value.selectedSlot = undefined
  }

  // 处理战术牌
  function handleTacticCard(card: Card, player: Player, slotIndex: number) {
    EffectManager.triggerOnOtherPlayEffects(card, player, gameState.value)

    const revealEffects = card.effects.filter(
      e => e.timing === 'onReveal' && e.type !== 'conditional' && e.type !== 'custom',
    )

    if (revealEffects.length === 0) {
      discardTacticCard(card, player, slotIndex)
      return
    }

    for (const effect of revealEffects) {
      const result = EffectManager.applyRevealEffect(
        effect, card, player, gameState.value,
        opponent.value ? [opponent.value] : [],
      )
      result.messages.forEach(msg => {
        gameState.value.message += ` | ${msg}`
      })
      if (result.needsTargetSelection) {
        gameState.value.availableTargets = result.needsTargetSelection.targets
        gameState.value.phase = 'selectTarget'
        gameState.value.message = '选择一个目标'
        return
      }
    }

    discardTacticCard(card, player, slotIndex)
  }

  // 选择战术牌目标
  function selectTacticTarget(targetCard: Card): GameAction | null {
    if (gameState.value.phase !== 'selectTarget' || !gameState.value.selectedCard) return null
    
    const card = gameState.value.selectedCard
    const effect = card.effects.find(e => e.timing === 'onReveal')
    
    if (effect && effect.value) {
      targetCard.currentPower += effect.value
      gameState.value.message += ` | ${targetCard.name} 战力+${effect.value}`
    }
    
    const slotIndex = myPlayer.value.field.findIndex(s => s.card === card)
    if (slotIndex !== -1) {
      discardTacticCard(card, myPlayer.value, slotIndex)
    }
    
    return {
      type: 'selectTarget',
      data: { targetCardId: targetCard.id }
    }
  }

  // 弃置战术牌
  function discardTacticCard(card: Card, player: Player, slotIndex: number) {
    const slot = player.field[slotIndex]
    if (slot) {
      slot.card = null
    }
    player.discard.push(card)
    
    gameState.value.phase = 'action'
    gameState.value.selectedCard = undefined
    gameState.value.availableTargets = undefined
  }

  // 触发部署效果
  function triggerDeployEffects(card: Card, player: Player) {
    if (!card.effects) return
    card.effects.forEach(effect => {
      if (effect.timing !== 'onDeploy') return
      if (effect.type === 'conditional' || effect.type === 'custom') return
      const result = EffectManager.applyDeployEffect(effect, card, player, gameState.value)
      result.messages.forEach(msg => {
        gameState.value.message += ` | ${msg}`
      })
      if (result.needsCreateSlot) {
        createExtraSlot(card, player, effect)
      }
    })
  }

  // 创建额外槽位
  function createExtraSlot(parentCard: Card, player: Player, effect?: CardEffect) {
    const parentSlotIndex = player.field.findIndex(s => s.card === parentCard)
    if (parentSlotIndex === -1) return
    
    const rules = effect ? EffectManager.slotRulesFromEffect(effect) : undefined
    EffectManager.appendExtraSlot(player, parentSlotIndex, rules)
    gameState.value.message += ` | 创建了额外槽位`
  }

  // 执行重铸
  function executeReforge(options: [ReforgeOption, ReforgeOption]): GameAction {
    const player = myPlayer.value
    let message = `${player.name} 重铸：`
    const selectedIndices = [...reforgeState.value.selectedRedrawIndices]
    const redrawQueue = [...selectedIndices].sort((a, b) => b - a)
    
    options.forEach((option, index) => {
      switch (option) {
        case 'gainCost':
          EffectManager.applyCostDelta(player, 2)
          message += ` 恢复2费用`
          break
        case 'gainPower':
          player.bonusPower += 1
          message += ` 总战力+1`
          break
        case 'redraw': {
          const hi = redrawQueue.shift()
          if (hi !== undefined && hi >= 0 && hi < player.hand.length) {
            const card = player.hand.splice(hi, 1)[0]
            player.deck.unshift(card)
            const newCard = drawCard(player)
            message += ` 换牌(${card.name}→${newCard?.name})`
          }
          break
        }
      }
      if (index === 0) message += ' +'
    })
    
    gameState.value.message = message
    reforgeState.value.active = false
    reforgeState.value.selectedRedrawIndices = []
    gameState.value.phase = 'draw'

    EffectManager.triggerReforgeEffects(player, gameState.value)
    
    return {
      type: 'executeReforge',
      data: { options, selectedCardIndices: selectedIndices }
    }
  }

  // 选择重铸手牌
  function selectReforgeCard(cardIndex: number) {
    if (!reforgeState.value.active) return
    if (reforgeState.value.selectedRedrawIndices.includes(cardIndex)) return
    reforgeState.value.selectedRedrawIndices.push(cardIndex)
  }

  // 检查场地是否填满
  function checkFieldFull(sendAction?: (action: GameAction) => void) {
    const player = myPlayer.value
    const mainSlots = player.field.filter(s => !s.isExtra)
    const filledMainSlots = mainSlots.filter(s => s.card !== null).length
    
    if (filledMainSlots === 6 && !gameState.value.isFinalRound) {
      gameState.value.isFinalRound = true
      gameState.value.finalRoundTriggeredBy = 0 // 我方触发
      gameState.value.message += ` | ${player.name} 填满了场地！进入最后一回合！`
      
      console.log('[useGameMultiplayer] 我方填满场地，通知对手')
      
      // 通知对手进入最后一回合
      if (sendAction) {
        sendAction({
          type: 'finalRound',
          data: { triggeredBy: 0 }
        })
      }
    }
  }
  
  // 检查对手场地是否填满
  function checkOpponentFieldFull() {
    const opponentPlayer = opponent.value
    const mainSlots = opponentPlayer.field.filter(s => !s.isExtra)
    const filledMainSlots = mainSlots.filter(s => s.card !== null).length
    
    if (filledMainSlots === 6 && !gameState.value.isFinalRound) {
      gameState.value.isFinalRound = true
      gameState.value.finalRoundTriggeredBy = 1 // 对手触发
      gameState.value.message += ` | ${opponentPlayer.name} 填满了场地！进入最后一回合！`
      
      console.log('[useGameMultiplayer] 对手填满场地')
    }
  }

  // 应用对手操作
  function applyOpponentAction(action: GameAction) {
    console.log('[useGameMultiplayer] applyOpponentAction 被调用:', action.type, action.data, 'playerId:', action.playerId)
    
    // 关键修复：检查操作是否来自对手
    if (action.playerId === myPlayer.value.id) {
      console.log('[useGameMultiplayer] 忽略自己的操作，防止重复应用')
      return
    }
    
    const opponentPlayer = opponent.value
    
    switch (action.type) {
      case 'choosePlay':
        // 对手选择出牌 - 只记录，绝对不改变本地状态
        console.log('[useGameMultiplayer] 对手选择出牌（不影响本地状态）')
        // 重要：不要修改 gameState.phase，不要修改 reforgeState
        // 每个玩家的决策是独立的
        break
        
      case 'chooseReforge':
        // 对手选择重铸 - 只记录，绝对不改变本地状态
        console.log('[useGameMultiplayer] 对手选择重铸（不影响本地状态）')
        // 重要：不要修改 gameState.phase，不要修改 reforgeState
        // 每个玩家的决策是独立的
        break
        
      case 'playCard':
        if (action.data) {
          const { cardIndex, slotIndex, cardId } = action.data
          console.log('[useGameMultiplayer] 对手打出卡牌:', { cardIndex, slotIndex, cardId })
          console.log('[useGameMultiplayer] 对手手牌数量:', opponentPlayer.hand.length)
          
          // 从卡牌数据库中获取卡牌（因为我们看不到对手的实际手牌）
          // 注意：cardId 可能包含 _unique 后缀，需要去掉
          const baseCardId = cardId.replace('_unique', '')
          const cardData = CardDatabase.get(baseCardId)
          
          if (cardData) {
            console.log('[useGameMultiplayer] 从数据库获取卡牌:', cardData.name)
            
            // 减少对手手牌数量（移除一个占位符）
            if (opponentPlayer.hand.length > 0) {
              opponentPlayer.hand.splice(0, 1)
            }
            
            const oppPlayCost = EffectManager.getEffectivePlayCost(cardData, opponentPlayer)
            opponentPlayer.currentCost -= oppPlayCost
            
            if (opponentPlayer.hasPlayedThisTurn && opponentPlayer.canPlayExtra) {
              opponentPlayer.canPlayExtra = false
            } else {
              opponentPlayer.hasPlayedThisTurn = true
            }
            
            console.log('[useGameMultiplayer] 部署卡牌到槽位:', slotIndex)
            deployCard(cardData, opponentPlayer, slotIndex)
            console.log('[useGameMultiplayer] 对手费用:', opponentPlayer.currentCost)
            console.log('[useGameMultiplayer] 对手场上:', opponentPlayer.field.filter(s => s.card).map(s => s.card?.name))
            
            // 检查对手是否填满场地
            checkOpponentFieldFull()
          } else {
            console.error('[useGameMultiplayer] 未找到卡牌数据:', cardId, '(baseId:', baseCardId, ')')
          }
        }
        break
        
      case 'executeReforge':
        if (action.data) {
          const { options } = action.data
          console.log('[useGameMultiplayer] 对手重铸:', options)
          options.forEach((option: ReforgeOption) => {
            switch (option) {
              case 'gainCost':
                EffectManager.applyCostDelta(opponentPlayer, 2)
                console.log('[useGameMultiplayer] 对手恢复费用，当前:', opponentPlayer.currentCost)
                break
              case 'gainPower':
                opponentPlayer.bonusPower += 1
                console.log('[useGameMultiplayer] 对手战力+1，当前:', opponentPlayer.bonusPower)
                break
              case 'redraw':
                if (opponentPlayer.hand.length > 0) {
                  // 移除一个占位符（放回牌组）
                  opponentPlayer.hand.splice(0, 1)
                  // 添加一个新的占位符（抽新牌）
                  opponentPlayer.hand.push({ id: 'hidden' } as any)
                  console.log('[useGameMultiplayer] 对手换牌')
                }
                break
            }
          })
          EffectManager.triggerReforgeEffects(opponentPlayer, gameState.value)
        }
        break
        
      case 'skipTurn':
        console.log('[useGameMultiplayer] 对手跳过回合')
        break
        
      case 'drawCard':
        // 对手抽牌，增加手牌占位符
        opponentPlayer.hand.push({ id: 'hidden' } as any)
        if (opponentPlayer.deck.length > 0) {
          opponentPlayer.deck.splice(0, 1)
        }
        console.log('[useGameMultiplayer] 对手抽牌，当前手牌数:', opponentPlayer.hand.length)
        break
        
      case 'finalRound':
        // 对手触发了最后一回合
        if (!gameState.value.isFinalRound) {
          gameState.value.isFinalRound = true
          gameState.value.finalRoundTriggeredBy = 1 // 对手触发
          gameState.value.message += ` | ${opponentPlayer.name} 填满了场地！进入最后一回合！`
          console.log('[useGameMultiplayer] 收到对手最后一回合通知')
        }
        break
    }
  }

  // 新回合
  function nextRound() {
    gameState.value.round++
    startDrawPhase()
  }

  // 游戏结束
  function endGame() {
    gameState.value.phase = 'gameOver'
    
    const powers = gameState.value.players.map(player => {
      let totalPower = player.bonusPower
      player.field.forEach(slot => {
        if (slot.card && !slot.isExtra) {
          totalPower += slot.card.currentPower
        }
      })
      return totalPower
    })
    
    gameState.value.message = `游戏结束！\n${myPlayer.value.name}战力：${powers[0]}\n${opponent.value.name}战力：${powers[1]}\n`
    
    if (powers[0] > powers[1]) {
      gameState.value.winner = 0
      gameState.value.message += `${myPlayer.value.name}获胜！🎉`
    } else if (powers[1] > powers[0]) {
      gameState.value.winner = 1
      gameState.value.message += `${opponent.value.name}获胜！`
    } else {
      gameState.value.message += '平局！'
    }
  }

  return {
    gameState,
    myPlayer,
    opponent,
    reforgeState,
    hasPlayedThisTurn,
    canPlayExtra,
    initGame,
    choosePlay,
    chooseReforge,
    selectCardToPlay,
    selectSlotToPlay,
    selectTacticTarget,
    selectReforgeCard,
    executeReforge,
    applyOpponentAction,
    checkFieldFull,
    nextRound,
    endGame
  }
}
