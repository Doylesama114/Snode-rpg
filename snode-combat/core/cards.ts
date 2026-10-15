/**
 * 数据卡 JSON 的 core 侧类型定义。
 * 与 docs/data-schema.md 对应；实现期只保留 core 需要的字段。
 */
import type { AttrName, Team, WeaponData } from './types';

export interface MonsterCardData {
  id: string;
  kind: 'monster';
  name: string;
  size?: 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  creatureType?: string;
  height?: number;
  attrs: Record<AttrName, number>;
  hpMax: number;
  fpMax: number;
  ac: number;
  speed: number;
  initiative: { mode: 'fixed'; value: number };
  proficiency: number;
  equipment?: { mainHand?: WeaponData; offHand?: WeaponData };
  abilities?: string[];
  ai?: unknown;
  tags?: string[];
  drops?: unknown;
  skillProfs?: Record<string, number>;
  saveProfs?: import('./types').AttrName[];
}

export interface TerrainCellData {
  x: number;
  y: number;
  z?: number;
  type: 'floor' | 'blocked' | 'cover' | 'danger';
  height?: number;
  note?: string;
}

export interface EncounterCardData {
  id: string;
  name: string;
  board: { width: number; height: number };
  terrain?: TerrainCellData[];
  playerSpawns: Array<{ x: number; y: number; facing: import('./types').Direction }>;
  monsters: Array<{
    ref: string;
    x: number;
    y: number;
    facing: import('./types').Direction;
    displayName?: string;
  }>;
  loot?: unknown;
}

export interface StatusCardData {
  id: string;
  name: string;
  kind: 'stacking' | 'binary' | 'wound';
  maxLayers?: number;
  initialLayers?: string;
  /** 帮助页状态分类：dot/soft_cc/mind_control/hard_cc/debuff；用于专注中断等判定。 */
  category?: string;
  duration: { scope: string; value?: number | string };
  triggers?: Array<{ event: string; when?: string; effects: unknown[] }>;
  modifiers?: unknown[];
  movementOverride?: unknown;
  nextActionAutoFails?: boolean;
  canOpportunity?: boolean;
  weaponDisabled?: boolean;
  removal?: unknown;
  display?: { description?: string; icon?: string; source?: string };
}

export interface AbilityCardData {
  id: string;
  name: string;
  class?: string;
  style?: string;
  tier?: string;
  category?: 'skill' | 'talent' | 'basic' | 'craft';
  active?: boolean;
  cast?: {
    action?: string;
    fp?: string | null;
    duration?: string;
    usage?: { scope?: string; max?: number | string };
    keywords?: string[];
    consumeAmmo?: boolean;
    repeatCost?: string;
  };
  conditions?: unknown[];
  targeting?: unknown;
  movement?: unknown;
  resolution?: unknown;
  effects?: unknown[];
  afterEffects?: unknown[];
  passives?: unknown[];
  damageTypeChoice?: string[];
  reactiveUse?: unknown;
  levelScaling?: unknown[];
  display?: { description?: string; keywords?: string[]; source?: string; reviewStatus?: string };
}

export interface PlayerCardInput {
  id: string;
  name: string;
  class?: string;
  level?: number;
  size?: 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  creatureType?: string;
  attrs: Record<AttrName, number>;
  hpMax: number;
  fpMax: number;
  ac: number;
  speed: number;
  keyAttr: AttrName;
  proficiency: number;
  weaponProfs: Record<string, number>;
  weapon: WeaponData;
  offhand?: WeaponData;
  team?: Team;
  inventoryTags?: string[];
  skillProfs?: Record<string, number>;
  saveProfs?: import('./types').AttrName[];
}

export type CardKind = 'ability' | 'status' | 'monster' | 'encounter';
