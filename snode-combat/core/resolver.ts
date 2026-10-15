/**
 * 技能结算器（P0 首批）。
 * 只解释 P0 能力卡中出现的规则结构；所有掷骰记录 owner（player/auto）。
 */
import type { AbilityCardData, StatusCardData } from './cards';
import type {
  AttrName,
  DiceEval,
  Direction,
  ExpressionContext,
  RollOwner,
  Team,
  Vec2,
  WeaponData,
} from './types';
import type { UnitInstance } from './unit';
import type { Board } from './board';
import type { Encounter } from './encounter';
import { DIRECTIONS_8, isMeleeAdjacent, rayAimsAtCell, backCell, coneCells, combatDistance, gridDistance } from './geometry';
import { evaluateExpression } from './expression';
import { mapActionText } from './action-economy';
import { triggerWeaponPoisons, type PoisonCardData } from './poisons';

// ---------- 卡片解析 ----------

export type ParsedTargeting =
  | { kind: 'self' }
  | { kind: 'unit'; range: { metric: 'adjacent' } | { metric: 'grid'; max: number }; filter: ParsedFilter }
  | { kind: 'area'; shape: 'cone'; rings: number; filter: ParsedFilter }
  | { kind: 'area'; shape: 'radius'; radius: number; metric: 'grid'; filter: ParsedFilter }
  | { kind: 'area'; shape: 'adjacent'; filter: ParsedFilter };

export interface ParsedFilter {
  teams: Team[];
  livingOnly: boolean;
  facingSource?: boolean;
}

export interface ParsedCast {
  action: string;
  fp: string | null;
  consumeAmmo: boolean;
  keywords: string[];
}

export type ParsedRollSpec = {
  id: string;
  kind: 'attack' | 'save' | 'aoeDamageSave' | 'armorCheck';
  attr?: AttrName | 'weapon' | null;
  prof?: 'weapon' | 'spell' | null;
  vs?: 'AC' | number;
  dc?: number | string;
  target: 'self' | 'targets' | 'allInArea';
  when?: string;
  /** 优势/劣势；极大优势/劣势用 advDice=3，绝对=4。 */
  adv?: 'advantage' | 'disadvantage';
  advDice?: number;
  /** 拥有对应属性豁免熟练时自动成功（蝶舞）。 */
  autoSuccessIfProf?: boolean;
  mods?: Array<{ if?: string; flat?: string; ignoreAdjacentDisadvantage?: boolean; ignoreAc?: string; guaranteedCrit?: boolean; critRange?: string }>;
};

export interface ParsedBranch {
  roll: string;
  outcome: 'hit' | 'miss' | 'crit' | 'saveFail' | 'saveSuccess' | 'saveCriticalFail' | 'saveCriticalSuccess' | 'any';
  effects: unknown[];
}

export interface ParsedChargeMovement {
  mode: 'line8' | 'teleport';
  maxCost?: number;
  destination: 'adjacentToTarget';
  triggerOpportunity: boolean;
  allowAnyTargetDirection: boolean;
}

export interface ParsedAbility {
  card: AbilityCardData;
  cast: ParsedCast;
  conditions: unknown[];
  targeting: ParsedTargeting;
  movement?: ParsedChargeMovement;
  rolls: ParsedRollSpec[];
  branches: ParsedBranch[];
  effects: unknown[];
  afterEffects: unknown[];
  damageTypeChoice?: string[];
  scalingVariables: Record<string, string>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseTargeting(value: unknown): ParsedTargeting {
  const t = asRecord(value);
  if (!t) throw new Error('能力卡缺少 targeting');
  const kind = asString(t.kind);
  const filter = parseFilter(t.filter);
  if (kind === 'self') return { kind: 'self' };
  if (kind === 'unit') {
    const range = asRecord(t.range);
    const metric = asString(range?.metric);
    if (metric === 'adjacent') return { kind: 'unit', range: { metric: 'adjacent' }, filter };
    if (metric === 'grid') {
      const max = range?.max;
      if (typeof max !== 'number') throw new Error('grid 射程缺少 max');
      return { kind: 'unit', range: { metric: 'grid', max }, filter };
    }
    throw new Error(`未知射程 metric: ${metric}`);
  }
  if (kind === 'area') {
    const area = asRecord(t.area);
    if (area?.shape === 'cone' && typeof area.rings === 'number') {
      return { kind: 'area', shape: 'cone', rings: area.rings, filter };
    }
    if (area?.shape === 'radius' && typeof area.radius === 'number') {
      return { kind: 'area', shape: 'radius', radius: area.radius, metric: 'grid', filter };
    }
    if (area?.shape === 'adjacent') {
      return { kind: 'area', shape: 'adjacent', filter };
    }
    throw new Error('当前只支持 cone/radius/adjacent area');
  }
  throw new Error(`未知 targeting.kind: ${kind}`);
}

function parseFilter(value: unknown): ParsedFilter {
  const f = asRecord(value) ?? {};
  const teams = Array.isArray(f.teams) ? (f.teams as Team[]) : [];
  return {
    teams,
    livingOnly: f.livingOnly !== false,
    facingSource: f.facingSource === true,
  };
}

function parseMovement(value: unknown): ParsedChargeMovement | undefined {
  const m = asRecord(value);
  if (!m || (m.mode !== 'line8' && m.mode !== 'teleport')) return undefined;
  return {
    mode: m.mode,
    maxCost: typeof m.maxCost === 'number' ? m.maxCost : undefined,
    destination: asString(m.destination) === 'adjacentToTarget' ? 'adjacentToTarget' : 'adjacentToTarget',
    triggerOpportunity: m.triggerOpportunity !== false,
    allowAnyTargetDirection: m.allowAnyTargetDirection === true,
  };
}

function parseCast(value: unknown): ParsedCast {
  const c = asRecord(value) ?? {};
  return {
    action: asString(c.action) ?? 'none',
    fp: c.fp == null ? null : asString(c.fp),
    consumeAmmo: c.consumeAmmo === true,
    keywords: Array.isArray(c.keywords) ? (c.keywords as string[]) : [],
  };
}

function parseRolls(value: unknown): ParsedRollSpec[] {
  const r = asRecord(value);
  const rolls = Array.isArray(r?.rolls) ? r.rolls : [];
  return rolls.map((item) => {
    const spec = asRecord(item);
    if (!spec) throw new Error('roll 结构非法');
    const kind = asString(spec.kind);
    if (kind !== 'attack' && kind !== 'save' && kind !== 'aoeDamageSave' && kind !== 'armorCheck') {
      throw new Error(`未知 roll kind: ${kind}`);
    }
    const attrRaw = spec.attr;
    let attr: ParsedRollSpec['attr'] = null;
    if (attrRaw === 'weapon') attr = 'weapon';
    else if (typeof attrRaw === 'string') attr = attrRaw as AttrName;
    return {
      id: asString(spec.id) ?? `${kind}`,
      kind,
      attr,
      prof: spec.prof === 'weapon' || spec.prof === 'spell' ? spec.prof : null,
      vs: spec.vs === 'AC' ? 'AC' : typeof spec.vs === 'number' ? spec.vs : undefined,
      dc: typeof spec.dc === 'number' || typeof spec.dc === 'string' ? spec.dc : undefined,
      target: asString(spec.target) === 'self' || asString(spec.target) === 'allInArea' ? (spec.target as 'self' | 'allInArea') : 'targets',
      when: asString(spec.when) ?? undefined,
      adv: spec.adv === 'advantage' || spec.adv === 'disadvantage' ? spec.adv : undefined,
      advDice: typeof spec.advDice === 'number' ? Math.max(2, Math.min(4, spec.advDice)) : undefined,
      autoSuccessIfProf: spec.autoSuccessIfProf === true,
      mods: Array.isArray(spec.mods)
        ? (spec.mods as Array<Record<string, unknown>>).map((m) => ({
            if: asString(m.if) ?? undefined,
            flat: asString(m.flat) ?? undefined,
            ignoreAdjacentDisadvantage: m.ignoreAdjacentDisadvantage === true,
            ignoreAc: asString(m.ignoreAc) ?? undefined,
            guaranteedCrit: m.guaranteedCrit === true,
            critRange: asString(m.critRange) ?? undefined,
          }))
        : [],
    };
  });
}

function parseBranches(value: unknown): ParsedBranch[] {
  const r = asRecord(value);
  const branches = Array.isArray(r?.branches) ? r.branches : [];
  return branches.map((item) => {
    const b = asRecord(item);
    const ifObj = asRecord(b?.if) ?? {};
    return {
      roll: asString(ifObj.roll) ?? '',
      outcome: asString(ifObj.outcome) as ParsedBranch['outcome'],
      effects: Array.isArray(b?.effects) ? b.effects : [],
    };
  });
}

export function applyLevelScaling(card: AbilityCardData, level: number): AbilityCardData {
  const scaled = JSON.parse(JSON.stringify(card)) as AbilityCardData;
  const patches = Array.isArray(card.levelScaling) ? (card.levelScaling as Array<Record<string, unknown>>) : [];
  for (const entry of patches) {
    const minLevel = Number(entry.minLevel);
    if (!Number.isFinite(minLevel) || level < minLevel) continue;
    const patch = asRecord(entry.patch) ?? {};
    for (const key of ['cast', 'targeting', 'movement', 'effects', 'branches', 'rollMods'] as const) {
      if (patch[key] === undefined) continue;
      if (key === 'rollMods') {
        const resolution = asRecord(scaled.resolution) ?? {};
        const rolls = Array.isArray(resolution.rolls) ? resolution.rolls : [];
        const extra = Array.isArray(patch[key]) ? (patch[key] as unknown[]) : [patch[key]];
        (scaled as unknown as Record<string, unknown>).resolution = {
          ...resolution,
          rolls: rolls.map((roll) => {
            const r = asRecord(roll) ?? {};
            return { ...r, mods: [...(Array.isArray(r.mods) ? r.mods : []), ...extra] };
          }),
        };
      } else {
        (scaled as unknown as Record<string, unknown>)[key] = patch[key];
      }
    }
  }
  return scaled;
}

export function parseAbility(card: AbilityCardData, level?: number): ParsedAbility {
  const effective = level == null ? card : applyLevelScaling(card, level);
  const scalingVariables: Record<string, string> = {};
  const patches = Array.isArray(effective.levelScaling) ? (effective.levelScaling as Array<Record<string, unknown>>) : [];
  for (const entry of patches) {
    const minLevel = Number(entry.minLevel);
    if (!Number.isFinite(minLevel) || level == null || level < minLevel) continue;
    const patch = asRecord(entry.patch) ?? {};
    const vars = asRecord(patch.variables) ?? {};
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string') scalingVariables[key] = value;
    }
  }
  return {
    card: effective,
    cast: parseCast(effective.cast),
    conditions: Array.isArray(effective.conditions) ? effective.conditions : [],
    targeting: effective.targeting ? parseTargeting(effective.targeting) : { kind: 'self' as const },
    movement: parseMovement(effective.movement),
    rolls: parseRolls(effective.resolution),
    branches: parseBranches(effective.resolution),
    effects: Array.isArray(effective.effects) ? effective.effects : [],
    afterEffects: Array.isArray(effective.afterEffects) ? effective.afterEffects : [],
    damageTypeChoice: effective.damageTypeChoice,
    scalingVariables,
  };
}

