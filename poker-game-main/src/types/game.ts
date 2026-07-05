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
  | 'onBatchReveal'    // 本批全员展示后（旗鱼等）
  | 'onGameEnd'        // 游戏结束时（吟游诗人/风笛）
  | 'onReforge'        // 重铸行动时（锻炉）

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
  | 'grantAttributePlayBonus' // onDeploy 下一张指定属性单位 +N（萨满祭司）
  | 'setD6MinForCardName'     // onDeploy 指定名称卡牌 D6 下限（珍珠商人）
  | 'conditionalPlayCost'     // 打出时按场上条件设定费用（蔓生怪）
  | 'excludeFromFieldCount'   // onDeploy 自身不计入终局 6 张（奴隶）
  | 'grantTacticPlayFree'     // onDeploy 下一张指定关键词战术不占用行动（药剂师）
  | 'modifyPowerByUniqueAttributes' // onGameEnd 按不同属性计数加战力（游客）
  | 'playRequirement'         // 打出前场上条件（帆船）
  | 'searchFromHandOrDeck'    // 从手牌/牌库检索并部署（溪流）
  | 'grantUntargetable'       // onField 满足条件时其他玩家不可选中（蛇颈龙）
  | 'deployFromHand'          // 从手牌部署到额外槽位（搬运工）
  | 'debuffAheadPlayers'      // onGameEnd 落后时领先玩家战力减值（贫民窟）
  | 'crossPlayerDeploy'       // 部署到其他玩家场上（礁石）
  | 'destroyRandomOther'      // onGameEnd 随机消灭一张其他己方牌（食人魔）
  | 'setPowerIfFieldNames'    // onGameEnd 场上有环境+指定名称时设战力（纪念照）
  | 'setPowerIfOnlyHandCard'  // onGameEnd 唯一手牌时设战力（金矿）
  | 'setPowerIfFieldKeyword'  // onGameEnd 场上有指定关键词时设战力（红宝石）
  | 'setPowerIfHandNames'     // onGameEnd 手牌含指定名称时设战力（蓝宝石/绿宝石）
  | 'deployOnHostOnly'        // quickPlay 仅能部署在指定关键词宿主上（作物）
  | 'invertPowerLoss'         // onDeploy 战力降低时改为提升（狂战士）
  | 'discardHandOrSelf'       // onReveal 须弃手牌否则自身进弃牌区（哥布林杂兵）
  | 'skipOthersDrawNextRound' // onDeploy 其他玩家下回合开始不抽牌（牛头人勇士）
  | 'discardHandForLeftPlayerDebuff' // roundStart 弃指定属性手牌使左手边玩家终局战力减值（火蜥蜴）
  | 'scheduleRoundStartEnergy'  // onReveal 预约下回合/最后一轮开始时恢复能量（间歇泉）
  | 'grantCopiesToHand'         // onReveal 获取模板卡副本加入手牌（征募官）
  | 'playRandomFromDeckOrTop'   // onReveal 随机尝试打出牌库牌否则置顶（攀爬工具）
  | 'autoEnterFromZone'         // 首回合开始从手牌/牌库/弃牌堆自动进场（急先锋）
  | 'absorbLeftPlayerUnit'      // onDeploy 吸收左手边低战力单位（巨鹏）
  | 'stashHandUnderSelf'        // onReveal 手牌置于下方获战力（走私船）
  | 'initCharges'               // onDeploy 初始化充能（箭袋）
  | 'chargeDebuffUnit'          // roundStart 消耗充能削弱单位（箭袋）
  | 'scheduleRoundEndBuff'      // onReveal 预约多回合 roundEnd 加战力（回春术）
  | 'lockRandomHandCards'       // onDeploy/onReveal 封锁对手手牌（冰锥术）
  | 'restrictAdjacentPlayType'  // onReveal 限制相邻玩家下回合出牌类型（潮汐歌者）
  | 'scryDeckTop'               // roundStart 占卜牌库顶（星象塔）
  | 'peekDeckBottom'            // onReveal 查看牌库底（隐士）
  | 'effectBranch'              // roundStart 弃牌后分支 A/B/C（海洋德鲁伊）
  | 'copyFieldUnitIdentity'     // onReveal 复制场单位身份（无貌者）
  | 'sacrificeFieldForPower'    // onReveal 牺牲己方场牌获战力（食尸鬼教徒）
  | 'retrieveFromDiscard'       // onReveal 从弃牌区取牌（食尸鬼教徒）
  | 'noOp'                      // 无机制占位（枭熊/雷龙/双足飞龙）
  | 'batchHighestFreeDeploy'    // 本批展示后战力最高则退还打出费用（旗鱼）
  | 'moveOpponentBatchRevealToDeckBottom' // 将对手本批展示牌置于牌库底（矮人烈酒）
  | 'forceRandomHandPlay'       // 强制对手随机打出一张手牌（矮人烈酒）

