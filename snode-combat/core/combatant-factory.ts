import type { Direction, Team, UnitCard, WeaponData } from './types';
import type { MonsterCardData, PlayerCardInput, EncounterCardData } from './cards';
import { UnitInstance } from './unit';
import { Board } from './board';
import { Encounter } from './encounter';
import type { SeededRng } from './rng';

function weaponProfsFor(weapon?: WeaponData): Record<string, number> {
  const out: Record<string, number> = {};
  if (!weapon) return out;
  const keys = [weapon.id, weapon.name, weapon.category, ...(weapon.tags ?? [])];
  for (const key of keys) {
    if (typeof key === 'string' && key.length > 0) out[key] = 1;
  }
  return out;
}

export function createMonsterUnit(
  card: MonsterCardData,
  opts: { id?: string; name?: string; x: number; y: number; facing: Direction },
): UnitInstance {
  const unitCard: UnitCard = {
    id: card.id,
    name: card.name,
    kind: 'monster',
    size: card.size,
    creatureType: card.creatureType,
    attrs: card.attrs,
    hpMax: card.hpMax,
    fpMax: card.fpMax,
    ac: card.ac,
    speed: card.speed,
    height: card.height ?? 1,
    proficiency: card.proficiency,
    keyAttr: card.attrs.敏捷 >= card.attrs.力量 ? '敏捷' : '力量',
    weaponProfs: weaponProfsFor(card.equipment?.mainHand),
    weapon: card.equipment?.mainHand,
    offhand: card.equipment?.offHand,
    initiative: { mode: card.initiative.mode, value: card.initiative.value },
    resources: { comboPointsMax: 0 },
    skillProfs: card.skillProfs,
    saveProfs: card.saveProfs,
  };
  return new UnitInstance(unitCard, {
    id: opts.id,
    name: opts.name,
    team: 'enemy',
    x: opts.x,
    y: opts.y,
    facing: opts.facing,
  });
}

export function createPlayerUnit(input: PlayerCardInput): UnitInstance {
  const team: Team = input.team ?? 'player';
  const unitCard: UnitCard = {
    id: input.id,
    name: input.name,
    kind: 'player',
    class: input.class,
    level: input.level,
    attrs: input.attrs,
    hpMax: input.hpMax,
    fpMax: input.fpMax,
    ac: input.ac,
    speed: input.speed,
    proficiency: input.proficiency,
    keyAttr: input.keyAttr,
    weaponProfs: input.weaponProfs,
    weapon: input.weapon,
    offhand: input.offhand,
    initiative: { mode: 'roll' },
    resources: { comboPointsMax: 5 },
    inventoryTags: input.inventoryTags ?? [],
    size: input.size,
    creatureType: input.creatureType,
    skillProfs: input.skillProfs,
    saveProfs: input.saveProfs,
  };
  return new UnitInstance(unitCard, { team });
}

export function createBoardFromEncounter(encounter: EncounterCardData): Board {
  return new Board(
    encounter.board.width,
    encounter.board.height,
    (encounter.terrain ?? []).map((t) => ({ ...t, z: t.z ?? 0 })),
  );
}

export function buildPveEncounter(
  encounterData: EncounterCardData,
  monsterCatalog: Map<string, MonsterCardData>,
  playerUnit: UnitInstance,
  rng: SeededRng,
): Encounter {
  const board = createBoardFromEncounter(encounterData);
  const encounter = new Encounter(encounterData.id, board, rng);

  const spawn = encounterData.playerSpawns[0] ?? { x: 0, y: 0, facing: 'N' as Direction };
  playerUnit.x = spawn.x;
  playerUnit.y = spawn.y;
  playerUnit.facing = spawn.facing;
  encounter.addUnit(playerUnit);

  for (const m of encounterData.monsters) {
    const card = monsterCatalog.get(m.ref);
    if (!card) throw new Error(`怪物不存在: ${m.ref}`);
    const unit = createMonsterUnit(card, {
      id: `${encounterData.id}:${m.ref}:${m.x},${m.y}`,
      name: m.displayName ?? card.name,
      x: m.x,
      y: m.y,
      facing: m.facing,
    });
    encounter.addUnit(unit);
  }

  encounter.rollInitiative();
  return encounter;
}