// ---------- 结算事件 ----------

export interface RollEvent {
  owner: RollOwner;
  label: string;
  kind: 'attack' | 'save' | 'aoeSave' | 'damage' | 'heal' | 'status' | 'loseHp' | 'resource' | 'move';
  unitId: string;
  targetId?: string;
  expression?: string;
  parts?: DiceEval['parts'];
  total: number;
  detail?: string;
}

export interface DamageComponent {
  targetId: string;
  label: string;
  raw: number;
  kind: 'weaponBase' | 'before' | 'after';
  expression?: string;
  damageType?: string;
}

export interface ResolveOutcome {
  ok: boolean;
  reason?: string;
  events: RollEvent[];
  damageByTarget: Map<string, number>;
  appliedStatuses: Array<{ targetId: string; status: string; layers: number }>;
  killedTargetIds: string[];
  /** 命中/暴击目标（供剑炮齐奏、死亡印记、冷血杀手等 P2 被动使用）。 */
  attackHitTargetIds: string[];
  attackCritTargetIds: string[];
  /** 本次结算消耗的连击点（连击循环记录用）。 */
  consumedCombo: number;
}

export interface AbilityResolverOptions {
  rng: { next(): number; die(sides: number): number };
  statusCatalog?: Map<string, StatusCardData>;
  choose?: (prompt: string, options: string[], ctx: ResolutionSession) => number;
  /** 覆盖卡片中的玩家伤害类型选择；不提供时取第 1 项。 */
  damageTypeChoice?: string;
  /** 技能位移有多个合法落点时由 UI/玩家选择；默认取第 1 个。 */
  chooseDestination?: (candidates: Vec2[], prompt: string) => number;
  poisonCatalog?: Map<string, PoisonCardData>;
  skipActionCost?: boolean;
  /** 通用“命中后、结算伤害/附带效果前”取消钩子（示敌以弱等反应）。返回 true 则跳过该目标本分支效果。 */
  cancelHitEffects?: (source: UnitInstance, target: UnitInstance, ability: ParsedAbility) => boolean;
}

// ---------- 结算会话 ----------

export interface AttackRollResult {
  target: UnitInstance;
  d20: number;
  values: number[];
  total: number;
  hit: boolean;
  crit: boolean;
  fumble: boolean;
}

export interface SaveRollResult {
  target: UnitInstance;
  d20: number;
  total: number;
  success: boolean;
  critSuccess: boolean;
  critFail: boolean;
}

export interface AoeSaveResult extends SaveRollResult {
  multiplier: 0 | 0.5 | 1 | 2;
}

export class ResolutionSession {
  readonly source: UnitInstance;
  readonly targets: UnitInstance[];
  readonly ability: ParsedAbility;
  readonly rng: { next(): number; die(sides: number): number };
  readonly statusCatalog: Map<string, StatusCardData>;
  readonly choose: (prompt: string, options: string[], ctx: ResolutionSession) => number;
  readonly damageTypeChoice?: string;

  events: RollEvent[] = [];
  damageByTarget = new Map<string, number>();
  appliedStatuses: Array<{ targetId: string; status: string; layers: number }> = [];
  variables: Record<string, number> = {};
  consumedResource = 0;
  chosenDamageType: string | null = null;
  rollResults = new Map<string, Array<AttackRollResult | SaveRollResult | AoeSaveResult>>();
  aoeDamagedTargetIds = new Set<string>();
  attackHitTargetIds = new Set<string>();
  critTargetIds = new Set<string>();
  pendingDamage = new Map<string, DamageComponent[]>();
  lastSaveFailed = false;
  readonly dualWieldMelee: boolean;
  readonly baseWeapon: WeaponData | null;
  private initialStatuses = new Map<string, string[]>();

  constructor(source: UnitInstance, targets: UnitInstance[], ability: ParsedAbility, opts: AbilityResolverOptions) {
    this.source = source;
    this.targets = targets;
    this.ability = ability;
    this.rng = opts.rng;
    this.statusCatalog = opts.statusCatalog ?? new Map();
    this.choose = opts.choose ?? ((_prompt, options) => 0);
    this.damageTypeChoice = opts.damageTypeChoice;

    for (const target of targets) {
      this.initialStatuses.set(target.id, [...target.conditionLayers.keys()]);
    }

    this.dualWieldMelee = source.isDualWieldingMelee();
    this.baseWeapon = this.dualWieldMelee ? source.dualWieldWeapon() : source.weapon;

    this.variables = {
      strMod: source.attrMod('力量'),
      dexMod: source.attrMod('敏捷'),
      conMod: source.attrMod('体质'),
      intMod: source.attrMod('智力'),
      wisMod: source.attrMod('感知'),
      chaMod: source.attrMod('魅力'),
      willMod: source.attrMod('意志'),
      luckMod: source.attrMod('幸运'),
      keyMod: source.attrMod(source.keyAttr),
      speed: source.effectiveSpeed(),
      comboPoints: source.comboPoints,
      hp: source.hp,
      hpMax: source.hpMax,
      fp: source.fp,
      fpMax: source.fpMax,
    };
  }

  ownerFor(unit: UnitInstance | null | undefined): RollOwner {
    return unit && unit.team === 'player' ? 'player' : 'auto';
  }

  targetHadStatusBefore(target: UnitInstance, status: string): boolean {
    return (this.initialStatuses.get(target.id) ?? []).includes(status);
  }

  emit(event: RollEvent): void {
    this.events.push(event);
  }

  evalDice(expr: string, vars: Record<string, number>, owner: RollOwner, opts: { diceFloor?: number } = {}): DiceEval {
    const context: ExpressionContext = { rng: this.rng, variables: vars, owner, diceFloor: opts.diceFloor };
    return evaluateExpression(expr, context);
  }

  evalFlat(expr: string, vars: Record<string, number>, owner: RollOwner): number {
    return this.evalDice(expr, vars, owner).total;
  }

  targetVars(target: UnitInstance): Record<string, number> {
    return {
      ...this.variables,
      layers: target.conditionLayersOf('bleeding') || target.conditionLayersOf('poisoned') || 0,
      targetBleedLayers: target.conditionLayersOf('bleeding'),
      targetAc: target.effectiveAc(),
      targetHp: target.hp,
      consumedResource: this.consumedResource,
    };
  }
}

// ---------- 结算器 ----------

export class AbilityResolver {
  private readonly opts: AbilityResolverOptions;

  constructor(opts: AbilityResolverOptions) {
    this.opts = opts;
  }

