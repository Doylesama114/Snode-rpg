import type { Card, Player, GameState, FieldSlot, EffectContext, CardEffect } from '@/types/game'

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
            // 检查部署的卡牌是否符合条件（按关键词）
            const keywordMatch = effect.targetKeywords && this.hasAnyKeyword(deployedCard, effect.targetKeywords)
            // 检查部署的卡牌是否符合条件（按属性）
            const attrMatch = effect.targetAttributes && Array.isArray(effect.targetAttributes) && this.hasAnyAttribute(deployedCard, effect.targetAttributes)
            if (keywordMatch || attrMatch) {
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
    if (effect.searchName && card.name.includes(effect.searchName)) return true
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

  // Search deck for cards matching name or keyword
  static searchDeck(player: Player, effect: CardEffect): Card[] {
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

  /** 应用单条 onReveal 结构化效果；needsTargetSelection 时由 UI 接管 */
  static applyRevealEffect(
    effect: CardEffect,
    card: Card,
    player: Player,
    game: GameState,
    otherPlayers: Player[] = game.players.filter(p => p.id !== player.id),
  ): { messages: string[]; needsTargetSelection?: { targets: Card[]; effect: CardEffect } } {
    const messages: string[] = []

    if (effect.type === 'modifyPower' && (effect.targetKeywords?.length || effect.allPlayers)) {
      const targets = this.getRevealModifyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有符合条件的目标')
        return { messages }
      }
      if (targets.length === 1 || effect.allPlayers) {
        const delta = effect.value || 0
        targets.forEach(t => { t.currentPower += delta })
        const sign = delta >= 0 ? '+' : ''
        messages.push(`${targets.map(t => t.name).join('、')} 战力${sign}${delta}`)
        return { messages }
      }
      return { messages, needsTargetSelection: { targets, effect } }
    }

    if (effect.type === 'modifyCost') {
      otherPlayers.forEach(target => {
        target.currentCost += effect.value || 0
        messages.push(`${target.name} 费用${effect.value}`)
      })
      return { messages }
    }

    if (effect.type === 'searchDeck') {
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

  // 触发回合开始/结束效果
  static triggerRoundEffects(timing: 'roundStart' | 'roundEnd', game: GameState) {
    const messages: string[] = []
    game.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card || !slot.card.effects) return
        slot.card.effects.forEach(effect => {
          if (effect.timing !== timing) return

          if (effect.type === 'modifyPower' && effect.value) {
            slot.card.currentPower += effect.value as number
            messages.push(`${slot.card.name} 战力${(effect.value as number) > 0 ? '+' : ''}${effect.value}`)
          } else if (effect.type === 'modifyCost' && effect.value) {
            player.currentCost += effect.value as number
            messages.push(`${player.name} 能量${(effect.value as number) > 0 ? '+' : ''}${effect.value}`)
          } else if (effect.type === 'draw' && (effect.drawCount || effect.value)) {
            const count = effect.drawCount || (effect.value as number) || 1
            for (let i = 0; i < count; i++) {
              if (player.deck.length > 0) {
                const drawn = player.deck.pop()!
                player.hand.push(drawn)
                messages.push(`${player.name} 抽到了${drawn.name}`)
              }
            }
          } else if (effect.type === 'searchDeck') {
            const found = EffectManager.searchDeck(player, effect)
            if (found.length > 0) {
              player.hand.push(...found)
              messages.push(`${player.name} 检索到${found.length}张牌`)
            }
          }
        })
      })
    })
    if (messages.length > 0) {
      game.message = game.message + ' | ' + messages.join(' | ')
    }
  }
}
