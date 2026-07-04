import type { GameState, Player, Card, ReforgeOption, FieldSlot, AccountState, AttributeType } from '@/types/game'
import { createDeck, shuffleDeck, initializeCardDatabase } from '@/data/cards'
import { createDeckFromCardIds, getDefaultDeckCardIds } from '@/data/cardDatabase'
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
        id: 'ai_1',
        name: 'AI 1',
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
  const otherPlayers = computed(() => gameState.value.players.filter((_, i) => i !== gameState.value.currentPlayerIndex))
  const humanPlayerId = computed(() => gameState.value.players[0].id)
  const aiHiddenCards = ref<Record<string, Array<{ card: Card, slot: number }>>>({})
  const reforgeState = ref<{ active: boolean; selectedCard: number | null; hasChosen: boolean }>({
    active: false,
    selectedCard: null,
    hasChosen: false
  })
  
  // 用于UI显示的计算属性
  const hasPlayedThisTurn = computed(() => currentPlayer.value.hasPlayedThisTurn)
  const canPlayExtra = computed(() => currentPlayer.value.canPlayExtra)

  // 初始化游戏
  function initGame(playerCount: number = 2) {
    // 构建玩家数组：人类玩家(index 0) + AI玩家
    const players: Player[] = [
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
      }
    ]
    
    for (let i = 1; i < playerCount; i++) {
      players.push({
        id: `ai_${i}`,
        name: `AI ${i}`,
        hand: [],
        deck: [],
        field: createInitialSlots(),
        discard: [],
        currentCost: 4,
        bonusPower: 0,
        canPlayExtra: false,
        hasPlayedThisTurn: false
      })
    }
    
    gameState.value.players = players
    gameState.value.playerCount = playerCount
    
    // Determine deck for human player (index 0): use custom deck from account if available
    let humanDeckCardIds: string[] | null = null
    try {
      const raw = localStorage.getItem('accountState')
      if (raw) {
        const account: AccountState = JSON.parse(raw)
        if (account.deckCardIds && account.deckCardIds.length === 15) {
          humanDeckCardIds = account.deckCardIds
        }
      }
    } catch { /* use default deck */ }
    
    gameState.value.players.forEach((player, idx) => {
      if (idx === 0 && humanDeckCardIds) {
        player.deck = shuffleDeck(createDeckFromCardIds(humanDeckCardIds))
      } else {
        player.deck = shuffleDeck(createDeck())
      }
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
    gameState.value.rankings = undefined
    aiHiddenCards.value = {}
    reforgeState.value = { active: false, selectedCard: null, hasChosen: false }
    gameState.value.selectedCard = undefined
    gameState.value.selectedSlot = undefined
    gameState.value.message = `回合 1 - AI ${gameState.value.currentPlayerIndex}先手`
    
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

    if (EffectManager.playerMustSkipTurn(currentPlayer.value, gameState.value)) {
      EffectManager.clearTurnRestrictions(currentPlayer.value)
      gameState.value.message = `${currentPlayer.value.name} 无法打出要求类型的牌，跳过回合`
      setTimeout(() => switchToNextPlayer(), 1500)
      return
    }
    
    // 重置当前玩家的出牌状态
    currentPlayer.value.hasPlayedThisTurn = false
    currentPlayer.value.canPlayExtra = false
    reforgeState.value.hasChosen = false
    
    if (currentPlayer.value.skipDrawNextRound) {
      currentPlayer.value.skipDrawNextRound = false
      gameState.value.message = `${currentPlayer.value.name} 本回合不抽牌`
    } else {
      const card = drawCard(currentPlayer.value)
      
      if (currentPlayer.value.id.startsWith('ai')) {
        gameState.value.message = `${currentPlayer.value.name} 抽了一张牌`
      } else {
        if (card) {
          gameState.value.message = `${currentPlayer.value.name} 抽了一张牌：${card.name}`
        } else {
          gameState.value.message = `${currentPlayer.value.name} 牌组已空，无法抽牌`
        }
      }
    }
    
    setTimeout(() => {
      gameState.value.phase = 'decision'
      
      if (currentPlayer.value.id.startsWith('ai')) {
        gameState.value.message = `${currentPlayer.value.name} 正在思考...`
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

    if (!EffectManager.canPlayHandCard(card, currentPlayer.value, gameState.value)) {
      if (EffectManager.isHandCardLocked(currentPlayer.value, card, gameState.value)) {
        gameState.value.message = '该手牌已被封锁，仅最后一轮可打出'
      } else if (!EffectManager.meetsPlayTypeRestriction(card, currentPlayer.value)) {
        gameState.value.message = `本回合只能打出${currentPlayer.value.restrictNextPlayType}牌`
      } else {
        gameState.value.message = '场上条件不满足，无法打出此牌'
      }
      return
    }

    if (card.quickPlay) {
      handleQuickPlayCard(card, currentPlayer.value)
      return
    }
    
    const effCost = EffectManager.getEffectivePlayCost(card, currentPlayer.value)
    if (currentPlayer.value.currentCost < effCost) {
      gameState.value.message = `费用不足！需要 ${effCost}，当前 ${currentPlayer.value.currentCost}`
      return
    }
    
    gameState.value.selectedCard = card

    if (EffectManager.requiresCrossPlayerDeploy(card)) {
      const options = EffectManager.getCrossPlayerDeployOptions(gameState.value, currentPlayer.value, card)
      gameState.value.availableCrossPlayerSlots = options
      gameState.value.phase = 'selectCrossPlayerSlot'
      if (options.length === 0) {
        gameState.value.message = '没有可部署的目标玩家槽位！'
        gameState.value.phase = 'action'
        gameState.value.selectedCard = undefined
        return
      }
      gameState.value.message = `选择一名拥有水环境的玩家槽位打出 ${card.name}`
      return
    }

    if (EffectManager.getDeployOnHostEffect(card)?.allowNormalDeploy && !card.quickPlay) {
      const hostTargets = EffectManager.getQuickPlayHostTargets(currentPlayer.value, card)
      if (hostTargets.length > 0) {
        gameState.value.pendingHostDeployCard = card
        gameState.value.optionalHostDeploy = true
        gameState.value.availableTargets = hostTargets
        gameState.value.phase = 'selectTarget'
        gameState.value.message = `选择 ${card.name} 的宿主（土属性环境）或取消后选空槽`
        return
      }
    }

    if (EffectManager.requiresMandatoryHostDeploy(card) && !card.quickPlay) {
      const targets = EffectManager.getQuickPlayHostTargets(currentPlayer.value, card)
      if (targets.length === 0) {
        gameState.value.message = '没有可部署的宿主卡牌！'
        gameState.value.phase = 'action'
        gameState.value.selectedCard = undefined
        return
      }
      gameState.value.pendingHostDeployCard = card
      gameState.value.availableTargets = targets
      gameState.value.phase = 'selectTarget'
      gameState.value.message = `选择 ${card.name} 的部署宿主`
      return
    }

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
    return EffectManager.getAvailableSlotIndices(player, card)
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

  function selectCrossPlayerSlotToPlay(targetPlayerIndex: number, slotIndex: number) {
    if (gameState.value.phase !== 'selectCrossPlayerSlot' || !gameState.value.selectedCard) return
    const card = gameState.value.selectedCard
    const cardIndex = currentPlayer.value.hand.indexOf(card)
    if (cardIndex === -1) return
    if (!EffectManager.isValidCrossPlayerDeploySlot(
      gameState.value, currentPlayer.value, card, targetPlayerIndex, slotIndex,
    )) {
      gameState.value.message = '无效的部署目标'
      return
    }
    playCardToSlot(cardIndex, slotIndex, targetPlayerIndex)
    gameState.value.availableCrossPlayerSlots = undefined
    gameState.value.selectedDeployPlayerIndex = undefined
  }

  function isCrossPlayerSlotAvailable(playerIndex: number, slotIndex: number): boolean {
    if (gameState.value.phase !== 'selectCrossPlayerSlot') return false
    return !!gameState.value.availableCrossPlayerSlots?.some(
      o => o.playerIndex === playerIndex && o.slotIndex === slotIndex,
    )
  }

  // 打出卡牌到指定槽位（可选 targetPlayerIndex 跨玩家部署）
  function playCardToSlot(cardIndex: number, slotIndex: number, targetPlayerIndex?: number) {
    const player = currentPlayer.value
    const card = player.hand[cardIndex]
    
    if (!card) return

    const fieldOwner = targetPlayerIndex !== undefined
      ? gameState.value.players[targetPlayerIndex]
      : player
    if (!fieldOwner) return
    
    // QuickPlay gate: skip cost/action for quickPlay cards
    if (card.quickPlay) {
      handleQuickPlayCard(card, player)
      return
    }
    
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
    EffectManager.consumeTacticPlayFreeIfMatch(card, player)
    
    // AI隐藏卡牌
    if (player.id.startsWith('ai')) {
      if (!aiHiddenCards.value[player.id]) {
        aiHiddenCards.value[player.id] = []
      }
      aiHiddenCards.value[player.id].push({ card, slot: slotIndex })
      gameState.value.message = `${player.name} 打出了一张牌（已隐藏）`
      gameState.value.selectedCard = undefined
      gameState.value.phase = 'decision'
    } else {
      // 玩家直接部署
      deployCard(card, fieldOwner, slotIndex)
    }
  }

  // 处理快速打出（跳过费用/行动检查）
  function handleQuickPlayCard(card: Card, player: Player) {
    // Mark selected card (for UI synchronization)
    gameState.value.selectedCard = card
    
    // Remove from hand (no cost deduction, no action marking)
    const cardIndex = player.hand.indexOf(card)
    if (cardIndex !== -1) player.hand.splice(cardIndex, 1)
    
    // Fire ALL onPlay effects
    card.effects.forEach(effect => {
      if (effect.timing !== 'onPlay') return
      
      if (effect.type === 'restoreEnergy') {
        player.currentCost += (effect.value || 0)
        gameState.value.message = `${player.name} 使用${card.name}：恢复${effect.value}点能量`
      }
      else if (effect.type === 'modifyPowerByName') {
        const targetName = effect.targetName || ''
        const targets = player.field
          .filter(s => s.card && s.card.name.includes(targetName))
          .map(s => s.card!)
        targets.forEach(t => {
          const oldPower = t.currentPower
          t.currentPower += (effect.value || 0)
          gameState.value.message += ` | ${t.name} 战力${oldPower}→${t.currentPower}`
        })
        if (targets.length === 0) {
          gameState.value.message += ` | 没有找到包含"${targetName}"的卡牌`
        }
      }
      else if (effect.type === 'reduceUnitPower') {
        const otherPlayers = gameState.value.players.filter(p => p.id !== player.id)
        let applied = false
        for (const opponent of otherPlayers) {
          const targetSlot = opponent.field.find(s => s.card && s.card.type === 'unit')
          if (targetSlot && targetSlot.card) {
            const target = targetSlot.card
            const oldPower = target.currentPower
            target.currentPower -= (effect.value || 0)
            gameState.value.message += ` | ${target.name} 战力${oldPower}→${target.currentPower}`
            if (target.currentPower <= 0) {
              targetSlot.card = null
              gameState.value.message += ` | ${target.name} 被摧毁`
            }
            applied = true
            break
          }
        }
        if (!applied) {
          gameState.value.message += ` | 没有可攻击的目标`
        }
      }
      else if (effect.type === 'discardOpponentHand') {
        const otherPlayers = gameState.value.players.filter(p => p.id !== player.id)
        for (const opponent of otherPlayers) {
          if (opponent.hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * opponent.hand.length)
            const discarded = opponent.hand.splice(randomIndex, 1)[0]
            opponent.discard.push(discarded)
            gameState.value.message += ` | ${opponent.name} 弃置了${discarded.name}`
          }
        }
      }
      else if (effect.type === 'returnToDeckBottom') {
        player.deck.unshift(card)
        gameState.value.message += ` | ${card.name} 返回牌库底部`
      }
      else if (effect.type === 'setNextUnitAttribute') {
        player.pendingNextAttribute = effect.value as string
        gameState.value.message += ` | 下次部署的单位牌将变为${effect.value}属性`
      }
      else if (effect.type === 'markOpponentHand') {
        const otherPlayers = gameState.value.players.filter(p => p.id !== player.id)
        for (const opponent of otherPlayers) {
          if (opponent.hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * opponent.hand.length)
            opponent.hand[randomIndex].markedForDiscard = true
            gameState.value.message += ` | ${opponent.name} 的手牌被标记`
          }
        }
      }
    })
    
    // QuickPlay units need target selection on field (deploy onto existing card)
    if (card.type === 'unit') {
      const fieldCards = EffectManager.getQuickPlayHostTargets(player, card)
      if (fieldCards.length === 0) {
        gameState.value.message = EffectManager.requiresDeployOnHost(card)
          ? `${card.name} 只能部署在带有「农田」或「载具」关键词的卡牌上`
          : '场上没有可部署的目标'
        // Unit goes to discard since it can't be deployed
        player.discard.push(card)
        gameState.value.phase = 'action'
        gameState.value.selectedCard = undefined
        gameState.value.selectedSlot = undefined
        return
      }
      // Save pending card and switch to target selection
      gameState.value.pendingQuickPlayCard = card
      gameState.value.availableTargets = fieldCards
      gameState.value.phase = 'selectTarget'
      gameState.value.message = `选择${card.name}的部署目标`
      return
    }

    // QuickPlay tactic cards go directly to discard (unless returned to deck)
    const hasReturnToDeck = card.effects.some(e => e.type === 'returnToDeckBottom')
    if (card.type === 'tactic' && !hasReturnToDeck) {
      player.discard.push(card)
    }

    // Trigger onOtherPlayEffects (other cards on field may react to this play)
    EffectManager.triggerOnOtherPlayEffects(card, player, gameState.value)

    // Recalculate all powers
    EffectManager.recalculateAllPowers(gameState.value)

    // Reset selection state
    gameState.value.phase = 'action'
    gameState.value.selectedCard = undefined
    gameState.value.selectedSlot = undefined
  }

  // 部署卡牌
  function deployCard(card: Card, player: Player, slotIndex: number) {
    const slot = player.field[slotIndex]
    if (!slot) return
    
    // Apply pending attribute override from 元素墙
    if (player.pendingNextAttribute) {
      card.attribute = player.pendingNextAttribute as AttributeType
      gameState.value.message = `${player.name} 打出了 ${card.name}（属性变更为${player.pendingNextAttribute}）`
      player.pendingNextAttribute = undefined
    }

    // 气泡酒 / 萨满祭司等：单位部署加成
    EffectManager.applyUnitDeployBonuses(card, player).forEach(msg => {
      gameState.value.message += ` | ${msg}`
    })

    // 额外槽位部署修饰（海港 +3、不计终局等）
    EffectManager.applyExtraSlotDeployModifiers(card, slot).forEach(msg => {
      gameState.value.message += ` | ${msg}`
    })
    
    // 放置卡牌
    slot.card = card
    
    gameState.value.message = `${player.name} 打出了 ${card.name}`
    
    // 战术牌：先 onDeploy，再 onReveal
    if (card.type === 'tactic') {
      const pending = triggerDeployEffects(card, player)
      if (pending) {
        gameState.value.selectedCard = card
        gameState.value.selectedSlot = slotIndex
        gameState.value.pendingDeployEffect = pending.effect
        gameState.value.availableTargets = pending.targets
        gameState.value.phase = 'selectTarget'
        gameState.value.message += ' | 选择摧毁目标'
        return
      }
      handleTacticCard(card, player, slotIndex)
      return
    }
    
    // 触发部署效果
    triggerDeployEffects(card, player)
    
    // 触发"其他卡牌打出时"的效果（法师、战士、矮人铁匠）
    EffectManager.triggerOnOtherPlayEffects(card, player, gameState.value)
    
    // 重新计算战力
    EffectManager.recalculateAllPowers(gameState.value)
    
    // 检查是否填满场地（跨玩家部署时检查目标玩家）
    checkFieldFull(fieldOwner)
    
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
        effect, card, player, gameState.value, otherPlayers.value,
      )
      result.messages.forEach(msg => {
        gameState.value.message += ` | ${msg}`
      })
      if (effect.type === 'modifyCost') {
        otherPlayers.value.forEach(target => {
          if (target.id.startsWith('ai') && aiHiddenCards.value[target.id]?.length > 0) {
            checkAIHiddenCardsAfterCostChange(target)
          }
        })
      }
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
  function selectTacticTarget(targetCard: Card) {
    if (gameState.value.phase !== 'selectTarget' || !gameState.value.selectedCard) return

    const card = gameState.value.selectedCard
    const deployEffect = gameState.value.pendingDeployEffect
    const revealEffect = card.effects.find(e => e.timing === 'onReveal' && e.type !== 'conditional' && e.type !== 'custom')
    const effect = deployEffect || revealEffect

    if (effect?.type === 'destroy') {
      const r = EffectManager.applyDestroyToTarget(targetCard, effect, gameState.value)
      r.messages.forEach(msg => { gameState.value.message += ` | ${msg}` })
      EffectManager.recalculateAllPowers(gameState.value)
    } else if (effect && (effect.value || effect.useD6Value)) {
      const delta = effect.useD6Value ? EffectManager.rollD6() : (effect.value as number)
      targetCard.currentPower += delta
      gameState.value.message += ` | ${targetCard.name} 战力+${delta}${effect.useD6Value ? `(D6=${delta})` : ''}`
    }

    const slotIndex = currentPlayer.value.field.findIndex(s => s.card === card)
    gameState.value.pendingDeployEffect = undefined
    gameState.value.availableTargets = []

    if (deployEffect && slotIndex !== -1) {
      handleTacticCard(card, currentPlayer.value, slotIndex)
      gameState.value.phase = 'action'
      gameState.value.selectedCard = undefined
      return
    }

    if (slotIndex !== -1) {
      discardTacticCard(card, currentPlayer.value, slotIndex)
    }
    gameState.value.phase = 'action'
    gameState.value.selectedCard = undefined
  }

  // 选择QuickPlay单位牌的部署目标（部署到现有场上卡牌上）
  function selectQuickPlayTarget(targetCard: Card) {
    if (gameState.value.phase !== 'selectTarget') return
    if (!gameState.value.pendingQuickPlayCard && !gameState.value.pendingHostDeployCard && gameState.value.selectedCard) {
      selectTacticTarget(targetCard)
      return
    }

    if (gameState.value.pendingHostDeployCard) {
      const card = gameState.value.pendingHostDeployCard
      const player = currentPlayer.value
      if (!EffectManager.isValidDeployOnHost(card, targetCard)) {
        gameState.value.message = `${card.name} 无法部署到该卡牌上`
        return
      }
      const cardIndex = player.hand.indexOf(card)
      if (cardIndex === -1) return
      const playCost = EffectManager.getEffectivePlayCost(card, player)
      player.currentCost -= playCost
      player.hand.splice(cardIndex, 1)
      if (player.hasPlayedThisTurn && player.canPlayExtra) {
        player.canPlayExtra = false
      } else {
        player.hasPlayedThisTurn = true
      }
      EffectManager.consumeTacticPlayFreeIfMatch(card, player)
      const msgs = EffectManager.applyDeployOntoHost(card, targetCard, player, gameState.value)
      gameState.value.message = msgs.join(' | ')
      gameState.value.pendingHostDeployCard = undefined
      gameState.value.optionalHostDeploy = undefined
      gameState.value.phase = 'action'
      gameState.value.selectedCard = undefined
      gameState.value.availableTargets = []
      return
    }

    if (!gameState.value.pendingQuickPlayCard && gameState.value.selectedCard) {
      selectTacticTarget(targetCard)
      return
    }
    const card = gameState.value.pendingQuickPlayCard
    if (!card) return

    const player = currentPlayer.value

    if (!EffectManager.isValidDeployOnHost(card, targetCard)) {
      gameState.value.message = `${card.name} 无法部署到该卡牌上`
      gameState.value.phase = 'action'
      gameState.value.pendingQuickPlayCard = undefined
      gameState.value.availableTargets = []
      player.discard.push(card)
      return
    }

    // Deploy onto card
    const msgs = EffectManager.applyDeployOntoHost(card, targetCard, player, gameState.value)
    if (msgs.length > 0) {
      gameState.value.message = msgs.join(' | ')
    }

    // Clean up
    gameState.value.pendingQuickPlayCard = undefined
    gameState.value.phase = 'action'
    gameState.value.selectedCard = undefined
    gameState.value.availableTargets = []
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
  function checkAIHiddenCardsAfterCostChange(aiPlayer: Player) {
    const hidden = aiHiddenCards.value[aiPlayer.id]
    if (!hidden) return
    
    const invalidCards: typeof hidden = []
    
    aiHiddenCards.value[aiPlayer.id] = hidden.filter(item => {
      if (aiPlayer.currentCost < EffectManager.getEffectivePlayCost(item.card, aiPlayer)) {
        invalidCards.push(item)
        return false
      }
      return true
    })
    
    if (invalidCards.length > 0) {
      invalidCards.forEach(item => {
        aiPlayer.discard.push(item.card)
        gameState.value.message += ` | ${aiPlayer.name}的${item.card.name}因费用不足无法打出`
      })
    }
  }

  // 触发部署效果
  function triggerDeployEffects(card: Card, player: Player): { targets: Card[]; effect: CardEffect } | null {
    if (!card.effects) return null

    let pendingTarget: { targets: Card[]; effect: CardEffect } | null = null

    card.effects.forEach(effect => {
      if (effect.timing === 'onDeploy') {
        if (effect.type === 'conditional' || effect.type === 'custom') return
        const result = EffectManager.applyDeployEffect(effect, card, player, gameState.value)
        result.messages.forEach(msg => {
          gameState.value.message += ` | ${msg}`
        })
        if (result.needsCreateSlot) {
          createExtraSlot(card, player, effect)
        }
        if (result.needsTargetSelection) {
          pendingTarget = result.needsTargetSelection
        }
      } else if (effect.timing === 'onReveal') {
        if (effect.type === 'conditional' || effect.type === 'custom') return
        const result = EffectManager.applyRevealEffect(
          effect, card, player, gameState.value, otherPlayers.value,
        )
        result.messages.forEach(msg => {
          gameState.value.message += ` | ${msg}`
        })
      }
    })

    return pendingTarget
  }

  // 创建额外槽位
  function createExtraSlot(parentCard: Card, player: Player, effect?: CardEffect) {
    const parentSlotIndex = player.field.findIndex(s => s.card === parentCard)
    if (parentSlotIndex === -1) return
    
    const rules = effect ? EffectManager.slotRulesFromEffect(effect) : undefined
    player.field.push(EffectManager.buildExtraSlot(parentSlotIndex, player.field.length, rules))
    gameState.value.message += ` | 创建了额外槽位`
  }

  // 显示AI隐藏卡牌
  function revealAICards() {
    const allHiddenCount = Object.values(aiHiddenCards.value).reduce((sum, cards) => sum + cards.length, 0)
    if (allHiddenCount === 0) return
    
    const names: string[] = []
    for (const aiId of Object.keys(aiHiddenCards.value)) {
      const hidden = aiHiddenCards.value[aiId]
      if (hidden.length === 0) continue
      const aiPlayer = gameState.value.players.find(p => p.id === aiId)
      if (!aiPlayer) continue
      names.push(`${aiPlayer.name} ${hidden.length}张`)
      hidden.forEach(item => {
        deployCard(item.card, aiPlayer, item.slot)
      })
    }
    
    aiHiddenCards.value = {}
    gameState.value.message = `AI 打出了 ${allHiddenCount} 张牌！（${names.join('，')}）`
    
    setTimeout(() => {
      if (gameState.value.phase === 'action') {
        gameState.value.message = `${gameState.value.players[0].name} - 选择手牌打出`
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
          if (!player.id.startsWith('ai') && reforgeState.value.selectedCard !== null) {
            const card = player.hand.splice(reforgeState.value.selectedCard, 1)[0]
            player.deck.unshift(card)
            const newCard = drawCard(player)
            message += ` 换牌(${card.name}→${newCard?.name})`
            reforgeState.value.selectedCard = null
          } else if (player.id.startsWith('ai') && player.hand.length > 0) {
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

    EffectManager.triggerReforgeEffects(player, gameState.value)
    
    if (!player.id.startsWith('ai')) {
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
  function countMainFieldCards(player: Player) {
    return EffectManager.countMainFieldCardsForLimit(player)
  }

  function updateFinalRoundRestrictions() {
    gameState.value.playerRestrictions = {}
    if (!gameState.value.isFinalRound) return
    gameState.value.players.forEach(player => {
      if (countMainFieldCards(player) >= 6) {
        if (gameState.value.players.length === 2) {
          gameState.value.playerRestrictions[player.id] = ['cannotPlay']
        } else {
          gameState.value.playerRestrictions[player.id] = ['tacticsOnly']
        }
      }
    })
  }

  function checkFieldFull(fieldOwner?: Player) {
    const player = fieldOwner ?? currentPlayer.value
    const filledMainSlots = countMainFieldCards(player)
    
    if (filledMainSlots === 6 && !gameState.value.isFinalRound) {
      gameState.value.isFinalRound = true
      gameState.value.finalRoundTriggeredBy = gameState.value.players.findIndex(p => p.id === player.id)
      gameState.value.message += ` | ${player.name} 填满了场地！进入最后一回合！`
      updateFinalRoundRestrictions()
    }
  }

  // 切换玩家
  function switchToNextPlayer() {
    const prevPlayerIndex = gameState.value.currentPlayerIndex
    EffectManager.clearTurnRestrictions(gameState.value.players[prevPlayerIndex])
    const nextPlayerIndex = (prevPlayerIndex + 1) % gameState.value.players.length
    
    if (gameState.value.isFinalRound) {
      const triggeredPlayer = gameState.value.finalRoundTriggeredBy!
      
      if (nextPlayerIndex === triggeredPlayer) {
        const hasHidden = Object.values(aiHiddenCards.value).some(cards => cards.length > 0)
        if (hasHidden) {
          revealAICards()
        }
        setTimeout(() => endGame(), 2000)
        return
      }
    }

    const roundComplete = gameState.value.players.length > 1 && nextPlayerIndex <= prevPlayerIndex
    gameState.value.currentPlayerIndex = nextPlayerIndex
    
    if (roundComplete) {
      EffectManager.triggerRoundEffects('roundEnd', gameState.value)
      gameState.value.players.forEach(p => { p.unitPlayPowerBonus = 0 })
      gameState.value.round++
      updateFinalRoundRestrictions()
      EffectManager.triggerRoundEffects('roundStart', gameState.value)
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
    
    EffectManager.triggerGameEndEffects(gameState.value)
    
    const ranking = gameState.value.players.map((player, index) => {
      let totalPower = player.bonusPower
      player.field.forEach(slot => {
        if (slot.card && !slot.isExtra) {
          totalPower += slot.card.currentPower
        }
      })
      return { playerIndex: index, playerName: player.name, power: totalPower }
    })
    
    ranking.sort((a, b) => b.power - a.power)
    gameState.value.rankings = ranking
    
    const rankNames = ['1st', '2nd', '3rd', '4th', '5th', '6th']
    gameState.value.message = '游戏结束！\n'
    ranking.forEach((r, i) => {
      gameState.value.message += `${rankNames[i] || `${i+1}th`}: ${r.playerName} (战力: ${r.power})\n`
    })
    
    const humanPlayer = gameState.value.players[0]
    const humanRank = ranking.findIndex(r => r.playerIndex === 0)
    if (humanRank === 0) {
      gameState.value.winner = 0
      gameState.value.message += `${humanPlayer.name}获胜！🎉`
    } else {
      gameState.value.winner = 1
      gameState.value.message += `${ranking[0].playerName}获胜！`
    }
  }

  // AI回合
  function aiTurn() {
    if (gameState.value.phase === 'gameOver') return
    
    const ai = currentPlayer.value
    const filledMainSlots = countMainFieldCards(ai)
    const aiHiddenCount = (aiHiddenCards.value[ai.id]?.length || 0)
    const aiTotalCards = filledMainSlots + aiHiddenCount
    const restrictions = gameState.value.playerRestrictions?.[ai.id]
    if (restrictions?.includes('cannotPlay')) {
      setTimeout(() => switchToNextPlayer(), 800)
      return
    }
    
    const playableCards = ai.hand.filter(card => {
      if (restrictions?.includes('tacticsOnly') && card.type !== 'tactic') return false
      if (card.type !== 'tactic' && aiTotalCards >= 6) return false
      return EffectManager.getEffectivePlayCost(card, ai) <= ai.currentCost
    })
    
    if (playableCards.length > 0 && Math.random() > 0.3) {
      const cardIndex = ai.hand.indexOf(playableCards[0])
      const availableSlots = getAvailableSlots(ai, playableCards[0])
      
      if (availableSlots.length > 0) {
        const slotIndex = availableSlots[0]
        playCardToSlot(cardIndex, slotIndex)
        
        gameState.value.message = `${ai.name} 打出了一张牌（已隐藏），等待玩家操作...`
        
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
    gameState.value.message = `${ai.name} 选择了重铸`
    
    setTimeout(() => {
      if (gameState.value.phase === 'gameOver') return
      
      const aiPlayer = currentPlayer.value
      let message = `${aiPlayer.name} 重铸：`
      
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

  // 检查卡牌是否可打出
  function isCardPlayable(index: number): boolean {
    if (gameState.value.phase !== 'action') return false
    if (currentPlayer.value.id.startsWith('ai')) return false
    if (reforgeState.value.active) return false
    
    const restrictions = gameState.value.playerRestrictions?.[currentPlayer.value.id]
    if (restrictions) {
      if (restrictions.includes('cannotPlay')) return false
    }
    
    const card = currentPlayer.value.hand[index]
    if (!card) return false
    
    if (restrictions?.includes('tacticsOnly') && card.type !== 'tactic') {
      return false
    }
    
    if (hasPlayedThisTurn.value && !canPlayExtra.value) {
      return false
    }
    
    return currentPlayer.value.currentCost >= EffectManager.getEffectivePlayCost(card, currentPlayer.value)
  }

  return {
    gameState,
    currentPlayer,
    otherPlayers,
    humanPlayerId,
    aiHiddenCards,
    reforgeState,
    hasPlayedThisTurn,
    canPlayExtra,
    initGame,
    choosePlay,
    chooseReforge,
    selectCardToPlay,
    selectSlotToPlay,
    selectCrossPlayerSlotToPlay,
    isCrossPlayerSlotAvailable,
    selectTacticTarget,
    selectQuickPlayTarget,
    selectReforgeCard,
    executeReforge,
    endTurn,
    isCardPlayable
  }
}
