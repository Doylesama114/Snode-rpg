import type { AbilityCardData } from './cards';
import type { CardCatalog } from './catalog';
import type { Encounter } from './encounter';
import type { UnitInstance } from './unit';
import type { SeededRng } from './rng';
import { Board } from './board';
import { directionFromTo, isMeleeAdjacent, combatDistance, gridDistance, line8Cells } from './geometry';
import { executeAbility, type ExecuteAbilityOptions, type ParsedAbility, type ResolveOutcome, type RollEvent } from './resolver';
import { executeBasicAttack, reloadWeapon } from './basic-actions';
import { evaluateExpression } from './expression';
import { parseAbility } from './resolver';
import type { PoisonCardData } from './poisons';
import { processTurnStartStatuses, performAimCheck } from './phases';
import {
  zoneCells, zoneCellsArray, resolveZoneTrigger, unitsInCells,
  type PhantomDaggerState, type SilhouetteInstance, type ZoneInstance,
} from './objects';
import type { Vec2 } from './types';

export type PvePhase = 'setup' | 'playerTurn' | 'enemyTurn' | 'ended';

export interface PveGameOptions {
  rng: SeededRng;
  catalog: CardCatalog;
  playerAbilities: AbilityCardData[];
  choose?: ExecuteAbilityOptions['choose'];
  chooseDestination?: ExecuteAbilityOptions['chooseDestination'];
  damageTypeChoice?: Record<string, string>;
  poisonCatalog?: Map<string, PoisonCardData>;
  shouldUseAnticipate?: (enemy: UnitInstance) => boolean;
  shouldUseLockThroat?: (enemy: UnitInstance) => boolean;
  chooseSprintTarget?: (targets: UnitInstance[]) => number;
  /** P2：示敌以弱触发确认。 */
  shouldUseFeignWeakness?: (enemy: UnitInstance) => boolean;
  /** P2：选择 3×3 区域中心格。 */
  chooseZoneCenter?: (candidates: Vec2[]) => number;
  /** P2：毒性蔓延选择效果（返回 0~3）。 */
  chooseToxinEffect?: (options: string[]) => number;
  /** UI：敌方回合逐名暂停（BG3式反应弹窗），由 app 调用 stepEnemyTurn。 */
  pauseEnemyTurns?: boolean;
}

export interface MoveResult {
  ok: boolean;
  reason?: string;
  from?: Vec2;
  to?: Vec2;
  cost?: number;
  activated: 'basic' | 'dash' | 'none';
}

export class PveGame {
  readonly encounter: Encounter;
  readonly rng: SeededRng;
  readonly catalog: CardCatalog;
  readonly playerAbilities: AbilityCardData[];
  private readonly opts: PveGameOptions;
  phase: PvePhase = 'setup';

  private playerHasDealtDamage = false;
  pendingFeint: { targetId: string; refundAction: 'main' | 'bonus'; refundFp: number } | null = null;
  pendingChainAssault = false;
  pendingSprintBurst = false;

  // ---------- P2 状态 ----------
  /** 本回合玩家是否已使用过第一个动作。 */
  playerTurnFirstActionUsed = false;
  /** 伺机待发：下一个自身回合额外获得主要动作。 */
  pendingBideExtraMain = false;
  /** 蝶舞引导状态。 */
  channelingButterfly: { startRound: number } | null = null;
  butterflyCompletedThisTurn = false;
  butterflyExtraCombo = 0;
  elusiveTeleportPending: Vec2 | null = null;
  elusivePathCandidates: Vec2[] = [];
  /** 蝶舞首次魅惑的敌方目标（用于完成引导后结算）。 */
  butterflyTargetIds: string[] = [];
  /** 连击循环生效期间消耗的连击点。 */
  comboSpentDuringCycle = 0;
  comboCycleActiveFlag = false;
  /** 剑炮齐奏标记。 */
  bladeGunMarks = 0;
  bladeGunRangedCritPending = false;
  bladeGunBurnPending = false;
  playerTurnUsedMeleeAttack = false;
  playerTurnUsedRangedAttack = false;
  /** 本场玩家是否承受过伤害（飘忽不定前置）。 */
  playerTookDamageThisBattle = false;
  /** 本场玩家是否造成过伤害（伺机待发前置）。 */
  playerDealtDamageThisBattle = false;
  /** 嫁祸诀窍：被选为嫁祸目标；本场被影响过的角色集合。 */
  sowDiscordTargetId: string | null = null;
  sowDiscordAffectedIds = new Set<string>();
  pendingFeignRequest: { enemyId: string; hpBefore: number; damage: number } | null = null;
  /** 幻影匕首/剪影/旋刃魂曲。 */
  phantomDagger: PhantomDaggerState | null = null;
  silhouettes: SilhouetteInstance[] = [];
  zones: ZoneInstance[] = [];
  private objectSerial = 0;

  /** 最近一次自动敌方回合的结算信息，供 UI 播放自动掷骰动画。 */
  lastEnemyEvents: RollEvent[] = [];
  lastEnemyDamageByTarget = new Map<string, number>();
  lastEnemyAppliedStatuses: Array<{ targetId: string; status: string; layers: number }> = [];

  constructor(encounter: Encounter, opts: PveGameOptions) {
    this.encounter = encounter;
    this.rng = opts.rng;
    this.catalog = opts.catalog;
    this.playerAbilities = opts.playerAbilities;
    this.opts = opts;
  }

  get player(): UnitInstance {
    const player = this.encounter.units.find((u) => u.team === 'player');
    if (!player) throw new Error('遭遇中没有玩家单位');
    return player;
  }

  get currentUnit(): UnitInstance | null {
    return this.encounter.currentUnit;
  }

  start(): PvePhase {
    this.applyBattleStartPassives();
    this.syncPassives();
    this.encounter.start();
    this.onTurnStarted(this.encounter.currentUnit);
    this.phase = this.phase === 'ended'
      ? 'ended'
      : this.encounter.currentUnit?.team === 'player' ? 'playerTurn' : 'enemyTurn';
    if (this.phase === 'enemyTurn' && !this.opts.pauseEnemyTurns) this.runEnemyTurns();
    return this.phase;
  }

  private onTurnStarted(unit: UnitInstance | null): void {
    if (!unit) return;
    if (unit.team === 'player') {
      this.playerTurnFirstActionUsed = false;
      this.playerTurnUsedMeleeAttack = false;
      this.playerTurnUsedRangedAttack = false;
      this.bladeGunBurnPending = false;
      this.butterflyCompletedThisTurn = false;
      this.elusivePathCandidates = [];
      this.phantomDagger = this.phantomDagger && this.phantomDagger.expiresAtOwnerSerial > unit.turnSerial
        ? this.phantomDagger : null;
      this.silhouettes = this.silhouettes.filter((s) => s.expiresAtOwnerSerial > unit.turnSerial);
      this.zones = this.zones.filter((z) => z.expiresAtOwnerSerial > unit.turnSerial);
      if (this.pendingBideExtraMain) {
        unit.extraMainActions += 1;
        this.pendingBideExtraMain = false;
      }
      unit.marks.delete('bide_time_penalty');
      unit.marks.delete('blade_gun_burn_pending');
      if (unit.isControlOrIncapacitated()) this.clearPlayerConcentration();
      if (this.comboCycleActiveFlag) {
        unit.gainCombo(this.comboSpentDuringCycle);
        this.comboSpentDuringCycle = 0;
        this.comboCycleActiveFlag = false;
      }
      if (this.elusiveTeleportPending) {
        const cell = this.elusiveTeleportPending;
        this.elusiveTeleportPending = null;
        if (this.encounter.board.canStandAt(unit, cell.x, cell.y, this.encounter.units)) {
          unit.x = cell.x;
          unit.y = cell.y;
          this.lastEnemyEvents.push({
            owner: 'player', label: `${unit.name} 飘忽不定跃迁`, kind: 'move',
            unitId: unit.id, total: 0, detail: `跃迁至 ${cell.x},${cell.y}`,
          });
        }
      }
    }
    const events = processTurnStartStatuses(unit, this.encounter, this.catalog.statuses, this.rng);
    this.lastEnemyEvents.push(...events);
    const outcome = this.encounter.checkOutcome();
    if (outcome !== 'ongoing') {
      this.encounter.finish(outcome);
      this.phase = 'ended';
    }
  }

  private emptyOutcome(reason: string): ResolveOutcome {
    return {
      ok: false,
      reason,
      events: [],
      damageByTarget: new Map(),
      appliedStatuses: [],
      killedTargetIds: [],
      attackHitTargetIds: [],
      attackCritTargetIds: [],
      consumedCombo: 0,
    };
  }

