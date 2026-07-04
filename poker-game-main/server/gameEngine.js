// 服务器端游戏引擎 - 权威游戏逻辑
// 完整移植自客户端 useGameMultiplayer.ts 和 effectManager.ts

import { getCard, createDefaultDeck, createDeckFromCardIds, shuffleDeck } from './cardData.js'

// 效果管理器（从 effectManager.ts 完整移植）
class EffectManager {
  // 掷一颗D6骰子，返回1-6的随机整数
  static rollD6() {
    return Math.floor(Math.random() * 6) + 1
  }

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

  // 检查卡牌是否有指定属性
  static hasAttribute(card, attribute) {
    if (!card) return false
    return card.attribute === attribute
  }

  // 检查卡牌是否有任意一个属性
  static hasAnyAttribute(card, attributes) {
    if (!card || !attributes || attributes.length === 0) return false
    return attributes.some(attr => this.hasAttribute(card, attr))
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

  // 应用 selfTarget onField modifyPower（累加多个效果）
  static applySelfTargetFieldEffects(card, player, game) {
    if (!card.effects) return

    let selfBonus = 0
    let replacedPower = null

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
          this.hasAnyKeyword(otherSlot.card, effect.targetKeywords)
        )
        const conditionMet = effect.invertCondition ? !hasMatch : hasMatch
        if (conditionMet) {
          if (effect.stackable !== false) {
            const matchCount = player.field.filter(otherSlot =>
              otherSlot.card && otherSlot.card !== card &&
              this.hasAnyKeyword(otherSlot.card, effect.targetKeywords)
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
          this.hasAnyAttribute(otherSlot.card, effect.targetAttributes)
        )
        const conditionMet = effect.invertCondition ? !hasMatch : hasMatch
        if (conditionMet) {
          if (effect.stackable !== false) {
            const matchCount = player.field.filter(otherSlot =>
              otherSlot.card && otherSlot.card !== card &&
              this.hasAnyAttribute(otherSlot.card, effect.targetAttributes)
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

  /** @deprecated 逻辑已合并至 recalculateCardPower */
  static applyOnFieldSelfModify(game) {
    game.gameState.players.forEach(player => {
      player.field.forEach(slot => {
        if (slot.card && !slot.isExtra) {
          // no-op: handled in recalculateCardPower
        }
      })
    })
  }

  // Destroy cards whose effects trigger onField destroy
  static applyOnFieldDestroy(game) {
    game.gameState.players.forEach(player => {
      const toRemove = []
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
                  sourceSlot: index,
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

  // 按时机触发所有回合效果
  static hasFieldAttributeMatching(player, effect) {
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

  static hasAllFieldAttributes(player, effect) {
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

  static hasFieldMatching(player, effect) {
    return player.field.some(slot => {
      if (!slot.card) return false
      if (effect.requireFieldCardType && slot.card.type !== effect.requireFieldCardType) return false
      if (effect.requireFieldName && slot.card.name !== effect.requireFieldName) return false
      if (effect.requireFieldKeywords?.length) {
        return EffectManager.hasAnyKeyword(slot.card, effect.requireFieldKeywords)
      }
      if (effect.requireFieldName) return true
      return true
    })
  }

  static checkFieldRequirements(player, effect) {
    if (effect.requireAllFieldAttributes?.length && !EffectManager.hasAllFieldAttributes(player, effect)) {
      return false
    }
    if (effect.requireFieldAttributes?.length && !EffectManager.hasFieldAttributeMatching(player, effect)) {
      return false
    }
    if (effect.requireFieldName || effect.requireFieldKeywords?.length) {
      return EffectManager.hasFieldMatching(player, effect)
    }
    if (effect.requireFieldCardType && !effect.requireFieldAttributes?.length && !effect.requireAllFieldAttributes?.length) {
      return player.field.some(s => s.card && s.card.type === effect.requireFieldCardType)
    }
    return true
  }

  static countMatchingFieldCards(player, excludeCard, effect) {
    return player.field.filter(s => {
      if (!s.card || s.card === excludeCard) return false
      if (effect.targetCardType && s.card.type !== effect.targetCardType) return false
      if (effect.maxBasePower !== undefined && s.card.basePower > effect.maxBasePower) return false
      if (effect.targetKeywords?.length && !EffectManager.hasAnyKeyword(s.card, effect.targetKeywords)) return false
      return true
    }).length
  }

  static slotRulesFromEffect(effect) {
    if (effect.type !== 'createSlot') return undefined
    const rules = {}
    if (effect.slotDeployKeywords?.length) rules.deployKeywords = effect.slotDeployKeywords
    if (effect.slotDeployCardType) rules.deployCardType = effect.slotDeployCardType
    if (effect.slotDeployAttributes?.length) rules.deployAttributes = effect.slotDeployAttributes
    if (effect.slotExcludeFromFieldCount) rules.excludeFromFieldCount = true
    if (effect.slotDeployedPowerBonus) rules.deployedPowerBonus = effect.slotDeployedPowerBonus
    return Object.keys(rules).length > 0 ? rules : undefined
  }

  static buildExtraSlot(parentSlotIndex, position, rules) {
    return { card: null, position, isExtra: true, parentSlot: parentSlotIndex, deployRules: rules }
  }

  static canDeployOnExtraSlot(card, slot) {
    if (!slot.isExtra || slot.card) return false
    if (card.type !== 'unit') return false
    const rules = slot.deployRules
    if (!rules) return true
    if (rules.deployCardType && card.type !== rules.deployCardType) return false
    if (rules.deployAttributes?.length && !EffectManager.hasAnyAttribute(card, rules.deployAttributes)) return false
    if (rules.deployKeywords?.length && !EffectManager.hasAnyKeyword(card, rules.deployKeywords)) return false
    return true
  }

  static applyExtraSlotDeployModifiers(card, slot) {
    const messages = []
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

  static applyUnitDeployBonuses(card, player) {
    const messages = []
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
    EffectManager.initializeCardCharges(card)
    return messages
  }

  static getAvailableSlotIndices(player, card) {
    if (EffectManager.requiresMandatoryHostDeploy(card) && !card.quickPlay) return []
    const slots = []
    player.field.forEach((slot, index) => {
      if (!slot.isExtra && !slot.card) {
        slots.push(index)
      } else if (EffectManager.canDeployOnExtraSlot(card, slot)) {
        slots.push(index)
      }
    })
    return slots
  }

  static getAvailableExtraSlotIndices(player, card) {
    const slots = []
    player.field.forEach((slot, index) => {
      if (EffectManager.canDeployOnExtraSlot(card, slot)) slots.push(index)
    })
    return slots
  }

  static getPlayerTotalPower(player) {
    let total = player.bonusPower
    player.field.forEach(slot => {
      if (slot.card && !slot.isExtra) total += slot.card.currentPower
    })
    return total
  }

  static triggerReforgeEffects(player, game) {
    const gameState = game.gameState || game
    const messages = []
    player.field.forEach(slot => {
      if (!slot.card?.effects) return
      slot.card.effects.forEach(effect => {
        if (effect.timing !== 'onReforge' || effect.type !== 'modifyPower' || !effect.selfTarget) return
        const delta = effect.value ?? 0
        if (effect.stackable !== false) {
          if (slot.card.stackedBonus === undefined) slot.card.stackedBonus = 0
          slot.card.stackedBonus += delta
          slot.card.currentPower += delta
        } else {
          slot.card.basePower += delta
          slot.card.currentPower += delta
        }
        messages.push(`${slot.card.name} 重铸 战力+${delta}`)
      })
    })
    if (messages.length) {
      gameState.message = (gameState.message || '') + ' | ' + messages.join(' | ')
    }
  }

  static matchesRoundGlobalTarget(card, effect) {
    if (effect.targetCardType && card.type !== effect.targetCardType) return false
    if (effect.targetKeywords?.includes('单位') && card.type !== 'unit') return false
    if (effect.targetKeywords?.length && !effect.targetKeywords.includes('单位')) {
      if (!EffectManager.hasAnyKeyword(card, effect.targetKeywords)) return false
    }
    if (effect.targetAttributes?.length && !EffectManager.hasAnyAttribute(card, effect.targetAttributes)) return false
    if (effect.excludeAttributes?.length && EffectManager.hasAnyAttribute(card, effect.excludeAttributes)) return false
    return true
  }

  static getRoundGlobalTargets(gameState, ownerPlayer, effect) {
    const players = effect.allPlayers ? gameState.players : [ownerPlayer]
    const targets = []
    players.forEach(p => {
      p.field.forEach(slot => {
        if (slot.card && (effect.targetAllCards || effect.allPlayers) && EffectManager.matchesRoundGlobalTarget(slot.card, effect)) {
          targets.push(slot.card)
        }
      })
    })
    return targets
  }

  static countMainFieldCardsForLimit(player) {
    return player.field.filter(s => !s.isExtra && s.card && !s.card.excludeFromFieldCount).length
  }

  static getConditionalPlayCost(card, player) {
    for (const effect of card.effects || []) {
      if (effect.type !== 'conditionalPlayCost') continue
      if (EffectManager.checkFieldRequirements(player, effect)) {
        return effect.playCostValue ?? 0
      }
    }
    return null
  }

  static getEffectivePlayCost(card, player) {
    const override = EffectManager.getConditionalPlayCost(card, player)
    if (override !== null) return Math.max(0, override)
    let cost = card.cost
    player.field.forEach(slot => {
      if (!slot.card?.effects) return
      slot.card.effects.forEach(effect => {
        if (effect.timing !== 'onField' || effect.type !== 'modifyPlayCost') return
        if (effect.targetCardType && card.type !== effect.targetCardType) return
        if (effect.targetAttributes?.length && !EffectManager.hasAnyAttribute(card, effect.targetAttributes)) return
        if (effect.targetKeywords?.length && !EffectManager.hasAnyKeyword(card, effect.targetKeywords)) return
        cost += effect.value || 0
      })
    })
    return Math.max(0, cost)
  }

  static applyRoundEffect(effect, ownerCard, player, gameState) {
    const messages = []

    if (effect.requireFieldKeywords?.length && !EffectManager.hasFieldMatching(player, effect)) {
      return { messages }
    }

    if (effect.requireDeployedOnSelf && EffectManager.countDeployedOnHost(ownerCard, player) === 0) {
      return { messages }
    }

    if (effect.d6Min !== undefined) {
      const roll = EffectManager.rollD6()
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
      const targets = EffectManager.getRoundGlobalTargets(gameState, player, effect)
      if (targets.length === 0) return { messages }
      const rawDelta = effect.value || 0
      targets.forEach(t => { EffectManager.applyCardPowerDelta(t, rawDelta) })
      const sign = rawDelta >= 0 ? '+' : ''
      messages.push(`${targets.length}张卡牌战力${sign}${rawDelta}`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.targetOtherOnField) {
      const candidates = []
      player.field.forEach(slot => {
        if (!slot.card || (effect.excludeSelf && slot.card === ownerCard)) return
        if (!EffectManager.matchesRoundGlobalTarget(slot.card, effect)) return
        candidates.push(slot.card)
      })
      if (candidates.length === 0) return { messages }
      const target = candidates[0]
      const delta = EffectManager.applyCardPowerDelta(target, effect.value || 0)
      messages.push(`${target.name} 战力${delta >= 0 ? '+' : ''}${delta}`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.value && !effect.allPlayers) {
      const delta = EffectManager.applyCardPowerDelta(ownerCard, effect.value)
      messages.push(`${ownerCard.name} 战力${delta >= 0 ? '+' : ''}${delta}`)
      return { messages }
    }

    if (effect.type === 'modifyCost' && effect.value) {
      player.currentCost += effect.value
      messages.push(`${player.name} 能量${effect.value > 0 ? '+' : ''}${effect.value}`)
      return { messages }
    }

    if (effect.type === 'draw' && (effect.drawCount || effect.value)) {
      const count = effect.drawCount || effect.value || 1
      for (let i = 0; i < count; i++) {
        if (player.deck.length > 0) {
          const drawn = player.deck.pop()
          player.hand.push(drawn)
          messages.push(`${player.name} 抽到了${drawn.name}`)
        }
      }
      return { messages }
    }

    if (effect.type === 'searchDeck') {
      if (!EffectManager.checkFieldRequirements(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const found = EffectManager.searchDeck(player, effect)
      if (found.length > 0) {
        player.hand.push(...found)
        messages.push(`${player.name} 检索到${found.length}张牌`)
      }
      return { messages }
    }

    if (effect.type === 'discardHandForLeftPlayerDebuff') {
      if (effect.oncePerRound && ownerCard.roundUsed) return { messages }
      const attrs = effect.discardHandAttributes?.length
        ? effect.discardHandAttributes
        : effect.targetAttributes?.length
          ? effect.targetAttributes
          : []
      const handIdx = player.hand.findIndex(c => attrs.includes(c.attribute))
      if (handIdx === -1) return { messages }
      const discarded = player.hand.splice(handIdx, 1)[0]
      player.discard.push(discarded)
      messages.push(`弃置${discarded.name}`)
      const leftPlayer = EffectManager.getLeftPlayer(gameState, player)
      if (leftPlayer) {
        const debuff = effect.debuffBonusPower ?? effect.value ?? -2
        leftPlayer.bonusPower += debuff
        messages.push(`${leftPlayer.name} 终局战力${debuff >= 0 ? '+' : ''}${debuff}`)
      }
      if (effect.oncePerRound) ownerCard.roundUsed = true
      return { messages }
    }

    if (effect.type === 'chargeDebuffUnit') {
      if ((ownerCard.charges ?? 0) <= 0) return { messages }
      if (effect.oncePerRound && ownerCard.roundUsed) return { messages }
      const debuff = effect.value ?? -1
      const targets = []
      gameState.players.forEach(p => {
        if (p.id === player.id) return
        p.field.forEach(s => {
          if (s.card?.type === 'unit') targets.push(s.card)
        })
      })
      if (targets.length === 0) {
        messages.push('没有可削弱的目标')
        return { messages }
      }
      const target = targets[0]
      EffectManager.applyCardPowerDelta(target, debuff)
      ownerCard.charges = (ownerCard.charges ?? 1) - 1
      messages.push(`消耗1充能，${target.name} 战力${debuff}`)
      if (effect.oncePerRound) ownerCard.roundUsed = true
      return { messages }
    }

    if (effect.type === 'scryDeckTop') {
      const n = effect.scryCount ?? 3
      const take = effect.scryTake ?? 1
      if (player.deck.length === 0) return { messages }
      const count = Math.min(n, player.deck.length)
      const scry = player.deck.splice(player.deck.length - count, count)
      scry.sort((a, b) => b.basePower - a.basePower)
      const taken = scry.splice(0, Math.min(take, scry.length))
      player.hand.push(...taken)
      if (effect.scryRestToBottom !== false) {
        player.deck.unshift(...scry.reverse())
      } else {
        player.deck.push(...scry)
      }
      messages.push(`占卜${count}张，取${taken.map(c => c.name).join('、')}`)
      return { messages }
    }

    if (effect.type === 'effectBranch') {
      if (effect.oncePerRound && ownerCard.roundUsed) return { messages }
      const attrs = effect.discardHandAttributes ?? []
      const handIdx = player.hand.findIndex(c => attrs.includes(c.attribute))
      if (handIdx === -1) return { messages }
      player.discard.push(player.hand.splice(handIdx, 1)[0])
      const branch = effect.branchDefault ?? 'A'
      const sub = effect.branches?.[branch]
      if (sub) {
        messages.push(...EffectManager.applyBranchSubEffect(sub, ownerCard, player, gameState))
      }
      if (effect.oncePerRound) ownerCard.roundUsed = true
      return { messages }
    }

    return { messages }
  }

  static applyPendingRoundStartEnergy(game) {
    const gameState = game.gameState || game
    const messages = []
    gameState.players.forEach(player => {
      if (player.pendingNextRoundStartEnergy) {
        player.currentCost += player.pendingNextRoundStartEnergy
        messages.push(`${player.name} 恢复${player.pendingNextRoundStartEnergy}点能量`)
        player.pendingNextRoundStartEnergy = 0
      }
      if (gameState.isFinalRound && player.pendingFinalRoundStartEnergy) {
        player.currentCost += player.pendingFinalRoundStartEnergy
        messages.push(`${player.name} 最后一轮恢复${player.pendingFinalRoundStartEnergy}点能量`)
        player.pendingFinalRoundStartEnergy = 0
      }
    })
    return messages
  }

  static applyFirstRoundAutoEntries(game) {
    const gameState = game.gameState || game
    const messages = []
    if (gameState.round !== 1) return messages

    for (const player of gameState.players) {
      const piles = [
        { label: '手牌', pile: player.hand },
        { label: '牌库', pile: player.deck },
        { label: '弃牌堆', pile: player.discard },
      ]
      let handled = false
      for (const { label, pile } of piles) {
        const idx = pile.findIndex(c =>
          c.effects?.some(e => e.type === 'autoEnterFromZone' && e.firstRoundOnly !== false),
        )
        if (idx === -1) continue
        const card = pile[idx]
        const slots = EffectManager.getAvailableSlotIndices(player, card)
        const cost = EffectManager.getEffectivePlayCost(card, player)
        if (slots.length === 0 || player.currentCost < cost) {
          messages.push(`${card.name} 在${label}但无法自动进场（槽位或费用不足）`)
          handled = true
          break
        }
        pile.splice(idx, 1)
        player.currentCost -= cost
        player.field[slots[0]].card = card
        EffectManager.applyUnitDeployBonuses(card, player).forEach(m => messages.push(m))
        card.effects?.forEach(eff => {
          if (eff.type === 'autoEnterFromZone' || eff.type === 'conditional') return
          if (eff.timing === 'onDeploy') {
            const r = EffectManager.applyDeployEffect(eff, card, player, gameState)
            messages.push(...r.messages)
          } else if (eff.timing === 'onReveal') {
            const r = EffectManager.applyRevealEffect(eff, card, player, gameState)
            messages.push(...r.messages)
          }
        })
        EffectManager.triggerOnOtherPlayEffects(card, player, gameState)
        messages.push(`${card.name} 首回合自动进场（费用${cost}）`)
        handled = true
        break
      }
      if (handled) continue
    }
    return messages
  }

  static triggerRoundEffects(timing, game) {
    const gameState = game.gameState || game
    const messages = []
    if (timing === 'roundStart') {
      gameState.players.forEach(p => {
        p.field.forEach(slot => {
          if (slot.card) slot.card.roundUsed = false
        })
      })
      messages.push(...EffectManager.applyPendingRoundStartEnergy(game))
      EffectManager.unlockFinalRoundHandCards(gameState)
      messages.push(...EffectManager.applyFirstRoundAutoEntries(game))
    }
    if (timing === 'roundEnd') {
      messages.push(...EffectManager.applyPendingRoundEndBuffs(game))
    }
    gameState.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card || !slot.card.effects) return
        slot.card.effects.forEach(effect => {
          if (effect.timing !== timing) return
          if (effect.type === 'conditional' || effect.type === 'custom') return
          const result = EffectManager.applyRoundEffect(effect, slot.card, player, gameState)
          messages.push(...result.messages)
        })
      })
    })
    if (messages.length > 0) {
      gameState.message = gameState.message + ' | ' + messages.join(' | ')
    }
  }

  static consumeTacticPlayFreeIfMatch(card, player) {
    if (card.type !== 'tactic' || !player.tacticPlayFreeKeywords?.length) return false
    const kws = player.tacticPlayFreeKeywords
    const matched = kws.some(kw => EffectManager.hasAnyKeyword(card, [kw]))
    if (!matched) return false
    player.tacticPlayFreeKeywords = undefined
    player.hasPlayedThisTurn = false
    return true
  }

  static countUniqueAttributes(cards) {
    const attrs = new Set()
    cards.forEach(c => {
      if (c.attribute && c.attribute !== '无') attrs.add(c.attribute)
    })
    return attrs.size
  }

  static applyGameEndEffect(effect, ownerCard, player, game) {
    const messages = []

    if (effect.type === 'd6ModifyPower') {
      const d6 = EffectManager.rollD6()
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
        effect.targetKeywords.some(kw => EffectManager.hasKeyword(slot.card, kw)),
      )
      if (!hasOther && effect.value !== undefined) {
        ownerCard.currentPower = effect.value
        messages.push(`${ownerCard.name} 战力设为${effect.value}`)
      }
      return { messages }
    }

    if (effect.type === 'modifyPowerByUniqueAttributes') {
      const cards = []
      player.field.forEach(slot => {
        if (slot.card) cards.push(slot.card)
      })
      if (effect.includeHand) cards.push(...player.hand)
      const count = EffectManager.countUniqueAttributes(cards)
      const delta = count * (effect.value ?? 1)
      if (delta !== 0) {
        ownerCard.currentPower += delta
        messages.push(`${ownerCard.name} ${count}种属性 → 战力+${delta}`)
      }
      return { messages }
    }

    if (effect.type === 'debuffAheadPlayers' && game) {
      const gameState = game.gameState || game
      const ownerPower = EffectManager.getPlayerTotalPower(player)
      const delta = effect.value ?? -4
      gameState.players.forEach(other => {
        if (other.id === player.id) return
        if (EffectManager.getPlayerTotalPower(other) > ownerPower) {
          other.bonusPower += delta
          messages.push(`${other.name} 战力${delta}（${ownerCard.name}）`)
        }
      })
      return { messages }
    }

    if (effect.type === 'destroyRandomOther') {
      EffectManager.destroyRandomOtherCard(ownerCard, player, game, messages)
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
        EffectManager.applyGameEndPowerSet(ownerCard, player, effect.value, messages)
      }
      return { messages }
    }

    if (effect.type === 'setPowerIfOnlyHandCard') {
      if (player.hand.length === 1 && player.hand[0] === ownerCard && effect.value !== undefined) {
        EffectManager.applyGameEndPowerSet(ownerCard, player, effect.value, messages)
      }
      return { messages }
    }

    if (effect.type === 'setPowerIfFieldKeyword' && effect.requireFieldKeywords?.length) {
      const hasKeyword = player.field.some(
        slot => slot.card && !slot.isExtra &&
          effect.requireFieldKeywords.some(kw => EffectManager.hasKeyword(slot.card, kw)),
      )
      if (hasKeyword && effect.value !== undefined) {
        EffectManager.applyGameEndPowerSet(ownerCard, player, effect.value, messages)
      }
      return { messages }
    }

    if (effect.type === 'setPowerIfHandNames' && effect.requireHandNames?.length) {
      const hasNames = effect.requireHandNames.every(name =>
        player.hand.some(c => c.name === name),
      )
      if (hasNames && effect.value !== undefined) {
        EffectManager.applyGameEndPowerSet(ownerCard, player, effect.value, messages)
      }
      return { messages }
    }

    return { messages }
  }

  static triggerGameEndEffects(game) {
    const gameState = game.gameState || game
    const messages = []
    const runOnGameEnd = (ownerCard, player, pass) => {
      if (!ownerCard.effects) return
      ownerCard.effects.forEach(effect => {
        if (effect.timing !== 'onGameEnd') return
        if (effect.type === 'conditional' || effect.type === 'custom') return
        if (pass === 'destroy' && effect.type !== 'destroyRandomOther') return
        if (pass === 'other' && effect.type === 'destroyRandomOther') return
        const result = EffectManager.applyGameEndEffect(effect, ownerCard, player, gameState)
        messages.push(...result.messages)
      })
    }
    gameState.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card) return
        runOnGameEnd(slot.card, player, 'destroy')
      })
      player.hand.forEach(card => runOnGameEnd(card, player, 'destroy'))
    })
    gameState.players.forEach(player => {
      player.field.forEach(slot => {
        if (!slot.card) return
        runOnGameEnd(slot.card, player, 'other')
      })
      player.hand.forEach(card => runOnGameEnd(card, player, 'other'))
    })
    if (messages.length > 0) {
      gameState.message = (gameState.message || '') + ' | ' + messages.join(' | ')
    }
  }

  // 触发"其他卡牌打出时"的效果
  static triggerOnOtherPlayEffects(deployedCard, player, game) {
    const messages = []
    
    player.field.forEach(slot => {
      if (slot.card && slot.card !== deployedCard && slot.card.effects) {
        slot.card.effects.forEach(effect => {
          if (effect.timing === 'onOtherPlay' && effect.type === 'modifyPower') {
            if (effect.triggerPlayedCardType && deployedCard.type !== effect.triggerPlayedCardType) {
              return
            }
            const keywordMatch = effect.targetKeywords && EffectManager.hasAnyKeyword(deployedCard, effect.targetKeywords)
            const attrMatch = effect.targetAttributes && Array.isArray(effect.targetAttributes) && EffectManager.hasAnyAttribute(deployedCard, effect.targetAttributes)
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
            if (slot.card.name === '法师' && deployedCard.type === 'tactic' && EffectManager.hasKeyword(deployedCard, '魔法')) {
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
              else if (effect.buffPlayedCard) {
                const times = effect.triggerCount ?? 1
                const delta = (effect.value || 0) * times
                const oldPower = deployedCard.currentPower
                deployedCard.currentPower += delta
                messages.push(`${deployedCard.name} 战力${oldPower}→${deployedCard.currentPower}（${slot.card.name}）`)
              }
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
    card.currentPower = card.basePower
    card.untargetableByOthers = false

    for (const effect of card.effects) {
      if (effect.timing === 'onField' && effect.type === 'grantUntargetable') {
        card.untargetableByOthers = EffectManager.checkFieldRequirements(player, effect)
      }
    }

    if (card.stackedBonus !== undefined && card.stackedBonus > 0) {
      card.currentPower += card.stackedBonus
    }

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
  static getValidTargets(player, keywords) {
    const targets = []
    
    player.field.forEach(slot => {
      if (slot.card && this.hasAnyKeyword(slot.card, keywords)) {
        targets.push(slot.card)
      }
    })
    
    return targets
  }

  static matchesSearch(card, effect) {
    if (effect.targetCardType && card.type !== effect.targetCardType) return false
    if (effect.searchName && card.name.includes(effect.searchName)) return true
    if (effect.searchNames?.some(n => card.name.includes(n))) return true
    const keywords = effect.searchKeywords?.length
      ? effect.searchKeywords
      : effect.searchKeyword ? [effect.searchKeyword] : []
    if (keywords.length > 0 && keywords.some(kw => EffectManager.hasKeyword(card, kw))) return true
    if (effect.searchAttribute && card.attribute === effect.searchAttribute) return true
    return false
  }

  static getLeftPlayer(game, player) {
    const gameState = game.gameState || game
    const playerIndex = gameState.players.findIndex(p => p.id === player.id)
    if (playerIndex === -1 || gameState.players.length < 2) return undefined
    const leftIndex = (playerIndex + 1) % gameState.players.length
    const target = gameState.players[leftIndex]
    return target?.id !== player.id ? target : undefined
  }

  static getAdjacentPlayers(game, player) {
    const gameState = game.gameState || game
    const idx = gameState.players.findIndex(p => p.id === player.id)
    if (idx === -1 || gameState.players.length < 2) return []
    const n = gameState.players.length
    const leftIdx = (idx + 1) % n
    const rightIdx = (idx + n - 1) % n
    const result = []
    const left = gameState.players[leftIdx]
    if (left && left.id !== player.id) result.push(left)
    if (rightIdx !== leftIdx) {
      const right = gameState.players[rightIdx]
      if (right && right.id !== player.id) result.push(right)
    }
    return result
  }

  static findCardById(game, cardId) {
    const gameState = game.gameState || game
    for (const p of gameState.players) {
      for (const slot of p.field) {
        if (slot.card?.id === cardId) return slot.card
      }
      for (const c of p.hand) {
        if (c.id === cardId) return c
      }
    }
    return undefined
  }

  static isHandCardLocked(player, card, game) {
    const gameState = game.gameState || game
    const lock = player.lockedHandCards?.[card.id]
    if (!lock) return false
    if (lock === 'finalRoundOnly') return !gameState.isFinalRound
    return true
  }

  static canPlayHandCard(card, player, game) {
    const gameState = game?.gameState || game
    if (gameState && EffectManager.isHandCardLocked(player, card, gameState)) return false
    if (!EffectManager.meetsPlayTypeRestriction(card, player)) return false
    return EffectManager.meetsPlayRequirements(card, player, game)
  }

  static meetsPlayTypeRestriction(card, player) {
    if (!player.restrictNextPlayType) return true
    return card.type === player.restrictNextPlayType
  }

  static playerMustSkipTurn(player, game) {
    const gameState = game.gameState || game
    if (!player.restrictNextPlayType) return false
    return !player.hand.some(c => EffectManager.canPlayHandCard(c, player, gameState))
  }

  static clearTurnRestrictions(player) {
    player.restrictNextPlayType = undefined
  }

  static initializeCardCharges(card) {
    for (const effect of card.effects || []) {
      if (effect.type === 'initCharges' || effect.initialCharges !== undefined) {
        const n = effect.initialCharges ?? effect.value ?? 3
        card.charges = n
        card.maxCharges = n
        break
      }
    }
  }

  static unlockFinalRoundHandCards(game) {
    const gameState = game.gameState || game
    if (!gameState.isFinalRound) return
    gameState.players.forEach(p => {
      if (p.lockedHandCards) p.lockedHandCards = {}
    })
  }

  static applyPendingRoundEndBuffs(game) {
    const gameState = game.gameState || game
    const messages = []
    gameState.players.forEach(player => {
      if (!player.pendingRoundEndBuffs?.length) return
      const remaining = []
      for (const buff of player.pendingRoundEndBuffs) {
        const target = EffectManager.findCardById(gameState, buff.targetCardId)
        if (target) {
          EffectManager.applyCardPowerDelta(target, buff.powerDelta)
          messages.push(`${target.name} 回春+${buff.powerDelta}`)
        }
        buff.roundsLeft -= 1
        if (buff.roundsLeft > 0) remaining.push(buff)
      }
      player.pendingRoundEndBuffs = remaining.length ? remaining : undefined
    })
    return messages
  }

  static copyFieldUnitIdentityTo(host, source) {
    host.name = source.name
    host.keywords = [...source.keywords]
    host.effects = source.effects.map(e => ({ ...e }))
  }

  static applyBranchSubEffect(sub, ownerCard, player, game) {
    const gameState = game.gameState || game
    const effect = { ...sub, timing: 'roundStart' }
    return EffectManager.applyRoundEffect(effect, ownerCard, player, gameState).messages
  }

  static hasGlobalFieldKeyword(game, keyword) {
    const gameState = game.gameState || game
    return gameState.players.some(p =>
      p.field.some(s => s.card && EffectManager.hasAnyKeyword(s.card, [keyword])),
    )
  }

  static cloneTemplateCard(template, suffix, costOverride) {
    const copy = JSON.parse(JSON.stringify(template))
    copy.id = `${template.id}_grant_${suffix}`
    copy.currentPower = copy.basePower
    if (costOverride !== undefined) copy.cost = costOverride
    return copy
  }

  static resolveTemplateCard(id) {
    const template = getCard(id)
    if (!template) return null
    return EffectManager.cloneTemplateCard(template, 'tpl')
  }

  static shuffleInPlace(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
  }

  static meetsPlayRequirements(card, player, game) {
    if (EffectManager.requiresCrossPlayerDeploy(card)) {
      const gs = game?.gameState || game
      if (!gs) return false
      if (EffectManager.getCrossPlayerDeployOptions(gs, player, card).length === 0) return false
    }
    if (EffectManager.requiresMandatoryHostDeploy(card)) {
      if (EffectManager.getQuickPlayHostTargets(player, card).length === 0) return false
    }
    for (const effect of card.effects || []) {
      if (effect.type !== 'playRequirement') continue
      if (effect.unplayable) return false
      if (effect.requireNoTacticsInDeck && player.deck.some(c => c.type === 'tactic')) return false
      if (!EffectManager.checkFieldRequirements(player, effect)) return false
    }
    return true
  }

  static isCardOnField(player, card) {
    return player.field.some(slot => slot.card === card)
  }

  static applyGameEndPowerSet(ownerCard, player, value, messages) {
    ownerCard.currentPower = value
    ownerCard.basePower = value
    if (!EffectManager.isCardOnField(player, ownerCard)) {
      player.bonusPower += value
    }
    messages.push(`${ownerCard.name} 终局战力→${value}`)
  }

  static destroyRandomOtherCard(ownerCard, player, game, messages) {
    const gameState = game.gameState || game
    const candidates = []
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
      EffectManager.removeCardFromField(gameState, pick.card)
    } else {
      const idx = player.hand.indexOf(pick.card)
      if (idx !== -1) {
        player.hand.splice(idx, 1)
        player.discard.push(pick.card)
      }
    }
    messages.push(`${ownerCard.name} 终局消灭 ${pick.card.name}`)
  }

  static getCrossPlayerDeployEffect(card) {
    return card.effects?.find(e => e.type === 'crossPlayerDeploy')
  }

  static getDeployOnHostEffect(card) {
    return card.effects?.find(e => e.type === 'deployOnHostOnly')
  }

  static requiresMandatoryHostDeploy(card) {
    const effect = EffectManager.getDeployOnHostEffect(card)
    return !!effect && !effect.allowNormalDeploy
  }

  static requiresDeployOnHost(card) {
    return EffectManager.requiresMandatoryHostDeploy(card)
  }

  static isValidDeployOnHost(card, hostCard) {
    const effect = EffectManager.getDeployOnHostEffect(card)
    if (!effect) return false
    if (effect.requireHostCardType && hostCard.type !== effect.requireHostCardType) return false
    if (effect.requireHostAttributes?.length &&
      !effect.requireHostAttributes.some(a => hostCard.attribute === a)) {
      return false
    }
    if (effect.requireHostKeywords?.length && !EffectManager.hasAnyKeyword(hostCard, effect.requireHostKeywords)) {
      return false
    }
    return true
  }

  static computeHostDeployDelta(card, hostCard) {
    const effect = EffectManager.getDeployOnHostEffect(card)
    let delta = card.basePower + (effect?.hostDeploySelfBonus ?? 0)
    if (effect?.hostBonusIfHostAttribute && hostCard.attribute === effect.hostBonusIfHostAttribute) {
      delta += effect.hostBonusValue ?? 0
    }
    return delta
  }

  static applyDeployOntoHost(card, hostCard, player, game) {
    const gameState = game.gameState || game
    const messages = []
    card.deployOnCardTarget = hostCard.id
    const delta = EffectManager.computeHostDeployDelta(card, hostCard)
    const oldPower = hostCard.currentPower
    if (delta !== 0) {
      if (hostCard.stackedBonus === undefined) hostCard.stackedBonus = 0
      hostCard.stackedBonus += delta
    }
    hostCard.currentPower += delta
    messages.push(`${card.name} 部署到 ${hostCard.name} | ${hostCard.name} 战力${oldPower}→${hostCard.currentPower}`)
    messages.push(...EffectManager.applyQuickPlayRevealEffects(card, hostCard, player, gameState))
    EffectManager.triggerOnOtherPlayEffects(card, player, gameState)
    EffectManager.recalculateAllPowers(gameState)
    return messages
  }

  static getQuickPlayHostTargets(player, card) {
    const effect = EffectManager.getDeployOnHostEffect(card)
    if (!effect) {
      return player.field.filter(s => s.card && !s.isExtra).map(s => s.card)
    }
    return player.field
      .filter(s => s.card && !s.isExtra && EffectManager.isValidDeployOnHost(card, s.card))
      .map(s => s.card)
  }

  static requiresCrossPlayerDeploy(card) {
    return !!EffectManager.getCrossPlayerDeployEffect(card)
  }

  static playerMeetsCrossDeployTarget(targetPlayer, effect) {
    return EffectManager.checkFieldRequirements(targetPlayer, effect)
  }

  static getCrossPlayerDeployOptions(game, _playingPlayer, card) {
    const effect = EffectManager.getCrossPlayerDeployEffect(card)
    if (!effect) return []
    const gameState = game.gameState || game
    const options = []
    gameState.players.forEach((p, playerIndex) => {
      if (!EffectManager.playerMeetsCrossDeployTarget(p, effect)) return
      p.field.forEach((slot, slotIndex) => {
        if (slot.isExtra || slot.card) return
        options.push({ playerIndex, slotIndex })
      })
    })
    return options
  }

  static isValidCrossPlayerDeploySlot(game, playingPlayer, card, targetPlayerIndex, slotIndex) {
    return EffectManager.getCrossPlayerDeployOptions(game, playingPlayer, card).some(
      o => o.playerIndex === targetPlayerIndex && o.slotIndex === slotIndex,
    )
  }

  static findInHandOrDeck(player, effect) {
    const matches = (c) => EffectManager.matchesSearch(c, effect)
    for (let i = 0; i < player.hand.length; i++) {
      if (matches(player.hand[i])) return { pile: 'hand', index: i, card: player.hand[i] }
    }
    for (let i = player.deck.length - 1; i >= 0; i--) {
      if (matches(player.deck[i])) return { pile: 'deck', index: i, card: player.deck[i] }
    }
    return null
  }

  // Search deck for cards matching name or keyword
  static searchDeck(player, effect) {
    if (effect.searchEachKeyword && effect.searchKeywords?.length) {
      const perKw = effect.maxCount ?? 1
      const allResults = []
      for (const kw of effect.searchKeywords) {
        const subEffect = {
          ...effect,
          searchKeywords: [kw],
          searchKeyword: undefined,
          searchEachKeyword: false,
          maxCount: perKw,
          shuffleAfterSearch: false,
        }
        allResults.push(...EffectManager.searchDeck(player, subEffect))
      }
      if (effect.shuffleAfterSearch && player.deck.length > 1) {
        EffectManager.shuffleInPlace(player.deck)
      }
      return allResults
    }

    const results = []
    const max = effect.maxCount ?? Infinity
    const searchDiscard = effect.searchDiscard !== false

    const searchIn = (pile) => {
      for (let i = pile.length - 1; i >= 0 && results.length < max; i--) {
        if (EffectManager.matchesSearch(pile[i], effect)) {
          results.push(...pile.splice(i, 1))
        }
      }
    }

    searchIn(player.deck)
    if (searchDiscard && results.length < max) {
      searchIn(player.discard)
    }

    if (effect.shuffleAfterSearch && player.deck.length > 1) {
      EffectManager.shuffleInPlace(player.deck)
    }
    return results
  }

  static matchesRevealModifyTarget(card, effect) {
    if (effect.targetKeywords?.includes('单位')) {
      if (card.type !== 'unit') return false
    } else if (effect.targetKeywords?.length) {
      if (!EffectManager.hasAnyKeyword(card, effect.targetKeywords)) return false
    }
    if (effect.targetAttributes?.length && !EffectManager.hasAnyAttribute(card, effect.targetAttributes)) {
      return false
    }
    if (effect.excludeAttributes?.length && EffectManager.hasAnyAttribute(card, effect.excludeAttributes)) {
      return false
    }
    return true
  }

  static getRevealModifyTargets(game, player, effect) {
    const players = effect.allPlayers ? game.players : [player]
    const targets = []
    players.forEach(p => {
      p.field.forEach(slot => {
        if (slot.card && EffectManager.matchesRevealModifyTarget(slot.card, effect)) {
          targets.push(slot.card)
        }
      })
    })
    return targets
  }

  static rollD6TierValue(effect, player, card) {
    let roll = EffectManager.rollD6()
    if (player && card?.name && player.d6MinByCardName?.[card.name] !== undefined) {
      roll = Math.max(roll, player.d6MinByCardName[card.name])
    }
    const tiers = effect.d6Tiers || []
    for (const tier of tiers) {
      if (roll >= tier.min && roll <= tier.max) {
        return { roll, value: tier.value }
      }
    }
    return { roll, value: 0 }
  }

  static applyQuickPlayRevealEffects(card, targetCard, player, game) {
    const messages = []
    const gameState = game.gameState || game
    card.effects?.forEach(effect => {
      if (effect.timing !== 'onReveal' || effect.type === 'conditional') return
      if (effect.type === 'd6TierPower') {
        const { roll, value } = EffectManager.rollD6TierValue(effect, player, card)
        const old = targetCard.currentPower
        targetCard.currentPower += value
        messages.push(`${card.name} D6=${roll}，战力+${value} | ${targetCard.name} ${old}→${targetCard.currentPower}`)
      }
    })
    if (messages.length) {
      gameState.message = (gameState.message || '') + ' | ' + messages.join(' | ')
    }
    return messages
  }

  static getDestroyTargets(game, player, effect) {
    const targets = []
    const collectFrom = (p) => {
      p.field.forEach(slot => {
        if (!slot.card) return
        if (p.id !== player.id && slot.card.untargetableByOthers) return
        if (effect.targetCardType && slot.card.type !== effect.targetCardType) return
        if (effect.maxBasePower !== undefined && slot.card.basePower > effect.maxBasePower) return
        if (effect.targetKeywords?.length && !EffectManager.hasAnyKeyword(slot.card, effect.targetKeywords)) return
        targets.push(slot.card)
      })
    }
    if (effect.targetLeftPlayer) {
      const left = EffectManager.getLeftPlayer(game, player)
      if (left) collectFrom(left)
      return targets
    }
    game.players.forEach(p => collectFrom(p))
    return targets
  }

  static canDestroyTarget(targetCard, effect) {
    if (targetCard.type !== 'environment') return true
    if (effect.destroyEnvironment) return true
    if (effect.targetKeywords?.length && EffectManager.hasAnyKeyword(targetCard, effect.targetKeywords)) return true
    return false
  }

  static applyDestroyToTarget(targetCard, effect, game) {
    const messages = []
    const threshold = effect.destroyThreshold ?? 0
    const rawDelta = typeof effect.value === 'number' ? effect.value : 0
    if (rawDelta !== 0) {
      const delta = EffectManager.applyCardPowerDelta(targetCard, rawDelta, true)
      messages.push(`${targetCard.name} 战力${delta >= 0 ? '+' : ''}${delta}`)
    }
    const instantKeywordDestroy = rawDelta === 0 && (effect.targetKeywords?.length ?? 0) > 0
    const powerDestroy = targetCard.currentPower <= threshold
    const directDestroy = effect.directDestroy === true
    const destroyed = (directDestroy || instantKeywordDestroy || powerDestroy) && EffectManager.canDestroyTarget(targetCard, effect)
    if (destroyed) {
      EffectManager.removeCardFromField(game, targetCard)
      messages.push(`${targetCard.name} 被摧毁`)
    }
    return { messages, destroyed }
  }

  static removeCardFromField(game, card) {
    for (const p of game.players) {
      const idx = p.field.findIndex(s => s.card === card)
      if (idx !== -1) {
        p.field[idx].card = null
        p.discard.push(card)
        return
      }
    }
  }

  static countDeployedOnHost(hostCard, player) {
    const hostSlot = player.field.find(s => s.card === hostCard)
    if (!hostSlot) return 0
    let count = 0
    player.field.forEach(otherSlot => {
      if (otherSlot.isExtra && otherSlot.parentSlot === hostSlot.position && otherSlot.card) {
        count++
      }
    })
    return count
  }

  static applyCardPowerDelta(card, delta, updateBase = false) {
    if (delta < 0 && card.invertPowerLoss) {
      delta = -delta
    }
    card.currentPower += delta
    if (updateBase && card.basePower !== undefined) {
      card.basePower += delta
    }
    return delta
  }

  static applyDiscardHandOrSelf(card, player, game) {
    const messages = []
    if (player.hand.length > 0) {
      const idx = Math.floor(Math.random() * player.hand.length)
      const discarded = player.hand.splice(idx, 1)[0]
      player.discard.push(discarded)
      messages.push(`弃置了${discarded.name}`)
      return { messages, removedSelf: false }
    }
    player.field.forEach(slot => {
      if (slot.card === card) slot.card = null
    })
    player.discard.push(card)
    messages.push(`${card.name} 因无法弃置手牌而进入弃牌区`)
    return { messages, removedSelf: true }
  }

  static applyRevealEffect(effect, card, player, game) {
    const messages = []

    if (!EffectManager.checkFieldRequirements(player, effect)) {
      messages.push('条件不满足，效果未触发')
      return { messages }
    }

    if (effect.type === 'draw') {
      const count = effect.drawCount ?? (typeof effect.value === 'number' ? effect.value : 1)
      for (let i = 0; i < count; i++) {
        if (player.deck.length === 0) break
        const drawn = player.deck.pop()
        player.hand.push(drawn)
        messages.push(`${player.name} 抽到了${drawn.name}`)
      }
      return { messages }
    }

    if (effect.type === 'modifyPower' && effect.selfTarget) {
      if (effect.requireGlobalFieldKeyword && !EffectManager.hasGlobalFieldKeyword(game, effect.requireGlobalFieldKeyword)) {
        return { messages }
      }
      const delta = effect.value || 0
      EffectManager.applyCardPowerDelta(card, delta)
      messages.push(`${card.name} 战力${delta >= 0 ? '+' : ''}${delta}`)
      return { messages }
    }

    if (effect.type === 'modifyPower' && (effect.targetKeywords?.length || effect.allPlayers)) {
      const targets = EffectManager.getRevealModifyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有符合条件的目标')
        return { messages }
      }
      if (targets.length === 1 || effect.allPlayers) {
        const delta = effect.useD6Value ? EffectManager.rollD6() : (effect.value || 0)
        targets.forEach(t => { t.currentPower += delta })
        const sign = delta >= 0 ? '+' : ''
        messages.push(`${targets.map(t => t.name).join('、')} 战力${sign}${delta}${effect.useD6Value ? `(D6=${delta})` : ''}`)
        return { messages }
      }
      if (effect.useD6Value) {
        const delta = EffectManager.rollD6()
        targets[0].currentPower += delta
        messages.push(`${targets[0].name} 战力+${delta}(D6=${delta})`)
        return { messages }
      }
      targets[0].currentPower += effect.value || 0
      messages.push(`${targets[0].name} 战力+${effect.value}`)
      return { messages }
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
        const playerIndex = game.players.findIndex(p => p.id === player.id)
        const otherIndices = game.players.map((_, i) => i).filter(i => i !== playerIndex)
        otherIndices.forEach(idx => {
          const opponent = game.players[idx]
          opponent.currentCost += effect.value || 0
          messages.push(`${opponent.name} 费用${effect.value}`)
        })
      }
      return { messages }
    }

    if (effect.type === 'stealCard') {
      const playerIndex = game.players.findIndex(p => p.id === player.id)
      const opponent = effect.targetLeftPlayer
        ? game.players[(playerIndex + 1) % game.players.length]
        : game.players.find(p => p.id !== player.id && p.hand.length > 0)
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

    if (effect.type === 'scheduleRoundStartEnergy') {
      const amt = effect.value ?? 0
      if (effect.onNextRoundStart) {
        player.pendingNextRoundStartEnergy = (player.pendingNextRoundStartEnergy || 0) + amt
      }
      if (effect.onFinalRoundStart) {
        player.pendingFinalRoundStartEnergy = (player.pendingFinalRoundStartEnergy || 0) + amt
      }
      messages.push(`已预约回合开始恢复${amt}点能量`)
      return { messages }
    }

    if (effect.type === 'grantCopiesToHand') {
      const templateId = effect.grantCardId
      if (!templateId) return { messages }
      const template = EffectManager.resolveTemplateCard(templateId)
      if (!template) {
        messages.push('未找到模板卡牌')
        return { messages }
      }
      const count = effect.grantCount ?? 1
      for (let i = 0; i < count; i++) {
        const copy = EffectManager.cloneTemplateCard(template, `${Date.now()}_${i}`, effect.grantCostOverride)
        player.hand.push(copy)
      }
      messages.push(`获得${count}张${template.name}`)
      return { messages }
    }

    if (effect.type === 'playRandomFromDeckOrTop') {
      if (player.deck.length === 0) {
        messages.push('牌库为空')
        return { messages }
      }
      const idx = Math.floor(Math.random() * player.deck.length)
      const picked = player.deck.splice(idx, 1)[0]
      const playCost = EffectManager.getEffectivePlayCost(picked, player)
      const slots = EffectManager.getAvailableSlotIndices(player, picked)
      const canDeploy = (picked.type === 'unit' || picked.type === 'environment')
        && slots.length > 0
        && player.currentCost >= playCost
      if (canDeploy) {
        player.currentCost -= playCost
        player.field[slots[0]].card = picked
        EffectManager.applyUnitDeployBonuses(picked, player).forEach(m => messages.push(m))
        EffectManager.triggerOnOtherPlayEffects(picked, player, game)
        messages.push(`随机打出${picked.name}（费用${playCost}）`)
      } else {
        player.deck.unshift(picked)
        messages.push(`${picked.name} 无法打出，放回牌库顶`)
      }
      return { messages }
    }

    if (effect.type === 'stashHandUnderSelf') {
      const max = effect.stashMaxCount ?? effect.maxCount ?? 3
      const bonusPer = effect.powerPerStashedCard ?? effect.value ?? 5
      const take = Math.min(max, player.hand.length)
      if (take === 0) {
        messages.push('没有可隐藏的手牌')
        return { messages }
      }
      for (let i = 0; i < take; i++) {
        const idx = Math.floor(Math.random() * player.hand.length)
        const stashed = player.hand.splice(idx, 1)[0]
        player.discard.push(stashed)
        if (card.stackedBonus === undefined) card.stackedBonus = 0
        card.stackedBonus += bonusPer
        card.currentPower += bonusPer
        messages.push(`隐藏${stashed.name}于${card.name}下方，战力+${bonusPer}`)
      }
      return { messages }
    }

    if (effect.type === 'scheduleRoundEndBuff') {
      const rounds = effect.roundEndBuffRounds ?? 3
      const delta = effect.roundEndBuffPower ?? effect.value ?? 1
      let target
      if (effect.selfTarget) {
        target = card
      } else {
        target = player.field.find(s => s.card?.type === 'unit')?.card
      }
      if (!target) {
        messages.push('没有可施加回春的目标')
        return { messages }
      }
      if (!player.pendingRoundEndBuffs) player.pendingRoundEndBuffs = []
      player.pendingRoundEndBuffs.push({ targetCardId: target.id, powerDelta: delta, roundsLeft: rounds })
      messages.push(`${target.name} 将在${rounds}个回合结束时各+${delta}战力`)
      return { messages }
    }

    if (effect.type === 'lockRandomHandCards') {
      if (effect.discardHandAttributes?.length) {
        const handIdx = player.hand.findIndex(c => effect.discardHandAttributes.includes(c.attribute))
        if (handIdx === -1) {
          messages.push('缺少指定属性手牌，效果未触发')
          return { messages }
        }
        player.discard.push(player.hand.splice(handIdx, 1)[0])
      }
      const count = effect.lockHandCount ?? 1
      game.players.forEach(p => {
        if (p.id === player.id || p.hand.length === 0) return
        if (!p.lockedHandCards) p.lockedHandCards = {}
        const picks = new Set()
        const n = Math.min(count, p.hand.length)
        while (picks.size < n) picks.add(Math.floor(Math.random() * p.hand.length))
        for (const idx of picks) {
          const handCard = p.hand[idx]
          p.lockedHandCards[handCard.id] = effect.lockHandFinalRoundOnly !== false ? 'finalRoundOnly' : 'locked'
          messages.push(`封锁${p.name}的${handCard.name}`)
        }
      })
      return { messages }
    }

    if (effect.type === 'restrictAdjacentPlayType') {
      const playType = effect.requiredPlayType ?? effect.targetCardType ?? 'unit'
      EffectManager.getAdjacentPlayers(game, player).forEach(p => {
        p.restrictNextPlayType = playType
        messages.push(`${p.name} 下回合须打出${playType}牌`)
      })
      return { messages }
    }

    if (effect.type === 'peekDeckBottom') {
      if (player.deck.length === 0) {
        messages.push('牌库为空')
        return { messages }
      }
      const bottom = player.deck[0]
      messages.push(`牌库底为${bottom.name}`)
      if (effect.peekTake !== false) {
        player.deck.shift()
        player.hand.push(bottom)
        messages.push('加入手牌')
      }
      return { messages }
    }

    if (effect.type === 'copyFieldUnitIdentity') {
      const source = player.field.find(s => s.card && s.card !== card && s.card.type === 'unit')?.card
      if (!source) {
        messages.push('没有可复制的单位')
        return { messages }
      }
      EffectManager.copyFieldUnitIdentityTo(card, source)
      messages.push(`${card.name} 复制了${source.name}的身份`)
      return { messages }
    }

    if (effect.type === 'sacrificeFieldForPower') {
      const slot = player.field.find(s => s.card && s.card !== card && !s.isExtra)
      if (!slot?.card) {
        messages.push('没有可牺牲的场上牌')
        return { messages }
      }
      const victim = slot.card
      const gain = victim.currentPower
      slot.card = null
      player.discard.push(victim)
      EffectManager.applyCardPowerDelta(card, gain)
      messages.push(`牺牲${victim.name}，获得${gain}战力`)
      return { messages }
    }

    if (effect.type === 'retrieveFromDiscard') {
      if (player.discard.length === 0) {
        messages.push('弃牌堆为空')
        return { messages }
      }
      const idx = effect.retrieveRandom !== false
        ? Math.floor(Math.random() * player.discard.length)
        : 0
      const picked = player.discard.splice(idx, 1)[0]
      player.hand.push(picked)
      messages.push(`从弃牌区取回${picked.name}`)
      return { messages }
    }

    if (effect.type === 'destroy') {
      const targets = EffectManager.getDestroyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有可摧毁的目标')
        return { messages }
      }
      const target = targets[Math.floor(Math.random() * targets.length)]
      const r = EffectManager.applyDestroyToTarget(target, effect, game)
      messages.push(...r.messages)
      return { messages }
    }

    if (effect.type === 'searchDeck') {
      if (!EffectManager.checkFieldRequirements(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const found = EffectManager.searchDeck(player, effect)
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
      const { roll, value } = EffectManager.rollD6TierValue(effect, player, card)
      card.currentPower += value
      messages.push(`${card.name} D6=${roll}，战力+${value}`)
      return { messages }
    }

    if (effect.type === 'discardHandOrSelf') {
      const r = EffectManager.applyDiscardHandOrSelf(card, player, game)
      messages.push(...r.messages)
      return { messages, removedSelf: r.removedSelf }
    }

    return { messages }
  }

  static applyDeployEffect(effect, card, player, game) {
    const messages = []

    if (effect.type === 'extraPlay') {
      player.canPlayExtra = true
      messages.push('效果：可以再打出一张牌！')
      return { messages }
    }

    if (effect.type === 'initCharges') {
      const n = effect.initialCharges ?? effect.value ?? 3
      card.charges = n
      card.maxCharges = n
      messages.push(`${card.name} 获得${n}点充能`)
      return { messages }
    }

    if (effect.type === 'createSlot') {
      return { messages: ['创建了额外槽位'], needsCreateSlot: true }
    }

    if (effect.type === 'searchDeck') {
      if (!EffectManager.checkFieldRequirements(player, effect)) {
        messages.push('条件不满足，效果未触发')
        return { messages }
      }
      const found = EffectManager.searchDeck(player, effect)
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
      const attrs = effect.targetAttributes?.length ? effect.targetAttributes : ['风', '火', '水', '土']
      if (!player.unitPlayAttributeBonus) player.unitPlayAttributeBonus = {}
      const bonus = effect.value ?? 1
      for (const attr of attrs) {
        player.unitPlayAttributeBonus[attr] = (player.unitPlayAttributeBonus[attr] || 0) + bonus
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
      const found = EffectManager.findInHandOrDeck(player, effect)
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
        EffectManager.shuffleInPlace(player.deck)
      }
      const deployCost = EffectManager.getEffectivePlayCost(deployCard, player)
      const slots = EffectManager.getAvailableSlotIndices(player, deployCard)
      if (slots.length === 0 || player.currentCost < deployCost) {
        player.hand.push(deployCard)
        messages.push(slots.length === 0 ? `找到${deployCard.name}但无空槽` : `找到${deployCard.name}但费用不足`)
        return { messages }
      }
      player.currentCost -= deployCost
      player.field[slots[0]].card = deployCard
      EffectManager.applyUnitDeployBonuses(deployCard, player).forEach(m => messages.push(m))
      EffectManager.triggerOnOtherPlayEffects(deployCard, player, game)
      messages.push(`部署${deployCard.name}（费用${deployCost}）`)
      return { messages }
    }

    if (effect.type === 'deployFromHand') {
      const max = effect.maxCount ?? 1
      let deployed = 0
      for (let i = player.hand.length - 1; i >= 0 && deployed < max; i--) {
        const handCard = player.hand[i]
        if (effect.targetCardType && handCard.type !== effect.targetCardType) continue
        if (effect.targetKeywords?.length && !EffectManager.hasAnyKeyword(handCard, effect.targetKeywords)) continue
        const extraSlots = EffectManager.getAvailableExtraSlotIndices(player, handCard)
        if (extraSlots.length === 0) continue
        const deployCost = EffectManager.getEffectivePlayCost(handCard, player)
        if (player.currentCost < deployCost) continue
        player.currentCost -= deployCost
        player.hand.splice(i, 1)
        const slotIndex = extraSlots[0]
        const targetSlot = player.field[slotIndex]
        targetSlot.card = handCard
        EffectManager.applyExtraSlotDeployModifiers(handCard, targetSlot).forEach(m => messages.push(m))
        EffectManager.applyUnitDeployBonuses(handCard, player).forEach(m => messages.push(m))
        EffectManager.triggerOnOtherPlayEffects(handCard, player, game)
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
          EffectManager.hasAnyKeyword(otherSlot.card, keywordGroup),
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
      if (!EffectManager.hasAllFieldAttributes(player, effect)) {
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
      const count = EffectManager.countMatchingFieldCards(player, card, effect)
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
        s => s.card && s.card !== card && EffectManager.hasAnyKeyword(s.card, [effect.noOtherFieldKeyword]),
      )
      if (hasOtherKw) {
        messages.push(`场上有其他「${effect.noOtherFieldKeyword}」，效果未触发`)
        return { messages }
      }
      if (effect.requireOtherFieldKeyword) {
        const hasOther = player.field.some(
          s => s.card && s.card !== card && EffectManager.hasAnyKeyword(s.card, [effect.requireOtherFieldKeyword]),
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
        .map(s => s.card)
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
          slot.card.attribute = attr
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
      const picked = new Set()
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
      const targets = EffectManager.getDestroyTargets(game, player, effect)
      if (targets.length === 0) {
        messages.push('没有可摧毁的目标')
        return { messages }
      }
      const target = targets[Math.floor(Math.random() * targets.length)]
      const r = EffectManager.applyDestroyToTarget(target, effect, game)
      messages.push(...r.messages)
      return { messages }
    }

    if (effect.type === 'invertPowerLoss') {
      card.invertPowerLoss = true
      messages.push(`${card.name} 战力降低时将改为提升`)
      return { messages }
    }

    if (effect.type === 'skipOthersDrawNextRound') {
      game.players.forEach(p => {
        if (p.id !== player.id) p.skipDrawNextRound = true
      })
      messages.push('其他玩家下回合开始时将不抽牌')
      return { messages }
    }

    if (effect.type === 'absorbLeftPlayerUnit') {
      const leftPlayer = EffectManager.getLeftPlayer(game, player)
      if (!leftPlayer) {
        messages.push('没有左手边玩家')
        return { messages }
      }
      let targetSlot = null
      let targetCard = null
      for (const slot of leftPlayer.field) {
        if (!slot.card || slot.isExtra) continue
        if (effect.targetCardType && slot.card.type !== effect.targetCardType) continue
        if (effect.maxBasePower !== undefined && slot.card.basePower > effect.maxBasePower) continue
        targetSlot = slot
        targetCard = slot.card
        break
      }
      if (!targetCard || !targetSlot) {
        messages.push('没有可吸收的单位')
        return { messages }
      }
      targetSlot.card = null
      leftPlayer.discard.push(targetCard)
      const bonus = effect.value ?? 1
      if (card.stackedBonus === undefined) card.stackedBonus = 0
      card.stackedBonus += bonus
      card.currentPower += bonus
      messages.push(`吸收${leftPlayer.name}的${targetCard.name}，${card.name} 战力+${bonus}`)
      return { messages }
    }

    return { messages }
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
    return EffectManager.getAvailableSlotIndices(player, card)
  }
  
  // 处理打出卡牌
  handlePlayCard(playerId, cardIndex, slotIndex, targetPlayerIndex) {
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

    const fieldOwnerIndex = targetPlayerIndex !== undefined && targetPlayerIndex !== null
      ? targetPlayerIndex
      : playerIndex
    const fieldOwner = this.gameState.players[fieldOwnerIndex]
    if (!fieldOwner) {
      return { success: false, error: '目标玩家不存在' }
    }
    
    // QuickPlay gate: skip cost/action for quickPlay cards
    if (card.quickPlay) {
      return this.handleQuickPlayCard(card, player, playerIndex)
    }

    if (EffectManager.requiresMandatoryHostDeploy(card)) {
      return this.handleHostOnlyDeploy(card, player, playerIndex, cardIndex)
    }
    
    // 检查最后一回合的卡牌限制
    const restrictions = this.gameState.playerRestrictions?.[playerId]
    if (restrictions?.includes('cannotPlay')) {
      return { success: false, error: '最后一回合无法出牌（场地已满）' }
    }
    if (restrictions?.includes('tacticsOnly') && card.type !== 'tactic') {
      return { success: false, error: '最后一回合只能出战术牌' }
    }

    if (!EffectManager.canPlayHandCard(card, player, this.gameState)) {
      return { success: false, error: '无法打出此牌（条件/封锁/类型限制）' }
    }

    if (EffectManager.requiresCrossPlayerDeploy(card)) {
      if (!EffectManager.isValidCrossPlayerDeploySlot(
        this.gameState, player, card, fieldOwnerIndex, slotIndex,
      )) {
        return { success: false, error: '无效的跨玩家部署槽位' }
      }
    } else if (fieldOwnerIndex !== playerIndex) {
      return { success: false, error: '此牌只能部署在己方场上' }
    }
    
    // 验证费用
    const playCost = EffectManager.getEffectivePlayCost(card, player)
    if (player.currentCost < playCost) {
      if (!card.forcedPlay) {
        return { success: false, error: `费用不足！需要${playCost}，当前${player.currentCost}` }
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
    if (slotIndex < 0 || slotIndex >= fieldOwner.field.length) {
      return { success: false, error: '无效的槽位' }
    }
    
    const slot = fieldOwner.field[slotIndex]
    if (slot.card !== null) {
      return { success: false, error: '槽位已被占用' }
    }
    
    // 执行打出卡牌
    player.hand.splice(cardIndex, 1)
    player.currentCost -= playCost
    
    if (player.hasPlayedThisTurn && player.canPlayExtra) {
      player.canPlayExtra = false
    } else {
      player.hasPlayedThisTurn = true
    }
    EffectManager.consumeTacticPlayFreeIfMatch(card, player)
    
    // 部署卡牌到目标玩家场上
    this.deployCard(card, fieldOwner, slotIndex, fieldOwnerIndex)
    
    // 将卡牌添加到待揭示列表
    this.gameState.pendingReveals[playerId].push({
      card: card,
      slotIndex: slotIndex,
      targetPlayerIndex: fieldOwnerIndex,
    })
    
    this.gameState.message = fieldOwnerIndex !== playerIndex
      ? `${player.name} 打出了一张牌到 ${fieldOwner.name} 场上（费用-${playCost}）`
      : `${player.name} 打出了一张牌（费用-${playCost}）`
    
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

  handleHostOnlyDeploy(card, player, playerIndex, cardIndex) {
    const playerId = player.id
    const restrictions = this.gameState.playerRestrictions?.[playerId]
    if (restrictions?.includes('cannotPlay')) {
      return { success: false, error: '最后一回合无法出牌（场地已满）' }
    }
    if (restrictions?.includes('tacticsOnly') && card.type !== 'tactic') {
      return { success: false, error: '最后一轮只能出战术牌' }
    }
    if (!EffectManager.canPlayHandCard(card, player, this.gameState)) {
      return { success: false, error: '无法打出此牌（条件/封锁/类型限制）' }
    }
    const playCost = EffectManager.getEffectivePlayCost(card, player)
    if (player.currentCost < playCost && !card.forcedPlay) {
      return { success: false, error: `费用不足！需要${playCost}，当前${player.currentCost}` }
    }
    if (player.hasPlayedThisTurn && !player.canPlayExtra) {
      return { success: false, error: '本回合已经出过牌了！' }
    }
    const targets = EffectManager.getQuickPlayHostTargets(player, card)
    if (targets.length === 0) {
      return { success: false, error: '没有可部署的宿主卡牌' }
    }
    player.hand.splice(cardIndex, 1)
    player.currentCost -= playCost
    if (player.hasPlayedThisTurn && player.canPlayExtra) {
      player.canPlayExtra = false
    } else {
      player.hasPlayedThisTurn = true
    }
    EffectManager.consumeTacticPlayFreeIfMatch(card, player)
    const targetCard = targets[0]
    const msgs = EffectManager.applyDeployOntoHost(card, targetCard, player, this.gameState)
    this.gameState.message = msgs.join(' | ')
    return { success: true, gameState: this.getPublicGameState(), cardPlayed: card }
  }
  
  // 处理快速打出（跳过费用/行动检查）
  handleQuickPlayCard(card, player, playerIndex) {
    // Remove from hand (no cost deduction)
    const cardIndex = player.hand.indexOf(card)
    if (cardIndex !== -1) player.hand.splice(cardIndex, 1)
    
    // Fire onPlay effects
    const messages = []
    card.effects.forEach(effect => {
      if (effect.timing !== 'onPlay') return
      
      if (effect.type === 'restoreEnergy') {
        player.currentCost += (effect.value || 0)
        messages.push(`${player.name} 使用${card.name}：恢复${effect.value}点能量`)
      }
      else if (effect.type === 'modifyPowerByName') {
        const targetName = effect.targetName || ''
        const targets = player.field
          .filter(s => s.card && s.card.name.includes(targetName))
          .map(s => s.card)
        targets.forEach(t => {
          const oldPower = t.currentPower
          t.currentPower += (effect.value || 0)
          messages.push(`${t.name} 战力${oldPower}→${t.currentPower}`)
        })
        if (targets.length === 0) {
          messages.push(`没有找到包含"${targetName}"的卡牌`)
        }
      }
      else if (effect.type === 'reduceUnitPower') {
        const otherIndices = this.getOtherPlayerIndices(playerIndex)
        let applied = false
        for (const idx of otherIndices) {
          const opponent = this.gameState.players[idx]
          const targetSlot = opponent.field.find(s => s.card && s.card.type === 'unit')
          if (targetSlot && targetSlot.card) {
            const target = targetSlot.card
            const oldPower = target.currentPower
            target.currentPower -= (effect.value || 0)
            messages.push(`${target.name} 战力${oldPower}→${target.currentPower}`)
            if (target.currentPower <= 0) {
              targetSlot.card = null
              messages.push(`${target.name} 被摧毁`)
            }
            applied = true
            break
          }
        }
        if (!applied) {
          messages.push('没有可攻击的目标')
        }
      }
      else if (effect.type === 'discardOpponentHand') {
        const otherIndices = this.getOtherPlayerIndices(playerIndex)
        for (const idx of otherIndices) {
          const opponent = this.gameState.players[idx]
          if (opponent.hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * opponent.hand.length)
            const discarded = opponent.hand.splice(randomIndex, 1)[0]
            opponent.discard.push(discarded)
            messages.push(`${opponent.name} 弃置了${discarded.name}`)
          }
        }
      }
      else if (effect.type === 'returnToDeckBottom') {
        player.deck.unshift(card)
        messages.push(`${card.name} 返回牌库底部`)
      }
      else if (effect.type === 'setNextUnitAttribute') {
        player.pendingNextAttribute = effect.value
        messages.push(`下次部署的单位牌将变为${effect.value}属性`)
      }
      else if (effect.type === 'markOpponentHand') {
        const otherIndices = this.getOtherPlayerIndices(playerIndex)
        for (const idx of otherIndices) {
          const opponent = this.gameState.players[idx]
          if (opponent.hand.length > 0) {
            const randomIndex = Math.floor(Math.random() * opponent.hand.length)
            opponent.hand[randomIndex].markedForDiscard = true
            messages.push(`${opponent.name} 的手牌被标记`)
          }
        }
      }
    })
    
    // QuickPlay units: deploy onto an existing field card
    if (card.type === 'unit') {
      const fieldCards = EffectManager.getQuickPlayHostTargets(player, card)
      if (fieldCards.length === 0) {
        player.discard.push(card)
        this.gameState.message = EffectManager.requiresDeployOnHost(card)
          ? `${card.name} 只能部署在带有「农田」或「载具」关键词的卡牌上`
          : '场上没有可部署的目标'
        return { success: true, gameState: this.getPublicGameState(), cardPlayed: card }
      }

      // Auto-select first valid target (simplified server logic)
      const targetCard = fieldCards[0]
      const oldPower = targetCard.currentPower
      targetCard.currentPower += card.basePower
      const revealMsgs = EffectManager.applyQuickPlayRevealEffects(card, targetCard, player, this.gameState)
      if (revealMsgs.length === 0) {
        this.gameState.message = `${card.name} 部署到 ${targetCard.name}上，战力${oldPower}→${targetCard.currentPower}`
      }

      EffectManager.recalculateAllPowers(this.gameState)
      EffectManager.applyOnFieldDestroy(this)
      this.checkFieldFull(playerIndex)

      // Build response message
      this.gameState.message = messages.join(' | ') + ' | ' + this.gameState.message

      return { success: true, gameState: this.getPublicGameState(), cardPlayed: card }
    }

    // QuickPlay tactics go to discard (unless returned to deck)
    const hasReturnToDeck = card.effects.some(e => e.type === 'returnToDeckBottom')
    if (card.type === 'tactic' && !hasReturnToDeck) {
      player.discard.push(card)
    }

    // After quickPlay: apply all field effects
    EffectManager.applyOnFieldDestroy(this)
    EffectManager.recalculateAllPowers(this.gameState)

    // Check field full
    this.checkFieldFull(playerIndex)

    // Build response message
    this.gameState.message = messages.join(' | ')

    return {
      success: true,
      gameState: this.getPublicGameState(),
      cardPlayed: card
    }
  }
  
  // 部署卡牌
  deployCard(card, player, slotIndex, playerIndex) {
    const slot = player.field[slotIndex]
    
    // Apply pending attribute override from 元素墙
    if (player.pendingNextAttribute) {
      card.attribute = player.pendingNextAttribute
      this.gameState.message += ` | ${card.name} 属性变更为${player.pendingNextAttribute}`
      player.pendingNextAttribute = undefined
    }

    EffectManager.applyUnitDeployBonuses(card, player).forEach(msg => {
      this.gameState.message += ` | ${msg}`
    })
    EffectManager.applyExtraSlotDeployModifiers(card, slot).forEach(msg => {
      this.gameState.message += ` | ${msg}`
    })
    
    // 部署卡牌到槽位
    slot.card = card
    
    // 战术牌：先 onDeploy，再 onReveal
    if (card.type === 'tactic') {
      this.triggerDeployEffects(card, player)
      this.handleTacticCard(card, player, slotIndex)
      return
    }
    
    // 触发部署效果
    this.triggerDeployEffects(card, player)
    
    // 触发"其他卡牌打出时"的效果
    EffectManager.triggerOnOtherPlayEffects(card, player, this.gameState)
    
    // 应用摧毁效果（在重新计算战力之前）
    EffectManager.applyOnFieldDestroy(this)
    
    // 重新计算战力
    EffectManager.recalculateAllPowers(this.gameState)
    
    // 检查是否填满场地
    this.checkFieldFull(playerIndex)
  }
  
  // 处理战术牌
  handleTacticCard(card, player, slotIndex) {
    EffectManager.triggerOnOtherPlayEffects(card, player, this.gameState)

    const revealEffects = card.effects.filter(
      e => e.timing === 'onReveal' && e.type !== 'conditional' && e.type !== 'custom',
    )

    if (revealEffects.length === 0) {
      this.discardTacticCard(card, player, slotIndex)
      return
    }

    for (const effect of revealEffects) {
      const result = EffectManager.applyRevealEffect(effect, card, player, this.gameState)
      result.messages.forEach(msg => {
        this.gameState.message += ` | ${msg}`
      })
    }

    this.discardTacticCard(card, player, slotIndex)
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
    if (!card.effects || !Array.isArray(card.effects)) return null

    let pendingTarget = null

    card.effects.forEach(effect => {
      if (effect.timing === 'onDeploy') {
        if (effect.type === 'conditional' || effect.type === 'custom') return

        const result = EffectManager.applyDeployEffect(effect, card, player, this.gameState)
        result.messages.forEach(msg => {
          this.gameState.message += ` | ${msg}`
        })
        if (result.needsCreateSlot) {
          this.createExtraSlot(card, player, effect)
        }
        if (result.needsTargetSelection) {
          pendingTarget = result.needsTargetSelection
        }
      } else if (effect.timing === 'onReveal') {
        if (effect.type === 'conditional' || effect.type === 'custom') return
        const result = EffectManager.applyRevealEffect(effect, card, player, this.gameState)
        result.messages.forEach(msg => {
          this.gameState.message += ` | ${msg}`
        })
      }
    })

    return pendingTarget
  }
  
  // 创建额外槽位
  createExtraSlot(parentCard, player, effect) {
    const parentSlotIndex = player.field.findIndex(s => s.card === parentCard)
    console.log(`[GameEngine] createExtraSlot: 父卡牌=${parentCard.name}, 父槽位索引=${parentSlotIndex}`)
    
    if (parentSlotIndex === -1) {
      console.log(`[GameEngine] 错误：找不到父槽位`)
      return
    }
    
    const rules = effect ? EffectManager.slotRulesFromEffect(effect) : undefined
    const newSlot = EffectManager.buildExtraSlot(parentSlotIndex, player.field.length, rules)
    
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
    const filledMainSlots = EffectManager.countMainFieldCardsForLimit(player)
    
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

    EffectManager.triggerReforgeEffects(player, this.gameState)
    
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
    // 触发回合结束效果（上一回合的效果结算）
    EffectManager.triggerRoundEffects('roundEnd', this)
    
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
        const filledSlots = EffectManager.countMainFieldCardsForLimit(player)
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
      player.unitPlayPowerBonus = 0
      
      // 如果是填满场地的玩家，在最后一回合跳过他的操作
      if (this.gameState.isFinalRound && this.gameState.finalRoundTriggeredBy === index) {
        console.log(`[GameEngine] ${player.name} 已填满场地，最后一回合跳过操作`)
        // 标记为已决策和已准备，这样他不需要操作
        this.gameState.playerDecisions[player.id] = { made: true, choice: 'skip' }
        this.gameState.playerReady[player.id] = true
        // 不抽牌
      } else if (player.skipDrawNextRound) {
        player.skipDrawNextRound = false
        console.log(`[GameEngine] ${player.name} 本回合不抽牌`)
      } else {
        // 抽牌
        const card = this.drawCard(player)
        if (card) {
          console.log(`[GameEngine] ${player.name} 抽牌: ${card.name}`)
        }
      }
    })
    
    // 触发新回合开始效果
    EffectManager.triggerRoundEffects('roundStart', this)
    
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
    
    EffectManager.triggerGameEndEffects(this.gameState)
    
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
