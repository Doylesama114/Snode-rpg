// 服务器端游戏引擎 - 权威游戏逻辑
// 完整移植自客户端 useGameMultiplayer.ts 和 effectManager.ts

import { getCard, createDefaultDeck, createDeckFromCardIds, shuffleDeck } from './cardData.js'

// 效果管理器（从 effectManager.ts 完整移植）
class EffectManager {
  // 检查卡牌是否有指定关键词（包括名称检查）
  static hasKeyword(card, keyword) {
    if (!card || !card.keywords) return false
    // 检查关键词数组
    if (card.keywords.includes(keyword)) {
      return true
    }
    // 检查名称中是否包含关键词
    if (card.name.includes(keyword)) {
      return true
    }
    return false
  }

  // 检查卡牌是否有任意一个关键词
  static hasAnyKeyword(card, keywords) {
    if (!keywords || keywords.length === 0) return false
    return keywords.some(keyword => this.hasKeyword(card, keyword))
  }

  // 获取场上所有不同的关键词
  static getUniqueKeywords(player, excludeCard) {
    const keywords = new Set()
    
    player.field.forEach(slot => {
      if (slot.card && slot.card !== excludeCard) {
        slot.card.keywords.forEach(kw => keywords.add(kw))
      }
    })
    
    return Array.from(keywords)
  }

