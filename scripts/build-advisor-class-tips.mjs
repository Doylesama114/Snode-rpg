/**
 * Phase 5 batch 9 (7036) — 从 hints 生成 L5 class_tips 风格 stub
 * Run: node scripts/build-advisor-class-tips.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADVISOR = path.join(ROOT, 'advisor');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function slugFor(className, profile) {
  if (className === '法师') return 'mage';
  return profile.l2Slug || className;
}

function buildStyleTip(className, slug, style) {
  const id = `tip-${slug}-style-${style.name}`;
  const samples = (style.sampleSkills || []).slice(0, 4);
  const summary = style.summary || `${style.name}战斗风格`;
  const detail = [
    samples.length ? `示例技能：${samples.join('、')}。` : '',
    '此为顾问自动摘要（非官方连招）；具体数值与前置以规则书/创建页为准。',
    'partial 档职业勿假设标识或进阶路线已完整收录。',
  ].filter(Boolean).join('');
  return {
    id,
    scope: 'class',
    applicableClasses: [className],
    title: `${className}·${style.name}风格`,
    kind: 'style_guide',
    confidence: 'auto_stub',
    style: style.name,
    summary,
    detail,
    relatedSkills: samples,
    relatedTipIds: [],
    tags: [className, style.name, '战斗风格', 'style_guide'],
    skillRefs: samples.map((name) => ({ name, source: slug })),
    searchText: `${className} ${style.name} ${summary} ${detail} ${samples.join(' ')} style_guide auto_stub`,
  };
}

function buildChargenTip(className, slug, text, idx) {
  const id = `tip-${slug}-chargen-${idx}`;
  return {
    id,
    scope: 'class',
    applicableClasses: [className],
    title: `${className}创建要点`,
    kind: 'chargen',
    confidence: 'auto_stub',
    style: null,
    summary: text.slice(0, 120),
    detail: text,
    relatedSkills: [],
    relatedTipIds: [],
    tags: [className, '车卡', '创建'],
    skillRefs: [],
    searchText: `${className} 创建 车卡 ${text} chargen auto_stub`,
  };
}

function buildPartialNoteTip(className, slug, note) {
  return {
    id: `tip-${slug}-partial-note`,
    scope: 'class',
    applicableClasses: [className],
    title: `${className}顾问档位说明`,
    kind: 'meta',
    confidence: 'auto_stub',
    style: null,
    summary: note.slice(0, 100),
    detail: note,
    relatedSkills: [],
    relatedTipIds: [],
    tags: [className, 'partial', '顾问'],
    skillRefs: [],
    searchText: `${className} partial 顾问 ${note}`,
  };
}

export function buildClassTipsForClass(className, profile, hints) {
  const slug = slugFor(className, profile);
  const tips = [];
  for (const style of hints?.styleHints || []) {
    tips.push(buildStyleTip(className, slug, style));
  }
  (hints?.chargenTips || []).forEach((text, i) => {
    tips.push(buildChargenTip(className, slug, text, i + 1));
  });
  const partialNote = hints?.advisorPartialNote || profile.advisorNote;
  if (profile.tier === 'partial' && partialNote) {
    tips.push(buildPartialNoteTip(className, slug, partialNote));
  }
  return {
    meta: {
      layer: 'L5',
      phase: '5-batch9',
      targetClass: className,
      tier: profile.tier || 'partial',
      status: 'auto_stub',
      count: tips.length,
      byKind: tips.reduce((acc, t) => {
        acc[t.kind] = (acc[t.kind] || 0) + 1;
        return acc;
      }, {}),
      note: '由 hints.styleHints 自动生成 style_guide；人工可覆盖本文件',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    tips,
  };
}

export function buildAllClassTips(options = {}) {
  const root = options.root || ROOT;
  const reg = readJson(path.join(root, 'advisor', 'chargen', 'class_registry.json'));
  const stats = { written: 0, tipCount: 0, classes: [] };

  for (const [className, profile] of Object.entries(reg.classes || {})) {
    if (className === '法师') continue;
    const hintsPath = path.join(root, 'advisor', 'chargen', 'hints', `${className}.json`);
    const hints = fs.existsSync(hintsPath) ? readJson(hintsPath) : null;
    const doc = buildClassTipsForClass(className, profile, hints);
    const outPath = path.join(root, 'advisor', 'combos', 'class_tips', `${className}.json`);
    writeJson(outPath, doc);
    stats.written++;
    stats.tipCount += doc.tips.length;
    stats.classes.push({ className, tips: doc.tips.length });
  }
  return stats;
}

function main() {
  const stats = buildAllClassTips();
  console.log('Class tips build complete:');
  console.log(`  classes: ${stats.written}, tips: ${stats.tipCount}`);
  for (const row of stats.classes) {
    console.log(`  ${row.className}: ${row.tips}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
