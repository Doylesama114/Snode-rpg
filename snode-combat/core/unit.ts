import type { ActionBudget, AttrName, Direction, Team, UnitCard, WeaponData } from './types';
import { expectedDiceValue } from './expression';
import { ATTR_NAMES } from './types';

export interface AmmoState {
  type: string;
  reserve: number;
  loaded: boolean;
}

export interface UnitInstanceOptions {
  id?: string;
  name?: string;
  kind?: 'player' | 'monster';
  team: Team;
  x?: number;
  y?: number;
  z?: number;
  facing?: Direction;
  card?: UnitCard;
}

/**
 * 战斗单位实例：由单位卡创建，包含本场战斗可变状态。
 * 规则来源：rule-decisions.md。
 */
export class UnitInstance {
  readonly id: string;
  readonly name: string;
  readonly kind: 'player' | 'monster';
  readonly team: Team;
  readonly card: UnitCard;
  readonly inventoryTags: string[];
  readonly skillProfs: Record<string, number>;
  readonly saveProfs: string[];
  readonly size: 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  readonly creatureType: string;
  armorCategory: '无' | '轻甲' | '中甲' | '重甲';
  readonly anticipateTargetIds: Set<string> = new Set();
  daringActive = false;
  /** 潜行状态：视觉层面隐身；攻击/全速移动解除。 */
  stealthed = false;
  /** 每名单位自身回合序号，用于“以施展者回合计”的持续轮数。 */
  turnSerial = 0;

  x: number;
  y: number;
  z: number;
  facing: Direction;

  attrs: Record<AttrName, number>;
  hpMax: number;
  fpMax: number;
  hp: number;
  fp: number;
  ac: number;
  baseSpeed: number;
  height: number;
  proficiency: number;
  keyAttr: AttrName;
  weaponProfs: Record<string, number>;

  weapon: WeaponData | null;
  offhand: WeaponData | null;

  comboPoints: number;
  readonly comboPointsMax: number;

  ammo: Map<string, AmmoState>;

  readonly conditionLayers: Map<string, number>;
  /** 临时状态：目标回合结束时移除。 */
  readonly temporaryConditions: Set<string> = new Set();
  /** 状态持续时间：施展者自身回合序号 + N。 */
  readonly conditionDurations = new Map<string, { ownerId: string; serial: number }>();
  /** 状态来源单位（魅惑等需要朝来源移动）。 */
  readonly conditionSources = new Map<string, string>();
  /** 通用标记：死亡印记、落单、剑炮标记、嫁祸影响等。 */
  readonly marks = new Map<string, number>();
  /** 首次驱散不解除的标记护盾（死亡印记L10）。 */
  readonly shieldedMarks = new Set<string>();
  /** 能力使用次数：key = `${abilityId}:${scope}` */
  readonly usageCounts: Map<string, number> = new Map();
  /** 动态修正（暗影护甲等） */
  acBonus = 0;
  acCap: number | null = null;
  acReduction = 0;
  readonly resistances = new Map<string, number>();
  readonly saveDcPenalties = new Map<string, number>();
  readonly vulnerabilities = new Map<string, number>();

  actions: ActionBudget;
  /** 额外主要动作数（伺机待发等），优先级高于基础主要动作。 */
  extraMainActions = 0;
  initiative: { mode: 'roll' | 'fixed'; value?: number; bonusExpr?: string };

  /** 当前回合移动预算（步数）；多个全速移动可叠加。 */
  moveBudget = 0;
  moveMode: 'basic' | 'dash' | null = null;
  dashUsedThisTurn = false;

  constructor(card: UnitCard, opts: UnitInstanceOptions) {
    this.card = card;
    this.id = opts.id ?? card.id;
    this.name = opts.name ?? card.name;
    this.kind = card.kind;
    this.team = opts.team;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.z = opts.z ?? 0;
    this.facing = opts.facing ?? 'N';

    this.attrs = { ...card.attrs };
    this.hpMax = card.hpMax;
    this.fpMax = card.fpMax;
    this.hp = card.hpMax;
    this.fp = card.fpMax;
    this.ac = card.ac;
    this.baseSpeed = card.speed;
    this.height = card.height ?? 1;
    this.proficiency = card.proficiency ?? 2;
    this.keyAttr = card.keyAttr ?? '敏捷';
    this.weaponProfs = { ...(card.weaponProfs ?? {}) };
    this.skillProfs = { ...(card.skillProfs ?? {}) };
    this.saveProfs = [...(card.saveProfs ?? [])];
    this.size = card.size ?? 'medium';
    this.creatureType = card.creatureType ?? '类人';

    this.weapon = card.weapon ?? null;
    this.offhand = card.offhand ?? null;

    this.comboPoints = 0;
    this.comboPointsMax = card.resources?.comboPointsMax ?? 5;

    this.inventoryTags = [...(card.inventoryTags ?? [])];
    this.armorCategory = this.card.armorCategory ?? '无';

    this.ammo = new Map<string, AmmoState>();
    const ammoConfig = card.resources?.ammo ?? {};
    for (const [type, state] of Object.entries(ammoConfig)) {
      this.ammo.set(type, { type, ...state });
    }

    this.conditionLayers = new Map<string, number>();
    this.actions = {
      main: false,
      bonus: false,
      reactionUsed: 0,
      reactionMax: 3,
    };
    this.initiative = {
      mode: card.initiative?.mode ?? 'fixed',
      value: card.initiative?.value,
      bonusExpr: card.initiative?.bonusExpr,
    };
  }