  resolveTargets(ability: ParsedAbility, source: UnitInstance, units: readonly UnitInstance[]): UnitInstance[] {
    const t = ability.targeting;
    if (t.kind === 'self') return [source];
    if (t.kind === 'unit') {
      return units.filter(
        (unit) => unit.id !== source.id
          && this.filterAllows(t.filter, source, unit)
          && this.unitInRange(t, source, unit)
          && (!unit.stealthed || unit.team === source.team),
      );
    }
    if (t.kind === 'area') {
      let cells: Vec2[] = [];
      if (t.shape === 'cone') cells = coneCells({ x: source.x, y: source.y }, source.facing, t.rings).cells;
      else if (t.shape === 'adjacent') {
        for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
          if (dx !== 0 || dy !== 0) cells.push({ x: source.x + dx, y: source.y + dy });
        }
      } else {
        for (let x = source.x - t.radius; x <= source.x + t.radius; x += 1) {
          for (let y = source.y - t.radius; y <= source.y + t.radius; y += 1) {
            if (gridDistance({ x: source.x, y: source.y }, { x, y }) <= t.radius) cells.push({ x, y });
          }
        }
      }
      const inArea = new Set(cells.map((c) => `${c.x},${c.y}`));
      return units.filter((unit) => unit.id !== source.id && inArea.has(`${unit.x},${unit.y}`) && this.filterAllows(t.filter, source, unit));
    }
    return [];
  }

  private filterAllows(filter: ParsedFilter, source: UnitInstance, target: UnitInstance): boolean {
    if (filter.livingOnly && target.hp <= 0) return false;
    if (filter.teams.length > 0) {
      const allowed = filter.teams.some((team) => (team === 'enemy' ? target.team !== source.team : target.team === source.team));
      if (!allowed) return false;
    }
    if (filter.facingSource && !rayAimsAtCell({ x: target.x, y: target.y }, target.facing, { x: source.x, y: source.y })) {
      return false;
    }
    return true;
  }

  private unitInRange(t: Extract<ParsedTargeting, { kind: 'unit' }>, source: UnitInstance, target: UnitInstance): boolean {
    if (t.range.metric === 'adjacent') {
      return isMeleeAdjacent(
        { x: source.x, y: source.y, z: source.z },
        { x: target.x, y: target.y, z: target.z },
      );
    }
    return combatDistance(
      { x: source.x, y: source.y, z: source.z },
      { x: target.x, y: target.y, z: target.z },
    ) <= t.range.max;
  }

  checkConditions(ability: ParsedAbility, source: UnitInstance, targets: UnitInstance[], allUnits: readonly UnitInstance[] = targets): string[] {
    const errors: string[] = [];
    for (const raw of ability.conditions) {
      const c = asRecord(raw);
      if (!c) continue;
      const kind = asString(c.kind);
      if (kind === 'equipped') {
        const any = Array.isArray(c.any) ? (c.any as string[]) : [];
        const all = Array.isArray(c.all) ? (c.all as string[]) : [];
        const has = (tag: string) => source.hasInventoryTag(tag) || this.weaponHas(source.weapon, tag) || this.weaponHas(source.offhand, tag);
        if (any.length > 0 && !any.some(has)) errors.push(`未装备/携带: ${any.join('/')}`);
        if (all.length > 0 && !all.every(has)) errors.push(`未装备/携带全部: ${all.join('/')}`);
      } else if (kind === 'weaponLoaded') {
        const ammoType = source.weapon?.ammoType;
        if (!ammoType || !source.ammo.get(ammoType)?.loaded) errors.push('武器未装填');
      } else if (kind === 'lacksStatus') {
        const name = asString(c.name);
        if (name && source.hasCondition(name)) errors.push(`自身处于${name}`);
      } else if (kind === 'hasStatus') {
        const name = asString(c.name);
        if (name && !source.hasCondition(name)) errors.push(`需要状态: ${name}`);
      } else if (kind === 'stealthed') {
        if (!source.stealthed) errors.push('需要处于潜行状态');
      } else if (kind === 'sapTargetAllowed') {
        const target = targets[0];
        if (!target) continue;
        const immuneType = ['构造体', '元素生物', '不死生物'].includes(target.creatureType);
        const tooLarge = target.sizeRank() >= 4 || target.isTwoSizesLargerThan(source);
        if (immuneType || tooLarge) errors.push('目标免疫闷棍');
      } else if (kind === 'noAdjacentEnemy') {
        const adjacent = allUnits.some((u) => u.id !== source.id && u.team !== source.team && u.hp > 0 && isMeleeAdjacent(
          { x: source.x, y: source.y, z: source.z },
          { x: u.x, y: u.y, z: u.z },
        ));
        if (adjacent) errors.push('相邻位置存在敌人，无法进入潜行');
      } else if (kind === 'canSpeak') {
        if (source.hasCondition('silenced')) errors.push('无法言语');
      } else if (kind === 'canGesture') {
        if (source.hasCondition('paralyzed') || source.hasCondition('confused')) errors.push('无法做出手势');
      } else if (kind === 'hasFreeHand') {
        if (source.offhand) errors.push('没有空闲的手');
      } else if (kind === 'notAdjacentToTarget') {
        const target = targets[0];
        if (target && isMeleeAdjacent({ x: source.x, y: source.y, z: source.z }, { x: target.x, y: target.y, z: target.z })) {
          errors.push('目标不能处于相邻位置');
        }
      }
    }
    return errors;
  }

  private weaponHas(weapon: WeaponData | null, tag: string): boolean {
    if (!weapon) return false;
    return weapon.name === tag || weapon.category === tag || (weapon.tags ?? []).includes(tag);
  }

  checkCastCost(ability: ParsedAbility, source: UnitInstance, skipActionCost = false): string | null {
    const action = mapActionText(ability.cast.action);
    if (!skipActionCost) {
      if (action === 'main' && !source.canUseAction('main')) return '没有主要动作';
      if (action === 'bonus' && !source.canUseAction('bonus')) return '没有附赠动作';
      if (action === 'reaction' && !source.canUseAction('reaction')) return '没有反应动作';
    }
    if (ability.cast.fp != null) {
      const fp = Number(ability.cast.fp);
      if (!Number.isFinite(fp) || source.fp < fp) return '疲劳值不足';
    }
    if (ability.cast.consumeAmmo) {
      const ammoType = source.weapon?.ammoType;
      if (!ammoType || !source.ammo.get(ammoType)?.loaded) return '武器未装填';
    }
    return null;
  }

  payCastCost(ability: ParsedAbility, source: UnitInstance, skipActionCost = false): void {
    const action = mapActionText(ability.cast.action);
    if (!skipActionCost && (action === 'main' || action === 'bonus' || action === 'reaction')) source.useAction(action as 'main' | 'bonus' | 'reaction');
    if (ability.cast.fp != null) source.fp = Math.max(0, source.fp - Number(ability.cast.fp));
    if (ability.cast.consumeAmmo && source.weapon?.ammoType) source.consumeLoadedAmmo(source.weapon.ammoType);
  }

  computeAttackPreview(
    ability: ParsedAbility,
    spec: ParsedRollSpec,
    source: UnitInstance,
    target: UnitInstance,
    allUnits: readonly UnitInstance[],
    statusCatalog: Map<string, StatusCardData>,
  ): { bonus: number; mode: 'normal' | 'advantage' | 'disadvantage'; vsAc: number; hitChance: number } | null {
    const session = new ResolutionSession(source, [target], ability, {
      rng: { next: () => 0.5, die: (sides) => 1 + Math.floor(0.5 * sides) },
      statusCatalog,
    });
    const attrMod = spec.attr === 'weapon' ? source.weaponHitMod() : spec.attr ? source.attrMod(spec.attr as AttrName) : 0;
    const profBonus = spec.prof === 'weapon' ? source.weaponProfBonus() : 0;
    let mode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
    if (spec.prof === 'weapon' && !source.hasWeaponProf()) mode = 'disadvantage';
    const targetAdjacent = isMeleeAdjacent(
      { x: source.x, y: source.y, z: source.z },
      { x: target.x, y: target.y, z: target.z },
    );
    const ignoreAdjacent = spec.mods?.some((m) => m.if === 'targetIsAdjacent' && m.ignoreAdjacentDisadvantage && targetAdjacent);
    if (!ignoreAdjacent && this.isRangedTargeting(ability.targeting)) {
      const hasAdjacentEnemy = allUnits.some(
        (u) => u.id !== source.id && u.team !== source.team && u.hp > 0
          && isMeleeAdjacent({ x: source.x, y: source.y, z: source.z }, { x: u.x, y: u.y, z: u.z }),
      );
      if (hasAdjacentEnemy) mode = 'disadvantage';
    }
    let flat = 0;
    for (const mod of spec.mods ?? []) {
      if (mod.flat && this.evalWhen(mod.if ?? 'true', source, target, session)) {
        flat += session.evalFlat(mod.flat, session.targetVars(target), 'auto');
      }
    }
    const bonus = attrMod + profBonus + flat;
    const p = hitProbability(bonus, target.effectiveAc());
    const hitChance = mode === 'disadvantage' ? p * p : p; // 当前 P0 尚无优势来源；后续接入优势系统时扩展
    return { bonus, mode, vsAc: target.effectiveAc(), hitChance: Math.max(0, Math.min(1, hitChance)) };
  }

  resolveAttackRoll(spec: ParsedRollSpec, source: UnitInstance, target: UnitInstance, session: ResolutionSession, allowFumble = true): AttackRollResult {
    const attrMod = spec.attr === 'weapon' ? source.weaponHitMod() : spec.attr ? source.attrMod(spec.attr as AttrName) : 0;
    const profBonus = spec.prof === 'weapon' ? source.weaponProfBonus() : 0;
    let advantage = false;
    let disadvantage = false;
    let advDice = spec.advDice ?? 2;
    if (spec.adv === 'advantage') advantage = true;
    if (spec.adv === 'disadvantage') disadvantage = true;
    if (spec.prof === 'weapon' && !source.hasWeaponProf()) disadvantage = true;
    if (target.hasCondition('anticipate_triggered')) disadvantage = true;
    if (source.hasCondition('anticipate_counter') && source.anticipateTargetIds.has(target.id)) advantage = true;
    // 官方状态规则：攻击减速/禁锢/致盲/麻痹/击倒目标有优势。
    if (target.hasCondition('slowed') || target.hasCondition('paralyzed') || target.hasCondition('blinded') || target.hasCondition('prone')) {
      advantage = true;
    }
    if (source.hasCondition('prone') || source.hasCondition('blinded')) disadvantage = true;
    if (target.hasCondition('elusive')) disadvantage = true;
    if (target.hasCondition('dance_penalty')) {
      disadvantage = true;
    }
    if ((target.marks.get('provoke_duel') ?? 0) > 0) advantage = true;
    const targetAdjacent = isMeleeAdjacent({ x: source.x, y: source.y, z: source.z }, { x: target.x, y: target.y, z: target.z });
    const ignoreAdjacent = spec.mods?.some((m) => m.if === 'targetIsAdjacent' && m.ignoreAdjacentDisadvantage && targetAdjacent);
    if (!ignoreAdjacent && this.isRangedTargeting(session.ability.targeting) && this.hasAdjacentEnemy(source, session.targets)) {
      disadvantage = true;
    }
    if (spec.advDice) advDice = spec.advDice;
    const adv: 'normal' | 'advantage' | 'disadvantage' = advantage && !disadvantage
      ? 'advantage'
      : disadvantage && !advantage
        ? 'disadvantage'
        : 'normal';

    const diceCount = adv === 'normal' ? 1 : advDice;
    const values = Array.from({ length: diceCount }, () => this.opts.rng.die(20));
    const d20 = adv === 'disadvantage'
      ? Math.min(...values)
      : adv === 'advantage'
        ? Math.max(...values)
        : (values[0] as number);

    if (target.hasCondition('dance_penalty')) {
      target.removeCondition('dance_penalty');
    }
    // 克敌先机：触发后消耗“被攻击劣势”，给予“反击优势直到玩家下一轮结束”
    if (target.hasCondition('anticipate_triggered')) {
      target.removeCondition('anticipate_triggered');
      target.addTemporaryCondition('anticipate_counter', 1);
      target.anticipateTargetIds.add(source.id);
    }
    if (source.hasCondition('anticipate_counter') && source.anticipateTargetIds.has(target.id)) {
      source.removeCondition('anticipate_counter');
      source.anticipateTargetIds.delete(target.id);
    }

    let flat = 0;
    let ignoreAc = 0;
    let critRangeBonus = 0;
    let guaranteedCrit = false;
    if (session.ability.cast.keywords.includes('远程攻击')) {
      const marks = source.marks.get('blade_gun_marks') ?? 0;
      if (marks > 0) {
        critRangeBonus += marks;
        source.marks.set('blade_gun_marks', 0);
      }
    }
    for (const mod of spec.mods ?? []) {
      if (!this.evalWhen(mod.if ?? 'true', source, target, session)) continue;
      if (mod.flat) flat += session.evalFlat(mod.flat, session.targetVars(target), session.ownerFor(source));
      if (mod.ignoreAc) ignoreAc += Math.floor(session.evalFlat(mod.ignoreAc, session.targetVars(target), session.ownerFor(source)));
      if (mod.critRange) critRangeBonus += Math.floor(session.evalFlat(mod.critRange, session.targetVars(target), session.ownerFor(source)));
      if (mod.guaranteedCrit) guaranteedCrit = true;
    }

    const effAc = Math.max(0, target.effectiveAc() - ignoreAc);
    let total = d20 + attrMod + profBonus + flat;
    let bidePenalty = false;
    if ((source.marks.get('bide_time_penalty') ?? 0) > 0) {
      bidePenalty = true;
      total = Math.floor(total / 2);
    }
    const crit = d20 === 20 || (d20 !== 1 && guaranteedCrit) || (critRangeBonus > 0 && d20 >= 20 - critRangeBonus);
    const fumble = allowFumble && d20 === 1;
    const hit = d20 === 20 ? true : total >= effAc;

    session.emit({
      owner: session.ownerFor(source),
      label: `${source.name} 攻击 ${target.name}`,
      kind: 'attack',
      unitId: source.id,
      targetId: target.id,
      expression: `D20 + ${attrMod} + ${profBonus} + ${flat}`,
      parts: [
        { kind: 'dice', label: '1D20', values, value: d20, owner: session.ownerFor(source) },
        { kind: 'flat', label: `属性+熟练 ${attrMod}+${profBonus}`, value: attrMod + profBonus, owner: session.ownerFor(source) },
        ...(flat ? [{ kind: 'flat' as const, label: '修正', value: flat, owner: session.ownerFor(source) }] : []),
      ],
      total,
      detail: `${adv === 'advantage' ? '优势' : adv === 'disadvantage' ? '劣势' : 'D20'}[${values.join(',')}] + ${attrMod + profBonus + flat}${bidePenalty ? ` ÷2=${total}` : ` = ${total}`} vs AC${effAc}${ignoreAc ? `（忽略${ignoreAc}）` : ''}${crit ? ' 暴击' : ''}`,
    });

    return { target, d20, values, total, hit, crit, fumble };
  }

  private isRangedTargeting(t: ParsedTargeting): boolean {
    return t.kind === 'unit' && t.range.metric === 'grid';
  }

  private hasAdjacentEnemy(source: UnitInstance, units: readonly UnitInstance[]): boolean {
    return units.some(
      (u) => u.id !== source.id && u.team !== source.team && u.hp > 0
        && isMeleeAdjacent({ x: source.x, y: source.y, z: source.z }, { x: u.x, y: u.y, z: u.z }),
    );
  }

  resolveSaveRoll(spec: ParsedRollSpec, source: UnitInstance, target: UnitInstance, session: ResolutionSession): SaveRollResult {
    const dcText = spec.dc == null
      ? '15'
      : typeof spec.dc === 'number'
        ? String(spec.dc)
        : expandExpr(spec.dc, session.ability, source, session);
    const dc = Math.floor(session.evalFlat(dcText, session.targetVars(target), session.ownerFor(target)));
    const attr: AttrName = spec.attr === 'weapon' || spec.attr == null ? '敏捷' : spec.attr;
    const attrMod = target.attrMod(attr);
    const daringAdvantage = target.daringActive && (attr === '魅力' || attr === '意志');
    const specAdv = spec.adv;
    const diceCount = specAdv ? (spec.advDice ?? 2) : daringAdvantage ? 2 : 1;
    const values = Array.from({ length: diceCount }, () => this.opts.rng.die(20));
    const mode = specAdv ?? (daringAdvantage ? 'advantage' : null);
    const d20 = mode === 'disadvantage'
      ? Math.min(...values)
      : mode === 'advantage'
        ? Math.max(...values)
        : (values[0] as number);
    const total = d20 + attrMod;
    const critSuccess = d20 === 20;
    const critFail = d20 === 1;
    const success = critSuccess ? true : critFail ? false : total >= dc;
    const modeLabel = mode === 'disadvantage' ? (diceCount >= 4 ? '4D20取低' : diceCount === 3 ? '3D20取低' : '2D20取低')
      : mode === 'advantage' ? '2D20取高' : '1D20';
    session.emit({
      owner: session.ownerFor(target),
      label: `${target.name} ${attr}豁免 DC${dc}`,
      kind: 'save',
      unitId: target.id,
      targetId: source.id,
      expression: `D20 + ${attrMod}`,
      parts: [{ kind: 'dice', label: modeLabel, values, value: d20, owner: session.ownerFor(target) }],
      total,
      detail: `${modeLabel}[${values.join(',')}] + ${attrMod} = ${total} vs DC${dc} ${success ? '成功' : '失败'}`,
    });
    return { target, d20, total, success, critSuccess, critFail };
  }

  resolveAoeSaveRoll(spec: ParsedRollSpec, source: UnitInstance, target: UnitInstance, session: ResolutionSession): AoeSaveResult {
    const base = this.resolveSaveRoll(spec, source, target, session);
    let multiplier: 0 | 0.5 | 1 | 2 = base.success ? 0.5 : 1;
    if (base.critFail) multiplier = 2;
    if (base.critSuccess) multiplier = 0;
    session.emit({
      owner: session.ownerFor(target),
      label: `${target.name} AOE 伤害豁免`,
      kind: 'aoeSave',
      unitId: target.id,
      targetId: source.id,
      total: base.total,
      detail: `D20=${base.d20} → ${multiplier === 2 ? '双倍' : multiplier === 1 ? '全伤' : multiplier === 0.5 ? '半伤' : '无伤'}`,
    });
    return { ...base, multiplier };
  }

  resolveArmorCheckRoll(spec: ParsedRollSpec, source: UnitInstance, target: UnitInstance, session: ResolutionSession): SaveRollResult {
    const dc = typeof spec.dc === 'number' ? spec.dc : 10;
    const d20 = this.opts.rng.die(20);
    const success = d20 >= dc;
    const total = d20;
    session.emit({
      owner: session.ownerFor(target),
      label: `${target.name} 护甲检定 DC${dc}`,
      kind: 'save',
      unitId: target.id,
      targetId: source.id,
      expression: 'D20',
      parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: session.ownerFor(target) }],
      total,
      detail: `${d20} vs DC${dc} ${success ? '成功' : '失败'}`,
    });
    return { target, d20, total, success, critSuccess: d20 === 20, critFail: d20 === 1 };
  }

  evalWhen(expr: string, source: UnitInstance, target: UnitInstance, session: ResolutionSession): boolean {
    let text = expr.trim();
    let negate = false;
    if (text.startsWith('!')) {
      negate = true;
      text = text.slice(1).trim();
    }
    if (text === 'true') return !negate;
    const statusMatch = /^(targetHasStatus|targetHadStatusBefore)\(['"]([^'"]+)['"]\)$/.exec(text);
    if (statusMatch) {
      const value = statusMatch[1] === 'targetHasStatus'
        ? target.hasCondition(statusMatch[2] as string)
        : session.targetHadStatusBefore(target, statusMatch[2] as string);
      return negate ? !value : value;
    }
    if (text === 'attackerAtBackOfTarget') {
      const back = backCell({ x: target.x, y: target.y }, target.facing);
      const value = source.x === back.x && source.y === back.y;
      return negate ? !value : value;
    }
    if (/^targetArmorIs\('([^']+)'\)$/.test(text)) {
      const cat = /^targetArmorIs\('([^']+)'\)$/.exec(text)?.[1];
      const value = target.armorCategory === cat;
      return negate ? !value : value;
    }
    if (text === 'lastSaveFailed') {
      const value = session.lastSaveFailed;
      return negate ? !value : value;
    }
    if (text === 'crit') {
      const value = session.critTargetIds.has(target.id);
      return negate ? !value : value;
    }
    if (text === 'targetIsEnemy') {
      const value = target.team !== source.team;
      return negate ? !value : value;
    }
    if (text === 'targetIsAdjacent') {
      const value = isMeleeAdjacent({ x: source.x, y: source.y, z: source.z }, { x: target.x, y: target.y, z: target.z });
      return negate ? !value : value;
    }
    if (text === '@comboPoints > 0') {
      const value = source.comboPoints > 0;
      return negate ? !value : value;
    }
    const cmp = /^@([A-Za-z_][A-Za-z0-9_.]*)\s*(>=|<=|>|<|==)\s*(-?\d+)$/.exec(text);
    if (cmp) {
      const raw = session.targetVars(target)[cmp[1] as string];
      const left = typeof raw === 'number' ? raw : source.comboPoints;
      const right = Number(cmp[3]);
      const op = cmp[2];
      const value = op === '>=' ? left >= right
        : op === '<=' ? left <= right
        : op === '>' ? left > right
        : op === '<' ? left < right
        : left === right;
      return negate ? !value : value;
    }
    const tookDamage = /^tookDamageFromRoll\(['"]([^'"]+)['"]\)$/.exec(text);
    if (tookDamage) {
      const value = session.aoeDamagedTargetIds.has(target.id);
      return negate ? !value : value;
    }
    throw new Error(`未支持的 when 表达式: ${expr}`);
  }
}

