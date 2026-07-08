/**
 * Advisor 5.0 batch11 (7075) — shared feedback → golden helpers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieve, formatContext } from './advisor-retrieve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const GOLDEN_PATH = path.join(ROOT, 'advisor', 'golden', 'conversations.json');
export const FEEDBACK_DIR = path.join(ROOT, 'advisor', 'feedback');
export const PENDING_DIR = path.join(FEEDBACK_DIR, 'pending');
export const INBOX_DIR = path.join(FEEDBACK_DIR, 'inbox');
export const PROCESSED_DIR = path.join(FEEDBACK_DIR, 'processed');

const INTENT_HINTS = {
  starting_gear_lookup: ['起始装备', '套装'],
  race_detail: ['种族', '特性'],
  background_detail: ['背景', '可侍奉神祇'],
  background_chargen: ['背景车卡', '金币'],
  proficiency_lookup: ['熟练项职业对照'],
  combat_math: ['战斗命中演算', '护甲值演算', '伤害 flat 加值'],
  skill_detail: ['技能详情'],
  equipment_lookup: ['装备/物品详情'],
  point_buy_optimize: ['购点优化'],
  leveling_summary: ['等级区间累计奖励'],
};

/**
 * @param {string} desc
 */
export function parseQueryFromDescription(desc) {
  const text = String(desc || '');
  const qm = text.match(/问句[:：]\s*(.+)/);
  if (qm) return qm[1].split('\n')[0].trim();
  const expect = text.match(/期望[:：]\s*(.+)/);
  if (expect) return expect[0].slice(0, 80);
  return text.split('\n')[0].trim().slice(0, 120);
}

/**
 * @param {string} desc
 */
export function parseMustIncludeFromDescription(desc) {
  const text = String(desc || '');
  const m = text.match(/必含[:：]\s*(.+)/);
  if (!m) return [];
  return m[1].split(/[,，、|]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * @param {string} desc
 */
export function parseExpectIntentFromDescription(desc) {
  const m = String(desc || '').match(/意图[:：]\s*([a-z_]+)/i);
  return m ? m[1].trim() : null;
}

/**
 * @param {string} query
 * @param {string} ctx
 * @param {string} intent
 */
export function inferMustInclude(query, ctx, intent) {
  const must = [];
  if (ctx.includes('Tools 层')) must.push('Tools 层');
  for (const hint of INTENT_HINTS[intent] || []) {
    if (ctx.includes(hint)) must.push(hint);
  }
  const q = String(query || '');
  for (const token of ['牧师', '法师', '血族', '侍僧', '皮甲', '宗教', '沉默']) {
    if (q.includes(token) && ctx.includes(token) && !must.includes(token)) must.push(token);
  }
  if (!must.length) must.push('Tools 层');
  return [...new Set(must)];
}

/**
 * @param {object} raw
 * @param {{ snapshot?: object|null }} [opts]
 */
export function normalizeFeedbackPayload(raw, opts = {}) {
  const query = String(raw.query || parseQueryFromDescription(raw.description || '')).trim();
  if (!query) throw new Error('missing query');
  const retrieveOpts = {};
  if (opts.snapshot) retrieveOpts.snapshot = opts.snapshot;
  else if (raw.snapshot) retrieveOpts.snapshot = raw.snapshot;
  const r = retrieve(query, retrieveOpts);
  const ctx = formatContext(r);
  const expectIntent = raw.expectIntent || parseExpectIntentFromDescription(raw.description || '') || r.intent;
  const mustInclude = (raw.mustInclude?.length
    ? raw.mustInclude
    : [...parseMustIncludeFromDescription(raw.description || ''), ...inferMustInclude(query, ctx, expectIntent)]
  ).filter(Boolean);
  const uniqueMust = [...new Set(mustInclude)];
  return {
    id: raw.id || undefined,
    query,
    expectIntent,
    mustInclude: uniqueMust,
    mustNotInclude: raw.mustNotInclude || ['当前资料未收录此项'],
    snapshotFile: raw.snapshotFile || null,
    tags: raw.tags || ['user-feedback', '7075-export'],
    source: raw.source || 'advisor-feedback-export.mjs',
    description: raw.description || '',
    page: raw.page || '',
    savedAt: raw.savedAt || new Date().toISOString(),
  };
}

/**
 * Sync version without dynamic import for snapshot
 * @param {object} raw
 * @param {{ snapshot?: object|null }} [opts]
 */
export function normalizeFeedbackPayloadSync(raw, opts = {}) {
  const query = String(raw.query || parseQueryFromDescription(raw.description || '')).trim();
  if (!query) throw new Error('missing query');
  const retrieveOpts = {};
  if (opts.snapshot) retrieveOpts.snapshot = opts.snapshot;
  const r = retrieve(query, retrieveOpts);
  const ctx = formatContext(r);
  const expectIntent = raw.expectIntent || parseExpectIntentFromDescription(raw.description || '') || r.intent;
  let mustInclude = raw.mustInclude?.length
    ? [...raw.mustInclude]
    : [...parseMustIncludeFromDescription(raw.description || ''), ...inferMustInclude(query, ctx, expectIntent)];
  mustInclude = [...new Set(mustInclude.filter(Boolean))];
  return {
    id: raw.id,
    query,
    expectIntent,
    mustInclude,
    mustNotInclude: raw.mustNotInclude || ['当前资料未收录此项'],
    snapshotFile: raw.snapshotFile || null,
    tags: raw.tags || ['user-feedback', '7075-export'],
    source: raw.source || 'advisor-feedback-export.mjs',
    description: raw.description || '',
    page: raw.page || '',
    savedAt: raw.savedAt || new Date().toISOString(),
  };
}

/**
 * @param {object} raw
 * @param {{ snapshot?: object|null }} [opts]
 */
export function validateFeedbackCase(raw, opts = {}) {
  const norm = normalizeFeedbackPayloadSync(raw, opts);
  const retrieveOpts = opts.snapshot ? { snapshot: opts.snapshot } : {};
  const r = retrieve(norm.query, retrieveOpts);
  const ctx = formatContext(r);
  const missing = norm.mustInclude.filter((t) => !ctx.includes(t));
  if (norm.expectIntent && r.intent !== norm.expectIntent) {
    return { ok: false, reason: `intent ${r.intent} != ${norm.expectIntent}`, norm, ctx };
  }
  if (missing.length) return { ok: false, reason: `missing: ${missing.join(', ')}`, norm, ctx };
  return { ok: true, intent: r.intent, norm, ctx };
}

export function slugPendingFilename(query) {
  const base = String(query || 'feedback').slice(0, 28).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '-');
  return `${base}-${Date.now().toString(36)}.json`;
}

export function ensureFeedbackDirs() {
  for (const d of [FEEDBACK_DIR, PENDING_DIR, INBOX_DIR, PROCESSED_DIR, path.join(FEEDBACK_DIR, 'templates')]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