  /** 玩家使用指定能力卡。 */
  playerUseAbility(
    abilityId: string,
    targetIds: string[],
    opts: { damageTypeChoice?: string } = {},
  ): ReturnType<typeof executeAbility> {
    if (this.phase !== 'playerTurn') return this.emptyOutcome('不是玩家回合');
    if (this.channelingButterfly && !this.butterflyCompletedThisTurn) {
      return this.emptyOutcome('蝶舞引导中：只能完成引导，不能执行其他动作');
    }
    const card = this.catalog.abilities.get(abilityId)
      ?? this.playerAbilities.find((a) => a.id === abilityId);
    if (!card) return this.emptyOutcome(`能力不存在: ${abilityId}`);
    const targets = targetIds
      .map((id) => this.encounter.unitById(id))
      .filter((u): u is UnitInstance => !!u);
    if (targets.length === 0) return this.emptyOutcome('目标不存在');
    if ((card.conditions ?? []).some((c) => (c as Record<string, unknown>).kind === 'firstAction')
        && this.playerTurnFirstActionUsed) {
      return this.emptyOutcome('伺机待发必须是本回合第一个动作');
    }
    const usage = card.cast?.usage;
    if (usage && usage.scope && usage.max !== 99 && usage.max !== undefined) {
      const key = `${abilityId}:${usage.scope}`;
      if (!this.player.canUseUsage(key, Number(usage.max))) return this.emptyOutcome('使用次数已耗尽');
    }
    const cardKeywords = card.cast?.keywords ?? [];
    if (this.hasPassive('rogue-blade-gun-duet') && cardKeywords.includes('远程攻击')) {
      this.player.marks.set('blade_gun_marks', this.bladeGunMarks);
      this.bladeGunMarks = 0;
    }
    const toxinBonus = (this.player.marks.get('toxin_spread_bonus') ?? 0) > 0 && abilityId === 'rogue-poison-blade';
    const effectiveCard = toxinBonus
      ? { ...card, cast: { ...card.cast, action: 'bonus' } }
      : card;
    const result = executeAbility(effectiveCard, this.player, this.encounter, {
      rng: this.rng,
      statusCatalog: this.catalog.statuses,
      level: this.player.card.level,
      targets,
      choose: this.opts.choose,
      chooseDestination: this.opts.chooseDestination,
      damageTypeChoice: opts.damageTypeChoice ?? this.opts.damageTypeChoice?.[abilityId],
      poisonCatalog: this.opts.poisonCatalog,
    });
    this.syncPassives();
    if (result.ok) {
      if (abilityId === 'rogue-sprint-burst') this.pendingSprintBurst = true;
      else this.pendingSprintBurst = false;
      this.pendingChainAssault = (result.killedTargetIds ?? []).length > 0 && this.hasPassive('rogue-chain-assault');
      const damaged = [...result.damageByTarget.keys()][0];
      if (damaged) {
        const target = this.encounter.unitById(damaged);
        if (target) this.applyFirstBlood(target);
      }
      if (abilityId === 'rogue-poison-blade') {
        this.player.marks.delete('toxin_spread_double');
        this.player.marks.delete('toxin_spread_bonus');
      }
      if (usage && usage.scope && usage.max !== 99 && usage.max !== undefined) {
        this.player.spendUsage(`${abilityId}:${usage.scope}`);
      }
      this.afterPlayerAbilitySuccess(abilityId, effectiveCard, targets, result);
      this.afterPlayerAction();
    }
    return result;
  }

  private afterPlayerAbilitySuccess(
    abilityId: string,
    card: AbilityCardData,
    targets: UnitInstance[],
    result: ResolveOutcome,
  ): void {
    const player = this.player;
    if (card.cast?.action && card.cast.action !== 'none') this.playerTurnFirstActionUsed = true;
    if (result.damageByTarget.size > 0) this.playerDealtDamageThisBattle = true;
    if (result.consumedCombo > 0 && player.hasCondition('combo_cycle')) {
      this.comboSpentDuringCycle += result.consumedCombo;
    }

    const keywords = card.cast?.keywords ?? [];
    if (keywords.includes('专注')) {
      this.clearPlayerConcentration();
    }
    const isMeleeAttack = keywords.includes('近战攻击');
    const isRangedAttack = keywords.includes('远程攻击');
    if (isMeleeAttack) this.playerTurnUsedMeleeAttack = true;
    if (isRangedAttack) this.playerTurnUsedRangedAttack = true;

    // 剑炮齐奏：剑类近战命中后叠标记。
    if (isMeleeAttack && (player.weapon?.category === '剑类' || player.offhand?.category === '剑类')) {
      this.bladeGunMarks += result.attackHitTargetIds.length;
    }
    if (isRangedAttack && result.attackCritTargetIds.length > 0) {
      this.bladeGunRangedCritPending = true;
    }
    if (isMeleeAttack && this.bladeGunRangedCritPending && result.attackHitTargetIds.length > 0) {
      this.bladeGunRangedCritPending = false;
      const bonus = (player.card.level ?? 1) >= 6 ? (player.card.level ?? 1) : 5;
      for (const targetId of result.attackHitTargetIds) {
        const target = this.encounter.unitById(targetId);
        if (!target || target.hp <= 0) continue;
        target.loseHp(bonus);
        result.damageByTarget.set(targetId, (result.damageByTarget.get(targetId) ?? 0) + bonus);
        if (target.hp <= 0) result.killedTargetIds.push(targetId);
        result.events.push({
          owner: 'player',
          label: `${player.name} 剑炮齐奏近战加成`,
          kind: 'damage',
          unitId: player.id,
          targetId: target.id,
          total: bonus,
          detail: `远程暴击后，下一次近战结算后 +${bonus}`,
        });
      }
    }
    if (result.attackCritTargetIds.length > 0 && this.hasPassive('rogue-blade-gun-duet')) {
      player.gainCombo(result.attackCritTargetIds.length);
    }
    if (this.hasPassive('rogue-blade-gun-duet')
        && this.playerTurnUsedMeleeAttack
        && this.playerTurnUsedRangedAttack) {
      player.marks.set('blade_gun_burn_pending', 1);
    }


    for (const targetId of result.attackHitTargetIds) {
      const hitTarget = this.encounter.unitById(targetId);
      if (hitTarget) {
        hitTarget.marks.delete('provoke_duel');
        hitTarget.marks.delete('damage_advantage');
      }
    }

    // 暗里藏刀：落单时第一次近战攻击命中后 +10（L5 +15）。
    if (
      isMeleeAttack
      && result.attackHitTargetIds.length > 0
      && this.isLone(player)
      && this.hasPassive('rogue-hidden-blade')
      && player.canUseUsage('rogue-hidden-blade:perBattle', 1)
    ) {
      player.spendUsage('rogue-hidden-blade:perBattle');
      const bonus = (player.card.level ?? 1) >= 5 ? 15 : 10;
      for (const targetId of result.attackHitTargetIds) {
        const target = this.encounter.unitById(targetId);
        if (!target) continue;
        target.loseHp(bonus);
        result.damageByTarget.set(targetId, (result.damageByTarget.get(targetId) ?? 0) + bonus);
        if (target.hp <= 0) result.killedTargetIds.push(targetId);
        result.events.push({
          owner: 'player',
          label: `${player.name} 暗里藏刀`,
          kind: 'damage',
          unitId: player.id,
          targetId: target.id,
          total: bonus,
          detail: `落单近战命中，结算后 +${bonus} → HP ${target.hp}/${target.hpMax}`,
        });
      }
    }

    // 死亡印记：终结技命中带印记目标直接处决（E2 方案B）。
    if (keywords.includes('终结技')) {
      for (const targetId of result.attackHitTargetIds) {
        const target = this.encounter.unitById(targetId);
        if (!target || (target.marks.get('death_mark') ?? 0) <= 0 || target.hp <= 0) continue;
        const before = target.hp;
        target.hp = 0;
        if (!result.killedTargetIds.includes(target.id)) result.killedTargetIds.push(target.id);
        result.events.push({
          owner: 'player',
          label: `死亡印记处决 ${target.name}`,
          kind: 'loseHp',
          unitId: target.id,
          targetId: player.id,
          total: before,
          detail: '终结技命中，无视反制直接处决 → HP 0',
        });
      }
    }

    // 冷血杀手：单体近战攻击造成伤害后，HP 1~4 归零。
    if (
      isMeleeAttack
      && targets.length === 1
      && this.hasPassive('rogue-cold-blood')
      && result.attackHitTargetIds.length > 0
    ) {
      const target = targets[0];
      if (target && target.hp > 0 && target.hp < 5) {
        target.hp = 0;
        if (!result.killedTargetIds.includes(target.id)) result.killedTargetIds.push(target.id);
        result.events.push({
          owner: 'player',
          label: `冷血杀手处决 ${target.name}`,
          kind: 'loseHp',
          unitId: target.id,
          targetId: player.id,
          total: 0,
          detail: '单体近战攻击后 HP 低于 5 → 0',
        });
      }
    }

    // 幻影匕首：每次单目标攻击后对同一目标攻击。
    if (this.phantomDagger && targets.length === 1 && (keywords.includes('基础攻击') || keywords.includes('近战攻击') || keywords.includes('远程攻击') || keywords.includes('施法攻击'))) {
      const extra = this.executePhantomDaggerAttack(targets[0] as UnitInstance);
      result.events.push(...extra.events);
      for (const [id, amount] of extra.damageByTarget) {
        result.damageByTarget.set(id, (result.damageByTarget.get(id) ?? 0) + amount);
      }
      for (const id of extra.killedTargetIds) {
        if (!result.killedTargetIds.includes(id)) result.killedTargetIds.push(id);
      }
    }

    // 技能自身特效。
    if (abilityId === 'rogue-bide-time' && result.ok) {
      this.pendingBideExtraMain = true;
    }
    if (abilityId === 'rogue-combo-cycle' && result.ok) {
      this.comboCycleActiveFlag = true;
      this.comboSpentDuringCycle = 0;
    }
    if (abilityId === 'rogue-butterfly-dance' && result.ok) {
      this.channelingButterfly = { startRound: this.encounter.round };
      this.butterflyTargetIds = targets.map((t) => t.id);
      if (player.actions.bonus) player.actions.bonus = false; // 引导开始轮未用完的附赠被浪费
    }
    if (abilityId === 'rogue-sow-discord' && targets[0]) {
      this.sowDiscordTargetId = targets[0].id;
    }
    if (abilityId === 'rogue-death-mark' && targets[0] && (player.card.level ?? 1) >= 10) {
      targets[0].shieldedMarks.add('death_mark');
    }
    if (abilityId === 'rogue-phantom-dagger') {
      this.phantomDagger = {
        id: `phantom-${this.nextObjectId()}`,
        sourceId: player.id,
        attacksUsed: 0,
        expiresAtOwnerSerial: player.turnSerial + 3,
      };
    }
    if (abilityId === 'rogue-silhouette' && targets[0]) {
      this.createSilhouette(targets[0] as UnitInstance);
    }
    if (abilityId === 'rogue-nowhere-to-run' && targets[0]) {
      const t = targets[0];
      const noFreeCell = !this.firstFreeAdjacentCell(t);
      if (noFreeCell || t.hasCondition('restrained') || t.hasCondition('grappled')) {
        t.marks.set('damage_advantage', 1);
      }
      this.tryBasicMoveToward(player, t as UnitInstance, result);
    }
    this.handleKills(result);
  }