  attrValue(attr: AttrName): number {
    return this.attrs[attr] ?? 10;
  }

  attrMod(attr: AttrName): number {
    return Math.floor((this.attrValue(attr) - 10) / 2);
  }

  /** 当前有效移动力：减速向下取整减半；其他修正后续接入。 */
  effectiveSpeed(): number {
    let speed = this.baseSpeed;
    if (this.hasCondition('slowed')) {
      speed = Math.floor(speed * 0.5);
    }
    return speed;
  }

  /** 当前持有武器要求的属性调整值，用于伤害/非枪械命中；奇械枪械的伤害不附加属性。 */
  weaponAttackMod(weapon: WeaponData | null = this.weapon): number {
    if (!weapon || weapon.isTech || !weapon.attackAttr) return 0;
    return this.attrMod(weapon.attackAttr);
  }

  /** 武器命中属性调整值；枪械（isTech）同样使用 attackAttr（通常为敏捷）。 */
  weaponHitMod(weapon: WeaponData | null = this.weapon): number {
    if (!weapon || !weapon.attackAttr) return 0;
    return this.attrMod(weapon.attackAttr);
  }

  weaponProfBonus(weapon: WeaponData | null = this.weapon): number {
    if (!weapon) return 0;
    const keys = [weapon.id, weapon.name, weapon.category, ...(weapon.tags ?? [])].filter(
      (k): k is string => typeof k === 'string',
    );
    for (const key of keys) {
      const value = this.weaponProfs[key];
      if (typeof value === 'number' && value > 0) return value;
    }
    return 0;
  }

  hasWeaponProf(weapon: WeaponData | null = this.weapon): boolean {
    return this.weaponProfBonus(weapon) > 0;
  }

  hasSaveProf(attr: AttrName): boolean {
    return this.saveProfs.includes(attr);
  }

  skillBonus(skill: string): number {
    return this.skillProfs[skill] ?? 0;
  }

  hasSkillProf(skill: string): boolean {
    return this.skillBonus(skill) > 0;
  }

  /** 专注熟练项检定：D12 +（熟练时 D8）+ 体质调整。成功要求结果 >15。 */
  concentrationCheck(rng: { die(sides: number): number }): { total: number; d12: number; d8: number | null; success: boolean } {
    const d12 = rng.die(12);
    const d8 = this.hasSkillProf('专注') ? rng.die(8) : null;
    const total = d12 + (d8 ?? 0) + this.attrMod('体质');
    return { total, d12, d8, success: total > 15 };
  }

  /** 双手均为近战武器时才构成双持（远程武器不享受双持加成）。 */
  isDualWieldingMelee(): boolean {
    return !!this.weapon && !!this.offhand
      && this.weapon.rangeMetric !== 'grid'
      && this.offhand.rangeMetric !== 'grid';
  }

  /** 双持时取期望伤害较低的那把武器；同期望取主手。 */
  dualWieldWeapon(): WeaponData | null {
    if (!this.isDualWieldingMelee()) return null;
    const main = this.weapon as WeaponData;
    const off = this.offhand as WeaponData;
    const mainExpected = expectedDiceValue(main.dice ?? '0');
    const offExpected = expectedDiceValue(off.dice ?? '0');
    return offExpected < mainExpected ? off : main;
  }

  hasInventoryTag(tag: string): boolean {
    return this.inventoryTags.includes(tag);
  }

  hasCondition(id: string): boolean {
    return (this.conditionLayers.get(id) ?? 0) > 0;
  }

  conditionLayersOf(id: string): number {
    return this.conditionLayers.get(id) ?? 0;
  }

