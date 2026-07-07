#!/usr/bin/env node
/**
 * Phase 5 batch 2 — 生成 universal_tips + 各职业 hints/tips 空壳
 * 用法: node scripts/build-advisor-class-content.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');

const UNIVERSAL_MIGRATE = {
  'tip-mage-T03': 'universal',
  'tip-mage-T06': 'universal',
  'tip-mage-T07': 'universal',
  'tip-mage-T08': 'universal',
  'tip-mage-T20': 'universal',
  'tip-mage-T21': 'universal',
  'tip-mage-T04': 'caster',
  'tip-mage-T10': 'caster',
  'tip-mage-T11': 'caster',
  'tip-mage-T19': 'caster',
};

function generalizeDetail(text, scope) {
  if (!text) return text;
  let d = text;
  if (scope === 'universal') {
    d = d.replace(/如闪现术/g, '如带迅捷的位移技能');
    d = d.replace(/闪现术/g, '迅捷位移');
    d = d.replace(/法术反制/g, '反应类反制');
    d = d.replace(/施放关键法术/g, '施放关键能力');
    d = d.replace(/降低被反制概率/g, '降低被反应打断概率');
  }
  return d;
}

function buildUniversalTips() {
  const mage = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'combos', 'mage_tips.json'), 'utf8'));
  const tips = [];
  for (const src of mage.tips) {
    const scope = UNIVERSAL_MIGRATE[src.id];
    if (!scope) continue;
    const id = src.id.replace('tip-mage-', 'tip-uni-');
    const detail = generalizeDetail(src.detail, scope);
    const summary = src.summary;
    tips.push({
      id,
      scope,
      migratedFrom: src.id,
      title: src.title,
      kind: src.kind,
      confidence: src.confidence,
      style: null,
      summary,
      detail,
      relatedSkills: [],
      relatedTipIds: [],
      tags: src.tags || [],
      skillRefs: [],
      searchText: `${src.title} ${scope} ${summary} ${detail} ${(src.tags || []).join(' ')}`,
    });
  }
  return {
    meta: {
      layer: 'L5',
      phase: '5-batch2',
      type: 'universal_tips',
      count: tips.length,
      note: '全职业通用战斗规则 + 施法者通用规则；自 mage_tips combat_rule 迁移',
      generatedAt: new Date().toISOString().split('T')[0],
    },
    tips,
  };
}

function buildHintShell(className, profile) {
  return {
    meta: {
      layer: 'L1',
      phase: '5-batch2',
      targetClass: className,
      tier: profile.tier || 'basic',
      status: 'placeholder',
      note: '待 DM/设计补充；primaryAttr 已由 registry 兜底',
    },
    primaryAttr: {
      name: profile.keyAttr || null,
      targetAtCreation: profile.keyAttrTarget ?? 15,
      reason: '',
    },
    roleSummary: { positioning: [], blurb: '' },
    specializationHints: [],
    styleHints: [],
    recommendedRaces: [],
    recommendedBackgrounds: [],
    chargenTips: [],
  };
}

function buildTipsShell(className, profile) {
  return {
    meta: {
      layer: 'L5',
      phase: '5-batch2',
      targetClass: className,
      tier: profile.tier || 'basic',
      status: 'placeholder',
      count: 0,
      note: '职业专属小贴士待补充',
    },
    tips: [],
  };
}

function main() {
  const reg = JSON.parse(fs.readFileSync(path.join(ADVISOR, 'chargen', 'class_registry.json'), 'utf8'));
  const universal = buildUniversalTips();
  fs.writeFileSync(
    path.join(ADVISOR, 'combos', 'universal_tips.json'),
    `${JSON.stringify(universal, null, 2)}\n`,
    'utf8',
  );
  console.log('OK universal_tips:', universal.tips.length);

  const hintsDir = path.join(ADVISOR, 'chargen', 'hints');
  const tipsDir = path.join(ADVISOR, 'combos', 'class_tips');
  fs.mkdirSync(hintsDir, { recursive: true });
  fs.mkdirSync(tipsDir, { recursive: true });

  for (const [className, profile] of Object.entries(reg.classes || {})) {
    if (className === '法师') continue;
    const hp = path.join(hintsDir, `${className}.json`);
    if (!fs.existsSync(hp)) {
      fs.writeFileSync(hp, `${JSON.stringify(buildHintShell(className, profile), null, 2)}\n`, 'utf8');
      console.log('  hint shell:', className);
    }
    const tp = path.join(tipsDir, `${className}.json`);
    if (!fs.existsSync(tp)) {
      fs.writeFileSync(tp, `${JSON.stringify(buildTipsShell(className, profile), null, 2)}\n`, 'utf8');
      console.log('  tips shell:', className);
    }
  }
  console.log('Done.');
}

main();
