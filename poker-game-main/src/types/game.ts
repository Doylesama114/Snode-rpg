// 卡牌类型
export type CardType = 'unit' | 'environment' | 'tactic'

// 属性类型
export type AttributeType = '无' | '土' | '钢' | '木' | '火' | '风' | '水' | '奥术'

// 效果触发时机
export type EffectTiming = 
  | 'onPlay'           // 打出时
  | 'onDeploy'         // 部署时（打出并支付费用后）
  | 'onField'          // 在场时持续
  | 'onDestroy'        // 被摧毁时
  | 'onOtherPlay'      // 其他卡牌打出时
  | 'roundStart'       // 回合开始
  | 'roundEnd'         // 回合结束
  | 'onReveal'         // 揭示时（战术牌）

// 效果类型
export type EffectType =
  | 'extraPlay'        // 额外出牌
  | 'modifyPower'      // 修改战力
  | 'modifyCost'       // 修改费用
  | 'draw'             // 抽牌
  | 'createSlot'       // 创建额外槽位
  | 'conditional'      // 条件效果
  | 'destroy'          // 摧毁
  | 'protect'          // 保护

// 卡牌效果定义
export interface CardEffect {
  timing: EffectTiming
  type: EffectType
  description: string
  // 效果执行函数
  execute?: (context: EffectContext) => void
  // 条件检查函数
  condition?: (context: EffectContext) => boolean
  // 效果值
  value?: number
  // 目标关键词
  targetKeywords?: string[]
  // 是否可叠加
  stackable?: boolean
}

// 效果执行上下文
export interface EffectContext {
  game: GameState
  card: Card
  player: Player
  opponent: Player
  trigger?: Card  // 触发效果的卡牌
}

// 卡牌定义
export interface Card {
  id: string
  name: string
  type: CardType
  keywords: string[]      // 关键词数组
  attribute: AttributeType
  basePower: number       // 基础战力（环境/战术为0）
  currentPower: number    // 当前战力
  cost: number
  effects: CardEffect[]
  slotRequired: number    // 需要的槽位数（默认1）
  isPersistent: boolean   // 是否持续存在（战术牌为false）
  stackedBonus?: number   // 叠加的加成（用于法师、战士等）
}

// 场上槽位
export interface FieldSlot {
  card: Card | null
  position: number        // 槽位位置 0-5
  isExtra: boolean        // 是否是额外槽位（载具产生的）
  parentSlot?: number     // 如果是额外槽位，父槽位的位置
}

// 玩家数据
export interface Player {
  id: string
  name: string
  hand: Card[]
  deck: Card[]
  field: FieldSlot[]      // 改为槽位数组
  discard: Card[]
  currentCost: number
  bonusPower: number
  canPlayExtra: boolean   // 是否可以额外出牌
  hasPlayedThisTurn: boolean  // 本回合是否已出牌
}

// 游戏阶段
export type GamePhase = 'draw' | 'decision' | 'selectSlot' | 'selectTarget' | 'action' | 'gameOver'

// 决策类型
export type DecisionType = 'play' | 'reforge'

// 重铸选项
export type ReforgeOption = 'gainCost' | 'redraw' | 'gainPower'

// 游戏状态
export interface GameState {
  players: [Player, Player]
  currentPlayerIndex: number
  round: number
  phase: GamePhase
  isFinalRound: boolean
  finalRoundTriggeredBy?: number
  winner?: number
  message: string
  // 选择状态
  selectedCard?: Card
  selectedSlot?: number
  availableSlots?: number[]
  availableTargets?: Card[]
  // 同时回合机制
  pendingReveals?: Map<string, { cardId: string; slotIndex: number }>  // 待揭示的卡牌
  playersReady?: Set<string>  // 已准备好的玩家
}

// 游戏操作（用于联机同步）
export interface GameAction {
  type: 'choosePlay' | 'chooseReforge' | 'playCard' | 'selectSlot' | 'selectTarget' | 'executeReforge' | 'endTurn' | 'skipTurn' | 'drawCard' | 'finalRound' | 'revealCards' | 'playerLeft'
  data?: any
  playerId?: string  // 添加玩家ID标识
}
