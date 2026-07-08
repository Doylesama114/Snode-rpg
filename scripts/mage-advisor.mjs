#!/usr/bin/env node
/**
 * Build Advisor — Phase 6: DeepSeek CLI mage advisor.
 * Run: node scripts/mage-advisor.mjs [--thinking] [--dry-run] [--stream] [--save-log] "问题"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieve, formatContext } from './advisor-retrieve.mjs';
import { buildChatMessages, buildSystemPrompt } from './advisor-prompt.mjs';
import { getAdvisorConfig, ROOT } from './advisor-env.mjs';
import { loadSnapshotFile } from './advisor-snapshot.mjs';
import { fetch, abortAfter } from './advisor-fetch.mjs';
import { planQuery, planFromRules, buildPlanCacheKey } from './advisor-planner.mjs';
import { normalizeConversationHistory, extractGoalOverride, enrichPlannerContext } from './advisor-session.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const flags = {
    thinking: argv.includes('--thinking'),
    dryRun: argv.includes('--dry-run'),
    stream: argv.includes('--stream'),
    saveLog: argv.includes('--save-log'),
    json: argv.includes('--json'),
    snapshot: null,
    mode: null,
    wizardState: null,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--snapshot' && argv[i + 1]) {
      flags.snapshot = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--mode' && argv[i + 1]) {
      flags.mode = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--wizard-state' && argv[i + 1]) {
      flags.wizardState = argv[i + 1];
      i += 1;
    } else if (!argv[i].startsWith('--')) {
      rest.push(argv[i]);
    }
  }
  flags.query = rest.join(' ').trim();
  return flags;
}

async function consumeSSE(res, onDelta) {
  let content = '';
  let buffer = '';

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') return;
    try {
      const chunk = JSON.parse(payload);
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        content += delta;
        if (onDelta) onDelta(delta);
      }
    } catch {
      /* ignore partial json */
    }
  };

  const body = res.body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) handleLine(line);
    }
    if (buffer.trim()) handleLine(buffer);
  } else if (body && typeof body.on === 'function') {
    await new Promise((resolve, reject) => {
      body.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) handleLine(line);
      });
      body.on('end', () => {
        if (buffer.trim()) handleLine(buffer);
        resolve();
      });
      body.on('error', reject);
    });
  } else {
    const text = await res.text();
    for (const line of text.split('\n')) handleLine(line);
  }

  return content;
}

async function callDeepSeek(messages, { thinking, stream, config, onDelta, maxTokens }) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: maxTokens ?? config.maxTokens,
    stream,
  };
  if (thinking) {
    body.thinking = { type: 'enabled' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: abortAfter(120_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 500)}`);
  }

  if (!stream) {
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      raw: data,
    };
  }

  const emit = onDelta || ((delta) => { process.stdout.write(delta); });
  const content = await consumeSSE(res, emit);
  if (stream && !onDelta) process.stdout.write('\n');
  return { content, usage: null, raw: null };
}

function saveLogFile(query, retrieval, messages, response) {
  const dir = path.join(ROOT, 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `advisor-log-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify({
    query,
    intent: retrieval.intent,
    messages,
    response,
  }, null, 2), 'utf8');
  console.error(`\n[log] ${file}`);
}

