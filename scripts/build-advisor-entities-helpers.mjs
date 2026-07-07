/**
 * Shared helpers for build-advisor-entities.mjs and build-advisor-class-infra.mjs
 */
export function buildIndexEntries(entities, manualAliases) {
  const entries = [];
  const seen = new Set();

  for (const e of entities) {
    const sig = `${e.entityType}:${e.id}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    entries.push({ key: e.name, entityType: e.entityType, id: e.id, aliases: e.aliases || [] });
    for (const a of e.aliases || []) {
      entries.push({ key: a, entityType: e.entityType, id: e.id, aliases: [], isAlias: true });
    }
  }
  for (const row of manualAliases.aliases || []) {
    entries.push({
      key: row.alias,
      entityType: row.entityType,
      id: row.id,
      aliases: [],
      isAlias: true,
      manual: true,
    });
  }
  return entries;
}
