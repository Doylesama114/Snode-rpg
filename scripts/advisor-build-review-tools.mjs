/**
 * Advisor 5.0 batch15 (7079) — L6 snapshot build review Tools layer.
 */
import {
  parseRoadmapGoal,
  loadBuildKit,
  analyzeSnapshotGeneric,
  isBuildReviewQuery,
  ROADMAP_DISCLAIMER,
  getBuildPhaseBand,
  sampleSkillsForStyle,
} from './advisor-build-roadmap.mjs';
import {
  analyzeSnapshot,
  getMainClass,
} from './advisor-snapshot.mjs';
import { resolveL2LayerForClass } from './advisor-class-l2.mjs';

/**
 * @param {object} store
 * @param {string} className
 */
function getSkillsForClass(store, className) {
  if (className === '法师') return store.mageSkills?.skills || [];
  const layer = resolveL2LayerForClass(className);
  return store.classSkillIndexes?.[layer]?.skills || [];
}

/**
 * @param {object} store
 * @param {string} className
 * @param {string} skillName
 */
function findSkillInClass(store, className, skillName) {
  return getSkillsForClass(store, className).find((s) => s.name === skillName) || null;
}

/**
 * @param {object} snapshot
 * @param {object|null} kit
 * @param {object} goal
 * @param {object} store
 * @param {string[]} learnableTiers
 */
function suggestSkillsFromKit(snapshot, kit, goal, store, learnableTiers) {
  if (!kit) return [];
  const learned = new Set(
    (snapshot.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean),
  );
  const main = getMainClass(snapshot);
  const mainLevel = main.level || 1;
  const phaseKey = mainLevel <= 3 ? 'early' : 'mid';
  const suggestions = [];

  const sides = [
    { key: 'mage', className: goal.mainClass || kit.mainClass || '法师' },
    { key: 'warrior', className: goal.subClass || kit.subClass || null },
  ];

  for (const side of sides) {
    if (!side.className) continue;
    const section = kit[side.key];
    const phase = section?.phases?.[phaseKey];
    if (!phase?.picks) continue;
    for (const [style, names] of Object.entries(phase.picks)) {
      for (const name of names) {
        if (learned.has(name)) continue;
        const sk = findSkillInClass(store, side.className, name);
        if (!sk) continue;
        const tier = sk.tier || '-';
        if (learnableTiers?.length && !learnableTiers.includes(tier)) continue;
        suggestions.push({
          name,
          className: side.className,
          style,
          tier,
          summary: (sk.summary || '').slice(0, 72),
          reason: `${side.className}·${style}线 · kit「${kit.name}」模板`,
        });
      }
    }
  }

  const seen = new Set();
  return suggestions.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  }).slice(0, 8);
}

/**
 * Merge kit picks with L2 catalog; kit entries first, catalog fills gaps (7082 batch18).
 * @param {object[]} fromKit
 * @param {object[]} fromCatalog
 * @param {number} [limit]
 */
function mergeBuildReviewSuggestions(fromKit, fromCatalog, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const s of fromKit) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    out.push(s);
  }
  for (const s of fromCatalog) {
    if (seen.has(s.name) || out.length >= limit) continue;
    seen.add(s.name);
    out.push(s);
  }
  return out.slice(0, limit);
}

/**
 * L2 style sampling when no build kit matches (7080 batch16).
 * @param {object} snapshot
 * @param {object} store
 * @param {string[]} learnableTiers
 */
function suggestSkillsFromCatalog(snapshot, store, learnableTiers) {
  const learned = new Set(
    (snapshot.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean),
  );
  const suggestions = [];

  for (const cls of snapshot.classes || []) {
    if (!cls.name || !cls.level) continue;
    const band = getBuildPhaseBand(cls.level);
    const styles = (cls.styles || []).filter(Boolean);
    const styleList = styles.length
      ? styles
      : [...new Set(getSkillsForClass(store, cls.name).map((s) => s.style).filter(Boolean))].slice(0, 4);

    for (const style of styleList) {
      const samples = sampleSkillsForStyle(store, cls.name, style, band, 6);
      for (const s of samples) {
        if (learned.has(s.name)) continue;
        if (learnableTiers?.length && !learnableTiers.includes(s.tier)) continue;
        suggestions.push({
          name: s.name,
          className: cls.name,
          style: s.style || style,
          tier: s.tier,
          summary: s.summary || '',
          reason: `${cls.name}·${style}线 · L2 抽样（无 kit 模板）`,
        });
      }
    }
  }

  const seen = new Set();
  return suggestions.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  }).slice(0, 8);
}

/**
 * @param {object} snapshot normalized L6
 * @param {{ query?: string, store?: object, goalOverride?: object|null }} [options]
 */
