const CACHE_NAME = 'smart-attend-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-192x192.png',
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
  const url = event.request.url;

  // Don't intercept cross-origin requests (e.g. Google Drive image URLs, lh3.googleusercontent.com)
  // Let the browser handle them natively
  if (!url.startsWith(self.location.origin)) {
    return; // Pass through cross-origin requests without intercepting
  }

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
        console.error('[SW] Fetch failed for URL:', url, err);
        throw err;
      });
    })
  );
});

// Web Push Event Handler
self.addEventListener('push', (event) => {
  let data = { title: 'Smart Attend Notification', body: 'You have a new update.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'smart-attend-push',
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
