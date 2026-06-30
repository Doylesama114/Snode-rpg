import type { GameState, Player, Card, ReforgeOption, FieldSlot } from '@/types/game'
import { createDeck, shuffleDeck, initializeCardDatabase } from '@/data/cards'
import { EffectManager } from '@/game/effectManager'

export function useGame() {
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
        id: 'player',
        name: '玩家',
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
        id: 'ai',
        name: 'AI',
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
    message: '游戏开始！点击"开始游戏"初始化'
  })

  const currentPlayer = computed(() => gameState.value.players[gameState.value.currentPlayerIndex])
  const opponent = computed(() => gameState.value.players[1 - gameState.value.currentPlayerIndex])
  const aiHiddenCards = ref<Array<{ card: Card, slot: number }>>([])
  const reforgeState = ref<{ active: boolean; selectedCard: number | null; hasChosen: boolean }>({
    active: false,
    selectedCard: null,
    hasChosen: false
  })
  
  // 用于UI显示的计算属性
  const hasPlayedThisTurn = computed(() => currentPlayer.value.hasPlayedThisTurn)
  const canPlayExtra = computed(() => currentPlayer.value.canPlayExtra)

  // 初始化游戏
  function initGame() {
    gameState.value.players.forEach(player => {
      player.deck = shuffleDeck(createDeck())
      player.hand = []
      player.field = createInitialSlots()
      player.discard = []
      player.currentCost = 4
      player.bonusPower = 0
      
      for (let i = 0; i < 3; i++) {
        drawCard(player)
      }
    })
    
    gameState.value.round = 1
    gameState.value.currentPlayerIndex = 1
    gameState.value.phase = 'draw'
    gameState.value.isFinalRound = false
    gameState.value.winner = undefined
    aiHiddenCards.value = []
    reforgeState.value = { active: false, selectedCard: null, hasChosen: false }
    gameState.value.selectedCard = undefined
    gameState.value.selectedSlot = undefined
    gameState.value.message = '回合 1 - AI先手'
    
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
        gameState.value.finalRoundTriggeredBy === gameState.value.currentPlayerIndex) {
      gameState.value.message = `${currentPlayer.value.name} 已填满场地，跳过本回合`
      setTimeout(() => switchToNextPlayer(), 1500)
      return
    }
    
    // 重置当前玩家的出牌状态
    currentPlayer.value.hasPlayedThisTurn = false
    currentPlayer.value.canPlayExtra = false
    reforgeState.value.hasChosen = false
    
    const card = drawCard(currentPlayer.value)
    
    if (currentPlayer.value.id === 'ai') {
      gameState.value.message = `AI 抽了一张牌`
    } else {
      if (card) {
        gameState.value.message = `${currentPlayer.value.name} 抽了一张牌：${card.name}`
      } else {
        gameState.value.message = `${currentPlayer.value.name} 牌组已空，无法抽牌`
      }
    }
    
    setTimeout(() => {
      gameState.value.phase = 'decision'
      
      if (currentPlayer.value.id === 'ai') {
        gameState.value.message = `AI 正在思考...`
        setTimeout(() => aiTurn(), 1000)
      } else {
        gameState.value.message = `${currentPlayer.value.name} - 必须选择出牌或重铸`
      }
    }, 1000)
  }

  // 选择出牌
  function choosePlay() {
    reforgeState.value.active = false
    reforgeState.value.hasChosen = true
    gameState.value.phase = 'action'
    gameState.value.message = '选择一张手牌打出'
    revealAICards()
  }

  // 选择重铸
  function chooseReforge() {
    reforgeState.value.active = true
    reforgeState.value.hasChosen = true
    gameState.value.phase = 'action'
    gameState.value.message = '重铸：选择两个操作'
  }

  // 选择手牌准备打出
  function selectCardToPlay(cardIndex: number) {
    if (gameState.value.phase !== 'action' || reforgeState.value.active) return
    if (currentPlayer.value.hasPlayedThisTurn && !currentPlayer.value.canPlayExtra) {
      gameState.value.message = '本回合已经出过牌了！'
      return
    }
    
    const card = currentPlayer.value.hand[cardIndex]
    if (!card) return
    
    if (currentPlayer.value.currentCost < card.cost) {
      gameState.value.message = `费用不足！需要 ${card.cost}，当前 ${currentPlayer.value.currentCost}`
      return
    }
    
    gameState.value.selectedCard = card
    gameState.value.phase = 'selectSlot'
    
    // 获取可用槽位
    const availableSlots = getAvailableSlots(currentPlayer.value, card)
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
    const slots: number[] = []
    
    player.field.forEach((slot, index) => {
      // 基础槽位
      if (!slot.isExtra && !slot.card) {
        slots.push(index)
      }
      // 额外槽位（只能放单位牌）
      else if (slot.isExtra && !slot.card && card.type === 'unit') {
        slots.push(index)
      }
    })
    
    return slots
  }

  // 选择槽位打出卡牌
  function selectSlotToPlay(slotIndex: number) {
    if (gameState.value.phase !== 'selectSlot' || !gameState.value.selectedCard) return
    
    const card = gameState.value.selectedCard
    const cardIndex = currentPlayer.value.hand.indexOf(card)
    
    if (cardIndex === -1) return
    
    // 执行打出卡牌
    playCardToSlot(cardIndex, slotIndex)
  }

  // 打出卡牌到指定槽位
  function playCardToSlot(cardIndex: number, slotIndex: number) {
    const player = currentPlayer.value
    const card = player.hand[cardIndex]
    
    if (!card) return
    
    // 支付费用
    player.currentCost -= card.cost
    
    // 从手牌移除
    player.hand.splice(cardIndex, 1)
    
    // 标记已出牌
    if (player.hasPlayedThisTurn && player.canPlayExtra) {
      player.canPlayExtra = false
    } else {
      player.hasPlayedThisTurn = true
    }
    
    // AI隐藏卡牌
    if (player.id === 'ai') {
      aiHiddenCards.value.push({ card, slot: slotIndex })
      gameState.value.message = `AI 打出了一张牌（已隐藏）`
      gameState.value.selectedCard = undefined
      gameState.value.phase = 'decision'
    } else {
      // 玩家直接部署
      deployCard(card, player, slotIndex)
    }
  }

  // 部署卡牌
  function deployCard(card: Card, player: Player, slotIndex: number) {
    const slot = player.field[slotIndex]
    if (!slot) return
    
    // 放置卡牌
    slot.card = card
    
    gameState.value.message = `${player.name} 打出了 ${card.name}（费用-${card.cost}）`
    
    // 战术牌特殊处理
    if (card.type === 'tactic') {
      handleTacticCard(card, player, slotIndex)
      return
    }
    
    // 触发部署效果
    triggerDeployEffects(card, player)
    
    // 触发"其他卡牌打出时"的效果（法师、战士、矮人铁匠）
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
    const effect = card.effects.find(e => e.timing === 'onReveal')
    
    // 先触发"其他卡牌打出时"的效果（战术牌也算打出）
    EffectManager.triggerOnOtherPlayEffects(card, player, gameState.value)
    
    if (!effect) {
      // 没有效果，直接弃置
      discardTacticCard(card, player, slotIndex)
      return
    }
    
    if (effect.type === 'modifyPower' && effect.targetKeywords) {
      // 需要选择目标
      const targets = EffectManager.getValidTargets(player, effect.targetKeywords)
      
      if (targets.length === 0) {
        gameState.value.message = '没有符合条件的目标'
        discardTacticCard(card, player, slotIndex)
        return
      }
      
      if (targets.length === 1) {
        // 只有一个目标，直接应用
        targets[0].currentPower += effect.value || 0
        gameState.value.message += ` | ${targets[0].name} 战力+${effect.value}`
        discardTacticCard(card, player, slotIndex)
      } else {
        // 多个目标，需要选择
        gameState.value.availableTargets = targets
        gameState.value.phase = 'selectTarget'
        gameState.value.message = '选择一个目标'
      }
    } else if (effect.type === 'modifyCost') {
      // 魔法飞弹：减少对手费用
      const target = opponent.value
      target.currentCost += effect.value || 0
      gameState.value.message += ` | ${target.name} 费用${effect.value}`
      
      // 检查AI是否因费用不足无法打出隐藏的牌
      if (target.id === 'ai' && aiHiddenCards.value.length > 0) {
        checkAIHiddenCardsAfterCostChange()
      }
      
      discardTacticCard(card, player, slotIndex)
    }
  }

  // 选择战术牌目标
  function selectTacticTarget(targetCard: Card) {
    if (gameState.value.phase !== 'selectTarget' || !gameState.value.selectedCard) return
    
    const card = gameState.value.selectedCard
    const effect = card.effects.find(e => e.timing === 'onReveal')
    
    if (effect && effect.value) {
      targetCard.currentPower += effect.value
      gameState.value.message += ` | ${targetCard.name} 战力+${effect.value}`
    }
    
    // 找到战术牌的槽位并弃置
    const slotIndex = currentPlayer.value.field.findIndex(s => s.card === card)
    if (slotIndex !== -1) {
      discardTacticCard(card, currentPlayer.value, slotIndex)
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

  // 检查AI隐藏卡牌费用
  function checkAIHiddenCardsAfterCostChange() {
    const ai = gameState.value.players[1]
    const invalidCards: typeof aiHiddenCards.value = []
    
    aiHiddenCards.value = aiHiddenCards.value.filter(item => {
      if (ai.currentCost < item.card.cost) {
        invalidCards.push(item)
        return false
      }
      return true
    })
    
    if (invalidCards.length > 0) {
      invalidCards.forEach(item => {
        ai.discard.push(item.card)
        gameState.value.message += ` | AI的${item.card.name}因费用不足无法打出`
      })
    }
  }

  // 触发部署效果
  function triggerDeployEffects(card: Card, player: Player) {
    card.effects.forEach(effect => {
      if (effect.timing === 'onDeploy') {
        if (effect.type === 'extraPlay') {
          player.canPlayExtra = true
          gameState.value.message += ` | 效果：可以再打出一张牌！`
        } else if (effect.type === 'createSlot') {
          createExtraSlot(card, player)
        }
      }
    })
  }

  // 创建额外槽位
  function createExtraSlot(parentCard: Card, player: Player) {
    const parentSlotIndex = player.field.findIndex(s => s.card === parentCard)
    if (parentSlotIndex === -1) return
    
    const newSlot: FieldSlot = {
      card: null,
      position: player.field.length,
      isExtra: true,
      parentSlot: parentSlotIndex
    }
    
    player.field.push(newSlot)
    gameState.value.message += ` | 创建了额外槽位`
  }

  // 显示AI隐藏卡牌
  function revealAICards() {
    if (aiHiddenCards.value.length === 0) return
    
    const ai = gameState.value.players[1]
    gameState.value.message = `AI 打出了 ${aiHiddenCards.value.length} 张牌！`
    
    aiHiddenCards.value.forEach(item => {
      deployCard(item.card, ai, item.slot)
    })
    
    aiHiddenCards.value = []
    
    setTimeout(() => {
      if (gameState.value.phase === 'action') {
        gameState.value.message = '玩家 - 选择手牌打出'
      }
    }, 1500)
  }

  // 执行重铸
  function executeReforge(options: [ReforgeOption, ReforgeOption]) {
    const player = currentPlayer.value
    let message = `${player.name} 重铸：`
    
    gameState.value.phase = 'draw'
    
    options.forEach((option, index) => {
      switch (option) {
        case 'gainCost':
          player.currentCost += 2
          message += ` 恢复2费用`
          break
        case 'gainPower':
          player.bonusPower += 1
          message += ` 总战力+1`
          break
        case 'redraw':
          if (player.id === 'player' && reforgeState.value.selectedCard !== null) {
            const card = player.hand.splice(reforgeState.value.selectedCard, 1)[0]
            player.deck.unshift(card)
            const newCard = drawCard(player)
            message += ` 换牌(${card.name}→${newCard?.name})`
            reforgeState.value.selectedCard = null
          } else if (player.id === 'ai' && player.hand.length > 0) {
            const cardIndex = Math.floor(Math.random() * player.hand.length)
            const card = player.hand.splice(cardIndex, 1)[0]
            player.deck.unshift(card)
            drawCard(player)
            message += ` 换牌`
          }
          break
      }
      if (index === 0) message += ' +'
    })
    
    gameState.value.message = message
    reforgeState.value.active = false
    reforgeState.value.selectedCard = null
    
    if (player.id === 'player') {
      revealAICards()
    }
    
    setTimeout(() => endTurn(), 1500)
  }

  // 选择重铸手牌
  function selectReforgeCard(cardIndex: number) {
    if (!reforgeState.value.active) return
    reforgeState.value.selectedCard = cardIndex
  }

  // 检查场地是否填满
  function checkFieldFull() {
    const player = currentPlayer.value
    const mainSlots = player.field.filter(s => !s.isExtra)
    const filledMainSlots = mainSlots.filter(s => s.card !== null).length
    
    if (filledMainSlots === 6 && !gameState.value.isFinalRound) {
      gameState.value.isFinalRound = true
      gameState.value.finalRoundTriggeredBy = gameState.value.currentPlayerIndex
      gameState.value.message += ` | ${player.name} 填满了场地！进入最后一回合！`
    }
  }

  // 切换玩家
  function switchToNextPlayer() {
    const nextPlayerIndex = 1 - gameState.value.currentPlayerIndex
    
    if (gameState.value.isFinalRound) {
      const triggeredPlayer = gameState.value.finalRoundTriggeredBy!
      
      if (nextPlayerIndex === triggeredPlayer) {
        if (aiHiddenCards.value.length > 0) {
          revealAICards()
        }
        setTimeout(() => endGame(), 2000)
        return
      }
    }
    
    gameState.value.currentPlayerIndex = nextPlayerIndex
    
    if (nextPlayerIndex === 1) {
      gameState.value.round++
    }
    
    gameState.value.phase = 'draw'
    setTimeout(() => startDrawPhase(), 2000)
  }

  // 结束回合
  function endTurn() {
    switchToNextPlayer()
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
    
    gameState.value.message = `游戏结束！\n玩家战力：${powers[0]}\nAI战力：${powers[1]}\n`
    
    if (powers[0] > powers[1]) {
      gameState.value.winner = 0
      gameState.value.message += '玩家获胜！🎉'
    } else if (powers[1] > powers[0]) {
      gameState.value.winner = 1
      gameState.value.message += 'AI获胜！'
    } else {
      gameState.value.message += '平局！'
    }
  }

  // AI回合
  function aiTurn() {
    if (gameState.value.phase === 'gameOver') return
    
    const ai = gameState.value.players[1]
    const mainSlots = ai.field.filter(s => !s.isExtra)
    const filledMainSlots = mainSlots.filter(s => s.card !== null).length
    const aiTotalCards = filledMainSlots + aiHiddenCards.value.length
    
    const playableCards = ai.hand.filter(card => card.cost <= ai.currentCost && aiTotalCards < 6)
    
    if (playableCards.length > 0 && Math.random() > 0.3) {
      const cardIndex = ai.hand.indexOf(playableCards[0])
      const availableSlots = getAvailableSlots(ai, playableCards[0])
      
      if (availableSlots.length > 0) {
        const slotIndex = availableSlots[0]
        playCardToSlot(cardIndex, slotIndex)
        
        gameState.value.message = `AI 打出了一张牌（已隐藏），等待玩家操作...`
        
        setTimeout(() => {
          if (gameState.value.phase !== 'gameOver') {
            switchToNextPlayer()
          }
        }, 1500)
        return
      }
    }
    
    // 重铸
    const options: [ReforgeOption, ReforgeOption] = ['gainCost', 'gainPower']
    gameState.value.message = `AI 选择了重铸`
    
    setTimeout(() => {
      if (gameState.value.phase === 'gameOver') return
      
      const aiPlayer = gameState.value.players[1]
      let message = `AI 重铸：`
      
      options.forEach((option, index) => {
        switch (option) {
          case 'gainCost':
            aiPlayer.currentCost += 2
            message += ` 恢复2费用`
            break
          case 'gainPower':
            aiPlayer.bonusPower += 1
            message += ` 总战力+1`
            break
        }
        if (index === 0) message += ' +'
      })
      
      gameState.value.message = message
      
      setTimeout(() => {
        if (gameState.value.phase !== 'gameOver') {
          switchToNextPlayer()
        }
      }, 1000)
    }, 1000)
  }

  return {
    gameState,
    currentPlayer,
    opponent,
    aiHiddenCards,
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
    endTurn
  }
}