// ---------- 效果执行 ----------

export interface ExecuteAbilityOptions extends AbilityResolverOptions {
  level?: number;
  targets?: UnitInstance[];
}

function expandExpr(expr: string, ability: ParsedAbility, source: UnitInstance, session: ResolutionSession): string {
  let out = expr;
  for (const [key, value] of Object.entries(ability.scalingVariables)) {
    out = out.replaceAll(`@${key}`, value);
  }
  const baseWeapon = session.baseWeapon ?? source.weapon;
  out = out.replaceAll('@weapon.dice', baseWeapon?.dice ?? '0');
  out = out.replaceAll('@weapon.attrMod', String(source.weaponAttackMod(baseWeapon)));
  out = out.replaceAll('@weapon.damageType', baseWeapon?.damageType ?? '物理');
  out = out.replaceAll('@consumedResource', String(session.consumedResource));
  return out;
}

function damageTypeFor(rawType: string | undefined, source: UnitInstance, session: ResolutionSession): string {
  const type = rawType ?? '物理';
  if (type === '@chosenDamageType') {
    return session.chosenDamageType === '物理' ? (source.weapon?.damageType ?? '物理') : (session.chosenDamageType ?? type);
  }
  if (type === '@weapon.damageType') {
    const weapon = session.baseWeapon ?? source.weapon;
    return weapon?.shadowBlade ? '暗影' : (weapon?.damageType ?? '物理');
  }
  return type;
}

