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
  | 'onGameEnd'        // 游戏结束时（吟游诗人/风笛）

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
  | 'searchDeck'       // 检索牌库
  | 'restoreEnergy'    // 恢复能量（quickPlay）
  | 'modifyPowerByName' // 按名称修改战力（quickPlay）
  | 'reduceUnitPower'  // 减少对手单位战力（quickPlay）
  | 'discardOpponentHand' // 弃置对手手牌（quickPlay）
  | 'returnToDeckBottom'  // 返回牌库底部（quickPlay）
  | 'setNextUnitAttribute' // 设置下一次部署属性（quickPlay）
  | 'markOpponentHand'     // 标记对手手牌（quickPlay）
  | 'stealPower'          // 偷取战力（onReveal）
  | 'stealCard'           // 偷取手牌（onReveal）
  | 'absNegativePower'    // 负数战力变正（onDeploy，祈福）
  | 'setFieldAttribute'   // 改变场上卡牌属性（onDeploy，炎炎夏日）
  | 'modifyPlayCost'      // onField 打出费用减免（季风）
  | 'd6ModifyPower'       // onGameEnd 掷D6加战力（吟游诗人）
  | 'doubleTargetPower'   // onGameEnd 按名称翻倍战力（风笛）
  | 'd6TierPower'         // D6 档位加战力（贝壳）
  | 'setPowerIfNoFieldKeyword' // onGameEnd 场上无其他关键词时设战力（晴天）
  | 'debuffOpponentHand'  // onDeploy 削弱左手边玩家手牌 basePower（燃烧之手）
  | 'grantUnitPlayBonus'  // onReveal 之后打出的单位牌战力加成（气泡酒）

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
  value?: number | string
  // 目标关键词
  targetKeywords?: string[]
  // 目标属性（e.g. ['火', '水'] — match by card.attribute instead of keywords）
  targetAttributes?: string[]
  /** 排除的属性（雷云召来：非雷单位 -2） */
  excludeAttributes?: string[]
  /** onReveal modifyPower 作用于所有玩家场上 */
  allPlayers?: boolean
  /** setFieldAttribute：目标卡牌类型（environment/unit/tactic） */
  targetCardType?: CardType
  /** roundStart 等：场上需存在带这些关键词的牌才触发 */
  requireFieldKeywords?: string[]
  /** 配合 requireFieldKeywords：限定场上牌类型 */
  requireFieldCardType?: CardType
  /** round 全局 modifyPower：作用于场上所有卡（非仅 self） */
  targetAllCards?: boolean
  /** roundEnd：改场上其他卡（非自身） */
  excludeSelf?: boolean
  targetOtherOnField?: boolean
  /** draw / roundStart：D6 点数需 >= d6Min 才触发 */
  d6Min?: number
  /** onReveal modifyPower：用 D6 点数代替固定 value（激励乐章） */
  useD6Value?: boolean
  /** d6TierPower：D6 点数区间 → 战力增量 */
  d6Tiers?: { min: number; max: number; value: number }[]
  /** searchDeck：按名称检索（OR） */
  searchNames?: string[]
  /** searchDeck：对 searchKeywords 中每个关键词各检索 maxCount 张（杂货铺） */
  searchEachKeyword?: boolean
  /** debuffOpponentHand：削弱对手手牌张数 */
  handDebuffCount?: number
  /** modifyCost：仅左手边第一名玩家（魔法飞弹） */
  targetLeftPlayer?: boolean
  /** onDeploy modifyPower：场上无更高 basePower 的单位时触发（暴徒） */
  noHigherPowerUnitOnField?: boolean
  // 条件标记
  invertCondition?: boolean
  requireKeywords?: string[][]
  selfTarget?: boolean
  /** 按场上其他卡的不同关键词种类计数（见习冒险者） */
  countUniqueKeywords?: boolean
  /** 按部署在本卡额外槽位上的单位计数（农田） */
  countDeployedOnSelf?: boolean
  /** 农田类：战力=部署计数×value，忽略 basePower */
  replacePowerWithDeploymentCount?: boolean
  // 是否可叠加
  stackable?: boolean
  // 牌库检索
  searchName?: string    // card name to search for (e.g. '牛奶')
  searchKeyword?: string // keyword to search for (e.g. '载具')
  searchKeywords?: string[] // 多关键词 OR 检索（收获日）
  maxCount?: number      // 检索上限
  shuffleAfterSearch?: boolean // 检索后洗牌库
  searchDiscard?: boolean // 是否检索弃牌堆，默认 true
  targetName?: string    // target card name for name-based effects (e.g. modifyPowerByName)
  /** destroy：降至该阈值及以下则摧毁（默认 0） */
  destroyThreshold?: number
  drawCount?: number     // number of cards to draw
}

