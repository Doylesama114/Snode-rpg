/**
 * Phase 5 batch 1 — 职业注册表（档位、关键属性、车卡参数）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '..', 'advisor', 'chargen', 'class_registry.json');

let _cache = null;

export function loadClassRegistry() {
  if (_cache) return _cache;
  _cache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  return _cache;
}

export function getClassProfile(className) {
  const reg = loadClassRegistry();
  const base = { ...reg.defaults };
  const row = reg.classes?.[className];
  if (!row) {
    return {
      ...base,
      className: className || null,
      tier: 'basic',
      keyAttr: null,
    };
  }
  return { ...base, ...row, className };
}

export function resolveKeyAttrs(char, profile = null) {
  const p = profile || getClassProfile(char?.className);
  const chosen = (char?.keyAttr || '').trim();
  if (chosen && chosen !== '无') {
    if (chosen.includes('或')) {
      return chosen.split('或').map((s) => s.trim()).filter(Boolean);
    }
    return [chosen];
  }
  const raw = p.keyAttr || '';
  if (!raw) return [];
  if (raw.includes('或')) {
    return raw.split('或').map((s) => s.trim()).filter(Boolean);
  }
  return [raw];
}

export function getStartingFeatureMax(char, profile = null) {
  const p = profile || getClassProfile(char?.className);
  const pick = p.startingFeaturePick;
  if (pick === 'all') {
    const n = (char?.selectedFeatures || []).length;
    return n > 0 ? n : 3;
  }
  return typeof pick === 'number' ? pick : 2;
}

export function formatKeyAttrLabel(char, profile = null) {
  const attrs = resolveKeyAttrs(char, profile);
  if (!attrs.length) return '关键属性';
  return attrs.join('或');
}

export function analyzeKeyAttrTargets(char, profile = null) {
  const p = profile || getClassProfile(char?.className);
  const target = p.keyAttrTarget ?? 15;
  const attrs = resolveKeyAttrs(char, p);
  const raceBonuses = char?.raceAttrBonuses || {};
  const base = char?.attrs || {};
  const chosen = (char?.keyAttr || '').trim();
  const orChoice = !chosen && attrs.length > 1 && (p.keyAttr || '').includes('或');
  const rows = attrs.map((an) => {
    let bonus = 0;
    if (raceBonuses[an] != null && raceBonuses[an] !== 'X') {
      bonus = typeof raceBonuses[an] === 'number' ? raceBonuses[an] : parseInt(raceBonuses[an], 10) || 0;
    }
    const baseVal = base[an] ?? 8;
    const final = baseVal + bonus;
    return { attr: an, base: baseVal, final, target, met: final >= target };
  });
  const anyMet = rows.some((r) => r.met);
  const allMet = orChoice ? anyMet : (rows.length > 0 && rows.every((r) => r.met));
  return {
    target,
    attrs: rows,
    allMet,
    anyMet,
    orChoice,
  };
}

export function formatKeyAttrTargetPhrase(char, profile = null) {
  const p = profile || getClassProfile(char?.className);
  const kt = analyzeKeyAttrTargets(char, p);
  const label = formatKeyAttrLabel(char, p);
  const target = p.keyAttrTarget ?? 15;
  if (kt.orChoice) return `${label}至少一项≥${target}`;
  return `${label}≥${target}`;
}

export function isComplexChargenClass(profile) {
  if (!profile) return false;
  return !!(
    profile.hasMageSpecs
    || profile.keyAttrCreateNote
    || profile.specProfChoices?.length
    || (profile.keyAttr || '').includes('或')
    || profile.startingFeaturePick === 'all'
    || profile.className === '魔契师'
  );
}

export function formatTierAdvisorNote(profile) {
  if (!profile) return '';
  if (profile.tier === 'partial' && profile.advisorNote) return profile.advisorNote;
  if (profile.tier === 'basic') {
    return '当前为通用创建陪跑（基础档）；该职业专属 build 小贴士与技能深度建议尚在完善，请以创建页与规则书为准。';
  }
  return '';
}

export function isFullTier(profile) {
  return profile?.tier === 'full';
}
