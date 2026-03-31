const CACHE_NAME = 'smart-attend-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

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
  // Use a Network-First strategy for the main page to avoid caching old index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch((err) => {
        // Only return an offline indicator if this is a navigate request or static asset
        // Don't return 503 for API calls as it hides real CORS/Error issues
        const isApi = event.request.url.includes('/attendance/') || 
                      event.request.url.includes('/auth/') || 
                      event.request.url.includes('/users/') || 
                      event.request.url.includes('/roaster/') || 
                      event.request.url.includes('/analytics/');
        
        if (isApi) {
            throw err; // Let the real error reach the application
        }

        console.error('Fetch failed for non-API:', err);
        return new Response('Network error or offline', { 
            status: 503, 
            statusText: 'Service Unavailable' 
        });
      });
    })
  );
});