function layerRollOwner(source: UnitInstance, target: UnitInstance, session: ResolutionSession): RollOwner {
  return source.team === 'player' || target.team === 'player' ? 'player' : session.ownerFor(source);
}

function executeEffects(
  effects: unknown[],
  source: UnitInstance,
  target: UnitInstance,
  session: ResolutionSession,
  resolver: AbilityResolver,
  outcome: ResolveOutcome,
): void {
  for (const raw of effects) {
    const step = asRecord(raw);
    if (!step) continue;
    if (step.when && !resolver.evalWhen(String(step.when), source, target, session)) continue;
    const op = asString(step.op);
    if (op === 'damage') {
      const timing = step.timing === 'after' ? 'after' : 'before';
      const isWeaponBase = step.source === 'weapon';
      const crit = session.critTargetIds.has(target.id);
      const repeat = step.repeat === 'perComboPoint' ? Math.max(1, source.comboPoints) : 1;
      const rollFloorText = typeof step.rollFloor === 'number'
        ? String(step.rollFloor)
        : typeof step.rollFloor === 'string'
          ? expandExpr(step.rollFloor, session.ability, source, session)
          : undefined;
      let rollFloor = rollFloorText === undefined
        ? undefined
        : Math.floor(session.evalFlat(rollFloorText, session.targetVars(target), session.ownerFor(source)));
      if (isWeaponBase && session.baseWeapon?.shadowBlade) {
        rollFloor = rollFloor === undefined ? 3 : Math.max(rollFloor, 3);
      }
      const damageType = damageTypeFor(asString(step.type) ?? undefined, source, session);

      for (let r = 0; r < repeat; r += 1) {
        const diceExpr = expandExpr(asString(step.dice) ?? '0', session.ability, source, session);
        const flatExpr = expandExpr(asString(step.flat) ?? '0', session.ability, source, session);
        const owner = session.ownerFor(source);
        const advMode = step.adv === 'advantage' || step.adv === 'disadvantage'
          ? step.adv
          : ((target.marks.get('provoke_duel') ?? 0) > 0 || (target.marks.get('damage_advantage') ?? 0) > 0)
            ? 'advantage'
            : null;
        let diceEval = session.evalDice(diceExpr, session.targetVars(target), owner, { diceFloor: rollFloor });
        if (advMode) {
          const second = session.evalDice(diceExpr, session.targetVars(target), owner, { diceFloor: rollFloor });
          if (advMode === 'advantage' ? second.total > diceEval.total : second.total < diceEval.total) {
            diceEval = second;
          }
        }
        const flat = session.evalFlat(flatExpr, session.targetVars(target), owner);
        const raw = Math.max(0, diceEval.total + flat);

        let multiplier = 1;
        if (isWeaponBase && session.dualWieldMelee) {
          multiplier = crit ? 2.5 : 1.5;
        } else if (timing === 'before' && crit) {
          multiplier = typeof step.critMultiplier === 'number' ? step.critMultiplier : 2;
        }

        const scaled = raw * multiplier;
        const list = session.pendingDamage.get(target.id) ?? [];
        list.push({
          targetId: target.id,
          label: `${source.name} 对 ${target.name} 伤害分量`,
          raw: scaled,
          kind: isWeaponBase ? 'weaponBase' : timing,
          expression: `${diceExpr}${advMode === 'advantage' ? '（优势）' : advMode === 'disadvantage' ? '（劣势）' : ''} + ${flat} × ${multiplier}`,
          damageType,
        });
        session.pendingDamage.set(target.id, list);

        session.emit({
          owner,
          label: `${source.name} 对 ${target.name} 造成伤害`,
          kind: 'damage',
          unitId: source.id,
          targetId: target.id,
          expression: `${diceExpr} + ${flat}`,
          parts: [...diceEval.parts, { kind: 'flat', label: '附加', value: flat, owner }],
          total: scaled,
          detail: `原始 ${raw} × ${multiplier} = ${scaled}（${isWeaponBase && session.dualWieldMelee ? (crit ? '双持暴击2.5' : '双持1.5') : crit ? `暴击${multiplier}` : '普通'}，${damageType}）`,
        });
      }
    } else if (op === 'aoeDamage') {
      const rollId = asString(step.roll) ?? 'aoe';
      const results = (session.rollResults.get(rollId) ?? []) as AoeSaveResult[];
      const repeat = step.repeat === 'perComboPoint' ? Math.max(1, source.comboPoints) : 1;
      const owner = session.ownerFor(source);
      const damageType = damageTypeFor(asString(step.type) ?? undefined, source, session);
      const rollFloorText = typeof step.rollFloor === 'number'
        ? String(step.rollFloor)
        : typeof step.rollFloor === 'string'
          ? expandExpr(step.rollFloor, session.ability, source, session)
          : undefined;
      const rollFloor = rollFloorText === undefined
        ? undefined
        : Math.floor(session.evalFlat(rollFloorText, session.targetVars(target), owner));
      for (let r = 0; r < repeat; r += 1) {
        const diceExpr = expandExpr(asString(step.dice) ?? '0', session.ability, source, session);
        const flatExpr = expandExpr(asString(step.flat) ?? '0', session.ability, source, session);
        const diceEval = session.evalDice(diceExpr, session.targetVars(target), owner, { diceFloor: rollFloor });
        const flat = session.evalFlat(flatExpr, session.targetVars(target), owner);
        for (const result of results) {
          if (result.multiplier <= 0) continue;
          const raw = (diceEval.total + flat) * result.multiplier;
          const resistance = result.target.resistances.get(damageType) ?? 0;
          const vulnerability = result.target.vulnerabilities.get(damageType) ?? 0;
          const amount = Math.max(0, Math.floor(raw + vulnerability - resistance));
          if (amount <= 0) continue;
          result.target.applyDamage(amount);
          session.aoeDamagedTargetIds.add(result.target.id);
          outcome.damageByTarget.set(result.target.id, (outcome.damageByTarget.get(result.target.id) ?? 0) + amount);
          if (result.target.hp <= 0) outcome.killedTargetIds.push(result.target.id);
          session.emit({
            owner,
            label: `${source.name} AOE 伤害 ${result.target.name}`,
            kind: 'damage',
            unitId: source.id,
            targetId: result.target.id,
            expression: diceExpr,
            parts: [...diceEval.parts, { kind: 'flat', label: `倍数 ${result.multiplier}`, value: amount - diceEval.total, owner }],
            total: amount,
            detail: `(${diceEval.total}+${flat}) × ${result.multiplier}${vulnerability ? `+${vulnerability}` : ''}${resistance ? `-${resistance}` : ''} = ${amount} → HP ${result.target.hp}/${result.target.hpMax}`,
          });
        }
      }
    } else if (op === 'condition') {
      const status = asString(step.name);
      if (!status) throw new Error('condition 缺少 name');
      const save = asRecord(step.save);
      let shouldApply = true;
      if (save) {
        const saveAttr = (asString(save.attr) ?? '体质') as AttrName;
        if (save.autoSuccessIfProf === true && target.hasSaveProf(saveAttr)) {
          shouldApply = false;
          session.emit({
            owner: session.ownerFor(target),
            label: `${target.name} 拥有${saveAttr}豁免值，自动成功`,
            kind: 'save',
            unitId: target.id,
            targetId: source.id,
            total: 0,
            detail: `蝶舞自动豁免：${saveAttr}豁免熟练自动成功`,
          });
        } else {
          const dcText = typeof save.dc === 'number'
            ? String(save.dc)
            : expandExpr(String(save.dc ?? '15'), session.ability, source, session);
          const dc = Math.floor(session.evalFlat(dcText, session.targetVars(target), session.ownerFor(target)));
          const saveResult = resolver.resolveSaveRoll(
            {
              id: `save-${status}`,
              kind: 'save',
              attr: saveAttr,
              dc,
              target: 'targets',
            },
            source,
            target,
            session,
          );
          shouldApply = !saveResult.success;
          session.lastSaveFailed = !saveResult.success;
        }
      }
      if (shouldApply) {
        let explicitLayers: number | undefined;
        if (step.layers !== undefined) {
          const layersText = typeof step.layers === 'number'
            ? String(step.layers)
            : expandExpr(String(step.layers), session.ability, source, session);
          explicitLayers = Math.max(1, Math.floor(session.evalFlat(layersText, session.targetVars(target), session.ownerFor(target))));
        }
        applyStatus(status, target, source, session, resolver, outcome, explicitLayers, asRecord(step.duration));
      }
    } else if (op === 'conditionGroup') {
      const names = Array.isArray(step.statuses) ? (step.statuses as string[]) : [];
      const save = asRecord(step.save);
      let shouldApply = true;
      if (save) {
        const saveAttr = (asString(save.attr) ?? '体质') as AttrName;
        if (save.autoSuccessIfProf === true && target.hasSaveProf(saveAttr)) {
          shouldApply = false;
        } else {
          const dcText = typeof save.dc === 'number'
            ? String(save.dc)
            : expandExpr(String(save.dc ?? '15'), session.ability, source, session);
          const dc = Math.floor(session.evalFlat(dcText, session.targetVars(target), session.ownerFor(target)));
          const saveResult = resolver.resolveSaveRoll(
            {
              id: `save-group-${names.join('-')}`,
              kind: 'save',
              attr: saveAttr,
              dc,
              target: 'targets',
            },
            source, target, session,
          );
          shouldApply = !saveResult.success;
        }
      }
      if (shouldApply) {
        for (const name of names) applyStatus(name, target, source, session, resolver, outcome, undefined, asRecord(step.duration));
      }
    } else if (op === 'statusLayers') {
      const status = asString(step.name);
      if (!status) throw new Error('statusLayers 缺少 name');
      const amountText = expandExpr(asString(step.amount) ?? '0', session.ability, source, session);
      const delta = evaluateLayerDelta(amountText, source, target, session);
      if (delta > 0) {
        target.addCondition(status, delta);
      } else if (delta < 0) {
        target.removeConditionLayers(status, Math.abs(delta));
      }
      outcome.appliedStatuses.push({ targetId: target.id, status, layers: delta });
      session.emit({
        owner: layerRollOwner(source, target, session),
        label: `${target.name} ${status}层数变化`,
        kind: 'status',
        unitId: target.id,
        total: delta,
        detail: `${status} ${delta >= 0 ? '+' : ''}${delta} 层`,
      });
    } else if (op === 'loseHp') {
      const expr = expandExpr(asString(step.amount) ?? '0', session.ability, source, session);
      const owner = session.ownerFor(source);
      const evalResult = session.evalDice(expr, session.targetVars(target), owner);
      const amount = Math.max(0, Math.floor(evalResult.total));
      target.loseHp(amount);
      outcome.damageByTarget.set(target.id, (outcome.damageByTarget.get(target.id) ?? 0) + amount);
      if (target.hp <= 0) outcome.killedTargetIds.push(target.id);
      session.emit({
        owner,
        label: `${target.name} 失去生命值`,
        kind: 'loseHp',
        unitId: target.id,
        expression: expr,
        parts: evalResult.parts,
        total: amount,
        detail: `直接失血 ${amount} → HP ${target.hp}/${target.hpMax}`,
      });
    } else if (op === 'resource') {
      const resource = asString(step.resource) ?? '';
      const amountText = asString(step.amount) ?? '0';
      if (resource === 'comboPoints') {
        if (amountText === '+1') {
          source.gainCombo(1);
          session.consumedResource = 0;
        } else if (amountText === '-all') {
          session.consumedResource = source.spendAllCombo();
        }
        session.emit({
          owner: session.ownerFor(source),
          label: `${source.name} 连击点变化`,
          kind: 'resource',
          unitId: source.id,
          total: source.comboPoints,
          detail: `连击点 → ${source.comboPoints}`,
        });
      }
    } else if (op === 'stealth') {
      source.stealthed = step.value !== false;
      session.emit({
        owner: session.ownerFor(source),
        label: source.stealthed ? `${source.name} 进入潜行` : `${source.name} 解除潜行`,
        kind: 'status',
        unitId: source.id,
        total: source.stealthed ? 1 : 0,
        detail: source.stealthed ? '潜行：不可被单体选定，攻击/全速移动后解除' : '已显形',
      });
    } else if (op === 'dispel') {
      const markName = asString(step.mark);
      const statusName = asString(step.status);
      let removed = false;
      let note = '';
      if (markName) {
        removed = target.dispelMark(markName);
        note = removed ? `${markName} 已被移除` : `${markName} 的首次驱散被护盾抵挡`;
      } else if (statusName) {
        removed = target.removeCondition(statusName);
        note = removed ? `${statusName} 已被移除` : '没有可移除的状态';
      } else {
        throw new Error('dispel 缺少 mark/status');
      }
      session.emit({
        owner: session.ownerFor(source),
        label: `${target.name} 驱散结算`,
        kind: 'status',
        unitId: target.id,
        total: removed ? 1 : 0,
        detail: note,
      });
    } else if (op === 'mark') {
      const name = asString(step.name);
      if (!name) throw new Error('mark 缺少 name');
      const amountText = expandExpr(asString(step.amount) ?? '1', session.ability, source, session);
      const amount = Math.floor(session.evalFlat(amountText, session.targetVars(target), session.ownerFor(source)));
      const next = Math.max(0, (target.marks.get(name) ?? 0) + amount);
      target.marks.set(name, next);
      session.emit({
        owner: session.ownerFor(source),
        label: `${target.name} 标记 ${name}`,
        kind: 'status',
        unitId: target.id,
        total: next,
        detail: `${name} → ${next}`,
      });
    } else if (op === 'acReduction') {
      const expr = expandExpr(asString(step.amount) ?? '1', session.ability, source, session);
      const value = Math.max(0, Math.floor(session.evalDice(expr, session.targetVars(target), session.ownerFor(source)).total));
      target.acReduction += value;
      session.emit({
        owner: session.ownerFor(source),
        label: `${target.name} 防御等级下降`,
        kind: 'status',
        unitId: target.id,
        total: value,
        detail: `AC -${value} → ${target.effectiveAc()}（持续到战斗结束）`,
      });
    } else if (op === 'modifier') {
      const stat = asString(step.stat);
      if (stat === 'ac') {
        const valueText = expandExpr(asString(step.value) ?? '0', session.ability, source, session);
        const value = Math.max(0, Math.floor(session.evalFlat(valueText, session.targetVars(target), session.ownerFor(source))));
        target.acBonus += value;
        if (typeof step.cap === 'number') target.acCap = step.cap;
        target.addCondition('shadow_armor', 1);
        session.emit({
          owner: session.ownerFor(source),
          label: `${target.name} AC 修正`,
          kind: 'status',
          unitId: target.id,
          total: value,
          detail: `AC +${value}${typeof step.cap === 'number' ? `（上限${step.cap}）` : ''} → ${target.effectiveAc()}`,
        });
      } else if (stat === 'resistance' || stat === 'vulnerability') {
        const value = Number(step.value ?? 0);
        const types = Array.isArray(step.damageTypes) ? (step.damageTypes as string[]) : [];
        for (const type of types) {
          if (stat === 'resistance') target.resistances.set(type, value);
          else target.vulnerabilities.set(type, value);
        }
        session.emit({
          owner: session.ownerFor(source),
          label: `${target.name} ${stat === 'resistance' ? '抗性' : '易伤'}`,
          kind: 'status',
          unitId: target.id,
          total: value,
          detail: `${types.join('/')} ${stat === 'resistance' ? '-' : '+'}${value}`,
        });
      } else {
        throw new Error(`未支持的 modifier stat: ${stat}`);
      }
    } else if (op === 'move') {
      const mode = asString(step.mode);
      if (mode === 'dash') {
        const expr = expandExpr(asString(step.distance) ?? '0', session.ability, source, session);
        const budget = Math.floor(session.evalFlat(expr, session.targetVars(target), session.ownerFor(source)));
        source.grantMove('dash', budget);
        session.emit({
          owner: session.ownerFor(source),
          label: `${source.name} 获得全速移动预算`,
          kind: 'move',
          unitId: source.id,
          total: budget,
          detail: `+${budget} 步全速移动预算（本回合已执行全速移动）`,
        });
      } else {
        throw new Error(`未支持的 move mode: ${mode}`);
      }
    } else if (op === 'choice') {
      const prompt = asString(step.prompt) ?? '请选择';
      const options = Array.isArray(step.options) ? (step.options as Array<Record<string, unknown>>) : [];
      const selected = session.choose(prompt, options.map((o) => String(o.label ?? '选项')), session);
      const chosen = options[selected] ?? options[0];
      if (chosen) {
        executeEffects(Array.isArray(chosen.effects) ? chosen.effects : [], source, target, session, resolver, outcome);
      }
    } else {
      throw new Error(`未支持的 effect op: ${op}`);
    }
  }
}

