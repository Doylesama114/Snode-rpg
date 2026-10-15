/**
 * 战斗核心基础类型。
 * 设计来源：《战斗系统设计v2.md》与 docs/rule-decisions.md。
 */

export type AttrName =
  | '力量'
  | '敏捷'
  | '体质'
  | '智力'
  | '感知'
  | '魅力'
  | '意志'
  | '幸运';

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type ActionType = 'main' | 'bonus' | 'reaction' | 'free' | 'none';

export type DistanceMetric = 'grid' | 'adjacent' | 'combat';

export type Team = 'player' | 'enemy';

/** 掷骰归属：player=等待玩家点击；auto=自动动画展示结果。 */
export type RollOwner = 'player' | 'auto';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Position extends Vec2 {
  z?: number;
}

export interface DirectionVector {
  dir: Direction;
  dx: number;
  dy: number;
}

export interface WeaponData {
  id?: string;
  name?: string;
  category?: string;
  tags?: string[];
  hands?: 1 | 2;
  dice?: string;
  damageType?: string;
  attackAttr?: AttrName | null; // 命中/伤害所需属性；枪械命中也使用 attackAttr，伤害不附加
  isTech?: boolean; // 奇械/枪械：命中加敏捷调整，伤害不附加属性
  rangeMetric?: 'adjacent' | 'grid';
  rangeMax?: number;
  ammoType?: string;
  appliedPoisons?: string[];
  /** 暗影之刃附魔：武器伤害类型改为暗影，武器伤害骰最低3。 */
  shadowBlade?: boolean;
}

export interface UnitCard {
  id: string;
  name: string;
  kind: 'player' | 'monster';
  class?: string;
  level?: number;
  size?: 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  creatureType?: string;
  height?: number;
  attrs: Record<AttrName, number>;
  hpMax: number;
  fpMax: number;
  ac: number;
  speed: number;
  initiative?: { mode: 'roll' | 'fixed'; value?: number; bonusExpr?: string };
  proficiency?: number;
  keyAttr?: AttrName;
  weaponProfs?: Record<string, number>;
  weapon?: WeaponData;
  offhand?: WeaponData;
  armorCategory?: '无' | '轻甲' | '中甲' | '重甲';
  resources?: {
    comboPointsMax?: number;
    ammo?: Record<string, { reserve: number; loaded: boolean }>;
  };
  inventoryTags?: string[];
  tags?: string[];
  /** 熟练项：key=熟练项名，value=熟练等级。 */
  skillProfs?: Record<string, number>;
  /** 拥有豁免熟练的属性名列表（蝶舞等“拥有X豁免值”判定）。 */
  saveProfs?: AttrName[];
}

export interface DicePart {
  kind: 'dice' | 'flat' | 'variable';
  label: string;
  values?: number[];
  /** D3 等映射骰：记录原始骰值（如 D6 结果） */
  mappedValues?: number[];
  value: number;
  owner?: RollOwner;
}

export interface DiceEval {
  total: number;
  parts: DicePart[];
}

export interface ExpressionContext {
  rng: { next(): number; die(sides: number): number };
  variables: Record<string, number>;
  owner?: RollOwner;
  /** 每个骰子的最低点数（刺骨 L5/L10 等）。 */
  diceFloor?: number;
}

export interface ActionBudget {
  main: boolean;
  bonus: boolean;
  reactionUsed: number;
  reactionMax: number;
}

export const ATTR_NAMES: AttrName[] = [
  '力量',
  '敏捷',
  '体质',
  '智力',
  '感知',
  '魅力',
  '意志',
  '幸运',
];
