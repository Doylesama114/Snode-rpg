import type {
  AbilityCardData,
  EncounterCardData,
  MonsterCardData,
  StatusCardData,
} from './cards';

export interface CatalogInput {
  abilities?: Array<AbilityCardData | Record<string, unknown>>;
  statuses?: Array<StatusCardData | Record<string, unknown>>;
  monsters?: Array<MonsterCardData | Record<string, unknown>>;
  encounters?: Array<EncounterCardData | Record<string, unknown>>;
}

export interface CatalogValidationError {
  kind: 'missing-id' | 'duplicate-id' | 'missing-status-ref' | 'missing-monster-ref' | 'missing-ability-ref';
  message: string;
}

export class CardCatalog {
  readonly abilities = new Map<string, AbilityCardData>();
  readonly statuses = new Map<string, StatusCardData>();
  readonly monsters = new Map<string, MonsterCardData>();
  readonly encounters = new Map<string, EncounterCardData>();

  constructor(input: CatalogInput = {}) {
    for (const item of input.abilities ?? []) {
      this.abilities.set(requireId(item), item as AbilityCardData);
    }
    for (const item of input.statuses ?? []) {
      this.statuses.set(requireId(item), item as StatusCardData);
    }
    for (const item of input.monsters ?? []) {
      this.monsters.set(requireId(item), item as MonsterCardData);
    }
    for (const item of input.encounters ?? []) {
      this.encounters.set(requireId(item), item as EncounterCardData);
    }
  }
}

function requireId(item: unknown): string {
  const record = item as Record<string, unknown> | null;
  if (typeof record?.id !== 'string' || record.id.length === 0) {
    throw new Error('数据卡缺少合法 id');
  }
  return record.id;
}

function idText(id: unknown): string | null {
  return typeof id === 'string' ? id : null;
}

/** 从任意 JSON 中收集 status 引用。 */
export function collectStatusRefs(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectStatusRefs(item, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  const record = value as Record<string, unknown>;
  if (
    (record.op === 'condition' || record.op === 'statusLayers')
    && typeof record.name === 'string'
  ) {
    out.add(record.name);
  }
  for (const child of Object.values(record)) collectStatusRefs(child, out);
  return out;
}

/** 校验能力卡引用的状态、怪物引用、怪物能力引用、遭遇怪物引用。 */
export function validateCatalog(catalog: CardCatalog): CatalogValidationError[] {
  const errors: CatalogValidationError[] = [];

  for (const ability of catalog.abilities.values()) {
    for (const ref of collectStatusRefs(ability)) {
      if (!catalog.statuses.has(ref)) {
        errors.push({
          kind: 'missing-status-ref',
          message: `能力 ${ability.id} 引用了不存在的状态: ${ref}`,
        });
      }
    }
  }

  for (const monster of catalog.monsters.values()) {
    for (const abilityRef of monster.abilities ?? []) {
      if (abilityRef.startsWith('core.')) continue;
      if (!catalog.abilities.has(abilityRef)) {
        errors.push({
          kind: 'missing-ability-ref',
          message: `怪物 ${monster.id} 引用了不存在的能力: ${abilityRef}`,
        });
      }
    }
  }

  for (const encounter of catalog.encounters.values()) {
    for (const spawn of encounter.monsters) {
      if (!catalog.monsters.has(spawn.ref)) {
        errors.push({
          kind: 'missing-monster-ref',
          message: `遭遇 ${encounter.id} 引用了不存在的怪物: ${spawn.ref}`,
        });
      }
    }
  }

  return errors;
}

/** 收集并校验 JSON 数据；返回 catalog 与错误。 */
export function buildCatalog(input: CatalogInput): { catalog: CardCatalog; errors: CatalogValidationError[] } {
  const catalog = new CardCatalog(input);
  const errors = validateCatalog(catalog);
  return { catalog, errors };
}

export function idOf(item: unknown): string | null {
  return idText((item as Record<string, unknown> | null)?.id);
}
