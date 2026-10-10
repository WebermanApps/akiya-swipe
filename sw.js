/* Service worker: app shell + data precached; photos cached as they are viewed. */
const V = '35012bd4b6', SHELL = 'akiya-shell-' + V, PHOTOS = 'akiya-photos-v1';
const ASSETS = ['./', 'index.html', 'app.css?v=' + V, 'app.js?v=' + V, 'vendor/leaflet.js?v=' + V, 'vendor/leaflet.css?v=' + V,
  'japan.json?v=' + V, 'data.json?v=' + V, 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('akiya-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(p|t)\/[^/]+/.test(u.pathname)) {   // photos & thumbnails: cache-first, stored when first viewed
    e.respondWith(caches.open(PHOTOS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r }))));
    return;
  }
  if (e.request.mode === 'navigate') {        // page: network first so updates show, cache when offline
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put('index.html', copy)); return r }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