// 效果执行上下文
export interface EffectContext {
  game: GameState
  card: Card
  player: Player
  opponent?: Player      // N-player: 单一对手不再存在
  opponents?: Player[]    // N-player: 所有对手
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
  forcedPlay?: boolean    // 是否强制打出（费用不足仍可打出，能量变负数）
  quickPlay?: boolean     // 是否快速打出（跳过费用/行动检查，直接触发效果）
  markedForDiscard?: boolean // 被标记弃置（火焰箭效果）
  deployOnCardTarget?: string // QuickPlay unit: parent card id (deployed onto existing field card)
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
  pendingNextAttribute?: string  // 下一张部署牌属性覆盖（元素墙）
  /** 气泡酒等：之后打出的每张单位牌额外战力 */
  unitPlayPowerBonus?: number
  deckCardIds?: string[]
}

// 游戏阶段
export type GamePhase = 'draw' | 'decision' | 'selectSlot' | 'selectTarget' | 'action' | 'gameOver'

// 决策类型
export type DecisionType = 'play' | 'reforge'

// 重铸选项
export type ReforgeOption = 'gainCost' | 'redraw' | 'gainPower'

// 游戏状态
export interface GameState {
  players: Player[]                     // N-player (was [Player, Player])
  playerCount?: number                  // 配置的玩家数 (2-4)
  currentPlayerIndex: number
  round: number
  phase: GamePhase
  isFinalRound: boolean
  finalRoundTriggeredBy?: number
  winner?: number
  rankings?: Array<{ playerIndex: number; power: number }>  // 多人排名
  message: string
  // 选择状态
  selectedCard?: Card
  selectedSlot?: number
  availableSlots?: number[]
  availableTargets?: Card[]
  pendingQuickPlayCard?: Card  // QuickPlay unit card awaiting target selection
  pendingDeployEffect?: CardEffect  // onDeploy 效果待选目标（精准射击）
  // 同时回合机制 (multi-player serializable records)
  playerDecisions?: Record<string, { made: boolean; choice: DecisionType | null }>
  pendingReveals?: Record<string, Array<{ cardId: string; slotIndex: number }>>
  playersReady?: Record<string, boolean>
  // 最后一轮限制
  playerRestrictions?: Record<string, string[]>  // playerId → ['cannotPlay'|'tacticsOnly']
  // 负数能量追踪
  playersWithNegativeCost?: string[]
  accountState?: AccountState
}

// 游戏操作（用于联机同步）
export interface GameAction {
  type: 'choosePlay' | 'chooseReforge' | 'playCard' | 'selectSlot' | 'selectTarget' | 'executeReforge' | 'endTurn' | 'skipTurn' | 'drawCard' | 'finalRound' | 'revealCards' | 'playerLeft' | 'createRoom' | 'registerPlayer' | 'loginPlayer' | 'saveDeck' | 'loadDeck' | 'getAccountState'
  data?: any
  playerId?: string
  playerCount?: number    // room creation: 2-4
  maxPlayers?: number     // room config
}

// Account System
export interface PlayerAccount {
  id: number
  name: string
  registeredAt: string
}

export interface DeckConfig {
  cardIds: string[]  // exactly 15
}

export interface Deck extends DeckConfig {
  id: number
  playerId: number
  isDefault: boolean
  createdAt: string
}

export interface AccountState {
  isRegistered: boolean
  playerName: string | null
  deckCardIds: string[]
}