  // 触发自身场上条件修饰效果：这张牌检查场上其他卡牌是否有关键词，满足条件则修改自己战力
  static applyOnFieldSelfModify(game) {
    game.gameState.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card || slot.isExtra) return
        if (!slot.card.effects) return
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onField' && effect.type === 'modifyPower' && effect.selfTarget) {
            if (effect.targetKeywords) {
              // Check if ANY OTHER card on the field has the target keyword
              const hasMatch = player.field.some(otherSlot =>
                otherSlot !== slot && otherSlot.card &&
                EffectManager.hasAnyKeyword(otherSlot.card, effect.targetKeywords)
              )
              const conditionMet = effect.invertCondition ? !hasMatch : hasMatch
              if (conditionMet) {
                if (effect.stackable !== false) {
                  // Count matching cards and multiply
                  const matchCount = player.field.filter(otherSlot =>
                    otherSlot !== slot && otherSlot.card &&
                    EffectManager.hasAnyKeyword(otherSlot.card, effect.targetKeywords)
                  ).length
                  slot.card.stackedBonus = (effect.value || 0) * matchCount
                  if (matchCount > 0) {
                    slot.card.currentPower = slot.card.basePower + slot.card.stackedBonus
                  }
                } else {
                  slot.card.currentPower = slot.card.basePower + (effect.value || 0)
                }
              }
            }
          }
        })
      })
    })
  }

  // 触发"其他卡牌打出时"的效果
  static triggerOnOtherPlayEffects(deployedCard, player, game) {
    const messages = []
    
    player.field.forEach(slot => {
      if (slot.card && slot.card !== deployedCard && slot.card.effects) {
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onOtherPlay' && effect.type === 'modifyPower') {
            // 检查部署的卡牌是否符合条件
            if (effect.targetKeywords && this.hasAnyKeyword(deployedCard, effect.targetKeywords)) {
              // 法师：战术牌且有魔法关键词
              if (slot.card.name === '法师' && deployedCard.type === 'tactic' && this.hasKeyword(deployedCard, '魔法')) {
                const oldPower = slot.card.currentPower
                // 初始化叠加加成
                if (slot.card.stackedBonus === undefined) {
                  slot.card.stackedBonus = 0
                }
                slot.card.stackedBonus += effect.value || 0
                slot.card.currentPower += effect.value || 0
                messages.push(`${slot.card.name}战力${oldPower}→${slot.card.currentPower}`)
              }
              // 战士：有武器关键词的卡牌
              else if (slot.card.name === '战士' && this.hasKeyword(deployedCard, '武器')) {
                const oldPower = slot.card.currentPower
                // 初始化叠加加成
                if (slot.card.stackedBonus === undefined) {
                  slot.card.stackedBonus = 0
                }
                slot.card.stackedBonus += effect.value || 0
                slot.card.currentPower += effect.value || 0
                messages.push(`${slot.card.name}战力${oldPower}→${slot.card.currentPower}`)
              }
              // 矮人铁匠：给部署的卡牌加战力
              else if (slot.card.name === '矮人铁匠' && this.hasAnyKeyword(deployedCard, ['武器', '护甲'])) {
                const oldPower = deployedCard.currentPower
                deployedCard.currentPower += effect.value || 0
                messages.push(`${deployedCard.name}战力${oldPower}→${deployedCard.currentPower}（矮人铁匠加成）`)
              }
            }
          }
        })
      }
    })
    
    if (messages.length > 0) {
      game.message += ` | ${messages.join(' | ')}`
    }
  }

  // 计算见习冒险者的战力
  static calculateApprenticeAdventurerPower(card, player) {
    const uniqueKeywords = this.getUniqueKeywords(player, card)
    return card.basePower + uniqueKeywords.length
  }

  // 计算野猪的战力
  static calculateBoarPower(card, player) {
    let power = card.basePower
    
    // 检查是否有猎人/农夫/冒险者
    const hasNegativeKeyword = player.field.some(slot => 
      slot.card && slot.card !== card && 
      this.hasAnyKeyword(slot.card, ['猎人', '农夫', '冒险者'])
    )
    
    if (hasNegativeKeyword) {
      power -= 2
    }
    
    // 检查是否有农田/森林
    const hasPositiveCard = player.field.some(slot =>
      slot.card && slot.card !== card &&
      (slot.card.name === '农田' || slot.card.name === '森林')
    )
    
    if (hasPositiveCard) {
      power += 2
    }
    
    return power
  }

  // 计算橡木武器店的加成
  static calculateWeaponShopBonus(targetCard) {
    if (this.hasAnyKeyword(targetCard, ['战士', '士兵', '冒险者'])) {
      return 3
    }
    return 0
  }

  // 检查铁匠铺条件
  static checkBlacksmithCondition(player) {
    const hasBlacksmith = player.field.some(slot =>
      slot.card && slot.card.name === '矮人铁匠'
    )
    const hasFurnace = player.field.some(slot =>
      slot.card && slot.card.name === '锻炉'
    )
    const hasPlateArmor = player.field.some(slot =>
      slot.card && slot.card.name === '板甲'
    )
    
    return hasBlacksmith && hasFurnace && hasPlateArmor
  }

  // 计算农田的战力
  static calculateFarmlandPower(farmlandSlot, player) {
    let power = 0
    
    // 检查农田上部署的单位
    player.field.forEach(slot => {
      if (slot.isExtra && slot.parentSlot === farmlandSlot.position && slot.card) {
        if (this.hasKeyword(slot.card, '务农')) {
          power += 1
        }
      }
    })
    
    return power
  }

  // 重新计算所有卡牌的战力
  static recalculateAllPowers(game) {
    game.players.forEach(player => {
      player.field.forEach(slot => {
        if (slot.card) {
          this.recalculateCardPower(slot.card, player, game)
        }
      })
    })
  }

  // 重新计算单张卡牌的战力
  static recalculateCardPower(card, player, game) {
    // 重置为基础战力
    card.currentPower = card.basePower
    
    // 添加叠加的加成（法师、战士等）
    if (card.stackedBonus !== undefined && card.stackedBonus > 0) {
      card.currentPower += card.stackedBonus
    }
    
    // 根据卡牌名称应用特殊计算
    if (card.name === '见习冒险者') {
      card.currentPower = this.calculateApprenticeAdventurerPower(card, player)
    } else if (card.name === '野猪') {
      card.currentPower = this.calculateBoarPower(card, player)
    } else if (card.name === '农田') {
      const farmlandSlot = player.field.find(slot => slot.card === card)
      if (farmlandSlot) {
        card.currentPower = this.calculateFarmlandPower(farmlandSlot, player)
      }
    } else if (card.name === '铁匠铺') {
      if (this.checkBlacksmithCondition(player)) {
        card.currentPower = card.basePower + 15
      }
    }
    
    // 应用橡木武器店的加成
    const hasWeaponShop = player.field.some(slot =>
      slot.card && slot.card.name === '橡木武器店'
    )
    if (hasWeaponShop && card.type === 'unit') {
      card.currentPower += this.calculateWeaponShopBonus(card)
    }
    
    // 应用其他持续效果（但不包括onOtherPlay的效果，那些已经在部署时应用了）
    player.field.forEach(slot => {
      if (slot.card && slot.card !== card) {
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onField' && effect.type === 'modifyPower') {
            // 检查目标是否符合条件
            if (effect.targetKeywords && this.hasAnyKeyword(card, effect.targetKeywords)) {
              if (effect.value) {
                card.currentPower += effect.value
              }
            }
          }
        })
      }
    })
  }

  // 获取可选择的目标卡牌
  static getValidTargets(player, keywords) {
    const targets = []
    
    player.field.forEach(slot => {
      if (slot.card && this.hasAnyKeyword(slot.card, keywords)) {
        targets.push(slot.card)
      }
    })
    
    return targets
  }

  // 检查卡牌是否会被摧毁
  static checkDestroy(card) {
    return card.currentPower < 0 && card.type !== 'environment'
  }
}

// 创建初始槽位
function createInitialSlots() {
  return Array.from({ length: 6 }, (_, i) => ({
    card: null,
    position: i,
    isExtra: false
  }))
}

