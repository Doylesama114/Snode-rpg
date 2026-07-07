/**
 * Build Advisor — Phase 1 entity index: resolve, lookup, format cards.
 */
import fs from 'fs';
import path from 'path';

export const MAX_ENTITY_CARDS = 3;

let _entityCache = null;

export function resetEntityStoreCache() {
  _entityCache = null;
}

export function loadEntityStore(advisorRoot) {
  if (_entityCache) return _entityCache;
  const dir = path.join(advisorRoot, 'entities');
  const indexPath = path.join(dir, 'index.json');
  if (!fs.existsSync(indexPath)) return null;

  const read = (rel) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));

  const byType = {
    race: Object.fromEntries((read('races.json').entities || []).map((e) => [e.id, e])),
    background: Object.fromEntries((read('backgrounds.json').entities || []).map((e) => [e.id, e])),
    class: Object.fromEntries((read('classes.json').entities || []).map((e) => [e.id, e])),
  };

  _entityCache = {
    index: read('index.json'),
    byType,
  };
  return _entityCache;
}

export function getEntityCard(entityStore, entityType, id) {
  if (!entityStore) return null;
  return entityStore.byType[entityType]?.[id] || null;
}

function buildNeedles(entityStore) {
  const needles = [];
  for (const entry of entityStore.index.entries || []) {
    if (!entry.key || !entry.entityType || !entry.id) continue;
    needles.push({
      needle: entry.key,
      entityType: entry.entityType,
      id: entry.id,
      isAlias: !!entry.isAlias,
    });
  }
  needles.sort((a, b) => b.needle.length - a.needle.length);
  return needles;
}

export function resolveEntities(query, entityStore, max = MAX_ENTITY_CARDS) {
  if (!entityStore || !query) return [];

  const q = String(query);
  const needles = buildNeedles(entityStore);
  const hits = [];
  const seen = new Set();

  for (const n of needles) {
    if (!q.includes(n.needle)) continue;
    const sig = `${n.entityType}:${n.id}`;
    if (seen.has(sig)) continue;
    const card = getEntityCard(entityStore, n.entityType, n.id);
    if (!card) continue;
    seen.add(sig);
    hits.push({
      entityType: n.entityType,
      id: n.id,
      matchKey: n.needle,
      isAlias: n.isAlias,
      card,
      formatted: formatEntityCard(card),
    });
    if (hits.length >= max) break;
  }

  return hits;
}

export function formatAttrBonusLine(attrBonus) {
  if (!attrBonus) return '无';
  const parts = Object.entries(attrBonus)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`);
  if (!parts.length) return '全属性 +0';
  const zeroCount = Object.values(attrBonus).filter((v) => v === 0).length;
  if (zeroCount >= 6) return `${parts.join('，')}（其余属性 +0）`;
  return parts.join('，');
}

export function formatRaceCard(race) {
  const lines = [`## 种族：${race.name}`];
  lines.push(`- 属性加成：${formatAttrBonusLine(race.attrBonus)}`);
  lines.push(`- 生命值加成：${race.hpBonus ?? 0}`);
  if (race.moveSpeed) lines.push(`- 移动力：${race.moveSpeed}`);
  if (race.size) lines.push(`- 体型：${race.size}`);
  if (race.lifespan) lines.push(`- 寿命：${race.lifespan}`);
  if (race.traits?.length) {
    lines.push('- 种族特性：');
    for (const t of race.traits) {
      lines.push(`  · ${t.name}：${t.desc || ''}`);
    }
  }
  if (race.description) lines.push(`- 简介：${race.description}`);
  return lines.join('\n');
}

export function formatSkillGrants(grants) {
  if (!grants?.length) return '无';
  return grants.map((g) => {
    switch (g.kind) {
      case 'fixed':
        return `固定：${(g.skills || []).join('、')}`;
      case 'fixed_professional':
        return `专业熟练：${(g.skills || []).join('、')}`;
      case 'choice_from_category':
        return `${g.label || `任选${g.count}项${g.category}`}（可选：${(g.options || []).slice(0, 6).join('、')}${(g.options?.length || 0) > 6 ? '…' : ''}）`;
      case 'choice_one':
        return g.label || '任选一项基础熟练度';
      case 'choice_language':
        return g.label || `任选${g.count}门语言`;
      case 'free_text':
        return g.label || '专业熟练（创建时自填）';
      case 'note':
        return g.label || g.kind;
      default:
        return g.label || JSON.stringify(g);
    }
  }).join('；');
}