  private executePhantomDaggerAttack(target: UnitInstance, countAttack = true): ResolveOutcome {
    const dagger = this.phantomDagger;
    if (!dagger) return this.emptyOutcome('幻影匕首已消散');
    const player = this.player;
    if (countAttack) dagger.attacksUsed += 1;
    const weapon = player.weapon;
    const bonus = player.weaponHitMod(weapon) + player.weaponProfBonus(weapon);
    const d20 = this.rng.die(20);
    const total = d20 + bonus;
    const hit = d20 !== 1 && (d20 === 20 || total >= target.effectiveAc());
    const crit = d20 === 20;
    const damage = hit ? ((crit ? 2 : 1) * this.rng.die(4) + player.attrMod(player.keyAttr)) : 0;
    const events: RollEvent[] = [{
      owner: 'player',
      label: `幻影匕首攻击 ${target.name}`,
      kind: 'attack',
      unitId: player.id,
      targetId: target.id,
      expression: `D20 + ${bonus}`,
      parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: 'player' }],
      total,
      detail: `${d20}+${bonus}=${total} vs AC${target.effectiveAc()} ${hit ? (crit ? '暴击命中' : '命中') : '未命中'}`,
    }];
    if (damage > 0) {
      target.applyDamage(damage);
      events.push({
        owner: 'player',
        label: `幻影匕首伤害 ${target.name}`,
        kind: 'damage',
        unitId: player.id,
        targetId: target.id,
        total: damage,
        detail: `1D4+关键属性=${damage} 灵能 → HP ${target.hp}/${target.hpMax}`,
      });
    }
    return {
      ok: hit,
      events,
      damageByTarget: new Map(damage > 0 ? [[target.id, damage]] : []),
      appliedStatuses: [],
      killedTargetIds: target.hp <= 0 && damage > 0 ? [target.id] : [],
      attackHitTargetIds: hit ? [target.id] : [],
      attackCritTargetIds: crit ? [target.id] : [],
      consumedCombo: 0,
    };
  }

  /** 飘忽不定 L5：从本次实际位移路径中选择一个位置标记。 */
  playerMarkElusiveTeleportOnPath(x: number, y: number): { ok: boolean; reason?: string } {
    const player = this.player;
    if ((player.card.level ?? 1) < 5) return { ok: false, reason: '需要游荡者5级' };
    if (!player.hasCondition('elusive')) return { ok: false, reason: '当前未处于飘忽不定' };
    if (!this.elusivePathCandidates.some((c) => c.x === x && c.y === y)) {
      return { ok: false, reason: '该格不在本次位移路径上' };
    }
    this.elusiveTeleportPending = { x, y };
    this.elusivePathCandidates = [];
    return { ok: true };
  }

  /** 飘忽不定 L5：标记位移过程中的一个位置，持续时间结束时跃迁过去。 */
  playerMarkElusiveTeleport(x: number, y: number): { ok: boolean; reason?: string } {
    const player = this.player;
    if ((player.card.level ?? 1) < 5) return { ok: false, reason: '需要游荡者5级' };
    if (!player.hasCondition('elusive')) return { ok: false, reason: '当前未处于飘忽不定' };
    if (!this.encounter.board.canStandAt(player, x, y, this.encounter.units)) {
      return { ok: false, reason: '该位置无法停留' };
    }
    this.elusiveTeleportPending = { x, y };
    return { ok: true };
  }

  /** 幻影匕首 L5/L10：三次攻击后的飞行指令。mode=0 沿途，mode=1 落点相邻。 */
  playerPhantomDaggerFlight(direction: 'N'|'NE'|'E'|'SE'|'S'|'SW'|'W'|'NW', mode: 0|1 = 0): ResolveOutcome {
    const dagger = this.phantomDagger;
    const player = this.player;
    if (!dagger) return this.emptyOutcome('没有幻影匕首');
    if ((player.card.level ?? 1) < 5) return this.emptyOutcome('需要游荡者5级');
    if (dagger.attacksUsed < 3) return this.emptyOutcome('幻影匕首还未完成三次攻击');
    const path = line8Cells({ x: player.x, y: player.y }, direction, 6);
    if (path.length === 0) return this.emptyOutcome('6米内没有可飞行格');
    const destination = path[path.length - 1] as Vec2;
    const candidates: UnitInstance[] = [];
    if (mode === 0) {
      for (const cell of path) {
        for (const unit of this.encounter.livingUnits()) {
          if (unit.id === player.id || unit.x !== cell.x || unit.y !== cell.y) continue;
          if (!candidates.includes(unit)) candidates.push(unit);
        }
      }
    } else {
      if ((player.card.level ?? 1) < 10) return this.emptyOutcome('L10才能使用落点相邻指令');
      for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = destination.x + dx; const y = destination.y + dy;
        for (const unit of this.encounter.livingUnits()) {
          if (unit.id !== player.id && unit.x === x && unit.y === y && !candidates.includes(unit)) candidates.push(unit);
        }
      }
    }
    const events: RollEvent[] = [];
    const damage = new Map<string, number>();
    const killed: string[] = [];
    for (const unit of candidates) {
      const extra = this.executePhantomDaggerAttack(unit, false);
      events.push(...extra.events);
      for (const [id, amount] of extra.damageByTarget) damage.set(id, (damage.get(id) ?? 0) + amount);
      killed.push(...extra.killedTargetIds);
    }
    events.push({
      owner: 'player', label: `幻影匕首飞行至 ${destination.x},${destination.y}`, kind: 'move',
      unitId: player.id, total: 6, detail: `${mode === 0 ? '沿途' : '落点相邻'}攻击 ${candidates.length} 名角色`,
    });
    return { ok: true, events, damageByTarget: damage, appliedStatuses: [], killedTargetIds: killed, attackHitTargetIds: candidates.filter((u) => u.hp > 0).map((u) => u.id), attackCritTargetIds: [], consumedCombo: 0 };
  }

  private createSilhouette(target: UnitInstance): void {
    const owner = this.player;
    const candidate = this.firstFreeAdjacentCell(target);
    if (!candidate) return;
    this.silhouettes.push({
      id: `silhouette-${this.nextObjectId()}`,
      sourceId: owner.id,
      targetId: target.id,
      x: candidate.x,
      y: candidate.y,
      expiresAtOwnerSerial: owner.turnSerial + ((owner.card.level ?? 1) >= 8 ? 2 : 1),
    });
  }

  private firstFreeAdjacentCell(target: UnitInstance): Vec2 | null {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = target.x + dx;
        const y = target.y + dy;
        if (this.encounter.board.canStandAt(this.player, x, y, this.encounter.units)) return { x, y };
      }
    }
    return null;
  }

  private tryBasicMoveToward(player: UnitInstance, target: UnitInstance, result: ResolveOutcome): void {
    if (player.dashUsedThisTurn || player.moveMode === 'dash') return;
    const approach = this.bestApproachCell(player, target);
    if (!approach) return;
    if (approach.cost > player.effectiveSpeed()) return;
    player.grantMove('basic', player.effectiveSpeed());
    const path = this.encounter.board.findPath(player, approach.cell, this.encounter.units, player.moveBudget);
    if (!path) return;
    player.consumeMoveBudget(path.cost);
    player.x = approach.cell.x;
    player.y = approach.cell.y;
    result.events.push({
      owner: 'player',
      label: `${player.name} 无处可逃·免费基础移动`,
      kind: 'move',
      unitId: player.id,
      targetId: target.id,
      total: path.cost,
      detail: `朝 ${target.name} 移动至 ${approach.cell.x},${approach.cell.y}（免费，不消耗动作）`,
    });
  }

  private nextObjectId(): number {
    this.objectSerial += 1;
    return this.objectSerial;
  }


  playerBasicAttack(targetId: string): ReturnType<typeof executeBasicAttack> {
    if (this.phase !== 'playerTurn') return { ok: false, reason: '不是玩家回合', events: [], damage: 0 };
    if (this.channelingButterfly && !this.butterflyCompletedThisTurn) {
      return { ok: false, reason: '蝶舞引导中无法攻击', events: [], damage: 0 };
    }
    const target = this.encounter.unitById(targetId);
    if (!target) return { ok: false, reason: '目标不存在', events: [], damage: 0 };
    if (this.hasPassive('rogue-blade-gun-duet') && this.player.weapon?.rangeMetric === 'grid') {
      this.player.marks.set('blade_gun_marks', this.bladeGunMarks);
      this.bladeGunMarks = 0;
    }
    const result = executeBasicAttack(this.player, target, this.encounter, this.rng, this.catalog.statuses, this.opts.poisonCatalog);
    if (result.ok) {
      if (result.damage > 0) this.applyFirstBlood(target);
      const miss = result.damage === 0 && result.events.some((e) => e.kind === 'attack' && e.detail?.includes('vs AC'));
      if (miss && this.hasPassive('rogue-feint') && this.player.canUseUsage('rogue-feint:shortRest', 1)) {
        this.pendingFeint = { targetId: target.id, refundAction: 'main', refundFp: 0 };
        this.player.actions.main = true;
      } else {
        this.pendingFeint = null;
      }
      this.pendingChainAssault = (result.killedTargetIds ?? []).length > 0 && this.hasPassive('rogue-chain-assault');
      this.syncPassives();
      this.handleBasicAttackPassives(target, result);
      this.afterPlayerAction();
    }
    return result;
  }

  private handleBasicAttackPassives(target: UnitInstance, result: ReturnType<typeof executeBasicAttack>): void {
    const player = this.player;
    this.playerTurnFirstActionUsed = true;
    const melee = player.weapon?.rangeMetric !== 'grid';
    this.playerTurnUsedMeleeAttack = melee;
    this.playerTurnUsedRangedAttack = !melee;
    const hit = result.damage > 0 || result.events.some((e) => e.kind === 'attack' && e.detail?.includes('命中'));
    target.marks.delete('provoke_duel');
    target.marks.delete('damage_advantage');
    const killed: ResolveOutcome = this.emptyOutcome('基础攻击被动结算');
    killed.killedTargetIds = target.hp <= 0 ? [target.id] : [];
    this.handleKills(killed);
    if (this.hasPassive('rogue-blade-gun-duet')) {
      if (!melee && this.bladeGunMarks > 0) this.bladeGunMarks = 0;
      if (melee && hit && player.weapon?.category === '剑类' && target.hp > 0) this.bladeGunMarks += 1;
      if (this.playerTurnUsedMeleeAttack && this.playerTurnUsedRangedAttack) {
        player.marks.set('blade_gun_burn_pending', 1);
      }
      const critEvent = result.events.some((e) => e.kind === 'attack' && e.detail?.includes('暴击'));
      if (critEvent) {
        player.gainCombo(1);
        if (!melee) this.bladeGunRangedCritPending = true;
      }
    }
    if (melee && hit && this.hasPassive('rogue-hidden-blade') && this.isLone(player)
        && player.canUseUsage('rogue-hidden-blade:perBattle', 1)) {
      player.spendUsage('rogue-hidden-blade:perBattle');
      const bonus = (player.card.level ?? 1) >= 5 ? 15 : 10;
      target.loseHp(bonus);
      this.lastPlayerExtraEvents.push({
        owner: 'player', label: `${player.name} 暗里藏刀`, kind: 'damage',
        unitId: player.id, targetId: target.id, total: bonus,
        detail: `落单近战命中，结算后 +${bonus} → HP ${target.hp}/${target.hpMax}`,
      });
    }
    if (melee && hit && target.hp > 0 && target.hp < 5 && this.hasPassive('rogue-cold-blood')) {
      target.hp = 0;
      this.lastPlayerExtraEvents.push({
        owner: 'player', label: `冷血杀手处决 ${target.name}`, kind: 'loseHp',
        unitId: target.id, targetId: player.id, total: 0, detail: '单体近战攻击后 HP 低于 5 → 0',
      });
    }
    if (target.hp > 0 && this.phantomDagger) {
      const extra = this.executePhantomDaggerAttack(target);
      this.lastPlayerExtraEvents.push(...extra.events);
    }
  }

  lastPlayerExtraEvents: RollEvent[] = [];

  /** 玩家移动到目标格；自动根据路径成本激活基础/全速移动。 */
  playerMoveTo(x: number, y: number): MoveResult {
    if (this.phase !== 'playerTurn') return { ok: false, reason: '不是玩家回合', activated: 'none' };
    if (this.channelingButterfly && !this.butterflyCompletedThisTurn) {
      return { ok: false, reason: '蝶舞引导中无法移动', activated: 'none' };
    }
    const player = this.player;
    const dest = { x, y };
    const passThrough = player.hasCondition('elusive');
    const pre = this.encounter.board.findPath(player, dest, this.encounter.units, undefined, passThrough);
    if (!pre) return { ok: false, reason: '目标格不可达', activated: 'none' };

    let activated: 'basic' | 'dash' | 'none' = 'none';
    if (player.moveBudget <= 0) {
      if (pre.cost <= player.effectiveSpeed() && !player.dashUsedThisTurn && player.moveMode !== 'dash') {
        if (!player.activateBasicMove()) return { ok: false, reason: '没有附赠动作进行基础移动', activated };
        activated = 'basic';
      } else {
        if (!player.activateDashMove()) return { ok: false, reason: '没有主要动作进行全速移动', activated };
        activated = 'dash';
      }
    }

    const found = this.encounter.board.findPath(player, dest, this.encounter.units, player.moveBudget, passThrough);
    if (!found) return { ok: false, reason: '移动预算不足或路径被阻挡', activated };
    const from = { x: player.x, y: player.y };
    player.consumeMoveBudget(found.cost);
    player.x = dest.x;
    player.y = dest.y;
    const dir = directionFromTo(from, dest);
    if (dir) player.facing = dir;
    if (activated === 'dash' && player.stealthed) {
      player.stealthed = false;
    }
    this.afterPlayerMove(from, dest, activated, found.path);
    return { ok: true, from, to: { ...dest }, cost: found.cost, activated };
  }

  private afterPlayerMove(from: Vec2, to: Vec2, activated: 'basic' | 'dash' | 'none', path: Vec2[]): void {
    void from; void to; void activated;
    this.playerTurnFirstActionUsed = true;
    if (this.player.hasCondition('elusive') && (this.player.card.level ?? 1) >= 5) {
      this.elusivePathCandidates = [...path, to];
    }
    this.checkSilhouettesAfterMove(this.player);
    for (const zone of this.zones) {
      const entered = path.some((c) => zone.cells.has(`${c.x},${c.y}`))
        || zone.cells.has(`${to.x},${to.y}`);
      if (!entered) continue;
      const result = resolveZoneTrigger(zone, this.encounter.livingUnits(), this.rng);
      this.lastEnemyEvents.push(...result.events);
      for (const [id, amount] of result.damageByTarget) this.lastEnemyDamageByTarget.set(id, (this.lastEnemyDamageByTarget.get(id) ?? 0) + amount);
      this.handleKills({ ...result, ok: true, appliedStatuses: [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 });
    }
  }

  /** 佯攻：用被取消的动作施展替代战技（新战技仍付自己的FP/使用次数）。 */
  playerFeintReplace(abilityId: string, targetId: string) {
    const bad = { ok: false as const, reason: '没有可用的佯攻时机', events: [], damageByTarget: new Map<string, number>(), appliedStatuses: [], killedTargetIds: [] as string[] };
    if (!this.pendingFeint) return bad;
    const card = this.catalog.abilities.get(abilityId) ?? this.playerAbilities.find((a) => a.id === abilityId);
    if (!card) return { ...bad, reason: '能力不存在' };
    const action = card.cast?.action ?? 'none';
    const allowed = this.pendingFeint.refundAction === 'main' ? action === 'main' || action === 'bonus' : action === 'bonus';
    if (!allowed) return { ...bad, reason: '该战技不能使用被取消的动作' };
    if (!(card.cast?.keywords ?? []).includes('战技')) return { ...bad, reason: '只能替换为战技' };
    const target = this.encounter.unitById(targetId);
    if (!target) return { ...bad, reason: '目标不存在' };
    this.player.spendUsage('rogue-feint:shortRest');
    this.pendingFeint = null;
    const result = executeAbility(card, this.player, this.encounter, {
      rng: this.rng, statusCatalog: this.catalog.statuses, level: this.player.card.level,
      targets: [target], choose: this.opts.choose, chooseDestination: this.opts.chooseDestination,
      poisonCatalog: this.opts.poisonCatalog, skipActionCost: true,
    });
    this.syncPassives();
    return result;
  }

  /** 连环奇袭：击杀后免费施展奇袭风格战技。 */
  playerChainAssaultSkill(abilityId: string, targetId: string) {
    const bad = { ok: false as const, reason: '没有可用的连环奇袭时机', events: [], damageByTarget: new Map<string, number>(), appliedStatuses: [], killedTargetIds: [] as string[] };
    if (!this.pendingChainAssault) return bad;
    const card = this.catalog.abilities.get(abilityId) ?? this.playerAbilities.find((a) => a.id === abilityId);
    if (!card || card.style !== '奇袭' || card.category !== 'skill') return { ...bad, reason: '只能施展奇袭风格战技' };
    const target = this.encounter.unitById(targetId);
    if (!target || !isMeleeAdjacent({ x: this.player.x, y: this.player.y, z: this.player.z }, { x: target.x, y: target.y, z: target.z })) return { ...bad, reason: '目标不在相邻位置' };
    if (!this.player.canUseUsage('rogue-chain-assault:perRound', 1)) return { ...bad, reason: '本轮已使用' };
    this.player.spendUsage('rogue-chain-assault:perRound');
    this.pendingChainAssault = false;
    const result = executeAbility(card, this.player, this.encounter, {
      rng: this.rng, statusCatalog: this.catalog.statuses, level: this.player.card.level,
      targets: [target], choose: this.opts.choose, poisonCatalog: this.opts.poisonCatalog, skipActionCost: true,
    });
    this.syncPassives();
    return result;
  }

  /** 冲刺爆发：移动后强制免费基础攻击。 */
  playerFinishSprintBurst() {
    if (!this.pendingSprintBurst) return { ok: false, reason: '没有待结算的冲刺爆发', events: [], damage: 0 };
    const adjacent = this.encounter.livingEnemiesOf(this.player).filter((u) => isMeleeAdjacent(
      { x: this.player.x, y: this.player.y, z: this.player.z },
      { x: u.x, y: u.y, z: u.z },
    ));
    if (adjacent.length === 0) {
      this.pendingSprintBurst = false;
      return { ok: false, reason: '落点相邻没有可攻击角色', events: [], damage: 0 };
    }
    const idx = this.opts.chooseSprintTarget ? this.opts.chooseSprintTarget(adjacent) : 0;
    const target = adjacent[Math.max(0, idx)] as UnitInstance;
    this.pendingSprintBurst = false;
    const result = executeBasicAttack(this.player, target, this.encounter, this.rng, this.catalog.statuses, this.opts.poisonCatalog, { skipActionCost: true });
    if (result.ok) this.afterPlayerAction();
    return result;
  }

  /** 克敌先机：敌方攻击掷骰前声明，不消耗动作。 */
  declareAnticipateAgainst(attackerId: string): boolean {
    if (this.phase !== 'enemyTurn') return false;
    if (!this.player.canUseUsage('rogue-anticipate:shortRest', 1)) return false;
    if (!this.encounter.unitById(attackerId)) return false;
    this.player.spendUsage('rogue-anticipate:shortRest');
    this.player.addTemporaryCondition('anticipate_triggered', 1);
    return true;
  }

  /** 锁喉（他人回合）：消耗反应，每场限一次。 */
  playerUseLockThroatOffTurn(targetId: string) {
    const bad = { ok: false as const, reason: '不是敌方回合', events: [], damageByTarget: new Map<string, number>(), appliedStatuses: [] as Array<{ targetId: string; status: string; layers: number }>, killedTargetIds: [] as string[] };
    if (this.phase !== 'enemyTurn') return bad;
    if (!this.player.canUseAction('reaction')) return { ...bad, reason: '没有反应动作' };
    if (!this.player.canUseUsage('rogue-throat-lock:offturn-perBattle', 1)) return { ...bad, reason: '锁喉离场用法本场已用' };
    const target = this.encounter.unitById(targetId);
    if (!target) return { ...bad, reason: '目标不存在' };
    const card = this.catalog.abilities.get('rogue-throat-lock');
    if (!card) return { ...bad, reason: '缺少锁喉数据' };
    this.player.spendUsage('rogue-throat-lock:offturn-perBattle');
    return executeAbility({ ...card, cast: { ...card.cast, action: 'reaction' } }, this.player, this.encounter, {
      rng: this.rng,
      statusCatalog: this.catalog.statuses,
      level: this.player.card.level,
      targets: [target],
      poisonCatalog: this.opts.poisonCatalog,
    });
  }

  /** 快攻手：每场一次，不消耗动作使用副手近战攻击。 */
  playerQuickHands(targetId: string): ReturnType<typeof executeBasicAttack> {
    if (this.phase !== 'playerTurn') return { ok: false, reason: '不是玩家回合', events: [], damage: 0 };
    if (!this.player.offhand || this.player.offhand.rangeMetric === 'grid') {
      return { ok: false, reason: '没有副手近战武器', events: [], damage: 0 };
    }
    if (!this.player.canUseUsage('rogue-quick-hands:perBattle', 1)) {
      return { ok: false, reason: '快攻手本场已使用', events: [], damage: 0 };
    }
    const target = this.encounter.unitById(targetId);
    if (!target) return { ok: false, reason: '目标不存在', events: [], damage: 0 };
    this.player.spendUsage('rogue-quick-hands:perBattle');
    const level = this.player.card.level ?? 1;
    const result = executeBasicAttack(
      this.player, target, this.encounter, this.rng, this.catalog.statuses,
      level >= 15 ? this.opts.poisonCatalog : undefined,
      { weapon: this.player.offhand, gainCombo: level >= 8 },
    );
    this.afterPlayerAction();
    return result;
  }

  /** 旋刃魂曲：选择 3×3 中心格施放；施放瞬间触发一次。 */
  playerCastSpinBladeSong(x: number, y: number): ResolveOutcome {
    const bad = this.emptyOutcome('旋刃魂曲施放失败');
    if (this.phase !== 'playerTurn') return this.emptyOutcome('不是玩家回合');
    const player = this.player;
    const center = { x, y };
    if (combatDistance({ x: player.x, y: player.y, z: player.z }, { x, y, z: player.z }) > 12) {
      return this.emptyOutcome('中心格必须在12米内');
    }
    if (!this.encounter.board.isPassable(x, y)) return this.emptyOutcome('中心格不可用');
    if (!player.canUseAction('main')) return this.emptyOutcome('没有主要动作');
    if (player.fp < 4) return this.emptyOutcome('疲劳值不足');
    player.useAction('main');
    player.fp -= 4;
    this.playerTurnFirstActionUsed = true;
    this.clearPlayerConcentration();
    const level = player.card.level ?? 1;
    const zone: ZoneInstance = {
      id: `zone-${this.nextObjectId()}`,
      sourceId: player.id,
      center,
      cells: zoneCells(center),
      dice: level >= 10 ? '4D6' : '4D4',
      dc: 15,
      damageType: '心灵',
      expiresAtOwnerSerial: player.turnSerial + 2,
      createdAtGlobalTurn: this.encounter.round,
    };
    this.zones.push(zone);
    const result = resolveZoneTrigger(zone, this.encounter.livingUnits(), this.rng);
    return {
      ok: true,
      events: result.events,
      damageByTarget: result.damageByTarget,
      appliedStatuses: [],
      killedTargetIds: result.killedTargetIds,
      attackHitTargetIds: [],
      attackCritTargetIds: [],
      consumedCombo: 0,
    };
  }

  /** 旋刃魂曲 L15：附赠动作平移3米。 */
  playerMoveSpinBladeSong(dx: number, dy: number): ResolveOutcome {
    const zone = this.zones[0];
    if (!zone) return this.emptyOutcome('没有旋刃魂曲区域');
    const player = this.player;
    if ((player.card.level ?? 1) < 15) return this.emptyOutcome('需要游荡者15级');
    if (!player.canUseAction('bonus')) return this.emptyOutcome('没有附赠动作');
    const step = Math.max(Math.abs(dx), Math.abs(dy)) <= 1 ? 3 : 0;
    if (!step) return this.emptyOutcome('只能朝任意方向平移3米');
    const dir = directionFromTo({ x: 0, y: 0 }, { x: dx, y: dy });
    if (!dir) return this.emptyOutcome('方向无效');
    player.useAction('bonus');
    const oldCells = new Set(zone.cells);
    zone.center = { x: zone.center.x + Math.sign(dx) * 3, y: zone.center.y + Math.sign(dy) * 3 };
    zone.cells = zoneCells(zone.center);
    const newly = [...zone.cells].filter((key) => !oldCells.has(key));
    const result: ResolveOutcome = {
      ok: true, events: [], damageByTarget: new Map(), appliedStatuses: [],
      killedTargetIds: [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0,
    };
    for (const unit of this.encounter.livingUnits()) {
      if (!newly.includes(`${unit.x},${unit.y}`)) continue;
      const zoneResult = resolveZoneTrigger(zone, [unit], this.rng);
      result.events.push(...zoneResult.events);
      for (const [id, amount] of zoneResult.damageByTarget) result.damageByTarget.set(id, amount);
      result.killedTargetIds.push(...zoneResult.killedTargetIds);
    }
    result.events.push({
      owner: 'player', label: '旋刃魂曲移动', kind: 'move', unitId: player.id,
      total: 3, detail: `区域平移至 ${zone.center.x},${zone.center.y}`,
    });
    return result;
  }

  private clearPlayerConcentration(): void {
    const player = this.player;
    this.phantomDagger = null;
    this.zones = this.zones.filter((z) => z.sourceId !== player.id);
  }

  /** 挑衅对决：双方各移除一次本场反应使用次数；L5 你对目标下一次攻击/伤害有优势。 */
  playerProvokeDuel(targetId: string): { ok: boolean; reason?: string } {
    const player = this.player;
    if (this.phase !== 'playerTurn') return { ok: false, reason: '不是玩家回合' };
    if (!this.hasPassive('rogue-provoke-duel')) return { ok: false, reason: '未习得挑衅对决' };
    if (!player.canUseUsage('rogue-provoke-duel:perBattle', 1)) return { ok: false, reason: '本场已使用' };
    if (!player.canUseAction('reaction')) return { ok: false, reason: '没有可移除的反应动作使用次数' };
    const target = this.encounter.unitById(targetId);
    if (!target || target.team === player.team) return { ok: false, reason: '目标必须是敌方角色' };
    player.useAction('reaction');
    target.actions.reactionUsed = Math.min(target.actions.reactionMax, target.actions.reactionUsed + 1);
    player.spendUsage('rogue-provoke-duel:perBattle');
    if ((player.card.level ?? 1) >= 5) target.marks.set('provoke_duel', 1);
    this.playerTurnFirstActionUsed = true;
    this.afterPlayerAction();
    return { ok: true };
  }

  /** 毒性蔓延 L15：一次使用同时触发两个不同效果。 */
  playerUseToxinSpreadPair(effectA: number, targetA: string, effectB: number, targetB: string): ResolveOutcome {
    const player = this.player;
    if ((player.card.level ?? 1) < 15) return this.emptyOutcome('需要游荡者15级');
    if (effectA === effectB) return this.emptyOutcome('必须选择两个不同效果');
    if (!this.hasPassive('rogue-toxin-spread')) return this.emptyOutcome('未习得毒性蔓延');
    const key = 'rogue-toxin-spread:shortRest';
    const max = 2;
    if (!player.canUseUsage(key, max)) return this.emptyOutcome('毒性蔓延本次休整已用完');
    const first = this.playerUseToxinSpread(effectA, targetA);
    if (!first.ok) return first;
    player.usageCounts.set(key, Math.max(0, player.getUsage(key) - 1));
    const second = this.playerUseToxinSpread(effectB, targetB);
    if (!second.ok) {
      player.usageCounts.set(key, Math.max(1, player.getUsage(key)));
      return second;
    }
    const damage = new Map(first.damageByTarget);
    for (const [id, amount] of second.damageByTarget) damage.set(id, (damage.get(id) ?? 0) + amount);
    return {
      ok: true,
      events: [...first.events, ...second.events],
      damageByTarget: damage,
      appliedStatuses: [...first.appliedStatuses, ...second.appliedStatuses],
      killedTargetIds: [...new Set([...first.killedTargetIds, ...second.killedTargetIds])],
      attackHitTargetIds: [],
      attackCritTargetIds: [],
      consumedCombo: 0,
    };
  }

  /** 毒性蔓延：0=6米内一名角色中毒；1=中毒角色周围相邻DC15体质豁免；2/3=强化下一次毒刃。 */
  playerUseToxinSpread(effect: number, targetId: string): ResolveOutcome {
    const player = this.player;
    const card = this.catalog.abilities.get('rogue-toxin-spread');
    if (!card || !this.hasPassive('rogue-toxin-spread')) return this.emptyOutcome('未习得毒性蔓延');
    if (this.phase !== 'playerTurn') return this.emptyOutcome('不是玩家回合');
    const level = player.card.level ?? 1;
    const max = level >= 10 ? 2 : 1;
    if (!player.canUseUsage('rogue-toxin-spread:shortRest', max)) return this.emptyOutcome('毒性蔓延本次休整已用完');
    const target = this.encounter.unitById(targetId);
    const events: RollEvent[] = [];
    const damage = new Map<string, number>();
    const applied: ResolveOutcome['appliedStatuses'] = [];
    if (effect === 0) {
      if (!target || target.hp <= 0 || combatDistance(
        { x: player.x, y: player.y, z: player.z },
        { x: target.x, y: target.y, z: target.z },
      ) > 6) return this.emptyOutcome('需要6米内存活角色');
      this.applyPoisonLayers(target, events, applied, '毒性蔓延：目标中毒');
    } else if (effect === 1) {
      if (!target || !target.hasCondition('poisoned')) return this.emptyOutcome('目标未中毒');
      for (const nearby of this.encounter.livingUnits()) {
        if (nearby.id === target.id) continue;
        if (!isMeleeAdjacent(
          { x: target.x, y: target.y, z: target.z },
          { x: nearby.x, y: nearby.y, z: nearby.z },
        )) continue;
        const d20 = this.rng.die(20);
        const total = d20 + nearby.attrMod('体质');
        const failed = d20 !== 1 && (d20 === 20 || total >= 15) ? false : true;
        events.push({
          owner: nearby.team === 'player' ? 'player' : 'auto',
          label: `${nearby.name} 毒性蔓延体质豁免 DC15`,
          kind: 'save', unitId: nearby.id, targetId: target.id,
          parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: nearby.team === 'player' ? 'player' : 'auto' }],
          total, detail: `${d20}+体质=${total} vs DC15 ${failed ? '失败，中毒' : '成功'}`,
        });
        if (failed) this.applyPoisonLayers(nearby, events, applied, '毒性蔓延：相邻角色中毒');
      }
    } else if (effect === 2) {
      player.marks.set('toxin_spread_double', 1);
      events.push({ owner: 'player', label: '毒性蔓延·毒刃强化', kind: 'status', unitId: player.id, total: 2, detail: '下一次毒刃中毒初始层数翻倍' });
    } else if (effect === 3) {
      player.marks.set('toxin_spread_bonus', 1);
      events.push({ owner: 'player', label: '毒性蔓延·毒刃迅捷', kind: 'status', unitId: player.id, total: 1, detail: '下一次毒刃仅需附赠动作' });
    } else {
      return this.emptyOutcome('无效的毒性蔓延效果');
    }
    player.spendUsage('rogue-toxin-spread:shortRest');
    this.playerTurnFirstActionUsed = true;
    this.handleKills({ ok: true, events, damageByTarget: damage, appliedStatuses: applied, killedTargetIds: [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 });
    this.afterPlayerAction();
    return { ok: true, events, damageByTarget: damage, appliedStatuses: applied, killedTargetIds: [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 };
  }

  private applyPoisonLayers(target: UnitInstance, events: RollEvent[], applied: ResolveOutcome['appliedStatuses'], label: string): void {
    const roll = evaluateExpression('1D3', { rng: this.rng, variables: {}, owner: target.team === 'player' ? 'player' : 'auto' });
    const layers = Math.max(1, Math.floor(roll.total));
    target.addCondition('poisoned', layers, 99);
    applied.push({ targetId: target.id, status: 'poisoned', layers });
    events.push({
      owner: target.team === 'player' ? 'player' : 'auto',
      label, kind: 'status', unitId: target.id, expression: '1D3', parts: roll.parts, total: layers,
      detail: `中毒层数 → ${target.conditionLayersOf('poisoned')}`,
    });
  }

  /** 剪影：对影子发动近战攻击（自动命中，无D20/暴击/攻击特效/连击点）。 */
  playerAttackSilhouette(silhouetteId: string): ResolveOutcome {
    const player = this.player;
    if (this.phase !== 'playerTurn') return this.emptyOutcome('不是玩家回合');
    const silhouette = this.silhouettes.find((s) => s.id === silhouetteId);
    if (!silhouette) return this.emptyOutcome('影子不存在');
    const target = this.encounter.unitById(silhouette.targetId);
    if (!target || target.hp <= 0) return this.emptyOutcome('影子的本体已死亡');
    if (!isMeleeAdjacent({ x: player.x, y: player.y, z: player.z }, { x: silhouette.x, y: silhouette.y, z: player.z })) {
      return this.emptyOutcome('影子不在近战范围内');
    }
    if (!player.canUseAction('main')) return this.emptyOutcome('没有主要动作');
    player.useAction('main');
    this.playerTurnFirstActionUsed = true;
    const level = player.card.level ?? 1;
    let weapon = player.weapon;
    let multiplier = 1;
    if (player.isDualWieldingMelee()) {
      weapon = player.dualWieldWeapon();
      multiplier = 1.5;
    }
    const diceText = weapon?.dice ?? '0';
    const diceEval = evaluateExpression(diceText, { rng: this.rng, variables: {}, owner: 'player' });
    const attr = player.weaponAttackMod(weapon);
    const raw = Math.max(0, diceEval.total + attr) * multiplier;
    const ratio = level >= 15 ? 1 : 0.5;
    const loss = Math.max(0, Math.floor(raw * ratio));
    target.loseHp(loss);
    const events: RollEvent[] = [{
      owner: 'player',
      label: `攻击影子（本体 ${target.name}）`,
      kind: 'damage',
      unitId: player.id,
      targetId: target.id,
      total: loss,
      detail: `自动命中；武器伤害 ${raw}×${ratio}=${loss} 生命流失 → HP ${target.hp}/${target.hpMax}（不触发攻击特效）`,
    }];
    this.handleKills({ ok: true, events, damageByTarget: new Map([[target.id, loss]]), appliedStatuses: [], killedTargetIds: target.hp <= 0 ? [target.id] : [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 });
    this.afterPlayerAction();
    return { ok: true, events, damageByTarget: new Map([[target.id, loss]]), appliedStatuses: [], killedTargetIds: target.hp <= 0 ? [target.id] : [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 };
  }

  /** 暗影之刃：开战前准备阶段对武器附魔。 */
  playerPrepareShadowBlade(hand: 'main' | 'off' = 'main'): { ok: boolean; reason?: string } {
    if (this.phase !== 'setup') return { ok: false, reason: '只能在开战前准备阶段使用' };
    const player = this.player;
    const weapon = hand === 'main' ? player.weapon : player.offhand;
    if (!weapon) return { ok: false, reason: '该手没有武器' };
    if (weapon.rangeMetric === 'grid') return { ok: false, reason: '不能附魔远程武器' };
    const blocked = ['锤类', '长柄', '简易'];
    if (blocked.includes(weapon.category ?? '') || (weapon.tags ?? []).some((t) => blocked.includes(t))) {
      return { ok: false, reason: '锤类/长柄/简易武器不能附魔' };
    }
    if (player.fp < 1) return { ok: false, reason: '疲劳值不足' };
    player.fp -= 1;
    weapon.shadowBlade = true;
    return { ok: true };
  }

  playerReload(): ReturnType<typeof reloadWeapon> {
    if (this.phase !== 'playerTurn') return { ok: false, reason: '不是玩家回合' };
    return reloadWeapon(this.player);
  }

  playerEndTurn(): void {
    if (this.phase !== 'playerTurn') return;
    this.advanceAfterAction();
  }

  /** 蝶舞：完成第2轮引导（消耗主要动作），之后本回合附赠可正常使用。 */
  playerCompleteButterflyDance(extraComboPoints = 0): { ok: boolean; reason?: string } {
    if (this.phase !== 'playerTurn' || !this.channelingButterfly) {
      return { ok: false, reason: '当前没有进行中的蝶舞引导' };
    }
    if (this.butterflyCompletedThisTurn) return { ok: false, reason: '本回合已结束蝶舞引导' };
    if (!this.player.useAction('main')) return { ok: false, reason: '没有主要动作完成引导' };
    const spent = this.player.spendCombo(extraComboPoints);
    this.butterflyExtraCombo = spent;
    this.butterflyCompletedThisTurn = true;
    this.channelingButterfly = null;
    return { ok: true };
  }

  private afterPlayerAction(): void {
    const outcome = this.encounter.checkOutcome();
    if (outcome !== 'ongoing') {
      this.encounter.finish(outcome);
      this.phase = 'ended';
      return;
    }
    // BG3 式：玩家可连续执行动作，直到主动结束回合。
    this.phase = 'playerTurn';
  }

  private advanceAfterAction(): void {
    const ending = this.encounter.currentUnit;
    if (ending?.team === 'player') {
      if (this.butterflyCompletedThisTurn) {
        this.resolveButterflyFinale();
        this.butterflyCompletedThisTurn = false;
      this.elusivePathCandidates = [];
        this.butterflyExtraCombo = 0;
        this.butterflyTargetIds = [];
      } else if (this.channelingButterfly
          && this.encounter.round > this.channelingButterfly.startRound) {
        this.channelingButterfly = null;
        this.butterflyTargetIds = [];
      }
    }
    this.advanceTurn();
    if (this.phase === 'enemyTurn' && !this.opts.pauseEnemyTurns) this.runEnemyTurns();
  }

  /** 暂停模式：执行当前敌方角色的一整个回合（含推进），返回阶段。 */
  stepEnemyTurn(): PvePhase {
    if (this.phase !== 'enemyTurn') return this.phase;
    const current = this.encounter.currentUnit;
    if (!current || current.team !== 'enemy') {
      this.phase = 'ended';
      return this.phase;
    }
    this.runEnemyTurn(current);
    const outcome = this.encounter.checkOutcome();
    if (outcome !== 'ongoing') {
      this.encounter.finish(outcome);
      this.phase = 'ended';
      return this.phase;
    }
    this.advanceTurn();
    return this.phase;
  }

  /** 暂停模式：取走并清空自动敌方回合的掷骰事件。 */
  consumeEnemyStepEvents(): RollEvent[] {
    const events = [...this.lastEnemyEvents];
    this.lastEnemyEvents = [];
    return events;
  }

  /** 暂停模式：取走并清空本步敌方伤害。 */
  takeEnemyStepDamage(): Map<string, number> {
    const damage = new Map(this.lastEnemyDamageByTarget);
    this.lastEnemyDamageByTarget = new Map();
    return damage;
  }

  /** 暂停模式：示敌以弱在受伤害前暂停，由 UI 询问后调用。 */
  resolveFeignWeakness(accept: boolean): boolean {
    const request = this.pendingFeignRequest;
    if (!request) return false;
    this.pendingFeignRequest = null;
    if (!accept) {
      this.playerTookDamageThisBattle = true;
      return false;
    }
    const player = this.player;
    if (!this.hasPassive('rogue-feign-weakness')
        || player.hasCondition('prone')
        || !player.canUseAction('reaction')
        || !player.canUseUsage('rogue-feign-weakness:perBattle', 1)) {
      this.playerTookDamageThisBattle = true;
      return false;
    }
    player.useAction('reaction');
    player.spendUsage('rogue-feign-weakness:perBattle');
    player.addCondition('prone', 1);
    player.hp = Math.min(player.hpMax, request.hpBefore);
    const current = this.lastEnemyDamageByTarget.get(player.id) ?? 0;
    this.lastEnemyDamageByTarget.set(player.id, Math.max(0, current - request.damage));
    this.lastEnemyEvents.push({
      owner: 'player',
      label: `${player.name} 示敌以弱`,
      kind: 'status',
      unitId: player.id,
      targetId: request.enemyId,
      total: 0,
      detail: `进入击倒，完全忽视本次 ${request.damage} 点伤害及后续效果`,
    });
    return true;
  }

  private advanceTurn(): void {
    const prevRound = this.encounter.round;
    const outcome = this.encounter.endTurn();
    if (outcome !== 'ongoing') {
      this.phase = 'ended';
      return;
    }
    if (this.encounter.round > prevRound) {
      this.onRoundEnd();
    }
    this.onTurnStarted(this.encounter.currentUnit);
    if (this.phase === 'ended') return;
    this.phase = this.encounter.currentUnit?.team === 'player' ? 'playerTurn' : 'enemyTurn';
  }

  private resolveButterflyFinale(): void {
    const player = this.player;
    const enemies = this.encounter.livingUnits().filter(
      (u) => u.team !== player.team && combatDistance(
        { x: player.x, y: player.y, z: player.z },
        { x: u.x, y: u.y, z: u.z },
      ) <= 6,
    );
    const level = player.card.level ?? 1;
    for (const target of enemies) {
      const saveAttr = '魅力' as const;
      let failed = false;
      if (target.hasSaveProf(saveAttr)) {
        this.lastEnemyEvents.push({
          owner: 'auto', label: `${target.name} 蝶舞终幕豁免`, kind: 'save', unitId: target.id,
          targetId: player.id, total: 0, detail: '拥有魅力豁免值，自动成功',
        });
      } else {
        const d20 = this.rng.die(20);
        const total = d20 + target.attrMod(saveAttr);
        failed = d20 !== 1 && (d20 === 20 || total >= 15) ? false : true;
        this.lastEnemyEvents.push({
          owner: 'auto', label: `${target.name} 蝶舞终幕魅力豁免 DC15`, kind: 'save',
          unitId: target.id, targetId: player.id, expression: 'D20+魅力',
          parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: 'auto' }],
          total, detail: `${d20}+${target.attrMod(saveAttr)}=${total} vs DC15 ${failed ? '失败' : '成功'}`,
        });
      }
      if (!failed) continue;
      const baseDice = this.rng.die(4) + this.rng.die(4);
      const extraDieSides = level >= 12 ? 6 : 4;
      let extra = 0;
      for (let i = 0; i < this.butterflyExtraCombo; i += 1) extra += this.rng.die(extraDieSides);
      const raw = baseDice + extra;
      const vuln = target.vulnerabilities.get('心灵') ?? 0;
      const resist = target.resistances.get('心灵') ?? 0;
      const amount = Math.max(0, Math.floor(raw + vuln - resist));
      target.applyDamage(amount);
      this.lastEnemyDamageByTarget.set(target.id, (this.lastEnemyDamageByTarget.get(target.id) ?? 0) + amount);
      target.addCondition('dance_penalty', 1, 1, { ownerId: player.id, ownerSerial: player.turnSerial, durationTurns: 1 });
      this.lastEnemyEvents.push({
        owner: 'auto', label: `蝶舞心灵伤害 ${target.name}`, kind: 'damage',
        unitId: player.id, targetId: target.id, total: amount,
        detail: `${baseDice}${extra ? `+${extra}` : ''}${vuln ? `+${vuln}` : ''}${resist ? `-${resist}` : ''}=${amount} 心灵 → HP ${target.hp}/${target.hpMax}；对施展者下次攻击劣势`,
      });
    }
  }

  private checkSilhouettesAfterMove(unit: UnitInstance): void {
    const owner = this.player;
    for (const silhouette of [...this.silhouettes]) {
      const target = this.encounter.unitById(silhouette.targetId);
      if (!target || target.id !== unit.id) continue;
      if (target.conditionLayersOf('silhouette') === 0 && target.marks.get('silhouette') === 0) continue;
      const dist = gridDistance({ x: target.x, y: target.y }, { x: silhouette.x, y: silhouette.y })
        + Math.abs((target.z ?? 0) - (owner.z ?? 0));
      if (dist < 6) continue;
      this.silhouettes = this.silhouettes.filter((s) => s.id !== silhouette.id);
      if ((owner.card.level ?? 1) >= 8) {
        const amount = this.rng.die(8);
        target.applyDamage(amount);
        this.lastEnemyEvents.push({
          owner: 'auto', label: `${target.name} 剪影解除反噬`, kind: 'damage',
          unitId: owner.id, targetId: target.id, total: amount,
          detail: `离开影子6米，承受1D8=${amount} 暗影伤害 → HP ${target.hp}/${target.hpMax}`,
        });
      }
    }
  }

  private onRoundEnd(): void {
    for (const zone of this.zones) {
      const result = resolveZoneTrigger(zone, this.encounter.livingUnits(), this.rng);
      this.lastEnemyEvents.push(...result.events);
      for (const [id, amount] of result.damageByTarget) {
        this.lastEnemyDamageByTarget.set(id, (this.lastEnemyDamageByTarget.get(id) ?? 0) + amount);
      }
      this.handleKills({ ...result, ok: true, appliedStatuses: [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 });
    }
  }

  hasPassive(id: string): boolean {
    return this.catalog.abilities.has(id) || this.playerAbilities.some((a) => a.id === id);
  }

  /** 落单：周围6米内没有同阵营且存活单位。召唤物/物件不算单位时按单位口径。 */
  isLone(unit: UnitInstance): boolean {
    if (unit.hasCondition('nowhere_lone')) return true;
    return !this.encounter.livingUnits().some(
      (u) => u.id !== unit.id && u.team === unit.team
        && combatDistance({ x: unit.x, y: unit.y, z: unit.z }, { x: u.x, y: u.y, z: u.z }) <= 6,
    );
  }

  private handleKills(result: ResolveOutcome): void {
    const player = this.player;
    for (const id of result.killedTargetIds) {
      const target = this.encounter.unitById(id);
      if (!target || target.team === player.team) continue;
      if (this.hasPassive('rogue-cold-blood')) player.gainCombo(1);
      if (this.hasPassive('rogue-hidden-blade') && (player.card.level ?? 1) >= 10 && this.isLone(player)) {
        player.usageCounts.delete('rogue-hidden-blade:perBattle');
      }
      if (this.hasPassive('rogue-death-mark') && (player.card.level ?? 1) >= 15 && (target.marks.get('death_mark') ?? 0) > 0) {
        player.resetUsageScope('longRest', 'rogue-death-mark');
      }
    }
  }

  syncPassives(): void {
    this.player.daringActive = this.player.comboPoints >= 5;
  }

  private applyBattleStartPassives(): void {
    const quickPrep = this.catalog.abilities.get('rogue-quick-prep');
    if (!quickPrep) return;
    const parsed = parseAbility(quickPrep, this.player.card.level ?? 1);
    const pointsExpr = parsed.scalingVariables.quickPrepPoints ?? '1';
    const ctx = {
      rng: this.rng,
      variables: {
        comboPoints: this.player.comboPoints,
        keyMod: this.player.attrMod(this.player.keyAttr),
      },
    };
    const points = Math.max(0, Math.floor(evaluateExpression(pointsExpr, ctx).total));
    this.player.gainCombo(points);
  }

  private applyFirstBlood(target: UnitInstance): void {
    if (this.playerHasDealtDamage) return;
    this.playerHasDealtDamage = true;
    const card = this.catalog.abilities.get('rogue-first-blood');
    if (!card) return;
    const parsed = parseAbility(card, this.player.card.level ?? 1);
    const amountExpr = parsed.scalingVariables.firstBloodAmount ?? '10';
    const amount = Math.max(0, Math.floor(evaluateExpression(amountExpr, {
      rng: this.rng,
      variables: { keyMod: this.player.attrMod(this.player.keyAttr) },
    }).total));
    target.loseHp(amount);
  }

  /** 自动运行敌方回合，直到玩家回合或战斗结束。 */
  runEnemyTurns(maxTurns = 100): void {
    this.lastEnemyEvents = [];
    this.lastEnemyDamageByTarget = new Map();
    this.lastEnemyAppliedStatuses = [];
    let guard = 0;
    while (this.encounter.phase === 'turn' && this.encounter.currentUnit?.team === 'enemy') {
      guard += 1;
      if (guard > maxTurns) throw new Error('敌方回合循环超过安全上限');
      this.runEnemyTurn(this.encounter.currentUnit);
      const outcome = this.encounter.checkOutcome();
      if (outcome !== 'ongoing') {
        this.encounter.finish(outcome);
        this.phase = 'ended';
        return;
      }
      this.advanceTurn();
      if (this.phase === 'ended') return;
    }
    this.phase = this.encounter.currentUnit?.team === 'player' ? 'playerTurn' : 'ended';
  }

  private runEnemyTurn(unit: UnitInstance): void {
    if (unit.hp <= 0) return;
    if (unit.hasCondition('unconscious') || unit.hasCondition('paralyzed')) return;

    // 剪影：目标可以花附赠动作触及影子解除。
    for (const silhouette of [...this.silhouettes]) {
      if (silhouette.targetId !== unit.id) continue;
      if (!isMeleeAdjacent({ x: unit.x, y: unit.y, z: unit.z }, { x: silhouette.x, y: silhouette.y, z: unit.z })) continue;
      if (!unit.canUseAction('bonus')) continue;
      unit.useAction('bonus');
      this.silhouettes = this.silhouettes.filter((s) => s.id !== silhouette.id);
      this.lastEnemyEvents.push({
        owner: 'auto', label: `${unit.name} 触及影子解除剪影`, kind: 'status',
        unitId: unit.id, total: 0, detail: '附赠动作触及影子，剪影解除',
      });
      if ((this.player.card.level ?? 1) >= 8) {
        const amount = this.rng.die(8);
        unit.applyDamage(amount);
        this.lastEnemyEvents.push({
          owner: 'auto', label: `剪影解除反噬 ${unit.name}`, kind: 'damage',
          unitId: this.player.id, targetId: unit.id, total: amount,
          detail: `1D8=${amount} 暗影伤害 → HP ${unit.hp}/${unit.hpMax}`,
        });
      }
    }

    // 魅惑：跳过回合，改为朝施展来源做一次基础移动（由施展来源操作）。
    if (unit.hasCondition('charmed')) {
      const source = this.encounter.unitById(unit.conditionSources.get('charmed') ?? '');
      if (source) this.moveUnitToward(unit, source, unit.effectiveSpeed());
      return;
    }

    let target = this.nearestLivingEnemy(unit);
    if (!target) return;

    // 飘忽不定：选择玩家为目标前必须花附赠动作做专注检定。
    if (target.hasCondition('elusive')) {
      if (!unit.canUseAction('bonus')) {
        this.lastEnemyEvents.push({
          owner: 'auto', label: `${unit.name} 无法瞄准飘忽不定的目标`, kind: 'status',
          unitId: unit.id, total: 0, detail: '没有附赠动作执行瞄准行动，本回合无法选定目标',
        });
        target = null;
      } else {
        const aim = performAimCheck(unit, this.rng);
        this.lastEnemyEvents.push(...aim.events);
        if (!aim.ok) target = null;
      }
    }
    if (!target) return;

    const weapon = unit.weapon;
    if (!weapon) return;
    const melee = weapon.rangeMetric !== 'grid';
    const adjacent = isMeleeAdjacent(
      { x: unit.x, y: unit.y, z: unit.z },
      { x: target.x, y: target.y, z: target.z },
    );

    let movedPath: Vec2[] = [];
    if (!adjacent || !melee) {
      const approach = this.bestApproachCell(unit, target);
      if (approach) {
        const needDash = approach.cost > unit.effectiveSpeed();
        const activated = needDash ? unit.activateDashMove() : unit.activateBasicMove();
        if (activated) {
          const path = this.encounter.board.findPath(unit, approach.cell, this.encounter.units, unit.moveBudget);
          if (path) {
            unit.consumeMoveBudget(path.cost);
            unit.x = approach.cell.x;
            unit.y = approach.cell.y;
            const dir = directionFromTo({ x: unit.x, y: unit.y }, approach.cell);
            if (dir) unit.facing = dir;
            movedPath = path.path;
          }
        }
      }
    }
    this.triggerZonesForPath(unit, movedPath);

    const nowAdjacent = isMeleeAdjacent(
      { x: unit.x, y: unit.y, z: unit.z },
      { x: target.x, y: target.y, z: target.z },
    );
    let attackTarget: UnitInstance = target;
    let sowDiscordUsed = false;
    if (this.sowDiscordTargetId) {
      const discordTarget = this.encounter.unitById(this.sowDiscordTargetId);
      if (
        discordTarget
        && discordTarget.hasCondition('sow_discord')
        && discordTarget.hp > 0
        && discordTarget.team === unit.team
        && discordTarget.id !== unit.id
        && !this.sowDiscordAffectedIds.has(unit.id)
        && this.targetInWeaponRange(unit, discordTarget)
      ) {
        sowDiscordUsed = true;
        this.sowDiscordAffectedIds.add(unit.id);
        const d20 = this.rng.die(20);
        const total = d20 + unit.attrMod('智力');
        const failed = d20 !== 1 && (d20 === 20 || total >= 15) ? false : true;
        this.lastEnemyEvents.push({
          owner: 'auto', label: `${unit.name} 嫁祸诀窍智力豁免 DC15`, kind: 'save',
          unitId: unit.id, targetId: discordTarget.id,
          parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: 'auto' }],
          total, detail: `${d20}+智力=${total} vs DC15 ${failed ? '失败，改为攻击嫁祸目标' : '成功'}`,
        });
        if (failed) attackTarget = discordTarget;
      }
    }

    const canAttack = melee ? nowAdjacent && isMeleeAdjacent(
      { x: unit.x, y: unit.y, z: unit.z },
      { x: attackTarget.x, y: attackTarget.y, z: attackTarget.z },
    ) && unit.canUseAction('main')
      : unit.canUseAction('main') && this.targetInWeaponRange(unit, attackTarget);
    if (canAttack) {
      const hpBeforePlayer = attackTarget.id === this.player.id ? this.player.hp : 0;
      const attack = executeBasicAttack(
        unit,
        attackTarget,
        this.encounter,
        this.rng,
        this.catalog.statuses,
        undefined,
        !this.opts.pauseEnemyTurns
          ? {
              cancelHitEffects: (src: UnitInstance, tgt: UnitInstance, ability: ParsedAbility) => {
                void ability;
                if (tgt.id !== this.player.id || src.id !== unit.id) return false;
                if (!this.hasPassive('rogue-feign-weakness')
                    || this.player.hasCondition('prone')
                    || !this.player.canUseAction('reaction')
                    || !this.player.canUseUsage('rogue-feign-weakness:perBattle', 1)
                    || !this.opts.shouldUseFeignWeakness?.(src)) return false;
                this.player.useAction('reaction');
                this.player.spendUsage('rogue-feign-weakness:perBattle');
                this.player.addCondition('prone', 1);
                this.lastEnemyEvents.push({
                  owner: 'player', label: `${this.player.name} 示敌以弱`, kind: 'status',
                  unitId: this.player.id, targetId: src.id, total: 0,
                  detail: '进入击倒，完全抵消本次命中伤害与后续效果',
                });
                return true;
              },
            }
          : undefined,
      );
      if (attack.ok) {
        let damage = attack.damage;
        const feignEligible = attackTarget.id === this.player.id
          && damage > 0
          && this.hasPassive('rogue-feign-weakness')
          && !this.player.hasCondition('prone')
          && this.player.canUseAction('reaction')
          && this.player.canUseUsage('rogue-feign-weakness:perBattle', 1);
        if (feignEligible) {
          if (this.opts.pauseEnemyTurns) {
            this.pendingFeignRequest = { enemyId: unit.id, hpBefore: hpBeforePlayer, damage };
          } else if (this.opts.shouldUseFeignWeakness?.(unit)) {
            this.player.useAction('reaction');
            this.player.spendUsage('rogue-feign-weakness:perBattle');
            this.player.addCondition('prone', 1);
            this.player.hp = Math.min(this.player.hpMax, hpBeforePlayer);
            damage = 0;
            this.lastEnemyEvents.push({
              owner: 'player', label: `${this.player.name} 示敌以弱`, kind: 'status',
              unitId: this.player.id, total: 0, detail: `进入击倒，忽视本次 ${attack.damage} 点伤害`,
            });
          }
        }
        if (!sowDiscordUsed && attackTarget.id !== target.id) {
          // 嫁祸失败改目标时，目标对象变化。
        }
        this.lastEnemyEvents.push(...attack.events);
        if (damage > 0) {
          if (!this.pendingFeignRequest) {
            this.playerTookDamageThisBattle ||= attackTarget.id === this.player.id;
          }
          this.lastEnemyDamageByTarget.set(attackTarget.id, (this.lastEnemyDamageByTarget.get(attackTarget.id) ?? 0) + damage);
        }
      }
    }
  }

  private moveUnitToward(unit: UnitInstance, target: UnitInstance, maxCost: number): void {
    const approach = this.bestApproachCell(unit, target);
    if (!approach || approach.cost > maxCost) return;
    const path = this.encounter.board.findPath(unit, approach.cell, this.encounter.units, maxCost);
    if (!path) return;
    unit.consumeMoveBudget(path.cost);
    unit.x = approach.cell.x;
    unit.y = approach.cell.y;
    this.triggerZonesForPath(unit, path.path);
  }

  private targetInWeaponRange(unit: UnitInstance, target: UnitInstance): boolean {
    const weapon = unit.weapon;
    if (!weapon) return false;
    if (weapon.rangeMetric === 'grid') {
      return combatDistance({ x: unit.x, y: unit.y, z: unit.z }, { x: target.x, y: target.y, z: target.z }) <= (weapon.rangeMax ?? 12);
    }
    return isMeleeAdjacent({ x: unit.x, y: unit.y, z: unit.z }, { x: target.x, y: target.y, z: target.z });
  }

  private triggerZonesForPath(unit: UnitInstance, path: Vec2[]): void {
    this.checkSilhouettesAfterMove(unit);
    for (const zone of this.zones) {
      const entered = path.some((c) => zone.cells.has(`${c.x},${c.y}`))
        || zone.cells.has(`${unit.x},${unit.y}`);
      if (!entered) continue;
      const result = resolveZoneTrigger(zone, this.encounter.livingUnits(), this.rng);
      this.lastEnemyEvents.push(...result.events);
      for (const [id, amount] of result.damageByTarget) {
        this.lastEnemyDamageByTarget.set(id, (this.lastEnemyDamageByTarget.get(id) ?? 0) + amount);
      }
      this.handleKills({ ...result, ok: true, appliedStatuses: [], attackHitTargetIds: [], attackCritTargetIds: [], consumedCombo: 0 });
    }
  }


  private nearestLivingEnemy(unit: UnitInstance): UnitInstance | null {
    const enemies = this.encounter.livingUnits().filter((u) => u.team !== unit.team && !u.stealthed);
    if (enemies.length === 0) return null;
    return enemies.sort(
      (a, b) => combatDistance(
        { x: unit.x, y: unit.y, z: unit.z },
        { x: a.x, y: a.y, z: a.z },
      ) - combatDistance(
        { x: unit.x, y: unit.y, z: unit.z },
        { x: b.x, y: b.y, z: b.z },
      ),
    )[0] as UnitInstance;
  }

  private bestApproachCell(unit: UnitInstance, target: UnitInstance): { cell: Vec2; cost: number } | null {
    let best: { cell: Vec2; cost: number } | null = null;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        const cell = { x: target.x + dx, y: target.y + dy };
        if (!this.encounter.board.canStandAt(unit, cell.x, cell.y, this.encounter.units)) continue;
        const path = this.encounter.board.findPath(unit, cell, this.encounter.units);
        if (path && (best === null || path.cost < best.cost)) best = { cell, cost: path.cost };
      }
    }
    return best;
  }
}
