'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

// Logs deliberately accept metadata, never character snapshots or IPC payloads.
function route(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return decodeURIComponent(u.pathname).split('/').slice(-2).join('/');
    return u.protocol + '//' + u.host + '/[redacted]';
  } catch (_) { return '[unavailable]'; }
}
function createDiagnostics(app, options = {}) {
  const maxBytes = options.maxBytes || 5 * 1024 * 1024;
  const copies = options.copies || 5;
  let directory, degraded = false;
  for (const candidate of [path.join(app.getPath('userData'), 'diagnostics'), path.join(os.tmpdir(), 'snode-diagnostics-' + process.pid)]) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      fs.appendFileSync(path.join(candidate, 'desktop.log'), '');
      directory = candidate;
      break;
    } catch (_) { degraded = true; }
  }
  const allowed = new Set(['stage', 'ms', 'windowId', 'role', 'url', 'code', 'reason', 'exitCode', 'type', 'pid', 'mb', 'freeMB', 'windows', 'version', 'electron', 'chrome', 'node', 'os', 'arch', 'mode', 'seq', 'count', 'name', 'status', 'site', 'vendor', 'device', 'driver']);
  function log(event, details = {}) {
    const meta = {};
    for (const [key, value] of Object.entries(details)) {
      if (!allowed.has(key) || !['number', 'boolean', 'string'].includes(typeof value)) continue;
      meta[key] = key === 'url' ? route(value) : String(value).slice(0, 200);
    }
    const line = JSON.stringify({ at: new Date().toISOString(), event, ...meta }) + '\n';
    try {
      if (!directory) throw new Error('no log directory');
      const file = path.join(directory, 'desktop.log');
      if (fs.statSync(file).size + Buffer.byteLength(line) > maxBytes) {
        for (let i = copies - 1; i >= 1; i--) {
          const old = file + '.' + i;
          if (fs.existsSync(old)) {
            if (i === copies - 1) fs.unlinkSync(old);
            else fs.renameSync(old, file + '.' + (i + 1));
          }
        }
        fs.renameSync(file, file + '.1');
        fs.writeFileSync(file, '');
      }
      fs.appendFileSync(file, line, { mode: 0o600 });
    } catch (_) {
      degraded = true;
      console.error('[desktop diagnostics]', line.trim());
    }
  }
  function error(event, err, details) {
    // Do not copy error.message/stack: advisor errors can contain prompts or secrets.
    const sites = String(err && err.stack || '').split('\n').slice(1).map(line => {
      const match = line.match(/(?:\(|\s)([^()]+):(\d+):(\d+)\)?$/);
      return match ? path.basename(match[1].trim()) + ':' + match[2] + ':' + match[3] : '';
    }).filter(Boolean).slice(0, 4).join(',');
    log(event, { ...details, code: err && err.code || 'ERROR', name: err && err.name || 'Error', site: sites });
  }
  function exportTo(file) {
    if (!directory) throw new Error('诊断目录不可用');
    const logs = [];
    for (let i = copies - 1; i >= 0; i--) {
      const p = path.join(directory, 'desktop.log' + (i ? '.' + i : ''));
      if (fs.existsSync(p)) logs.push(fs.readFileSync(p, 'utf8'));
    }
    fs.writeFileSync(file, logs.join(''), { encoding: 'utf8', mode: 0o600 });
    return { ok: true };
  }
  log('startup', { version: app.getVersion(), electron: process.versions.electron || '', chrome: process.versions.chrome || '', node: process.versions.node, os: os.release(), arch: process.arch });
  return { log, error, exportTo, get degraded() { return degraded; }, directory };
}
module.exports = { createDiagnostics, route };
