import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

const unregisterAppServiceWorkers = async () => {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith('/sw.js') || r.installing?.scriptURL.endsWith('/sw.js') || r.waiting?.scriptURL.endsWith('/sw.js')).map((r) => r.unregister().catch(() => {})));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('echat-')).map((k) => caches.delete(k).catch(() => {})));
    }
  } catch { /* noop */ }
};

// Service worker: remove the old app-shell worker everywhere. It previously
// cached stale builds and could show a black screen before React even started.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await unregisterAppServiceWorkers();
    } catch { /* noop */ }
  });
}

// Auto-recover from chunk load errors (e.g. after a deploy). Reload once.
window.addEventListener('error', (e: any) => {
  const msg = String(e?.message || '');
  if (/Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    if (!sessionStorage.getItem('__echat_chunk_reload')) {
      sessionStorage.setItem('__echat_chunk_reload', '1');
      location.reload();
    }
  }
});
