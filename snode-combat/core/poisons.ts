import type { AttrName } from './types';
import type { RollEvent } from './resolver';
import type { UnitInstance } from './unit';
import type { Encounter } from './encounter';
import type { StatusCardData } from './cards';

export interface PoisonCardData {
  id: string;
  name: string;
  durationTurns?: number;
  kind: 'save' | 'loseHp' | 'dcPenalty';
  save?: { attr: AttrName; dc: number };
  status?: string;
  amount?: number;
  penalties?: Record<string, number>;
  levelScaling?: Array<{ minLevel: number; patch: { amount?: number; penalties?: Record<string, number> } }>;
  display?: { description?: string; source?: string };
}

export interface PoisonTriggerOptions {
  rng: { next(): number; die(sides: number): number };
  statusCatalog: Map<string, StatusCardData>;
  poisonCatalog: Map<string, PoisonCardData>;
}

function scaledPoison(poison: PoisonCardData, level: number): PoisonCardData {
  let amount = poison.amount;
  let penalties = poison.penalties ? { ...poison.penalties } : undefined;
  for (const entry of poison.levelScaling ?? []) {
    if (level < entry.minLevel) continue;
    if (entry.patch.amount !== undefined) amount = entry.patch.amount;
    if (entry.patch.penalties) penalties = { ...(penalties ?? {}), ...entry.patch.penalties };
  }
  return { ...poison, amount, penalties };
}

function hasStatus(target: UnitInstance, id: string | undefined): boolean {
  return id ? target.hasCondition(id) : false;
}

export function triggerWeaponPoisons(
  source: UnitInstance,
  target: UnitInstance,
  encounter: Encounter,
  opts: PoisonTriggerOptions,
): RollEvent[] {
  const events: RollEvent[] = [];
  const weapons = [source.weapon, source.offhand].filter((w) => !!w && w.rangeMetric !== 'grid');
  for (const weapon of weapons) {
    for (const poisonId of weapon?.appliedPoisons ?? []) {
      const base = opts.poisonCatalog.get(poisonId);
      if (!base) continue;
      const poison = scaledPoison(base, source.card.level ?? 1);
      if (hasStatus(target, poison.status)) continue;

      if (poison.kind === 'save' && poison.save) {
        const attr: AttrName = poison.save.attr;
        const mod = target.attrMod(attr);
        const d20 = opts.rng.die(20);
        const total = d20 + mod;
        const success = d20 !== 1 && (d20 === 20 || total >= poison.save.dc);
        events.push({
          owner: target.team === 'player' ? 'player' : 'auto',
          label: `${target.name} ${poison.name} ${attr}豁免 DC${poison.save.dc}`,
          kind: 'save', unitId: target.id, targetId: source.id,
          expression: `D20 + ${mod}`,
          parts: [{ kind: 'dice', label: '1D20', values: [d20], value: d20, owner: target.team === 'player' ? 'player' : 'auto' }],
          total,
          detail: `${d20}+${mod}=${total} vs DC${poison.save.dc} ${success ? '成功' : '失败'}`,
        });
        if (!success && poison.status) {
          target.addTemporaryCondition(poison.status, 1);
          events.push({ owner: 'auto', label: `${target.name} 进入${poison.status}`, kind: 'status', unitId: target.id, total: 1, detail: '毒药状态，持续一回合' });
        }
      } else if (poison.kind === 'loseHp' && poison.amount) {
        target.loseHp(poison.amount);
        events.push({ owner: 'auto', label: `${target.name} 速效毒药`, kind: 'loseHp', unitId: target.id, total: poison.amount, detail: `失去${poison.amount}生命值 → ${target.hp}/${target.hpMax}` });
      } else if (poison.kind === 'dcPenalty' && poison.penalties) {
        target.addTemporaryCondition('poison_dc_penalty', 1);
        for (const [status, value] of Object.entries(poison.penalties)) {
          const prev = target.saveDcPenalties.get(status) ?? 0;
          target.saveDcPenalties.set(status, Math.max(prev, value));
        }
        events.push({ owner: 'auto', label: `${target.name} 致伤毒药`, kind: 'status', unitId: target.id, total: 1, detail: `对灼烧/中毒/流血等豁免难度+2，持续一回合` });
      }
    }
  }
  return events;
}
