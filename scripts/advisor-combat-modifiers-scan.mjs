/**
 * Advisor 5.0 batch19 (7083) — L2 combat modifier candidate scanner (Tier A–D).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MOD_PATH = path.join(__dirname, '..', 'advisor', 'rules', 'combat_skill_modifiers.json');
export const DEFAULT_SKILLS_DIR = path.join(__dirname, '..', 'advisor', 'skills');
export const DEFAULT_REPORT_PATH = path.join(__dirname, '..', 'advisor', 'reports', 'combat-modifiers-scan.json');

const HIT_FLAT_RES = [
  /攻击命中检定值\+(\d+)/g,
  /命中检定值\+(\d+)/g,
  /法术命中值\+(\d+)/g,
  /法术命中检定值\+(\d+)/g,
];

const AC_FLAT_RES = [
  /(?:自身|目标|你)?的?防御等级\+(\d+)/g,
  /防御等级\+(\d+)/g,
];

const MILESTONE_HIT_RE = /L(\d+):\s*[^L]*?(?:攻击)?命中检定值\+(\d+)/g;
const MILESTONE_AC_RE = /L(\d+):\s*[^L]*?防御等级\+(\d+)/g;

const CONDITIONAL_HIT_RE = /如果[^·]+?(?:改为|那么改为)?(?:攻击)?命中检定值\+(\d+)/g;
const CONDITIONAL_AC_RE = /(?:如果|处于|当)[^·]+?(?:视为|防御等级\+(\d+)|的防御等级\+(\d+))/g;

const TIER_C_MARKERS = [
  /具有优势/,
  /具有劣势/,
  /攻击命中检定、造成的伤害值.*优势/,
  /X为/,
  /X为你的/,
  /你的(?:宗教|魅力|感知|智力|力量|敏捷)调整值/,
  /调整值\)/,
  /野兽伙伴/,
  /召唤/,
  /给他人/,
  /对一名(?:其他|自愿)/,
  /目标获得/,
  /持有者/,
];

const TIER_D_MARKERS = [
  /目标的防御等级-/,
  /目标.*防御等级-\d+/,
  /目标的攻击命中检定具有劣势/,
  /失去\d+点防御等级/,
];

const TIER_B_MARKERS = [
  /如果.+?(?:改为|那么).+?(?:命中检定值|防御等级)/,
  /处于.+?状态.+?(?:改为|那么).+?(?:命中|防御等级)/,
  /目标(?:与你的)?阵营/,
  /阵营倾向相反/,
  /额外花费(?:一个)?(?:主要|附赠|反应)动作.+?(?:命中|防御等级)/,
];

function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

/**
 * @param {string} summary
 */
export function extractHitSignals(summary) {
  const text = String(summary || '');
  const flats = [];
  const milestones = [];
  const conditionals = [];

  for (const re of HIT_FLAT_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      flats.push({ value: Number(m[1]), snippet: m[0] });
    }
  }

  MILESTONE_HIT_RE.lastIndex = 0;
  let mm;
  while ((mm = MILESTONE_HIT_RE.exec(text)) !== null) {
    milestones.push({ level: Number(mm[1]), value: Number(mm[2]), snippet: mm[0].slice(0, 48) });
  }

  CONDITIONAL_HIT_RE.lastIndex = 0;
  let cm;
  while ((cm = CONDITIONAL_HIT_RE.exec(text)) !== null) {
    conditionals.push({ value: Number(cm[1]), snippet: cm[0].slice(0, 56) });
  }

  return { flats, milestones, conditionals };
}

/**
 * @param {string} summary
 */
export function extractAcSignals(summary) {
  const text = String(summary || '');
  const flats = [];
  const milestones = [];
  const conditionals = [];

  for (const re of AC_FLAT_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const val = Number(m[1]);
      if (Number.isNaN(val)) continue;
      flats.push({ value: val, snippet: m[0] });
    }
  }

  MILESTONE_AC_RE.lastIndex = 0;
  let mm;
  while ((mm = MILESTONE_AC_RE.exec(text)) !== null) {
    milestones.push({ level: Number(mm[1]), value: Number(mm[2]), snippet: mm[0].slice(0, 48) });
  }

  CONDITIONAL_AC_RE.lastIndex = 0;
  let cm;
  while ((cm = CONDITIONAL_AC_RE.exec(text)) !== null) {
    const val = Number(cm[1] || cm[2]);
    if (!Number.isNaN(val)) conditionals.push({ value: val, snippet: cm[0].slice(0, 56) });
  }

  return { flats, milestones, conditionals };
}

