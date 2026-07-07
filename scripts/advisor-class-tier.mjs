/**
 * Phase 5 batch 10 (7037) — 职业档位 checklist 与审计
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClassProfile, loadClassRegistry } from './advisor-chargen-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADVISOR = path.join(__dirname, '..', 'advisor');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ADVISOR, rel), 'utf8'));
}

function exists(rel) {
  return fs.existsSync(path.join(ADVISOR, rel));
}

function slugFor(className, profile) {
  if (className === '法师') return 'mage';
  return profile.l2Slug || null;
}

function skillIndexCount(slug) {
  const p = path.join(ADVISOR, 'skills', `${slug}_index.json`);
  if (!fs.existsSync(p)) return 0;
  return readJson(`skills/${slug}_index.json`).skills?.length || 0;
}

function tipsCount(className) {
  if (className === '法师') {
    if (!exists('combos/mage_tips.json')) return 0;
    return readJson('combos/mage_tips.json').tips?.length || 0;
  }
  const p = path.join(ADVISOR, 'combos', 'class_tips', `${className}.json`);
  if (!fs.existsSync(p)) return 0;
  return JSON.parse(fs.readFileSync(p, 'utf8')).tips?.length || 0;
}

function hintsStyleCount(className) {
  const rel = className === '法师'
    ? 'chargen/mage_hints.json'
    : `chargen/hints/${className}.json`;
  if (!exists(rel)) return 0;
  return readJson(rel).styleHints?.length || 0;
}

function hasEntityCard(className) {
  if (!exists('entities/classes.json')) return false;
  const doc = readJson('entities/classes.json');
  return (doc.entities || []).some((e) => e.name === className);
}

function combatStyleCount(className, slug) {
  const rel = slug ? `chargen/${slug}_class.json` : 'chargen/mage_class.json';
  if (!exists(rel)) return 0;
  return readJson(rel).combatStyles?.length || 0;
}

function hasClassSkillPick(className) {
  if (!exists('chargen/proficiencies.json')) return false;
  return !!readJson('chargen/proficiencies.json').classSkillPick?.[className];
}

/**
 * @returns {{ className: string, tier: string, checks: { id: string, label: string, pass: boolean, note?: string }[], passCount: number, total: number, ready: boolean }}
 */
export function auditClassTier(className) {
  const profile = getClassProfile(className);
  const tier = profile.tier || 'basic';
  const slug = slugFor(className, profile);
  const checks = [];

  const add = (id, label, pass, note = '') => {
    checks.push({ id, label, pass: !!pass, note });
  };

  add('registry_tier', `registry tier=${tier}`, tier === 'full' || tier === 'partial');
  add('l2_layer', 'L2 路由配置', !!(profile.l2Layer && profile.l2Slug) || className === '法师');

  if (slug) {
    const n = skillIndexCount(slug);
    const minSkills = tier === 'full'
      ? (profile.fullL2MinSkills ?? (className === '法师' ? 300 : 80))
      : 40;
    add('l2_index', `L2 索引 ≥${minSkills} 技能`, n >= minSkills, `got ${n}`);
  } else {
    add('l2_index', 'L2 索引', false, 'no slug');
  }

  const classRel = slug ? `chargen/${slug}_class.json` : (className === '法师' ? 'chargen/mage_class.json' : null);
  add('l1_class', 'L1 职业基础', classRel && exists(classRel));

  add('entity_card', '实体卡', hasEntityCard(className));

  if (slug) {
    add('starting_gear', '起手套装 A–D', exists(`chargen/${slug}_starting_gear.json`));
    add('equipment_rules', '装备规则', exists(`chargen/${slug}_equipment_rules.json`));
  }

  add('proficiencies', 'classSkillPick', hasClassSkillPick(className));

  const styles = hintsStyleCount(className);
  const expectedStyles = combatStyleCount(className, slug);
  const minStyles = tier === 'full'
    ? Math.max(1, expectedStyles || styles || 1)
    : Math.max(1, Math.min(3, expectedStyles || 1));
  add('hints_styles', `hints 战斗风格 ≥${minStyles}`, styles >= minStyles, `got ${styles}`);

  const tips = tipsCount(className);
  const minTips = tier === 'full' ? (profile.l5MinTips ?? 20) : 2;
  add('l5_tips', `L5 小贴士 ≥${minTips}`, tips >= minTips, `got ${tips}`);

  if (tier === 'partial') {
    add('partial_note', 'partial advisorNote', !!profile.advisorNote);
    add('registry_l2', 'registry L2 slug/layer', !!(profile.l2Slug && profile.l2Layer));
  }

  if (tier === 'full' && className === '法师') {
    add('mage_specs', '法师三项专精 policy', !!profile.hasMageSpecs);
  }
  if (tier === 'full' && profile.promptProfile) {
    add('prompt_profile', `promptProfile=${profile.promptProfile}`, true);
  }

  const passCount = checks.filter((c) => c.pass).length;
  return {
    className,
    tier,
    checks,
    passCount,
    total: checks.length,
    ready: passCount === checks.length,
  };
}

export function auditAllClasses() {
  const reg = loadClassRegistry();
  const classes = Object.keys(reg.classes || {});
  const audits = classes.map((cn) => auditClassTier(cn));
  const full = audits.filter((a) => a.tier === 'full');
  const partial = audits.filter((a) => a.tier === 'partial');
  return {
    meta: {
      phase: '5-batch10',
      generatedAt: new Date().toISOString().slice(0, 10),
      classCount: audits.length,
      fullReady: full.filter((a) => a.ready).length,
      partialReady: partial.filter((a) => a.ready).length,
    },
    audits,
  };
}

export function formatTierAuditContext(className) {
  const audit = auditClassTier(className);
  const lines = [`## 顾问档位检查（${className} · ${audit.tier} · ${audit.passCount}/${audit.total}）`];
  const fails = audit.checks.filter((c) => !c.pass);
  if (audit.ready) {
    if (audit.tier === 'full') {
      lines.push(`- ${className} full 档资料项已齐；引用 L2/L5 须与上下文一致，标识/进阶未出现处勿编造。`);
    } else {
      lines.push(`- ${className} ${audit.tier} 档资料项已齐；仍须遵守 partial 免责声明（标识/进阶未全收录时勿编造）。`);
    }
  } else if (fails.length) {
    lines.push(`- 资料缺口：${fails.map((f) => f.label).join('、')}。`);
    lines.push('- 缺口项禁止编造；引导用户查创建页/规则书/DM。');
  }
  return lines.join('\n');
}

export function resolveClassPromptProfile(className, baseProfile) {
  const profile = getClassProfile(className);
  if (profile.promptProfile) return profile.promptProfile;
  if (profile.tier === 'full' && className === '法师') return 'mage_skills';
  if (baseProfile === 'class_skills' || baseProfile === 'mage_skills') return 'class_skills';
  return baseProfile;
}
