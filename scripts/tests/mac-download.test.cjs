const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { downloadToFile } = require('../../electron-app/mac-download.js');

const PAYLOAD = Buffer.from('x'.repeat(256 * 1024) + 'snowd-mac-update');
const SHA = crypto.createHash('sha512').update(PAYLOAD).digest('base64');

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/a') { res.writeHead(302, { Location: '/b' }); return res.end(); }
    if (req.url === '/b') { res.writeHead(302, { Location: '/c' }); return res.end(); }
    if (req.url === '/c') { res.writeHead(200, { 'Content-Length': PAYLOAD.length }); return res.end(PAYLOAD); }
    if (req.url === '/missing') { res.writeHead(404); return res.end('nope'); }
    if (req.url === '/loop') { res.writeHead(302, { Location: '/loop' }); return res.end(); }
    if (req.url === '/truncated') {
      res.writeHead(200, { 'Content-Length': PAYLOAD.length });
      res.write(PAYLOAD.subarray(0, 1024));
      setTimeout(() => res.destroy(), 30);
      return;
    }
    res.writeHead(500); res.end();
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function tmpFile(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'snowd-dl-')), name);
}

test('重定向链 302→302→200：文件存在且内容完整（8104 ENOENT 回归）', async () => {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const dest = tmpFile('Snode-RPG-1.0.8104-mac-arm64.zip');
  const percents = [];
  await downloadToFile(base + '/a', dest, { onProgress: p => percents.push(p) });
  assert.ok(fs.existsSync(dest), '文件必须存在');
  const hash = crypto.createHash('sha512').update(fs.readFileSync(dest)).digest('base64');
  assert.equal(hash, SHA, '内容必须完整');
  assert.ok(percents.length > 0, '应有进度回调');
  server.close();
});

test('目标目录不存在时自动创建', async () => {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const dest = path.join(tmpFile('x'), 'mac-update', 'deep', 'a.zip');
  await downloadToFile(base + '/c', dest);
  assert.ok(fs.existsSync(dest));
  server.close();
});

test('HTTP 错误与重定向死循环会失败且不留垃圾文件', async () => {
  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const d1 = tmpFile('missing.zip');
  await assert.rejects(() => downloadToFile(base + '/missing', d1), /HTTP 404/);
  assert.ok(!fs.existsSync(d1), '404 不应留下文件');
  const d2 = tmpFile('loop.zip');
  await assert.rejects(() => downloadToFile(base + '/loop', d2), /重定向次数过多/);
  assert.ok(!fs.existsSync(d2), '死循环不应留下文件');
  server.close();
});