// 游戏引擎类
class GameEngine {
  constructor(roomId, players, maxPlayers = 2) {
    this.roomId = roomId
    this.maxPlayers = maxPlayers
    
    // 初始化游戏状态
    this.gameState = {
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        hand: [],
        deck: shuffleDeck(
          p.deckCardIds ? createDeckFromCardIds(p.deckCardIds) : createDefaultDeck()
        ),
        field: createInitialSlots(),
        discard: [],
        currentCost: 4,
        bonusPower: 0,
        canPlayExtra: false,
        hasPlayedThisTurn: false
      })),
      currentPlayerIndex: 0,
      round: 1,  // 从回合1开始
      phase: 'decision',  // 初始化后直接进入决策阶段
      isFinalRound: false,
      message: '回合 1 - 选择出牌或重铸',
      // 添加玩家决策状态跟踪
      playerDecisions: {},
      // 添加玩家回合准备状态跟踪
      playerReady: {},
      // 添加待揭示的卡牌跟踪（本回合打出但尚未揭示的卡牌）
      pendingReveals: {}
    }
    
    // 动态初始化玩家决策/准备/揭示状态
    this.gameState.players.forEach(p => {
      this.gameState.playerDecisions[p.id] = { made: false, choice: null }
      this.gameState.playerReady[p.id] = false
      this.gameState.pendingReveals[p.id] = []
    })
    
    // 初始抽3张牌
    this.gameState.players.forEach(player => {
      for (let i = 0; i < 3; i++) {
        this.drawCard(player)
      }
    })
    
    console.log(`[GameEngine] 游戏初始化完成，房间: ${roomId}`)
    console.log(`[GameEngine] 玩家1手牌:`, this.gameState.players[0].hand.map(c => c.name))
    console.log(`[GameEngine] 玩家2手牌:`, this.gameState.players[1].hand.map(c => c.name))
  }
  
  // 抽牌
  drawCard(player) {
    if (player.deck.length === 0) return null
    const card = player.deck.pop()
    player.hand.push(card)
    return card
  }
  
  // 获取玩家索引
  getPlayerIndex(playerId) {
    return this.gameState.players.findIndex(p => p.id === playerId)
  }
  
  // 获取其他玩家索引
  getOtherPlayerIndices(playerIndex) {
    return this.gameState.players.map((_, i) => i).filter(i => i !== playerIndex)
  }
  
  // 处理玩家选择出牌
  handleChoosePlay(playerId) {
    const playerIndex = this.getPlayerIndex(playerId)
    if (playerIndex === -1) {
      return { success: false, error: '玩家不存在' }
    }
    
    const player = this.gameState.players[playerIndex]
    
    console.log(`[GameEngine] handleChoosePlay: 玩家${playerIndex} (${player.name}) 选择出牌`)
    console.log(`[GameEngine] 当前 phase: ${this.gameState.phase}`)
    
    // 记录玩家决策
    this.gameState.playerDecisions[playerId] = { made: true, choice: 'play' }
    
    // 检查是否所有玩家都已决策
    const decidedCount = Object.values(this.gameState.playerDecisions).filter(d => d.made).length
    const allDecided = decidedCount === this.gameState.players.length
    
    if (allDecided) {
      console.log(`[GameEngine] 所有玩家都已决策，进入 action 阶段`)
      this.gameState.phase = 'action'
      
      // 检查所有玩家的决策类型
      const decisions = Object.values(this.gameState.playerDecisions)
      const playCount = decisions.filter(d => d.choice === 'play').length
      const reforgeCount = decisions.filter(d => d.choice === 'reforge').length
      const total = this.gameState.players.length
      
      if (playCount === total) {
        this.gameState.message = `${decidedCount}/${total} 玩家已决策，开始行动（所有玩家都选择出牌）`
      } else if (reforgeCount === total) {
        this.gameState.message = `${decidedCount}/${total} 玩家已决策，开始行动（所有玩家都选择重铸）`
      } else {
        this.gameState.message = `${decidedCount}/${total} 玩家已决策，开始行动（${playCount}人出牌，${reforgeCount}人重铸）`
      }
    } else {
      console.log(`[GameEngine] 等待其他玩家决策`)
      this.gameState.message = `已有 ${decidedCount}/${this.gameState.players.length} 玩家决策，等待其他玩家...`
    }
    
    console.log(`[GameEngine] phase: ${this.gameState.phase}`)
    console.log(`[GameEngine] handleChoosePlay 完成`)
    
    return {
      success: true,
      gameState: this.getPublicGameState()
    }
  }
  
  // 处理玩家选择重铸
  handleChooseReforge(playerId) {
    const playerIndex = this.getPlayerIndex(playerId)
    if (playerIndex === -1) {
      return { success: false, error: '玩家不存在' }
    }
    
    const player = this.gameState.players[playerIndex]
    
    console.log(`[GameEngine] handleChooseReforge: 玩家${playerIndex} (${player.name}) 选择重铸`)
    console.log(`[GameEngine] 当前 phase: ${this.gameState.phase}`)
    
    // 记录玩家决策
    this.gameState.playerDecisions[playerId] = { made: true, choice: 'reforge' }
    
    // 检查是否所有玩家都已决策
    const decidedCount = Object.values(this.gameState.playerDecisions).filter(d => d.made).length
    const allDecided = decidedCount === this.gameState.players.length
    
    if (allDecided) {
      console.log(`[GameEngine] 所有玩家都已决策，进入 action 阶段`)
      this.gameState.phase = 'action'
      
      // 检查所有玩家的决策类型
      const decisions = Object.values(this.gameState.playerDecisions)
      const playCount = decisions.filter(d => d.choice === 'play').length
      const reforgeCount = decisions.filter(d => d.choice === 'reforge').length
      const total = this.gameState.players.length
      
      if (playCount === total) {
        this.gameState.message = `${decidedCount}/${total} 玩家已决策，开始行动（所有玩家都选择出牌）`
      } else if (reforgeCount === total) {
        this.gameState.message = `${decidedCount}/${total} 玩家已决策，开始行动（所有玩家都选择重铸）`
      } else {
        this.gameState.message = `${decidedCount}/${total} 玩家已决策，开始行动（${playCount}人出牌，${reforgeCount}人重铸）`
      }
    } else {
      console.log(`[GameEngine] 等待其他玩家决策`)
      this.gameState.message = `已有 ${decidedCount}/${this.gameState.players.length} 玩家决策，等待其他玩家...`
    }
    
    console.log(`[GameEngine] phase: ${this.gameState.phase}`)
    console.log(`[GameEngine] handleChooseReforge 完成`)
    
    return {
      success: true,
      gameState: this.getPublicGameState()
    }
  }
  
  // 获取可用槽位
  getAvailableSlots(player, card) {
    const slots = []
    
    player.field.forEach((slot, index) => {
      if (!slot.isExtra && !slot.card) {
        slots.push(index)
      } else if (slot.isExtra && !slot.card && card.type === 'unit') {
        slots.push(index)
      }
    })
    
    return slots
  }
  
  // 处理打出卡牌
  handlePlayCard(playerId, cardIndex, slotIndex) {
    const playerIndex = this.getPlayerIndex(playerId)
    if (playerIndex === -1) {
      return { success: false, error: '玩家不存在' }
    }
    
    const player = this.gameState.players[playerIndex]
    
    // 验证手牌索引
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return { success: false, error: '无效的手牌索引' }
    }
    
    const card = player.hand[cardIndex]
    
    if (!card) {
      return { success: false, error: '卡牌不存在' }
    }
    
    // 检查最后一回合的卡牌限制
    const restrictions = this.gameState.playerRestrictions?.[playerId]
    if (restrictions?.includes('cannotPlay')) {
      return { success: false, error: '最后一回合无法出牌（场地已满）' }
    }
    if (restrictions?.includes('tacticsOnly') && card.type !== 'tactic') {
      return { success: false, error: '最后一回合只能出战术牌' }
    }
    
    // 验证费用
    if (player.currentCost < card.cost) {
      if (!card.forcedPlay) {
        return { success: false, error: `费用不足！需要${card.cost}，当前${player.currentCost}` }
      }
      // forced play: allow negative energy
      this.gameState.playersWithNegativeCost = this.gameState.playersWithNegativeCost || []
      this.gameState.playersWithNegativeCost.push(playerId)
    }
    
    // 验证是否已出牌
    if (player.hasPlayedThisTurn && !player.canPlayExtra) {
      return { success: false, error: '本回合已经出过牌了！' }
    }
    
    // 验证槽位
    if (slotIndex < 0 || slotIndex >= player.field.length) {
      return { success: false, error: '无效的槽位' }
    }
    
    const slot = player.field[slotIndex]
    if (slot.card !== null) {
      return { success: false, error: '槽位已被占用' }
    }
    
    // 执行打出卡牌
    player.hand.splice(cardIndex, 1)
    player.currentCost -= card.cost
    
    if (player.hasPlayedThisTurn && player.canPlayExtra) {
      player.canPlayExtra = false
    } else {
      player.hasPlayedThisTurn = true
    }
    
    // 部署卡牌
    this.deployCard(card, player, slotIndex, playerIndex)
    
    // 将卡牌添加到待揭示列表
    this.gameState.pendingReveals[playerId].push({
      card: card,
      slotIndex: slotIndex
    })
    
    this.gameState.message = `${player.name} 打出了一张牌（费用-${card.cost}）`
    
    console.log(`[GameEngine] ${player.name} 打出卡牌到槽位 ${slotIndex}，暂时隐藏`)
    console.log(`[GameEngine] ${player.name} 当前费用:`, player.currentCost)
    
    // 如果玩家不能再出牌，标记为准备完成
    if (!player.canPlayExtra) {
      this.gameState.playerReady[playerId] = true
      console.log(`[GameEngine] ${player.name} 标记为准备完成`)
      
      // 检查是否两个玩家都准备好
      const allReady = Object.values(this.gameState.playerReady).every(ready => ready)
      if (allReady) {
        console.log(`[GameEngine] 所有玩家都准备完成`)
        // 不在这里揭示卡牌，等到开始新回合时再揭示
        this.gameState.message += ` | ${this.gameState.players.length === 2 ? '双方' : '所有玩家'}都已完成，等待进入下一回合...`
      }
    }
    
    return {
      success: true,
      gameState: this.getPublicGameState(),
      cardPlayed: card
    }
  }
  
  // 部署卡牌
  deployCard(card, player, slotIndex, playerIndex) {
    const slot = player.field[slotIndex]
    
    // 部署卡牌到槽位
    slot.card = card
    
    // 战术牌特殊处理
    if (card.type === 'tactic') {
      this.handleTacticCard(card, player, slotIndex)
      return
    }
    
    // 触发部署效果
    this.triggerDeployEffects(card, player)
    
    // 触发"其他卡牌打出时"的效果
    EffectManager.triggerOnOtherPlayEffects(card, player, this.gameState)
    
    // 重新计算战力
    EffectManager.recalculateAllPowers(this.gameState)
    
    // 应用自身场上条件修饰效果（selfTarget modifyPower onField effects）
    EffectManager.applyOnFieldSelfModify(this)
    
    // 检查是否填满场地
    this.checkFieldFull(playerIndex)
  }
  
  // 处理战术牌
  handleTacticCard(card, player, slotIndex) {
    const effect = card.effects.find(e => e.timing === 'onReveal')
    
    EffectManager.triggerOnOtherPlayEffects(card, player, this.gameState)
    
    if (!effect) {
      this.discardTacticCard(card, player, slotIndex)
      return
    }
    
    if (effect.type === 'modifyPower' && effect.targetKeywords) {
      const targets = EffectManager.getValidTargets(player, effect.targetKeywords)
      
      if (targets.length === 0) {
        this.gameState.message += ' | 没有符合条件的目标'
        this.discardTacticCard(card, player, slotIndex)
        return
      }
      
      // 自动选择第一个目标（简化处理）
      targets[0].currentPower += effect.value || 0
      this.gameState.message += ` | ${targets[0].name} 战力+${effect.value}`
      this.discardTacticCard(card, player, slotIndex)
    } else if (effect.type === 'modifyCost') {
      const otherIndices = this.getOtherPlayerIndices(this.getPlayerIndex(player.id))
      otherIndices.forEach(idx => {
        const opponent = this.gameState.players[idx]
        opponent.currentCost += effect.value || 0
        this.gameState.message += ` | ${opponent.name} 费用${effect.value}`
      })
      this.discardTacticCard(card, player, slotIndex)
    }
  }
  
  // 弃置战术牌
  discardTacticCard(card, player, slotIndex) {
    const slot = player.field[slotIndex]
    if (slot) {
      slot.card = null
    }
    player.discard.push(card)
  }
  
  // 触发部署效果
  triggerDeployEffects(card, player) {
    console.log(`[GameEngine] triggerDeployEffects: ${card.name}`)
    console.log(`[GameEngine] 卡牌效果:`, card.effects)
    console.log(`[GameEngine] effects 是数组吗?`, Array.isArray(card.effects))
    
    if (!card.effects || !Array.isArray(card.effects)) {
      console.log(`[GameEngine] 警告：卡牌 ${card.name} 没有 effects 数组`)
      return
    }
    
    card.effects.forEach(effect => {
      console.log(`[GameEngine] 检查效果: timing=${effect.timing}, type=${effect.type}`)
      if (effect.timing === 'onDeploy') {
        if (effect.type === 'extraPlay') {
          player.canPlayExtra = true
          this.gameState.message += ` | 效果：可以再打出一张牌！`
          console.log(`[GameEngine] 触发额外出牌效果`)
        } else if (effect.type === 'createSlot') {
          console.log(`[GameEngine] 触发创建额外槽位效果`)
          this.createExtraSlot(card, player)
        }
      }
    })
  }
  
  // 创建额外槽位
  createExtraSlot(parentCard, player) {
    const parentSlotIndex = player.field.findIndex(s => s.card === parentCard)
    console.log(`[GameEngine] createExtraSlot: 父卡牌=${parentCard.name}, 父槽位索引=${parentSlotIndex}`)
    
    if (parentSlotIndex === -1) {
      console.log(`[GameEngine] 错误：找不到父槽位`)
      return
    }
    
    const newSlot = {
      card: null,
      position: player.field.length,
      isExtra: true,
      parentSlot: parentSlotIndex
    }
    
    player.field.push(newSlot)
    console.log(`[GameEngine] 创建了额外槽位，新槽位位置=${newSlot.position}，当前总槽位数=${player.field.length}`)
    this.gameState.message += ` | 创建了额外槽位`
  }
  
  // 揭示所有待揭示的卡牌
  revealAllCards() {
    console.log('[GameEngine] 揭示所有待揭示的卡牌')
    
    // 清空待揭示列表（卡牌已经在场上了，只是现在可以被对手看到）
    Object.keys(this.gameState.pendingReveals).forEach(playerId => {
      const reveals = this.gameState.pendingReveals[playerId]
      if (reveals.length > 0) {
        const player = this.gameState.players.find(p => p.id === playerId)
        console.log(`[GameEngine] ${player?.name} 揭示了 ${reveals.length} 张卡牌`)
        reveals.forEach(reveal => {
          console.log(`  - ${reveal.card.name} 在槽位 ${reveal.slotIndex}`)
        })
      }
      this.gameState.pendingReveals[playerId] = []
    })
  }
  
  // 检查场地是否填满
  checkFieldFull(playerIndex) {
    const player = this.gameState.players[playerIndex]
    const mainSlots = player.field.filter(s => !s.isExtra)
    const filledMainSlots = mainSlots.filter(s => s.card !== null).length
    
    if (filledMainSlots === 6 && !this.gameState.isFinalRound) {
      this.gameState.isFinalRound = true
      this.gameState.finalRoundTriggeredBy = playerIndex
      this.gameState.finalRoundStartRound = this.gameState.round
      this.gameState.message += ` | ${player.name} 填满了场地！进入最后一回合！`
      console.log(`[GameEngine] ${player.name} 填满场地，进入最后一回合`)
      console.log(`[GameEngine] 触发回合: ${this.gameState.round}`)
    }
  }
  
  // 处理执行重铸
  handleExecuteReforge(playerId, options, selectedCardIndex) {
    const playerIndex = this.getPlayerIndex(playerId)
    if (playerIndex === -1) {
      return { success: false, error: '玩家不存在' }
    }
    
    const player = this.gameState.players[playerIndex]
    let message = `${player.name} 重铸：`
    
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
          if (selectedCardIndex !== null && selectedCardIndex >= 0 && selectedCardIndex < player.hand.length) {
            const card = player.hand.splice(selectedCardIndex, 1)[0]
            player.deck.unshift(card)
            const newCard = this.drawCard(player)
            message += ` 换牌(${card.name}→${newCard?.name})`
          }
          break
      }
      if (index === 0) message += ' +'
    })
    
    // 重铸完成后，标记玩家为准备完成
    this.gameState.playerReady[playerId] = true
    console.log(`[GameEngine] ${player.name} 重铸完成，标记为准备完成`)
    
    // 检查是否两个玩家都准备好
    const allReady = Object.values(this.gameState.playerReady).every(ready => ready)
    if (allReady) {
      console.log(`[GameEngine] 所有玩家都准备完成`)
      message += ` | ${this.gameState.players.length === 2 ? '双方' : '所有玩家'}都已完成，等待进入下一回合...`
    }
    
    this.gameState.message = message
    console.log(`[GameEngine] ${message}`)
    
    return {
      success: true,
      gameState: this.getPublicGameState()
    }
  }
  
  // 处理跳过回合
  handleSkipTurn(playerId) {
    const playerIndex = this.getPlayerIndex(playerId)
    if (playerIndex === -1) {
      return { success: false, error: '玩家不存在' }
    }
    
    const player = this.gameState.players[playerIndex]
    
    // 标记玩家为准备完成
    this.gameState.playerReady[playerId] = true
    console.log(`[GameEngine] ${player.name} 跳过回合，标记为准备完成`)
    
    // 检查是否两个玩家都准备好
    const allReady = Object.values(this.gameState.playerReady).every(ready => ready)
    if (allReady) {
      console.log(`[GameEngine] 所有玩家都准备完成`)
      this.gameState.message = `${player.name} 跳过回合 | ${this.gameState.players.length === 2 ? '双方' : '所有玩家'}都已完成，等待进入下一回合...`
    } else {
      this.gameState.message = `${player.name} 跳过回合，等待其他玩家...`
    }
    
    return {
      success: true,
      gameState: this.getPublicGameState()
    }
  }
  
  // 开始新回合
  startNewRound() {
    // 在新回合开始时，先揭示上一回合打出的所有卡牌
    this.revealAllCards()
    
    // 检查是否应该结束游戏
    // 如果是最后一回合，且当前回合已经是触发回合的下一回合，则结束游戏
    if (this.gameState.isFinalRound && this.gameState.finalRoundStartRound !== undefined) {
      const roundsSinceTrigger = this.gameState.round - this.gameState.finalRoundStartRound
      console.log(`[GameEngine] 最后一回合检查: 触发回合=${this.gameState.finalRoundStartRound}, 当前回合=${this.gameState.round}, 差值=${roundsSinceTrigger}`)
      
      // 如果已经过了一个完整回合（其他玩家也完成了），则结束游戏
      if (roundsSinceTrigger >= 1) {
        console.log(`[GameEngine] 最后一回合已完成，游戏结束`)
        return this.endGame()
      }
    }
    
    // Compute player restrictions for final round
    this.gameState.playerRestrictions = {}
    if (this.gameState.isFinalRound) {
      this.gameState.players.forEach((player, idx) => {
        const filledSlots = player.field.filter(s => !s.isExtra && s.card).length
        if (filledSlots >= 6) {
          if (this.gameState.players.length === 2) {
            this.gameState.playerRestrictions[player.id] = ['cannotPlay']
          } else {
            this.gameState.playerRestrictions[player.id] = ['tacticsOnly']
          }
        }
      })
    }
    
    this.gameState.round++
    this.gameState.phase = 'draw'
    
    // 重置玩家决策状态
    Object.keys(this.gameState.playerDecisions).forEach(playerId => {
      this.gameState.playerDecisions[playerId] = { made: false, choice: null }
    })
    console.log(`[GameEngine] 重置所有玩家的决策状态`)
    
    // 重置玩家准备状态
    Object.keys(this.gameState.playerReady).forEach(playerId => {
      this.gameState.playerReady[playerId] = false
    })
    console.log(`[GameEngine] 重置所有玩家的准备状态`)
    
    // 重置待揭示列表
    Object.keys(this.gameState.pendingReveals).forEach(playerId => {
      this.gameState.pendingReveals[playerId] = []
    })
    console.log(`[GameEngine] 重置待揭示列表`)
    
    // 重置玩家状态
    this.gameState.players.forEach((player, index) => {
      player.hasPlayedThisTurn = false
      player.canPlayExtra = false
      
      // 如果是填满场地的玩家，在最后一回合跳过他的操作
      if (this.gameState.isFinalRound && this.gameState.finalRoundTriggeredBy === index) {
        console.log(`[GameEngine] ${player.name} 已填满场地，最后一回合跳过操作`)
        // 标记为已决策和已准备，这样他不需要操作
        this.gameState.playerDecisions[player.id] = { made: true, choice: 'skip' }
        this.gameState.playerReady[player.id] = true
        // 不抽牌
      } else {
        // 抽牌
        const card = this.drawCard(player)
        if (card) {
          console.log(`[GameEngine] ${player.name} 抽牌: ${card.name}`)
        }
      }
    })
    
    // 检查是否只有一个玩家需要操作（最后一回合）
    const needDecision = Object.values(this.gameState.playerDecisions).filter(d => !d.made).length
    if (needDecision === 1) {
      // 只有一个玩家需要决策，直接进入决策阶段
      this.gameState.phase = 'decision'
      const activePlayer = this.gameState.players.find(p => !this.gameState.playerDecisions[p.id].made)
      this.gameState.message = `回合 ${this.gameState.round} - 最后一回合！${activePlayer.name} 选择出牌或重铸`
    } else {
      this.gameState.phase = 'decision'  // 进入决策阶段
      
      // 更新消息
      if (this.gameState.isFinalRound) {
        this.gameState.message = `回合 ${this.gameState.round} - 最后一回合！选择出牌或重铸`
      } else {
        this.gameState.message = `回合 ${this.gameState.round} - 选择出牌或重铸`
      }
    }
    
    console.log(`[GameEngine] 开始回合 ${this.gameState.round}`)
    
    return {
      success: true,
      gameState: this.getPublicGameState()
    }
  }
  
  // 结束游戏
  endGame() {
    this.gameState.phase = 'gameOver'
    
    // 计算所有玩家战力
    const powerEntries = this.gameState.players.map((player, index) => {
      let totalPower = player.bonusPower
      player.field.forEach(slot => {
        if (slot.card && !slot.isExtra) {
          totalPower += slot.card.currentPower
        }
      })
      return { index, power: totalPower }
    })
    
    // 按战力降序排序
    powerEntries.sort((a, b) => b.power - a.power)
    
    // 设置排名
    this.gameState.rankings = powerEntries.map((entry, rank) => ({
      playerIndex: entry.index,
      power: entry.power,
      rank: rank + 1
    }))
    
    // 处理平局：相同战力共享排名
    for (let i = 1; i < powerEntries.length; i++) {
      if (powerEntries[i].power === powerEntries[i - 1].power) {
        this.gameState.rankings[i].rank = this.gameState.rankings[i - 1].rank
      }
    }
    
    // 设置赢家（排名第一的玩家）
    this.gameState.winner = powerEntries[0].index
    
    // 构建消息
    let message = `游戏结束！\n`
    this.gameState.rankings.forEach(({ playerIndex, power, rank }) => {
      message += `第${rank}名: ${this.gameState.players[playerIndex].name}（战力：${power}）\n`
    })
    
    // 检查是否平局
    if (this.gameState.rankings.length > 1 && this.gameState.rankings[0].rank === this.gameState.rankings[1].rank) {
      message += '平局！'
    } else {
      message += `${this.gameState.players[this.gameState.winner].name}获胜！🎉`
    }
    
    this.gameState.message = message
    
    console.log(`[GameEngine] 游戏结束: ${this.gameState.message}`)
    
    return {
      success: true,
      gameState: this.getPublicGameState()
    }
  }
  
  // 获取公开的游戏状态（隐藏对手手牌）
  getPublicGameState() {
    return {
      ...this.gameState,
      players: this.gameState.players.map(player => ({
        ...player,
        // 手牌只返回数量，不返回具体内容
        hand: player.hand.map(() => ({ id: 'hidden' })),
        handCount: player.hand.length,
        // 牌组只返回数量
        deck: player.deck.map(() => ({ id: 'hidden' })),
        deckCount: player.deck.length
      }))
    }
  }
  
  // 获取特定玩家的游戏状态（包含自己的手牌）
  getPlayerGameState(playerId) {
    const playerIndex = this.getPlayerIndex(playerId)
    if (playerIndex === -1) {
      console.log(`[GameEngine] getPlayerGameState: 找不到玩家 ${playerId}`)
      return this.getPublicGameState()
    }
    
    const publicState = this.getPublicGameState()
    
    // 恢复该玩家的真实手牌和牌组
    const realHand = this.gameState.players[playerIndex].hand
    const realDeck = this.gameState.players[playerIndex].deck
    
    console.log(`[GameEngine] getPlayerGameState: 玩家${playerIndex} (${playerId}) 手牌数: ${realHand.length}`)
    console.log(`[GameEngine] getPlayerGameState: 手牌内容:`, realHand.map(c => c?.name || 'undefined'))
    
    // 确保手牌数据完整
    publicState.players[playerIndex].hand = realHand.filter(card => card && card.name)
    publicState.players[playerIndex].deck = realDeck.filter(card => card && card.name)
    
    // 深拷贝所有玩家的 field，避免修改原始状态
    publicState.players = publicState.players.map(player => ({
      ...player,
      field: player.field.map(slot => ({
        ...slot,
        card: slot.card ? { ...slot.card } : null
      }))
    }))
    
    // 隐藏所有玩家的待揭示卡牌和费用变化
    this.gameState.players.forEach((player, idx) => {
      const playerPendingReveals = this.gameState.pendingReveals[player.id] || []
      
      if (playerPendingReveals.length > 0) {
        console.log(`[GameEngine] 隐藏玩家${idx} (${player.name}) 的 ${playerPendingReveals.length} 张待揭示卡牌`)
        
        // 计算该玩家已花费但未揭示的费用
        let hiddenCost = 0
        playerPendingReveals.forEach(reveal => {
          hiddenCost += reveal.card.cost
          // 隐藏场上的待揭示卡牌（现在是在深拷贝的对象上修改）
          const slot = publicState.players[idx].field[reveal.slotIndex]
          if (slot && slot.card) {
            slot.card = { id: 'hidden', name: '？？？', currentPower: 0, basePower: 0 }
          }
        })
        
        // 恢复该玩家的费用（加回已花费但未揭示的费用）
        publicState.players[idx].currentCost += hiddenCost
        console.log(`[GameEngine] 玩家${idx}费用恢复 +${hiddenCost}，显示为: ${publicState.players[idx].currentCost}`)
      }
    })
    
    // 最后调整玩家顺序，让请求的玩家总是在 players[0]，其他玩家轮转
    if (playerIndex !== 0) {
      const players = publicState.players
      // 将请求的玩家移到第一位，其他玩家保持相对顺序
      const reordered = [players[playerIndex], ...players.slice(0, playerIndex), ...players.slice(playerIndex + 1)]
      publicState.players = reordered
      console.log(`[GameEngine] getPlayerGameState: 重新排序玩家，让玩家${playerIndex}成为players[0]`)
    }
    
    return publicState
  }
}

export { GameEngine, EffectManager }
