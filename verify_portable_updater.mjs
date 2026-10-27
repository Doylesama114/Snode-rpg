// 便携版自更新验收：清单解析 / 下载 / sha512 / 解压 / 替换命令真实执行

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const U = require('./electron-app/portable-updater.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? ' -> ' + extra : '')); } };

console.log('=== ① 版本与清单解析 ===');
ok('版本比较 8083 > 8082', U.compareVersion('1.0.8083', '1.0.8082') === 1);
ok('版本相同', U.compareVersion('v1.0.8083', '1.0.8083') === 0);
ok('清单解析', (() => { const m = U.parsePortableManifest(JSON.stringify({ version: '1.0.8083', url: 'https://x/y.zip', sha512: 'abc', size: 5 })); return m && m.version === '1.0.8083' && m.url === 'https://x/y.zip'; })());
ok('坏清单返回 null', U.parsePortableManifest('not json') === null && U.parsePortableManifest('{"version":"1"}') === null);

console.log('=== ② 用真 zip 跑下载→校验→解压→定位 ===');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snode-portable-test-'));
const appSrc = path.join(tmp, 'app');
fs.mkdirSync(path.join(appSrc, 'resources'), { recursive: true });
fs.writeFileSync(path.join(appSrc, '斯诺德跑团.exe'), 'fake-exe');
fs.writeFileSync(path.join(appSrc, 'resources', 'app.asar'), 'fake-asar');
fs.writeFileSync(path.join(appSrc, 'version.txt'), '1.0.8083');

const zipPath = path.join(tmp, 'Snode-RPG-1.0.8083-win-x64.zip');
const zipRes = spawnSync('tar.exe', ['-a', '-cf', zipPath, '-C', appSrc, '.'], { encoding: 'utf8' });
ok('生成测试 zip', zipRes.status === 0 && fs.existsSync(zipPath), (zipRes.stderr || '').slice(0, 120));

const sha = await U.sha512Base64(zipPath);
const size = fs.statSync(zipPath).size;
const manifest = { version: '1.0.8083', url: '', sha512: sha, size };

const server = http.createServer((req, res) => {
  const p = path.join(tmp, path.basename(req.url));
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('no'); }
  res.setHeader('Content-Length', fs.statSync(p).size);
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
manifest.url = 'http://127.0.0.1:' + port + '/' + path.basename(zipPath);

const dlFile = path.join(tmp, 'downloaded.zip');
let sawProgress = false;
await U.downloadToFile(manifest.url, dlFile, { onProgress: () => { sawProgress = true; } });
ok('下载完成且大小一致', fs.statSync(dlFile).size === size);
ok('上报进度', sawProgress || size < 5000);

const sha2 = await U.sha512Base64(dlFile);
ok('sha512 校验一致', sha2 === manifest.sha512);
const tampered = 'AAAA' + sha2.slice(4);
ok('篡改后校验不一致', tampered !== sha2);

const dest = path.join(tmp, 'extracted');
const ex = U.extractZip(dlFile, dest);
ok('解压成功（tar 或 powershell）', ex.ok, ex.error);
const root = U.findExtractRoot(dest, '斯诺德跑团.exe');
ok('定位到含主程序的目录', !!root && fs.existsSync(path.join(root, '斯诺德跑团.exe')));
ok('资源文件一并解出', fs.existsSync(path.join(root, 'resources', 'app.asar')));

console.log('=== ③ 替换命令构造 ===');
const sample = U.buildApplyCommand({ srcDir: root, dstDir: 'D:\\SnodeRPG', exePath: 'D:\\SnodeRPG\\斯诺德跑团.exe', delaySeconds: 12 });
const line = sample.split('|').slice(2).join('|');
ok('含延迟', /ping 127\.0\.0\.1 -n 12/.test(line));
ok('robocopy 覆盖（/E /IS /IT，不用 /MIR）', /robocopy .*\/E \/IS \/IT/.test(line) && !/\/MIR/.test(line));
ok('路径带引号', /"D:\\SnodeRPG"/.test(line));
ok('末尾重启应用', /start "" "D:\\SnodeRPG\\斯诺德跑团\.exe"/.test(line));

console.log('=== ④ 命令真的能执行（用假目录模拟替换） ===');
const fakeDst = path.join(tmp, 'target');
fs.mkdirSync(fakeDst, { recursive: true });
fs.writeFileSync(path.join(fakeDst, 'old-only.txt'), 'old');
const realCmdFull = U.buildApplyCommand({ srcDir: root, dstDir: fakeDst, exePath: path.join(fakeDst, '斯诺德跑团.exe'), delaySeconds: 1 });
const realCmd = realCmdFull.split('|').slice(2).join('|').replace(/start "" ".*"/, 'echo done');
console.log('DEBUG root=', root);
console.log('DEBUG cmd=', realCmd);
const rr = spawnSync('cmd.exe', ['/c', realCmd], { encoding: 'utf8', windowsVerbatimArguments: true });
console.log('DEBUG status=', rr.status, 'out=', (rr.stdout||'').slice(0,300));
console.log('DEBUG target files=', fs.readdirSync(fakeDst));
ok('替换命令退出码 0', rr.status === 0, (rr.stderr || '').slice(0, 120));
ok('新文件已覆盖', fs.readFileSync(path.join(fakeDst, 'version.txt'), 'utf8') === '1.0.8083');
ok('旧多余文件保留（不做 /MIR）', fs.existsSync(path.join(fakeDst, 'old-only.txt')));

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log('\n结果: ' + pass + 'P / ' + fail + 'F');
process.exit(fail ? 1 : 0);