function evaluateLayerDelta(expr: string, source: UnitInstance, target: UnitInstance, session: ResolutionSession): number {
  const text = expr.trim();
 
  if (text.startsWith('+') || text.startsWith('-')) {
    const sign = text.startsWith('-') ? -1 : 1;
    const rest = text.slice(1);
    if (/^\d+$/.test(rest)) return sign * Number(rest);
    const value = Math.floor(session.evalDice(rest, session.targetVars(target), layerRollOwner(source, target, session)).total);
    return sign * value;
  }
  if (/^\d+$/.test(text)) return Number(text);
  return Math.floor(session.evalDice(text, session.targetVars(target), layerRollOwner(source, target, session)).total);
}

function applyStatus(
  status: string,
  target: UnitInstance,
  source: UnitInstance,
  session: ResolutionSession,
  resolver: AbilityResolver,
  outcome: ResolveOutcome,
  explicitLayers?: number,
  durationObj?: Record<string, unknown> | null,
): void {
  const card = session.statusCatalog.get(status);
  let layers = explicitLayers ?? 1;
  if (card?.initialLayers && (explicitLayers === undefined || explicitLayers === 1)) {
    const owner = layerRollOwner(source, target, session);
    const evalResult = session.evalDice(card.initialLayers, session.targetVars(target), owner);
    layers = Math.floor(evalResult.total);
    session.emit({
      owner,
      label: `${target.name} ${card.name ?? status} 初始层数`,
      kind: 'status',
      unitId: target.id,
      expression: card.initialLayers,
      parts: evalResult.parts,
      total: layers,
      detail: `${card.initialLayers} → ${layers} 层`,
    });
  }
  let durationTurns: number | undefined;
  let temporary = false;
  const scope = durationObj?.scope ?? card?.duration.scope ?? 'battle';
  if (scope === 'temporary') {
    temporary = true;
  } else if (scope === 'rounds') {
    const rawValue = durationObj?.value ?? card?.duration.value ?? 1;
    let value: number;
    if (typeof rawValue === 'number') {
      value = rawValue;
    } else if (typeof rawValue === 'string' && rawValue.length > 0) {
      const evalResult = session.evalDice(expandExpr(rawValue, session.ability, source, session), session.targetVars(target), session.ownerFor(source));
      value = evalResult.total;
      session.emit({
        owner: session.ownerFor(source),
        label: `${target.name} 状态持续轮数`,
        kind: 'status',
        unitId: target.id,
        expression: rawValue,
        parts: evalResult.parts,
        total: Math.floor(value),
        detail: `${rawValue} → ${Math.floor(value)} 轮`,
      });
    } else {
      value = 1;
    }
    if (Number.isFinite(value) && value > 0) durationTurns = Math.floor(value);
  }
  if (status === 'poisoned' && (source.marks.get('toxin_spread_double') ?? 0) > 0) {
    layers *= 2;
  }
  target.addCondition(status, layers, card?.maxLayers ?? 99, {
    temporary,
    durationTurns,
    ownerId: source.id,
    ownerSerial: source.turnSerial,
  });
  outcome.appliedStatuses.push({ targetId: target.id, status, layers });
}


