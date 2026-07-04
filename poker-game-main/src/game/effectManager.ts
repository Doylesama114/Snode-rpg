import type { Card, Player, GameState, FieldSlot, EffectContext, CardEffect, AttributeType } from '@/types/game'

// 效果管理器
export class EffectManager {
  // 掷一颗D6骰子，返回1-6的随机整数
  static rollD6(): number {
    return Math.floor(Math.random() * 6) + 1
  }

  // 检查卡牌是否有指定关键词（包括名称检查）
  static hasKeyword(card: Card, keyword: string): boolean {
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
  static hasAnyKeyword(card: Card, keywords: string[]): boolean {
    return keywords.some(keyword => this.hasKeyword(card, keyword))
  }

  // 检查卡牌是否有指定属性
  static hasAttribute(card: Card, attribute: string): boolean {
    if (!card) return false
    return card.attribute === attribute
  }

  // 检查卡牌是否有任意一个属性
  static hasAnyAttribute(card: Card, attributes: string[]): boolean {
    if (!card || !attributes || attributes.length === 0) return false
    return attributes.some(attr => this.hasAttribute(card, attr))
  }

  // 获取场上所有不同的关键词
  static getUniqueKeywords(player: Player, excludeCard?: Card): string[] {
    const keywords = new Set<string>()
    
    player.field.forEach(slot => {
      if (slot.card && slot.card !== excludeCard) {
        slot.card.keywords.forEach(kw => keywords.add(kw))
      }
    })
    
    return Array.from(keywords)
  }

  // 触发"其他卡牌打出时"的效果
  static triggerOnOtherPlayEffects(deployedCard: Card, player: Player, game: GameState) {
    const messages: string[] = []
    
    player.field.forEach(slot => {
      if (slot.card && slot.card !== deployedCard) {
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onOtherPlay' && effect.type === 'modifyPower') {
            if (effect.triggerPlayedCardType && deployedCard.type !== effect.triggerPlayedCardType) {
              return
            }
            const keywordMatch = effect.targetKeywords && this.hasAnyKeyword(deployedCard, effect.targetKeywords)
            const attrMatch = effect.targetAttributes && Array.isArray(effect.targetAttributes) && this.hasAnyAttribute(deployedCard, effect.targetAttributes)
            // 武僧：任意战术打出时 self +1
            if (effect.selfTarget && effect.triggerPlayedCardType && !keywordMatch && !attrMatch) {
              const oldPower = slot.card.currentPower
              if (effect.stackable !== false) {
                if (slot.card.stackedBonus === undefined) slot.card.stackedBonus = 0
                slot.card.stackedBonus += (effect.value || 0)
                slot.card.currentPower += (effect.value || 0)
              } else {
                slot.card.currentPower = slot.card.basePower + (slot.card.stackedBonus || 0) + (effect.value || 0)
              }
              messages.push(`${slot.card.name} 战力${oldPower}→${slot.card.currentPower}`)
              return
            }
            if (!keywordMatch && !attrMatch) return
            // 检查部署的卡牌是否符合条件（按关键词）
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
              // 通用：给打出的牌加战力（翻车鱼等）
              else if (effect.buffPlayedCard) {
                const times = effect.triggerCount ?? 1
                const delta = (effect.value || 0) * times
                const oldPower = deployedCard.currentPower
                deployedCard.currentPower += delta
                messages.push(`${deployedCard.name} 战力${oldPower}→${deployedCard.currentPower}（${slot.card.name}）`)
              }
              // 通用 onOtherPlay + selfTarget 处理器（水元素、火元素、土元素等）
              else if (effect.selfTarget) {
                const oldPower = slot.card.currentPower
                if (effect.stackable !== false) {
                  if (slot.card.stackedBonus === undefined) slot.card.stackedBonus = 0
                  slot.card.stackedBonus += (effect.value || 0)
                  slot.card.currentPower += (effect.value || 0)
                } else {
                  slot.card.currentPower = slot.card.basePower + (slot.card.stackedBonus || 0) + (effect.value || 0)
                }
                messages.push(`${slot.card.name} 战力${oldPower}→${slot.card.currentPower}`)
              }
          }
        })
      }
    })
    
    if (messages.length > 0) {
      game.message += ` | ${messages.join(' | ')}`
    }
  }

  // 计算见习冒险者的战力（保留供测试参考，逻辑已迁移至 countUniqueKeywords）
  static calculateApprenticeAdventurerPower(card: Card, player: Player): number {
    const uniqueKeywords = this.getUniqueKeywords(player, card)
    return card.basePower + uniqueKeywords.length
  }

  // 计算野猪的战力
  static calculateBoarPower(card: Card, player: Player): number {
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
  static calculateWeaponShopBonus(targetCard: Card): number {
    if (this.hasAnyKeyword(targetCard, ['战士', '士兵', '冒险者'])) {
      return 3
    }
    return 0
  }

  // 检查铁匠铺条件
  static checkBlacksmithCondition(player: Player): boolean {
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
  static calculateFarmlandPower(farmlandSlot: FieldSlot, player: Player): number {
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
  static recalculateAllPowers(game: GameState) {
    game.players.forEach(player => {
      player.field.forEach(slot => {
        if (slot.card) {
          this.recalculateCardPower(slot.card, player, game)
        }
      })
    })
  }

  // 应用 selfTarget onField modifyPower（累加多个效果）
  static applySelfTargetFieldEffects(card: Card, player: Player, game: GameState) {
    if (!card.effects) return

    let selfBonus = 0
    let replacedPower: number | null = null

    for (const effect of card.effects) {
      if (effect.timing !== 'onField' || effect.type !== 'modifyPower' || !effect.selfTarget) continue

      if (effect.countUniqueKeywords) {
        const uniqueKw = this.getUniqueKeywords(player, card)
        selfBonus += (effect.value ?? 1) * uniqueKw.length
        continue
      }

      if (effect.countDeployedOnSelf) {
        const hostSlot = player.field.find(s => s.card === card)
        if (hostSlot) {
          let count = 0
          player.field.forEach(otherSlot => {
            if (
              otherSlot.isExtra &&
              otherSlot.parentSlot === hostSlot.position &&
              otherSlot.card &&
              (!effect.targetKeywords || this.hasAnyKeyword(otherSlot.card, effect.targetKeywords))
            ) {
              count++
            }
          })
          const powerFromDeployments = count * (effect.value ?? 1)
          if (effect.replacePowerWithDeploymentCount) {
            replacedPower = powerFromDeployments
          } else {
            selfBonus += powerFromDeployments
          }
        }
        continue
      }

      if (effect.requireKeywords && Array.isArray(effect.requireKeywords)) {
        const allMatch = effect.requireKeywords.every(keywordGroup =>
          player.field.some(otherSlot =>
            otherSlot.card && otherSlot.card !== card &&
            this.hasAnyKeyword(otherSlot.card, keywordGroup)
          )
        )
        if (allMatch) selfBonus += (effect.value || 0)
        continue
      }

      if (effect.targetKeywords) {
        const hasMatch = player.field.some(otherSlot =>
          otherSlot.card && otherSlot.card !== card &&
          this.hasAnyKeyword(otherSlot.card, effect.targetKeywords!)
        )
        const conditionMet = effect.invertCondition ? !hasMatch : hasMatch
        if (conditionMet) {
          if (effect.stackable !== false) {
            const matchCount = player.field.filter(otherSlot =>
              otherSlot.card && otherSlot.card !== card &&
              this.hasAnyKeyword(otherSlot.card, effect.targetKeywords!)
            ).length
            selfBonus += (effect.value || 0) * matchCount
          } else {
            selfBonus += (effect.value || 0)
          }
        }
        continue
      }

      if (effect.targetAttributes && Array.isArray(effect.targetAttributes)) {
        const hasMatch = player.field.some(otherSlot =>
          otherSlot.card && otherSlot.card !== card &&
          this.hasAnyAttribute(otherSlot.card, effect.targetAttributes!)
        )
        const conditionMet = effect.invertCondition ? !hasMatch : hasMatch
        if (conditionMet) {
          if (effect.stackable !== false) {
            const matchCount = player.field.filter(otherSlot =>
              otherSlot.card && otherSlot.card !== card &&
              this.hasAnyAttribute(otherSlot.card, effect.targetAttributes!)
            ).length
            selfBonus += (effect.value || 0) * matchCount
          } else {
            selfBonus += (effect.value || 0)
          }
        }
      }
    }

    if (replacedPower !== null) {
      card.currentPower = replacedPower
    } else {
      card.currentPower += selfBonus
    }
  }

  // 重新计算单张卡牌的战力
  static recalculateCardPower(card: Card, player: Player, game: GameState) {
    // 重置为基础战力
    card.currentPower = card.basePower
    card.untargetableByOthers = false
    
    for (const effect of card.effects) {
      if (effect.timing === 'onField' && effect.type === 'grantUntargetable') {
        card.untargetableByOthers = this.checkFieldRequirements(player, effect)
      }
    }
    
    // 添加叠加的加成（法师、战士等 onOtherPlay 持久化）
    if (card.stackedBonus !== undefined && card.stackedBonus > 0) {
      card.currentPower += card.stackedBonus
    }
    
    // 应用其他卡牌在场持续效果（buff 其他卡）
    player.field.forEach(slot => {
      if (slot.card && slot.card !== card) {
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onField' && effect.type === 'modifyPower' && !effect.selfTarget) {
            if (effect.targetKeywords && this.hasAnyKeyword(card, effect.targetKeywords)) {
              if (effect.value) card.currentPower += effect.value
            }
            if (effect.targetAttributes && Array.isArray(effect.targetAttributes) && this.hasAnyAttribute(card, effect.targetAttributes)) {
              if (effect.value) card.currentPower += effect.value
            }
          }
        })
      }
    })

    this.applySelfTargetFieldEffects(card, player, game)
  }

  // 获取可选择的目标卡牌
  static getValidTargets(player: Player, keywords: string[]): Card[] {
    const targets: Card[] = []
    
    player.field.forEach(slot => {
      if (slot.card && this.hasAnyKeyword(slot.card, keywords)) {
        targets.push(slot.card)
      }
    })
    
    return targets
  }

  private static matchesSearch(card: Card, effect: CardEffect): boolean {
    if (effect.targetCardType && card.type !== effect.targetCardType) return false
    if (effect.searchName && card.name.includes(effect.searchName)) return true
    if (effect.searchNames?.some(n => card.name.includes(n))) return true
    const keywords = effect.searchKeywords?.length
      ? effect.searchKeywords
      : effect.searchKeyword ? [effect.searchKeyword] : []
    if (keywords.length > 0 && keywords.some(kw => this.hasKeyword(card, kw))) return true
    return false
  }

  private static shuffleInPlace(deck: Card[]) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
  }

  static meetsPlayRequirements(card: Card, player: Player, game?: GameState): boolean {
    if (this.requiresCrossPlayerDeploy(card)) {
      if (!game) return false
      if (this.getCrossPlayerDeployOptions(game, player, card).length === 0) return false
    }
    for (const effect of card.effects || []) {
      if (effect.type !== 'playRequirement') continue
      if (effect.unplayable) return false
      if (effect.requireNoTacticsInDeck && player.deck.some(c => c.type === 'tactic')) return false
      if (!this.checkFieldRequirements(player, effect)) return false
    }
    return true
  }

  static isCardOnField(player: Player, card: Card): boolean {
    return player.field.some(slot => slot.card === card)
  }

  /** onGameEnd 设战力：场上改 currentPower，手牌计入 bonusPower */
  static applyGameEndPowerSet(ownerCard: Card, player: Player, value: number, messages: string[]) {
    ownerCard.currentPower = value
    ownerCard.basePower = value
    if (!this.isCardOnField(player, ownerCard)) {
      player.bonusPower += value
    }
    messages.push(`${ownerCard.name} 终局战力→${value}`)
  }

  static destroyRandomOtherCard(
    ownerCard: Card,
    player: Player,
    game: GameState,
    messages: string[],
  ) {
    const candidates: Array<{ card: Card; location: 'field' | 'hand' }> = []
    player.field.forEach(slot => {
      if (slot.card && slot.card !== ownerCard && !slot.isExtra) {
        candidates.push({ card: slot.card, location: 'field' })
      }
    })
    player.hand.forEach(c => {
      if (c !== ownerCard) candidates.push({ card: c, location: 'hand' })
    })
    if (candidates.length === 0) return
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    if (pick.location === 'field') {
      this.removeCardFromField(game, pick.card)
    } else {
      const idx = player.hand.indexOf(pick.card)
      if (idx !== -1) {
        player.hand.splice(idx, 1)
        player.discard.push(pick.card)
      }
    }
    messages.push(`${ownerCard.name} 终局消灭 ${pick.card.name}`)
  }

  static getCrossPlayerDeployEffect(card: Card): CardEffect | undefined {
    return card.effects?.find(e => e.type === 'crossPlayerDeploy')
  }

  static requiresCrossPlayerDeploy(card: Card): boolean {
    return !!this.getCrossPlayerDeployEffect(card)
  }

  /** 目标玩家场上满足 crossPlayerDeploy 条件 */
  static playerMeetsCrossDeployTarget(targetPlayer: Player, effect: CardEffect): boolean {
    return this.checkFieldRequirements(targetPlayer, effect)
  }

  static getCrossPlayerDeployOptions(
    game: GameState,
    _playingPlayer: Player,
    card: Card,
  ): Array<{ playerIndex: number; slotIndex: number }> {
    const effect = this.getCrossPlayerDeployEffect(card)
    if (!effect) return []
    const options: Array<{ playerIndex: number; slotIndex: number }> = []
    game.players.forEach((p, playerIndex) => {
      if (!this.playerMeetsCrossDeployTarget(p, effect)) return
      p.field.forEach((slot, slotIndex) => {
        if (slot.isExtra || slot.card) return
        options.push({ playerIndex, slotIndex })
      })
    })
    return options
  }

  static isValidCrossPlayerDeploySlot(
    game: GameState,
    playingPlayer: Player,
    card: Card,
    targetPlayerIndex: number,
    slotIndex: number,
  ): boolean {
    return this.getCrossPlayerDeployOptions(game, playingPlayer, card).some(
      o => o.playerIndex === targetPlayerIndex && o.slotIndex === slotIndex,
    )
  }

  static getCardOwner(game: GameState, card: Card): Player | undefined {
    return game.players.find(p => p.field.some(s => s.card === card))
  }

  static findInHandOrDeck(player: Player, effect: CardEffect): { pile: 'hand' | 'deck'; index: number; card: Card } | null {
    const matches = (c: Card) => this.matchesSearch(c, effect)
    for (let i = 0; i < player.hand.length; i++) {
      if (matches(player.hand[i])) return { pile: 'hand', index: i, card: player.hand[i] }
    }
    for (let i = player.deck.length - 1; i >= 0; i--) {
      if (matches(player.deck[i])) return { pile: 'deck', index: i, card: player.deck[i] }
    }
    return null
  }

  // Search deck for cards matching name or keyword
  static searchDeck(player: Player, effect: CardEffect): Card[] {
    if (effect.searchEachKeyword && effect.searchKeywords?.length) {
      const perKw = effect.maxCount ?? 1
      const allResults: Card[] = []
      for (const kw of effect.searchKeywords) {
        const subEffect: CardEffect = {
          ...effect,
          searchKeywords: [kw],
          searchKeyword: undefined,
          searchEachKeyword: false,
          maxCount: perKw,
          shuffleAfterSearch: false,
        }
        allResults.push(...this.searchDeck(player, subEffect))
      }
      if (effect.shuffleAfterSearch && player.deck.length > 1) {
        this.shuffleInPlace(player.deck)
      }
      return allResults
    }

    const results: Card[] = []
    const max = effect.maxCount ?? Infinity
    const searchDiscard = effect.searchDiscard !== false

    const searchIn = (pile: Card[]) => {
      for (let i = pile.length - 1; i >= 0 && results.length < max; i--) {
        if (this.matchesSearch(pile[i], effect)) {
          results.push(...pile.splice(i, 1))
        }
      }
    }

    searchIn(player.deck)
    if (searchDiscard && results.length < max) {
      searchIn(player.discard)
    }

    if (effect.shuffleAfterSearch && player.deck.length > 1) {
      this.shuffleInPlace(player.deck)
    }
    return results
  }

  /** onReveal modifyPower 目标匹配 */
  static matchesRevealModifyTarget(card: Card, effect: CardEffect): boolean {
    if (effect.targetKeywords?.includes('单位')) {
      if (card.type !== 'unit') return false
    } else if (effect.targetKeywords?.length) {
      if (!this.hasAnyKeyword(card, effect.targetKeywords)) return false
    }
    if (effect.targetAttributes?.length && !this.hasAnyAttribute(card, effect.targetAttributes)) {
      return false
    }
    if (effect.excludeAttributes?.length && this.hasAnyAttribute(card, effect.excludeAttributes)) {
      return false
    }
    return true
  }

  static getRevealModifyTargets(game: GameState, player: Player, effect: CardEffect): Card[] {
    const players = effect.allPlayers ? game.players : [player]
    const targets: Card[] = []
    players.forEach(p => {
      p.field.forEach(slot => {
        if (slot.card && this.matchesRevealModifyTarget(slot.card, effect)) {
          targets.push(slot.card)
        }
      })
    })
    return targets
  }

  /** D6 档位掷骰，返回 { roll, value }；player.d6MinByCardName 可抬高掷骰（珍珠商人） */
  static rollD6TierValue(
    effect: CardEffect,
    player?: Player,
    card?: Card,
  ): { roll: number; value: number } {
    let roll = this.rollD6()
    if (player && card?.name && player.d6MinByCardName?.[card.name] !== undefined) {
      roll = Math.max(roll, player.d6MinByCardName[card.name]!)
    }
    const tiers = effect.d6Tiers || []
    for (const tier of tiers) {
      if (roll >= tier.min && roll <= tier.max) {
        return { roll, value: tier.value }
      }
    }
    return { roll, value: 0 }
  }

  static slotRulesFromEffect(effect: CardEffect): SlotDeployRules | undefined {
    if (effect.type !== 'createSlot') return undefined
    const rules: SlotDeployRules = {}
    if (effect.slotDeployKeywords?.length) rules.deployKeywords = effect.slotDeployKeywords
    if (effect.slotDeployCardType) rules.deployCardType = effect.slotDeployCardType
    if (effect.slotDeployAttributes?.length) rules.deployAttributes = effect.slotDeployAttributes
    if (effect.slotExcludeFromFieldCount) rules.excludeFromFieldCount = true
    if (effect.slotDeployedPowerBonus) rules.deployedPowerBonus = effect.slotDeployedPowerBonus
    return Object.keys(rules).length > 0 ? rules : undefined
  }

  static buildExtraSlot(parentSlotIndex: number, position: number, rules?: SlotDeployRules): FieldSlot {
    return {
      card: null,
      position,
      isExtra: true,
      parentSlot: parentSlotIndex,
      deployRules: rules,
    }
  }

  static canDeployOnExtraSlot(card: Card, slot: FieldSlot): boolean {
    if (!slot.isExtra || slot.card) return false
    if (card.type !== 'unit') return false
    const rules = slot.deployRules
    if (!rules) return true
    if (rules.deployCardType && card.type !== rules.deployCardType) return false
    if (rules.deployAttributes?.length && !this.hasAnyAttribute(card, rules.deployAttributes)) return false
    if (rules.deployKeywords?.length && !this.hasAnyKeyword(card, rules.deployKeywords)) return false
    return true
  }

  static applyExtraSlotDeployModifiers(card: Card, slot: FieldSlot): string[] {
    const messages: string[] = []
    if (!slot.isExtra || !slot.deployRules) return messages
    const rules = slot.deployRules
    if (rules.excludeFromFieldCount) {
      card.excludeFromFieldCount = true
      messages.push(`${card.name} 不计入终局数量`)
    }
    if (rules.deployedPowerBonus) {
      card.basePower += rules.deployedPowerBonus
      card.currentPower += rules.deployedPowerBonus
      messages.push(`${card.name} 部署加成战力+${rules.deployedPowerBonus}`)
    }
    return messages
  }

  /** 单位部署时统一应用玩家级加成（气泡酒 / 萨满祭司） */
  static applyUnitDeployBonuses(card: Card, player: Player): string[] {
    const messages: string[] = []
    if (card.type !== 'unit') return messages
    if (player.unitPlayPowerBonus) {
      const bonus = player.unitPlayPowerBonus
      card.basePower += bonus
      card.currentPower += bonus
      messages.push(`单位部署加成+${bonus}`)
    }
    if (player.unitPlayAttributeBonus) {
      const attrBonus = player.unitPlayAttributeBonus[card.attribute]
      if (attrBonus) {
        card.basePower += attrBonus
        card.currentPower += attrBonus
        messages.push(`${card.attribute}属性单位额外+${attrBonus}`)
        delete player.unitPlayAttributeBonus[card.attribute]
        if (Object.keys(player.unitPlayAttributeBonus).length === 0) {
          player.unitPlayAttributeBonus = undefined
        }
      }
    }
    return messages
  }

  static getAvailableSlotIndices(player: Player, card: Card): number[] {
    const slots: number[] = []
    player.field.forEach((slot, index) => {
      if (!slot.isExtra && !slot.card) {
        slots.push(index)
      } else if (this.canDeployOnExtraSlot(card, slot)) {
        slots.push(index)
      }
    })
    return slots
  }

  static getAvailableExtraSlotIndices(player: Player, card: Card): number[] {
    const slots: number[] = []
    player.field.forEach((slot, index) => {
      if (this.canDeployOnExtraSlot(card, slot)) slots.push(index)
    })
    return slots
  }

  static getPlayerTotalPower(player: Player): number {
    let total = player.bonusPower
    player.field.forEach(slot => {
      if (slot.card && !slot.isExtra) total += slot.card.currentPower
    })
    return total
  }

  static triggerReforgeEffects(player: Player, game: GameState) {
    const messages: string[] = []
    player.field.forEach(slot => {
      if (!slot.card?.effects) return
      slot.card.effects.forEach(effect => {
        if (effect.timing !== 'onReforge' || effect.type !== 'modifyPower' || !effect.selfTarget) return
        const delta = effect.value ?? 0
        if (effect.stackable !== false) {
          if (slot.card!.stackedBonus === undefined) slot.card!.stackedBonus = 0
          slot.card!.stackedBonus += delta
          slot.card!.currentPower += delta
        } else {
          slot.card!.basePower += delta
          slot.card!.currentPower += delta
        }
        messages.push(`${slot.card!.name} 重铸 战力+${delta}`)
      })
    })
    if (messages.length) {
      game.message = (game.message || '') + ' | ' + messages.join(' | ')
    }
  }

  /** quickPlay 单位部署后触发 onReveal（如贝壳 D6） */
  static applyQuickPlayRevealEffects(
    card: Card,
    targetCard: Card,
    player: Player,
    game: GameState,
  ): string[] {
    const messages: string[] = []
    card.effects?.forEach(effect => {
      if (effect.timing !== 'onReveal' || effect.type === 'conditional') return
      if (effect.type === 'd6TierPower') {
        const { roll, value } = this.rollD6TierValue(effect, player, card)
        const old = targetCard.currentPower
        targetCard.currentPower += value
        messages.push(`${card.name} D6=${roll}，战力+${value} | ${targetCard.name} ${old}→${targetCard.currentPower}`)
      }
    })
    if (messages.length) {
      game.message = (game.message || '') + ' | ' + messages.join(' | ')
    }
    return messages
  }

  /** 收集 destroy 效果可选目标（全场） */
  static getDestroyTargets(game: GameState, player: Player, effect: CardEffect): Card[] {
    const targets: Card[] = []
    game.players.forEach(p => {
      p.field.forEach(slot => {
        if (!slot.card) return
        if (p.id !== player.id && slot.card.untargetableByOthers) return
        if (effect.targetKeywords?.length && !this.hasAnyKeyword(slot.card, effect.targetKeywords)) return
        if (effect.targetCardType && slot.card.type !== effect.targetCardType) return
        targets.push(slot.card)
      })
    })
    return targets
  }

  /** 应用单条 onReveal 结构化效果；needsTargetSelection 时由 UI 接管 */
  static canDestroyTarget(targetCard: Card, effect: CardEffect): boolean {
    if (targetCard.type !== 'environment') return true
    if (effect.destroyEnvironment) return true
    if (effect.targetKeywords?.length && this.hasAnyKeyword(targetCard, effect.targetKeywords)) return true
    return false
  }

  /** 对单张场上牌执行 destroy：可选先减战力，降至阈值及以下则移入弃牌堆 */
  static applyDestroyToTarget(
    targetCard: Card,
    effect: CardEffect,
    game: GameState,
  ): { messages: string[]; destroyed: boolean } {
    const messages: string[] = []
    const threshold = effect.destroyThreshold ?? 0
    const delta = typeof effect.value === 'number' ? effect.value : 0
    if (delta !== 0) {
      targetCard.currentPower += delta
      if (targetCard.basePower !== undefined) targetCard.basePower += delta
      messages.push(`${targetCard.name} 战力${delta}`)
    }
    const instantKeywordDestroy = delta === 0 && (effect.targetKeywords?.length ?? 0) > 0
    const powerDestroy = targetCard.currentPower <= threshold
    const destroyed = (instantKeywordDestroy || powerDestroy) && this.canDestroyTarget(targetCard, effect)
    if (destroyed) {
      this.removeCardFromField(game, targetCard)
      messages.push(`${targetCard.name} 被摧毁`)
    }
    return { messages, destroyed }
  }

  static removeCardFromField(game: GameState, card: Card) {
    for (const p of game.players) {
      const idx = p.field.findIndex(s => s.card === card)
      if (idx !== -1) {
        p.field[idx].card = null
        p.discard.push(card)
        return
      }
    }
  }

  /** 应用单条 onReveal 结构化效果；needsTargetSelection 时由 UI 接管 */
  static applyRevealEffect(
    effect: CardEffect,
    card: Card,
    player: Player,
    game: GameState,
    otherPlayers: Player[] = game.players.filter(p => p.id !== player.id),
  ): { messages: string[]; needsTargetSelection?: { targets: Card[]; effect: CardEffect } } {
    const messages: string[] = []

    if (!this.checkFieldRequirements(player, effect)) {
      messages.push('条件不满足，效果未触发')
      return { messages }
    }

    if (effect.type === 'draw') {
      const count = effect.drawCount ?? (typeof effect.value === 'number' ? effect.value : 1)
      for (let i = 0; i < count; i++) {
        if (player.deck.length === 0) break
        const drawn = player.deck.pop()!
        player.hand.push(drawn)
        messages.push(`${player.name} 抽到了${drawn.name}`)
      }
      return { messages }
    }

    if (effect.type === 'modifyPower' && (effect.targetKeywords?.length || effect.allPlayers)) {
      const targets = this.getRevealModifyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有符合条件的目标')
        return { messages }
      }
      if (targets.length === 1 || effect.allPlayers) {
        const delta = effect.useD6Value ? this.rollD6() : (effect.value || 0)
        targets.forEach(t => { t.currentPower += delta })
        const sign = delta >= 0 ? '+' : ''
        messages.push(`${targets.map(t => t.name).join('、')} 战力${sign}${delta}${effect.useD6Value ? `(D6=${delta})` : ''}`)
        return { messages }
      }
      return { messages, needsTargetSelection: { targets, effect } }
    }

    if (effect.type === 'modifyCost') {
      if (effect.targetLeftPlayer) {
        const playerIndex = game.players.findIndex(p => p.id === player.id)
        const leftIndex = (playerIndex + 1) % game.players.length
        const target = game.players[leftIndex]
        if (target && target.id !== player.id) {
          target.currentCost += effect.value || 0
          messages.push(`${target.name} 能量${effect.value}`)
        }
      } else {
        otherPlayers.forEach(target => {
          target.currentCost += effect.value || 0
          messages.push(`${target.name} 费用${effect.value}`)
        })
      }
      return { messages }
    }

    if (effect.type === 'stealCard') {
      const playerIndex = game.players.findIndex(p => p.id === player.id)
      const opponent = effect.targetLeftPlayer
        ? game.players[(playerIndex + 1) % game.players.length]
        : otherPlayers.find(p => p.hand.length > 0)
      if (opponent && opponent.id !== player.id && opponent.hand.length > 0) {
        const randomIndex = Math.floor(Math.random() * opponent.hand.length)
        const stolen = opponent.hand.splice(randomIndex, 1)[0]
        player.hand.push(stolen)
        messages.push(`偷取了${opponent.name}的${stolen.name}`)
      } else {
        messages.push('没有可偷取的手牌')
      }
      return { messages }
    }

    if (effect.type === 'grantUnitPlayBonus') {
      const bonus = effect.value ?? 1
      player.unitPlayPowerBonus = (player.unitPlayPowerBonus || 0) + bonus
      messages.push(`之后打出的单位牌战力+${bonus}`)
      return { messages }
    }

    if (effect.type === 'destroy') {
      const targets = this.getDestroyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有可摧毁的目标')
        return { messages }
      }
      if (targets.length === 1) {
        const r = this.applyDestroyToTarget(targets[0], effect, game)
        messages.push(...r.messages)
        return { messages }
      }
      return { messages, needsTargetSelection: { targets, effect } }
    }

    if (effect.type === 'searchDeck') {
      if (!this.checkFieldRequirements(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const found = this.searchDeck(player, effect)
      if (found.length > 0) {
        player.hand.push(...found)
        messages.push(`检索到${found.length}张卡牌加入手牌`)
      } else {
        messages.push('未找到符合条件的卡牌')
      }
      return { messages }
    }

    if (effect.type === 'extraPlay') {
      player.canPlayExtra = true
      messages.push('效果：可以再打出一张牌！')
      return { messages }
    }

    if (effect.type === 'd6TierPower') {
      const { roll, value } = this.rollD6TierValue(effect, player, card)
      card.currentPower += value
      messages.push(`${card.name} D6=${roll}，战力+${value}`)
      return { messages }
    }

    return { messages }
  }

  /** 应用单条 onDeploy 结构化效果 */
  static applyDeployEffect(
    effect: CardEffect,
    card: Card,
    player: Player,
    game: GameState,
  ): { messages: string[]; needsCreateSlot?: boolean; needsTargetSelection?: { targets: Card[]; effect: CardEffect } } {
    const messages: string[] = []

    if (effect.type === 'extraPlay') {
      player.canPlayExtra = true
      messages.push('效果：可以再打出一张牌！')
      return { messages }
    }

    if (effect.type === 'createSlot') {
      return { messages: ['创建了额外槽位'], needsCreateSlot: true }
    }

    if (effect.type === 'searchDeck') {
      if (!this.checkFieldRequirements(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const found = this.searchDeck(player, effect)
      if (found.length > 0) {
        player.hand.push(...found)
        messages.push(`检索到${found.length}张卡牌加入手牌`)
      } else {
        messages.push('未找到符合条件的卡牌')
      }
      return { messages }
    }

    if (effect.type === 'restoreEnergy') {
      player.currentCost += effect.value || 0
      messages.push(`恢复${effect.value}点能量`)
      return { messages }
    }

    if (effect.type === 'grantAttributePlayBonus') {
      const attrs = effect.targetAttributes?.length
        ? effect.targetAttributes
        : ['风', '火', '水', '土']
      if (!player.unitPlayAttributeBonus) player.unitPlayAttributeBonus = {}
      const bonus = effect.value ?? 1
      for (const attr of attrs) {
        player.unitPlayAttributeBonus[attr as AttributeType] =
          (player.unitPlayAttributeBonus[attr as AttributeType] || 0) + bonus
      }
      messages.push(`下一张${attrs.join('/')}属性单位牌战力+${bonus}`)
      return { messages }
    }

    if (effect.type === 'setD6MinForCardName') {
      const name = effect.targetName || effect.searchName
      if (name) {
        if (!player.d6MinByCardName) player.d6MinByCardName = {}
        player.d6MinByCardName[name] = effect.d6Min ?? 5
        messages.push(`「${name}」掷骰结果不低于 ${effect.d6Min ?? 5}`)
      }
      return { messages }
    }

    if (effect.type === 'excludeFromFieldCount') {
      card.excludeFromFieldCount = true
      messages.push(`${card.name} 不计入终局数量`)
      return { messages }
    }

    if (effect.type === 'grantTacticPlayFree') {
      const kws = effect.targetKeywords?.length ? effect.targetKeywords : ['药剂']
      player.tacticPlayFreeKeywords = kws
      messages.push(`下一张${kws.join('/')}战术牌不占用行动`)
      return { messages }
    }

    if (effect.type === 'searchFromHandOrDeck') {
      const found = this.findInHandOrDeck(player, effect)
      if (!found) {
        messages.push('未找到符合条件的卡牌')
        return { messages }
      }
      const deployCard = found.card
      if (found.pile === 'deck') {
        player.deck.splice(found.index, 1)
      } else {
        player.hand.splice(found.index, 1)
      }
      if (effect.shuffleAfterSearch && player.deck.length > 1) {
        this.shuffleInPlace(player.deck)
      }
      const deployCost = this.getEffectivePlayCost(deployCard, player)
      const slots = this.getAvailableSlotIndices(player, deployCard)
      if (slots.length === 0 || player.currentCost < deployCost) {
        player.hand.push(deployCard)
        messages.push(slots.length === 0 ? `找到${deployCard.name}但无空槽` : `找到${deployCard.name}但费用不足`)
        return { messages }
      }
      player.currentCost -= deployCost
      player.field[slots[0]].card = deployCard
      this.applyUnitDeployBonuses(deployCard, player).forEach(m => messages.push(m))
      this.triggerOnOtherPlayEffects(deployCard, player, game)
      messages.push(`部署${deployCard.name}（费用${deployCost}）`)
      return { messages }
    }

    if (effect.type === 'deployFromHand') {
      const max = effect.maxCount ?? 1
      let deployed = 0
      for (let i = player.hand.length - 1; i >= 0 && deployed < max; i--) {
        const handCard = player.hand[i]
        if (effect.targetCardType && handCard.type !== effect.targetCardType) continue
        if (effect.targetKeywords?.length && !this.hasAnyKeyword(handCard, effect.targetKeywords)) continue
        const extraSlots = this.getAvailableExtraSlotIndices(player, handCard)
        if (extraSlots.length === 0) continue
        const deployCost = this.getEffectivePlayCost(handCard, player)
        if (player.currentCost < deployCost) continue
        player.currentCost -= deployCost
        player.hand.splice(i, 1)
        const slotIndex = extraSlots[0]
        const targetSlot = player.field[slotIndex]
        targetSlot.card = handCard
        this.applyExtraSlotDeployModifiers(handCard, targetSlot).forEach(m => messages.push(m))
        this.applyUnitDeployBonuses(handCard, player).forEach(m => messages.push(m))
        this.triggerOnOtherPlayEffects(handCard, player, game)
        messages.push(`部署${handCard.name}到额外槽位（费用${deployCost}）`)
        deployed++
      }
      if (deployed === 0) messages.push('未部署手牌中的物件单位')
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.selfTarget && effect.requireKeywords?.length) {
      const allMatch = effect.requireKeywords.every(keywordGroup =>
        player.field.some(otherSlot =>
          otherSlot.card && otherSlot.card !== card &&
          this.hasAnyKeyword(otherSlot.card, keywordGroup),
        ),
      )
      if (allMatch) {
        const delta = effect.value || 0
        card.basePower += delta
        card.currentPower += delta
        messages.push(`${card.name} 战力+${delta}`)
      } else {
        messages.push('条件不满足，效果未触发')
      }
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.selfTarget && effect.requireAllFieldAttributes?.length) {
      if (!this.hasAllFieldAttributes(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const delta = effect.value || 0
      card.basePower += delta
      card.currentPower += delta
      messages.push(`${card.name} 战力+${delta}`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.selfTarget && effect.countMatchingFieldCards) {
      const count = this.countMatchingFieldCards(player, card, effect)
      const delta = count * (effect.value || 0)
      if (delta !== 0) {
        card.basePower += delta
        card.currentPower += delta
        messages.push(`${card.name} 战力+${delta}（${count}张匹配）`)
      } else {
        messages.push('场上无匹配卡牌，效果未触发')
      }
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.selfTarget && effect.noHigherPowerUnitOnField) {
      const hasHigher = player.field.some(
        s => s.card && s.card !== card && s.card.type === 'unit' && s.card.basePower > card.basePower,
      )
      if (!hasHigher) {
        const delta = effect.value || 0
        card.basePower += delta
        card.currentPower += delta
        messages.push(`${card.name} 战力+${delta}`)
      } else {
        messages.push('场上有更高战力的单位，效果未触发')
      }
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.selfTarget && effect.noOtherFieldKeyword) {
      const hasOtherKw = player.field.some(
        s => s.card && s.card !== card && this.hasAnyKeyword(s.card, [effect.noOtherFieldKeyword!]),
      )
      if (hasOtherKw) {
        messages.push(`场上有其他「${effect.noOtherFieldKeyword}」，效果未触发`)
        return { messages }
      }
      if (effect.requireOtherFieldKeyword) {
        const hasOther = player.field.some(
          s => s.card && s.card !== card && this.hasAnyKeyword(s.card, [effect.requireOtherFieldKeyword!]),
        )
        if (!hasOther) {
          messages.push(`场上没有其他「${effect.requireOtherFieldKeyword}」，效果未触发`)
          return { messages }
        }
      }
      const delta = effect.value || 0
      card.basePower += delta
      card.currentPower += delta
      messages.push(`${card.name} 战力+${delta}`)
      return { messages }
    }

    if (effect.type === 'absNegativePower') {
      const targets = player.field
        .filter(s => s.card && s.card !== card && s.card.currentPower < 0)
        .map(s => s.card!)
      if (targets.length === 0) {
        messages.push('场上没有负数战力的卡牌')
        return { messages }
      }
      const target = targets[0]
      if (target.currentPower < 0) target.currentPower = Math.abs(target.currentPower)
      if (target.basePower < 0) target.basePower = Math.abs(target.basePower)
      messages.push(`${target.name} 战力变为正数（${target.currentPower}）`)
      return { messages }
    }

    if (effect.type === 'setFieldAttribute') {
      const players = effect.allPlayers ? game.players : [player]
      const attr = String(effect.value || '')
      let count = 0
      players.forEach(p => {
        p.field.forEach(slot => {
          if (!slot.card) return
          if (effect.targetCardType && slot.card.type !== effect.targetCardType) return
          slot.card.attribute = attr as Card['attribute']
          count++
        })
      })
      messages.push(count > 0 ? `${count}张卡牌属性变为${attr}` : '没有符合条件的目标')
      return { messages }
    }

    if (effect.type === 'debuffOpponentHand') {
      const playerIndex = game.players.findIndex(p => p.id === player.id)
      const leftIndex = (playerIndex + 1) % game.players.length
      const opponent = game.players[leftIndex]
      if (!opponent || opponent.id === player.id || opponent.hand.length === 0) {
        messages.push('没有可削弱的手牌目标')
        return { messages }
      }
      const maxCount = effect.handDebuffCount ?? effect.maxCount ?? 3
      const count = Math.min(maxCount, opponent.hand.length)
      const debuff = effect.value ?? -2
      const picked = new Set<number>()
      while (picked.size < count) {
        picked.add(Math.floor(Math.random() * opponent.hand.length))
      }
      for (const idx of picked) {
        const handCard = opponent.hand[idx]
        handCard.basePower += debuff
        handCard.currentPower += debuff
      }
      messages.push(`${opponent.name}的${count}张手牌基础战力${debuff}`)
      return { messages }
    }

    if (effect.type === 'destroy') {
      const targets = this.getDestroyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有可摧毁的目标')
        return { messages }
      }
      if (targets.length === 1) {
        const r = this.applyDestroyToTarget(targets[0], effect, game)
        messages.push(...r.messages)
        return { messages }
      }
      return { messages, needsTargetSelection: { targets, effect } }
    }

    return { messages }
  }

  // 检查卡牌是否会被摧毁
  static checkDestroy(card: Card): boolean {
    return card.currentPower < 0 && card.type !== 'environment'
  }

  // 触发场上摧毁效果
  static applyOnFieldDestroy(game: GameState) {
    game.players.forEach(player => {
      const toRemove: { targetIndex: number }[] = []
      player.field.forEach((slot, index) => {
        if (!slot.card || slot.isExtra) return
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onField' && effect.type === 'destroy') {
            if (effect.targetKeywords) {
              const targetSlot = player.field.find(otherSlot =>
                otherSlot !== slot && otherSlot.card &&
                EffectManager.hasAnyKeyword(otherSlot.card, effect.targetKeywords)
              )
              if (targetSlot && targetSlot.card) {
                toRemove.push({
                  targetIndex: player.field.indexOf(targetSlot)
                })
              }
            }
          }
        })
      })
      toRemove.forEach(({ targetIndex }) => {
        if (player.field[targetIndex] && player.field[targetIndex].card) {
          player.field[targetIndex].card = null
        }
      })
    })
  }

  static hasFieldAttributeMatching(player: Player, effect: CardEffect): boolean {
    const attrs = effect.requireFieldAttributes
    if (!attrs?.length) return true
    return attrs.some(attr =>
      player.field.some(s =>
        s.card &&
        s.card.attribute === attr &&
        (!effect.requireFieldCardType || s.card.type === effect.requireFieldCardType),
      ),
    )
  }

  static hasAllFieldAttributes(player: Player, effect: CardEffect): boolean {
    const attrs = effect.requireAllFieldAttributes
    if (!attrs?.length) return true
    const cardType = effect.requireFieldCardType
    return attrs.every(attr =>
      player.field.some(s =>
        s.card &&
        s.card.attribute === attr &&
        (!cardType || s.card.type === cardType),
      ),
    )
  }

  // 触发回合开始/结束效果
  static hasFieldMatching(player: Player, effect: CardEffect): boolean {
    return player.field.some(slot => {
      if (!slot.card) return false
      if (effect.requireFieldCardType && slot.card.type !== effect.requireFieldCardType) return false
      if (effect.requireFieldName && slot.card.name !== effect.requireFieldName) return false
      if (effect.requireFieldKeywords?.length) {
        return this.hasAnyKeyword(slot.card, effect.requireFieldKeywords)
      }
      if (effect.requireFieldName) return true
      return true
    })
  }

  /** deploy/reveal/round 共用：检查场上前置条件 */
  static checkFieldRequirements(player: Player, effect: CardEffect): boolean {
    if (effect.requireAllFieldAttributes?.length && !this.hasAllFieldAttributes(player, effect)) {
      return false
    }
    if (effect.requireFieldAttributes?.length && !this.hasFieldAttributeMatching(player, effect)) {
      return false
    }
    if (effect.requireFieldName || effect.requireFieldKeywords?.length) {
      return this.hasFieldMatching(player, effect)
    }
    if (effect.requireFieldCardType && !effect.requireFieldAttributes?.length && !effect.requireAllFieldAttributes?.length) {
      return player.field.some(s => s.card && s.card.type === effect.requireFieldCardType)
    }
    return true
  }

  static countMatchingFieldCards(player: Player, excludeCard: Card, effect: CardEffect): number {
    return player.field.filter(s => {
      if (!s.card || s.card === excludeCard) return false
      if (effect.targetCardType && s.card.type !== effect.targetCardType) return false
      if (effect.maxBasePower !== undefined && s.card.basePower > effect.maxBasePower) return false
      if (effect.targetKeywords?.length && !this.hasAnyKeyword(s.card, effect.targetKeywords)) return false
      return true
    }).length
  }

  static matchesRoundGlobalTarget(card: Card, effect: CardEffect): boolean {
    if (effect.targetCardType && card.type !== effect.targetCardType) return false
    if (effect.targetKeywords?.includes('单位') && card.type !== 'unit') return false
    if (effect.targetKeywords?.length && !effect.targetKeywords.includes('单位')) {
      if (!this.hasAnyKeyword(card, effect.targetKeywords)) return false
    }
    if (effect.targetAttributes?.length && !this.hasAnyAttribute(card, effect.targetAttributes)) return false
    if (effect.excludeAttributes?.length && this.hasAnyAttribute(card, effect.excludeAttributes)) return false
    return true
  }

  static getRoundGlobalTargets(game: GameState, ownerPlayer: Player, effect: CardEffect): Card[] {
    const players = effect.allPlayers ? game.players : [ownerPlayer]
    const targets: Card[] = []
    players.forEach(p => {
      p.field.forEach(slot => {
        if (slot.card && (effect.targetAllCards || effect.allPlayers) && this.matchesRoundGlobalTarget(slot.card, effect)) {
          targets.push(slot.card)
        }
      })
    })
    return targets
  }

  /** 计入终局 6 张上限的主槽位牌数（排除 excludeFromFieldCount） */
  static countMainFieldCardsForLimit(player: Player): number {
    return player.field.filter(s => !s.isExtra && s.card && !s.card.excludeFromFieldCount).length
  }

  static getConditionalPlayCost(card: Card, player: Player): number | null {
    for (const effect of card.effects || []) {
      if (effect.type !== 'conditionalPlayCost') continue
      if (this.checkFieldRequirements(player, effect)) {
        return effect.playCostValue ?? 0
      }
    }
    return null
  }

  /** 计算打出费用（含 onField modifyPlayCost，如季风） */
  static getEffectivePlayCost(card: Card, player: Player): number {
    const override = this.getConditionalPlayCost(card, player)
    if (override !== null) return Math.max(0, override)
    let cost = card.cost
    player.field.forEach(slot => {
      if (!slot.card?.effects) return
      slot.card.effects.forEach(effect => {
        if (effect.timing !== 'onField' || effect.type !== 'modifyPlayCost') return
        if (effect.targetCardType && card.type !== effect.targetCardType) return
        if (effect.targetAttributes?.length && !this.hasAnyAttribute(card, effect.targetAttributes)) return
        if (effect.targetKeywords?.length && !this.hasAnyKeyword(card, effect.targetKeywords)) return
        cost += (effect.value as number) || 0
      })
    })
    return Math.max(0, cost)
  }

  static applyRoundEffect(
    effect: CardEffect,
    ownerCard: Card,
    player: Player,
    game: GameState,
  ): { messages: string[] } {
    const messages: string[] = []

    if (effect.requireFieldKeywords?.length && !this.hasFieldMatching(player, effect)) {
      return { messages }
    }

    if (effect.d6Min !== undefined) {
      const roll = this.rollD6()
      if (roll < effect.d6Min) {
        return { messages }
      }
    }

    if (effect.type === 'restoreEnergy') {
      player.currentCost += effect.value || 0
      messages.push(`${player.name} 恢复${effect.value}点能量`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.allPlayers && (effect.targetAllCards || effect.excludeAttributes || effect.targetAttributes)) {
      const targets = this.getRoundGlobalTargets(game, player, effect)
      if (targets.length === 0) return { messages }
      const delta = effect.value || 0
      targets.forEach(t => { t.currentPower += delta })
      const sign = delta >= 0 ? '+' : ''
      messages.push(`${targets.length}张卡牌战力${sign}${delta}`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.targetOtherOnField) {
      const candidates: Card[] = []
      player.field.forEach(slot => {
        if (!slot.card || (effect.excludeSelf && slot.card === ownerCard)) return
        if (!this.matchesRoundGlobalTarget(slot.card, effect)) return
        candidates.push(slot.card)
      })
      if (candidates.length === 0) return { messages }
      const target = candidates[0]
      const delta = effect.value || 0
      target.currentPower += delta
      messages.push(`${target.name} 战力${delta >= 0 ? '+' : ''}${delta}`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.value && !effect.allPlayers) {
      ownerCard.currentPower += effect.value as number
      messages.push(`${ownerCard.name} 战力${(effect.value as number) > 0 ? '+' : ''}${effect.value}`)
      return { messages }
    }

    if (effect.type === 'modifyCost' && effect.value) {
      player.currentCost += effect.value as number
      messages.push(`${player.name} 能量${(effect.value as number) > 0 ? '+' : ''}${effect.value}`)
      return { messages }
    }

    if (effect.type === 'draw' && (effect.drawCount || effect.value)) {
      const count = effect.drawCount || (effect.value as number) || 1
      for (let i = 0; i < count; i++) {
        if (player.deck.length > 0) {
          const drawn = player.deck.pop()!
          player.hand.push(drawn)
          messages.push(`${player.name} 抽到了${drawn.name}`)
        }
      }
      return { messages }
    }

    if (effect.type === 'searchDeck') {
      if (!this.checkFieldRequirements(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const found = this.searchDeck(player, effect)
      if (found.length > 0) {
        player.hand.push(...found)
        messages.push(`${player.name} 检索到${found.length}张牌`)
      }
      return { messages }
    }

    return { messages }
  }

  static triggerRoundEffects(timing: 'roundStart' | 'roundEnd', game: GameState) {
    const messages: string[] = []
    game.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card || !slot.card.effects) return
        slot.card.effects.forEach(effect => {
          if (effect.timing !== timing) return
          if (effect.type === 'conditional' || effect.type === 'custom') return
          const result = this.applyRoundEffect(effect, slot.card, player, game)
          messages.push(...result.messages)
        })
      })
    })
    if (messages.length > 0) {
      game.message = game.message + ' | ' + messages.join(' | ')
    }
  }

  /** 药剂师：若打出的战术匹配 pending 关键词，恢复本回合行动 */
  static consumeTacticPlayFreeIfMatch(card: Card, player: Player): boolean {
    if (card.type !== 'tactic' || !player.tacticPlayFreeKeywords?.length) return false
    const kws = player.tacticPlayFreeKeywords
    const matched = kws.some(kw => this.hasAnyKeyword(card, [kw]))
    if (!matched) return false
    player.tacticPlayFreeKeywords = undefined
    player.hasPlayedThisTurn = false
    return true
  }

  static countUniqueAttributes(cards: Card[]): number {
    const attrs = new Set<string>()
    cards.forEach(c => {
      if (c.attribute && c.attribute !== '无') attrs.add(c.attribute)
    })
    return attrs.size
  }

  static applyGameEndEffect(
    effect: CardEffect,
    ownerCard: Card,
    player: Player,
    game?: GameState,
  ): { messages: string[] } {
    const messages: string[] = []

    if (effect.type === 'd6ModifyPower') {
      const d6 = this.rollD6()
      ownerCard.currentPower += d6
      messages.push(`${ownerCard.name} D6=${d6}，战力+${d6}`)
      return { messages }
    }

    if (effect.type === 'doubleTargetPower' && effect.targetName) {
      player.field.forEach(slot => {
        if (slot.card && slot.card.name === effect.targetName) {
          slot.card.currentPower *= 2
          messages.push(`${slot.card.name} 战力翻倍→${slot.card.currentPower}`)
        }
      })
      return { messages }
    }

    if (effect.type === 'setPowerIfNoFieldKeyword' && effect.targetKeywords?.length) {
      const hasOther = player.field.some(slot =>
        slot.card && slot.card !== ownerCard &&
        effect.targetKeywords!.some(kw => this.hasKeyword(slot.card!, kw)),
      )
      if (!hasOther && effect.value !== undefined) {
        ownerCard.currentPower = effect.value as number
        messages.push(`${ownerCard.name} 战力设为${effect.value}`)
      }
      return { messages }
    }

    if (effect.type === 'modifyPowerByUniqueAttributes') {
      const cards: Card[] = []
      player.field.forEach(slot => {
        if (slot.card) cards.push(slot.card)
      })
      if (effect.includeHand) cards.push(...player.hand)
      const count = this.countUniqueAttributes(cards)
      const delta = count * (effect.value ?? 1)
      if (delta !== 0) {
        ownerCard.currentPower += delta
        messages.push(`${ownerCard.name} ${count}种属性 → 战力+${delta}`)
      }
      return { messages }
    }

    if (effect.type === 'debuffAheadPlayers' && game) {
      const ownerPower = this.getPlayerTotalPower(player)
      const delta = effect.value ?? -4
      game.players.forEach(other => {
        if (other.id === player.id) return
        if (this.getPlayerTotalPower(other) > ownerPower) {
          other.bonusPower += delta
          messages.push(`${other.name} 战力${delta}（${ownerCard.name}）`)
        }
      })
      return { messages }
    }

    if (effect.type === 'destroyRandomOther') {
      this.destroyRandomOtherCard(ownerCard, player, game!, messages)
      return { messages }
    }

    if (effect.type === 'setPowerIfFieldNames' && effect.requireFieldNames?.length) {
      const hasEnv = player.field.some(
        slot => slot.card && slot.card.type === 'environment' && !slot.isExtra,
      )
      const hasNames = effect.requireFieldNames.every(name =>
        player.field.some(slot => slot.card && slot.card.name === name && !slot.isExtra),
      )
      if (hasEnv && hasNames && effect.value !== undefined) {
        this.applyGameEndPowerSet(ownerCard, player, effect.value as number, messages)
      }
      return { messages }
    }

    if (effect.type === 'setPowerIfOnlyHandCard') {
      if (player.hand.length === 1 && player.hand[0] === ownerCard && effect.value !== undefined) {
        this.applyGameEndPowerSet(ownerCard, player, effect.value as number, messages)
      }
      return { messages }
    }

    return { messages }
  }

  static triggerGameEndEffects(game: GameState) {
    const messages: string[] = []
    const runOnGameEnd = (ownerCard: Card, player: Player, pass: 'destroy' | 'other') => {
      if (!ownerCard.effects) return
      ownerCard.effects.forEach(effect => {
        if (effect.timing !== 'onGameEnd') return
        if (effect.type === 'conditional' || effect.type === 'custom') return
        if (pass === 'destroy' && effect.type !== 'destroyRandomOther') return
        if (pass === 'other' && effect.type === 'destroyRandomOther') return
        const result = this.applyGameEndEffect(effect, ownerCard, player, game)
        messages.push(...result.messages)
      })
    }
    game.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card) return
        runOnGameEnd(slot.card, player, 'destroy')
      })
      player.hand.forEach(card => runOnGameEnd(card, player, 'destroy'))
    })
    game.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card) return
        runOnGameEnd(slot.card, player, 'other')
      })
      player.hand.forEach(card => runOnGameEnd(card, player, 'other'))
    })
    if (messages.length > 0) {
      game.message = (game.message || '') + ' | ' + messages.join(' | ')
    }
  }
}
