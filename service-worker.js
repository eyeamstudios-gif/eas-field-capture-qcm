/**
 * EAS Field Capture QCM — Service Worker
 * Offline app shell + static asset caching
 */

const CACHE_NAME = 'field-capture-qcm-v1.0.1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/styles.css',
  '/js/app.js',
  '/js/utils.js',
  '/js/storage.js',
  '/js/shotlists.js',
  '/js/qcm.js',
  '/js/camera.js',
  '/js/export.js',
  '/js/simple-field-method.js',
  '/js/xpd-ground-capture.js',
  '/assets/icons/icon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(ASSETS.map((url) => cache.add(url))).then((results) => {
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length) {
            console.warn('Service worker: some assets failed to cache', failed.length);
          }
        })
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const networkFirst =
    url.pathname.startsWith('/js/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
