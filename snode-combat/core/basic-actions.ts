import type { AbilityCardData, StatusCardData } from './cards';
import type { WeaponData } from './types';
import type { UnitInstance } from './unit';
import type { Encounter } from './encounter';
import { executeAbility } from './resolver';
import type { PoisonCardData } from './poisons';


export function createBasicAttackAbility(source: UnitInstance, weaponOverride?: WeaponData): AbilityCardData | null {
  const weapon = weaponOverride ?? source.weapon;
  if (!weapon) return null;
  const isMelee = weapon.rangeMetric !== 'grid';
  return {
    id: 'core.basicAttack',
    name: '基础攻击',
    category: 'basic',
    active: true,
    cast: {
      action: 'main',
      fp: null,
      duration: 'instant',
      usage: { scope: 'unlimited', max: 99 },
      keywords: ['基础攻击', isMelee ? '近战攻击' : '远程攻击'],
      consumeAmmo: weapon.ammoType ? true : undefined,
    },
    conditions: [],
    targeting: isMelee
      ? {
          kind: 'unit',
          range: { metric: 'adjacent' },
          filter: { teams: ['enemy'], livingOnly: true },
        }
      : {
          kind: 'unit',
          range: { metric: 'grid', max: weapon.rangeMax ?? 12 },
          filter: { teams: ['enemy'], livingOnly: true },
        },
    resolution: {
      rolls: [
        {
          id: 'attack',
          kind: 'attack',
          attr: 'weapon',
          prof: 'weapon',
          vs: 'AC',
          target: 'targets',
        },
      ],
      branches: [
        {
          if: { roll: 'attack', outcome: 'hit' },
          effects: [
            { op: 'damage', source: 'weapon', timing: 'before', dice: '@weapon.dice', flat: '@weapon.attrMod' },
            {
              op: 'damage', source: 'effect', timing: 'after', dice: '0',
              flat: source.daringActive ? String((source.card.level ?? 1) >= 8 ? 4 : 2) : '0',
            },
            {
              when: 'targetIsEnemy',
              op: 'resource',
              resource: 'comboPoints',
              amount: '+1',
              target: 'self',
            },
          ],
        },
      ],
    },
    effects: [],
    display: {
      description: '使用当前武器发起一次基础攻击。普通攻击命中后获得 1 个连击点。',
      keywords: ['基础攻击', isMelee ? '近战攻击' : '远程攻击'],
      source: 'core.basicAttack',
      reviewStatus: 'draft',
    },
  };
}

export interface BasicAttackResult {
  ok: boolean;
  reason?: string;
  events: ReturnType<typeof executeAbility>['events'];
  damage: number;
  targetId?: string;
  killedTargetIds?: string[];
}

export function executeBasicAttack(
  source: UnitInstance,
  target: UnitInstance,
  encounter: Encounter,
  rng: { next(): number; die(sides: number): number },
  statusCatalog: Map<string, StatusCardData>,
  poisonCatalog?: Map<string, PoisonCardData>,
  opts: { weapon?: WeaponData; gainCombo?: boolean; skipActionCost?: boolean; cancelHitEffects?: import('./resolver').ExecuteAbilityOptions['cancelHitEffects'] } = {},
): BasicAttackResult {
  const card = createBasicAttackAbility(source, opts.weapon);
  if (!card) return { ok: false, reason: '没有可用武器', events: [], damage: 0, killedTargetIds: [] };
  if (opts.gainCombo === false) {
    const branch = (card.resolution as { branches?: Array<{ effects?: unknown[] }> }).branches?.[0];
    if (branch) branch.effects = (branch.effects ?? []).filter((e) => (e as { op?: string }).op !== 'resource');
  }
  const result = executeAbility(card, source, encounter, { rng, statusCatalog, targets: [target], poisonCatalog, skipActionCost: opts.skipActionCost, cancelHitEffects: opts.cancelHitEffects });
  return {
    ok: result.ok,
    reason: result.reason,
    events: result.events,
    damage: result.damageByTarget.get(target.id) ?? 0,
    targetId: result.ok ? target.id : undefined,
    killedTargetIds: result.killedTargetIds,
  };
}

/** 装填武器：0动作 = 附赠动作。 */
export function reloadWeapon(source: UnitInstance): { ok: boolean; reason?: string } {
  const ammoType = source.weapon?.ammoType;
  if (!ammoType) return { ok: false, reason: '当前武器不需要装填' };
  const ammo = source.ammo.get(ammoType);
  if (!ammo) return { ok: false, reason: '没有对应弹药' };
  if (ammo.loaded) return { ok: true };
  if (ammo.reserve <= 0) return { ok: false, reason: '弹药耗尽' };
  if (!source.useAction('bonus')) return { ok: false, reason: '没有附赠动作' };
  source.reload(ammoType);
  return { ok: true };
}

/** 战斗结束后弹药自动补满。 */
export function refillAmmoAfterBattle(source: UnitInstance): void {
  for (const ammo of source.ammo.values()) {
    ammo.loaded = true;
    ammo.reserve = 20;
  }
}
