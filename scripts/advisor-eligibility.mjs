/**
 * Build Advisor — attribute eligibility checks (Phase 3).
 */

/**
 * @param {Record<string, number>} attrs current attribute values
 * @param {Record<string, number>} required minimum required per attribute
 * @returns {{ eligible: boolean, gaps: Record<string, number> }}
 */
export function checkEligibility(attrs, required = {}) {
  const gaps = {};
  for (const [key, min] of Object.entries(required)) {
    const current = attrs[key] ?? 0;
    if (current < min) gaps[key] = min - current;
  }
  return { eligible: Object.keys(gaps).length === 0, gaps };
}

/**
 * @param {object} advancement chunk or raw advancement with attrsRequired / attrs
 * @param {Record<string, number>} attrs
 */
export function checkAdvancementEligibility(advancement, attrs) {
  const required = advancement.attrsRequired || advancement.attrs || {};
  const result = checkEligibility(attrs, required);
  return {
    ...result,
    advancementId: advancement.id,
    advancementName: advancement.name,
  };
}

/**
 * Filter advancements reachable by a mage main class character (attrs-only pass).
 * @param {object[]} advancements
 * @param {Record<string, number>} attrs
 */
export function listEligibleAdvancements(advancements, attrs) {
  return advancements
    .filter((a) => a.mageEligible !== false)
    .map((a) => checkAdvancementEligibility(a, attrs))
    .filter((r) => r.eligible);
}
