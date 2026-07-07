#!/usr/bin/env node
/**
 * Phase 5 batch 3 — 奇械师 Tier B：artificer_class + hints  enrichment
 * Run: node scripts/build-advisor-artificer.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_CHARGEN = path.join(ROOT, 'advisor', 'chargen');
const CLASSES_JSON = path.join(ROOT, '职业页', '数据', 'classes.json');
const ARTIFICER_JSON = path.join(ROOT, '职业页', '数据', '奇械师.json');

const ARTIFICER_STYLES = ['精准', '构想', '支援', '炽擎', '电涌', '魔枢'];

const STYLE_SUMMARIES = {
  精准: '远程枪械与精准射击线；命中加值、远程战技与专注联动。',
  构想: '科研图纸、奇械研发与专业列表扩展；偏资源与构筑。',
  支援: '团队增益、装置部署与战场辅助。',
  炽擎: '热能/火焰相关科技输出与装置。',
  电涌: '雷电/电系科技输出与控制。',
  魔枢: '核心装置、同调与奇械中枢能力。',
};

const STARTING_FEATURE_NAMES = ['精准射击', '基础材料学', '同调协手', '魔法武器'];

const SPECIALIZATIONS = [
  { name: '奇械构装', effect: '获得工程学熟练度（知识-工程学）' },
  { name: '万用模组', effect: '获得知识熟练度与额外专业槽位' },
  { name: '脑力强化', effect: '提升一次智力检定效果' },
];

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const classes = JSON.parse(fs.readFileSync(CLASSES_JSON, 'utf8'));
  const cls = classes.find((c) => c.name === '奇械师');
  const raw = JSON.parse(fs.readFileSync(ARTIFICER_JSON, 'utf8'));
  const startingFeatures = STARTING_FEATURE_NAMES.map((name) => {
    const sk = raw.skills.find((s) => s.name === name);
    return { name, desc: sk?.flavor?.slice(0, 80) || sk?.description?.[0]?.slice(0, 80) || '' };
  });

  const artificerClass = {
    meta: {
      layer: 'L1',
      phase: '5-batch3',
      source: '职业页/数据/classes.json + 奇械师.json',
      generatedAt: new Date().toISOString().split('T')[0],
      advisorTier: 'partial',
    },
    id: '奇械师',
    name: '奇械师',
    description: cls?.description || raw.description || '',
    rolePositioning: cls?.['职责定位'] || '科技输出、体系构筑、创造资源',
    keyAttr: cls?.['关键属性'] || '智力',
    armor: cls?.['护甲'] || '轻甲、中甲、盾牌',
    weapons: cls?.['武器'] || '匕首、枪械、简易',
    saves: (cls?.['豁免'] || '智力、意志').split('、'),
    skills: cls?.['技巧'] || '',
    startingFeatures,
    startingChoice: 2,
    specializations: SPECIALIZATIONS,
    combatStyles: ARTIFICER_STYLES.map((name) => ({ name, summary: STYLE_SUMMARIES[name] || '' })),
    advisorPartialNote:
      '奇械师顾问为部分支持：技能索引来自职业页数据，标识系统与进阶目录尚未完整收录；深度 build 与标识消耗请以规则书/DM 为准。',
    timelineNote: '玩家仅能够在曙光年代时间线中游玩奇械师职业。',
  };
  writeJson(path.join(OUT_CHARGEN, 'artificer_class.json'), artificerClass);

  const hints = {
    meta: {
      layer: 'L1',
      phase: '5-batch3',
      targetClass: '奇械师',
      tier: 'partial',
      status: 'minimal',
      note: '风格摘要已填；种族/背景推荐待补充',
    },
    primaryAttr: {
      name: '智力',
      targetAtCreation: 15,
      reason: '奇械师关键属性为智力（创建页 FP 关键属性可能为魅力，以页面 keyAttr 为准）',
    },
    roleSummary: {
      positioning: (cls?.['职责定位'] || '').split('、').filter(Boolean),
      blurb: cls?.description?.slice(0, 200) || '',
    },
    specializationHints: SPECIALIZATIONS.map((s) => ({
      name: s.name,
      buildHint: s.effect,
    })),
    styleHints: ARTIFICER_STYLES.map((name) => ({
      name,
      summary: STYLE_SUMMARIES[name],
      sampleSkills: raw.skills.filter((sk) => sk.style === name).slice(0, 3).map((sk) => sk.name),
    })),
    recommendedRaces: [],
    recommendedBackgrounds: [],
    chargenTips: [
      '创建页专精：奇械构装/万用模组/脑力强化；注意知识/工程学子项与职业八选四不重复。',
      '顾问档位 partial：可问技能名与 L1 创建，勿假设已有标识或完整进阶路线。',
    ],
    advisorPartialNote: artificerClass.advisorPartialNote,
  };
  writeJson(path.join(OUT_CHARGEN, 'hints', '奇械师.json'), hints);

  console.log('artificer_class.json + hints/奇械师.json written');
  console.log(`  styles: ${ARTIFICER_STYLES.length}, starting: ${startingFeatures.length}`);
}

main();
