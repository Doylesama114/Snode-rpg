import type { Card, Player, GameState, FieldSlot, EffectContext } from '@/types/game'

// 效果管理器
export class EffectManager {
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

  // 重新计算单张卡牌的战力
  static recalculateCardPower(card: Card, player: Player, game: GameState) {
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
  static getValidTargets(player: Player, keywords: string[]): Card[] {
    const targets: Card[] = []
    
    player.field.forEach(slot => {
      if (slot.card && this.hasAnyKeyword(slot.card, keywords)) {
        targets.push(slot.card)
      }
    })
    
    return targets
  }

  // 检查卡牌是否会被摧毁
  static checkDestroy(card: Card): boolean {
    return card.currentPower < 0 && card.type !== 'environment'
  }
}
