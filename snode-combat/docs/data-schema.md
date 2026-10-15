# 战斗数据 schema（v2 草案 v0.1）

> 状态：编码前定稿稿
> 权威依据：`docs/战斗系统设计v2.md`（2026-09-20 由仓库根目录迁入）
> 本文件只定义数据；核心代码必须按本 schema 消费数据。

---

## 1. 设计原则

1. **展示与执行分离**：自然语言描述只用于 UI；引擎只执行结构化 `effects` / `passives` / `statuses`。
2. **数据即规则**：通用机制全部由卡片声明，禁止在 core 中为某个技能写特判。
3. **可序列化回放**：所有卡片与表达式必须是 JSON 可序列化的纯数据。
4. **无法结构化就不进战斗**：不能表达为 v1 op 的技能标记为 `notImplemented`，不进入 PVE。
5. **引用完整**：ID 全局唯一；引用的状态、怪物、地形、资源必须存在，校验脚本零错误门槛。
6. **升级规则显式化**：同一能力不同等级差异用 `levelScaling`，引擎按当前等级取最高匹配项。

---

## 2. 基础类型

### 2.1 枚举
```ts
type AttrName = '力量'|'敏捷'|'体质'|'智力'|'感知'|'魅力'|'意志'|'幸运';
type Direction = 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW';
type ActionType = 'main'|'bonus'|'reaction'|'free'|'none';
// 规则裁决：卡片文本中的 `1动作` = main，`0动作` = bonus，`附赠动作` = bonus。
type UsageScope = 'unlimited'|'perTurn'|'perRound'|'perBattle'|'shortRest'|'longRest'|'daily';
type DistanceMetric = 'grid'|'adjacent'|'combat';
type Team = 'player'|'enemy';
```

### 2.2 表达式
- 骰子/数值统一使用字符串表达式，例如：
  - `"1D8"`、`"2D4"`、`"1D3"`、`"1D100"`
  - `"1D8 + @strMod"`、`"2 * @comboPoints"`
  - `"min(@wisMod, 2)"`、`"floor(@speed / 2)"`
- 可用变量：
  - `@level` 职业等级
  - `@strMod` `@dexMod` `@conMod` `@intMod` `@wisMod` `@chaMod` `@willMod` `@luckMod`
  - `@keyMod` 关键属性调整值
  - `@proficiency` 熟练加值
  - `@comboPoints` 当前连击点
  - `@layers` 当前状态层数（状态卡上下文）
  - `@hp` `@hpMax` `@fp` `@fpMax`
  - `@consumedResource` 最近一次 ResourceOp 实际消耗量（抽血连击点）
  - `@chosenDamageType` 玩家选择的伤害类型（毒刃）
  - `@targetBleedLayers` 目标当前流血层数
- 运算符仅允许 `+ - * / ( ) min() max() floor() ceil()`。
- 校验器必须拒绝任意函数调用、属性访问、HTML 字符串。

### 2.3 目标与范围
```ts
interface Targeting {
  kind: 'self' | 'unit' | 'point' | 'area';
  range?: {
    max: number | string;
    metric: DistanceMetric; // grid/combat；近战/触及用 adjacent
  };
  area?: {
    shape: 'adjacent' | 'radius' | 'cone' | 'rect';
    radius?: number | string;   // radius
    rings?: number;             // cone 环数
    width?: number; height?: number; // rect
    metric: DistanceMetric;     // 区域内部判定距离
  };
  filter: {
    teams: Team[];
    includeSelf?: boolean;
    livingOnly?: boolean;
    mustSee?: boolean;          // v1 无潜行，默认 true，但视觉遮蔽不做
    maxTargets?: number;
    exclude?: string[];         // 单位 ID
    facingSource?: boolean;     // 抛沙：只选中“面朝向施法者”的目标
  };
}
```

说明：
- 近战/触及技能使用 `range: { metric: 'adjacent' }`，斜角相邻可命中。
- AOE 伤害统一使用 `kind: 'aoeDamageSave'`：每个范围目标做 DC15 敏捷豁免；D20=1 双倍、失败全伤、成功半伤（向下取整）、D20=20 无伤；伤害骰只掷一次。
- 技能关键词中的额外豁免是独立 `save` roll，只决定附加状态，不参与伤害程度。
- “周围 2 米”区域使用 `metric: 'grid'`，斜角第二格不在范围内。
- “相邻所有角色”使用 `shape: 'adjacent'`。
- 高度差自动并入 `metric: 'combat'` 的距离；`metric: 'adjacent'` 还要求高度差 ≤ 1。

