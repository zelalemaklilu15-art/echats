import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

const isLovablePreviewHost = (hostname: string) =>
  hostname.startsWith('id-preview--') ||
  hostname.startsWith('preview--') ||
  hostname === 'lovableproject.com' ||
  hostname.endsWith('.lovableproject.com') ||
  hostname === 'lovableproject-dev.com' ||
  hostname.endsWith('.lovableproject-dev.com') ||
  hostname === 'beta.lovable.dev' ||
  hostname.endsWith('.beta.lovable.dev');

const unregisterAppServiceWorkers = async () => {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith('/sw.js') || r.installing?.scriptURL.endsWith('/sw.js') || r.waiting?.scriptURL.endsWith('/sw.js') || r.scope === `${window.location.origin}/`).map((r) => r.unregister().catch(() => {})));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('echat-')).map((k) => caches.delete(k).catch(() => {})));
    }
  } catch { /* noop */ }
};

// Service worker: keep it out of dev/Lovable preview so stale cached shells
// cannot hide the app behind a black screen while building or reviewing.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const shouldDisableSw =
        !import.meta.env.PROD ||
        window.self !== window.top ||
        isLovablePreviewHost(window.location.hostname) ||
        new URLSearchParams(window.location.search).get('sw') === 'off';

      if (shouldDisableSw) {
        await unregisterAppServiceWorkers();
        return;
      }

      const RECOVERY_KEY = 'echat_sw_recovery_v3';
      if (!localStorage.getItem(RECOVERY_KEY)) {
        await unregisterAppServiceWorkers();
        localStorage.setItem(RECOVERY_KEY, '1');
      }
      await navigator.serviceWorker.register('/sw.js');
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
