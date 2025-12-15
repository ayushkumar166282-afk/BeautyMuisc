
const CACHE_NAME = 'music-app-offline-v5';

// 1. Install Phase: Cache the critical app shell immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/index.tsx',
        '/manifest.json'
      ]);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// 2. Activate Phase: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// 3. Fetch Phase: The "Cache, then Network" Strategy
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests (assets, files)
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension requests or other non-http schemes
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // A. If found in cache, return it immediately (OFFLINE SUPPORT)
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Validation: Ensure valid response before caching
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        // Clone the response because it's a stream and can only be consumed once
        const responseToCache = networkResponse.clone();

        // C. Save to cache for next time
        caches.open(CACHE_NAME).then((cache) => {
          try {
             cache.put(event.request, responseToCache);
          } catch (err) {
             console.warn('Cache error', err);
          }
        });

        return networkResponse;
      }).catch(() => {
        // Optional: If offline and not in cache, you could return a fallback image or file here
        // For now, we just let the browser handle the offline error for uncached items
      });
    })
  );
});
