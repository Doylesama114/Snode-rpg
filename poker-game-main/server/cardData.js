// 服务器端卡牌数据 - 从客户端完整复制

export const cardDefinitions = [
  // 1. 辛勤的苦工
  {
    id: 'card_001',
    name: '辛勤的苦工',
    type: 'unit',
    keywords: ['居民'],
    attribute: '无',
    basePower: 1,
    currentPower: 1,
    cost: 1,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onDeploy',
        type: 'extraPlay',
        description: '在这张牌进场后，你可以立即从手牌中额外打出一张牌'
      }
    ]
  },

  // 2. 驮用马
  {
    id: 'card_002',
    name: '驮用马',
    type: 'unit',
    keywords: ['野兽', '载具'],
    attribute: '土',
    basePower: 1,
    currentPower: 1,
    cost: 1,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onDeploy',
        type: 'createSlot',
        description: '创建一个额外槽位'
      },
      {
        timing: 'onField',
        type: 'modifyPower',
        description: '如果部署的卡牌带有"武器/护甲/物件"的关键词，这张牌的战力+2',
        targetKeywords: ['武器', '护甲', '物件'],
        value: 2,
        stackable: false
      }
    ]
  },

  // 3. 法师
  {
    id: 'card_003',
    name: '法师',
    type: 'unit',
    keywords: ['魔法', '职业者'],
    attribute: '无',
    basePower: 1,
    currentPower: 1,
    cost: 2,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onOtherPlay',
        type: 'modifyPower',
        description: '每当你打出一张拥有"魔法"关键词的战术牌后，这张牌的战力+2',
        targetKeywords: ['魔法'],
        value: 2,
        stackable: true
      }
    ]
  },

  // 4. 见习冒险者
  {
    id: 'card_004',
    name: '见习冒险者',
    type: 'unit',
    keywords: ['居民', '职业者'],
    attribute: '无',
    basePower: 2,
    currentPower: 2,
    cost: 2,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onField',
        type: 'conditional',
        description: '你的场上每拥有一种不同的关键词，这张牌的战力+1（不计算这张牌上的关键词）',
        stackable: false
      }
    ]
  },

  // 5. 矮人铁匠
  {
    id: 'card_005',
    name: '矮人铁匠',
    type: 'unit',
    keywords: ['居民'],
    attribute: '钢',
    basePower: 2,
    currentPower: 2,
    cost: 1,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onOtherPlay',
        type: 'modifyPower',
        description: '每当你打出一张带有"武器/护甲"关键词的卡牌，那张卡牌的战力+2',
        targetKeywords: ['武器', '护甲'],
        value: 2,
        stackable: true
      }
    ]
  },

  // 6. 野猪
  {
    id: 'card_006',
    name: '野猪',
    type: 'unit',
    keywords: ['野兽'],
    attribute: '土',
    basePower: 3,
    currentPower: 3,
    cost: 1,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onField',
        type: 'conditional',
        description: '如果你场上拥有"猎人/农夫/冒险者"关键词的卡牌，这张卡的战力-2',
        value: -2,
        targetKeywords: ['猎人', '农夫', '冒险者'],
        stackable: false
      },
      {
        timing: 'onField',
        type: 'conditional',
        description: '如果你场上拥有"农田/森林"名称的卡牌，这张牌的战力+2',
        value: 2,
        stackable: false
      }
    ]
  },

  // 7. 民兵
  {
    id: 'card_007',
    name: '民兵',
    type: 'unit',
    keywords: ['士兵'],
    attribute: '无',
    basePower: 3,
    currentPower: 3,
    cost: 2,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onDestroy',
        type: 'protect',
        description: '当你一名带有"居民"关键词的卡牌将要被摧毁时，可以用这张牌代替被摧毁',
        targetKeywords: ['居民']
      }
    ]
  },

  // 8. 战士
  {
    id: 'card_008',
    name: '战士',
    type: 'unit',
    keywords: ['职业者'],
    attribute: '无',
    basePower: 3,
    currentPower: 3,
    cost: 2,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onOtherPlay',
        type: 'modifyPower',
        description: '每当你打出一张拥有"武器"关键词的卡牌后，这张牌的战力+1',
        targetKeywords: ['武器'],
        value: 1,
        stackable: true
      }
    ]
  },

  // 9. 狮鹫
  {
    id: 'card_009',
    name: '狮鹫',
    type: 'unit',
    keywords: ['野兽', '载具', '飞行'],
    attribute: '风',
    basePower: 5,
    currentPower: 5,
    cost: 3,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onDeploy',
        type: 'createSlot',
        description: '你可以将其他单位牌部署在这张牌上'
      }
    ]
  },

  // 10. 农田
  {
    id: 'card_010',
    name: '农田',
    type: 'environment',
    keywords: ['自然', '务农'],
    attribute: '土',
    basePower: 0,
    currentPower: 0,
    cost: 1,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onField',
        type: 'conditional',
        description: '这张牌上每部署一张带有"务农"关键词的单位牌，这张牌的战力+1',
        targetKeywords: ['务农'],
        value: 1,
        stackable: true
      }
    ]
  },

  // 11. 橡木武器店
  {
    id: 'card_011',
    name: '橡木武器店',
    type: 'environment',
    keywords: ['武器', '建筑'],
    attribute: '木',
    basePower: 0,
    currentPower: 0,
    cost: 2,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onField',
        type: 'modifyPower',
        description: '你的带有"战士/士兵/冒险者"关键词的卡牌战力+3',
        targetKeywords: ['战士', '士兵', '冒险者'],
        value: 3,
        stackable: false
      }
    ]
  },

  // 12. 铁匠铺
  {
    id: 'card_012',
    name: '铁匠铺',
    type: 'environment',
    keywords: ['护甲', '建筑'],
    attribute: '钢',
    basePower: 0,
    currentPower: 0,
    cost: 2,
    slotRequired: 1,
    isPersistent: true,
    effects: [
      {
        timing: 'onField',
        type: 'conditional',
        description: '如果你拥有"矮人铁匠"，"锻炉"和"板甲"，这张牌的战力+15',
        value: 15,
        stackable: false
      }
    ]
  },

  // 13. 金牌烤火鸡
  {
    id: 'card_013',
    name: '金牌烤火鸡',
    type: 'tactic',
    keywords: ['食物'],
    attribute: '火',
    basePower: 0,
    currentPower: 0,
    cost: 1,
    slotRequired: 1,
    isPersistent: false,
    effects: [
      {
        timing: 'onReveal',
        type: 'modifyPower',
        description: '揭示后为你场上一张带有"居民/冒险者"关键词的卡牌战力+2',
        targetKeywords: ['居民', '冒险者'],
        value: 2,
        stackable: false
      }
    ]
  },

  // 14. 生命药水
  {
    id: 'card_014',
    name: '生命药水',
    type: 'tactic',
    keywords: ['药剂'],
    attribute: '无',
    basePower: 0,
    currentPower: 0,
    cost: 1,
    slotRequired: 1,
    isPersistent: false,
    effects: [
      {
        timing: 'onReveal',
        type: 'modifyPower',
        description: '揭示后为你的场上带有"职业者"关键词的卡牌战力+2',
        targetKeywords: ['职业者'],
        value: 2,
        stackable: false
      }
    ]
  },

  // 15. 魔法飞弹
  {
    id: 'card_015',
    name: '魔法飞弹',
    type: 'tactic',
    keywords: ['魔法', '奥术'],
    attribute: '无',
    basePower: 0,
    currentPower: 0,
    cost: 1,
    slotRequired: 1,
    isPersistent: false,
    effects: [
      {
        timing: 'onReveal',
        type: 'modifyCost',
        description: '揭示后使你左手边第一名玩家当前能量值-2',
        value: -2,
        stackable: false
      }
    ]
  }
]

// 创建卡牌数据库
const CardDatabase = new Map()

// 初始化卡牌数据库
export function initializeCardDatabase() {
  CardDatabase.clear()
  cardDefinitions.forEach(card => {
    CardDatabase.set(card.id, card)
  })
}

// 获取卡牌
export function getCard(id) {
  // 移除 _unique 后缀
  const baseId = id.replace(/_unique$/, '')
  const cardDef = CardDatabase.get(baseId)
  if (!cardDef) return null
  
  // 返回卡牌的深拷贝
  return JSON.parse(JSON.stringify(cardDef))
}

// 创建一副牌（每种卡牌1张，共15张）
export function createDeck() {
  const deck = []
  cardDefinitions.forEach((cardDef) => {
    const card = getCard(cardDef.id)
    if (card) {
      // 每张卡只有1张，添加 _unique 后缀
      card.id = `${cardDef.id}_unique`
      deck.push(card)
    }
  })
  return deck
}

// 洗牌
export function shuffleDeck(deck) {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 初始化
initializeCardDatabase()
