/* Stek service worker: use the newest app files when online, the saved copy when offline. */
const CACHE = 'stek-v5';
const FILES = ['./', 'index.html', 'styles.css', 'data.js', 'engine.js', 'fish.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/atkinson-Regular.woff', 'fonts/atkinson-Bold.woff', 'fonts/barlow-condensed-Medium.woff',
  'fonts/barlow-condensed-SemiBold.woff', 'fonts/barlow-condensed-Bold.woff'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./')))
  );
});
