/**
 * P2 战斗物件：持续伤害区域、幻影匕首、剪影。
 * 规则依据：P2 裁决 C5/C6/C7。
 */
import type { RollEvent } from './resolver';
import type { UnitInstance } from './unit';
import type { Vec2 } from './types';
import { gridDistance } from './geometry';
import { ownerFor } from './phases';

export interface ZoneInstance {
  id: string;
  sourceId: string;
  center: Vec2;
  cells: Set<string>;
  dice: string;
  dc: number;
  damageType: string;
  /** 到期于施展者回合序号。 */
  expiresAtOwnerSerial: number;
  createdAtGlobalTurn: number;
}

export interface SilhouetteInstance {
  id: string;
  sourceId: string;
  targetId: string;
  x: number;
  y: number;
  expiresAtOwnerSerial: number;
}

export interface PhantomDaggerState {
  id: string;
  sourceId: string;
  attacksUsed: number;
  expiresAtOwnerSerial: number;
}

export function zoneCells(center: Vec2): Set<string> {
  const out = new Set<string>();
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      out.add(`${center.x + dx},${center.y + dy}`);
    }
  }
  return out;
}

export function zoneCellsArray(center: Vec2): Vec2[] {
  const out: Vec2[] = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) out.push({ x: center.x + dx, y: center.y + dy });
  }
  return out;
}

export function unitsInCells(units: readonly UnitInstance[], cells: Set<string>): UnitInstance[] {
  return units.filter((u) => u.hp > 0 && cells.has(`${u.x},${u.y}`));
}

export interface ZoneDamageResult {
  events: RollEvent[];
  damageByTarget: Map<string, number>;
  killedTargetIds: string[];
}

/** 结算旋刃魂曲的一次触发：范围内每个存活角色做 DC 敏捷豁免，失败全伤、成功半伤。 */
export function resolveZoneTrigger(
  zone: ZoneInstance,
  units: readonly UnitInstance[],
  rng: { die(sides: number): number },
): ZoneDamageResult {
  const events: RollEvent[] = [];
  const damageByTarget = new Map<string, number>();
  const killedTargetIds: string[] = [];
  const targets = unitsInCells(units, zone.cells);
  for (const target of targets) {
    const d20 = rng.die(20);
    const mod = target.attrMod('敏捷');
    const success = d20 !== 1 && (d20 === 20 || d20 + mod >= zone.dc);
    let raw: number;
    if (d20 === 1) {
      raw = 2 * evalZoneDice(zone.dice, target, rng);
    } else if (d20 === 20) {
      raw = 0;
      success && void success;
    } else {
      raw = evalZoneDice(zone.dice, target, rng) * (success ? 0.5 : 1);
    }
    const vuln = target.vulnerabilities.get(zone.damageType) ?? 0;
    const resist = target.resistances.get(zone.damageType) ?? 0;
    const amount = Math.max(0, Math.floor(raw + vuln - resist));
    if (amount > 0) target.applyDamage(amount);
    if (target.hp <= 0) killedTargetIds.push(target.id);
    damageByTarget.set(target.id, (damageByTarget.get(target.id) ?? 0) + amount);
    events.push({
      owner: ownerFor(target),
      label: `${target.name} 旋刃魂曲豁免`,
      kind: 'aoeSave',
      unitId: target.id,
      targetId: zone.sourceId,
      expression: `D20 + ${mod}`,
      parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: ownerFor(target) }],
      total: d20 + mod,
      detail: `D20=${d20} ${success ? '成功（半伤）' : '失败（全伤）'} → ${amount} 心灵伤害 → HP ${target.hp}/${target.hpMax}`,
    });
  }
  return { events, damageByTarget, killedTargetIds };
}

function evalZoneDice(dice: string, target: UnitInstance, rng: { die(sides: number): number }): number {
  // 只支持 4D4 / 4D6 与简单倍率；避免引入完整表达式依赖（zone 卡固定这两种）。
  const m = /^(\d+)[dD](\d+)$/.exec(dice.trim());
  if (!m) return 0;
  let total = 0;
  const count = Number(m[1]);
  const sides = Number(m[2]);
  for (let i = 0; i < count; i += 1) total += rng.die(sides);
  void target;
  return total;
}

/** 剪影：目标距离其影子是否 >= 6 米（combatDistance 口径）。 */
export function silhouetteOutOfRange(target: UnitInstance, silhouette: SilhouetteInstance): boolean {
  const dist = gridDistance({ x: target.x, y: target.y }, { x: silhouette.x, y: silhouette.y })
    + Math.abs((target.z ?? 0) - 0);
  return dist >= 6;
}
