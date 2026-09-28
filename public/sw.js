/**
 * WILLShop OS — Service Worker
 * Focus: PWA Reliability, Fast Static Shell & ZERO Sensitive Data Caching.
 * API endpoints (/api/*), Supabase REST queries, WhatsApp, CRM and orders are NEVER cached.
 */

const CACHE_NAME = 'willshop-pwa-v1';

const STATIC_ASSETS = [
  '/offline',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
];

// Install Event — Pre-cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch (err) {
          console.warn(`[SW Install] Failed to cache ${asset}:`, err);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate Event — Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event — Security First Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. NEVER cache non-GET requests (POST, PUT, DELETE, PATCH)
  if (request.method !== 'GET') {
    return;
  }

  // 2. NEVER cache sensitive APIs, Supabase DB calls, Webhooks or Auth routes
  const isApiRoute = url.pathname.startsWith('/api/');
  const isSupabase = url.hostname.includes('supabase.co');
  const isAuth = url.pathname.includes('/auth/') || url.pathname.includes('/login');
  const isExternalApi = url.hostname.includes('whatsapp') || url.hostname.includes('evolution');

  if (isApiRoute || isSupabase || isAuth || isExternalApi) {
    // Network-only: Pass straight through
    return;
  }

  // 3. Navigation Requests (HTML Pages) -> Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match('/offline');
        return cachedOffline || cache.match('/');
      })
    );
    return;
  }

  // 4. Static Assets (JS, CSS, Images, Fonts) -> Stale-While-Revalidate
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