export function formatBackgroundCard(bg) {
  const lines = [`## 背景：${bg.name}`];
  if (bg.skillGrants?.length) {
    lines.push(`- 熟练授予：${formatSkillGrants(bg.skillGrants)}`);
  } else {
    if (bg.baseSkills) lines.push(`- 基础熟练项：${bg.baseSkills}`);
    if (bg.profSkills && bg.profSkills !== '无') lines.push(`- 专业熟练项：${bg.profSkills}`);
  }
  if (bg.skills?.length) lines.push(`- 熟练汇总（固定部分）：${bg.skills.join('、')}`);
  if (bg.other && bg.other !== '无') lines.push(`- 其他：${bg.other}`);
  if (bg.hpBonus != null) lines.push(`- 生命值加成：${bg.hpBonus}`);
  if (bg.funds) lines.push(`- 起始资金：${bg.funds}`);
  if (bg.equipment) {
    const eq = Array.isArray(bg.equipment) ? bg.equipment.join('、') : bg.equipment;
    lines.push(`- 起始装备：${eq}`);
  }
  if (bg.mageSkillHits?.length) {
    lines.push(`- 法师相关熟练：${bg.mageSkillHits.join('、')}`);
  }
  if (bg.description) lines.push(`- 简介：${bg.description.slice(0, 200)}`);
  return lines.join('\n');
}

export function formatClassCard(cl) {
  const lines = [`## 职业：${cl.name}`];
  if (cl.rolePositioning) lines.push(`- 职责定位：${cl.rolePositioning}`);
  lines.push(`- 关键属性：${cl.keyAttr}；豁免：${(cl.saves || []).join('、')}`);
  lines.push(`- 护甲熟练：${cl.armor}；武器熟练（创建页）：${cl.weapons}`);
  if (cl.weaponProfCategories?.length) {
    lines.push(`- 武器熟练类别（面板）：${cl.weaponProfCategories.join('、')}`);
  }
  if (cl.weaponCategoryNote) lines.push(`- ${cl.weaponCategoryNote}`);
  lines.push(`- 技巧选择：${cl.skillPickRule || cl.skills}`);
  if (cl.hpFormula?.first) lines.push(`- 生命/疲劳：${cl.hpFormula.first}；${cl.fpFormula?.first || ''}`);
  if (cl.startingFeatures?.length) {
    lines.push(`- 初始特性：${cl.startingFeatures.length} 选 ${cl.startingChoice}（${cl.startingFeatures.map((f) => f.name).join('、')}）`);
  }
  for (const spec of cl.specializations || []) {
    lines.push(`- 专精「${spec.name}」：${spec.effect || spec.buildHint || ''}`);
  }
  if (cl.description) lines.push(`- 简介：${cl.description.slice(0, 160)}`);
  return lines.join('\n');
}

export function formatEntityCard(entity) {
  switch (entity.entityType) {
    case 'race':
      return formatRaceCard(entity);
    case 'background':
      return formatBackgroundCard(entity);
    case 'class':
      return formatClassCard(entity);
    default:
      return JSON.stringify(entity).slice(0, 400);
  }
}

/** @deprecated use formatEntityCard on resolved hit.card */
export function formatMageClassBasicsFromEntity(classCard, query, store) {
  if (!classCard) return '';
  let text = formatClassCard(classCard);
  if (/装备|起手|套装/.test(query) && store?.mageStartingGear?.kits) {
    text += '\n';
    for (const letter of ['A', 'B', 'C', 'D']) {
      const kit = store.mageStartingGear.kits[letter];
      if (kit) text += `- 起始套装 ${letter}：${kit.summary}\n`;
    }
  }
  return text.trim();
}