### 2.4 使用次数
```ts
interface Usage {
  scope: UsageScope;
  max: number | string;
  perSource?: boolean;   // 默认 false：同类资源合并计数
}
```

---

## 3. 单位卡 `unit`

### 3.1 玩家角色快照
```ts
interface PlayerUnitCard {
  id: string;                 // 例如 'pc:甘九·顽石'
  kind: 'player';
  name: string;
  class: { name: string; level: number; keyAttr: AttrName };
  race?: string;
  size: 'medium';             // v1 只支持 1x1，字段保留
  height: number;             // 单位高度 z，米
  attrs: Record<AttrName, number>;
  hpMax: number;
  fpMax: number;
  ac: number;
  speed: number;              // 基础移动力 = 格数 = 米
  initiative: { mode: 'roll'; bonusExpr: '@dexMod' };
  proficiency: number;
  profs: {
    weapons?: string[];
    saves?: AttrName[];
    skills?: string[];
  };
  equipment: {
    mainHand?: WeaponCard;
    offHand?: WeaponCard;
    armor?: ArmorCard;
  };
  resources: {
    comboPointsMax: number;   // 游荡者连击点上限；其他职业可为 0
  };
  abilities: string[];        // AbilityCard ID
  passives: string[];         // AbilityCard ID（type=passive）
  tags: string[];             // 例如 ['类人生物']
  source?: { kind: 'save'; charKey: string; slot: number; importedAt: string };
}
```

- 玩家单位卡由 `tools/import-player-card` 从角色面板存档生成，**生成后完全独立**。
- 导入器负责把面板数据解析为已结算字段（HP/FP/AC/speed/熟练/装备/技能），core 不依赖 `panel_engine.js`。

### 3.2 怪物卡 `monster`
```ts
interface MonsterCard {
  id: string;
  kind: 'monster';
  name: string;
  size: 'medium' | 'small';   // v1 先只放 1x1
  height: number;
  attrs: Record<AttrName, number>;
  hpMax: number;
  fpMax: number;
  ac: number;
  speed: number;
  initiative: { mode: 'fixed'; value: number };
  proficiency: number;
  equipment: { mainHand?: WeaponCard };
  abilities: string[];
  ai: MonsterAI;
  tags: string[];
  drops?: { gold?: [number, number]; xp?: number; items?: string[] };
}
```

---

## 4. 装备卡

```ts
interface WeaponCard {
  id: string;
  name: string;
  category?: string;          // 剑类/匕首/远程/...
  tags: string[];             // ['剑','单手','灵巧'] 等
  hands: 1 | 2;
  dice: string;               // 如 '1D8'
  damageType: string;         // 挥砍/穿刺/钝击/剧毒...
  attackAttr?: AttrName | null; // 武器命中/伤害所需属性；枪械命中仍使用 attackAttr（通常为敏捷），伤害不附加属性
  isTech?: boolean;           // true = 奇械/枪械武器（命中使用 attackAttr 敏捷；伤害不附加属性调整）
  range: { metric: 'adjacent' } | { metric: 'grid'; max: number };
  ammo?: {
    type: string;             // '箭矢' | '弹药'
    reserve: number;          // 默认 20
    loaded: boolean;          // 初始可配置，通常 true
    reloadAction: ActionType; // 规则裁决：0动作 = bonus
  };
  properties?: string[];      // ['可投掷','重武器'] 等，v1 仅声明
}

interface ArmorCard {
  id: string;
  name: string;
  category: '轻甲' | '中甲' | '重甲' | '无';
  acBase: number;
  tags?: string[];
}
```

---

## 5. 能力卡 `ability`

