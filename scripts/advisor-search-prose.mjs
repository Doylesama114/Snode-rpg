/**
 * 规则语料检索（BM25，零依赖）。
 * 语料：advisor/rules/chunks.jsonl（由 scripts/build_advisor_rules_from_help.py 生成）
 * 中文按字符二元组切分，英文/数字按词切分；标题命中加权；章节词命中优先（可兜底）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHUNK_PATH = path.resolve(__dirname, '..', 'advisor', 'rules', 'chunks.jsonl');

const STOP_BIGRAMS = new Set(['可以', '什么', '怎么', '如何', '哪些', '是什', '么是', '一下', '需要', '应该', '多少', '为什么', '是不', '不是', '有哪', '么做', '怎样', '是否']);

const SHEET_WORDS = {
  '基本规则': ['基本规则', '金科玉律', '共识'],
  '检定规则': ['检定', '掷骰', '熟练项'],
  '战斗规则': ['战斗', '轮次', '先攻'],
  '冒险规则': ['冒险', '模组'],
  '升级规则': ['升级', '经验值', '技能槽'],
  '兼职规则': ['兼职'],
  '幕间规则': ['幕间'],
  '异常状态规则': ['异常状态', '状态效果'],
  '关键词规则': ['关键词'],
  '名望等级和声望规则': ['名望', '声望'],
  '技能点和色彩标识规则': ['色彩标识', '色彩骰', '技能点'],
};

let _index = null;

function tokenize(text) {
  const s = String(text || '').toLowerCase();
  const tokens = [];
  tokens.push(...(s.match(/[a-z0-9_]+/g) || []));
  const cjk = s.replace(/[^\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean);
  for (const seg of cjk) {
    if (seg.length === 1) tokens.push(seg);
    for (let i = 0; i < seg.length - 1; i += 1) tokens.push(seg.slice(i, i + 2));
  }
  return tokens;
}

function loadIndex() {
  if (_index) return _index;
  const chunks = [];
  if (fs.existsSync(CHUNK_PATH)) {
    for (const line of fs.readFileSync(CHUNK_PATH, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { chunks.push(JSON.parse(t)); } catch (e) { /* 跳过坏行 */ }
    }
  }
  const df = new Map();
  const docs = [];
  let totalLen = 0;
  for (const c of chunks) {
    const text = (c.title || '') + ' ' + (c.body || '');
    const toks = tokenize(text);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    totalLen += toks.length;
    docs.push({ chunk: c, tf, len: toks.length, titleSet: new Set(tokenize(c.title || '')) });
  }
  _index = { docs, df, avgdl: docs.length ? totalLen / docs.length : 0, n: docs.length };
  return _index;
}

function sheetFilter(query) {
  const q = String(query || '');
  const hit = [];
  for (const [sheet, words] of Object.entries(SHEET_WORDS)) {
    if (words.some((w) => q.includes(w))) hit.push(sheet);
  }
  return hit;
}

export function searchProse(query, options = {}) {
  const idx = loadIndex();
  if (!idx.n) return [];
  const qToks = Array.from(new Set(tokenize(query))).filter((t) => !STOP_BIGRAMS.has(t));
  if (!qToks.length) return [];
  const k1 = 1.2;
  const b = 0.75;

  function runPool(list) {
    const out = [];
    for (const d of list) {
      let score = 0;
      for (const t of qToks) {
        const f = d.tf.get(t) || 0;
        if (!f) continue;
        const n = idx.df.get(t) || 0;
        const idf = Math.log(1 + (idx.n - n + 0.5) / (n + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / idx.avgdl))));
        if (d.titleSet.has(t)) score += idf * 2.2;
      }
      if (score > 0) {
        const hit = qToks.filter((t) => d.tf.has(t)).length / qToks.length;
        out.push({ score: score * (0.5 + 0.5 * hit), chunk: d.chunk });
      }
    }
    return out;
  }

  const sheets = sheetFilter(query);
  // 章节命中做加权而不是硬过滤：跨章问法（「战斗里能喝几瓶药剂」）仍能召回到其他章节
  const scored = runPool(idx.docs);
  if (sheets.length) {
    for (const s of scored) {
      if (sheets.includes(s.chunk.sheet)) s.score *= 1.35;
    }
  }

  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, options.limit || 5).map((s) => ({
    id: s.chunk.id,
    title: s.chunk.title,
    sheet: s.chunk.sheet,
    anchor: s.chunk.anchor,
    body: s.chunk.body,
    score: Number(s.score.toFixed(3)),
  }));
}

export function formatProseContext(hits) {
  if (!hits || !hits.length) return '';
  const lines = ['【规则原文】（可直接引用，末尾标注锚点）'];
  hits.forEach((h, i) => {
    lines.push('');
    lines.push('[R' + (i + 1) + '] ' + h.sheet + ' · ' + h.title + ' （' + h.anchor + '）');
    lines.push(String(h.body || '').slice(0, 1200));
  });
  return lines.join('\n');
}

export function hasCorpus() {
  return fs.existsSync(CHUNK_PATH);
}

export function resetProseIndex() {
  _index = null;
}
