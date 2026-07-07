/**
 * Phase 5 batch 2 — 职业 hints/tips 与通用小贴士池加载
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClassProfile, loadClassRegistry, isFullTier } from './advisor-chargen-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

const CASTER_CLASSES = new Set([
  '法师', '牧师', '德鲁伊', '萨满祭司', '术士', '魔契师', '奇械师', '吟游诗人',
]);

const MIGRATED_COMBAT_RULE_IDS = new Set([
  'tip-mage-T03', 'tip-mage-T04', 'tip-mage-T06', 'tip-mage-T07', 'tip-mage-T08',
  'tip-mage-T10', 'tip-mage-T11', 'tip-mage-T19', 'tip-mage-T20', 'tip-mage-T21',
]);

export function isCasterClass(className) {
  if (!className) return false;
  const p = getClassProfile(className);
  if (p.isCaster != null) return !!p.isCaster;
  return CASTER_CLASSES.has(className);
}

function hintsPath(className) {
  if (className === '法师') return path.join(ADVISOR, 'chargen', 'mage_hints.json');
  return path.join(ADVISOR, 'chargen', 'hints', `${className}.json`);
}

function tipsPath(className) {
  if (className === '法师') return null;
  return path.join(ADVISOR, 'combos', 'class_tips', `${className}.json`);
}

export function loadClassHintsFile(className) {
  if (!className) return null;
  const p = hintsPath(className);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function loadClassTipsFile(className) {
  if (!className || className === '法师') return { tips: [] };
  const p = tipsPath(className);
  if (!fs.existsSync(p)) return { tips: [] };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { tips: [] };
  }
}

export function resolvePrimaryAttrHint(store, className) {
  if (!className) return store.mageHints?.primaryAttr || null;
  const hints = loadClassHintsFile(className);
  if (hints?.primaryAttr?.name) return hints.primaryAttr;
  const profile = getClassProfile(className);
  if (!profile.keyAttr) return null;
  return {
    name: profile.keyAttr,
    targetAtCreation: profile.keyAttrTarget ?? 15,
    reason: `${className}关键属性（registry；专属 hints 待补充）`,
  };
}

function tipMatchesScope(tip, className) {
  const scope = tip.scope || 'universal';
  if (scope === 'universal') return true;
  if (scope === 'caster') return isCasterClass(className);
  if (scope === 'class') {
    const list = tip.applicableClasses || [];
    return !className || list.includes(className);
  }
  return true;
}

/**
 * L5 检索池：通用 + 职业空壳/已填 + 法师专属（full tier）
 */
export function collectTipsPool(store, className) {
  const tips = [];
  const seen = new Set();

  function add(t) {
    if (!t?.id || seen.has(t.id)) return;
    seen.add(t.id);
    tips.push(t);
  }

  for (const t of store.universalTips?.tips || []) {
    if (tipMatchesScope(t, className)) add(t);
  }

  const classTips = loadClassTipsFile(className);
  for (const t of classTips.tips || []) add(t);

  if (className === '法师' && isFullTier(getClassProfile('法师'))) {
    for (const t of store.tips?.tips || []) {
      if (t.kind === 'combat_rule' && MIGRATED_COMBAT_RULE_IDS.has(t.id)) continue;
      add(t);
    }
  }

  return tips;
}

export function listRegistryClassNames() {
  const reg = loadClassRegistry();
  return Object.keys(reg.classes || {});
}

export { MIGRATED_COMBAT_RULE_IDS, CASTER_CLASSES };