### 5.1 公共结构
```ts
interface AbilityCard {
  id: string;
  name: string;
  class?: string;             // 职业或 '通用'
  style?: string;
  tier?: string;
  category: 'skill' | 'talent' | 'basic' | 'craft';
  active: boolean;            // false = 被动天赋
  cast: Cast;
  conditions: AbilityCondition[];
  targeting?: Targeting;      // passive 可省略
  movement?: ChargeMovement;  // 技能自带位移（短剑断奏等）
  resolution?: Resolution;
  effects: EffectStep[];      // 无条件/命中前效果
  passives?: PassiveEffect[];
  damageTypeChoice?: string[]; // 毒刃：玩家自选伤害类型
  reactiveUse?: ReactiveUse;   // 抛沙低血量回合外使用
  levelScaling?: LevelScaling[];
  aiHints?: { intent?: string; priority?: number };
  display: {
    description: string;      // 原规则文本，仅展示
    keywords: string[];
    source: string;           // 例如 '职业页/数据/游荡者.json#r-skill-39'
    reviewStatus: 'draft' | 'reviewed' | 'notImplemented';
  };
}
```

### 5.2 施展信息
```ts
interface Cast {
  action: ActionType;
  fp: string | null;          // 表达式；'-' 表示无消耗
  duration: 'instant' | '1轮' | '整场' | string;
  usage: Usage;
  keywords: string[];
  consumeAmmo?: boolean;      // 迅捷连射/震慑射击等
  repeatCost?: 'doublePerUseSameTurn'; // 疾跑
}
```

### 5.3 施展条件
```ts
type AbilityCondition =
  | { kind: 'equipped'; any?: string[]; all?: string[] }       // 武器/物品标签或分类
  | { kind: 'hasStatus'; target: 'self' | 'target'; name: string }
  | { kind: 'lacksStatus'; target: 'self' | 'target'; name: string }
  | { kind: 'notAdjacentToTarget' }
  | { kind: 'attackerAtBackOfTarget' }
  | { kind: 'firstActionThisTurn' }
  | { kind: 'resource'; resource: string; min?: string; max?: string }
  | { kind: 'hasFreeHand' }
  | { kind: 'targetTag'; tags: string[] }                      // 目标类型限制
  | { kind: 'canSpeak' }                                       // 需要言语
  | { kind: 'canGesture' }                                     // 需要手势
  | { kind: 'weaponLoaded' }                                   // 需要已装填
  | { kind: 'notImplemented'; text: string };                  // 结构化失败标记
```

### 5.3b 技能自带位移
```ts
interface ChargeMovement {
  mode: 'line8';              // 8 方向直线
  maxCost: number | string;   // 路径成本，正交1/斜向2
  destination: 'adjacentToTarget';
  triggerOpportunity: boolean;
  allowAnyTargetDirection: boolean; // 短剑断奏：目标不必在 8 方向直线上
}
```

### 5.3c 回合外触发
```ts
interface ReactiveUse {
  trigger: { event: 'hpBelowPercent'; value: number };
  usage: Usage;
  offTurn: true;
}
```

### 5.4 结算
```ts
interface Resolution {
  rolls: RollSpec[];
  branches: ResolutionBranch[];
}

interface RollSpec {
  id: string;                 // 供 branch 引用
  kind: 'attack' | 'save' | 'aoeDamageSave' | 'ability' | 'contest';
  attr?: AttrName | 'weapon' | null; // 'weapon'=使用武器卡 attackAttr；null=无属性（奇械）
  prof?: 'weapon' | 'spell' | null;
  vs?: 'AC' | number;         // attack vs AC；save 使用 dc
  dc?: number | string;
  adv?: 'normal' | 'advantage' | 'disadvantage' | 'extremeAdvantage' | 'extremeDisadvantage' | 'absoluteAdvantage' | 'absoluteDisadvantage';
  interaction?: 'playerRoll' | 'autoAnimate'; // 掷骰归属（设计 v2 §17.1）
  ignoreAdjacentDisadvantage?: boolean; // 迷惑之刃：目标相邻时不因近身敌人而劣势
  mods?: RollMod[];
  target: 'self' | 'targets' | 'allInArea' | string;
}

type RollMod =
  | { if?: string; flat?: string }                 // 条件加值
  | { if?: string; adv?: string }                  // 条件优劣势
  | { if?: string; ignoreAc?: string }             // 穿甲：如 'half' 或数字
  | { if?: string; critRange?: number | string }   // 暴击范围
  | { if?: string; ignoreAdjacentDisadvantage?: boolean }; // 条件性忽略近身劣势

interface ResolutionBranch {
  if: { roll: string; outcome: 'hit' | 'miss' | 'crit' | 'saveFail' | 'saveSuccess' | 'any' };
  effects: EffectStep[];
}
```