/**
 * @param {string} summary
 * @param {{ hit: ReturnType<typeof extractHitSignals>, ac: ReturnType<typeof extractAcSignals> }} signals
 */
export function classifyModifierTier(summary, signals) {
  const text = String(summary || '');
  if (TIER_D_MARKERS.some((re) => re.test(text))) return 'D';

  const hasModSignal = signals.hit.flats.length + signals.ac.flats.length
    + signals.hit.milestones.length + signals.ac.milestones.length > 0;
  const isVariable = /X为|X为你的|你的(?:宗教|魅力|感知|智力|力量|敏捷)调整值/.test(text);
  const isAdvantageOnly = /优势|劣势/.test(text) && !hasModSignal;

  if (isVariable && hasModSignal) return 'C';
  if (isAdvantageOnly || (!hasModSignal && TIER_C_MARKERS.some((re) => re.test(text)))) return 'C';

  const hasConditional = signals.hit.conditionals.length > 0
    || signals.ac.conditionals.length > 0
    || TIER_B_MARKERS.some((re) => re.test(text));
  if (hasConditional) return 'B';
  if (hasModSignal) return 'A';
  return null;
}

/**
 * @param {object} sk skill row from index
 * @param {string} indexFile
 */
export function analyzeSkillCandidate(sk, indexFile) {
  const summary = sk.summary || '';
  const hit = extractHitSignals(summary);
  const ac = extractAcSignals(summary);
  const tier = classifyModifierTier(summary, { hit, ac });
  if (!tier) return null;

  const kind = hit.flats.length || hit.milestones.length || hit.conditionals.length
    ? (ac.flats.length || ac.milestones.length || ac.conditionals.length ? 'both' : 'hit')
    : 'ac';

  return {
    id: `${sk.name}|${sk.class || sk.className || indexFile}`,
    name: sk.name,
    className: sk.class || sk.className || indexFile.replace('_index.json', ''),
    tier,
    kind,
    indexFile,
    tierLabel: sk.tier || '-',
    style: sk.style || '',
    hit,
    ac,
    summarySnippet: summary.slice(0, 120),
  };
}

/**
 * @param {{ modPath?: string, skillsDir?: string }} [options]
 */
export function scanCombatModifierCandidates(options = {}) {
  const modPath = options.modPath || DEFAULT_MOD_PATH;
  const skillsDir = options.skillsDir || DEFAULT_SKILLS_DIR;
  const structured = loadJson(modPath).skills || {};
  const structuredNames = new Set(Object.keys(structured));

  const byTier = { A: [], B: [], C: [], D: [] };
  const duplicateNames = new Map();
  const allCandidates = [];

  for (const f of fs.readdirSync(skillsDir)) {
    if (!f.endsWith('_index.json')) continue;
    const idx = loadJson(path.join(skillsDir, f));
    for (const sk of idx.skills || []) {
      if (!sk.name) continue;
      duplicateNames.set(sk.name, (duplicateNames.get(sk.name) || 0) + 1);
      const row = analyzeSkillCandidate(sk, f);
      if (!row) continue;
      row.structured = structuredNames.has(sk.name);
      allCandidates.push(row);
      if (!row.structured) byTier[row.tier].push(row);
    }
  }

  const dupList = [...duplicateNames.entries()].filter(([, n]) => n > 1).map(([name, count]) => ({ name, count }));

  return {
    meta: {
      version: '2.0.0',
      generatedAt: new Date().toISOString().slice(0, 10),
      structuredCount: structuredNames.size,
      candidateCount: allCandidates.length,
      pendingCount: allCandidates.filter((r) => !r.structured).length,
      duplicateSkillNames: dupList.length,
    },
    stats: {
      structured: structuredNames.size,
      pendingByTier: {
        A: byTier.A.length,
        B: byTier.B.length,
        C: byTier.C.length,
        D: byTier.D.length,
      },
      pendingTotal: byTier.A.length + byTier.B.length + byTier.C.length + byTier.D.length,
    },
    duplicateNames: dupList,
    tiers: byTier,
    allCandidates,
  };
}

/**
 * @param {ReturnType<typeof scanCombatModifierCandidates>} report
 * @param {string} [outPath]
 */
export function writeCombatModifierScanReport(report, outPath = DEFAULT_REPORT_PATH) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outPath;
}