export async function advise(query, options = {}) {
  const config = getAdvisorConfig();
  const thinking = options.thinking ?? config.thinkingDefault;
  let snapshot = options.snapshot || null;
  if (typeof snapshot === 'string') {
    snapshot = loadSnapshotFile(snapshot);
  }
  let wizardState = options.wizardState || null;
  if (typeof wizardState === 'string') {
    wizardState = JSON.parse(fs.readFileSync(path.resolve(wizardState), 'utf8'));
  }

  const conversationHistory = normalizeConversationHistory(options.conversationHistory);
  const goalOverride = extractGoalOverride(query, conversationHistory);
  const retrievalClassHint = wizardState?.selections?.className
    || options.chargenState?.char?.className
    || snapshot?.classes?.[0]?.name
    || snapshot?.className
    || null;

  const plannerCtx = enrichPlannerContext(query, {
    className: retrievalClassHint,
    mode: options.mode,
    snapshot: snapshot || undefined,
    conversationHistory,
    chargenState: options.chargenState,
    goalOverride,
    planCacheKey: options.sessionId
      ? buildPlanCacheKey(options.sessionId, query, retrievalClassHint || options.bindingKey || 'anon')
      : null,
  });

  const plan = options.skipPlanner
    ? (options.plan || null)
    : (options.dryRun || options.rulesOnlyPlanner)
      ? planFromRules(query, plannerCtx)
      : await planQuery(query, plannerCtx, {
        useLLM: options.usePlannerLLM !== false,
      });

  const retrieval = retrieve(query, {
    snapshot: snapshot || undefined,
    mode: options.mode,
    wizardState: wizardState || undefined,
    chargenState: options.chargenState || undefined,
    plan: plan || undefined,
    goalOverride: plannerCtx.goalOverride || null,
  });
  const context = formatContext(retrieval);
  const messages = buildChatMessages(query, context, {
    intent: retrieval.intent,
    mode: retrieval.mode,
    promptProfile: retrieval.promptProfile,
    answerStyle: retrieval.answerStyle,
    conversationHistory,
    goalOverride: plannerCtx.goalOverride || null,
    unknownAdvancement: retrieval.unknownAdvancement || null,
    hasRoadmapOutline: !!retrieval.results._roadmapOutline,
    className: retrieval.retrievalClass
      || retrieval.wizardState?.selections?.className
      || options.chargenState?.char?.className
      || null,
    tier: retrieval.tier
      || (retrieval.retrievalClass ? undefined : null),
  });

  if (options.dryRun) {
    return {
      query,
      intent: retrieval.intent,
      mode: retrieval.mode,
      promptProfile: retrieval.promptProfile,
      answerStyle: retrieval.answerStyle,
      plan,
      thinking,
      model: config.model,
      messages,
      context,
      answer: null,
    };
  }

  if (!config.apiKey) {
    throw new Error('缺少 DEEPSEEK_API_KEY。请在项目根 .env 中配置，或设置环境变量。');
  }

  const useStream = options.stream ?? false;
  const roadmapTokens = Math.max(config.maxTokens, 6144);
  const result = await callDeepSeek(messages, {
    thinking,
    stream: useStream,
    config,
    maxTokens: retrieval.answerStyle === 'roadmap' ? roadmapTokens : config.maxTokens,
    onDelta: options.onDelta,
  });

  return {
    query,
    intent: retrieval.intent,
    mode: retrieval.mode,
    promptProfile: retrieval.promptProfile,
    answerStyle: retrieval.answerStyle,
    plan,
    thinking,
    model: config.model,
    messages,
    context,
    answer: result.content,
    usage: result.usage,
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const query = flags.query;
  if (!query) {
    console.error(`Usage: node scripts/mage-advisor.mjs [options] "你的问题"

Options:
  --snapshot <file>  角色快照 JSON（panel 存档或 advisor/snapshots mock）
  --mode <advisor|wizard|entity_qa>  交互模式（默认 advisor）
  --wizard-state <file>  车卡向导状态 JSON（与 --mode wizard 联用）
  --thinking   开启 DeepSeek thinking 模式（默认关）
  --dry-run    只输出 prompt/context，不调用 API
  --stream     流式输出（默认非流式）
  --save-log   保存 prompt 与回答到 tmp/advisor-log-*.json
  --json       JSON 输出（含 answer）`);
    process.exit(1);
  }

  try {
    const out = await advise(flags.query, {
      thinking: flags.thinking,
      dryRun: flags.dryRun,
      stream: flags.stream,
      snapshot: flags.snapshot,
      mode: flags.mode,
      wizardState: flags.wizardState,
    });

    if (flags.dryRun) {
      if (flags.json) {
        console.log(JSON.stringify({
          query: out.query,
          intent: out.intent,
          model: out.model,
          thinking: out.thinking,
          systemPrompt: out.messages[0].content,
          userMessage: out.messages[1].content,
        }, null, 2));
      } else {
        console.log('=== DRY RUN ===');
        console.log(`intent: ${out.intent} | model: ${out.model} | thinking: ${out.thinking} | snapshot: ${!!flags.snapshot}`);
        console.log('\n--- system (前 800 字) ---\n');
        console.log(out.messages[0].content.slice(0, 800));
        console.log('\n--- user ---\n');
        console.log(out.messages[1].content);
      }
      return;
    }

    if (flags.saveLog) saveLogFile(query, retrieve(query, { snapshot: flags.snapshot ? loadSnapshotFile(flags.snapshot) : undefined }), out.messages, out.answer);

    if (!flags.stream && !flags.json) {
      console.log(out.answer);
    } else if (flags.json) {
      console.log(JSON.stringify({
        query: out.query,
        intent: out.intent,
        model: out.model,
        thinking: out.thinking,
        answer: out.answer,
        usage: out.usage,
      }, null, 2));
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
