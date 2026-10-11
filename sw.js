/**
 * Checklist &bull; Progressive Web App (PWA) Service Worker
 * Cache-First & Stale-While-Revalidate Offline Strategy
 */

const CACHE_NAME = 'checklist-pwa-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './dsa.js',
  './db.js',
  './logo.svg',
  './logo.jpg',
  './manifest.json'
];

// Install: Cache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Purge obsolete cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate strategy for maximum speed + offline reliability
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  // Exclude non-http schemes (e.g. chrome-extension://)
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // If network succeeded and returned 200, update cache asynchronously
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: if network fails, cachedResponse will save us
          return cachedResponse;
        });

      // Return cached version immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
