/**
 * 便携版自更新（zip 覆盖式）
 * ------------------------------------------------------------
 * 为什么不用 NSIS/electron-updater 的安装器路径：
 *   安装器的更新会先运行旧版本卸载器，而卸载器只认安装时烘焙的目录；
 *   目录被搬动（D 盘、junction、手工注册表）后必然返回非 0，静默模式下直接中止。
 *   便携版完全绕开安装器：下载 zip → 校验 → 解压 → 应用退出后 robocopy 覆盖 → 重启。
 *
 * 本模块不依赖 electron 运行时，除 ctx 注入外全部是纯函数，便于离线测试。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { spawn } = require('child_process');

const ZIP_NAME_RE = /^Snode-RPG-(\d+\.\d+\.\d+)-win.*\.zip$/i;
const LOW_SPEED_BPS = 100 * 1024;
const LOW_SPEED_MS = 60000;
const APPLY_DELAY_SECONDS = 12;

/* ---------- 版本 ---------- */
function parseVersion(v) {
  return String(v || '').replace(/^v/i, '').split('.').map(function (x) { return parseInt(x, 10) || 0; });
}
function compareVersion(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/* ---------- 清单 ---------- */
function parsePortableManifest(text) {
  if (!text) return null;
  let data;
  try { data = JSON.parse(String(text)); } catch (e) { return null; }
  if (!data || !data.version || !data.url) return null;
  const version = String(data.version).replace(/^v/i, '');
  return {
    version: version,
    url: String(data.url),
    sha512: String(data.sha512 || ''),
    size: Number(data.size) || 0,
    publishedAt: String(data.publishedAt || ''),
  };
}

/* ---------- 下载 ---------- */
function fetchText(url, redirects) {
  redirects = redirects == null ? 3 : redirects;
  return new Promise(function (resolve, reject) {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.get(u, {
      headers: { 'User-Agent': 'SnodeRPG-Updater', 'Cache-Control': 'no-cache', 'Accept': '*/*' },
      timeout: 30000,
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return fetchText(new URL(res.headers.location, u).toString(), redirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { buf += c; });
      res.on('end', function () { resolve(buf); });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function downloadToFile(url, destFile, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const mod = u.protocol === 'http:' ? http : https;
    const out = fs.createWriteStream(destFile);
    let received = 0;
    let total = 0;
    let lastTick = Date.now();
    let lastBytes = 0;
    let slowSince = 0;
    let settled = false;

    const token = opts.token || {};
    const req = mod.get(u, {
      headers: { 'User-Agent': 'SnodeRPG-Updater', 'Accept': '*/*' },
      timeout: 30000,
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        out.close();
        try { fs.unlinkSync(destFile); } catch (e) {}
        return downloadToFile(new URL(res.headers.location, u).toString(), destFile, opts).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        out.close();
        try { fs.unlinkSync(destFile); } catch (e) {}
        return reject(new Error('HTTP ' + res.statusCode));
      }
      total = Number(res.headers['content-length']) || 0;
      res.on('data', function (chunk) {
        if (token.cancelled) {
          req.destroy(new Error('cancelled'));
          return;
        }
        received += chunk.length;
        out.write(chunk);
        const now = Date.now();
        if (now - lastTick >= 5000) {
          const bps = (received - lastBytes) / ((now - lastTick) / 1000);
          lastBytes = received;
          lastTick = now;
          if (opts.onProgress) {
            opts.onProgress({ percent: total ? (received / total) * 100 : 0, transferred: received, total: total, bytesPerSecond: bps });
          }
          if (bps > 0 && bps < LOW_SPEED_BPS) {
            if (!slowSince) slowSince = now;
            else if (now - slowSince >= LOW_SPEED_MS) {
              req.destroy(new Error('low-speed'));
            }
          } else {
            slowSince = 0;
          }
        }
      });
      res.on('end', function () {
        if (settled) return;
        settled = true;
        out.end(function () {
          if (total && received !== total) return reject(new Error('size mismatch ' + received + '/' + total));
          resolve({ file: destFile, size: received });
        });
      });
      res.on('error', function (err) { if (!settled) { settled = true; out.close(); reject(err); } });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', function (err) { if (!settled) { settled = true; out.close(); reject(err); } });
  });
}

/* ---------- 校验/解压/替换 ---------- */
function sha512Base64(file) {
  return new Promise(function (resolve, reject) {
    const h = crypto.createHash('sha512');
    const s = fs.createReadStream(file);
    s.on('data', function (d) { h.update(d); });
    s.on('end', function () { resolve(h.digest('base64')); });
    s.on('error', reject);
  });
}

function findExtractRoot(dir, exeName, depth) {
  depth = depth == null ? 2 : depth;
  const target = String(exeName || '').toLowerCase();
  function walk(cur, level) {
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (e) { return null; }
    for (const ent of entries) {
      if (ent.isFile() && ent.name.toLowerCase() === target) return cur;
    }
    if (level <= 0) return null;
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const hit = walk(path.join(cur, ent.name), level - 1);
      if (hit) return hit;
    }
    return null;
  }
  return walk(dir, depth);
}

function buildApplyCommand(opts) {
  const src = opts.srcDir;
  const dst = opts.dstDir;
  const exe = opts.exePath;
  const q = String.fromCharCode(34);
  const parts = [
    'ping 127.0.0.1 -n ' + (opts.delaySeconds || APPLY_DELAY_SECONDS) + ' >nul',
    'robocopy ' + q + src + q + ' ' + q + dst + q + ' /E /IS /IT /R:5 /W:1 /NFL /NDL /NJH /NJS /NP',
    'start ' + q + q + ' ' + q + exe + q,
  ];
  return 'cmd.exe|/c|' + parts.join(' & ');
}

function spawnDetached(commandLine) {
  const parts = commandLine.split('|');
  const exe = parts[0];
  const args = parts.slice(1);
  const child = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true });
  child.unref();
  return child.pid;
}

module.exports = {
  parseVersion: parseVersion,
  compareVersion: compareVersion,
  parsePortableManifest: parsePortableManifest,
  fetchText: fetchText,
  downloadToFile: downloadToFile,
  sha512Base64: sha512Base64,
  findExtractRoot: findExtractRoot,
  buildApplyCommand: buildApplyCommand,
  spawnDetached: spawnDetached,
  ZIP_NAME_RE: ZIP_NAME_RE,
  APPLY_DELAY_SECONDS: APPLY_DELAY_SECONDS,
};

/* ---------- 解压 ---------- */
function runSync(exe, args, opts) {
  const { spawnSync } = require('child_process');
  return spawnSync(exe, args, Object.assign({ encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true }, opts || {}));
}

function extractZip(zipFile, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  // Windows 10+ 自带 bsdtar，直接支持 zip
  let r = runSync('tar.exe', ['-xf', zipFile, '-C', destDir]);
  if (r.status === 0) return { ok: true, tool: 'tar' };
  // 回退 PowerShell
  const ps = 'Expand-Archive -LiteralPath ' + JSON.stringify(zipFile) + ' -DestinationPath ' + JSON.stringify(destDir) + ' -Force';
  r = runSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  if (r.status === 0) return { ok: true, tool: 'powershell' };
  return { ok: false, tool: 'none', error: (r.stderr || r.stdout || '').slice(0, 400) };
}

module.exports.extractZip = extractZip;
