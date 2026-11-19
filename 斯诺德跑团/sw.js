/* 斯诺德跑团 PWA Service Worker（2026-11-19）
 * 策略：
 *   导航请求：network-first，失败回缓存，再失败回启动台；
 *   静态资源：cache-first + 后台更新；
 *   更新：新 SW 就绪后由 pwa.js 提示用户刷新（不自动 skipWaiting）。
 */
var VERSION = 'snowd-pwa-v1';
var SHELL = [
  './启动台.html',
  './安装到主屏幕.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
  './guild-ui.js',
  './guild-ui.css',
  './pwa.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) {
    return Promise.all(SHELL.map(function (url) {
      return cache.add(url).catch(function () { /* 单个失败不影响安装 */ });
    }));
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) {
      return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./启动台.html');
      });
    }));
    return;
  }

  event.respondWith(caches.match(req).then(function (hit) {
    var network = fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || network;
  }));
});
