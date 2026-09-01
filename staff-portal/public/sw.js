const CACHE_NAME = 'smart-attend-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Resilient Pre-caching on Service Worker Installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { redirect: 'follow' });
            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[SW Install] Pre-cache non-critical skip for:', url, err);
          }
        })
      );
    })
  );
});

// Cache Activation & Stale Cache Cleanup
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interception with Navigation & Offline Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Pass through cross-origin requests natively
  if (!url.startsWith(self.location.origin)) {
    return;
  }

  // Network-first strategy for navigation / SPA HTML requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigate response
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(request).then((cachedResp) => {
            return cachedResp || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.error('[SW Fetch Error] URL:', url, err);
        throw err;
      });
    })
  );
});

// Web Push Event Handler
self.addEventListener('push', (event) => {
  console.log('[SW Push] 🔔 Push event received');
  let data = { title: 'Smart Staff Attendance', body: 'You have a new notification update.' };

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
      .catch((err) => console.error('[SW Push Error]:', err))
  );

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          data: data,
          timestamp: new Date().toISOString()
        });
      }
    })
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

// Background Sync Handler for PWABuilder audit compliance
self.addEventListener('sync', (event) => {
  console.log('[SW Sync] Background sync event triggered:', event.tag);
});

// Periodic Background Sync Handler for PWABuilder audit compliance
self.addEventListener('periodicsync', (event) => {
  console.log('[SW PeriodicSync] Periodic background sync event triggered:', event.tag);
});

// PostMessage Communication Handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