/** 本批展示条目（盖牌→同时翻开） */
export interface RevealBatchEntry {
  playerId: string
  playerIndex: number
  orderIndex?: number
  card: Card
  slotIndex: number
  /** 部署所在玩家索引（跨场部署时与 playerIndex 不同） */
  fieldOwnerIndex: number
  playCost: number
  /** 本批展示后已从场上移除（如矮人烈酒置库底） */
  removedFromField?: boolean
}

/** roundEnd 预约 buff（回春术） */
export interface PendingRoundEndBuff {
  targetCardId: string
  powerDelta: number
  roundsLeft: number
}

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
  /** 场上需存在指定名称的卡牌才触发（奶牛/螃蟹） */
  requireFieldName?: string
  /** onDeploy 自增战力：场上无其他带该关键词的牌（退役老兵：无其他士兵） */
  noOtherFieldKeyword?: string
  /** 配合 noOtherFieldKeyword：场上需有其他带该关键词的牌（退役老兵：有居民） */
  requireOtherFieldKeyword?: string
  /** 配合 requireFieldKeywords：限定场上牌类型 */
  requireFieldCardType?: CardType
  /** 场上需存在指定属性的牌（任一即可，如蔓生怪需木环境） */
  requireFieldAttributes?: string[]
  /** 场上需同时存在各属性各至少一张（如珊瑚元素需水+光环境） */
  requireAllFieldAttributes?: string[]
  /** conditionalPlayCost：条件满足时的打出费用 */
  playCostValue?: number
  /** onOtherPlay：仅当打出的牌为该类型时触发（武僧→战术） */
  triggerPlayedCardType?: CardType
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
  /** onReveal：延迟到本批全员展示后结算（矮人烈酒） */
  batchResolveOnly?: boolean
  /** onDeploy modifyPower：场上无更高 basePower 的单位时触发（暴徒） */
  noHigherPowerUnitOnField?: boolean
  /** onDeploy 自增：按场上匹配牌数量 × value（海葵） */
  countMatchingFieldCards?: boolean
  /** 配合 countMatchingFieldCards：计数含手牌（棕榈树） */
  includeHand?: boolean
  /** 配合 countMatchingFieldCards：基础战力上限（含） */
  maxBasePower?: number
  /** onOtherPlay：给打出的那张牌加战力（翻车鱼），非 selfTarget */
  buffPlayedCard?: boolean
  /** 配合 buffPlayedCard：重复加值次数 */
  triggerCount?: number
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
  /** destroy：降至该阈值及以下则摧毁（默认 0）；targetKeywords 匹配时可摧毁环境/建筑 */
  destroyThreshold?: number
  /** destroy：强制允许摧毁 environment（力场波等） */
  destroyEnvironment?: boolean
  /** destroy：无视战力直接摧毁（寒铁虎等） */
  directDestroy?: boolean
  /** createSlot：额外槽位可部署单位需匹配的关键词/类型/属性 */
  slotDeployKeywords?: string[]
  slotDeployCardType?: CardType
  slotDeployAttributes?: string[]
  /** createSlot：部署在该槽位上的单位不计终局数量 */
  slotExcludeFromFieldCount?: boolean
  /** createSlot：部署到该槽位的单位额外战力 */
  slotDeployedPowerBonus?: number
  /** playRequirement：牌库中不得含战术牌（蛮斗士） */
  requireNoTacticsInDeck?: boolean
  /** playRequirement：此牌无法主动打出（金矿/纪念照） */
  unplayable?: boolean
  /** setPowerIfFieldNames：场上需同时存在这些名称的卡牌 */
  requireFieldNames?: string[]
  /** setPowerIfHandNames：手牌中需同时存在这些名称的卡牌 */
  requireHandNames?: string[]
  /** deployOnHostOnly：宿主牌需带这些关键词（含名称匹配） */
  requireHostKeywords?: string[]
  /** deployOnHostOnly：宿主牌需为指定属性（任一匹配） */
  requireHostAttributes?: string[]
  /** deployOnHostOnly：允许部署到普通空槽（攀岩爱好者） */
  allowNormalDeploy?: boolean
  /** deployOnHostOnly：宿主路径额外叠加战力（含 basePower 之外） */
  hostDeploySelfBonus?: number
  /** deployOnHostOnly：宿主为指定属性时额外加值（三叉戟→水） */
  hostBonusIfHostAttribute?: string
  /** 配合 hostBonusIfHostAttribute */
  hostBonusValue?: number
  /** roundEnd 等：宿主额外槽位上须有部署牌才触发 */
  requireDeployedOnSelf?: boolean
  /** searchDeck：按属性检索（如雪狼→冰） */
  searchAttribute?: string
  /** roundStart 等：每回合限触发一次（火蜥蜴） */
  oncePerRound?: boolean
  /** autoEnterFromZone：仅首回合触发 */
  firstRoundOnly?: boolean
  /** stashHandUnderSelf：最多隐藏手牌张数 */
  stashMaxCount?: number
  /** stashHandUnderSelf：每张隐藏牌给予宿主战力 */
  powerPerStashedCard?: number
  /** initCharges / 箭袋：初始充能数 */
  initialCharges?: number
  /** scheduleRoundEndBuff：持续回合数 */
  roundEndBuffRounds?: number
  /** scheduleRoundEndBuff：每回合结束战力增量 */
  roundEndBuffPower?: number
  /** lockRandomHandCards：每名对手封锁手牌数 */
  lockHandCount?: number
  /** lockRandomHandCards：仅最后一轮可打出 */
  lockHandFinalRoundOnly?: boolean
  /** restrictAdjacentPlayType：要求的出牌类型 */
  requiredPlayType?: CardType
  /** scryDeckTop：占卜张数 */
  scryCount?: number
  /** scryDeckTop：取入手牌张数 */
  scryTake?: number
  /** scryDeckTop：其余置于牌库底 */
  scryRestToBottom?: boolean
  /** peekDeckBottom：是否加入手牌 */
  peekTake?: boolean
  /** extraPlay：额外出牌须匹配的类型/关键词（法师塔） */
  extraPlayCardType?: CardType
  extraPlayKeywords?: string[]
  /** effectBranch：分支子效果 */
  branches?: Record<string, Partial<CardEffect>>
  /** retrieveFromDiscard：随机取牌 */
  retrieveRandom?: boolean
  /** discardHandForLeftPlayerDebuff：须弃手牌匹配的属性 */
  discardHandAttributes?: string[]
  /** discardHandForLeftPlayerDebuff：作用于左手边玩家 bonusPower */
  debuffBonusPower?: number
  /** scheduleRoundStartEnergy：下回合开始时恢复能量 */
  onNextRoundStart?: boolean
  /** scheduleRoundStartEnergy：最后一轮开始时恢复能量 */
  onFinalRoundStart?: boolean
  /** grantCopiesToHand：模板卡 ID（card_008 等） */
  grantCardId?: string
  /** grantCopiesToHand：生成张数 */
  grantCount?: number
  /** grantCopiesToHand：覆盖打出费用 */
  grantCostOverride?: number
  /** modifyPower 等：全场任意玩家场上需含该关键词 */
  requireGlobalFieldKeyword?: string
  drawCount?: number     // number of cards to draw
}

