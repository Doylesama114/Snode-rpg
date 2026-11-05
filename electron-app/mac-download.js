'use strict';
/**
 * 下载到文件（支持重定向），v1.0.8104。
 *
 * 旧实现（8101-8103）的 bug：
 *   一开始就 createWriteStream(dest)；遇到 302 时 file.close(cb -> unlink(dest))，
 *   同时又递归调用新一次下载重新打开同一个 dest。
 *   于是「新流的文件」被「上一个流的 unlink」删掉 —— 写入落到已删除的 inode，
 *   最终 stat / sha512 打开时报 ENOENT（macOS 用户看到的就是这个）。
 *
 * 现在：重定向阶段不碰磁盘，只有拿到 200 才创建写流；父目录缺失时按需创建并把错误抛出来。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const MAX_REDIRECTS = 8;

function downloadToFile(url, dest, options) {
  const opts = options || {};
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const timeoutMs = opts.timeoutMs || 120000;
  const userAgent = opts.userAgent || 'SnodeRPG';

  function hop(currentUrl, depth) {
    if (depth > MAX_REDIRECTS) return Promise.reject(new Error('重定向次数过多'));
    return new Promise(function (resolve, reject) {
      const lib = currentUrl.indexOf('http://') === 0 ? http : https;
      const req = lib.get(currentUrl, { headers: { 'User-Agent': userAgent } }, function (res) {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          let next;
          try { next = new URL(res.headers.location, currentUrl).toString(); }
          catch (e) { reject(new Error('重定向地址无效: ' + res.headers.location)); return; }
          hop(next, depth + 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error('HTTP ' + status));
          return;
        }
        try { fs.mkdirSync(path.dirname(dest), { recursive: true }); }
        catch (e) { reject(new Error('无法创建目录 ' + path.dirname(dest) + ': ' + e.message)); return; }

        const file = fs.createWriteStream(dest);
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let got = 0;
        file.on('error', function (err) { res.destroy(); reject(err); });
        res.on('error', function (err) {
          file.destroy();
          fs.unlink(dest, function () {});
          reject(err);
        });
        res.on('data', function (chunk) {
          got += chunk.length;
          if (total > 0 && onProgress) onProgress(Math.min(99, Math.round((got / total) * 100)));
        });
        res.pipe(file);
        file.on('finish', function () {
          file.close(function () {
            try {
              const size = fs.statSync(dest).size;
              if (total > 0 && size !== total) { reject(new Error('下载不完整：' + size + '/' + total)); return; }
            } catch (e) { reject(e); return; }
            resolve(dest);
          });
        });
      });
      req.on('error', function (err) { reject(err); });
      req.setTimeout(timeoutMs, function () { req.destroy(new Error('下载超时')); });
    });
  }

  return hop(url, 0).then(function () {
    if (!fs.existsSync(dest)) throw new Error('下载完成但文件不存在: ' + dest);
    return dest;
  });
}

module.exports = { downloadToFile: downloadToFile, MAX_REDIRECTS: MAX_REDIRECTS };