### 5.5 效果步骤
```ts
interface EffectStep {
  when?: string;              // 条件表达式，真才执行
  repeat?: 'once' | 'perComboPoint' | 'perLayer';
  target?: 'self' | 'target' | 'targets' | 'source' | 'randomTarget';
  op:
    | DamageOp | AoeDamageOp | HealOp | ConditionOp | MoveOp
    | GrantActionOp | ResourceOp | ModifierOp
    | CleanseOp | ShieldOp | TempHpOp
    | LoseHpOp | StatusLayersOp | ChoiceOp
    | CreateZoneOp /* P2 */ | SummonOp /* P2 */ | RandomTableOp;
}
```

### 5.6 v1 首批 op
```ts
type AoeDamageOp = {
  op: 'aoeDamage';            // 与 kind:'aoeDamageSave' 的 roll 配合
  roll: string;               // RollSpec.id
  dice: string;               // 只掷一次
  type?: string;
  flat?: string;
  adv?: 'normal' | 'advantage' | 'disadvantage';
};

type DamageOp = {
  op: 'damage';
  dice?: string;              // 武器引用或骰子表达式
  type?: string;              // 伤害类型，可 '随机'
  flat?: string;
  halfOnSave?: boolean;
  timing?: 'before' | 'after'; // 暴击口径：默认 before；仅明确“结算后”的加成为 after
  source?: 'weapon' | 'effect'; // weapon=武器基础伤害，吃双持 1.5/2.5；effect=其他效果
  critMultiplier?: number;    // 默认 2；重磅一击为 3
  rollFloor?: number;         // 骰点最低值
  adv?: 'normal' | 'advantage' | 'disadvantage'; // 伤害骰优势（如震慑射击 L6）
  ignoreResistance?: boolean;
};

type HealOp = {
  op: 'heal';
  dice?: string;
  flat?: string;
  target: 'self' | 'targets' | 'source';
};

type ConditionOp = {
  op: 'condition';
  name: string;               // StatusCard ID
  layers?: number | string;
  duration?: { scope: 'turns' | 'rounds' | 'battle'; value?: number | string };
  save?: { attr: AttrName; dc: number | string; onFailOnly?: boolean };
  target?: string;
};

type MoveOp = {
  op: 'move';
  mode: 'free' | 'push' | 'pull' | 'teleport' | 'jump' | 'dash';
  distance?: string;
  direction?: 'towardSource' | 'awayFromSource' | 'toAdjacentEmpty';
  triggerOpportunity: boolean;
  marksDash?: boolean;          // 疾跑：视为执行过全速移动
  target: 'self' | 'targets';
};

type GrantActionOp = {
  op: 'grantAction';
  action: ActionType;
  count?: number | string;
  timing: 'nextTurn' | 'immediate';
};

type ResourceOp = {
  op: 'resource';
  resource: 'fp' | 'hp' | 'comboPoints' | string;
  amount: string;
  target: 'self' | 'targets';
};

type ModifierOp = {
  op: 'modifier';
  stat: 'ac' | 'speed' | 'damage' | 'attackRoll' | 'save' | 'critRange' | 'resistance' | 'vulnerability';
  value?: string;
  multiply?: string;
  damageTypes?: string[];
  duration?: { scope: 'turns' | 'rounds' | 'battle'; value?: number | string };
  condition?: string;
};

type CleanseOp = {
  op: 'cleanse';
  names: string[] | 'all';
  target: 'self' | 'targets';
};

type ShieldOp = {
  op: 'shield';
  value: string;
  damageTypes?: string[];
  duration?: { scope: 'turns' | 'rounds' | 'battle' };
  target: 'self' | 'targets';
};

type TempHpOp = {
  op: 'tempHp';
  value: string;
  target: 'self' | 'targets';
};

type LoseHpOp = {
  op: 'loseHp';               // 直接失去生命值，不走伤害类型/抗性（流血）
  amount: string;
  target: 'self' | 'targets';
};

type StatusLayersOp = {
  op: 'statusLayers';         // 追加状态层数，负值可减少
  name: string;
  amount: string;             // 如 '1D3'、'+1'
  target: 'self' | 'targets';
};

type ChoiceOp = {
  op: 'choice';               // 结算中的玩家选择点
  prompt: string;
  options: Array<{ label: string; when?: string; effects: EffectStep[] }>;
};
```

