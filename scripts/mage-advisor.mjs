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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const flags = {
    thinking: argv.includes('--thinking'),
    dryRun: argv.includes('--dry-run'),
    stream: argv.includes('--stream'),
    saveLog: argv.includes('--save-log'),
    json: argv.includes('--json'),
    snapshot: null,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--snapshot' && argv[i + 1]) {
      flags.snapshot = argv[i + 1];
      i += 1;
    } else if (!argv[i].startsWith('--')) {
      rest.push(argv[i]);
    }
  }
  flags.query = rest.join(' ').trim();
  return flags;
}

async function callDeepSeek(messages, { thinking, stream, config }) {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
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

  let content = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const chunk = JSON.parse(payload);
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          content += delta;
          process.stdout.write(delta);
        }
      } catch {
        /* ignore partial json */
      }
    }
  }
  if (stream) process.stdout.write('\n');
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
  const retrieval = retrieve(query, { snapshot: snapshot || undefined });
  const context = formatContext(retrieval);
  const messages = buildChatMessages(query, context);

  if (options.dryRun) {
    return {
      query,
      intent: retrieval.intent,
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

  const result = await callDeepSeek(messages, {
    thinking,
    stream: options.stream ?? false,
    config,
  });

  return {
    query,
    intent: retrieval.intent,
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