function allyDistance(ability: ParsedAbility, source: UnitInstance, ally: UnitInstance): number {
  const t = ability.targeting;
  if (t.kind === 'unit' && t.range.metric === 'grid') {
    return combatDistance(
      { x: source.x, y: source.y, z: source.z },
      { x: ally.x, y: ally.y, z: ally.z },
    );
  }
  if (isMeleeAdjacent(
    { x: source.x, y: source.y, z: source.z },
    { x: ally.x, y: ally.y, z: ally.z },
  )) return 0;
  return Number.POSITIVE_INFINITY;
}

function handleAttackFumbles(
  ability: ParsedAbility,
  source: UnitInstance,
  allUnits: readonly UnitInstance[],
  session: ResolutionSession,
  resolver: AbilityResolver,
): void {
  for (const spec of ability.rolls) {
    if (spec.kind !== 'attack') continue;
    const results = session.rollResults.get(spec.id) ?? [];
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i] as AttackRollResult;
      if (!result.fumble) continue;
      const alliesInRange = allUnits
        .filter((u) => u.id !== source.id && u.team === source.team && u.hp > 0)
        .filter((u) => Number.isFinite(allyDistance(ability, source, u)));
      if (alliesInRange.length === 0) {
        source.addCondition('prone', 1);
        session.emit({
          owner: session.ownerFor(source),
          label: `${source.name} 大失败，进入击倒`,
          kind: 'status',
          unitId: source.id,
          total: 1,
          detail: '攻击范围内无队友 → 自身击倒',
        });
        continue;
      }
      let candidates = [...alliesInRange];
      const minLuck = Math.min(...candidates.map((u) => u.attrValue('幸运')));
      candidates = candidates.filter((u) => u.attrValue('幸运') === minLuck);
      let guard = 0;
      while (candidates.length > 1) {
        guard += 1;
        if (guard > 100) throw new Error('大失败队友选择出现死循环');
        const rolls = candidates.map((u) => ({ unit: u, roll: session.rng.die(20) }));
        for (const r of rolls) {
          session.emit({
            owner: session.ownerFor(source),
            label: `大失败误伤目标判定：${r.unit.name}`,
            kind: 'attack',
            unitId: r.unit.id,
            targetId: source.id,
            total: r.roll,
            detail: `D20 = ${r.roll}`,
          });
        }
        const lowest = Math.min(...rolls.map((r) => r.roll));
        candidates = rolls.filter((r) => r.roll === lowest).map((r) => r.unit);
      }
      const ally = candidates[0] as UnitInstance;
      const reroll = resolver.resolveAttackRoll(spec, source, ally, session, false);
      result.target = ally;
      result.d20 = reroll.d20;
      result.values = reroll.values;
      result.total = reroll.total;
      result.hit = reroll.hit;
      result.crit = reroll.crit;
      result.fumble = false;
      session.emit({
        owner: session.ownerFor(source),
        label: `${source.name} 大失败，误伤队友 ${ally.name}`,
        kind: 'attack',
        unitId: source.id,
        targetId: ally.id,
        total: reroll.total,
        detail: `对队友重新进行命中检定：${reroll.hit ? '命中' : '未命中'}（不会再触发大失败）`,
      });
    }
  }
}

function settlePendingDamage(session: ResolutionSession, outcome: ResolveOutcome): void {
  for (const [targetId, components] of session.pendingDamage) {
    if (components.length === 0) continue;
    const target = session.targets.find((u) => u.id === targetId);
    if (!target) continue;

    let rawTotal = 0;
    let finalTotal = 0;
    const notes: string[] = [];
    for (const component of components) {
      const type = component.damageType ?? '物理';
      const resistance = target.resistances.get(type) ?? 0;
      const vulnerability = target.vulnerabilities.get(type) ?? 0;
      const modified = Math.max(0, component.raw + vulnerability - resistance);
      rawTotal += component.raw;
      finalTotal += modified;
      if (resistance || vulnerability) {
        notes.push(`${type} ${component.raw}${vulnerability ? `+${vulnerability}` : ''}${resistance ? `-${resistance}` : ''}=${modified}`);
      }
      if (vulnerability > 0 && component.raw > 0) {
        // 暗影护甲规则：承受光耀/神圣伤害后立即移除该效果
        target.acBonus = 0;
        target.acCap = null;
        target.resistances.clear();
        target.vulnerabilities.clear();
        target.removeCondition('shadow_armor');
        notes.push('暗影护甲被光耀/神圣伤害移除');
      }
    }
    let finalDamage = Math.max(0, Math.floor(finalTotal));
    if ((session.source.marks.get('bide_time_penalty') ?? 0) > 0) {
      finalDamage = Math.floor(finalDamage / 2);
    }
    if (finalDamage <= 0) continue;
    const dealt = target.applyDamage(finalDamage);
    if ((session.source.marks.get('blade_gun_burn_pending') ?? 0) > 0
        && target.team !== session.source.team
        && target.hp > 0) {
      session.source.marks.set('blade_gun_burn_pending', 0);
      const burnCard = session.statusCatalog.get('burning');
      target.addCondition('burning', 1, burnCard?.maxLayers ?? 99);
      outcome.appliedStatuses.push({ targetId: target.id, status: 'burning', layers: 1 });
      session.emit({
        owner: session.ownerFor(session.source),
        label: `${target.name} 进入灼烧`,
        kind: 'status',
        unitId: target.id,
        total: 1,
        detail: '剑炮齐奏：同回合近远攻击后下一次伤害令目标灼烧',
      });
    }
    outcome.damageByTarget.set(target.id, (outcome.damageByTarget.get(target.id) ?? 0) + dealt);
    if (target.hp <= 0) outcome.killedTargetIds.push(target.id);
    session.emit({
      owner: session.ownerFor(session.source),
      label: `${session.source.name} 对 ${target.name} 最终伤害`,
      kind: 'damage',
      unitId: session.source.id,
      targetId: target.id,
      total: finalDamage,
      detail: `分量合计 ${rawTotal}${notes.length ? `（${notes.join('；')}）` : ''} → 最终 ${finalDamage} → HP ${target.hp}/${target.hpMax}`,
    });
  }
}

interface ChargeCandidate {
  destination: Vec2;
  direction: Direction;
  path: Vec2[];
  cost: number;
}

function resolveChargeCandidates(
  source: UnitInstance,
  target: UnitInstance,
  board: Board,
  units: readonly UnitInstance[],
  maxCost: number,
): ChargeCandidate[] {
  const candidates: ChargeCandidate[] = [];
  for (const direction of DIRECTIONS_8) {
    const vector = DIRECTIONS_8.find((d) => d === direction) as string;
    const path: Vec2[] = [];
    let x = source.x;
    let y = source.y;
    let cost = 0;
    const dx = direction === 'N' || direction === 'S' ? 0 : direction === 'NE' || direction === 'SE' || direction === 'SW' || direction === 'NW'
      ? (direction === 'NE' || direction === 'SE' ? 1 : -1)
      : direction === 'E' ? 1 : -1;
    const dy = direction === 'N' ? -1 : direction === 'S' ? 1
      : direction === 'NE' || direction === 'NW' ? -1 : direction === 'SE' || direction === 'SW' ? 1 : 0;
    while (true) {
      x += dx;
      y += dy;
      const stepCost = dx !== 0 && dy !== 0 ? 2 : 1;
      if (cost + stepCost > maxCost) break;
      cost += stepCost;
      const cell: Vec2 = { x, y };
      if (!board.canStandAt(source, x, y, units)) break;
      path.push(cell);
      if (isMeleeAdjacent({ x, y, z: source.z }, { x: target.x, y: target.y, z: target.z })) {
        candidates.push({ destination: cell, direction, path: [...path], cost });
        break;
      }
    }
  }
  return candidates;
}

export interface AbilityPreview {
  ability: ParsedAbility;
  targets: UnitInstance[];
  conditionErrors: string[];
  costError: string | null;
  areaCells: Vec2[];
}

/** 不改变任何状态：解析能力、合法目标、条件与费用错误、范围格。 */
export function previewAbility(
  card: AbilityCardData,
  source: UnitInstance,
  encounter: Encounter,
  opts: ExecuteAbilityOptions,
): AbilityPreview {
  const ability = parseAbility(card, opts.level ?? source.card.level ?? 1);
  const resolver = new AbilityResolver(opts);
  const targets = resolver.resolveTargets(ability, source, encounter.units);
  const conditionErrors = resolver.checkConditions(ability, source, targets, encounter.units);
  const costError = resolver.checkCastCost(ability, source, opts.skipActionCost);
  let areaCells: Vec2[] = [];
  if (ability.targeting.kind === 'area' && ability.targeting.shape === 'cone') {
    areaCells = coneCells({ x: source.x, y: source.y }, source.facing, ability.targeting.rings).cells;
  }
  return { ability, targets, conditionErrors, costError, areaCells };
}