### 5.7 等级成长
```ts
interface LevelScaling {
  minLevel: number;
  patch: {
    cast?: Partial<Cast>;
    effects?: EffectStep[];
    rollMods?: RollMod[];
    branches?: ResolutionBranch[];
    targeting?: Partial<Targeting>;
    movement?: Partial<ChargeMovement>;
    variables?: Record<string, string>; // 覆盖 @var 表达式
  };
}
```
引擎选择 `minLevel <= 当前等级` 的最大项，把 patch 合入基础卡片。

### 5.8 被动效果
```ts
interface PassiveEffect {
  event:
    | 'onAttackMiss' | 'onAttackHit' | 'onKill'
    | 'onDamaged' | 'onTurnStart' | 'onTurnEnd'
    | 'onCrit' | 'onBattleStart' | 'onMove';
  when?: string;
  effects: EffectStep[];
}
```

### 5.9 示例：背刺
```json
{
  "id": "rogue-backstab",
  "name": "背刺",
  "class": "游荡者",
  "style": "奇袭",
  "category": "skill",
  "active": true,
  "cast": {
    "action": "main",
    "fp": "1",
    "duration": "instant",
    "usage": { "scope": "unlimited", "max": 99 },
    "keywords": ["战技", "近战攻击"]
  },
  "conditions": [
    { "kind": "equipped", "any": ["匕首", "袖剑"] }
  ],
  "targeting": {
    "kind": "unit",
    "range": { "metric": "adjacent" },
    "filter": { "teams": ["enemy"], "livingOnly": true }
  },
  "resolution": {
    "rolls": [
      {
        "id": "attack",
        "kind": "attack",
        "attr": "敏捷",
        "prof": "weapon",
        "vs": "AC",
        "mods": [
          { "if": "attackerAtBackOfTarget", "flat": "2" }
        ]
      }
    ],
    "branches": [
      {
        "if": { "roll": "attack", "outcome": "hit" },
        "effects": [
          { "op": "damage", "dice": "@weapon.mainHand.dice", "flat": "@dexMod" }
        ]
      }
    ]
  },
  "levelScaling": [
    { "minLevel": 1, "patch": { "effects": [{ "op": "damage", "dice": "1D4" }] } },
    { "minLevel": 3, "patch": { "effects": [{ "op": "damage", "dice": "2D4" }] } },
    { "minLevel": 6, "patch": { "effects": [{ "op": "damage", "dice": "3D4" }] } }
  ],
  "display": {
    "description": "你对一名角色发起攻击，如果攻击过程中你位于对方的身后……",
    "keywords": ["近战攻击"],
    "source": "职业页/数据/游荡者.json#r-starting-skill-1",
    "reviewStatus": "draft"
  }
}
```

---

## 6. 状态卡 `status`

```ts
interface StatusCard {
  id: string;                 // 'bleeding' / '灼烧' 等
  name: string;
  kind: 'stacking' | 'binary' | 'wound';
  maxLayers?: number;
  initialLayers?: string;     // 首次施加时决定层数的骰子，如 '1D3'
  duration: { scope: 'turns' | 'rounds' | 'battle' | 'permanent'; value?: number | string };
  triggers: StatusTrigger[];
  modifiers?: StatusModifier[];
  movementOverride?: {
    kind: 'd4Direction';      // 致盲：每次移动动作 D4
    directions: ['N','E','S','W'];
    distance: 'speed';
    stopAtBlocker: true;
    triggerOpportunity: true;
  };
  nextActionAutoFails?: boolean; // 困惑
  canOpportunity?: boolean;      // 困惑=false
  weaponDisabled?: boolean;      // 缴械
  removal?: {
    onDamage?: boolean;
    onHeal?: boolean;
    byAction?: { action: ActionType; check?: { kind: 'ability'; attr: AttrName; dc: number } };
    onSourceMove?: boolean;
    text?: string;
  };
  display: { description: string; icon?: string; source: string };
}

type StatusTrigger = {
  event: 'onTurnStart' | 'onTurnEnd' | 'onRoundStart' | 'onRoundEnd' | 'onDamaged' | 'onApply';
  when?: string;
  effects: EffectStep[];
};

type StatusModifier = {
  stat: 'speed' | 'ac' | 'attackRoll' | 'save' | 'damageTaken' | 'damageDealt' | 'canAct' | 'canReact' | 'opportunity' | 'canTarget' | 'canMove' | 'incomingAttackRoll';
  value?: string;
  multiply?: string;
  adv?: 'advantage' | 'disadvantage' | 'extremeAdvantage' | 'extremeDisadvantage';
  target?: 'self' | 'attackers' | 'source';
  note?: string;
};
```