  addCondition(
    id: string,
    layers = 1,
    maxLayers = 99,
    opts: { temporary?: boolean; durationTurns?: number; ownerId?: string; ownerSerial?: number } = {},
  ): void {
    const next = Math.min(maxLayers, this.conditionLayersOf(id) + layers);
    this.conditionLayers.set(id, Math.max(0, next));
    if (opts.temporary) this.temporaryConditions.add(id);
    if (opts.ownerId) this.conditionSources.set(id, opts.ownerId);
    if (opts.durationTurns !== undefined) {
      this.conditionDurations.set(id, {
        ownerId: opts.ownerId ?? this.id,
        serial: (opts.ownerSerial ?? this.turnSerial) + Math.max(0, opts.durationTurns),
      });
    } else {
      this.conditionDurations.delete(id);
    }
  }

  addTemporaryCondition(id: string, layers = 1, maxLayers = 99): void {
    this.addCondition(id, layers, maxLayers, { temporary: true });
  }

  removeCondition(id: string): boolean {
    this.temporaryConditions.delete(id);
    this.conditionDurations.delete(id);
    this.conditionSources.delete(id);
    return this.conditionLayers.delete(id);
  }

  /** 目标自身回合结束时：移除临时状态。 */
  removeTemporaryConditionsOnTurnEnd(): void {
    for (const id of this.temporaryConditions) {
      this.conditionLayers.delete(id);
      this.conditionDurations.delete(id);
      this.conditionSources.delete(id);
    }
    this.temporaryConditions.clear();
    this.saveDcPenalties.clear();
  }

  /** 驱散标记：若带护盾则只消耗护盾，否则移除标记。 */
  dispelMark(name: string): boolean {
    if (this.shieldedMarks.has(name)) {
      this.shieldedMarks.delete(name);
      return false;
    }
    return this.marks.delete(name);
  }

  removeConditionLayers(id: string, layers: number): void {
    const next = Math.max(0, this.conditionLayersOf(id) - layers);
    if (next === 0) this.removeCondition(id);
    else this.conditionLayers.set(id, next);
  }

