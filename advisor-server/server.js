/**
 * 斯诺德跑团 — AI 助理远程服务（阿里云 FC Web 函数入口）
 *
 * 复用 scripts/mage-advisor.mjs 的完整顾问管线，对外提供：
 *   GET  /api/health        健康检查
 *   POST /api/advise        顾问问答（Accept: text/event-stream 时 SSE 流式返回）
 */
import http from 'http';
import { advise } from './scripts/mage-advisor.mjs';

const PORT = Number(process.env.ADVISOR_PORT || process.env.PORT || 9000);
const MAX_BODY_BYTES = 128 * 1024;
const MAX_QUERY_LEN = 4000;
const MAX_HISTORY = 40;

const RATE = {
  perMin: Number(process.env.ADVISOR_RATE_PER_MIN || 30),
  perHour: Number(process.env.ADVISOR_RATE_PER_HOUR || 800),
};

// 简单的进程内限流（FC 按实例生效，主要防止单实例被打爆）
const hits = new Map();
function rateCheck(ip) {
  const now = Date.now();
  let arr = hits.get(ip);
  if (!arr) {
    arr = [];
    hits.set(ip, arr);
  }
  while (arr.length && arr[0] <= now - 3600_000) arr.shift();
  const lastMin = arr.filter((t) => t > now - 60_000).length;
  if (lastMin >= RATE.perMin || arr.length >= RATE.perHour) return false;
  arr.push(now);
  if (hits.size > 10000) {
    for (const [k, v] of hits) if (!v.length) hits.delete(k);
  }
  return true;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('请求体过大'), { status: 413 }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function parsePayload(text) {
  let obj;
  try {
    obj = JSON.parse(text || '{}');
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON'), { status: 400 });
  }
  const query = String(obj.query || '').trim();
  if (!query) throw Object.assign(new Error('缺少 query 字段'), { status: 400 });
  if (query.length > MAX_QUERY_LEN) {
    throw Object.assign(new Error('问题过长，请精简后重试'), { status: 400 });
  }

  const history = Array.isArray(obj.conversationHistory)
    ? obj.conversationHistory.slice(0, MAX_HISTORY)
    : [];
  for (const h of history) {
    if (
      !h ||
      (h.role !== 'user' && h.role !== 'assistant') ||
      typeof h.content !== 'string' ||
      h.content.length > MAX_QUERY_LEN
    ) {
      throw Object.assign(new Error('conversationHistory 格式不正确'), { status: 400 });
    }
  }

  const passKeys = [
    'mode',
    'thinking',
    'snapshot',
    'chargenState',
    'wizardState',
    'plan',
    'dryRun',
    'usePlannerLLM',
    'rulesOnlyPlanner',
    'skipPlanner',
    'sessionId',
    'bindingKey',
  ];
  const opts = {};
  for (const k of passKeys) {
    if (obj[k] !== undefined) opts[k] = obj[k];
  }
  return { query, history, opts };
}

function makeSSE(res) {
  let closed = false;
  res.on('error', () => { closed = true; });
  res.on('close', () => { closed = true; });
  return (type, data) => {
    if (closed || res.writableEnded) return;
    try {
      res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      closed = true;
    }
  };
}

async function handleAdvise(req, res) {
  const ip = String(req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  if (!rateCheck(ip)) {
    sendJson(res, 429, { error: '请求过于频繁，请稍后再试' });
    return;
  }

  const text = await readBody(req);
  const { query, history, opts } = parsePayload(text);
  const wantStream =
    String(req.headers.accept || '').includes('text/event-stream') ||
    opts.stream === true;

  if (wantStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    const sse = makeSSE(res);
    sse('start', { query });
    try {
      const result = await advise(query, {
        ...opts,
        conversationHistory: history,
        stream: true,
        onDelta: (delta) => sse('delta', { delta }),
      });
      sse('done', {
        answer: result.answer || '',
        intent: result.intent || '',
        mode: result.mode || '',
        promptProfile: result.promptProfile || '',
        answerStyle: result.answerStyle || '',
        clarify: result.clarify || null,
        skippedByClarify: !!result.skippedByClarify,
        usage: result.usage || null,
      });
    } catch (err) {
      sse('error', { message: err.message || String(err) });
    } finally {
      try { res.end(); } catch { /* ignore */ }
    }
    return;
  }

  try {
    const result = await advise(query, {
      ...opts,
      conversationHistory: history,
      stream: false,
    });
    sendJson(res, 200, {
      ok: true,
      answer: result.answer || '',
      intent: result.intent || '',
      mode: result.mode || '',
      promptProfile: result.promptProfile || '',
      answerStyle: result.answerStyle || '',
      clarify: result.clarify || null,
      skippedByClarify: !!result.skippedByClarify,
      usage: result.usage || null,
      error: null,
    });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err.message || String(err) });
  }
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendJson(res, 400, { error: 'invalid url' });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/api/health' || url.pathname === '/health') {
    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'snode-advisor',
        time: new Date().toISOString(),
      });
      return;
    }
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  if (url.pathname === '/api/advise' && req.method === 'POST') {
    try {
      await handleAdvise(req, res);
    } catch (err) {
      sendJson(res, err.status || 400, { error: err.message || String(err) });
    }
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[snode-advisor] listening on ${PORT}`);
});