- 灼烧、流血、中毒的每轮伤害和额外叠加，一律写在各自状态卡的 triggers 中。
- 减速、禁锢、击倒等对移动/动作/反应的限制，用 modifiers + removal 表达。
- 状态规则是数据，不是 core 里的 if/else。

---

## 7. 怪物 AI

```ts
interface MonsterAI {
  style: 'template';
  priorities: AIActionRule[];
  fallback: 'moveToNearest' | 'hold';
}

type AIActionRule =
  | { intent: 'useAbility'; ability: string; when?: string }
  | { intent: 'attackNearest'; prefer?: 'lowestHp' | 'closest' }
  | { intent: 'moveToRange'; ability: string }
  | { intent: 'moveToNearest' }
  | { intent: 'hold' };
```

- AI 只能调用 core 提供的合法动作查询接口。
- 每个怪物必须能在无合法动作时安全 fallback。

---

## 8. 遭遇卡 `encounter`

```ts
interface EncounterCard {
  id: string;
  name: string;
  board: {
    width: number;
    height: number;
  };
  terrain: Array<{
    x: number; y: number; z?: number;
    type: 'floor' | 'blocked' | 'cover' | 'danger';
    height?: number;
    note?: string;
  }>;
  playerSpawns: Array<{ x: number; y: number; facing: Direction }>;
  monsters: Array<{
    ref: string;              // MonsterCard ID
    x: number; y: number; facing: Direction;
    displayName?: string;
  }>;
  loot?: { gold?: [number, number]; xp?: number; items?: string[] };
}
```

---

## 9. 引擎内置核心动作

以下动作不属于职业能力卡，由 core 按 help.html 直接实现：

| ID | 动作 | 规则要点 |
|---|---|---|
| `core.move` | 基础移动 | 附赠动作；预算 = 速度；可分段；斜角 2 |
| `core.dash` | 全速移动 | 主要动作；预算 = 2×速度；与基础移动/跳跃互斥 |
| `core.jump` | 跳远/跳高 | 附赠动作；距离 = 力量或敏捷调整 + 跳跃熟练 + 1 |
| `core.basicAttack` | 基础攻击 | 主要动作；使用主/副手武器；可触发背刺等修正 |
| `core.unarmedAttack` | 徒手攻击 | 按规则 | 
| `core.dodge` | 回避 | 主要动作 |
| `core.aim` | 瞄准部位 | 附赠动作 |
| `core.throw` | 投掷物品 | 主要动作 |
| `core.stabilize` | 稳定濒死角色 | 主要动作 |
| `core.extinguish` | 扑灭火焰 | 附赠动作，敏捷 DC 15 |
| `core.switchWeapon` | 切换武器/防具 | 附赠动作 |
| `core.endTurn` | 结束回合 | 无动作 |

---

## 10. 校验规则（tools/validate-data 必须执行）

1. 所有 JSON 可解析，且符合 TS 类型。
2. 所有 `ref` / `ability` / `status` / `monster` 引用可解析。
3. op 类型必须在 schema 枚举内；未知 op 直接报错。
4. 表达式解析成功，且只包含白名单函数与变量。
5. 目标与范围参数合法（不能为负、cone rings 必须为整数等）。
6. `reviewStatus: 'notImplemented'` 的能力不得出现在任何遭遇卡中。
7. 怪物卡必须带可执行的 AI fallback。
8. 每张卡片必须带 `display.source` 回溯到规则数据源。

---

## 11. 与旧数据的迁移关系

- 旧 `combat_effects_*` 只作为线索参考，不直接复用。
- 新能力卡以 `职业页/数据/游荡者.json` 为字段事实，以 `斯诺德跑团/skill_effects_游荡者.json` 为描述底稿，以 docx 原文为最终文本裁决。
- 首批只制作 `rogue-v1-inventory.md` 中标记 P0 的能力卡。
- 每张卡在 P0 阶段都由人工 review 后把 `reviewStatus` 改为 `reviewed`。

---

## 12. 待补
- `core` 实现开始后，把本文件 TS 类型落到 `snode-combat/core/types.ts`。
- P1 阶段补 `createZone`、`summon`、`randomTable` 的完整 schema。