function hitProbability(bonus: number, ac: number): number {
  let hits = 0;
  for (let d20 = 1; d20 <= 20; d20 += 1) {
    if (d20 === 1) continue;
    if (d20 === 20 || d20 + bonus >= ac) hits += 1;
  }
  return hits / 20;
}

export interface AbilityAttackPreview {
  bonus: number;
  mode: 'normal' | 'advantage' | 'disadvantage';
  vsAc: number;
  hitChance: number;
}

/** 计算能力卡中第一个攻击检定的命中预览。 */
export function previewAttackRoll(
  card: AbilityCardData,
  source: UnitInstance,
  target: UnitInstance,
  encounter: Encounter,
  opts: ExecuteAbilityOptions,
): AbilityAttackPreview | null {
  const ability = parseAbility(card, opts.level ?? source.card.level ?? 1);
  const spec = ability.rolls.find((r) => r.kind === 'attack');
  if (!spec) return null;
  const resolver = new AbilityResolver(opts);
  return resolver.computeAttackPreview(ability, spec, source, target, encounter.units, opts.statusCatalog ?? new Map());
}

// ---------- 执行入口 ----------

function branchMatches(outcome: string, result: AttackRollResult | SaveRollResult | AoeSaveResult): boolean {
  if ('hit' in result && 'crit' in result) {
    const attack = result as AttackRollResult;
    if (outcome === 'hit') return attack.hit;
    if (outcome === 'miss') return !attack.hit;
    if (outcome === 'crit') return attack.crit;
    return false;
  }
  const save = result as SaveRollResult;
  if (outcome === 'saveSuccess') return save.success;
  if (outcome === 'saveFail') return !save.success;
  if (outcome === 'saveCriticalSuccess') return save.critSuccess;
  if (outcome === 'saveCriticalFail') return save.critFail;
  return false;
}

export function executeAbility(
  card: AbilityCardData,
  source: UnitInstance,
  encounter: Encounter,
  opts: ExecuteAbilityOptions,
): ResolveOutcome {
  const outcome: ResolveOutcome = {
    ok: false,
    events: [],
    damageByTarget: new Map(),
    appliedStatuses: [],
    killedTargetIds: [],
    attackHitTargetIds: [],
    attackCritTargetIds: [],
    consumedCombo: 0,
  };
  const ability = parseAbility(card, opts.level ?? source.card.level ?? 1);
  const resolver = new AbilityResolver(opts);
  const targets = opts.targets ?? resolver.resolveTargets(ability, source, encounter.units);
  if (targets.length === 0) {
    outcome.reason = '没有合法目标';
    return outcome;
  }

  const conditionErrors = resolver.checkConditions(ability, source, targets, encounter.units);
  if (conditionErrors.length > 0) {
    outcome.reason = conditionErrors.join('；');
    return outcome;
  }
  const costError = resolver.checkCastCost(ability, source, opts.skipActionCost);
  if (costError) {
    outcome.reason = costError;
    return outcome;
  }

  const session = new ResolutionSession(source, targets, ability, opts);
  if (ability.damageTypeChoice) {
    const selected = opts.damageTypeChoice ?? ability.damageTypeChoice[0] ?? '物理';
    session.chosenDamageType = selected;
  }

  resolver.payCastCost(ability, source, opts.skipActionCost);

  // 技能自带位移（短剑断奏/暗影步）：在攻击结算前移动
  if (ability.movement) {
    if (ability.movement.mode === 'teleport') {
      const target = targets[0] as UnitInstance;
      const cells: Vec2[] = [];
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = target.x + dx; const y = target.y + dy;
        if (encounter.board.canStandAt(source, x, y, encounter.units)) cells.push({ x, y });
      }
      if (cells.length === 0) { outcome.reason = '目标周围没有可站立位置'; return outcome; }
      const idx = opts.chooseDestination ? opts.chooseDestination(cells, '选择暗影步落点') : 0;
      const cell = cells[Math.max(0, idx)] as Vec2;
      source.x = cell.x; source.y = cell.y;
      session.emit({ owner: session.ownerFor(source), label: `${source.name} 跃迁`, kind: 'move', unitId: source.id, targetId: target.id, total: 0, detail: `跃迁至 ${cell.x},${cell.y}` });
    } else {
      const candidates = resolveChargeCandidates(
        source,
        targets[0] as UnitInstance,
        encounter.board,
        encounter.units,
        ability.movement.maxCost ?? 4,
      );
      if (candidates.length === 0) {
        outcome.reason = '没有合法的冲锋落点';
        return outcome;
      }
      const selectedIndex = opts.chooseDestination
        ? opts.chooseDestination(candidates.map((c) => c.destination), '选择冲锋落点')
        : 0;
      const selected = candidates[Math.max(0, selectedIndex)] ?? candidates[0];
      if (!selected) {
        outcome.reason = '冲锋落点选择无效';
        return outcome;
      }
      const oldPos = { x: source.x, y: source.y };
      source.x = selected.destination.x;
      source.y = selected.destination.y;
      source.facing = selected.direction;
      session.emit({
        owner: session.ownerFor(source),
        label: `${source.name} 位移至 ${selected.destination.x},${selected.destination.y}`,
        kind: 'move',
        unitId: source.id,
        targetId: targets[0]?.id,
        total: selected.cost,
        detail: `起点 ${oldPos.x},${oldPos.y} → ${selected.destination.x},${selected.destination.y}（${selected.direction}，成本${selected.cost}，借机${ability.movement.triggerOpportunity ? '触发' : '不触发'}）`,
      });
    }
  }

  // 1) 先解析 AOE 伤害豁免（后续附加豁免依赖其是否造成伤害）
  for (const spec of ability.rolls.filter((r) => r.kind === 'aoeDamageSave')) {
    const results: Array<AttackRollResult | SaveRollResult | AoeSaveResult> = [];
    for (const target of targets) {
      results.push(resolver.resolveAoeSaveRoll(spec, source, target, session));
    }
    session.rollResults.set(spec.id, results);
  }

  // 2) 执行全局效果（AOE 伤害在此处根据已解析的豁免结果结算，并标记受伤目标）
  executeEffects(ability.effects, source, targets[0] as UnitInstance, session, resolver, outcome);

  // 3) 解析其余掷骰（攻击、普通豁免）
  for (const spec of ability.rolls.filter((r) => r.kind !== 'aoeDamageSave')) {
    const results: Array<AttackRollResult | SaveRollResult | AoeSaveResult> = [];
    for (const target of targets) {
      if (spec.when && !resolver.evalWhen(spec.when, source, target, session)) continue;
      if (spec.kind === 'attack') {
        results.push(resolver.resolveAttackRoll(spec, source, target, session));
      } else if (spec.kind === 'save') {
        if (spec.autoSuccessIfProf && spec.attr && target.hasSaveProf(spec.attr as AttrName)) {
          session.emit({
            owner: session.ownerFor(target),
            label: `${target.name} ${spec.attr}豁免自动成功`,
            kind: 'save',
            unitId: target.id,
            targetId: source.id,
            total: 0,
            detail: '拥有魅力豁免熟练，自动成功',
          });
          results.push({ target, d20: 0, total: 0, success: true, critSuccess: false, critFail: false });
        } else {
          results.push(resolver.resolveSaveRoll(spec, source, target, session));
        }
      } else if (spec.kind === 'armorCheck') {
        results.push(resolver.resolveArmorCheckRoll(spec, source, target, session));
      } else {
        results.push(resolver.resolveAoeSaveRoll(spec, source, target, session));
      }
    }
    session.rollResults.set(spec.id, results);
  }

  handleAttackFumbles(ability, source, encounter.units, session, resolver);
  for (const attackResults of session.rollResults.values()) {
    for (const result of attackResults) {
      if ('crit' in result && result.crit) session.critTargetIds.add(result.target.id);
      if ('hit' in result && result.hit) session.attackHitTargetIds.add(result.target.id);
    }
  }

  // 分支效果
  const cancelledTargetIds = new Set<string>();
  for (const branch of ability.branches) {
    const results = session.rollResults.get(branch.roll) ?? [];
    for (const result of results) {
      if (branchMatches(branch.outcome, result)) {
        if (opts.cancelHitEffects?.(source, result.target, ability)) {
          cancelledTargetIds.add(result.target.id);
          session.emit({
            owner: session.ownerFor(result.target),
            label: `${result.target.name} 反应抵消本次命中效果`,
            kind: 'status',
            unitId: result.target.id,
            targetId: source.id,
            total: 0,
            detail: '伤害与后续效果被反应能力完全抵消',
          });
          continue;
        }
        executeEffects(branch.effects, source, result.target, session, resolver, outcome);
      }
    }
  }

  // 分支结算后再执行 afterEffects（如消耗全部连击点）
  executeEffects(ability.afterEffects, source, targets[0] as UnitInstance, session, resolver, outcome);

  settlePendingDamage(session, outcome);

  // 潜行规则：发动攻击（含近战/远程/施法攻击/基础攻击）后立即显形。
  if (source.stealthed && ability.cast.keywords.some((k) => ['近战攻击', '远程攻击', '施法攻击', '基础攻击'].includes(k))) {
    source.stealthed = false;
    session.emit({
      owner: session.ownerFor(source),
      label: `${source.name} 发动攻击，解除潜行`,
      kind: 'status',
      unitId: source.id,
      total: 0,
      detail: '攻击解除潜行',
    });
  }

  if (opts.poisonCatalog && (ability.cast.keywords.includes('近战攻击') || ability.cast.keywords.includes('基础攻击'))) {
    for (const targetId of session.attackHitTargetIds) {
      if (cancelledTargetIds.has(targetId)) continue;
      const target = encounter.unitById(targetId);
      if (target) session.events.push(...triggerWeaponPoisons(source, target, encounter, {
        rng: opts.rng,
        statusCatalog: opts.statusCatalog ?? new Map(),
        poisonCatalog: opts.poisonCatalog,
      }));
    }
  }

  outcome.ok = true;
  outcome.events = session.events;
  outcome.attackHitTargetIds = [...session.attackHitTargetIds];
  outcome.attackCritTargetIds = [...session.critTargetIds];
  outcome.consumedCombo = session.consumedResource;
  return outcome;
}
