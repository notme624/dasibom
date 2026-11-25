/*
 * 다시봄 서비스 워커
 * - 인터넷이 될 때는 항상 최신 파일을 받아요 (수정이 바로 반영되도록).
 * - 인터넷이 끊기면 마지막으로 받은 화면을 보여 줘요.
 */
const CACHE = 'dasibom-v4';
const SHELL = [
  './', './index.html', './seller.html', './terms.html', './demo.html',
  './assets/style.css', './assets/store.js',
  './manifest.webmanifest', './seller.webmanifest',
  './assets/icons/icon-192.png', './assets/icons/seller-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
