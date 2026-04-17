const CACHE_NAME = 'smart-admin-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Patterns for API calls that should NOT be cached
const API_PATTERNS = [
  '/attendance/',
  '/auth/',
  '/users/',
  '/roaster/',
  '/analytics/',
  '/settings/'
];

const isApiCall = (url) => {
  return API_PATTERNS.some(pattern => url.includes(pattern));
};

const isAppRoute = (request) => {
  const url = new URL(request.url);
  return request.method === 'GET' && !url.pathname.split('/').pop().includes('.');
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Don't intercept cross-origin requests (e.g. Google Drive image URLs, lh3.googleusercontent.com)
  // Let the browser handle them natively
  if (!url.startsWith(self.location.origin)) {
    return; // Pass through cross-origin requests without intercepting
  }

  // For SPA routes, use network-first and fall back to index.html.
  if (request.mode === 'navigate' || isAppRoute(request)) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match(request);
      })
    );
    return;
  }

  // For API calls, use network-first strategy (always try network first)
  if (isApiCall(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch((error) => {
          console.error('[SW] Fetch failed for API:', url, error);
          throw error; // Re-throw to let the app handle it
        })
    );
    return;
  }

  // For static assets, use cache-first strategy
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).catch((err) => {
        console.error('[SW] Fetch failed for asset:', url, err);
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});