export function outlineBuildReview(snapshot, options = {}) {
  const store = options.store;
  if (!store) throw new Error('outlineBuildReview requires store');
  const query = options.query || '';
  const goal = parseRoadmapGoal(query, snapshot, options.goalOverride || null);
  const l6 = analyzeSnapshot(snapshot, {
    advancementNames: goal.advancementName ? [goal.advancementName] : null,
  });
  const analysis = analyzeSnapshotGeneric(snapshot, goal, store);
  const kit = goal.kitId ? loadBuildKit(goal.kitId) : null;
  const fromKit = suggestSkillsFromKit(snapshot, kit, goal, store, l6.learnableTiers);
  const fromCatalog = suggestSkillsFromCatalog(snapshot, store, l6.learnableTiers);
  const suggestions = fromKit.length
    ? mergeBuildReviewSuggestions(fromKit, fromCatalog)
    : fromCatalog;

  return {
    goal,
    l6,
    analysis,
    kit,
    suggestions,
    learnableTiers: l6.learnableTiers,
  };
}

/**
 * @param {ReturnType<typeof outlineBuildReview>} review
 */
export function formatBuildReviewToolsText(review) {
  const { l6, analysis, goal, kit, suggestions, learnableTiers } = review;
  const snap = l6.snapshot;
  const lines = [
    '### Tools 层 · Build 评价（server-side 事实 · 勿编造未收录技能）',
    `- 角色：**${snap.name || '未命名'}** | ${snap.race || '?'} | 主职 ${snap.mainClass} L${snap.mainLevel}`,
  ];

  if (l6.subclasses?.length) {
    lines.push(`- 子职：${l6.subclasses.map((c) => `${c.name} L${c.level}`).join('、')}`);
  }
  if (l6.profHighlights?.length) {
    lines.push(`- 已有熟练：${l6.profHighlights.join('、')}`);
  }
  lines.push(`- 可学技能位阶：**${(learnableTiers || []).join('、')}**（推荐不得超出）`);
  if (snap.skillNames?.length) {
    lines.push(`- 已学技能：${snap.skillNames.join('、')}`);
  }
  if (goal.advancementName) {
    lines.push(`- 评价目标进阶：**${goal.advancementName}**`);
  }

  lines.push('', '- 进阶达标（属性门槛）：');
  for (const a of l6.advancements.slice(0, 6)) {
    lines.push(`  · ${a.advancementName}：${a.eligible ? '✓' : '✗'}${Object.keys(a.gaps || {}).length ? ` gaps=${JSON.stringify(a.gaps)}` : ''}`);
  }

  lines.push('', '- 快照观察：');
  lines.push(`  · 阶段：${analysis.phaseLabel}`);
  if (analysis.strengths.length) {
    lines.push(`  · 现状：${analysis.strengths.join('；')}`);
  }
  if (analysis.gaps.length) {
    lines.push(`  · 可思考：${analysis.gaps.join('；')}`);
  }
  lines.push(`  · 下一专长窗口：${analysis.nextFeatWindow}`);

  if (kit) {
    lines.push('', `- kit 模板参考：**${kit.name}**（${kit.summary?.slice(0, 60) || ''}）`);
  }

  lines.push('', '- **推荐可学技能（位阶内 · 未学）**：');
  if (suggestions.length) {
    const byClass = new Map();
    for (const s of suggestions) {
      if (!byClass.has(s.className)) byClass.set(s.className, []);
      byClass.get(s.className).push(s);
    }
    if (byClass.size > 1) {
      for (const [className, items] of byClass) {
        lines.push(`  **${className}**：`);
        for (const s of items) {
          lines.push(`    · **${s.name}**（${s.style} · ${s.tier}）— ${s.reason}`);
        }
      }
    } else {
      for (const s of suggestions) {
        lines.push(`  · **${s.name}**（${s.className} · ${s.style} · ${s.tier}）— ${s.reason}`);
      }
    }
  } else {
    lines.push('  · （暂无符合位阶的未学候选，请结合 L2 检索补充）');
  }

  lines.push('- LLM 须先评价现状与进阶衔接，再列 3～4 项可立即学习的技能；勿建议超出位阶的五阶及以上技能；勿把进阶与 L7 兼职混淆。');
  lines.push(`- 免责声明（回答末尾须复述）：${ROADMAP_DISCLAIMER}`);
  return lines.join('\n');
}

/**
 * @param {object} detected
 */
export function buildBuildReviewToolContext(detected) {
  if (!detected?.snapshot || !detected?.store) return null;
  const review = outlineBuildReview(detected.snapshot, {
    query: detected.query || '',
    store: detected.store,
  });
  return {
    intent: 'build_review',
    promptProfile: 'build_review',
    text: formatBuildReviewToolsText(review),
    meta: review,
  };
}

/**
 * @param {string} query
 * @param {object|null} snapshot
 */
export function detectBuildReviewQuestion(query, snapshot = null) {
  if (!isBuildReviewQuery(query, { snapshot })) return null;
  const goal = parseRoadmapGoal(query, snapshot);
  return {
    intent: 'build_review',
    query,
    snapshot,
    advancementName: goal.advancementName,
    kitId: goal.kitId,
  };
}
