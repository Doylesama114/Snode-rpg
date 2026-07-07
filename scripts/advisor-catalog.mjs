/**
 * Advancement catalog for UI (Phase 8B).
 */
import { loadAdvisorStore } from './advisor-retrieve.mjs';
import { analyzeSnapshot, normalizeSnapshot } from './advisor-snapshot.mjs';

export function getAdvancementCatalog(snapshot = null) {
  const store = loadAdvisorStore();
  const skills = store.advancementSkills?.byName || {};
  const advancements = store.advancements.advancements.filter(
    (a) => a.mageEligible !== false || skills[a.name],
  );

  let eligibilityMap = {};
  if (snapshot) {
    const norm = snapshot.meta?.layer === 'L6' ? snapshot : normalizeSnapshot(snapshot);
    const analysis = analyzeSnapshot(norm, { advancementNames: null });
    for (const e of analysis.advancements) {
      eligibilityMap[e.advancementName] = e;
    }
  }

  return {
    meta: {
      ...(store.advancementSkills?.meta || {}),
      total: advancements.length,
      documentedCount: Object.keys(skills).length,
    },
    advancements: advancements.map((a) => ({
      id: a.id,
      name: a.name,
      scope: a.scope,
      sourceClasses: a.sourceClasses,
      attrsRequired: a.attrsRequired,
      markCost: a.markCost,
      conditions: a.conditions,
      inferenceBlurb: a.inferenceBlurb,
      confidence: skills[a.name] ? 'documented' : a.confidence,
      documented: !!skills[a.name],
      eligibility: eligibilityMap[a.name] || null,
    })),
    skillsByName: skills,
  };
}
