#!/usr/bin/env node
/**
 * Advisor 评测员：LLM-as-judge 对照期望要点核对回答。
 * 用法:
 *   node scripts/advisor-judge.mjs --query "问题" --points "要点1;要点2" --answer "回答文本"
 *   （或作为模块 import judgeAnswer）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetch, abortAfter } from './advisor-fetch.mjs';
import { getAdvisorConfig, ROOT } from './advisor-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JUDGE_SYSTEM = `你是「斯诺德跑团」AI 助理的评测员。你的任务：对照【期望要点】逐条核对【待评回答】，只判断回答是否覆盖/符合该要点的事实，不做风格评价。
输出必须是一个 JSON 对象，格式：
{"scores":[{"point":"期望要点原文","pass":0或1,"evidence":"回答原文片段"}],"total":1到5的整数,"reason":"一句话理由"}
硬性规则：
1. 表述不同但事实等价 → pass=1（例如"AC 由三部分组成"与"护甲基础+敏捷+盾牌"等价）。
2. 回答未提及该要点 → pass=0。
3. pass=1 时 evidence 必须截取回答原文片段（不得为空、不得自行改写）。
4. 回答中与要点冲突的事实（如公式或数值错误）→ pass=0，并在 reason 中说明。
5. 只输出 JSON，不要输出任何其他文字。`;

async function callJudge({ query, points, answer }) {
  const config = getAdvisorConfig();
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const user = `【期望要点】
${points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

【待评回答】
${answer}

【用户问题】
${query}`;
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    stream: false,
    thinking: { type: 'disabled' },
  };
  const timeout = abortAfter(60_000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });
  } finally {
    timeout.cleanup();
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Judge API ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const parsed = JSON.parse(text);
  return parsed;
}

export async function judgeAnswer({ query, points, answer }) {
  const attempts = [0, 1];
  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const parsed = await callJudge({ query, points, answer });
      const scores = Array.isArray(parsed.scores) ? parsed.scores : [];
      if (!scores.length) throw new Error('scores 为空');
      const cleaned = scores
        .filter((s) => s && typeof s.point === 'string')
        .map((s) => ({
          point: s.point,
          pass: s.pass === 1 || s.pass === true ? 1 : 0,
          evidence: typeof s.evidence === 'string' ? s.evidence.slice(0, 200) : '',
        }));
      // pass=1 但无 evidence 视为不通过（防幻觉）
      for (const c of cleaned) {
        if (c.pass === 1 && !c.evidence.trim()) c.pass = 0;
      }
      return {
        ok: true,
        query,
        scores: cleaned,
        total: Number(parsed.total) >= 1 && Number(parsed.total) <= 5 ? Number(parsed.total) : null,
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '',
        attempt,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, query, error: lastErr ? lastErr.message : 'judge 调用失败', scores: [], total: null, reason: '' };
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--query' && argv[i + 1]) { flags.query = argv[i + 1]; i += 1; }
    else if (argv[i] === '--answer' && argv[i + 1]) { flags.answer = argv[i + 1]; i += 1; }
    else if (argv[i] === '--points' && argv[i + 1]) { flags.points = argv[i + 1].split(';').map((x) => x.trim()).filter(Boolean); i += 1; }
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.query || !flags.answer || !flags.points?.length) {
    console.error('用法: node scripts/advisor-judge.mjs --query "问题" --points "要点1;要点2" --answer "回答"');
    process.exit(1);
  }
  const out = await judgeAnswer(flags);
  console.log(JSON.stringify(out, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
