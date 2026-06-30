import type { GameState, Player, Card, DecisionType, ReforgeOption } from '@/types/game'
import { createDeck, shuffleDeck } from '@/data/cards'

export function useGame() {
  // 游戏状态
  const gameState = ref<GameState>({
    players: [
      {
        id: 'player',
        name: '玩家',
        hand: [],
        deck: [],
        field: [],
        discard: [],
        currentCost: 4,
        bonusPower: 0
      },
      {
        id: 'ai',
        name: 'AI',
        hand: [],
        deck: [],
        field: [],
        discard: [],
        currentCost: 4,
        bonusPower: 0
      }
    ],
    currentPlayerIndex: 0,
    round: 0,
    phase: 'draw',
    isFinalRound: false,
    message: '游戏开始！点击"开始游戏"初始化'
  })

  // 当前玩家
  const currentPlayer = computed(() => gameState.value.players[gameState.value.currentPlayerIndex])
  
  // 对手
  const opponent = computed(() => gameState.value.players[1 - gameState.value.currentPlayerIndex])
  
  // AI隐藏的卡牌（用于延迟显示）
  const aiHiddenCards = ref<Card[]>([])
  
  // 重铸状态
  const reforgeState = ref<{
    active: boolean
    selectedCard: number | null
    hasChosen: boolean  // 是否已经做出决策（出牌或重铸）
  }>({
    active: false,
    selectedCard: null,
    hasChosen: false
  })
  
  // 本回合是否已经出过牌
  const hasPlayedThisTurn = ref(false)
  
  // 是否可以额外出牌（通过效果触发）
  const canPlayExtra = ref(false)

  // 初始化游戏
  function initGame() {
    gameState.value.players.forEach(player => {
      player.deck = shuffleDeck(createDeck())
      player.hand = []
      player.field = []
      player.discard = []
      player.currentCost = 4
      player.bonusPower = 0
      
      // 初始抽3张牌
      for (let i = 0; i < 3; i++) {
        drawCard(player)
      }
    })
    
    gameState.value.round = 1
    gameState.value.currentPlayerIndex = 1 // 从AI开始
    gameState.value.phase = 'draw'
    gameState.value.isFinalRound = false
    gameState.value.winner = undefined
    aiHiddenCards.value = []
    reforgeState.value = { active: false, selectedCard: null, hasChosen: false }
    hasPlayedThisTurn.value = false
    canPlayExtra.value = false
    gameState.value.message = '回合 1 - AI先手'
    
    // AI先行动
    nextTick(() => {
      startDrawPhase()
    })
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
    // 检查是否是最后一回合且当前玩家已经填满场地
    if (gameState.value.isFinalRound && 
        gameState.value.finalRoundTriggeredBy === gameState.value.currentPlayerIndex) {
      // 跳过这个玩家的回合，直接切换
      gameState.value.message = `${currentPlayer.value.name} 已填满场地，跳过本回合`
      setTimeout(() => {
        switchToNextPlayer()
      }, 1500)
      return
    }
    
    // 重置出牌状态
    hasPlayedThisTurn.value = false
    canPlayExtra.value = false
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
    
    // 自动进入决策阶段
    setTimeout(() => {
      gameState.value.phase = 'decision'
      
      // 如果是AI回合，自动执行AI逻辑
      if (currentPlayer.value.id === 'ai') {
        gameState.value.message = `AI 正在思考...`
        setTimeout(() => aiTurn(), 1000)
      } else {
        gameState.value.message = `${currentPlayer.value.name} - 必须选择出牌或重铸`
      }
    }, 1000)
  }

  // 玩家选择出牌
  function choosePlay() {
    reforgeState.value.active = false
    reforgeState.value.hasChosen = true
    gameState.value.phase = 'action'
    gameState.value.message = '选择一张手牌打出（出完牌后点击"结束回合"）'
    
    // 显示AI的隐藏卡牌
    revealAICards()
  }

  // 玩家选择重铸
  function chooseReforge() {
    reforgeState.value.active = true
    reforgeState.value.hasChosen = true
    gameState.value.phase = 'action'
    gameState.value.message = '重铸：选择两个操作'
  }
  
  // 显示AI的隐藏卡牌
  function revealAICards() {
    if (aiHiddenCards.value.length > 0) {
      gameState.value.message = `AI 打出了 ${aiHiddenCards.value.length} 张牌！`
      
      aiHiddenCards.value.forEach(card => {
        const ai = gameState.value.players[1]
        ai.field.push(card)
        
        // 触发效果
        setTimeout(() => {
          triggerCardEffect(card, ai)
        }, 500)
      })
      
      aiHiddenCards.value = []
      
      setTimeout(() => {
        gameState.value.message = '玩家 - 选择一张手牌打出'
      }, 1500)
    }
  }

  // 打出卡牌
  function playCard(cardIndex: number): boolean {
    // 如果在重铸模式，不允许出牌
    if (reforgeState.value.active) {
      return false
    }
    
    const player = currentPlayer.value
    
    // 玩家必须在action阶段，AI可以在decision阶段
    if (player.id === 'player' && gameState.value.phase !== 'action') {
      return false
    }
    
    // 检查是否已经出过牌且没有额外出牌机会
    if (hasPlayedThisTurn.value && !canPlayExtra.value) {
      gameState.value.message = '本回合已经出过牌了！'
      return false
    }
    
    const card = player.hand[cardIndex]
    
    if (!card) return false
    
    // 检查费用
    if (player.currentCost < card.cost) {
      gameState.value.message = `费用不足！需要 ${card.cost}，当前 ${player.currentCost}`
      return false
    }
    
    // 检查槽位（AI需要考虑隐藏的卡牌）
    const usedSlots = player.id === 'ai' 
      ? player.field.length + aiHiddenCards.value.length 
      : player.field.length
      
    if (usedSlots >= 6) {
      gameState.value.message = '场上已满，无法打出更多卡牌'
      return false
    }
    
    // 支付费用
    player.currentCost -= card.cost
    
    // 从手牌移除
    player.hand.splice(cardIndex, 1)
    
    // 标记已出牌
    if (hasPlayedThisTurn.value && canPlayExtra.value) {
      // 使用了额外出牌机会
      canPlayExtra.value = false
    } else {
      hasPlayedThisTurn.value = true
    }
    
    // 如果是AI，先隐藏卡牌
    if (player.id === 'ai') {
      aiHiddenCards.value.push(card)
      gameState.value.message = `AI 打出了一张牌（已隐藏）`
    } else {
      // 玩家直接显示
      player.field.push(card)
      gameState.value.message = `${player.name} 打出了 ${card.name}（费用-${card.cost}，战力+${card.power}）`
      
      // 触发效果
      triggerCardEffect(card, player)
      
      // 检查是否填满场地
      checkFieldFull()
    }
    
    return true
  }

  // 触发卡牌效果
  function triggerCardEffect(card: Card, player: Player) {
    if (!card.effectType || card.effectType === 'none') return
    
    switch (card.effectType) {
      case 'draw':
        const drawnCard = drawCard(player)
        if (drawnCard) {
          gameState.value.message += ` | 效果：抽了 ${drawnCard.name}`
        }
        break
        
      case 'gainCost':
        player.currentCost += 1
        gameState.value.message += ` | 效果：恢复1费用`
        break
        
      case 'gainPower':
        player.bonusPower += 2
        gameState.value.message += ` | 效果：总战力+2`
        break
        
      case 'extraPlay':
        canPlayExtra.value = true
        gameState.value.message += ` | 效果：可以再打出一张牌！`
        break
    }
  }

  // 选择重铸的手牌
  function selectReforgeCard(cardIndex: number) {
    if (!reforgeState.value.active) return
    reforgeState.value.selectedCard = cardIndex
  }
  
  // 执行重铸
  function executeReforge(options: [ReforgeOption, ReforgeOption]) {
    const player = currentPlayer.value
    let message = `${player.name} 重铸：`
    
    // 立即锁定阶段，防止玩家继续操作
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
          // 玩家选择一张手牌放回牌组底部，然后抽一张
          if (player.id === 'player' && reforgeState.value.selectedCard !== null) {
            const card = player.hand.splice(reforgeState.value.selectedCard, 1)[0]
            player.deck.unshift(card) // 放到牌组底部
            const newCard = drawCard(player)
            message += ` 换牌(${card.name}→${newCard?.name})`
            reforgeState.value.selectedCard = null
          } else if (player.id === 'ai' && player.hand.length > 0) {
            // AI随机选择
            const cardIndex = Math.floor(Math.random() * player.hand.length)
            const card = player.hand.splice(cardIndex, 1)[0]
            player.deck.unshift(card)
            const newCard = drawCard(player)
            message += ` 换牌`
          }
          break
      }
      if (index === 0) message += ' +'
    })
    
    gameState.value.message = message
    reforgeState.value.active = false
    reforgeState.value.selectedCard = null
    
    // 只有玩家重铸时才显示AI的隐藏卡牌
    if (player.id === 'player') {
      revealAICards()
    }
    
    // 重铸后自动结束回合
    setTimeout(() => endTurn(), 1500)
  }

  // 检查场地是否填满
  function checkFieldFull() {
    const player = currentPlayer.value
    
    // 计算实际使用的槽位（AI需要包括隐藏的卡牌）
    const usedSlots = player.id === 'ai' 
      ? player.field.length + aiHiddenCards.value.length 
      : player.field.length
    
    if (usedSlots === 6 && !gameState.value.isFinalRound) {
      gameState.value.isFinalRound = true
      gameState.value.finalRoundTriggeredBy = gameState.value.currentPlayerIndex
      gameState.value.message += ` | ${player.name} 填满了场地！进入最后一回合！`
    }
  }

  // 切换到下一个玩家
  function switchToNextPlayer() {
    // 切换玩家：0 -> 1 或 1 -> 0
    const nextPlayerIndex = 1 - gameState.value.currentPlayerIndex
    
    // 如果是最后一回合，检查是否应该结束游戏
    if (gameState.value.isFinalRound) {
      const triggeredPlayer = gameState.value.finalRoundTriggeredBy!
      
      // 如果下一个玩家是触发者，说明所有其他玩家都完成了最后一回合
      if (nextPlayerIndex === triggeredPlayer) {
        // 显示AI的隐藏卡牌
        if (aiHiddenCards.value.length > 0) {
          revealAICards()
        }
        setTimeout(() => endGame(), 2000)
        return
      }
    }
    
    gameState.value.currentPlayerIndex = nextPlayerIndex
    
    // 如果切换回AI（玩家 -> AI），回合数+1
    if (nextPlayerIndex === 1) {
      gameState.value.round++
    }
    
    // 进入下一个抽牌阶段
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
    
    // 计算总战力
    const powers = gameState.value.players.map(player => {
      const fieldPower = player.field.reduce((sum, card) => sum + card.power, 0)
      return fieldPower + player.bonusPower
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

  // AI回合逻辑（简单版）
  function aiTurn() {
    // 检查游戏是否已经结束
    if (gameState.value.phase === 'gameOver') {
      return
    }
    
    const ai = gameState.value.players[1] // 明确使用AI玩家
    
    // 检查AI的实际槽位使用情况（包括隐藏的卡牌）
    const aiTotalCards = ai.field.length + aiHiddenCards.value.length
    
    // 简单策略：如果有牌能打就打，否则重铸
    const playableCards = ai.hand.filter(card => card.cost <= ai.currentCost && aiTotalCards < 6)
    
    if (playableCards.length > 0 && Math.random() > 0.3) {
      // 70%概率出牌
      const cardIndex = ai.hand.indexOf(playableCards[0])
      playCard(cardIndex)
      
      gameState.value.message = `AI 打出了一张牌（已隐藏），等待玩家操作...`
      
      // AI打完后切换到玩家
      setTimeout(() => {
        if (gameState.value.phase !== 'gameOver') {
          switchToNextPlayer()
        }
      }, 1500)
    } else {
      // 重铸
      const options: [ReforgeOption, ReforgeOption] = ['gainCost', 'gainPower']
      gameState.value.message = `AI 选择了重铸`
      
      setTimeout(() => {
        if (gameState.value.phase === 'gameOver') {
          return
        }
        
        // 直接操作AI玩家
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
        
        // 切换到玩家
        setTimeout(() => {
          if (gameState.value.phase !== 'gameOver') {
            switchToNextPlayer()
          }
        }, 1000)
      }, 1000)
    }
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
    playCard,
    selectReforgeCard,
    executeReforge,
    endTurn
  }
}
