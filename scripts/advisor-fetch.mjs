/**
 * Minimal fetch for Node 16 (Electron 22 main process) and modern Node CLI.
 * Uses built-in http/https only — no extra deps in packaged app.
 */
import http from 'http';
import https from 'https';
import { Readable } from 'stream';

function requestOnce(url, options = {}) {
  const parsed = new URL(url);
  const lib = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers,
      },
      (res) => {
        const body = Readable.from(res);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          body,
          text: () => readAll(body).then((buf) => buf.toString('utf8')),
          json: () => readAll(body).then((buf) => JSON.parse(buf.toString('utf8'))),
        });
      },
    );

    req.on('error', reject);

    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy();
        reject(options.signal.reason || new Error('Aborted'));
        return;
      }
      options.signal.addEventListener(
        'abort',
        () => {
          req.destroy(options.signal.reason || new Error('Aborted'));
        },
        { once: true },
      );
    }

    if (options.body) req.write(options.body);
    req.end();
  });
}

function readAll(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function abortAfter(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${ms}ms`)), ms);
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
    },
  };
}

export const fetch = typeof globalThis.fetch === 'function'
  ? globalThis.fetch.bind(globalThis)
  : requestOnce;