/** 额外槽位（载具/狮鹫等）的部署限制 */
export interface SlotDeployRules {
  deployKeywords?: string[]
  deployCardType?: CardType
  deployAttributes?: string[]
  excludeFromFieldCount?: boolean
  deployedPowerBonus?: number
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
  /** 部署在额外槽位且 host 标记不计入终局数量 */
  excludeFromFieldCount?: boolean
  /** 其他玩家效果不可选中（蛇颈龙等） */
  untargetableByOthers?: boolean
  /** 战力降低时改为提升（狂战士） */
  invertPowerLoss?: boolean
  /** roundStart 等：本回合已触发过一次 */
  roundUsed?: boolean
  /** 箭袋等：当前充能 */
  charges?: number
  /** 箭袋等：最大充能 */
  maxCharges?: number
}

// 场上槽位
export interface FieldSlot {
  card: Card | null
  position: number        // 槽位位置 0-5
  isExtra: boolean        // 是否是额外槽位（载具产生的）
  parentSlot?: number     // 如果是额外槽位，父槽位的位置
  deployRules?: SlotDeployRules
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
  /** 额外出牌限制（法师塔：仅魔法战术） */
  extraPlayRestriction?: { cardType?: CardType; keywords?: string[] }
  hasPlayedThisTurn: boolean  // 本回合是否已出牌
  pendingNextAttribute?: string  // 下一张部署牌属性覆盖（元素墙）
  /** 气泡酒等：之后打出的每张单位牌额外战力 */
  unitPlayPowerBonus?: number
  /** 萨满祭司等：下一张指定属性单位额外战力（打出后消耗） */
  unitPlayAttributeBonus?: Partial<Record<AttributeType, number>>
  /** 珍珠商人等：按卡牌名称保证 D6 下限 */
  d6MinByCardName?: Record<string, number>
  /** 药剂师等：下一张匹配关键词的战术牌不占用行动（一次性） */
  tacticPlayFreeKeywords?: string[]
  /** 牛头人勇士等：下回合开始跳过抽牌（一次性） */
  skipDrawNextRound?: boolean
  /** 间歇泉等：下回合开始预约恢复的能量 */
  pendingNextRoundStartEnergy?: number
  /** 间歇泉等：最后一轮开始预约恢复的能量 */
  pendingFinalRoundStartEnergy?: number
  /** 冰锥术等：cardId → 封锁原因 */
  lockedHandCards?: Record<string, 'finalRoundOnly' | 'locked'>
  /** 潮汐歌者等：下回合必须打出的卡牌类型 */
  restrictNextPlayType?: CardType
  /** 回春术等：回合结束预约 buff */
  pendingRoundEndBuffs?: PendingRoundEndBuff[]
  deckCardIds?: string[]
  /** 本批展示后待弃置的战术牌（batchResolveOnly 延迟揭示） */
  pendingBatchTacticDiscards?: Array<{ card: Card; playerId: string; slotIndex: number }>
}

