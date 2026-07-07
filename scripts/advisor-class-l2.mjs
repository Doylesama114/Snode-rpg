/**
 * Phase 5 — 职业 L2 层配置（registry 驱动）
 */
import { getClassProfile, isFullTier, loadClassRegistry } from './advisor-chargen-registry.mjs';

export const MAGE_L2 = 'L2-mage';
export const UNIVERSAL_L2 = 'L2-universal';

const MAGE_QUERY_RE = /法师|塑能|咒法|预言|防护|附魔|死灵|幻术|变化|法术|魔弹|飞弹|寒冰|火球/;

/** @returns {{ className: string, l2Layer: string, l2Slug: string, tier: string, styleKeywords?: string[] }[]} */
export function listL2ClassEntries() {
  const reg = loadClassRegistry();
  return Object.entries(reg.classes || {})
    .filter(([, p]) => p.l2Layer && p.l2Slug)
    .map(([className, p]) => ({
      className,
      l2Layer: p.l2Layer,
      l2Slug: p.l2Slug,
      tier: p.tier || 'basic',
      styleKeywords: p.styleKeywords || [],
    }));
}

export function getL2EntryByLayer(layerId) {
  return listL2ClassEntries().find((e) => e.l2Layer === layerId) || null;
}

export function getL2EntryByClassName(className) {
  const p = getClassProfile(className);
  if (!p.l2Layer || !p.l2Slug) return null;
  return {
    className,
    l2Layer: p.l2Layer,
    l2Slug: p.l2Slug,
    tier: p.tier || 'basic',
    styleKeywords: p.styleKeywords || [],
  };
}

export function allKnownL2LayerIds() {
  return [MAGE_L2, UNIVERSAL_L2, ...listL2ClassEntries().map((e) => e.l2Layer)];
}

function queryMatchesEntry(query, entry) {
  const q = String(query || '');
  if (entry.className && q.includes(entry.className)) return true;
  for (const kw of entry.styleKeywords || []) {
    if (kw && q.includes(kw)) return true;
  }
  return false;
}

export function allowL2Mage(className, query) {
  if (className === '法师' && isFullTier(getClassProfile('法师'))) return true;
  if (!className && MAGE_QUERY_RE.test(query || '')) return true;
  return false;
}

export function allowL2Layer(layerId, className, query) {
  if (layerId === MAGE_L2) return allowL2Mage(className, query);
  if (layerId === UNIVERSAL_L2) return true;

  const entry = getL2EntryByLayer(layerId);
  if (!entry) return false;
  if (className === entry.className && (entry.tier === 'partial' || entry.tier === 'full')) return true;
  if (!className && queryMatchesEntry(query, entry)) return true;
  return false;
}

/** 当前上下文应激活的 registry 职业 L2（不含 mage/universal） */
export function resolveRegistryL2Layer(className, query = '') {
  for (const entry of listL2ClassEntries()) {
    if (allowL2Layer(entry.l2Layer, className, query)) return entry.l2Layer;
  }
  return null;
}

export function resolveClassL2Layer(className, query = '') {
  if (allowL2Mage(className, query)) return MAGE_L2;
  return resolveRegistryL2Layer(className, query);
}

/** 从问句猜测职业名（无 chargen 上下文时） */
export function matchClassNameFromQuery(query) {
  const q = String(query || '');
  const aliases = [
    ['萨满祭司', '萨满'],
    ['圣骑士', '圣骑'],
  ];
  for (const entry of listL2ClassEntries()) {
    if (q.includes(entry.className)) return entry.className;
    for (const alias of aliases) {
      if (alias[0] === entry.className && q.includes(alias[1])) return entry.className;
    }
  }
  if (MAGE_QUERY_RE.test(q)) return '法师';
  return null;
}

export function detectClassStyles(query, className, styleNames = []) {
  return styleNames.filter((s) => s && query.includes(s));
}

export { MAGE_QUERY_RE };
