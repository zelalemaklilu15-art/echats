// Service Worker for Echat — Push Notifications + Safe Runtime Caching
// NOTE: We intentionally do NOT cache the HTML shell or hashed JS/CSS assets.
// Caching them broke reloads after deploys (stale HTML → missing chunks → black screen).

const CACHE_NAME = 'echat-v3';
const STATIC_ASSETS = ['/favicon.ico', '/manifest.json'];

// =============================================
// INSTALL — cache only stable static assets
// =============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// =============================================
// ACTIVATE — purge ALL old caches (fixes stale bundle black-screen)
// =============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// =============================================
// FETCH — network-only for HTML/JS/CSS to prevent stale-deploy black screens.
//   Only cache tiny stable assets (icons/manifest).
// =============================================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol === 'chrome-extension:' || url.hostname.includes('supabase.co')) return;

  // Never intercept HTML navigation or hashed app bundles — always go to network.
  if (req.mode === 'navigate' || url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html')) {
    return; // let the browser handle it (network)
  }

  // Small static files — cache-first with silent update.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// =============================================
// PUSH — incoming push notifications
// =============================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'Echat',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'default',
    data: {},
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: data.tag === 'incoming-call',
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
