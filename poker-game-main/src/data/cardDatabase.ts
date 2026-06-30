import type { Card, CardType, AttributeType } from '@/types/game'

// 卡牌数据库类
export class CardDatabase {
  private static cards: Map<string, Card> = new Map()

  // 注册卡牌
  static register(card: Card) {
    this.cards.set(card.id, card)
  }

  // 批量注册
  static registerAll(cards: Card[]) {
    cards.forEach(card => this.register(card))
  }

  // 获取卡牌
  static get(id: string): Card | undefined {
    const card = this.cards.get(id)
    return card ? this.cloneCard(card) : undefined
  }

  // 按名称获取
  static getByName(name: string): Card | undefined {
    for (const card of this.cards.values()) {
      if (card.name === name) {
        return this.cloneCard(card)
      }
    }
    return undefined
  }

  // 按关键词搜索
  static getByKeyword(keyword: string): Card[] {
    const results: Card[] = []
    for (const card of this.cards.values()) {
      // 检查关键词或名称中是否包含
      if (card.keywords.includes(keyword) || card.name.includes(keyword)) {
        results.push(this.cloneCard(card))
      }
    }
    return results
  }

  // 按属性搜索
  static getByAttribute(attribute: AttributeType): Card[] {
    const results: Card[] = []
    for (const card of this.cards.values()) {
      if (card.attribute === attribute) {
        results.push(this.cloneCard(card))
      }
    }
    return results
  }

  // 按类型搜索
  static getByType(type: CardType): Card[] {
    const results: Card[] = []
    for (const card of this.cards.values()) {
      if (card.type === type) {
        results.push(this.cloneCard(card))
      }
    }
    return results
  }

  // 获取所有卡牌
  static getAll(): Card[] {
    return Array.from(this.cards.values()).map(card => this.cloneCard(card))
  }

  // 深拷贝卡牌（避免修改原始数据）
  private static cloneCard(card: Card): Card {
    return {
      ...card,
      keywords: [...card.keywords],
      effects: [...card.effects],
      currentPower: card.basePower,
      stackedBonus: 0  // 初始化为0
    }
  }

  // 清空数据库
  static clear() {
    this.cards.clear()
  }
}
