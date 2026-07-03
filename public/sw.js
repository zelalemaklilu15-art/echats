// Echat service-worker kill switch.
// This file intentionally removes the old app-shell worker that could serve
// stale cached HTML/JS after deploys and leave returning users on a black page.

function isEchatAppCache(name) {
  const isOldEchatCache = name.startsWith('echat-');
  const isWorkboxCacheForThisScope = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name)
    && name.endsWith(self.registration.scope);
  return isOldEchatCache || isWorkboxCacheForThisScope;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.filter(isEchatAppCache).map((name) => caches.delete(name)));
        await self.clients.claim();

        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