// 游戏阶段
export type GamePhase = 'draw' | 'decision' | 'selectSlot' | 'selectCrossPlayerSlot' | 'selectTarget' | 'selectEffectBranch' | 'action' | 'gameOver'

// 决策类型
export type DecisionType = 'play' | 'reforge'

// 重铸选项
export type ReforgeOption = 'gainCost' | 'redraw' | 'gainPower'

/** 海洋德鲁伊等 effectBranch 待选状态 */
export interface PendingEffectBranch {
  playerId: string
  ownerCardId: string
  ownerCardName: string
  discardHandAttributes: string[]
  branches: Record<string, Partial<CardEffect>>
  oncePerRound?: boolean
}

/** 广播日志条目 */
export interface BroadcastEntry {
  id: string
  round: number
  text: string
  source?: string
  timestamp: number
}

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
  selectedDeployPlayerIndex?: number
  availableSlots?: number[]
  /** 跨玩家部署：可选 { playerIndex, slotIndex } 列表 */
  availableCrossPlayerSlots?: Array<{ playerIndex: number; slotIndex: number }>
  availableTargets?: Card[]
  pendingQuickPlayCard?: Card  // QuickPlay unit card awaiting target selection
  pendingHostDeployCard?: Card  // 宿主专属部署（短柄斧等）待选目标
  pendingDeployEffect?: CardEffect  // onDeploy 效果待选目标（精准射击）
  // 同时回合机制 (multi-player serializable records)
  playerDecisions?: Record<string, { made: boolean; choice: DecisionType | null }>
  pendingReveals?: Record<string, Array<{
    card: Card
    slotIndex: number
    targetPlayerIndex?: number
    playCost?: number
  }>>
  /** 最近一次批次展示结算快照（矮人烈酒等） */
  lastResolvedBatch?: RevealBatchEntry[]
  /** 正在执行批次展示结算（批次隔离） */
  isResolvingRevealBatch?: boolean
  playersReady?: Record<string, boolean>
  // 最后一轮限制
  playerRestrictions?: Record<string, string[]>  // playerId → ['cannotPlay'|'tacticsOnly']
  // 负数能量追踪
  playersWithNegativeCost?: string[]
  /** effectBranch 待选（按 playerId） */
  pendingEffectBranches?: Record<string, PendingEffectBranch>
  /** 广播历史（最新在前） */
  broadcastLog?: BroadcastEntry[]
  /** 联机：onReveal 待选目标（激励乐章等） */
  pendingRevealTargetSelection?: {
    playerId: string
    cardId: string
    slotIndex: number
    effect: CardEffect
    targetCardIds: string[]
  }
  accountState?: AccountState
}

// 游戏操作（用于联机同步）
export interface GameAction {
  type: 'choosePlay' | 'chooseReforge' | 'playCard' | 'selectSlot' | 'selectTarget' | 'selectRevealTarget' | 'executeReforge' | 'resolveEffectBranch' | 'skipEffectBranch' | 'cancelDecision' | 'endTurn' | 'skipTurn' | 'drawCard' | 'finalRound' | 'revealCards' | 'playerLeft' | 'createRoom' | 'registerPlayer' | 'loginPlayer' | 'saveDeck' | 'loadDeck' | 'getAccountState'
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

export interface SavedDeckSlot {
  id: string
  name: string
  cardIds: string[]
  updatedAt: string
}

export interface AccountState {
  isRegistered: boolean
  playerName: string | null
  deckCardIds: string[]
  /** 命名卡组栏位 */
  savedDecks?: SavedDeckSlot[]
  /** 当前选用的栏位 id */
  activeDeckSlotId?: string | null
}