  /** 伤害：扣 HP，最低 0。返回实际扣除值。 */
  applyDamage(amount: number): number {
    if (amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    // 帮助页：部分状态受到伤害立即解除。
    for (const id of ['unconscious', 'charmed', 'feared', 'chaotic', 'confused']) {
      if (this.hasCondition(id)) this.removeCondition(id);
    }
    return before - this.hp;
  }

  /** 直接失去生命值（流血）：绕过伤害类型/抗性。 */
  loseHp(amount: number): number {
    return this.applyDamage(amount);
  }

  heal(amount: number): number {
    if (amount <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.hpMax, this.hp + amount);
    return this.hp - before;
  }

  gainCombo(amount = 1): number {
    const gained = Math.max(0, Math.min(this.comboPointsMax - this.comboPoints, amount));
    this.comboPoints += gained;
    return gained;
  }

  spendCombo(amount: number): number {
    const spent = Math.max(0, Math.min(this.comboPoints, amount));
    this.comboPoints -= spent;
    return spent;
  }

  spendAllCombo(): number {
    const spent = this.comboPoints;
    this.comboPoints = 0;
    return spent;
  }

  /** 消耗一发已装填弹药并进入未装填状态。 */
  consumeLoadedAmmo(ammoType: string): boolean {
    const state = this.ammo.get(ammoType);
    if (!state || state.reserve <= 0 || !state.loaded) return false;
    state.loaded = false;
    state.reserve -= 1;
    return true;
  }

  reload(ammoType: string): boolean {
    const state = this.ammo.get(ammoType);
    if (!state || state.loaded || state.reserve <= 0) return false;
    state.loaded = true;
    return true;
  }

  resetTurnActions(): void {
    this.extraMainActions = 0;
    this.actions.main = true;
    this.actions.bonus = true;
    this.moveBudget = 0;
    this.moveMode = null;
    this.dashUsedThisTurn = false;
  }

  /** 获得一段移动预算。dash 会标记本回合已全速移动。 */
  grantMove(mode: 'basic' | 'dash', budget: number): number {
    if (budget <= 0) return 0;
    this.moveBudget += Math.floor(budget);
    this.moveMode = mode === 'dash' ? 'dash' : (this.moveMode ?? mode);
    if (mode === 'dash') this.dashUsedThisTurn = true;
    return Math.floor(budget);
  }

  consumeMoveBudget(amount: number): number {
    const used = Math.max(0, Math.min(this.moveBudget, amount));
    this.moveBudget -= used;
    return used;
  }

  /** 基础移动：消耗附赠动作，获得当前速度的移动预算。已全速移动时不可用。 */
  activateBasicMove(): boolean {
    if (this.dashUsedThisTurn || this.moveMode === 'dash') return false;
    if (!this.useAction('bonus')) return false;
    this.grantMove('basic', this.effectiveSpeed());
    return true;
  }

  /** 全速移动：消耗主要动作，获得 2×速度的移动预算。疾跑后仍可再次全速。 */
  activateDashMove(): boolean {
    if (this.moveMode === 'basic') return false;
    if (!this.useAction('main')) return false;
    this.grantMove('dash', this.effectiveSpeed() * 2);
    return true;
  }

  resetReactions(): void {
    this.actions.reactionUsed = 0;
  }

  canUseAction(action: 'main' | 'bonus' | 'reaction'): boolean {
    if (action === 'reaction') return this.actions.reactionUsed < this.actions.reactionMax;
    if (action === 'main') return this.actions.main || this.extraMainActions > 0;
    return this.actions[action];
  }

  useAction(action: 'main' | 'bonus' | 'reaction'): boolean {
    if (!this.canUseAction(action)) return false;
    if (action === 'reaction') {
      this.actions.reactionUsed += 1;
    } else if (action === 'main') {
      if (this.extraMainActions > 0) this.extraMainActions -= 1;
      else this.actions.main = false;
    } else {
      this.actions[action] = false;
    }
    return true;
  }

  /** 自身回合开始：推进持续轮数计时；移除到期的（施展者为本单位）状态。 */
  beginOwnTurn(): void {
    this.turnSerial += 1;
    for (const [id, expiry] of [...this.conditionDurations]) {
      if (expiry.ownerId === this.id && this.turnSerial >= expiry.serial) {
        this.removeCondition(id);
      }
    }
  }

  /** 是否处于失能/惑控等无法行动状态（P2 阶段用）。 */
  isIncapacitated(): boolean {
    return this.hasCondition('unconscious')
      || this.hasCondition('paralyzed')
      || this.hasCondition('stunned')
      || this.hasCondition('charmed');
  }

  /** 是否处于惑控或失能（帮助页：进入这些状态会中断专注）。 */
  isControlOrIncapacitated(): boolean {
    return this.hasCondition('charmed')
      || this.hasCondition('feared')
      || this.hasCondition('chaotic')
      || this.hasCondition('confused')
      || this.hasCondition('unconscious')
      || this.hasCondition('paralyzed')
      || this.hasCondition('stunned');
  }

  sizeRank(): number {
    const ranks = ['small', 'medium', 'large', 'huge', 'gargantuan'] as const;
    return Math.max(0, ranks.indexOf(this.size));
  }

  /** 目标体型超过施法者两个规格或以上（闷棍豁免条款）。 */
  isTwoSizesLargerThan(other: UnitInstance): boolean {
    return this.sizeRank() >= other.sizeRank() + 2;
  }

  /** 战斗开始初始化。 */
  effectiveAc(): number {
    let ac = this.ac + this.acBonus - this.acReduction;
    if (this.acCap !== null) ac = Math.min(ac, this.acCap);
    return Math.max(0, ac);
  }

  getUsage(key: string): number {
    return this.usageCounts.get(key) ?? 0;
  }

  canUseUsage(key: string, max: number): boolean {
    return max === 99 || this.getUsage(key) < max;
  }

  spendUsage(key: string): void {
    this.usageCounts.set(key, this.getUsage(key) + 1);
  }

  resetUsageScope(scope: string, abilityId?: string): void {
    for (const key of [...this.usageCounts.keys()]) {
      if (abilityId ? key === `${abilityId}:${scope}` : key.endsWith(`:${scope}`)) {
        this.usageCounts.delete(key);
      }
    }
  }

  resetForBattle(): void {
    this.hp = this.hpMax;
    this.fp = this.fpMax;
    this.comboPoints = 0;
    this.conditionLayers.clear();
    this.temporaryConditions.clear();
    this.usageCounts.clear();
    this.acBonus = 0;
    this.acCap = null;
    this.acReduction = 0;
    this.armorCategory = this.card.armorCategory ?? '无';
    this.resistances.clear();
    this.vulnerabilities.clear();
    this.saveDcPenalties.clear();
    this.anticipateTargetIds.clear();
    this.daringActive = false;
    this.stealthed = false;
    this.turnSerial = 0;
    this.conditionDurations.clear();
    this.conditionSources.clear();
    this.marks.clear();
    this.shieldedMarks.clear();
    this.actions = { main: false, bonus: false, reactionUsed: 0, reactionMax: 3 };
    this.extraMainActions = 0;
    this.moveBudget = 0;
    this.moveMode = null;
    this.dashUsedThisTurn = false;
  }
}

/** 属性值合法性检查（导入角色卡时使用）。 */
export function normalizeAttrs(attrs: Partial<Record<AttrName, number>>): Record<AttrName, number> {
  const out = {} as Record<AttrName, number>;
  for (const attr of ATTR_NAMES) {
    out[attr] = attrs[attr] ?? 10;
  }
  return out;
}
